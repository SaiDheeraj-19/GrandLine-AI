import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase.js';
import Sidebar from '../components/Sidebar.jsx';
import NotificationBell from '../components/NotificationBell.jsx';

// ── Constants ────────────────────────────────────────────────────────────────
const INDIA_CENTER = { lat: 22.5, lng: 82.5 };
const MAPS_API_KEY  = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const MAP_STYLE = [
  { elementType: 'geometry',            stylers: [{ color: '#060b14' }] },
  { elementType: 'labels.text.fill',    stylers: [{ color: '#ffd166' }, { lightness: -40 }] },
  { elementType: 'labels.text.stroke',  stylers: [{ color: '#060b14' }, { weight: 3 }] },
  { featureType: 'administrative.country',  elementType: 'geometry.stroke', stylers: [{ color: '#ffd166' }, { weight: 1 }, { opacity: 0.5 }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#ffd16650' }, { weight: 0.5 }] },
  { featureType: 'water',               elementType: 'geometry', stylers: [{ color: '#0a1628' }] },
  { featureType: 'landscape',           elementType: 'geometry', stylers: [{ color: '#080d18' }] },
  { featureType: 'road',                stylers: [{ visibility: 'off' }] },
  { featureType: 'poi',                 stylers: [{ visibility: 'off' }] },
];

const TYPE_META = {
  issue_created:       { icon: 'crisis_alert',     label: 'Signal Incoming',   ring: 'border-red-500/40',    dot: 'bg-red-500',    text: 'text-red-400'    },
  issue_creation:      { icon: 'crisis_alert',     label: 'Signal Incoming',   ring: 'border-red-500/40',    dot: 'bg-red-500',    text: 'text-red-400'    },
  assignment:          { icon: 'person_pin_circle',label: 'Asset Assigned',    ring: 'border-blue-500/40',   dot: 'bg-blue-400',   text: 'text-blue-400'   },
  volunteer_assigned:  { icon: 'person_pin_circle',label: 'Asset Assigned',    ring: 'border-blue-500/40',   dot: 'bg-blue-400',   text: 'text-blue-400'   },
  deployment:          { icon: 'rocket_launch',    label: 'Deployment Auth',   ring: 'border-[#ffd166]/40',  dot: 'bg-[#ffd166]',  text: 'text-[#ffd166]'  },
  deployment_triggered:{ icon: 'rocket_launch',    label: 'Deployment Auth',   ring: 'border-[#ffd166]/40',  dot: 'bg-[#ffd166]',  text: 'text-[#ffd166]'  },
  completed:           { icon: 'check_circle',     label: 'Task Completed',    ring: 'border-green-500/40',  dot: 'bg-green-400',  text: 'text-green-400'  },
  status_update:       { icon: 'sync',             label: 'Status Update',     ring: 'border-white/10',      dot: 'bg-white/30',   text: 'text-white/40'   },
  request_created:     { icon: 'hub',              label: 'Support Requested', ring: 'border-orange-500/40', dot: 'bg-orange-400', text: 'text-orange-400'},
  request_accepted:    { icon: 'handshake',        label: 'Support Approved',  ring: 'border-green-500/40',  dot: 'bg-green-400',  text: 'text-green-400' },
  request_rejected:    { icon: 'block',            label: 'Support Denied',    ring: 'border-red-500/40',    dot: 'bg-red-500',    text: 'text-red-400'   },
};

const STATE_CENTERS = {
  'Andhra Pradesh':{ lat:15.9129,lng:79.7400 },'Arunachal Pradesh':{ lat:28.2180,lng:94.7278 },
  'Assam':{ lat:26.2006,lng:92.9376 },'Bihar':{ lat:25.0961,lng:85.3131 },
  'Chhattisgarh':{ lat:21.2787,lng:81.8661 },'Goa':{ lat:15.2993,lng:74.1240 },
  'Gujarat':{ lat:22.2587,lng:71.1924 },'Haryana':{ lat:29.0588,lng:76.0856 },
  'Himachal Pradesh':{ lat:31.1048,lng:77.1734 },'Jharkhand':{ lat:23.6102,lng:85.2799 },
  'Karnataka':{ lat:15.3173,lng:75.7139 },'Kerala':{ lat:10.8505,lng:76.2711 },
  'Madhya Pradesh':{ lat:22.9734,lng:78.6569 },'Maharashtra':{ lat:19.7515,lng:75.7139 },
  'Manipur':{ lat:24.6637,lng:93.9063 },'Meghalaya':{ lat:25.4670,lng:91.3662 },
  'Mizoram':{ lat:23.1645,lng:92.9376 },'Nagaland':{ lat:26.1584,lng:94.5624 },
  'Odisha':{ lat:20.9517,lng:85.0985 },'Punjab':{ lat:31.1471,lng:75.3412 },
  'Rajasthan':{ lat:27.0238,lng:74.2179 },'Sikkim':{ lat:27.5330,lng:88.5122 },
  'Tamil Nadu':{ lat:11.1271,lng:78.6569 },'Telangana':{ lat:18.1124,lng:79.0193 },
  'Tripura':{ lat:23.9408,lng:91.9882 },'Uttar Pradesh':{ lat:26.8467,lng:80.9462 },
  'Uttarakhand':{ lat:30.0668,lng:79.0193 },'West Bengal':{ lat:22.9868,lng:87.8550 },
  'Delhi':{ lat:28.7041,lng:77.1025 },
};

function StatCard({ label, value, icon, color, sub, loading, accent }) {
  return (
    <div className={`relative overflow-hidden p-5 group cursor-default transition-all duration-300 border ${accent || 'border-white/5 hover:border-white/10'} bg-white/[0.02]`}>
      {/* glow blob */}
      <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-20 ${color === 'text-red-400' ? 'bg-red-500' : color === 'text-green-400' ? 'bg-green-500' : 'bg-[#ffd166]'}`} />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <span className={`material-symbols-outlined text-lg ${color}`}>{icon}</span>
          {sub !== undefined && (
            <span className="font-label text-[7px] uppercase tracking-widest text-white/20 mt-1">{sub}</span>
          )}
        </div>
        <p className={`font-headline text-3xl font-black tracking-tight ${color}`}>
          {loading ? <span className="opacity-30 animate-pulse">—</span> : value}
        </p>
        <p className="font-label text-[8px] uppercase tracking-[0.25em] text-white/30 mt-1">{label}</p>
      </div>
    </div>
  );
}

export default function NationalMonitoring() {
  const [events, setEvents]   = useState([]);
  const [issues, setIssues]   = useState([]);
  const [volunteers, setVols] = useState([]);
  const [assistanceRequests, setAssistanceRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [targetState, setTargetState] = useState('');
  const [loading, setLoading] = useState(true);
  const [tick, setTick]       = useState(0);         // clock tick
  const mapRef       = useRef(null);
  const googleMapRef = useRef(null);
  const markersRef   = useRef([]);
  const mapReadyRef  = useRef(false);

  // Clock
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-IN', { hour12: false });
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  // Live Event Stream
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'events'), orderBy('timestamp', 'desc'), limit(60));
    return onSnapshot(q, snap =>
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  // Live Issues
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'issues'), orderBy('timestamp', 'desc'));
    return onSnapshot(q, snap => {
      setIssues(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  // Live Volunteers
  useEffect(() => {
    if (!db) return;
    return onSnapshot(collection(db, 'volunteers'), snap =>
      setVols(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);
  useEffect(() => {
    if (!db) return;
    return onSnapshot(collection(db, 'assistance_requests'), snap =>
      setAssistanceRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);
  // Map init helper
  const initMap = () => {
    if (mapReadyRef.current || !mapRef.current) return;
    mapReadyRef.current = true;
    googleMapRef.current = new window.google.maps.Map(mapRef.current, {
      center: INDIA_CENTER, zoom: 5,
      styles: MAP_STYLE,
      disableDefaultUI: true,
      backgroundColor: '#060b14',
    });
  };

  // Load Google Maps script once
  useEffect(() => {
    if (!MAPS_API_KEY) return;
    let isMounted = true;

    if (window.google?.maps) {
      initMap();
    } else {
      const scriptId = 'google-maps-tactical-sdk';
      if (!document.getElementById(scriptId)) {
        const s = document.createElement('script');
        s.id = scriptId;
        s.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=visualization`;
        s.async = true;
        s.onload = () => { if (isMounted) initMap(); };
        document.head.appendChild(s);
      } else {
        const checker = setInterval(() => {
          if (window.google?.maps) {
            clearInterval(checker);
            if (isMounted) initMap();
          }
        }, 100);
      }
    }
    return () => { isMounted = false; };
  }, []);

  // Re-render markers when issues change
  useEffect(() => {
    if (!googleMapRef.current || !window.google) return;
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    issues.forEach(issue => {
      if (!issue.location?.lat || !issue.location?.lng) return;
      const urgencyScore = issue.urgency_score || 0;
      const isCritical = urgencyScore >= 80;
      const isHigh = urgencyScore >= 60;
      const isMedium = urgencyScore >= 40;
      const pinColor = isHigh ? '#ef4444' : isMedium ? '#ffd166' : '#22c55e';

      const marker = new window.google.maps.Marker({
        position: { lat: issue.location.lat, lng: issue.location.lng },
        map: googleMapRef.current,
        title: issue.summary || '',
        icon: {
          path: 'M 0,-14 C -6,-14 -10,-8 -10,-3 C -10,6 0,14 0,14 C 0,14 10,6 10,-3 C 10,-8 6,-14 0,-14 Z',
          fillColor: pinColor,
          fillOpacity: 0.95,
          strokeColor: pinColor,
          strokeWeight: isCritical ? 2 : 1,
          strokeOpacity: 0.3,
          scale: isCritical ? 1.5 : 1.1,
          anchor: new window.google.maps.Point(0, 14),
        },
        animation: isCritical ? window.google.maps.Animation.BOUNCE : null,
      });
      markersRef.current.push(marker);
    });

    // Coordination Lines
    assistanceRequests.forEach(req => {
      if (req.status === 'rejected') return;
      
      let from, to;
      if (req.status === 'pending') {
        from = STATE_CENTERS[req.fromState];
        to   = INDIA_CENTER;
      } else {
        from = STATE_CENTERS[req.fromState];
        to   = STATE_CENTERS[req.targetState];
      }
      
      if (!from || !to) return;

      const isAccepted = req.status === 'accepted';
      const isForwarded = req.status === 'forwarded';
      
      const line = new window.google.maps.Polyline({
        map: googleMapRef.current,
        path: [from, to],
        strokeColor: isAccepted ? '#22c55e' : isForwarded ? '#3b82f6' : '#ffd166',
        strokeOpacity: 0.6,
        strokeWeight: 1.5,
        icons: [{
          icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.4, scale: 2 },
          repeat: '10px'
        }],
        zIndex: 5
      });
      markersRef.current.push(line);
    });
  }, [issues, assistanceRequests]);

  // ── Command Actions ─────────────────────────────────────────────────────
  const handleForwardRequest = async () => {
    if (!selectedRequest || !targetState) return;
    const t = toast.loading('Routing assistance request...');
    try {
      const docRef = doc(db, 'assistance_requests', selectedRequest.id);
      await updateDoc(docRef, {
        status: 'forwarded',
        targetState: targetState,
        forwardedBy: 'super_admin',
        forwardedAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'notifications'), {
        type: 'forward',
        userId: `admin_${targetState}`,
        message: `DIRECTIVE: Support requested for ${selectedRequest.fromState}`,
        requestId: selectedRequest.id,
        read: false,
        createdAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'events'), {
        type: 'request_forwarded',
        message: `HQ Forwarded: ${selectedRequest.fromState} assistance request → ${targetState}`,
        fromState: selectedRequest.fromState,
        targetState: targetState,
        issueId: selectedRequest.issueId,
        timestamp: serverTimestamp(),
      });

      toast.success('Request Routed.', { id: t });
      setSelectedRequest(null);
      setTargetState('');
    } catch (err) { toast.error(err.message, { id: t }); }
  };

  // ── Derived Analytics ────────────────────────────────────────────────────
  const totalIssues      = issues.length;
  const criticalCount    = issues.filter(i => i.urgency_score >= 80).length;
  const activeDeployments= issues.filter(i => i.routing_status === 'deployed').length;
  const completedTasks   = issues.filter(i => i.status === 'completed').length;
  const availVols        = volunteers.filter(v => v.status === 'available').length;

  // State criticality ranking (dynamic)
  const stateMap = {};
  issues.forEach(i => {
    const s = i.location?.state;
    if (!s) return;
    if (!stateMap[s]) stateMap[s] = { state: s, total: 0, critical: 0, deployed: 0 };
    stateMap[s].total++;
    if (i.urgency_score >= 80) stateMap[s].critical++;
    if (i.routing_status === 'deployed') stateMap[s].deployed++;
  });
  const rankedStates = Object.values(stateMap)
    .sort((a, b) => b.critical - a.critical || b.total - a.total)
    .slice(0, 6);

  return (
    <div className="bg-[#060b14] text-white font-body h-screen overflow-hidden relative flex">
      <Sidebar />

      <main className="flex-1 ml-20 md:ml-64 h-screen flex flex-col overflow-hidden">

        {/* ── TOP COMMAND BAR ─────────────────────────────────────────────── */}
        <header className="flex-shrink-0 flex items-center justify-between px-8 h-16 bg-[#060b14]/95 backdrop-blur-2xl border-b border-[#ffd166]/10 z-50 relative">
          <div className="scan-line top-0 opacity-10" />

          {/* Left: Identity */}
          <div className="flex items-center gap-6">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ffd166] animate-pulse shadow-[0_0_8px_#ffd166]" />
                <span className="font-label text-[8px] uppercase tracking-[0.5em] text-[#ffd166]/60">Operational Theatre · National Level</span>
              </div>
              <h1 className="font-headline text-lg font-black text-white tracking-tight uppercase leading-none">
                National Command Center
              </h1>
            </div>

            {/* Live status pills */}
            <div className="hidden md:flex items-center gap-3 border-l border-white/5 pl-6">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="font-label text-[8px] uppercase tracking-widest text-green-400 font-bold">Uplink Live</span>
              </div>
              {criticalCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 animate-pulse">
                  <span className="material-symbols-outlined text-red-400 text-xs">warning</span>
                  <span className="font-label text-[8px] uppercase tracking-widest text-red-400 font-bold">{criticalCount} Critical</span>
                </div>
              )}
            </div>
          </div>

          {/* Center: Live clock */}
          <div className="hidden lg:flex flex-col items-center">
            <span className="font-headline text-2xl font-black text-white tracking-widest tabular-nums">{timeStr}</span>
            <span className="font-label text-[8px] uppercase tracking-widest text-white/20">{dateStr} · IST</span>
          </div>

          {/* Right */}
          <div className="flex items-center gap-4">
            <NotificationBell />
            <div className="text-right hidden sm:block">
              <span className="font-label text-[8px] uppercase text-white/20 block">Node ID</span>
              <span className="font-label text-[9px] text-[#ffd166]/60 font-bold">IND-NTL-CTR-01</span>
            </div>
          </div>
        </header>

        {/* ── STATS ROW ───────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 grid grid-cols-5 border-b border-white/5">
          <StatCard label="Total Signals"      value={totalIssues}       icon="analytics"      color="text-white"      loading={loading} />
          <StatCard label="Active Deployments" value={activeDeployments}  icon="rocket_launch"  color="text-green-400"  loading={loading} accent="border-green-500/10 hover:border-green-500/20" />
          <StatCard label="Critical Alerts"    value={criticalCount}     icon="emergency"      color="text-red-400"    loading={loading} accent="border-red-500/10 hover:border-red-500/20" />
          <StatCard label="Completed Tasks"    value={completedTasks}    icon="check_circle"    color="text-blue-400"   loading={loading} accent="border-blue-500/10 hover:border-blue-500/20" />
          <StatCard label="Available Assets"   value={availVols}         icon="person_pin"     color="text-[#ffd166]"  loading={loading} />
        </div>

        {/* ── MAIN GRID ───────────────────────────────────────────────────── */}
        <div className="flex-1 grid grid-cols-12 overflow-hidden min-h-0">

          {/* ── LEFT: Live Event Stream ─────────────────────────────────── */}
          <aside className="col-span-12 lg:col-span-3 border-r border-white/5 flex flex-col bg-[#07090f] overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#ffd166] text-sm">stream</span>
                <span className="font-label text-[9px] uppercase tracking-widest text-[#ffd166] font-black">Live Event Stream</span>
              </div>
              <span className="font-label text-[7px] uppercase tracking-widest text-white/20 tabular-nums">{events.length} events</span>
            </div>

            {/* Feed */}
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
              {events.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 gap-2 opacity-30">
                  <span className="material-symbols-outlined text-2xl">wifi_tethering_off</span>
                  <span className="font-label text-[8px] uppercase tracking-widest">Awaiting Signals...</span>
                </div>
              )}
              {events.map((event, idx) => {
                const meta = TYPE_META[event.type] || TYPE_META.status_update;
                const isNew = idx === 0;
                return (
                  <div
                    key={event.id}
                    className={`relative flex gap-3 px-4 py-3.5 border-b border-white/[0.04] transition-all slide-right
                      ${isNew ? 'bg-[#ffd166]/[0.04]' : 'hover:bg-white/[0.02]'}`}
                  >
                    {/* Latest pulse bar */}
                    {isNew && <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#ffd166]" />}

                    {/* Icon */}
                    <div className={`flex-shrink-0 w-7 h-7 rounded-sm border ${meta.ring} flex items-center justify-center mt-0.5`}>
                      <span className={`material-symbols-outlined text-xs ${meta.text}`}>{meta.icon}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className={`font-label text-[7px] uppercase font-bold tracking-widest ${meta.text}`}>{meta.label}</span>
                        <span className="font-label text-[6px] text-white/20 tabular-nums flex-shrink-0">
                          {event.timestamp?.toDate().toLocaleTimeString('en-IN', { hour12: false })}
                        </span>
                      </div>
                      <p className="font-body text-[10px] text-white/70 leading-snug truncate">{event.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {event.state && (
                          <span className="font-label text-[6px] uppercase tracking-wider text-[#ffd166]/50 px-1.5 py-0.5 border border-[#ffd166]/10 bg-[#ffd166]/5">
                            {event.state}
                          </span>
                        )}
                        <span className="font-label text-[6px] uppercase text-white/10 tracking-wider">
                          #{event.issueId?.slice(0, 6)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* ── CENTER: Global Map ──────────────────────────────────────── */}
          <section className="col-span-12 lg:col-span-6 relative overflow-hidden">
            {/* Map canvas */}
            <div ref={mapRef} className="absolute inset-0" />

            {/* Vignette */}
            <div className="absolute inset-0 pointer-events-none"
              style={{ boxShadow: 'inset 0 0 80px 20px rgba(6,11,20,0.9)' }} />

            {/* Top map label */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none z-10">
              <div className="flex items-center gap-2 bg-[#060b14]/80 backdrop-blur-xl border border-[#ffd166]/15 px-4 py-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ffd166] animate-pulse" />
                <span className="font-label text-[8px] uppercase tracking-[0.3em] text-[#ffd166]/70 font-bold">
                  National Threat Map · India
                </span>
              </div>
            </div>

            {/* Bottom HUD strip */}
            <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-10 p-4 flex items-end justify-between">
              {/* Issue count badge */}
              <div className="bg-[#060b14]/90 backdrop-blur border border-white/10 px-4 py-3 flex items-center gap-3">
                <div>
                  <p className="font-label text-[7px] uppercase text-white/20 tracking-widest">Active Signals</p>
                  <p className="font-headline text-xl font-black text-white">{totalIssues}</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div>
                  <p className="font-label text-[7px] uppercase text-white/20 tracking-widest">Critical</p>
                  <p className="font-headline text-xl font-black text-red-400">{criticalCount}</p>
                </div>
              </div>

              {/* Legend */}
              <div className="bg-[#060b14]/90 backdrop-blur border border-white/10 px-4 py-3">
                <p className="font-label text-[7px] uppercase text-white/20 tracking-widest mb-2">Severity Scale</p>
                <div className="flex items-center gap-3">
                  {[['#ef4444','Critical (80+)'],['#f97316','High (60+)'],['#ffd166','Active']].map(([c,l]) => (
                    <div key={l} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: c }} />
                      <span className="font-label text-[7px] text-white/40 uppercase tracking-wider">{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ── RIGHT: Analytics Panel ──────────────────────────────────── */}
          <aside className="col-span-12 lg:col-span-3 border-l border-white/5 flex flex-col bg-[#07090f] overflow-hidden">
            <div className="flex-shrink-0 px-5 py-4 border-b border-white/5">
              <span className="font-label text-[9px] uppercase tracking-widest text-[#ffd166] font-black flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">monitoring</span>
                State Criticality Index
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ scrollbarWidth: 'none' }}>

              {/* Ranked state list */}
              {rankedStates.length === 0 && !loading && (
                <div className="flex items-center justify-center h-24 opacity-20">
                  <span className="font-label text-[8px] uppercase tracking-widest">No data yet</span>
                </div>
              )}
              {rankedStates.map((s, i) => {
                const saturation = s.total > 0 ? Math.round((s.critical / s.total) * 100) : 0;
                const borderColor = s.critical > 0 ? '#ef4444' : '#22c55e';
                const textColor   = s.critical > 0 ? 'text-red-400' : 'text-green-400';
                const barColor    = s.critical > 0 ? 'bg-red-500' : 'bg-green-500';
                return (
                  <div key={s.state}
                    className="p-4 bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all"
                    style={{ borderLeft: `2px solid ${borderColor}` }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="font-label text-[7px] uppercase text-white/20 tracking-widest">#{i+1} Sector</span>
                        <p className="font-headline text-[11px] font-black uppercase text-white tracking-wide">{s.state}</p>
                      </div>
                      <span className={`font-headline text-xs font-black ${textColor}`}>
                        {s.critical > 0 ? `${saturation}% SAT` : 'STABLE'}
                      </span>
                    </div>
                    {/* Bar */}
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden mb-2">
                      <div className={`h-full ${barColor} rounded-full`} style={{ width: `${Math.max(saturation, 5)}%` }} />
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {[['Total', s.total, 'text-white/60'],['Critical', s.critical, 'text-red-400'],['Deployed', s.deployed, 'text-green-400']].map(([k,v,c]) => (
                        <div key={k}>
                          <p className="font-label text-[6px] text-white/20 uppercase tracking-wider">{k}</p>
                          <p className={`font-headline text-xs font-black ${c}`}>{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* System vitals section */}
              <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                <span className="font-label text-[8px] uppercase tracking-widest text-white/20">System Vitals</span>

                {[
                  { label: 'Data Integrity', val: 98, color: 'bg-green-500' },
                  { label: 'Uplink Latency', val: 84, color: 'bg-[#ffd166]' },
                  { label: 'AI Confidence',  val: 91, color: 'bg-blue-500'  },
                ].map(v => (
                  <div key={v.label}>
                    <div className="flex justify-between mb-1">
                      <span className="font-label text-[8px] text-white/30 uppercase">{v.label}</span>
                      <span className="font-label text-[8px] text-white/50 font-bold">{v.val}%</span>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full ${v.color} transition-all`} style={{ width: `${v.val}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Global Coordination Feed (Actionable for Super Admin) */}
              <div className="mt-4 pt-4 border-t border-white/5 flex flex-col overflow-hidden min-h-[300px]">
                <span className="font-label text-[8px] uppercase tracking-widest text-[#ffd166] block mb-3 font-black">National Assistance Queue</span>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1" style={{ scrollbarWidth: 'none' }}>
                  {assistanceRequests.filter(r => r.status === 'pending').map(req => (
                    <div key={req.id} className="p-3 bg-white/[0.04] border border-[#ffd166]/20 animate-in slide-in-from-right duration-300">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="font-label text-[8px] uppercase text-[#ffd166] font-bold">Pending: {req.fromState}</span>
                        <span className="font-label text-[6px] text-white/20">#{req.issueId?.slice(0,6)}</span>
                      </div>
                      <p className="font-body text-[9px] text-white/60 mb-3 italic">"{req.reason}"</p>
                      
                      {selectedRequest?.id === req.id ? (
                        <div className="space-y-2 animate-in fade-in">
                          <select 
                            value={targetState}
                            onChange={(e) => setTargetState(e.target.value)}
                            className="w-full bg-[#060b14] border border-white/20 p-2 text-[9px] font-label text-white uppercase"
                          >
                            <option value="">Select Resource Partner</option>
                            {Object.keys(STATE_CENTERS).filter(s => s !== req.fromState).sort().map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          <div className="flex gap-1">
                            <button onClick={handleForwardRequest} className="flex-1 py-1.5 bg-[#ffd166] text-[#0f131e] font-label text-[8px] uppercase font-black">Route Assistance</button>
                            <button onClick={() => setSelectedRequest(null)} className="px-3 py-1.5 border border-white/10 text-white/40"><span className="material-symbols-outlined text-xs">close</span></button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setSelectedRequest(req)} className="w-full py-1.5 border border-[#ffd166]/30 text-[#ffd166] font-label text-[8px] uppercase tracking-widest font-black hover:bg-[#ffd166]/5">Review & Route</button>
                      )}
                    </div>
                  ))}
                  
                  {/* Processed/Forwarded requests (Read-only status) */}
                  {assistanceRequests.filter(r => r.status !== 'pending').slice().reverse().map(req => (
                    <div key={req.id} className="p-3 bg-black/40 border border-white/5 opacity-60">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-label text-[7px] uppercase text-white/40 tracking-widest">{req.fromState} → {req.targetState}</span>
                        <span className={`font-label text-[7px] uppercase font-black tracking-tighter ${req.status === 'accepted' ? 'text-green-400' : req.status === 'rejected' ? 'text-red-400' : 'text-blue-400'}`}>
                          {req.status}
                        </span>
                      </div>
                      <p className="font-label text-[6px] text-white/10 uppercase tracking-widest">Routed by: {req.forwardedBy || 'HQ'}</p>
                    </div>
                  ))}
                  
                  {assistanceRequests.length === 0 && (
                    <div className="py-6 text-center opacity-10 flex flex-col items-center gap-1">
                      <span className="material-symbols-outlined">hub</span>
                      <span className="font-label text-[7px] uppercase tracking-widest">Command Queue Clear</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent dispatch events */}
              <div className="mt-4 pt-4 border-t border-white/5">
                <span className="font-label text-[8px] uppercase tracking-widest text-white/20 block mb-3">Recent Dispatches</span>
                <div className="space-y-2">
                  {events.filter(e => e.type === 'deployment' || e.type === 'deployment_triggered').slice(0, 4).map(e => (
                    <div key={e.id} className="flex items-center gap-2 px-3 py-2 bg-[#ffd166]/5 border border-[#ffd166]/10">
                      <span className="material-symbols-outlined text-[#ffd166] text-xs">rocket_launch</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-body text-[9px] text-white/60 truncate">{e.message}</p>
                        <p className="font-label text-[6px] uppercase text-white/20">{e.state || 'National Command'}</p>
                      </div>
                    </div>
                  ))}
                  {events.filter(e => e.type === 'deployment' || e.type === 'deployment_triggered').length === 0 && (
                    <p className="font-label text-[8px] text-white/15 uppercase text-center py-3">No dispatches yet</p>
                  )}
                </div>
              </div>

            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
