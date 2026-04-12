/**
 * AI #5 — Daily AI Briefing Generator
 * Scheduled every day at 7:00 AM IST (01:30 UTC) using Firebase Scheduler.
 * Also exposed as a callable for on-demand generation during the demo.
 */

const { onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { getFirestore, Timestamp, FieldValue } = require("firebase-admin/firestore");
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function generateBriefingContent(db) {
  const since = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);

  const snapshot = await db
    .collection("issues")
    .where("reported_at", ">=", since)
    .orderBy("reported_at", "desc")
    .limit(50)
    .get();

  const issues = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const criticalCount = issues.filter((i) => i.urgency_score >= 80).length;
  const availVolSnap  = await db.collection("volunteers").where("status", "==", "available").get();
  const availVols     = availVolSnap.size;

  if (issues.length === 0) {
    return {
      content: "No issues reported in the last 24 hours. All systems are stable.",
      issues_count: 0,
      critical_count: 0,
    };
  }

  const issuesSummary = issues
    .slice(0, 10)
    .map((i) => `- [${i.urgency_score}/100] ${i.location.area_name}: ${i.summary}`)
    .join("\n");

  const prompt = `
You are a national NGO operations director reviewing the overnight field situation
across ALL of India (28 states, 8 UTs). Write a crisp 3-paragraph morning briefing.

Live data as of ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST:
Total issues (last 24h): ${issues.length}
Critical issues (score≥80): ${criticalCount}
Available volunteers: ${availVols}
States affected: ${[...new Set(issues.map(i => i.location?.state).filter(Boolean))].join(', ')}

Top issues:
${issuesSummary}

Write the briefing:
Para 1: Top 3 most critical situations by urgency score requiring immediate deployment.
Para 2: Resource status — available volunteers, coverage gaps, escalated states.
Para 3: Recommended priorities for today (numbered list, max 3 items, state-specific).

Be direct. Use real state and area names. No filler. Each paragraph ≤ 80 words.
`;

  const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genai.getGenerativeModel({ model: "gemini-1.5-pro" });
  const result = await model.generateContent(prompt);
  const briefingText = result.response.text().trim();

  return {
    content: briefingText,
    issues_count: issues.length,
    critical_count: criticalCount,
  };
}

// Scheduled function — runs daily at 7 AM IST
exports.scheduledBriefing = onSchedule(
  { schedule: "30 1 * * *", timeZone: "Asia/Kolkata", secrets: ["GEMINI_API_KEY"] },
  async () => {
    const db = getFirestore();
    const { content, issues_count, critical_count } = await generateBriefingContent(db);
    await db.collection("briefings").add({
      date: new Date().toISOString().split("T")[0],
      content,
      issues_count,
      critical_count,
      generated_at: FieldValue.serverTimestamp(),
    });
    console.log(`Briefing generated: ${issues_count} issues, ${critical_count} critical.`);
  }
);

// Callable for on-demand generation during demo
exports.generateBriefing = onCall({ secrets: ["GEMINI_API_KEY"] }, async () => {
  const db = getFirestore();
  const { content, issues_count, critical_count } = await generateBriefingContent(db);

  const docRef = await db.collection("briefings").add({
    date: new Date().toISOString().split("T")[0],
    content,
    issues_count,
    critical_count,
    generated_at: FieldValue.serverTimestamp(),
  });

  return { id: docRef.id, content, issues_count, critical_count };
});
