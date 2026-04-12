import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase.js';
import { 
  AlertTriangle, 
  Search, 
  Filter, 
  MapPin, 
  Clock, 
  ArrowUpRight,
  MoreVertical,
  Activity,
  User,
  Zap
} from 'lucide-react';

export default function Issues() {
  const [filter, setFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('active'); // 'active' or 'archived'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'issues'), orderBy('reported_at', 'desc'));
    return onSnapshot(q, snap => {
      setIssues(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const filteredIssues = issues.filter(issue => {
    const matchesPriority = (() => {
      if (filter === 'All') return true;
      if (filter === 'High') return issue.urgency_score >= 70;
      if (filter === 'Medium') return issue.urgency_score >= 40 && issue.urgency_score < 70;
      if (filter === 'Low') return issue.urgency_score < 40;
      return true;
    })();
    const matchesStatus = statusFilter === 'active' ? issue.status !== 'completed' : issue.status === 'completed';
    return matchesPriority && matchesStatus;
  });

  return (
    <div className="flex h-full bg-[#0B0F1A] text-slate-200 overflow-hidden font-body">
      {/* ── MAIN CONTENT ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col p-8 overflow-y-auto z-10">
        {/* Background Effects */}
        <div className="absolute inset-0 tactical-grid opacity-5 pointer-events-none" />
        
        {/* Header */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-danger/10 flex items-center justify-center border border-danger/20 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
                <AlertTriangle className="text-danger" size={24} />
              </div>
              <h1 className="text-4xl font-display font-bold text-white tracking-tight">Active Incursions</h1>
            </div>
            <p className="text-slate-500 font-medium">Monitoring and managing active emergency response threads.</p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="text" 
                placeholder="Search archives..."
                className="bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-12 pr-6 text-sm focus:outline-none focus:border-info/50 focus:ring-4 focus:ring-info/10 transition-all w-full md:w-64"
              />
            </div>
            <div className="flex p-1 bg-slate-900/50 rounded-2xl border border-slate-800">
              {['Active', 'Archived'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s.toLowerCase())}
                  className={`px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                    statusFilter === s.toLowerCase() ? 'bg-[#ffd166] text-[#0B0F1A]' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                   {s}
                </button>
              ))}
            </div>
            <div className="flex p-1 bg-slate-900/50 rounded-2xl border border-slate-800">
              {['All', 'High', 'Medium', 'Low'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                    filter === f ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* List area */}
        <div className="relative z-10 grid gap-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Zap className="text-amber-500 animate-pulse" size={40} />
            </div>
          ) : filteredIssues.length > 0 ? (
            filteredIssues.map((issue) => (
              <div key={issue.id} className="glass-card group p-6 rounded-[2rem] border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center gap-8 relative overflow-hidden">
                {/* Visual Accent */}
                <div className={`absolute top-0 left-0 w-1 h-full ${
                  issue.urgency_score >= 70 ? 'bg-danger' : issue.urgency_score >= 40 ? 'bg-amber-500' : 'bg-info'
                }`} />

                {/* Status & Priority */}
                <div className="md:w-32 flex flex-col gap-2">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                    issue.urgency_score >= 70 
                    ? 'text-danger bg-danger/10 border-danger/20' 
                    : issue.urgency_score >= 40 
                    ? 'text-amber-500 bg-amber-500/10 border-amber-500/20' 
                    : 'text-info bg-info/10 border-info/20'
                  }`}>
                    {issue.urgency_score >= 70 ? 'Alpha' : issue.urgency_score >= 40 ? 'Beta' : 'Gamma'}
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest px-1">
                    Score: {issue.urgency_score}/100
                  </div>
                </div>

                {/* Main Intel */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-display font-bold text-white tracking-tight">{issue.issue_type}</h3>
                    <span className="text-xs text-slate-500 font-mono">#{issue.id.slice(0, 6).toUpperCase()}</span>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed max-w-2xl line-clamp-1">{issue.summary}</p>
                </div>

                {/* Location & Time */}
                <div className="md:w-64 flex flex-col gap-3">
                  <div className="flex items-center gap-3 text-sm font-medium text-slate-300">
                    <MapPin size={16} className="text-info" />
                    {issue.location?.area_name || 'Coordinate Unmapped'}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <Clock size={14} />
                    {issue.reported_at?.toDate ? new Date(issue.reported_at.toDate()).toLocaleString() : 'Recent Intelligence'}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-4">
                  <button className="p-3 rounded-2xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all outline-none">
                    <MoreVertical size={20} />
                  </button>
                  <button className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-500 text-[#0B0F1A] font-bold text-sm hover:shadow-[0_0_20px_rgba(251,191,36,0.3)] transition-all">
                    Respond
                    <ArrowUpRight size={18} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="glass-card p-20 rounded-[3rem] border-slate-800 text-center">
              <Activity className="text-slate-700 mx-auto mb-6" size={60} />
              <h3 className="text-2xl font-display font-bold text-slate-400 mb-2 tracking-tight">System Idle</h3>
              <p className="text-slate-600 font-medium">No critical incursions detected in this sector.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
