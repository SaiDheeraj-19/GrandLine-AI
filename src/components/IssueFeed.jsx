import React from 'react';
import IssueCard from './IssueCard.jsx';
import { SortDesc } from 'lucide-react';

// IssueFeed renders issues sorted by urgency_score descending with real-time updates
export default function IssueFeed({ issues, onDeploy, loading }) {
  const sorted = [...issues].sort((a, b) => b.urgency_score - a.urgency_score);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map(n => (
          <div key={n} className="card border border-border animate-pulse">
            <div className="h-4 bg-slate-700 rounded w-3/4 mb-3" />
            <div className="h-3 bg-slate-800 rounded w-full mb-2" />
            <div className="h-3 bg-slate-800 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-slate-500">
        <SortDesc size={32} className="mb-3 opacity-30" />
        <p className="text-sm">No issues reported yet.</p>
        <p className="text-xs mt-1">Upload a report to see it appear here.</p>
      </div>
    );
  }

  return (
    <div id="issue-feed" className="flex flex-col gap-3 overflow-y-auto pr-1" style={{ maxHeight: '100%' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">
          Issues — sorted by urgency
        </span>
        <span className="text-xs text-slate-600">{sorted.length} total</span>
      </div>
      {sorted.map(issue => (
        <IssueCard key={issue.id} issue={issue} onDeploy={onDeploy} />
      ))}
    </div>
  );
}
