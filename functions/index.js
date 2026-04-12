/**
 * All Firebase Cloud Functions entry point — All India Edition.
 * Registers: ingestText, ingestImage, ingestVoice, registerVolunteer,
 *            seedVolunteers, chatWithAria, generateBriefing, scheduledBriefing
 */

const admin = require("firebase-admin");
const path = require("path");

// Support local service account key if present, else use default credentials for production
try {
  const serviceAccount = require("./serviceAccountKey.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (e) {
  admin.initializeApp();
}

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule }         = require("firebase-functions/v2/scheduler");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const { extractFromAny }           = require("./geminiExtractor");
const { computeUrgency }           = require("./urgencyScorer");
const { routeDisasterToVolunteer } = require("./disasterRouter");
const { generateBriefing, scheduledBriefing } = require("./aiBriefing");
const { chatWithAria }             = require("./aiChat");
const { computeBoundingBox }       = require("./utils/haversine");
const { getDistance }              = require("./utils/haversine");

// ── SHARED: duplicate detection + save + route ──────────────────────────────
async function saveAndRoute(issueData) {
  const db = getFirestore();
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

  // Duplicate detection: same state + issue_type + within last 6h
  const dupeSnap = await db.collection("issues")
    .where("location.state", "==", issueData.location.state)
    .where("issue_type",      "==", issueData.issue_type)
    .where("reported_at",     ">=", sixHoursAgo)
    .get();

  for (const doc of dupeSnap.docs) {
    const existing = doc.data();
    const dist = getDistance(
      { lat: issueData.location.lat, lng: issueData.location.lng },
      { lat: existing.location?.lat,  lng: existing.location?.lng }
    );
    if (dist < 5) { // within 5 km = same event
      await doc.ref.update({
        affected_count: FieldValue.increment(issueData.affected_count || 0),
        urgency_score:  Math.min((existing.urgency_score || 0) + 10, 100),
        merged_count:   FieldValue.increment(1),
        is_merged:      true,
        updated_at:     FieldValue.serverTimestamp(),
      });
      const merged = await doc.ref.get();
      return { ...merged.data(), id: doc.id, was_merged: true };
    }
  }

  // Fresh issue — save with full routing fields
  const issueRef = await db.collection("issues").add({
    ...issueData,
    routing_status:          "pending",
    routed_to_volunteer_id:  null,
    routed_to_cluster_ids:   [],
    routing_distance_km:     null,
    escalated:               false,
    escalated_to_state:      null,
    is_merged:               false,
    merged_count:            0,
    merged_from_ids:         [],
    assigned_volunteer_ids:  [],
    reported_at:  FieldValue.serverTimestamp(),
    updated_at:   FieldValue.serverTimestamp(),
  });

  const savedIssue = { id: issueRef.id, ...issueData };

  // Fire routing asynchronously — do not await in the response path
  const routing = await routeDisasterToVolunteer(savedIssue);

  return { ...savedIssue, routing, was_merged: false };
}

// ── INGEST: text report ─────────────────────────────────────────────────────
exports.extractReport = onCall({ secrets: ["GEMINI_API_KEY"] }, async (req) => {
  if (!req.auth) {
    throw new HttpsError("unauthenticated", "Authentication required to ingest signals.");
  }
  const { text, imageBase64, imageMimeType, source, userLat, userLng } = req.data;

  let extracted;
  if (imageBase64) {
    extracted = await extractFromAny({ base64: imageBase64, mimeType: imageMimeType }, "image");
  } else {
    extracted = await extractFromAny(text, source === "voice" ? "transcript" : "text");
  }

  // Apply user GPS as level-2 fallback if Gemini couldn't resolve location
  if (
    extracted.location.lat === 20.5937 &&
    extracted.location.lng === 78.9629 &&
    userLat && userLng
  ) {
    extracted.location.lat = userLat;
    extracted.location.lng = userLng;
    extracted.location.area_name = extracted.location.area_name || "Your Location";
    extracted.location.location_source = "user_location";
  }

  const scored = computeUrgency({ ...extracted, reported_at: { toMillis: () => Date.now() } });
  const result = await saveAndRoute({
    ...extracted,
    ...scored,
    source: source || "text",
    raw_input: text || "image/voice upload",
  });

  return result;
});

// ── INGEST: voice transcript ────────────────────────────────────────────────
exports.ingestVoice = onCall({ secrets: ["GEMINI_API_KEY"] }, async (req) => {
  if (!req.auth) {
    throw new HttpsError("unauthenticated", "Authentication required for voice ingestion.");
  }
  const { transcript, userLat, userLng } = req.data;
  if (!transcript?.trim()) throw new HttpsError("invalid-argument", "transcript required");

  const extracted = await extractFromAny(transcript, "transcript");
  const scored    = computeUrgency({ ...extracted, reported_at: { toMillis: () => Date.now() } });
  return saveAndRoute({ ...extracted, ...scored, source: "voice", raw_input: transcript });
});

// ── VOLUNTEER REGISTRATION ──────────────────────────────────────────────────
exports.registerVolunteer = onCall(async (req) => {
  if (!req.auth) {
    throw new HttpsError("unauthenticated", "Authentication required to register as a volunteer.");
  }
  const data = req.data;
  const db = getFirestore();

  if (!data.name || !data.location?.lat || !data.location?.lng) {
    throw new HttpsError("invalid-argument", "name, location.lat, and location.lng are required");
  }

  const bbox = computeBoundingBox(
    { lat: data.location.lat, lng: data.location.lng },
    data.reach_radius_km || 50
  );

  const volRef = await db.collection("volunteers").add({
    name:              data.name,
    phone:             data.phone || null,
    ngo_name:          data.ngo_name || null,
    location:          data.location,
    reach_radius_km:   data.reach_radius_km || 50,
    skills:            data.skills || ["general"],
    languages:         data.languages || ["English"],
    capacity:          data.capacity || 50,
    status:            "available",
    current_assignment: null,
    total_deployments: 0,
    people_helped:     0,
    joined_at:         FieldValue.serverTimestamp(),
    last_active:       FieldValue.serverTimestamp(),
  });

  // Pre-computed volunteer zone for fast routing queries
  await db.collection("volunteer_zones").doc(volRef.id).set({
    center:             { lat: data.location.lat, lng: data.location.lng },
    radius_km:          data.reach_radius_km || 50,
    state:              data.location.state || "Unknown",
    skills:             data.skills || ["general"],
    available_capacity: data.capacity || 50,
    status:             "active",
    volunteer_name:     data.name,
    ...bbox,
  });

  return { volunteer_id: volRef.id, status: "registered" };
});

// ── SEED: populate demo volunteers + issues for demo ────────────────────────
exports.seedDatabase = onCall(async (req) => {
  if (!req.auth) {
    throw new HttpsError("unauthenticated", "Authentication required to seed database.");
  }
  
  // Verify super_admin role
  const db = getFirestore();
  const userDoc = await db.collection("users").doc(req.auth.uid).get();
  if (!userDoc.exists || userDoc.data().role !== "super_admin") {
    throw new HttpsError("permission-denied", "Only Super Admins can seed the database.");
  }


  const SEED_VOLUNTEERS = [
    { name: "Dr. Meera Nair",  phone: "+91-9400000001", ngo_name: "Kerala Medicos", location: { lat: 10.8505, lng: 76.2711, area_name: "Thrissur, Kerala",        state: "Kerala",         district: "Thrissur"  }, skills: ["medical","general"],          reach_radius_km: 60,  capacity: 100, languages: ["Malayalam","English"] },
    { name: "Rajan Thomas",    phone: "+91-9400000002", ngo_name: "Kerala Rescue",  location: { lat: 9.9312,  lng: 76.2673, area_name: "Ernakulam, Kerala",        state: "Kerala",         district: "Ernakulam" }, skills: ["rescue","logistics"],          reach_radius_km: 80,  capacity: 50,  languages: ["Malayalam"] },
    { name: "Santosh Kumar",   phone: "+91-9800000001", ngo_name: "Bihar Food Aid", location: { lat: 25.5941, lng: 85.1376, area_name: "Patna, Bihar",             state: "Bihar",          district: "Patna"     }, skills: ["food","logistics"],            reach_radius_km: 100, capacity: 200, languages: ["Hindi","Maithili"] },
    { name: "Priya Devi",      phone: "+91-9800000002", ngo_name: "Bihar Food Aid", location: { lat: 26.1158, lng: 85.3909, area_name: "Darbhanga, Bihar",         state: "Bihar",          district: "Darbhanga" }, skills: ["food","general"],              reach_radius_km: 50,  capacity: 80,  languages: ["Hindi","Maithili"] },
    { name: "Ramesh Sharma",   phone: "+91-9100000001", ngo_name: "Rajasthan Jal",  location: { lat: 26.9124, lng: 75.7873, area_name: "Jaipur, Rajasthan",        state: "Rajasthan",      district: "Jaipur"    }, skills: ["water","logistics"],           reach_radius_km: 150, capacity: 120, languages: ["Hindi","Rajasthani"] },
    { name: "Sasmita Panda",   phone: "+91-9700000001", ngo_name: "Odisha Cyclone", location: { lat: 20.2961, lng: 85.8245, area_name: "Bhubaneswar, Odisha",      state: "Odisha",         district: "Khordha"   }, skills: ["rescue","shelter"],            reach_radius_km: 100, capacity: 75,  languages: ["Odia","English"] },
    { name: "Dr. Aarav Joshi", phone: "+91-9200000001", ngo_name: "Mumbai NGO",     location: { lat: 19.0760, lng: 72.8777, area_name: "Mumbai, Maharashtra",      state: "Maharashtra",    district: "Mumbai"    }, skills: ["medical","counselling"],       reach_radius_km: 50,  capacity: 150, languages: ["Marathi","Hindi","English"] },
    { name: "Biju Baruah",     phone: "+91-9600000001", ngo_name: "Assam Floods",   location: { lat: 26.1445, lng: 91.7362, area_name: "Guwahati, Assam",          state: "Assam",          district: "Kamrup"    }, skills: ["rescue","logistics"],          reach_radius_km: 80,  capacity: 60,  languages: ["Assamese","Bengali"] },
    { name: "Anitha Reddy",    phone: "+91-9300000001", ngo_name: "AP Relief",      location: { lat: 17.6868, lng: 83.2185, area_name: "Visakhapatnam, AP",        state: "Andhra Pradesh", district: "Visakhapatnam" }, skills: ["shelter","food","general"], reach_radius_km: 70,  capacity: 90,  languages: ["Telugu","English"] },
    { name: "Karan Singh",     phone: "+91-9500000001", ngo_name: "Punjab Aid",     location: { lat: 31.1471, lng: 75.3412, area_name: "Ludhiana, Punjab",         state: "Punjab",         district: "Ludhiana"  }, skills: ["logistics","general"],         reach_radius_km: 80,  capacity: 100, languages: ["Punjabi","Hindi"] },
    { name: "Fatima Shaikh",   phone: "+91-9100000002", ngo_name: "Gujarat Flood",  location: { lat: 23.0225, lng: 72.5714, area_name: "Ahmedabad, Gujarat",       state: "Gujarat",        district: "Ahmedabad" }, skills: ["food","water","general"],      reach_radius_km: 90,  capacity: 110, languages: ["Gujarati","Hindi"] },
    { name: "Ravi Shankar",    phone: "+91-9400000003", ngo_name: "TN Cyclone",     location: { lat: 13.0827, lng: 80.2707, area_name: "Chennai, Tamil Nadu",      state: "Tamil Nadu",     district: "Chennai"   }, skills: ["rescue","medical"],            reach_radius_km: 60,  capacity: 85,  languages: ["Tamil","English"] },
  ];

  const SEED_ISSUES = [
    { location: { lat: 10.9170, lng: 76.0520, area_name: "Wayanad, Kerala",       state: "Kerala",         district: "Wayanad"      }, issue_type: "flood",         severity: 5, affected_count: 1200, summary: "Severe landslide and flooding — 1200 displaced in Wayanad." },
    { location: { lat: 25.7771, lng: 85.7746, area_name: "Muzaffarpur, Bihar",    state: "Bihar",          district: "Muzaffarpur"  }, issue_type: "food",          severity: 4, affected_count: 800,  summary: "Food shortage affecting 800 families after flood damage." },
    { location: { lat: 23.2599, lng: 77.4126, area_name: "Bhopal, MP",            state: "Madhya Pradesh", district: "Bhopal"       }, issue_type: "medical",       severity: 3, affected_count: 200,  summary: "Medical camp needed in flood-affected colony." },
    { location: { lat: 20.4625, lng: 85.8830, area_name: "Puri, Odisha",          state: "Odisha",         district: "Puri"         }, issue_type: "cyclone",       severity: 5, affected_count: 2500, summary: "Cyclone landfall imminent — 2500 coastal families at risk." },
    { location: { lat: 26.8467, lng: 80.9462, area_name: "Lucknow, UP",           state: "Uttar Pradesh",  district: "Lucknow"      }, issue_type: "heatwave",      severity: 3, affected_count: 500,  summary: "Heatwave affecting 500+ elderly residents, water shortage." },
    { location: { lat: 18.5204, lng: 73.8567, area_name: "Pune, Maharashtra",     state: "Maharashtra",    district: "Pune"         }, issue_type: "displacement",  severity: 3, affected_count: 350,  summary: "300+ families displaced due to demolition drive, need shelter." },
    { location: { lat: 17.3850, lng: 78.4867, area_name: "Hyderabad, Telangana",  state: "Telangana",      district: "Hyderabad"    }, issue_type: "flood",         severity: 4, affected_count: 650,  summary: "Flash floods in low-lying areas, roads blocked, rescue needed." },
    { location: { lat: 22.5726, lng: 88.3639, area_name: "Kolkata, West Bengal",  state: "West Bengal",    district: "Kolkata"      }, issue_type: "food",          severity: 2, affected_count: 300,  summary: "Post-cyclone food scarcity in peripheral districts." },
  ];

  const batch = db.batch();
  const volIds = [];

  for (const vol of SEED_VOLUNTEERS) {
    const bbox = computeBoundingBox({ lat: vol.location.lat, lng: vol.location.lng }, vol.reach_radius_km);
    const volRef = db.collection("volunteers").doc();
    volIds.push(volRef.id);
    batch.set(volRef, {
      ...vol, status: "available", current_assignment: null,
      total_deployments: Math.floor(Math.random() * 20),
      people_helped: Math.floor(Math.random() * 500),
      joined_at: FieldValue.serverTimestamp(),
      last_active: FieldValue.serverTimestamp(),
    });
    const zoneRef = db.collection("volunteer_zones").doc(volRef.id);
    batch.set(zoneRef, {
      center: { lat: vol.location.lat, lng: vol.location.lng },
      radius_km: vol.reach_radius_km,
      state: vol.location.state,
      skills: vol.skills,
      available_capacity: vol.capacity,
      status: "active",
      volunteer_name: vol.name,
      ...bbox,
    });
  }

  await batch.commit();

  // Save issues with routing
  const issuedIds = [];
  for (const iss of SEED_ISSUES) {
    const scored = computeUrgency({ ...iss, reported_at: { toMillis: () => Date.now() } });
    const result = await saveAndRoute({ ...iss, ...scored, source: "text", raw_input: iss.summary });
    issuedIds.push(result.id);
  }

  return { seeded_volunteers: volIds.length, seeded_issues: issuedIds.length };
});

// ── AI CHAT (ARIA) ──────────────────────────────────────────────────────────
exports.chatWithAria = chatWithAria;

// ── DAILY BRIEFING ──────────────────────────────────────────────────────────
exports.generateBriefing = generateBriefing;
exports.scheduledBriefing = onSchedule(
  { schedule: "0 7 * * *", timeZone: "Asia/Kolkata", secrets: ["GEMINI_API_KEY"] },
  async () => { await generateBriefing(); }
);
