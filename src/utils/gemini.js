/**
 * DETERMINISTIC AI SIMULATION ENGINE (ARIA)
 * Ensures 100% Reliability for Demo Environments
 */

/**
 * Simulates ARIA Intelligence Extraction
 * Replaces real Gemini API calls with deterministic parsing
 */
export const extractIntelFrontend = async (text) => {
  // Always work instantly with deterministic results
  const lower = text.toLowerCase();
  
  let type = 'general';
  if (lower.includes('medical') || lower.includes('doctor') || lower.includes('blood')) type = 'medical';
  else if (lower.includes('flood') || lower.includes('water') || lower.includes('drown')) type = 'flood';
  else if (lower.includes('fire') || lower.includes('smoke') || lower.includes('burn')) type = 'fire';
  else if (lower.includes('food') || lower.includes('hunger') || lower.includes('rations')) type = 'food';

  return {
    issue_type: type,
    summary: `[ARIA TRANSLATED]: ${text}`,
    original_summary: text,
    urgency_score: Math.floor(Math.random() * 40) + 60, // Always high for demo impact
    status: 'pending',
    translation_detected: true
  };
};

/**
 * Simulates Neural Damage Assessment (Vision)
 * 100% Success Rate with Deterministic 2s Delay
 */
export const analyzeMissionProof = async (imageFile) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        verified: true,
        confidence: 0.98,
        analysis: "Tactical verification completed. Site status: SECURED."
      });
    }, 2000);
  });
};

/**
 * DETERMINISTIC CHAT SIMULATION
 * Provides high-fidelity mission analysis without external drift
 */
export const chatWithAriaFrontend = async (query, history = []) => {
  const q = query.toLowerCase();
  
  if (q.includes('analysis') || q.includes('metric')) {
    return "NATIONAL TACTICAL ANALYSIS: Data integrity at **98.4%**. Priority clusters detected in **Andhra Pradesh** and **Maharashtra**. Resource utilization optimized at **84%**. Recommended action: Reallocate aerial assets to Sector 7.";
  }
  
  if (q.includes('need') || q.includes('unmet')) {
    return "UNMET NEED REPORT: **Andhra Pradesh** currently has a **14%** gap in medical logistics. Secondary alerts in **West Bengal** due to potential monsoon influx. 4 regional hubs are standby for cross-border support.";
  }

  if (q.includes('critical') || q.includes('high')) {
    return "CRITICAL PROTOCOL: Filtering all signals for **Score > 80**. 4 tactical threats found. All sectors have been assigned a specialized lead. Neural link active — monitoring pulse rates of responders now.";
  }

  if (q.includes('volunteer') || q.includes('closest')) {
    return "ASSET POSITIONING: 12 specialists are within **50km** of prime threat zones. Specialist **Kalyan** is currently the optimal responder for the Chittoor signal. ETA: 12 mins.";
  }

  if (q.includes('gap')) {
    return "COVERAGE AUDIT: Minor gap in **Jharkhand** sector 4. 2 volunteers en route. No immediate threat escalation predicted for the next 4 hours cycle.";
  }

  return "ARIA RESPONSE: Operational query received. Strategic data confirms all protocols are active. Suggest focusing on **Deployment Metrics** in the eastern corridor. Need more details on a specific sector?";
};
