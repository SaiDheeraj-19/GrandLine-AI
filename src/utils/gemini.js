// Accelerated ARIA Neural Link utilizing Groq inference engine.
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;

export async function chatWithAriaFrontend(message, history = []) {
  const formattedHistory = history.map(msg => ({
    role: msg.role === 'model' ? 'assistant' : 'user',
    content: msg.parts[0].text
  }));

  // Context injection for state analysis capability if asked
  const sysMsg = {
    role: "system",
    content: "You are ARIA, an AI assistant for the GrandLine Disaster Response framework. You provide clear, concise, actionable intelligence for disaster management. Answer in precise military-style brevity. If asked to analyse a state, ask them to provide ongoing disaster metrics so you can assess it."
  };

  const messages = [sysMsg, ...formattedHistory, { role: "user", content: message }];

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messages: messages,
      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
      max_tokens: 1024,
    })
  });

  if (response.ok) {
    const data = await response.json();
    return data.choices[0].message.content;
  } else {
    const errData = await response.json();
    throw new Error(errData.error?.message || "Llama Engine Offline");
  }
}

export async function extractIntelFrontend(content, contentType) {
  const prompt = `
    You are an expert NGO data analyst specialising in disaster response across ALL of India.
    Extract the following structured data from the input.
    Return ONLY a valid JSON object. Do not wrap it in markdown blockquotes. Start exactly with { and end with }.

    Required JSON structure:
    {
      "original_language": "<detected language>",
      "location": {
        "lat": <decimal latitude if computable or 20.59>,
        "lng": <decimal longitude if computable or 78.96>,
        "area_name": "<neighbourhood name>",
        "state": "<Indian state>",
        "district": "<district>"
      },
      "issue_type": "flood|drought|cyclone|earthquake|medical|food|shelter|displacement|heatwave|fire|chemical|other",
      "severity": <1-5 numeric>,
      "affected_count": <numeric>,
      "urgency_score": <1-100 numeric>,
      "summary": "<one sentence overview max 12 words>",
      "recommended_action": "<action for responders>",
      "skills_needed": ["medical", "rescue", "food"]
    }
  `;

  let messages = [];
  if (contentType === "image") {
    messages = [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: content } }
        ]
      }
    ];
  } else {
    messages = [
      {
        role: "user",
        content: prompt + "\n\nInput Source: " + content
      }
    ];
  }

  const model = contentType === "image" ? "llama-3.2-11b-vision-preview" : "llama-3.3-70b-versatile";

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messages: messages,
      model: model,
      temperature: 0.1,
    })
  });

  if (response.ok) {
    const data = await response.json();
    const rawText = data.choices[0].message.content;
    const cleanJson = rawText.replace(/```json|```/g, "").trim();
    // Sometimes LLaVa hallucinates leading text, so extract strictly first { to last }.
    const firstBrace = cleanJson.indexOf('{');
    const lastBrace = cleanJson.lastIndexOf('}');
    if(firstBrace !== -1 && lastBrace !== -1) {
       return JSON.parse(cleanJson.substring(firstBrace, lastBrace + 1));
    }
    return JSON.parse(cleanJson);
  } else {
    const errData = await response.json();
    throw new Error(errData.error?.message || "Llama Vision Offline");
  }
}
