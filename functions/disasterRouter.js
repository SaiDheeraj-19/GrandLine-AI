/**
 * AI #3 — CORE: Volunteer-Driven Disaster Routing Algorithm
 * The most important function in the system.
 * Called every time a new issue is saved to Firestore.
 * Routes disaster TO the nearest volunteer cluster — not the other way around.
 */

const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getDistance } = require("./utils/haversine");

// Skill requirements per disaster type — used for composite routing score
const SKILL_MAP = {
  flood:        ["rescue", "logistics", "general"],
  cyclone:      ["rescue", "logistics", "shelter"],
  earthquake:   ["rescue", "medical", "shelter"],
  medical:      ["medical", "general"],
  food:         ["food", "logistics", "general"],
  drought:      ["water", "food", "general"],
  shelter:      ["shelter", "logistics", "general"],
  displacement: ["shelter", "food", "counselling"],
  heatwave:     ["medical", "water", "general"],
  fire:         ["rescue", "medical"],
  chemical:     ["medical", "rescue"],
  other:        ["general"],
};

function computeSkillMatch(issueType, volunteerSkills) {
  const needed = SKILL_MAP[issueType] || ["general"];
  const matches = needed.filter((s) => (volunteerSkills || []).includes(s)).length;
  return matches / needed.length;
}

/**
 * Main routing function.
 * 1. Bounding-box pre-filter on volunteer_zones (fast Firestore query)
 * 2. Haversine exact-circle check
 * 3. Composite score: skill match 50% + proximity 35% + capacity 15%
 * 4. Escalate to national pool if no zone covers the disaster
 */
async function routeDisasterToVolunteer(issue) {
  const db = getFirestore();
  const { lat, lng } = issue.location;

  // ── STEP 1: Bounding-box pre-filter ────────────────────────────────────────
  // Firestore can only do single-field inequalities, so we filter by lat_min/lat_max
  // and do the lng + exact Haversine check in memory after fetching.
  const zonesSnap = await db
    .collection("volunteer_zones")
    .where("lat_min", "<=", lat)
    .where("lat_max", ">=", lat)
    .where("status", "in", ["active", "at_capacity"])
    .get();

  const candidates = [];

  for (const zoneDoc of zonesSnap.docs) {
    const zone = zoneDoc.data();

    // lng bounding-box check (can't do in Firestore with lat inequality active)
    if (lng < zone.lng_min || lng > zone.lng_max) continue;

    // ── STEP 2: Exact Haversine circle check ──────────────────────────────────
    const distanceKm = getDistance(
      { lat, lng },
      { lat: zone.center.lat, lng: zone.center.lng }
    );

    if (distanceKm > zone.radius_km) continue; // outside this volunteer's circle

    // ── STEP 3: Fetch full volunteer doc for skill matching ───────────────────
    const volDoc = await db.collection("volunteers").doc(zoneDoc.id).get();
    if (!volDoc.exists) continue;
    const volunteer = volDoc.data();

    if (volunteer.status !== "available") continue;

    const skillMatchScore = computeSkillMatch(issue.issue_type, volunteer.skills);

    // Composite routing score — closer + better skill match + more capacity = top priority
    const proximityScore = 1 - distanceKm / zone.radius_km; // 0 (edge) → 1 (centre)
    const capacityScore = Math.min((volunteer.capacity || 50) / 100, 1);
    const routingScore =
      skillMatchScore * 0.50 +
      proximityScore * 0.35 +
      capacityScore * 0.15;

    candidates.push({
      volunteer_id: zoneDoc.id,
      volunteer_name: volunteer.name,
      volunteer_phone: volunteer.phone || null,
      distance_km: Math.round(distanceKm * 10) / 10,
      eta_minutes: Math.round(distanceKm * 3), // ~20 km/h off-road estimate
      skill_match_score: Math.round(skillMatchScore * 100) / 100,
      routing_score: Math.round(routingScore * 1000) / 1000,
      state: volunteer.location?.state || "Unknown",
      skills: volunteer.skills,
    });
  }

  // Sort best → worst routing score
  candidates.sort((a, b) => b.routing_score - a.routing_score);

  // ── STEP 4: No local volunteer — escalate to national pool ─────────────────
  if (candidates.length === 0) {
    return escalateToNationalPool(issue, db);
  }

  const best = candidates[0];

  // Write routing decision back to the issue document
  await db.collection("issues").doc(issue.id).update({
    routed_to_volunteer_id: best.volunteer_id,
    routed_to_cluster_ids: candidates.slice(0, 5).map((c) => c.volunteer_id),
    routing_status: "routed",
    routing_distance_km: best.distance_km,
    escalated: false,
    escalated_to_state: null,
    routed_at: FieldValue.serverTimestamp(),
  });

  // Append to routing log for analytics
  await db.collection("routing_log").add({
    issue_id: issue.id,
    volunteer_id: best.volunteer_id,
    distance_km: best.distance_km,
    skill_match_score: best.skill_match_score,
    eta_minutes: best.eta_minutes,
    all_candidates_count: candidates.length,
    routed_at: FieldValue.serverTimestamp(),
    accepted: false,
    response_time_seconds: null,
  });

  return {
    routed: true,
    escalated: false,
    volunteer: best,
    all_candidates: candidates,
  };
}

async function escalateToNationalPool(issue, db) {
  const { lat, lng } = issue.location;

  // Fetch all available volunteers across India — find the closest one
  const allVolsSnap = await db
    .collection("volunteers")
    .where("status", "==", "available")
    .get();

  let nearest = null;
  let nearestDist = Infinity;

  for (const volDoc of allVolsSnap.docs) {
    const vol = volDoc.data();
    if (!vol.location?.lat || !vol.location?.lng) continue;
    const dist = getDistance({ lat, lng }, { lat: vol.location.lat, lng: vol.location.lng });
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = { id: volDoc.id, ...vol, distance_km: Math.round(dist * 10) / 10 };
    }
  }

  const { FieldValue } = require("firebase-admin/firestore");

  await db.collection("issues").doc(issue.id).update({
    routed_to_volunteer_id: nearest ? nearest.id : null,
    routed_to_cluster_ids: nearest ? [nearest.id] : [],
    routing_status: nearest ? "routed" : "pending",
    routing_distance_km: nearest ? nearest.distance_km : null,
    escalated: true,
    escalated_to_state: nearest ? nearest.location?.state : "national",
    routed_at: FieldValue.serverTimestamp(),
  });

  if (nearest) {
    await db.collection("routing_log").add({
      issue_id: issue.id,
      volunteer_id: nearest.id,
      distance_km: nearest.distance_km,
      skill_match_score: computeSkillMatch(issue.issue_type, nearest.skills || []),
      escalated: true,
      routed_at: FieldValue.serverTimestamp(),
      accepted: false,
      response_time_seconds: null,
    });
  }

  return {
    routed: !!nearest,
    escalated: true,
    volunteer: nearest,
    escalation_reason: "No volunteer within normal reach radius — routed to nearest national pool",
  };
}

module.exports = { routeDisasterToVolunteer, computeSkillMatch };
