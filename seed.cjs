/**
 * GRANDLINE AI — STANDALONE DATA SEEDER
 * Uses the Firebase Admin SDK to populate Firestore with All-India demo data.
 * 
 * Usage:
 * 1. Place your serviceAccountKey.json in this directory.
 * 2. Run: node seed.js
 */

const admin = require("firebase-admin");
const path = require("path");

// USER PROVIDED INITIALIZATION
try {
  const serviceAccount = require("./serviceAccountKey.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (err) {
  console.error("ERROR: serviceAccountKey.json not found in root directory.");
  console.log("Please download your service account key from Firebase Console -> Project Settings -> Service Accounts.");
  process.exit(1);
}

const db = admin.firestore();
const { FieldValue } = admin.firestore;

// HA VERSINE UTILS (Duplicated here for standalone script)
function toRad(deg) { return deg * (Math.PI / 180); }
function getDistance(p1, p2) {
  const R = 6371;
  const dLat = toRad(p2.lat - p1.lat);
  const dLng = toRad(p2.lng - p1.lng);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
function computeBoundingBox(center, radiusKm) {
  const DEGREES_PER_KM = 1 / 111;
  const delta = radiusKm * DEGREES_PER_KM;
  return {
    lat_min: center.lat - delta,
    lat_max: center.lat + delta,
    lng_min: center.lng - delta,
    lng_max: center.lng + delta,
  };
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
];

const SEED_ISSUES = [
  { location: { lat: 10.9170, lng: 76.0520, area_name: "Wayanad, Kerala",       state: "Kerala",         district: "Wayanad"      }, issue_type: "flood",         severity: 5, affected_count: 1200, summary: "Severe landslide and flooding — 1200 displaced in Wayanad." },
  { location: { lat: 25.7771, lng: 85.7746, area_name: "Muzaffarpur, Bihar",    state: "Bihar",          district: "Muzaffarpur"  }, issue_type: "food",          severity: 4, affected_count: 800,  summary: "Food shortage affecting 800 families after flood damage." },
  { location: { lat: 20.4625, lng: 85.8830, area_name: "Puri, Odisha",          state: "Odisha",         district: "Puri"         }, issue_type: "cyclone",       severity: 5, affected_count: 2500, summary: "Cyclone landfall imminent — 2500 coastal families at risk." },
];

async function seed() {
  console.log("Starting seed process...");
  
  // Clean up
  const collections = ["volunteers", "volunteer_zones", "issues", "routing_log"];
  for (const c of collections) {
    const snap = await db.collection(c).get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    console.log(`Cleaned collection: ${c}`);
  }

  // Seed Volunteers and Zones
  for (const vol of SEED_VOLUNTEERS) {
    const volRef = await db.collection("volunteers").add({
      ...vol,
      status: "available",
      total_deployments: 0,
      people_helped: 0,
      joined_at: FieldValue.serverTimestamp(),
      last_active: FieldValue.serverTimestamp(),
    });
    
    const bbox = computeBoundingBox({ lat: vol.location.lat, lng: vol.location.lng }, vol.reach_radius_km);
    await db.collection("volunteer_zones").doc(volRef.id).set({
      center: { lat: vol.location.lat, lng: vol.location.lng },
      radius_km: vol.reach_radius_km,
      state: vol.location.state,
      skills: vol.skills,
      available_capacity: vol.capacity,
      status: "active",
      volunteer_name: vol.name,
      ...bbox,
    });
    console.log(`Seeded volunteer: ${vol.name}`);
  }

  // Seed Issues (without calling routing function for simplicity in script)
  for (const iss of SEED_ISSUES) {
    await db.collection("issues").add({
      ...iss,
      urgency_score: 50, // default placeholder
      routing_status: "pending",
      reported_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });
    console.log(`Seeded issue: ${iss.location.area_name}`);
  }

  console.log("Seed complete.");
  process.exit(0);
}

seed();
