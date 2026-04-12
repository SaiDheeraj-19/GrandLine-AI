/**
 * AI #1 — Gemini 1.5 Pro Multi-Language Extraction Engine — All India Edition
 * Handles all 22 scheduled Indian languages + English
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const EXTRACTION_PROMPT = `
You are an expert NGO data analyst specialising in disaster response
across ALL of India — every state, every union territory.

CRITICAL: You MUST handle reports in ANY of India's 22 scheduled languages:
Hindi, Bengali, Telugu, Marathi, Tamil, Urdu, Gujarati, Kannada, Odia,
Malayalam, Punjabi, Assamese, Maithili, Sanskrit, Sindhi, Kashmiri,
Nepali, Konkani, Manipuri, Bodo, Santali, Dogri — plus English.

STEP 1: Detect the language of the input.
STEP 2: Translate the key information to English internally.
STEP 3: Extract the structured data.
STEP 4: Return ONLY a valid JSON object — no markdown, no explanation.

Required JSON structure:
{
  "original_language": "<detected language name in English>",
  "location": {
    "lat": <decimal latitude — if unknown, use geographic centre of mentioned place>,
    "lng": <decimal longitude>,
    "area_name": "<neighbourhood / village / area name in English>",
    "state": "<Indian state name in English>",
    "district": "<district name in English>"
  },
  "issue_type": "<one of: flood|drought|cyclone|earthquake|medical|food|shelter|displacement|heatwave|fire|chemical|other>",
  "severity": <integer 1-5>,
  "affected_count": <estimated number of people directly affected>,
  "urgency_score": <your overall assessment 0-100>,
  "summary": "<one sentence in English, max 20 words, action-oriented>",
  "summary_local": "<same summary in the original language if not English, else same as summary>",
  "recommended_action": "<specific immediate action for first responders>",
  "skills_needed": ["<from: medical|rescue|food|logistics|shelter|counselling|water|general>"],
  "tags": ["<relevant tag>"],
  "confidence": <0.0-1.0>
}

Indian geography rules:
- If place name is in a regional script, transliterate to English
- Kerala/Assam/Bihar/Odisha/West Bengal are flood-prone
- Rajasthan/Maharashtra/Karnataka/MP are drought-prone
- Odisha/AP/Tamil Nadu/West Bengal are cyclone-prone
- If only district mentioned, infer state from your knowledge
- Unknown location: set lat=20.5937, lng=78.9629 (India centre)

RETURN ONLY THE JSON. Any other text will crash the system.
`;

async function extractFromAny(content, contentType) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

  try {
    let parts = [EXTRACTION_PROMPT];

    if (contentType === "text" || contentType === "transcript") {
      parts.push(String(content));
    } else if (contentType === "image") {
      parts.push({ inlineData: { data: content.base64, mimeType: content.mimeType } });
    }

    const result = await model.generateContent(parts);
    const raw = result.response.text().trim().replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(raw);

    return sanitize(parsed);
  } catch (err) {
    console.error("Gemini extraction failed:", err.message, "— retrying with strict prompt");
    return retryExtraction(content, contentType);
  }
}

async function retryExtraction(content, contentType) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
  const strictPrompt = EXTRACTION_PROMPT + "\n\nPREVIOUS ATTEMPT FAILED. Return ONLY raw JSON. No other characters.";
  const parts = contentType === "image"
    ? [strictPrompt, { inlineData: { data: content.base64, mimeType: content.mimeType } }]
    : [strictPrompt, String(content)];
  const result = await model.generateContent(parts);
  const raw = result.response.text().replace(/```json|```/g, "").trim();
  return sanitize(JSON.parse(raw));
}

function sanitize(parsed) {
  return {
    original_language:  parsed.original_language || "English",
    location: {
      lat:        typeof parsed.location?.lat === "number" ? parsed.location.lat : 20.5937,
      lng:        typeof parsed.location?.lng === "number" ? parsed.location.lng : 78.9629,
      area_name:  parsed.location?.area_name  || "Unknown Area",
      state:      parsed.location?.state      || "Unknown",
      district:   parsed.location?.district   || "Unknown",
    },
    issue_type:         parsed.issue_type     || "other",
    severity:           Math.min(Math.max(parseInt(parsed.severity)       || 3, 1), 5),
    affected_count:     Math.max(parseInt(parsed.affected_count)           || 0, 0),
    urgency_score:      Math.min(Math.max(parseInt(parsed.urgency_score)   || 50, 0), 100),
    summary:            parsed.summary            || "Issue reported — details pending review.",
    summary_local:      parsed.summary_local      || parsed.summary || "",
    recommended_action: parsed.recommended_action || "Assess situation and respond.",
    skills_needed:      Array.isArray(parsed.skills_needed) ? parsed.skills_needed : ["general"],
    tags:               Array.isArray(parsed.tags) ? parsed.tags : [],
    confidence:         parseFloat(parsed.confidence) || 0.7,
  };
}

// This file exports the raw function — index.js wraps it in onCall
module.exports = { extractFromAny };
