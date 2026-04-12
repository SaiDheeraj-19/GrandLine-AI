/**
 * AI #3 — Volunteer Matcher
 * Finds the top 3 available volunteers by skill match + Haversine distance.
 * No external libraries — pure math as required.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

// Haversine formula — returns distance in kilometres
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

exports.matchVolunteers = onCall(async (request) => {
  const { issueId } = request.data;
  if (!issueId) {
    throw new HttpsError("invalid-argument", "issueId is required.");
  }

  const db  = getFirestore();
  const issueDoc = await db.collection("issues").doc(issueId).get();

  if (!issueDoc.exists) {
    throw new HttpsError("not-found", `Issue ${issueId} not found.`);
  }

  const issue = issueDoc.data();
  const { lat: iLat, lng: iLng } = issue.location;

  // Fetch all available volunteers
  const volunteerSnap = await db
    .collection("volunteers")
    .where("status", "==", "available")
    .get();

  if (volunteerSnap.empty) {
    return { matches: [], message: "No available volunteers found." };
  }

  const skillSet = new Set([issue.issue_type]);
  skillSet.add("general"); // general volunteers are always eligible

  const candidates = [];
  volunteerSnap.forEach((doc) => {
    const v = { id: doc.id, ...doc.data() };
    // Skill filter: volunteer must have at least one matching skill
    const hasSkill = v.skills.some((s) => skillSet.has(s));
    if (!hasSkill) return;

    const distKm    = haversineKm(iLat, iLng, v.location.lat, v.location.lng);
    const etaMin    = Math.round(distKm * 3); // 3 min/km estimate
    // match_score drops linearly — 0 km = 100, 50 km = 0
    const matchScore = Math.max(0, Math.round((1 - distKm / 50) * 100));

    candidates.push({
      id:           v.id,
      name:         v.name,
      phone:        v.phone,
      skills:       v.skills,
      area_name:    v.location.area_name,
      status:       v.status,
      distance_km:  parseFloat(distKm.toFixed(2)),
      eta_minutes:  etaMin,
      match_score:  matchScore,
    });
  });

  // Sort ascending by distance, return top 3
  const top3 = candidates.sort((a, b) => a.distance_km - b.distance_km).slice(0, 3);

  // Update issue with assigned volunteer IDs and mark as assigned
  if (top3.length > 0) {
    await db.collection("issues").doc(issueId).update({
      status: "assigned",
      assigned_volunteers: top3.map((v) => v.id),
      updated_at: FieldValue.serverTimestamp(),
    });

    // Bump each volunteer's deployment count
    const batch = db.batch();
    top3.forEach((v) => {
      batch.update(db.collection("volunteers").doc(v.id), {
        deployments_count: (v.deployments_count || 0) + 1,
        updated_at: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }

  return { matches: top3, issueId, issue_type: issue.issue_type };
});
