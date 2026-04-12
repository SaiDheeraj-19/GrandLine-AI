/**
 * AI #7 — ARIA: Automated Resource Intelligence Assistant
 * All-India Edition — Live Firestore context + multi-turn Gemini chat
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore }       = require("firebase-admin/firestore");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const ARIA_SYSTEM_PROMPT = `
You are ARIA — Automated Resource Intelligence Assistant — the AI coordinator
for India's national NGO Command Center built by GrandLine AI.

You have access to LIVE field data across all 28 states and 8 UTs of India.
Your role: help NGO coordinators make fast, accurate, life-saving decisions.

PERSONALITY: Direct. Confident. Data-driven. Use numbers always.
FORMAT: Short answers. Bullet points for lists. Recommend specific actions.
LANGUAGE: English only in your responses. You understand all 22 Indian languages in queries.

CORE CAPABILITIES:
- Identify highest-urgency issues by state, district, or issue type
- Check volunteer availability and routing status
- Recommend which volunteer to deploy for which crisis
- Identify coverage gaps (escalated issues with no nearby volunteer)
- Provide state-wise crisis summaries

ALWAYS recommend the next immediate action.
If data is insufficient, say so and suggest what information is needed.
`;

exports.chatWithAria = onCall({ secrets: ["GEMINI_API_KEY"] }, async (req) => {
  const { message, history } = req.data;

  if (!message?.trim()) {
    throw new HttpsError("invalid-argument", "message must be a non-empty string.");
  }

  const db = getFirestore();

  // Fetch top-100 issues by urgency score as live context
  const [issuesSnap, volsSnap, routingSnap] = await Promise.all([
    db.collection("issues").orderBy("urgency_score", "desc").limit(100).get(),
    db.collection("volunteers").get(),
    db.collection("routing_log").orderBy("routed_at", "desc").limit(20).get(),
  ]);

  const issues = issuesSnap.docs.map((doc) => {
    const d = doc.data();
    return {
      id:             doc.id,
      state:          d.location?.state,
      district:       d.location?.district,
      area:           d.location?.area_name,
      type:           d.issue_type,
      severity:       d.severity,
      affected:       d.affected_count,
      score:          d.urgency_score,
      summary:        d.summary,
      routing_status: d.routing_status,
      routed_to:      d.routed_to_volunteer_id,
      escalated:      d.escalated,
      reported_mins:  d.reported_at
        ? Math.round((Date.now() - d.reported_at.toMillis()) / 60000)
        : null,
    };
  });

  const volunteers = volsSnap.docs.map((doc) => {
    const v = doc.data();
    return {
      id:         doc.id,
      name:       v.name,
      state:      v.location?.state,
      district:   v.location?.district,
      skills:     v.skills,
      capacity:   v.capacity,
      radius_km:  v.reach_radius_km,
      status:     v.status,
      deployed:   v.current_assignment ? true : false,
    };
  });

  const coverage_gaps = issues.filter((i) => i.escalated).length;
  const critical_count = issues.filter((i) => i.score >= 80).length;
  const available_vols = volunteers.filter((v) => v.status === "available").length;

  const contextBlock = `
LIVE DATA SNAPSHOT — ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST

SUMMARY: ${issues.length} active issues | ${critical_count} critical | ${available_vols}/${volunteers.length} volunteers available | ${coverage_gaps} unmet escalations

ISSUES (top 60 by urgency):
${JSON.stringify(issues.slice(0, 60), null, 2)}

VOLUNTEERS (all ${volunteers.length}):
${JSON.stringify(volunteers, null, 2)}
`;

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-pro",
    systemInstruction: ARIA_SYSTEM_PROMPT + "\n\n" + contextBlock,
  });

  const safeHistory = Array.isArray(history) ? history : [];
  const chat = model.startChat({ history: safeHistory });
  const result = await chat.sendMessage(message.trim());

  return {
    response: result.response.text().trim(),
    context_snapshot: {
      total_issues:        issues.length,
      critical_count,
      available_volunteers: available_vols,
      coverage_gaps,
    },
    timestamp: new Date().toISOString(),
  };
});
