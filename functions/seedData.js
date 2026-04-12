/**
 * Seed Data Loader — callable function to populate Firestore with demo data.
 * Run once from the browser or via Firebase shell for hackathon demos.
 * Idempotent: clears and re-creates seed collections each call.
 */

const { onCall } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

const SEED_VOLUNTEERS = [
  {
    name: "Ravi Kumar",
    phone: "+91-9876543210",
    location: { lat: 17.7231, lng: 83.3012, area_name: "Gajuwaka North" },
    skills: ["medical", "general"],
    status: "available",
    deployments_count: 12,
    joined_at: Timestamp.fromDate(new Date("2023-08-15")),
  },
  {
    name: "Priya Sharma",
    phone: "+91-9876543211",
    location: { lat: 17.6943, lng: 83.2187, area_name: "MVP Colony" },
    skills: ["food", "logistics"],
    status: "available",
    deployments_count: 8,
    joined_at: Timestamp.fromDate(new Date("2023-10-01")),
  },
  {
    name: "Anil Reddy",
    phone: "+91-9876543212",
    location: { lat: 17.6712, lng: 83.2341, area_name: "Dwaraka Nagar" },
    skills: ["rescue", "general"],
    status: "available",
    deployments_count: 21,
    joined_at: Timestamp.fromDate(new Date("2023-03-22")),
  },
  {
    name: "Sunita Rao",
    phone: "+91-9876543213",
    location: { lat: 17.7456, lng: 83.2876, area_name: "Kommadi" },
    skills: ["medical"],
    status: "available",
    deployments_count: 6,
    joined_at: Timestamp.fromDate(new Date("2024-01-10")),
  },
  {
    name: "Kiran Babu",
    phone: "+91-9876543214",
    location: { lat: 17.6589, lng: 83.1923, area_name: "Pendurthi" },
    skills: ["logistics", "food"],
    status: "deployed",
    deployments_count: 15,
    joined_at: Timestamp.fromDate(new Date("2023-06-05")),
  },
  {
    name: "Lakshmi Devi",
    phone: "+91-9876543215",
    location: { lat: 17.7012, lng: 83.2654, area_name: "Rushikonda" },
    skills: ["medical", "food", "general"],
    status: "available",
    deployments_count: 18,
    joined_at: Timestamp.fromDate(new Date("2023-05-20")),
  },
  {
    name: "Venkata Rao",
    phone: "+91-9876543216",
    location: { lat: 17.6823, lng: 83.2098, area_name: "Seethammadhara" },
    skills: ["rescue", "logistics"],
    status: "available",
    deployments_count: 9,
    joined_at: Timestamp.fromDate(new Date("2023-12-01")),
  },
];

const SEED_ISSUES = [
  {
    location: { lat: 17.6868, lng: 83.2185, area_name: "Vizag Port Area" },
    issue_type: "flood",
    severity: 5,
    affected_count: 450,
    urgency_score: 94,
    score_breakdown: {
      severity_contribution: 35,
      affected_contribution: 27,
      time_contribution: 18,
      resource_contribution: 14,
    },
    summary: "Severe flooding near port — 450 families displaced and stranded.",
    recommended_action: "Deploy medical + rescue + logistics volunteers immediately.",
    tags: ["flood", "displacement", "urgent", "medical"],
    source: "image",
    raw_input: "[satellite image of flooded port area]",
    is_merged: false,
    merged_count: 1,
    status: "open",
    assigned_volunteers: [],
    reported_at: Timestamp.fromDate(new Date(Date.now() - 2 * 60 * 60 * 1000)),
    updated_at: Timestamp.fromDate(new Date(Date.now() - 2 * 60 * 60 * 1000)),
  },
  {
    location: { lat: 17.7123, lng: 83.3156, area_name: "Gajuwaka" },
    issue_type: "medical",
    severity: 4,
    affected_count: 120,
    urgency_score: 78,
    score_breakdown: {
      severity_contribution: 28,
      affected_contribution: 22,
      time_contribution: 15,
      resource_contribution: 13,
    },
    summary: "Waterborne illness outbreak — 120 cases, medical supplies critically low.",
    recommended_action: "Send medical team with ORS, antibiotics, and water purification tablets.",
    tags: ["medical", "waterborne", "outbreak"],
    source: "voice",
    raw_input: "Field officer voice report: illness spreading in Gajuwaka colony",
    is_merged: false,
    merged_count: 1,
    status: "open",
    assigned_volunteers: [],
    reported_at: Timestamp.fromDate(new Date(Date.now() - 5 * 60 * 60 * 1000)),
    updated_at: Timestamp.fromDate(new Date(Date.now() - 5 * 60 * 60 * 1000)),
  },
  {
    location: { lat: 17.6534, lng: 83.1987, area_name: "Pendurthi" },
    issue_type: "food",
    severity: 3,
    affected_count: 80,
    urgency_score: 55,
    score_breakdown: {
      severity_contribution: 21,
      affected_contribution: 16,
      time_contribution: 8,
      resource_contribution: 10,
    },
    summary: "Food shortage for 80 isolated families — road access blocked by flood debris.",
    recommended_action: "Deploy food logistics team via alternate route through NH-16.",
    tags: ["food", "isolation", "post-flood"],
    source: "text",
    raw_input: "Written report from Pendurthi panchayat: road blocked, food needed",
    is_merged: false,
    merged_count: 1,
    status: "assigned",
    assigned_volunteers: [],
    reported_at: Timestamp.fromDate(new Date(Date.now() - 12 * 60 * 60 * 1000)),
    updated_at: Timestamp.fromDate(new Date(Date.now() - 10 * 60 * 60 * 1000)),
  },
  {
    location: { lat: 17.7345, lng: 83.2876, area_name: "Bheemunipatnam" },
    issue_type: "shelter",
    severity: 4,
    affected_count: 200,
    urgency_score: 82,
    score_breakdown: {
      severity_contribution: 28,
      affected_contribution: 24,
      time_contribution: 16,
      resource_contribution: 14,
    },
    summary: "200 fishermen families lost homes to storm surge — need emergency shelter.",
    recommended_action: "Coordinate with district administration for relief camp setup.",
    tags: ["shelter", "storm", "coastal", "urgent"],
    source: "text",
    raw_input: "Report from coastal survey team",
    is_merged: false,
    merged_count: 1,
    status: "open",
    assigned_volunteers: [],
    reported_at: Timestamp.fromDate(new Date(Date.now() - 8 * 60 * 60 * 1000)),
    updated_at: Timestamp.fromDate(new Date(Date.now() - 8 * 60 * 60 * 1000)),
  },
  {
    location: { lat: 17.6601, lng: 83.2210, area_name: "Kommadi" },
    issue_type: "drought",
    severity: 2,
    affected_count: 350,
    urgency_score: 42,
    score_breakdown: {
      severity_contribution: 14,
      affected_contribution: 21,
      time_contribution: 0,
      resource_contribution: 7,
    },
    summary: "Seasonal water shortage — 350 households in need of tanker supply.",
    recommended_action: "Schedule water tanker rotation for next 2 weeks.",
    tags: ["drought", "water", "seasonal"],
    source: "text",
    raw_input: "Monthly community survey report",
    is_merged: false,
    merged_count: 1,
    status: "open",
    assigned_volunteers: [],
    reported_at: Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000)),
    updated_at: Timestamp.fromDate(new Date(Date.now() - 24 * 60 * 60 * 1000)),
  },
];

exports.seedDatabase = onCall(async () => {
  const db = getFirestore();

  // Clear and re-seed volunteers
  const volSnap = await db.collection("volunteers").get();
  const volBatch = db.batch();
  volSnap.docs.forEach((doc) => volBatch.delete(doc.ref));
  await volBatch.commit();

  const volAddBatch = db.batch();
  SEED_VOLUNTEERS.forEach((v) => volAddBatch.set(db.collection("volunteers").doc(), v));
  await volAddBatch.commit();

  // Clear and re-seed issues
  const issSnap = await db.collection("issues").get();
  const issBatch = db.batch();
  issSnap.docs.forEach((doc) => issBatch.delete(doc.ref));
  await issBatch.commit();

  const issAddBatch = db.batch();
  SEED_ISSUES.forEach((i) => issAddBatch.set(db.collection("issues").doc(), i));
  await issAddBatch.commit();

  return {
    message: "Database seeded successfully.",
    volunteers: SEED_VOLUNTEERS.length,
    issues: SEED_ISSUES.length,
  };
});
