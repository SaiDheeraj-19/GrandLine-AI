import React from 'react';
import { Navigation, Clock, Star, Phone } from 'lucide-react';

// MatchResult shows the top 3 matched volunteers for an issue
export default function MatchResult({ matches, loading, issueAreaName }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(n => (
          <div key={n} className="card animate-pulse">
            <div className="h-4 bg-slate-700 rounded w-1/2 mb-2" />
            <div className="h-3 bg-slate-800 rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <div className="card border border-border text-slate-400 text-sm text-center py-8">
        No available volunteers found for this issue type.
      </div>
    );
  }

  return (
    <div id="match-results" className="space-y-3 slide-up">
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
        Top {matches.length} Matches for {issueAreaName}
      </p>
      {matches.map((v, idx) => (
        <div
          key={v.id}
          id={`match-volunteer-${v.id}`}
          className="card border border-border flex items-center gap-4"
        >
          {/* Rank */}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
            idx === 0 ? 'bg-yellow-500/20 text-yellow-400' :
            idx === 1 ? 'bg-slate-500/20 text-slate-300' :
                        'bg-orange-700/20 text-orange-600'
          }`}>
            #{idx + 1}
          </div>

          {/* Volunteer info */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white text-sm">{v.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {v.skills?.join(' · ')} · {v.area_name}
            </p>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Navigation size={11} />
                {v.distance_km} km away
              </span>
              <span className="flex items-center gap-1">
                <Clock size={11} />
                ETA ~{v.eta_minutes} min
              </span>
            </div>
          </div>

          {/* Match score */}
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <div className="flex items-center gap-1">
              <Star size={12} className="text-yellow-400 fill-yellow-400" />
              <span className="font-bold text-white text-sm">{v.match_score}%</span>
            </div>
            {v.phone && (
              <a href={`tel:${v.phone}`} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                <Phone size={11} />Call
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
