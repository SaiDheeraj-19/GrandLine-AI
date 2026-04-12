import React from 'react';
import { AlertTriangle, Users, Activity, TrendingUp } from 'lucide-react';

// StatsBar renders live issue counts and volunteer availability from Firestore
export default function StatsBar({ issues, volunteers }) {
  const totalIssues   = issues.length;
  const criticalCount = issues.filter(i => i.urgency_score >= 80).length;
  const availableVols = volunteers.filter(v => v.status === 'available').length;
  const resolvedToday = issues.filter(i => i.status === 'resolved').length;

  const stats = [
    {
      id: 'total-issues',
      label: 'Total Issues',
      value: totalIssues,
      icon: Activity,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
    },
    {
      id: 'critical-issues',
      label: 'Critical (≥80)',
      value: criticalCount,
      icon: AlertTriangle,
      color: 'text-red-400',
      bg: 'bg-red-500/10 border-red-500/20',
      pulse: criticalCount > 0,
    },
    {
      id: 'volunteers-available',
      label: 'Volunteers Available',
      value: availableVols,
      icon: Users,
      color: 'text-green-400',
      bg: 'bg-green-500/10 border-green-500/20',
    },
    {
      id: 'resolved-today',
      label: 'Resolved Today',
      value: resolvedToday,
      icon: TrendingUp,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-3 mb-4">
      {stats.map(({ id, label, value, icon: Icon, color, bg, pulse }) => (
        <div key={id} id={id} className={`card border ${bg} flex items-center gap-3 py-3`}>
          <div className={`relative p-2 rounded-lg ${bg}`}>
            <Icon size={18} className={color} />
            {pulse && (
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-400 rounded-full pulse-ring" />
            )}
          </div>
          <div>
            <p className="text-2xl font-bold text-white leading-none">{value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
