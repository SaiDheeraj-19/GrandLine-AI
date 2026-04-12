import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase.js';
import Sidebar from '../components/Sidebar.jsx';

const STATE_COLORS = {
  Kerala: '#06b6d4', Bihar: '#f97316', Rajasthan: '#eab308', Odisha: '#ef4444',
  Maharashtra: '#8b5cf6', Assam: '#22c55e', 'Andhra Pradesh': '#ec4899',
  'Tamil Nadu': '#f59e0b', 'West Bengal': '#3b82f6', Gujarat: '#10b981',
  'Uttar Pradesh': '#ffd166', Telangana: '#a78bfa', Punjab: '#34d399',
  'Madhya Pradesh': '#fb923c',
};

const getStateColor = (state) => STATE_COLORS[state] || '#6b7280';

export default function NationalView() {
  const [issues,     setIssues]     = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    if (!db) return;
    const unsubI = onSnapshot(
      query(collection(db, 'issues'), orderBy('urgency_score', 'desc')),
      (snap) => { setIssues(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); }
    );
    const unsubV = onSnapshot(collection(db, 'volunteers'), (snap) =>
      setVolunteers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => { unsubI(); unsubV(); };
  }, []);

  // Aggregate by state
  const stateMap = {};
  for (const issue of issues) {
    const state = issue.location?.state || 'Unknown';
    if (!stateMap[state]) stateMap[state] = { issues: [], max_score: 0, total_affected: 0 };
    stateMap[state].issues.push(issue);
    stateMap[state].max_score = Math.max(stateMap[state].max_score, issue.urgency_score || 0);
    stateMap[state].total_affected += issue.affected_count || 0;
  }

  const volsByState = {};
  for (const vol of volunteers) {
    const state = vol.location?.state || 'Unknown';
    if (!volsByState[state]) volsByState[state] = [];
    volsByState[state].push(vol);
  }

  const sortedStates = Object.entries(stateMap)
    .sort(([, a], [, b]) => b.max_score - a.max_score);

  const totalAffected     = issues.reduce((s, i) => s + (i.affected_count || 0), 0);
  const criticalCount     = issues.filter((i) => i.urgency_score >= 80).length;
  const escalatedCount    = issues.filter((i) => i.escalated).length;
  const routedPct         = issues.length > 0
    ? Math.round((issues.filter((i) => i.routing_status === 'routed' || i.routing_status === 'deployed').length / issues.length) * 100)
    : 0;

  return (
    <div className="bg-background text-on-background font-body min-h-screen dot-grid">
      <Sidebar />

      <main className="ml-20 md:ml-64">
        {/* Header */}
        <header className="px-6 py-4 border-b border-white/5 bg-[#0f131e]/80 backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-label text-[9px] uppercase tracking-[0.4em] text-primary/40 mb-1">28 States · 8 UTs · 22 Languages</p>
              <h1 className="font-headline text-3xl font-black tracking-tighter uppercase leading-none">National Overview</h1>
            </div>
            <div className="flex items-center gap-2 text-[9px] font-label uppercase text-secondary">
              <span className="w-1.5 h-1.5 bg-secondary rounded-full animate-pulse shadow-[0_0_8px_#ffd166]"></span>
              <span>Live Feed Active</span>
            </div>
          </div>
        </header>

        <div className="p-6 md:p-10 space-y-10 max-h-[calc(100vh-80px)] overflow-y-auto custom-scrollbar">

          {/* National KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Issues',       value: issues.length,                          color: 'text-primary',              icon: 'warning' },
              { label: 'Critical (80+)',      value: criticalCount,                           color: 'text-error',                icon: 'emergency' },
              { label: 'People Affected',     value: totalAffected > 999 ? `${(totalAffected/1000).toFixed(1)}k` : totalAffected, color: 'text-secondary', icon: 'group' },
              { label: 'Routing Coverage',    value: `${routedPct}%`,                         color: 'text-primary-container',     icon: 'route' },
            ].map(({ label, value, color, icon }) => (
              <div key={label} className="bg-surface-container-low p-6 relative overflow-hidden border border-white/5">
                <div className="scan-line top-0 opacity-5"></div>
                <span className={`material-symbols-outlined text-2xl ${color} mb-2 block`}>{icon}</span>
                <div className={`font-headline font-black text-4xl ${color} leading-none`}>{loading ? '—' : value}</div>
                <div className="font-label text-[9px] uppercase tracking-widest text-white/30 mt-1">{label}</div>
              </div>
            ))}
          </div>

          {/* Coverage gap alert */}
          {escalatedCount > 0 && (
            <div className="bg-error/5 border border-error/20 p-4 flex items-center gap-4">
              <span className="material-symbols-outlined text-error text-2xl animate-pulse">emergency</span>
              <div>
                <p className="font-headline text-sm font-bold text-error uppercase leading-none">Resource Gap Detected</p>
                <p className="font-body text-[10px] text-white/40 mt-1 uppercase tracking-wider">Escalating {escalatedCount} incidents to national level responder pool.</p>
              </div>
            </div>
          )}

          {/* State-by-State Grid */}
          <div>
            <div className="flex items-end justify-between mb-6 border-b border-white/5 pb-4">
              <div>
                <p className="font-label text-[9px] uppercase tracking-[0.2em] text-white/20">Crisis Density Index</p>
                <h2 className="font-headline text-2xl font-bold uppercase tracking-tight text-[#ffd166]">State Comparison</h2>
              </div>
              <span className="font-label text-[9px] text-white/20 uppercase tracking-widest">{sortedStates.length} Active States</span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {loading ? (
                <div className="flex items-center justify-center py-20 opacity-20"><div className="animate-spin material-symbols-outlined text-5xl">progress_activity</div></div>
              ) : sortedStates.length === 0 ? (
                <div className="text-center py-16 opacity-20"><p className="font-label text-xs uppercase tracking-[0.5em]">No Active Threats</p></div>
              ) : sortedStates.map(([state, data]) => {
                const availableVols = (volsByState[state] || []).filter((v) => v.status === 'available').length;
                const barWidth = Math.max((data.max_score / 100) * 100, 2);
                const color = getStateColor(state);
                const critInState = data.issues.filter((i) => i.urgency_score >= 80).length;

                return (
                  <div key={state} className="glass-panel group relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 opacity-10 transition-all group-hover:opacity-20"
                      style={{ width: `${barWidth}%`, background: color }}></div>
                    <div className="relative p-5 flex flex-wrap items-center justify-between gap-6">
                      <div className="flex items-center gap-5 min-w-[200px]">
                        <div className="w-2 h-10" style={{ background: color }}></div>
                        <div>
                          <h3 className="font-headline text-base font-bold text-on-surface uppercase tracking-tight leading-none">{state}</h3>
                          <div className="flex gap-2 mt-2">
                             {data.issues.slice(0, 3).map(iss => (
                               <span key={iss.id} className="text-[8px] font-label text-white/30 uppercase border border-white/5 px-1.5 py-0.5">{iss.issue_type}</span>
                             ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-10 flex-grow justify-end">
                        <div className="text-right">
                          <div className="font-headline font-black text-2xl leading-none" style={{ color }}>{data.max_score}</div>
                          <div className="font-label text-[8px] uppercase text-white/20 mt-1">Severity Index</div>
                        </div>
                        <div className="text-right hidden sm:block">
                          <div className="font-headline font-bold text-lg leading-none active-text">{data.total_affected.toLocaleString()}</div>
                          <div className="font-label text-[8px] uppercase text-white/20 mt-1">Affected</div>
                        </div>
                        <div className="text-right">
                          <div className={`font-headline font-bold text-lg leading-none ${critInState > 0 ? 'text-error' : 'text-white/20'}`}>{critInState}</div>
                          <div className="font-label text-[8px] uppercase text-white/20 mt-1">Critical</div>
                        </div>
                        <div className="text-right min-w-[100px]">
                          <div className="font-headline font-bold text-lg leading-none text-secondary">{availableVols}</div>
                          <div className="font-label text-[8px] uppercase text-white/20 mt-1">Active Vols</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Skill Matrix */}
          <div className="border-t border-white/5 pt-10">
            <div className="flex items-end justify-between mb-8">
              <h2 className="font-headline text-2xl font-bold uppercase tracking-tight text-white/60">Skill Inventory</h2>
              <span className="font-label text-[9px] text-white/20 uppercase tracking-[0.4em]">{volunteers.length} Ready Responders</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {['medical','rescue','food','logistics','shelter','water','counselling','general'].map((skill) => {
                const count = volunteers.filter((v) => (v.skills || []).includes(skill)).length;
                const pct = volunteers.length > 0 ? Math.round((count / volunteers.length) * 100) : 0;
                return (
                  <div key={skill} className="bg-white/2 p-5 border border-white/5">
                    <div className="flex justify-between items-center mb-4">
                      <span className="font-label text-[10px] uppercase tracking-widest text-white/40">{skill}</span>
                      <span className="font-headline font-black text-base active-text">{count}</span>
                    </div>
                    <div className="h-1 bg-white/5 relative">
                      <div className="h-full bg-[#ffd166] transition-all duration-1000" style={{ width: `${pct}%`, opacity: 0.3 + (pct/150) }}></div>
                    </div>
                    <div className="flex justify-between mt-2">
                       <span className="font-label text-[8px] text-white/20 uppercase">Deployment Ready</span>
                       <span className="font-label text-[8px] text-[#ffd166] uppercase font-bold">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
