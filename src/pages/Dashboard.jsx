import React, { useEffect, useRef, useState, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, addDoc, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import toast from 'react-hot-toast';
import Sidebar from '../components/Sidebar.jsx';
import { useNavigate } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell.jsx';

const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 };
const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// ── Colour helpers ─────────────────────────────────────────────────────────
const SKILL_COLORS = {
  medical: '#ef4444', rescue: '#f97316', food: '#22c55e',
  logistics: '#3b82f6', shelter: '#8b5cf6', water: '#06b6d4',
  counselling: '#ec4899', general: '#6b7280',
};

const urgencyColor = (score) =>
  score >= 80 ? '#ef4444' : score >= 60 ? '#f97316' : score >= 40 ? '#eab308' : '#22c55e';

const skillColor = (skill) => SKILL_COLORS[skill] || '#6b7280';

const TYPE_ICONS = {
  flood: 'waves', drought: 'wb_sunny', cyclone: 'storm', earthquake: 'vibration',
  medical: 'medical_services', food: 'restaurant', shelter: 'home', displacement: 'transfer_within_a_station',
  heatwave: 'thermostat', fire: 'local_fire_department', chemical: 'science', other: 'warning',
};

// ── Dark Tactical Map Style ───────────────────────────────────────────────
const MAP_DARK_STYLE = [
  { elementType: 'geometry',           stylers: [{ color: '#0a0e19' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#4a5568' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0e19' }] },
  { featureType: 'administrative',      elementType: 'geometry', stylers: [{ color: '#1e2535' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#ffd166' }, { weight: 0.8 }, { opacity: 0.4 }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#ffd166' }, { weight: 0.4 }, { opacity: 0.2 }] },
  { featureType: 'road',                stylers: [{ visibility: 'off' }] },
  { featureType: 'poi',                 stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',             stylers: [{ visibility: 'off' }] },
  { featureType: 'water',               elementType: 'geometry', stylers: [{ color: '#0d1929' }] },
  { featureType: 'landscape',           elementType: 'geometry', stylers: [{ color: '#0f131e' }] },
];

const STATE_CENTERS = {
  'Andhra Pradesh': { lat: 15.9129, lng: 79.7400 }, 'Arunachal Pradesh': { lat: 28.2180, lng: 94.7278 }, 'Assam': { lat: 26.2006, lng: 92.9376 },
  'Bihar': { lat: 25.0961, lng: 85.3131 }, 'Chhattisgarh': { lat: 21.2787, lng: 81.8661 }, 'Goa': { lat: 15.2993, lng: 74.1240 },
  'Gujarat': { lat: 22.2587, lng: 71.1924 }, 'Haryana': { lat: 29.0588, lng: 76.0856 }, 'Himachal Pradesh': { lat: 31.1048, lng: 77.1734 },
  'Jharkhand': { lat: 23.6102, lng: 85.2799 }, 'Karnataka': { lat: 15.3173, lng: 75.7139 }, 'Kerala': { lat: 10.8505, lng: 76.2711 },
  'Madhya Pradesh': { lat: 22.9734, lng: 78.6569 }, 'Maharashtra': { lat: 19.7515, lng: 75.7139 }, 'Manipur': { lat: 24.6637, lng: 93.9063 },
  'Meghalaya': { lat: 25.4670, lng: 91.3662 }, 'Mizoram': { lat: 23.1645, lng: 92.9376 }, 'Nagaland': { lat: 26.1584, lng: 94.5624 },
  'Odisha': { lat: 20.9517, lng: 85.0985 }, 'Punjab': { lat: 31.1471, lng: 75.3412 }, 'Rajasthan': { lat: 27.0238, lng: 74.2179 },
  'Sikkim': { lat: 27.5330, lng: 88.5122 }, 'Tamil Nadu': { lat: 11.1271, lng: 78.6569 }, 'Telangana': { lat: 18.1124, lng: 79.0193 },
  'Tripura': { lat: 23.9408, lng: 91.9882 }, 'Uttar Pradesh': { lat: 26.8467, lng: 80.9462 }, 'Uttarakhand': { lat: 30.0668, lng: 79.0193 },
  'West Bengal': { lat: 22.9868, lng: 87.8550 }, 'Delhi': { lat: 28.7041, lng: 77.1025 },
};

export default function Dashboard({ forcedView }) {
  const navigate       = useNavigate();
  const mapRef         = useRef(null);
  const googleMapRef   = useRef(null);
  const mapCirclesRef  = useRef([]);
  const mapMarkersRef  = useRef([]);
  const mapLinesRef    = useRef([]);
  const mapInitRef     = useRef(false);

  const [issues, setIssues]         = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeIssue, setActiveIssue] = useState(null);
  const [selectedVolunteerId, setSelectedVolunteerId] = useState('');
  
  const role = localStorage.getItem('grandline_role') || 'volunteer';
  const userState = localStorage.getItem('grandline_state');

  const [viewMode, setViewMode]     = useState(forcedView || (role === 'super_admin' ? 'national' : 'state'));
  const [issueFeedTab, setIssueFeedTab] = useState('active'); // 'active' or 'past'
  const [mapLayers, setMapLayers]   = useState({ zones: true, pins: true, lines: true });
  const [filterSeverity, setFilter] = useState('all');
  const [hasNewNotif, setHasNewNotif] = useState(false);
  const [lastMission, setLastMission] = useState(null);
  const [showNotifCenter, setShowNotifCenter] = useState(false);

  // ── Jurisdictional Volunteer Filter ──────────────────────────────────────
  // State Admin: only see volunteers from their state
  // Super Admin: see all volunteers nationally
  const filteredVolunteers = role === 'state_admin'
    ? volunteers.filter(v => v.location?.state === userState)
    : volunteers;

  // ── Stats Derived ────────────────────────────────────────────────────────
  const criticalCount  = issues.filter(i => i.urgency_score >= 80).length;
  const routedCount    = issues.filter(i => i.routing_status === 'deployed').length;
  const availableVols  = filteredVolunteers.filter(v => v.status === 'available').length;

  const stateStats = issues.reduce((acc, iss) => {
    const s = iss.location?.state || 'Unknown';
    if (!acc[s]) acc[s] = { state: s, score: 0, count: 0 };
    acc[s].score += (iss.urgency_score || 0);
    acc[s].count += 1;
    return acc;
  }, {});

  const rankedStates = Object.values(stateStats)
    .map(s => ({ ...s, avgSeverity: s.count > 0 ? s.score / s.count : 0 }))
    .sort((a, b) => b.score - a.score);

  const yourStateRank = rankedStates.findIndex(s => s.state === userState) + 1;
  const top3States = rankedStates.slice(0, 3);

  // ── Firestore real-time listeners ─────────────────────────────────────────
  useEffect(() => {
    if (!db) return;
    
    // Always listen to all issues to support National View (read-only awareness)
    const q = query(collection(db, 'issues'), orderBy('urgency_score', 'desc'));

    const unsubIssues = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setIssues(data);
      setLoading(false);
      if (data.length > 0 && !activeIssue) {
        // Default select an issue in user's state if available
        const localIssue = data.find(i => i.location?.state === userState);
        setActiveIssue(localIssue || data[0]);
      }
    });

    const unsubVols = onSnapshot(collection(db, 'volunteers'), (snap) =>
      setVolunteers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    return () => { unsubIssues(); unsubVols(); };
  }, [userState, activeIssue]);

  const filteredIssues = issues.filter((issue) => {
    const matchesSeverity = filterSeverity === 'all' || issue.urgency_score >= parseInt(filterSeverity);
    const matchesState = viewMode === 'national' || issue.location?.state === userState;
    const matchesStatus = issueFeedTab === 'active' ? issue.status !== 'completed' : issue.status === 'completed';
    return matchesSeverity && matchesState && matchesStatus;
  });
  const initMap = useCallback(() => {
    if (!mapRef.current || mapInitRef.current) return;
    mapInitRef.current = true;
    googleMapRef.current = new window.google.maps.Map(mapRef.current, {
      center: INDIA_CENTER,
      zoom: 5,
      styles: MAP_DARK_STYLE,
      disableDefaultUI: true,
      backgroundColor: '#0a0e19',
      gestureHandling: 'greedy',
    });
  }, []);

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
  }, [initMap]);

  // ── Auto-center map when viewMode or userState changes ───────────────────
  useEffect(() => {
    if (!googleMapRef.current || !window.google) return;
    const map = googleMapRef.current;
    if (viewMode === 'state' && userState && STATE_CENTERS[userState]) {
      map.setCenter(STATE_CENTERS[userState]);
      map.setZoom(7);
    } else {
      map.setCenter(INDIA_CENTER);
      map.setZoom(5);
    }
  }, [viewMode, userState]);

  // ── Re-render map overlays when data or layers change ────────────────────
  useEffect(() => {
    if (!googleMapRef.current || !window.google) return;
    const map = googleMapRef.current;

    // Clear previous tactical overlays
    [...mapCirclesRef.current, ...mapMarkersRef.current, ...mapLinesRef.current]
      .forEach((o) => o?.setMap(null));
    mapMarkersRef.current = [];
    mapCirclesRef.current = [];
    mapLinesRef.current   = [];

    // ── LAYER 1: Specialist Tactical Zones ─────────────────────────────────
    if (mapLayers.zones) {
      filteredVolunteers
        .forEach((vol) => {
          if (!vol.location?.lat || !vol.location?.lng) return;
          const color = skillColor(vol.skills?.[0] || 'general');
          const circle = new window.google.maps.Circle({
            map,
            center: { lat: vol.location.lat, lng: vol.location.lng },
            radius: (vol.reach_radius_km || 50) * 1000,
            fillColor: color,
            fillOpacity: vol.status === 'available' ? 0.10 : 0.03,
            strokeColor: color,
            strokeOpacity: vol.status === 'available' ? 0.60 : 0.20,
            strokeWeight: 1.5,
          });
          mapCirclesRef.current.push(circle);
        });
    }

    // ── LAYER 2: Specialist Location Pins ──────────────────────────────────
    if (mapLayers.pins) {
      filteredVolunteers
        .forEach((vol) => {
          if (!vol.location?.lat || !vol.location?.lng) return;
          const color = skillColor(vol.skills?.[0] || 'general');
          const marker = new window.google.maps.Marker({
            map,
            position: { lat: vol.location.lat, lng: vol.location.lng },
            title: `${vol.name} — Specialist`,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: vol.status === 'available' ? 7 : 4,
              fillColor: color,
              fillOpacity: 1,
              strokeWeight: 2,
              strokeColor: '#0a0e19',
            },
            zIndex: 10,
          });
          marker.addListener('click', () => {
            toast(`${vol.name} · ${vol.skills?.[0] || 'Specialist'} · ${vol.reach_radius_km}km`, { icon: '🎯' });
          });
          mapMarkersRef.current.push(marker);
        });
    }

    // ── LAYER 3: Strategic Disaster Signals ────────────────────────────────
    if (mapLayers.pins) {
      filteredIssues.forEach((issue) => {
        if (!issue.location?.lat || !issue.location?.lng) return;
        const color = urgencyColor(issue.urgency_score || 0);
        const isPulse = issue.urgency_score >= 80;

        const pin = new window.google.maps.Marker({
          map,
          position: { lat: issue.location.lat, lng: issue.location.lng },
          title: issue.summary,
          icon: {
            path: 'M 0,-16 C -6,-16 -10,-10 -10,-5 C -10,4 0,16 0,16 C 0,16 10,4 10,-5 C 10,-10 6,-16 0,-16 Z',
            fillColor: color,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: isPulse ? 2.5 : 1,
            scale: isPulse ? 1.4 : 1.0,
            anchor: new window.google.maps.Point(0, 16),
          },
          animation: isPulse ? window.google.maps.Animation.BOUNCE : null,
          zIndex: isPulse ? 100 : 50,
        });

        pin.addListener('click', () => {
          setActiveIssue(issue);
          map.panTo({ lat: issue.location.lat, lng: issue.location.lng });
          if (isPulse) pin.setAnimation(null);
        });
        mapMarkersRef.current.push(pin);
      });
    }

    // ── LAYER 4: Operational Routing Lines ─────────────────────────────────
    if (mapLayers.lines) {
      filteredIssues.forEach((issue) => {
        if (!issue.routed_to_volunteer_id) return;
        const vol = filteredVolunteers.find((v) => v.id === issue.routed_to_volunteer_id) || volunteers.find((v) => v.id === issue.routed_to_volunteer_id);
        if (!vol?.location?.lat || !issue.location?.lat) return;

        const line = new window.google.maps.Polyline({
          map,
          path: [
            { lat: issue.location.lat, lng: issue.location.lng },
            { lat: vol.location.lat, lng: vol.location.lng },
          ],
          strokeColor: urgencyColor(issue.urgency_score),
          strokeOpacity: 0,
          strokeWeight: 1.5,
          icons: [{
            icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.7, scale: 3 },
            offset: '0',
            repeat: '12px',
          }],
          zIndex: 5,
        });
        mapLinesRef.current.push(line);
      });
    }
  }, [filteredIssues, filteredVolunteers, mapLayers, viewMode, userState]);

  // ── Stats (stale block removed — computed above with filteredVolunteers) ──

  const handleSeed = async () => {
    const loadToast = toast.loading('Synchronizing tactical infrastructure...');
    try {
      const issuesCol = collection(db, 'issues');
      const volCol = collection(db, 'volunteers');

      const VOL_DATA = [
        { name: 'Ravi Kumar', skills: ['medical', 'rescue'], location: { lat: 10.8505, lng: 76.2711, state: 'Kerala', area_name: 'Wayanad' }, status: 'active' },
        { name: 'Sneha Singh', skills: ['food', 'logistics'], location: { lat: 25.0961, lng: 85.3131, state: 'Bihar', area_name: 'Muzaffarpur' }, status: 'active' },
        { name: 'Amit Das', skills: ['rescue', 'water'], location: { lat: 20.2961, lng: 85.8245, state: 'Odisha', area_name: 'Puri' }, status: 'active' },
      ];

      const ISSUE_DATA = [
        {
          issue_type: 'flood', severity: 5, affected_count: 1200, urgency_score: 92,
          summary: 'Severe landslide and flooding — 1200 displaced in Wayanad.',
          recommended_action: 'Deploy NDRF Alpha Team and establish medical camp.',
          skills_needed: ['rescue', 'medical', 'food'], 
          location: { lat: 11.6854, lng: 76.1320, area_name: 'Wayanad', state: 'Kerala' }
        },
        {
          issue_type: 'cyclone', severity: 5, affected_count: 2500, urgency_score: 95,
          summary: 'Cyclone landfall imminent — 2500 coastal families at risk.',
          recommended_action: 'Evacuate coastal villages to storm shelters.',
          skills_needed: ['rescue', 'shelter', 'logistics'], 
          location: { lat: 19.8135, lng: 85.8312, area_name: 'Puri', state: 'Odisha' }
        }
      ];

      for (const v of VOL_DATA) await addDoc(volCol, { ...v, timestamp: serverTimestamp() });
      for (const i of ISSUE_DATA) await addDoc(issuesCol, { ...i, timestamp: serverTimestamp(), source: 'seed', status: 'new', routing_status: 'pending' });
      
      toast.success('Local Tactical Signals Initialized', { id: loadToast });
    } catch (err) {
      toast.error('Sync failed: ' + err.message, { id: loadToast });
    }
  };

  const handleDeployIssue = async (issueId, manualVolId = null) => {
    const issue = issues.find(i => i.id === issueId);
    if (!issue) return;
    
    // Choose between manual selection or AI-routed selection
    const volunteerId = manualVolId || selectedVolunteerId || issue.routed_to_volunteer_id;
    if (!volunteerId) return toast.error('Selection Protocol Mismatch: No specialist chosen.');

    const volunteer = volunteers.find(v => v.id === volunteerId);

    try {
      // 1. Update Core Tactical Status
      await updateDoc(doc(db, 'issues', issueId), { 
        status: 'assigned',
        routing_status: 'deployed',
        routed_to_volunteer_id: volunteerId // Commit manual override
      });

      // 2. Transmit Assignment Signal to Volunteer
      await addDoc(collection(db, 'notifications'), {
        type: 'assignment',
        userId: volunteerId,
        message: `Command Deployment: You are assigned to ${issue.location?.area_name || 'sector'}`,
        issueId: issue.id,
        read: false,
        createdAt: serverTimestamp()
      });

      // 3. Broadcast Deployment Signal to Super Admin Audit
      await addDoc(collection(db, 'notifications'), {
        type: 'deployment',
        userId: 'super_admin_broadcaster',
        message: `Deployment Sequence Initiated in ${issue.location?.state} sector`,
        issueId: issue.id,
        read: false,
        createdAt: serverTimestamp()
      });

      // 4. Log Operational Control Room Events
      await addDoc(collection(db, 'events'), {
        type: 'deployment_triggered',
        message: `National Command: Deployment Triggered for ${issue.location?.area_name || 'sector'}`,
        state: issue.location?.state,
        userId: role,
        issueId: issue.id,
        timestamp: serverTimestamp()
      });

      await addDoc(collection(db, 'events'), {
        type: 'volunteer_assigned',
        message: `Asset Assigned: ${volunteer?.name || 'Tactical Unit'} (${volunteer?.skill || 'General'})`,
        state: issue.location?.state,
        userId: volunteerId,
        issueId: issue.id,
        timestamp: serverTimestamp()
      });

      toast.success('Mission Deployed. Global Signals Transmitted.');
      setSelectedVolunteerId('');
    } catch (err) {
      toast.error('Deployment Authorization Failed: ' + err.message);
    }
  };

  const lastNotifiedRef = useRef(new Set());
  const firstRunRef = useRef(true);

  // ── Mission Deployment Alerts ─────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;

    const deployedIds = issues
      .filter(i => i.routing_status === 'deployed')
      .map(i => i.id);

    if (firstRunRef.current) {
      deployedIds.forEach(id => lastNotifiedRef.current.add(id));
      firstRunRef.current = false;
      return;
    }

    deployedIds.forEach(id => {
      if (!lastNotifiedRef.current.has(id)) {
        const issue = issues.find(i => i.id === id);
        if (!issue) return;
        
        const volunteer = volunteers.find(v => v.id === issue.routed_to_volunteer_id);
        const sectorName = issue.location?.area_name || issue.location?.state || 'Unknown Territory';
        
        setHasNewNotif(true);
        setLastMission(`DEPLOYMENT: ${sectorName} sector authorized for ${volunteer?.name || 'Asset'}`);

        toast.custom((t) => (
          <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-[#0a0e19]/95 backdrop-blur-xl border-2 border-primary-container p-4 shadow-[0_0_50px_rgba(255,209,102,0.3)] pointer-events-auto flex flex-col relative overflow-hidden`}>
            <div className="scan-line top-0"></div>
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-primary-container animate-pulse text-xl">rocket_launch</span>
              <h4 className="font-headline font-black text-[#ffd166] text-[10px] tracking-[0.2em] uppercase">DEPLOYMENT AUTHORIZED</h4>
            </div>
            <div className="space-y-1">
              <p className="font-label text-xs text-white/90 font-bold uppercase">{sectorName} SECTOR</p>
              <p className="font-body text-[9px] text-white/40 leading-tight">
                Specialist <span className="text-secondary font-bold">{volunteer?.name || 'Tactical Asset'}</span> is now en route to intercept.
              </p>
            </div>
          </div>
        ), { duration: 5000, position: 'bottom-right' });

        lastNotifiedRef.current.add(id);
      }
    });
  }, [issues, volunteers, loading]);

  return (
    <div className="bg-background text-on-background font-body h-screen overflow-hidden dot-grid relative">
      <Sidebar />

      {/* ── Main ──────────────────────────────────────────────────────────── */}
      <main className="ml-20 md:ml-64 h-screen flex flex-col overflow-hidden">

        {/* TopBar */}
        <header className="flex items-center justify-between px-6 h-16 bg-[#0f131e]/90 backdrop-blur-xl border-b border-white/8 flex-shrink-0 z-[70]">
          <div className="flex items-center gap-6 flex-1">
            <span className="font-headline font-black text-[#ffd166] tracking-[0.3em] uppercase text-xs flex-shrink-0">Command Deck</span>
            
            {/* Dual-Map Toggle Switch */}
            {role === 'state_admin' && (
              <div className="flex items-center bg-white/5 p-1 border border-white/10 rounded-sm">
                <button 
                  type="button"
                  onClick={() => setViewMode('state')}
                  className={`px-4 py-1.5 text-[9px] font-label uppercase tracking-widest transition-all ${viewMode === 'state' ? 'bg-[#ffd166] text-[#0f131e] font-black' : 'text-white/40 hover:text-white'}`}
                >
                  Locality View
                </button>
                <button 
                  type="button"
                  onClick={() => setViewMode('national')}
                  className={`px-4 py-1.5 text-[9px] font-label uppercase tracking-widest transition-all ${viewMode === 'national' ? 'bg-[#ffd166] text-[#0f131e] font-black' : 'text-white/40 hover:text-white'}`}
                >
                  National View
                </button>
              </div>
            )}

            {/* Severity HUD */}
            <div className="hidden xl:flex items-center gap-4 border-l border-white/10 pl-6">
                <div>
                  <p className="font-label text-[7px] uppercase text-white/20 tracking-widest leading-tight">Sector Rank</p>
                  <p className="font-headline text-[10px] font-black text-secondary uppercase">Rank #{yourStateRank || 'N/A'}</p>
                </div>
                <div>
                  <p className="font-label text-[7px] uppercase text-white/20 tracking-widest leading-tight">Global Index</p>
                  <p className="font-headline text-[10px] font-black text-[#6b7280] uppercase">LVL {(rankedStates.find(s => s.state === userState)?.avgSeverity || 0).toFixed(1)}</p>
                </div>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden lg:flex items-center gap-3 text-[9px] font-label uppercase tracking-widest border-r border-white/10 pr-6">
              {[
                { key: 'zones', label: 'Zones',  color: 'bg-blue-500' },
                { key: 'pins',  label: 'Threats', color: 'bg-red-500'  },
                { key: 'lines', label: 'Routes', color: 'bg-yellow-500' },
              ].map(({ key, label, color }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMapLayers((p) => ({ ...p, [key]: !p[key] }))}
                  className={`flex items-center gap-1.5 px-2 py-1 transition-all ${mapLayers[key] ? 'text-white' : 'text-white/20'}`}
                >
                  <span className={`w-2 h-2 rounded-full ${mapLayers[key] ? color : 'bg-white/20'}`}></span>
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4">
              {role === 'state_admin' && (
                <div className="hidden lg:flex flex-col items-end mr-2">
                  <span className="font-label text-[7px] text-white/20 uppercase tracking-[0.2em]">Jurisdictional Lead</span>
                  <span className="font-label text-[8px] text-[#ffd166] uppercase tracking-widest font-bold">{userState} Sector</span>
                </div>
              )}
              <NotificationBell />
              
              <select
                value={filterSeverity}
                onChange={(e) => setFilter(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-none text-[9px] text-white/60 font-label uppercase tracking-wider focus:ring-1 focus:ring-[#ffd166]/50 py-1 px-3"
              >
                <option value="all" className="bg-[#0f131e]">Severity Filter</option>
                <option value="40" className="bg-[#0f131e]">LOW+</option>
                <option value="60" className="bg-[#0f131e]">MED+</option>
                <option value="80" className="bg-[#0f131e]">HIGH Only</option>
              </select>
            </div>
          </div>
        </header>

        {/* Stats Bar — Global Command HUD */}
        <div className="grid grid-cols-2 md:grid-cols-4 border-b border-white/5 flex-shrink-0 bg-white/[0.02]">
           {[
             { label: 'Active Signals', value: issues.length, icon: 'radar', color: 'text-[#ffd166]' },
             { label: 'Critical Ops', value: criticalCount, icon: 'emergency', color: 'text-[#ef4444]' },
             { label: 'Deployed Assets', value: routedCount, icon: 'rocket_launch', color: 'text-secondary' },
             { label: 'Specialist Readiness', value: availableVols, icon: 'diversity_3', color: 'text-primary-container' },
           ].map(({ label, value, icon, color }) => (
             <div key={label} className="p-4 border-r border-white/5 last:border-0 flex items-center gap-4 transition-all hover:bg-white/[0.01]">
                <span className={`material-symbols-outlined ${color} text-xl animate-pulse`}>{icon}</span>
                <div>
                   <div className={`font-headline text-xl font-black ${color} leading-none`}>{loading ? '—' : value}</div>
                   <div className="font-label text-[7px] uppercase tracking-[0.2em] text-white/20 mt-1">{label}</div>
                </div>
             </div>
           ))}
        </div>

        {/* 3-Column Grid */}
        <div className="flex-1 grid grid-cols-12 overflow-hidden">

          {/* LEFT: Issue Intelligence Feed */}
          <aside className="col-span-12 lg:col-span-3 flex flex-col border-r border-white/5 overflow-hidden bg-[#0d121f]">
            <div className="px-4 py-3 flex flex-col gap-4 border-b border-white/5">
              
               {/* National Lead Board — ONLY for global context */}
               {viewMode === 'national' && (
                 <div className="bg-[#ffd166]/5 border border-[#ffd166]/20 p-4 mb-1 slide-down relative group overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-[#ffd166]/5 rounded-bl-full -mr-8 -mt-8 transition-all group-hover:scale-110"></div>
                    <p className="font-label text-[8px] uppercase tracking-[0.2em] text-[#ffd166] mb-3 flex items-center gap-2">
                       <span className="material-symbols-outlined text-xs">leaderboard</span>
                       National Criticality Index
                    </p>
                    <div className="space-y-2.5">
                       {top3States.length > 0 ? top3States.map((s, idx) => (
                         <div key={s.state} className="flex justify-between items-center text-[10px]">
                            <span className="font-label text-white/60 uppercase tracking-tighter">0{idx+1}. {s.state}</span>
                            <span className={`font-headline font-black ${idx === 0 ? 'text-[#ef4444]' : 'text-[#f97316]'}`}>{s.score} URNCY</span>
                         </div>
                       )) : (
                         <p className="text-[9px] font-label text-white/20 italic">Scanning national sectors...</p>
                       )}
                    </div>
                 </div>
               )}

              <div className="flex items-center justify-between">
                <span className="font-headline text-[10px] tracking-widest uppercase text-primary/60 flex items-center gap-2">
                   <span className="w-1 h-1 bg-secondary rounded-full animate-pulse"></span>
                   {viewMode === 'national' ? 'National Overlook' : 'Sector Intelligence'}
                </span>
                <span className="font-label text-[9px] text-white/20">{issues.filter(i => (viewMode === 'national' || i.location?.state === userState) && i.status !== 'completed').length} active</span>
              </div>

              {/* Tab Selector */}
              <div className="flex bg-black/40 p-1 border border-white/5 mx-4">
                 <button 
                   onClick={() => setIssueFeedTab('active')}
                   className={`flex-1 py-1.5 text-[8px] font-label uppercase tracking-widest transition-all ${issueFeedTab === 'active' ? 'bg-[#ffd166] text-[#0f131e] font-black' : 'text-white/30 hover:text-white'}`}
                 >
                   Active Signals
                 </button>
                 <button 
                   onClick={() => setIssueFeedTab('past')}
                   className={`flex-1 py-1.5 text-[8px] font-label uppercase tracking-widest transition-all ${issueFeedTab === 'past' ? 'bg-secondary text-[#0f131e] font-black' : 'text-white/30 hover:text-white'}`}
                 >
                   Resolved Archives
                 </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <span className="material-symbols-outlined text-primary/20 text-4xl animate-pulse">radar</span>
                </div>
              ) : filteredIssues.length === 0 ? (
                <div className="p-6 text-center">
                  <span className="material-symbols-outlined text-white/10 text-5xl">public</span>
                  <p className="font-headline text-xs text-white/20 uppercase mt-2">No signals in grid</p>
                </div>
              ) : (
                filteredIssues.map((issue) => (
                  <button
                    key={issue.id}
                    onClick={() => {
                      setActiveIssue(issue);
                      if (googleMapRef.current && issue.location?.lat) {
                        googleMapRef.current.panTo({ lat: issue.location.lat, lng: issue.location.lng });
                        googleMapRef.current.setZoom(8);
                      }
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-all group ${activeIssue?.id === issue.id ? 'bg-white/5 border-l-2 border-l-primary-container' : 'border-l-2 border-l-transparent'}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-xs" style={{ color: urgencyColor(issue.urgency_score) }}>
                          {TYPE_ICONS[issue.issue_type] || 'warning'}
                        </span>
                        <span className="font-headline text-[10px] text-on-surface uppercase tracking-tight line-clamp-1">
                          {issue.location?.area_name || 'Unknown'}
                        </span>
                      </div>
                      <span className="font-headline font-black text-xs flex-shrink-0"
                        style={{ color: urgencyColor(issue.urgency_score) }}>
                        {issue.urgency_score}
                      </span>
                    </div>
                    <p className="font-body text-[9px] text-white/40 leading-snug line-clamp-2">{issue.summary}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-[8px] font-label uppercase tracking-widest px-1.5 py-0.5 ${
                        issue.routing_status === 'routed' ? 'bg-secondary/10 text-secondary' :
                        issue.routing_status === 'deployed' ? 'bg-primary-container/10 text-primary-container' :
                        issue.escalated ? 'bg-error/10 text-error' : 'bg-white/5 text-white/30'
                      }`}>
                        {issue.escalated && issue.routing_status !== 'deployed' ? 'Escalated' : issue.routing_status || 'Pending'}
                      </span>
                      <span className="text-[8px] font-label text-white/20">{issue.location?.state}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          {/* CENTER: Tactical Map */}
          <section className="col-span-12 lg:col-span-6 relative overflow-hidden">
            <div ref={mapRef} className="absolute inset-0 z-0" />
            {!MAPS_API_KEY && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-container-lowest z-10">
                <span className="material-symbols-outlined text-primary/20 text-5xl">map</span>
                <p className="font-headline text-xs text-white/20 uppercase mt-3">Map requires VITE_GOOGLE_MAPS_API_KEY</p>
              </div>
            )}
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5 pointer-events-none">
              <div className="bg-background/80 backdrop-blur px-3 py-1.5 flex items-center gap-2 border border-white/5">
                <span className="w-1.5 h-1.5 bg-on-tertiary-container rounded-full animate-pulse"></span>
                <span className="font-label text-[9px] text-white/60 uppercase tracking-widest">{criticalCount} Critical Active</span>
              </div>
              <div className="bg-background/80 backdrop-blur px-3 py-1.5 flex items-center gap-2 border border-white/5">
                <span className="w-1.5 h-1.5 bg-secondary rounded-full"></span>
                <span className="font-label text-[9px] text-white/60 uppercase tracking-widest">{filteredVolunteers.length} Volunteer Zones</span>
              </div>
            </div>
            <div className="absolute bottom-4 left-4 z-10 bg-background/80 backdrop-blur p-3 border border-white/5 pointer-events-none">
              <p className="font-label text-[8px] text-white/30 uppercase tracking-widest mb-2">Skill Legend</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {Object.entries(SKILL_COLORS).map(([skill, color]) => (
                  <div key={skill} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }}></span>
                    <span className="font-label text-[8px] text-white/40 uppercase">{skill}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* RIGHT: Active Issue Detail + Routing */}
          <aside className="col-span-12 lg:col-span-3 flex flex-col border-l border-white/5 overflow-hidden">
            {activeIssue ? (
              <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
                <div className={`p-5 border-b border-white/5 relative overflow-hidden ${activeIssue.urgency_score >= 80 ? 'border-t-2 border-t-on-tertiary-container' : 'border-t-2 border-t-primary-container'}`}>
                  <div className="scan-line top-0"></div>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[9px] font-label font-bold uppercase px-2 py-0.5 ${activeIssue.urgency_score >= 80 ? 'bg-error-container text-on-error-container' : 'bg-primary-container/20 text-primary-container'}`}>
                          {activeIssue.urgency_score >= 80 ? 'CRITICAL' : activeIssue.urgency_score >= 60 ? 'HIGH' : 'MODERATE'}
                        </span>
                        <span className="font-label text-[8px] text-white/20 uppercase">{activeIssue.issue_type}</span>
                      </div>
                      <h3 className="font-headline text-base font-bold text-on-surface uppercase leading-tight">
                        {activeIssue.location?.area_name || 'Unknown Area'}
                      </h3>
                      <p className="font-label text-[9px] text-white/40 mt-0.5">{activeIssue.location?.district}, {activeIssue.location?.state}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-headline font-black text-3xl" style={{ color: urgencyColor(activeIssue.urgency_score) }}>
                        {activeIssue.urgency_score}
                      </span>
                      <p className="font-label text-[7px] text-white/20 uppercase">score</p>
                    </div>
                  </div>
                  <p className="font-body text-xs text-on-surface-variant leading-relaxed italic">
                    "{activeIssue.summary}"
                  </p>
                </div>

                <div className="grid grid-cols-2 border-b border-white/5">
                  {[
                    { label: 'Affected',  value: (activeIssue.affected_count || 0).toLocaleString(), icon: 'group' },
                    { label: 'Severity',  value: `${activeIssue.severity}/5`,  icon: 'emergency' },
                  ].map(({ label, value, icon }) => (
                    <div key={label} className="px-4 py-3 border-b border-r border-white/5 last:border-r-0">
                      <span className="material-symbols-outlined text-xs text-primary/30 block mb-1">{icon}</span>
                      <div className="font-headline text-sm font-bold text-on-surface">{value}</div>
                      <div className="font-label text-[8px] text-white/20 uppercase mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>

                <div className="p-4 border-b border-white/5 space-y-3">
                  <p className="font-label text-[9px] uppercase tracking-widest text-white/30">Force Deployment</p>
                  
                  {/* Manual Volunteer Selector for State Admin - DISABLED in National View */}
                  {(role === 'state_admin' || role === 'super_admin') && activeIssue.status === 'pending' && (
                    <div className="space-y-2">
                       <label className="font-label text-[8px] uppercase text-white/20 ml-1">Assign Combat Specialist</label>
                       <select 
                         disabled={viewMode === 'national'}
                         value={selectedVolunteerId}
                         onChange={e => setSelectedVolunteerId(e.target.value)}
                         className={`w-full bg-white/5 border border-white/10 p-3 text-[10px] font-label uppercase tracking-widest outline-none transition-all ${viewMode === 'national' ? 'opacity-30 cursor-not-allowed text-white/20' : 'text-[#ffd166] focus:border-[#ffd166]/50'}`}
                       >
                         <option value="">AI Choice: {filteredVolunteers.find(v => v.id === activeIssue.routed_to_volunteer_id)?.name || volunteers.find(v => v.id === activeIssue.routed_to_volunteer_id)?.name || 'Auto'}</option>
                         <optgroup label="Available in Sector" className="bg-[#0f131e]">
                            {filteredVolunteers
                              .filter(v => v.status === 'available')
                              .map(v => <option key={v.id} value={v.id}>{v.name} ({v.skills?.[0]})</option>)
                            }
                         </optgroup>
                       </select>
                       {viewMode === 'national' && (
                         <div className="px-1 text-[7px] font-label uppercase text-[#ffd166]/40 tracking-widest italic animate-pulse">
                            Jurisdictional Warning: National View is Read-Only
                         </div>
                       )}
                    </div>
                  )}

                  {activeIssue.status !== 'pending' && activeIssue.routed_to_volunteer_id ? (
                    <div>
                      {(() => {
                        const vol = filteredVolunteers.find(v => v.id === activeIssue.routed_to_volunteer_id) || volunteers.find(v => v.id === activeIssue.routed_to_volunteer_id);
                        return vol ? (
                          <div className="bg-secondary/5 border border-secondary/20 p-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-secondary text-sm">route</span>
                              <span className="font-headline text-xs font-bold text-secondary uppercase">{vol.name}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[9px] font-label text-white/40">
                              <span>District: {vol.location?.district || 'Sector-1'}</span>
                              <span className="text-secondary uppercase">{activeIssue.status}</span>
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  ) : activeIssue.status === 'pending' && !selectedVolunteerId && (
                    <div className="flex items-center gap-2 text-white/20">
                      <span className="material-symbols-outlined text-sm animate-pulse">pending</span>
                      <span className="font-label text-[9px] uppercase">Reviewing Local Force Strength...</span>
                    </div>
                  )}
                </div>

                <div className="p-4 border-b border-white/5">
                  <p className="font-label text-[9px] uppercase tracking-widest text-primary-container/50 mb-2">Tactical Action</p>
                  <p className="font-body text-xs text-primary/80 italic leading-relaxed">{activeIssue.recommended_action}</p>
                </div>

                {(role === 'state_admin' || role === 'super_admin') && activeIssue.status === 'pending' && (
                  <div className="p-4">
                    <button
                      disabled={viewMode === 'national'}
                      onClick={() => handleDeployIssue(activeIssue.id)}
                      className={`w-full font-headline font-black py-4 text-xs tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-2 ${viewMode === 'national' ? 'bg-white/5 text-white/10 cursor-not-allowed border border-white/5' : 'bg-primary-container text-on-primary-container hover:shadow-[0_0_30px_rgba(255,209,102,0.4)]'}`}
                    >
                      <span className="material-symbols-outlined text-base">rocket_launch</span>
                      {viewMode === 'national' ? 'Global Overwatch Active' : 'Deploy Response'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-20">
                <span className="material-symbols-outlined text-5xl">touch_app</span>
                <p className="font-headline text-xs uppercase mt-3 text-white">Select a signal<br/>from the feed</p>
              </div>
            )}
          </aside>
        </div>
      </main>

      {/* ── Notification Center Sidebar ───────────────────────────────────── */}
      <aside className={`fixed right-0 top-0 h-full w-80 bg-[#0f131e]/95 backdrop-blur-2xl border-l border-white/10 z-[70] transition-transform duration-500 shadow-[-20px_0_60px_rgba(0,0,0,0.8)] ${showNotifCenter ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <header className="p-6 border-b border-white/5 flex items-center justify-between relative overflow-hidden">
            <div className="scan-line top-0 opacity-10"></div>
            <div>
              <h2 className="font-headline text-sm font-black text-[#ffd166] tracking-[0.2em] uppercase">Intelligence Audit</h2>
              <p className="font-label text-[8px] text-white/20 uppercase tracking-widest mt-1">Tactical History // Logs</p>
            </div>
            <button onClick={() => setShowNotifCenter(false)} className="text-white/20 hover:text-white transition-colors">
              <span className="material-symbols-outlined">close</span>
            </button>
          </header>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
            {issues.filter(i => i.routing_status === 'deployed').length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 opacity-20 text-white">
                <span className="material-symbols-outlined text-4xl mb-2">history</span>
                <p className="font-label text-[9px] uppercase">No active deployments</p>
              </div>
            ) : (
              issues.filter(i => i.routing_status === 'deployed').map(issue => {
                const vol = volunteers.find(v => v.id === issue.routed_to_volunteer_id);
                return (
                  <div key={issue.id} className="bg-white/2 border border-white/5 p-4 space-y-2 relative group hover:border-[#ffd166]/20 transition-all">
                    <div className="flex justify-between items-start">
                      <span className="font-label text-[8px] text-secondary uppercase tracking-widest font-black">Mission Authorized</span>
                      <span className="font-label text-[7px] text-white/10 uppercase">ID: {issue.id.slice(0,6)}</span>
                    </div>
                    <div>
                      <h4 className="font-headline text-xs font-bold text-white uppercase">{issue.location?.area_name || 'Sector'}</h4>
                      <p className="font-body text-[9px] text-white/40 mt-1">{issue.summary}</p>
                    </div>
                    <div className="pt-2 flex items-center gap-2">
                       <div className="w-1.5 h-1.5 bg-primary-container rounded-full animate-pulse"></div>
                       <span className="font-label text-[8px] text-primary-container uppercase tracking-widest">
                         Deployed to: <span className="text-white">{vol?.name || 'Local Asset'}</span>
                       </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          <footer className="p-4 bg-white/2 border-t border-white/5">
             <button 
               onClick={() => setShowNotifCenter(false)}
               className="w-full py-3 bg-white/5 border border-white/10 font-label text-[9px] uppercase tracking-[0.2em] text-white/40 hover:text-white hover:bg-white/10 transition-all"
             >
               Return to Bridge
             </button>
          </footer>
        </div>
      </aside>
    </div>
  );
}
