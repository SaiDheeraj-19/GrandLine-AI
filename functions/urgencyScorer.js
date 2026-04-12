/**
 * AI #2 — Urgency Scoring Engine — All India Edition
 * Calibrated for Indian population density:
 * 500 affected = moderate, 5000 = severe
 */

function computeUrgency(issue) {
  const severityScore = (issue.severity / 5) * 35;
  const affectedScore = Math.min((issue.affected_count || 0) / 5000, 1) * 30;
  const resourceScore = computeResourceGap(issue.issue_type) * 15;

  let reportedMillis = 0;
  if (issue.reported_at) {
    if (typeof issue.reported_at.toMillis === 'function') {
      reportedMillis = issue.reported_at.toMillis();
    } else if (typeof issue.reported_at === 'number') {
      reportedMillis = issue.reported_at;
    } else if (issue.reported_at._seconds) {
      reportedMillis = issue.reported_at._seconds * 1000;
    }
  }
  
  const hoursOld = reportedMillis ? (Date.now() - reportedMillis) / 3_600_000 : 0;
  const timeScore = Math.min(hoursOld / 24, 1) * 20;

  const total = Math.round(severityScore + affectedScore + timeScore + resourceScore);

  return {
    urgency_score: Math.min(total, 100),
    score_breakdown: {
      severity_contribution:          Math.round(severityScore),
      affected_contribution:          Math.round(affectedScore),
      time_contribution:              Math.round(timeScore),
      resource_gap_contribution:      Math.round(resourceScore),
    },
  };
}

// Resource gap factor: how scarce are specialist responders for this type?
function computeResourceGap(issueType) {
  const gaps = {
    earthquake:   1.0,  // requires specialist USAR teams
    chemical:     1.0,  // HazMat — extremely scarce
    cyclone:      0.9,  // needs pre-positioned rescue
    flood:        0.8,  // boats, rescue — moderately scarce
    fire:         0.8,
    medical:      0.7,
    drought:      0.6,
    heatwave:     0.6,
    displacement: 0.5,
    shelter:      0.5,
    food:         0.4,  // food aid most widely available
    other:        0.5,
  };
  return gaps[issueType] ?? 0.5;
}

module.exports = { computeUrgency };
