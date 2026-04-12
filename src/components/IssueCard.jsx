import React, { useState } from 'react';
import { format } from 'date-fns';

export default function IssueCard({ issue, onDeploy, compact = false }) {
  const [expanded, setExpanded] = useState(false);

  const {
    id, location, issue_type, severity, affected_count, urgency_score,
    summary, recommended_action, tags, source, status, reported_at,
    score_breakdown, is_merged, merged_count,
  } = issue;

  const displayTime = reported_at?.toDate
    ? format(reported_at.toDate(), 'HH:mm:ss')
    : '--:--:--';

  return (
    <div className={`relative group bg-surface-container-high/40 backdrop-blur-md overflow-hidden border-l-2 transition-all hover:bg-surface-container-high/60 ${urgency_score >= 80 ? 'border-on-tertiary-container' : 'border-primary-container'} ${compact ? 'p-4' : 'p-6'}`}>
      <div className="absolute inset-0 dot-grid opacity-10 pointer-events-none"></div>
      
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <span className={`px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase font-label ${urgency_score >= 80 ? 'bg-error-container text-on-error-container' : 'bg-primary-container text-on-primary-container'}`}>
              {urgency_score >= 80 ? 'CRITICAL' : 'HIGH PRIORITY'}
            </span>
            <span className="text-white/30 text-[10px] font-label uppercase tracking-widest">#ID-{id.slice(-6).toUpperCase()}</span>
          </div>
          <h3 className="font-headline text-lg font-medium tracking-tight text-primary uppercase">
            {issue_type || 'Unknown Anomaly'} @ {location?.area_name || 'Grid Sector'}
          </h3>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-label text-white/40 uppercase block">{displayTime} UTC</span>
          {is_merged && <span className="text-[8px] font-label text-secondary uppercase tracking-tighter mt-1 block">{merged_count} Signals Merged</span>}
        </div>
      </div>

      {/* Summary */}
      <p className="text-xs text-on-surface-variant leading-relaxed mb-6 font-body">
        {summary}
      </p>

      {/* Metrics Row */}
      <div className="flex items-center gap-6 mb-6">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-base">diversity_3</span>
          <span className="text-[10px] font-label text-white/60 uppercase tracking-widest">{affected_count || 0} AFFECTED</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary-container text-base">emergency</span>
          <span className="text-[10px] font-label text-white/60 uppercase tracking-widest">SEV {severity}/5</span>
        </div>
        <div className={`flex items-center gap-2 ml-auto`}>
           <div className={`w-2 h-2 rounded-full ${status === 'resolved' ? 'bg-secondary' : 'bg-primary-container'} animate-pulse`}></div>
           <span className="text-[10px] font-label text-white/60 uppercase tracking-widest">{status}</span>
        </div>
      </div>

      {/* Recommended Action & Deploy */}
      {!compact && (
        <div className="space-y-4 pt-4 border-t border-white/5">
           <div className="bg-white/5 p-4 border-l-2 border-primary-container/20">
              <span className="text-[9px] font-label text-primary-container/40 uppercase block mb-1">Recommended Response</span>
              <p className="text-[11px] text-primary/80 italic font-body">{recommended_action}</p>
           </div>
           
           <div className="flex items-center justify-between">
              <div className="flex gap-2">
                {(tags || []).map(tag => (
                  <span key={tag} className="text-[8px] px-1.5 py-0.5 bg-surface-container-lowest text-white/20 uppercase tracking-widest border border-white/5">#{tag}</span>
                ))}
              </div>
              {onDeploy && status === 'open' && (
                <button 
                  onClick={() => onDeploy(id)}
                  className="bg-primary-container text-on-primary-container px-4 py-2 font-headline font-bold text-[10px] tracking-widest uppercase hover:shadow-[0_0_20px_rgba(255,209,102,0.4)] transition-all flex items-center gap-2"
                >
                  Initiate Deployment <span className="material-symbols-outlined text-sm">rocket_launch</span>
                </button>
              )}
           </div>
        </div>
      )}
    </div>
  );
}
