import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection, onSnapshot, query, orderBy, where,
  doc, updateDoc, addDoc, deleteDoc, serverTimestamp, getDoc,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import toast from 'react-hot-toast';
import Sidebar from '../components/Sidebar.jsx';
import NotificationBell from '../components/NotificationBell.jsx';
import BroadcastReceiver from '../components/BroadcastReceiver.jsx';
import { useLanguage } from '../utils/i18n.jsx';

// ── Constants ────────────────────────────────────────────────────────────────
const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 };

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

const MAP_STYLE = [
  { elementType:'geometry', stylers:[{ color:'#070c18' }] },
  { elementType:'labels.text.fill', stylers:[{ color:'#4a5568' }] },
  { elementType:'labels.text.stroke', stylers:[{ color:'#070c18' }] },
  { featureType:'administrative.country', elementType:'geometry.stroke', stylers:[{ color:'#ffd166' },{ weight:1 },{ opacity:0.4 }] },
  { featureType:'administrative.province', elementType:'geometry.stroke', stylers:[{ color:'#ffd16640' },{ weight:0.6 }] },
  { featureType:'road', stylers:[{ visibility:'off' }] },
  { featureType:'poi', stylers:[{ visibility:'off' }] },
  { featureType:'water', elementType:'geometry', stylers:[{ color:'#0a1628' }] },
  { featureType:'landscape', elementType:'geometry', stylers:[{ color:'#080e1c' }] },
];

const SKILLS = ['medical','rescue','food','logistics','shelter','water','counselling','general'];
const SKILL_COLORS = {
  medical:'#ef4444', rescue:'#f97316', food:'#22c55e',
  logistics:'#3b82f6', shelter:'#8b5cf6', water:'#06b6d4',
  counselling:'#ec4899', general:'#6b7280',
};
const urgencyColor = s => s >= 80 ? '#ef4444' : s >= 60 ? '#f97316' : s >= 40 ? '#eab308' : '#22c55e';

const STATUS_META = {
  pending:     { label:'Pending',     color:'text-orange-400', bg:'bg-orange-500/10', border:'border-orange-500/20' },
  assigned:    { label:'Assigned',    color:'text-blue-400',   bg:'bg-blue-500/10',   border:'border-blue-500/20'   },
  in_progress: { label:'In Progress', color:'text-[#ffd166]',  bg:'bg-[#ffd166]/10',  border:'border-[#ffd166]/20'  },
  completed:   { label:'Completed',   color:'text-green-400',  bg:'bg-green-500/10',  border:'border-green-500/20'  },
};

// ── Reusable tiny components ─────────────────────────────────────────────────
function Badge({ status }) {
  const m = STATUS_META[status] || STATUS_META.pending;
  return (
    <span className={`font-label text-[7px] uppercase tracking-widest font-black px-2 py-1 border ${m.color} ${m.bg} ${m.border}`}>
      {m.label}
    </span>
  );
}

function SkillDot({ skill }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: SKILL_COLORS[skill] || '#6b7280' }} />
      <span className="font-label text-[8px] uppercase text-white/50">{skill}</span>
    </span>
  );
}

function SectionHeader({ icon, title, count, action }) {
  return (
    <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-on-surface/5">
      <div className="flex items-center gap-2">
        <span className={`material-symbols-outlined text-sm ${action ? 'text-primary' : 'text-white/40'}`}>{icon}</span>
        <span className="font-label text-[9px] uppercase tracking-widest font-black text-on-surface/70">{title}</span>
        {count !== undefined && (
          <span className="font-headline text-[9px] font-black text-[#ffd166] bg-[#ffd166]/10 px-1.5 py-0.5">{count}</span>
        )}
      </div>
      {action}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function StateAdminDashboard() {
  const { t } = useLanguage();
  const userState = localStorage.getItem('grandline_state') || 'N/A';
  const userId    = localStorage.getItem('grandline_uid')   || 'state_admin';

  // ── State ──────────────────────────────────────────────────────────────────
  const [issues,     setIssues]     = useState([]);
  const [volunteers, setVols]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [viewMode,   setViewMode]   = useState('state');   // 'state' | 'national'
  const [severityFilter, setFilter] = useState('all');     // 'all' | 'critical' | 'high' | 'medium'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'assigned' | 'completed'
  const [issueFeedTab, setIssueFeedTab] = useState('active'); // 'active' | 'past'
  const [activeIssue,    setActiveIssue]    = useState(null);
  const [selectedVolId,  setSelectedVolId]  = useState('');
  const [rightTab,       setRightTab]       = useState('deploy');  // 'deploy' | 'volunteers'
  const [showAddVol,     setShowAddVol]     = useState(false);
  const [editVol,        setEditVol]        = useState(null);
  const [deploying,      setDeploying]      = useState(false);
  const [assistanceRequests, setAssistanceRequests] = useState([]);
  const [showRequestHelp,   setShowRequestHelp]   = useState(false);
  const [requestTarget,     setRequestTarget]     = useState({ reason: '' });

  // Add volunteer form
  const [volForm, setVolForm] = useState({ name:'', phone:'', skill:'rescue', district:'' });

  // Map refs
  const mapRef       = useRef(null);
  const googleMapRef = useRef(null);
  const markersRef   = useRef([]);
  const circlesRef   = useRef([]);
  const mapReadyRef  = useRef(false);

  // ── Firestore Listeners ───────────────────────────────────────────────────
  useEffect(() => {
    if (!db) return;
    let isMounted = true;
    const q = query(collection(db, 'issues'), orderBy('urgency_score', 'desc'));
    const unsub = onSnapshot(q, snap => {
      if (!isMounted) return;
      setIssues(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => { isMounted = false; unsub(); };
  }, []);

  useEffect(() => {
    if (!db) return;
    let isMounted = true;
    const unsub = onSnapshot(collection(db, 'volunteers'), snap => {
      if (!isMounted) return;
      setVols(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { isMounted = false; unsub(); };
  }, []);

  useEffect(() => {
    if (!db) return;
    let isMounted = true;
    const unsub = onSnapshot(collection(db, 'assistance_requests'), snap => {
      if (!isMounted) return;
      setAssistanceRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { isMounted = false; unsub(); };
  }, []);

  // ── Derived Data ──────────────────────────────────────────────────────────
  // Strict jurisdictional filter
  const assistanceAcceptedIssueIds = assistanceRequests
    .filter(req => req.targetState === userState && req.status === 'accepted')
    .map(req => req.issueId);

  const stateIssues = issues.filter(i =>
    viewMode === 'national' ? true : (i.location?.state === userState || assistanceAcceptedIssueIds.includes(i.id))
  );

  const activeIssuesCount = stateIssues.filter(i => i.status !== 'completed').length;

  const displayIssues = stateIssues.filter(i => {
    const sev = i.urgency_score || 0;
    const matchSev =
      severityFilter === 'all'      ? true :
      severityFilter === 'critical' ? sev >= 80 :
      severityFilter === 'high'     ? (sev >= 60 && sev < 80) :
      severityFilter === 'medium'   ? (sev >= 40 && sev < 60) : true;
    
    // If 'active' tab, exclude completed. If 'past' tab, specifically look for completed.
    const matchStatus = statusFilter === 'all' 
      ? (issueFeedTab === 'past' ? true : i.status !== 'completed')
      : i.status === statusFilter;
      
    // New tab logic
    const matchTab = issueFeedTab === 'active' ? i.status !== 'completed' : i.status === 'completed';
      
    return matchSev && matchStatus && matchTab;
  });

  // Only show state volunteers — ALWAYS
  const stateVols    = volunteers.filter(v => v.location?.state === userState || v.state === userState);
  const availableVols = stateVols.filter(v => v.status === 'available');

  const stats = {
    total:    stateIssues.length,
    critical: stateIssues.filter(i => i.urgency_score >= 80).length,
    pending:  stateIssues.filter(i => i.status === 'pending').length,
    deployed: stateIssues.filter(i => i.routing_status === 'deployed').length,
    vols:     stateVols.length,
    available:availableVols.length,
  };

  // ── Map ───────────────────────────────────────────────────────────────────
  const initMap = useCallback(() => {
    if (mapReadyRef.current || !mapRef.current || !window.google?.maps) return;
    mapReadyRef.current = true;
    const center = viewMode === 'state'
      ? (STATE_CENTERS[userState] || INDIA_CENTER)
      : INDIA_CENTER;
    const zoom = viewMode === 'state' ? 7 : 5;
    
    try {
      googleMapRef.current = new window.google.maps.Map(mapRef.current, {
        center, zoom,
        styles: MAP_STYLE, disableDefaultUI: true, backgroundColor: '#070c18',
        gestureHandling: 'cooperative'
      });
    } catch (err) {
      console.error("StateAdminDashboard: Map init failed:", err);
      mapReadyRef.current = false;
    }
  }, [viewMode, userState]);

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

  // Recenter when viewMode changes
  useEffect(() => {
    if (!googleMapRef.current || !window.google) return;
    const map = googleMapRef.current;
    if (viewMode === 'state' && STATE_CENTERS[userState]) {
      map.setCenter(STATE_CENTERS[userState]); map.setZoom(7);
    } else { map.setCenter(INDIA_CENTER); map.setZoom(5); }
  }, [viewMode, userState]);

  // Render markers
  useEffect(() => {
    if (!googleMapRef.current || !window.google?.maps?.Marker) return;
    
    // Cleanup
    [...markersRef.current, ...circlesRef.current].forEach(m => {
      if (m && typeof m.setMap === 'function') m.setMap(null);
    });
    markersRef.current = []; circlesRef.current = [];

    const map = googleMapRef.current;
    const issuePool = viewMode === 'state'
      ? issues.filter(i => i.location?.state === userState)
      : issues;

    issuePool.forEach(issue => {
      if (!issue.location?.lat || !issue.location?.lng) return;
      const isCrit = issue.urgency_score >= 80;
      try {
        const pin = new window.google.maps.Marker({
          position: { lat: issue.location.lat, lng: issue.location.lng },
          map, title: issue.summary || '',
          icon: {
            path: 'M0,-12 C-5,-12 -8,-7 -8,-3 C-8,5 0,12 0,12 C0,12 8,5 8,-3 C8,-7 5,-12 0,-12 Z',
            fillColor: urgencyColor(issue.urgency_score || 0),
            fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: isCrit ? 2 : 0.5,
            scale: isCrit ? 1.5 : 1.1, anchor: new window.google.maps.Point(0, 12),
          },
          animation: (isCrit && window.google.maps.Animation) ? window.google.maps.Animation.BOUNCE : null,
          zIndex: isCrit ? 100 : 30,
        });
        pin.addListener('click', () => {
          if (viewMode === 'national') return toast('National view is read-only. Switch to State View.', { icon: '🔒' });
          setActiveIssue(issue); setRightTab('deploy');
          pin.setAnimation(null);
          map.panTo({ lat: issue.location.lat, lng: issue.location.lng });
        });
        markersRef.current.push(pin);
      } catch (err) {
        console.warn("Marker creation failed:", err);
      }
    });

    // Volunteer circles (state view only)
    if (viewMode === 'state') {
      stateVols.forEach(vol => {
        if (!vol.location?.lat || !vol.location?.lng) return;
        try {
          const c = new window.google.maps.Circle({
            map, center: { lat: vol.location.lat, lng: vol.location.lng },
            radius: 30000,
            fillColor: SKILL_COLORS[vol.skills?.[0] || vol.skill] || '#6b7280',
            fillOpacity: vol.status === 'available' ? 0.08 : 0.02,
            strokeColor: SKILL_COLORS[vol.skills?.[0] || vol.skill] || '#6b7280',
            strokeOpacity: vol.status === 'available' ? 0.5 : 0.15,
            strokeWeight: 1,
          });
          circlesRef.current.push(c);
        } catch (err) {
          console.warn("Circle creation failed:", err);
        }
      });
    }
    // ── Inter-state Request Lines ──────────────────────────────────────────
    assistanceRequests.forEach(req => {
      if (req.status === 'rejected' || !window.google?.maps?.Polyline) return;
      
      let from, to;
      if (req.status === 'pending') {
        from = STATE_CENTERS[req.fromState];
        to   = INDIA_CENTER; // Flows to HQ
      } else {
        from = STATE_CENTERS[req.fromState];
        to   = STATE_CENTERS[req.targetState];
      }
      
      if (!from || !to) return;

      const isAccepted = req.status === 'accepted';
      const isForwarded = req.status === 'forwarded';
      
      try {
        const line = new window.google.maps.Polyline({
          map,
          path: [from, to],
          strokeColor: isAccepted ? '#22c55e' : isForwarded ? '#3b82f6' : '#ffd166',
          strokeOpacity: 0.8,
          strokeWeight: 2,
          icons: [{
            icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.5, scale: 2 },
            offset: '0',
            repeat: '10px'
          }],
          zIndex: 5
        });
        circlesRef.current.push(line);
      } catch (err) {
        console.warn("Polyline creation failed:", err);
      }
    });

  }, [issues, stateVols, viewMode, userState, assistanceRequests]);

  // ── Assistance Logic ─────────────────────────────────────────────────────
  const handleCreateRequest = async () => {
    if (!activeIssue || !requestTarget.reason) return toast.error('Incomplete request details.');
    const t = toast.loading('Uplinking to National Command...');
    try {
      await addDoc(collection(db, 'assistance_requests'), {
        fromState: userState,
        issueId: activeIssue.id,
        reason: requestTarget.reason,
        status: 'pending',
        targetState: null,
        createdBy: userId,
        createdAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'notifications'), {
        type: 'request',
        userId: 'super_admin',
        message: `INCIDENT ESCALATION: Assistance requested by ${userState}`,
        read: false,
        createdAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'events'), {
        type: 'request_created',
        message: `Assistance request uplinked to HQ: ${userState} awaiting routing`,
        fromState: userState,
        issueId: activeIssue.id,
        timestamp: serverTimestamp(),
      });

      toast.success('Request Submitted to HQ.', { id: t });
      setShowRequestHelp(false);
    } catch (err) { toast.error(err.message, { id: t }); }
  };

  const handleRespondRequest = async (req, response) => {
    const t = toast.loading('Transmitting response...');
    try {
      await updateDoc(doc(db, 'assistance_requests', req.id), {
        status: response,
        acceptedBy: userId,
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'notifications'), {
        type: 'response',
        userId: `admin_${req.fromState}`,
        message: `PROTOCOL UPDATE: ${userState} ${response} your assistance request.`,
        requestId: req.id,
        read: false,
        createdAt: serverTimestamp(),
      });

      await addDoc(collection(db, 'events'), {
        type: response === 'accepted' ? 'request_accepted' : 'request_rejected',
        message: `Assistance ${response}: ${userState} response to ${req.fromState}`,
        fromState: req.fromState,
        toState: userState,
        issueId: req.issueId,
        timestamp: serverTimestamp(),
      });

      toast.success(`Request ${response}.`, { id: t });
    } catch (err) { toast.error(err.message, { id: t }); }
  };

  // ── Deploy Flow ───────────────────────────────────────────────────────────
  const handleDeploy = async () => {
    const hasAcceptedRequest = assistanceRequests.some(req => 
      req.issueId === activeIssue.id && 
      req.targetState === userState && 
      req.status === 'accepted'
    );

    if (activeIssue.location?.state !== userState && !hasAcceptedRequest)
      return toast.error(`Cross-state action blocked. Issue belongs to ${activeIssue.location?.state}.`);

    const volId = selectedVolId || activeIssue.routed_to_volunteer_id;
    if (!volId) return toast.error('No volunteer selected. Choose from the list.');

    const vol = volunteers.find(v => v.id === volId);
    if (!vol) return toast.error('Volunteer not found.');

    setDeploying(true);
    const t = toast.loading('Authorizing deployment...');
    try {
      // 1. Update issue
      await updateDoc(doc(db, 'issues', activeIssue.id), {
        status: 'assigned',
        routing_status: 'deployed',
        routed_to_volunteer_id: volId,
        assigned_at: serverTimestamp(),
      });

      // 2. Mark volunteer as assigned
      await updateDoc(doc(db, 'volunteers', volId), { status: 'assigned' });

      // 3. Volunteer notification
      await addDoc(collection(db, 'notifications'), {
        type: 'assignment', userId: volId,
        message: `DEPLOYMENT ORDER: Respond to ${activeIssue.location?.area_name || activeIssue.location?.state}`,
        issueId: activeIssue.id, read: false, createdAt: serverTimestamp(),
      });

      // 4. Super Admin broadcast
      await addDoc(collection(db, 'notifications'), {
        type: 'deployment', userId: 'super_admin_broadcaster',
        message: `Deployment triggered in ${userState}: ${vol.name} → ${activeIssue.location?.area_name || 'sector'}`,
        issueId: activeIssue.id, read: false, createdAt: serverTimestamp(),
      });

      // 5. Event log
      await addDoc(collection(db, 'events'), {
        type: 'deployment_triggered',
        message: `${userState} CMD: ${vol.name} deployed to ${activeIssue.location?.area_name || 'sector'}`,
        state: userState, userId, issueId: activeIssue.id, timestamp: serverTimestamp(),
      });
      await addDoc(collection(db, 'events'), {
        type: 'volunteer_assigned',
        message: `Asset ${vol.name} (${vol.skills?.[0] || vol.skill || 'specialist'}) assigned`,
        state: userState, userId: volId, issueId: activeIssue.id, timestamp: serverTimestamp(),
      });

      toast.success(`Deployed: ${vol.name} → ${activeIssue.location?.area_name || 'sector'}`, { id: t });
      setActiveIssue(null); setSelectedVolId('');
    } catch (err) {
      toast.error('Deployment failed: ' + err.message, { id: t });
    } finally {
      setDeploying(false);
    }
  };

  // ── Volunteer CRUD ────────────────────────────────────────────────────────
  const handleAddVolunteer = async (e) => {
    e.preventDefault();
    if (!volForm.name || !volForm.district) return toast.error('Name and district are required.');
    const t = toast.loading('Registering volunteer...');
    try {
      await addDoc(collection(db, 'volunteers'), {
        name: volForm.name, phone: volForm.phone,
        skills: [volForm.skill], skill: volForm.skill,
        location: { state: userState, area_name: volForm.district },
        state: userState, district: volForm.district,
        status: 'available', role: 'volunteer',
        createdAt: serverTimestamp(),
      });
      toast.success(`${volForm.name} registered.`, { id: t });
      setVolForm({ name:'', phone:'', skill:'rescue', district:'' });
      setShowAddVol(false);
    } catch (err) { toast.error(err.message, { id: t }); }
  };

  const handleUpdateVol = async (e) => {
    e.preventDefault();
    const t = toast.loading('Updating...');
    try {
      await updateDoc(doc(db, 'volunteers', editVol.id), {
        name: editVol.name, phone: editVol.phone,
        skills: [editVol.skill], skill: editVol.skill,
        district: editVol.district, status: editVol.status,
      });
      toast.success('Volunteer updated.', { id: t });
      setEditVol(null);
    } catch (err) { toast.error(err.message, { id: t }); }
  };

  const handleRemoveVol = async (volId, name) => {
    if (!window.confirm(`Remove ${name} from roster?`)) return;
    await deleteDoc(doc(db, 'volunteers', volId));
    toast.success(`${name} removed.`);
  };

  const handleToggleAvailability = async (vol) => {
    const next = vol.status === 'available' ? 'inactive' : 'available';
    await updateDoc(doc(db, 'volunteers', vol.id), { status: next });
    toast(`${vol.name}: ${next}`, { icon: next === 'available' ? '✅' : '⏸️' });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-background text-on-surface font-body h-screen overflow-hidden flex relative">
      <Sidebar />
      <BroadcastReceiver />

      <main className="flex-1 ml-20 md:ml-64 h-screen flex flex-col overflow-hidden">

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <header className="flex-shrink-0 flex items-center justify-between px-6 h-16 bg-background/95 backdrop-blur border-b border-on-surface/10 z-50 relative">
          <div className="scan-line top-0 opacity-10" />

          <div className="flex items-center gap-5">
            <div>
              <span className="font-label text-[7px] uppercase tracking-[0.5em] text-primary/50 block">Sector Command Bridge</span>
              <h1 className="font-headline text-base font-black text-on-surface tracking-tight uppercase leading-tight">
                {userState} — State Operations
              </h1>
            </div>
            {/* View mode toggle */}
            <div className="hidden md:flex items-center bg-on-surface/5 rounded-sm border border-on-surface/10 overflow-hidden">
              {[['state','location_on','Sector View'],['national','public','National View']].map(([v,icon,label]) => (
                <button key={v} type="button" onClick={() => setViewMode(v)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-[8px] font-label font-black uppercase tracking-widest transition-all
                    ${viewMode === v ? 'bg-primary text-on-primary' : 'text-on-surface/30 hover:text-on-surface'}`}>
                  <span className="material-symbols-outlined text-xs">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
            {viewMode === 'national' && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-sm animate-pulse">
                <span className="material-symbols-outlined text-red-400 text-xs">lock</span>
                <span className="font-label text-[7px] uppercase tracking-wider text-red-400 font-bold">Read-Only Mode</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <NotificationBell />
            <div className="text-right hidden sm:block">
              <span className="font-label text-[7px] text-white/20 uppercase block">Jurisdiction</span>
              <span className="font-label text-[8px] text-[#ffd166]/60 font-bold">{userState.toUpperCase()}</span>
            </div>
          </div>
        </header>

        {/* ── STATS ROW ───────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 grid grid-cols-6 border-b border-white/[0.06]">
          {[
            { label:t('stats_total_issues'),  val:stats.total,    icon:'analytics',     c:'text-white'     },
            { label:t('stats_critical'),      val:stats.critical, icon:'emergency',     c:'text-red-400'   },
            { label:t('stats_pending'),       val:stats.pending,  icon:'hourglass_empty',c:'text-orange-400'},
            { label:t('stats_deployed'),      val:stats.deployed, icon:'rocket_launch', c:'text-green-400' },
            { label:t('stats_volunteers'),    val:stats.vols,     icon:'group',         c:'text-blue-400'  },
            { label:t('stats_available'), val:stats.available,icon:'check_circle',  c:'text-[#ffd166]' },
          ].map(s => (
            <div key={s.label} className="flex flex-col justify-center px-4 py-4 border-r border-white/[0.04] last:border-r-0 hover:bg-white/[0.02] cursor-default transition-all">
              <span className={`material-symbols-outlined text-sm mb-1 ${s.c}`}>{s.icon}</span>
              <p className={`font-headline text-xl font-black ${s.c} tabular-nums`}>{loading ? '—' : s.val}</p>
              <p className="font-label text-[7px] uppercase tracking-widest text-white/20 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── 3-PANEL BODY ────────────────────────────────────────────────── */}
        <div className="flex-1 grid grid-cols-12 overflow-hidden min-h-0">

          {/* ── LEFT: Issue List ─────────────────────────────────────────── */}
          <aside className="col-span-12 lg:col-span-3 border-r border-white/[0.06] flex flex-col bg-[#060b14] overflow-hidden">
            <SectionHeader icon="crisis_alert" title="Active Signals" count={activeIssuesCount} />

            {/* Incoming Requests Panel (Forwarded from HQ) */}
            <div className="flex-shrink-0 animate-in fade-in duration-500">
                <SectionHeader icon="terminal" title="Forwarded Tasks" count={assistanceRequests.filter(r => r.targetState === userState && r.status === 'forwarded').length} />
                <div className="max-h-48 overflow-y-auto border-b border-white/5 space-y-px bg-black/20">
                    {assistanceRequests.filter(r => r.targetState === userState && r.status === 'forwarded').map(req => (
                        <div key={req.id} className="p-3 bg-blue-500/5 border-b border-white/5 last:border-0">
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-label text-[8px] uppercase text-[#3b82f6] font-black">HQ Forward: {req.fromState}</span>
                                <span className="font-label text-[7px] text-white/20">#{req.issueId?.slice(0,6)}</span>
                            </div>
                            <p className="font-body text-[9px] text-white/40 mb-3 italic">"{req.reason}"</p>
                            <div className="flex gap-1">
                                <button onClick={() => handleRespondRequest(req, 'accepted')} className="flex-1 py-1.5 bg-green-500/10 border border-green-500/20 text-green-400 font-label text-[7px] uppercase tracking-widest font-black hover:bg-green-500 hover:text-white transition-all">Accept</button>
                                <button onClick={() => handleRespondRequest(req, 'rejected')} className="flex-1 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 font-label text-[7px] uppercase tracking-widest font-black hover:bg-red-500 hover:text-white transition-all">Reject</button>
                            </div>
                        </div>
                    ))}
                    {assistanceRequests.filter(r => r.targetState === userState && r.status === 'forwarded').length === 0 && (
                        <div className="py-8 text-center opacity-10 flex flex-col items-center gap-1">
                            <span className="material-symbols-outlined text-sm">hub</span>
                            <span className="font-label text-[7px] uppercase tracking-widest">No Active HQ Directives</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Tab Selector */}
            <div className="flex bg-black/40 p-1 border-b border-white/5">
                <button 
                  onClick={() => setIssueFeedTab('active')}
                  className={`flex-1 py-2 text-[8px] font-label uppercase tracking-widest transition-all ${issueFeedTab === 'active' ? 'bg-[#ffd166] text-[#0f131e] font-black' : 'text-white/30 hover:text-white'}`}
                >
                  Active Signals
                </button>
                <button 
                  onClick={() => setIssueFeedTab('past')}
                  className={`flex-1 py-2 text-[8px] font-label uppercase tracking-widest transition-all ${issueFeedTab === 'past' ? 'bg-secondary text-[#0f131e] font-black' : 'text-white/30 hover:text-white'}`}
                >
                  Resolved Archives
                </button>
            </div>

            {/* Filters */}
            <div className="flex-shrink-0 px-4 py-3 border-b border-white/[0.04] space-y-2">
              {/* Severity */}
              <div className="flex gap-1">
                {[['all','All'],['critical','Crit'],['high','High'],['medium','Med']].map(([v,l]) => (
                  <button key={v} type="button" onClick={() => setFilter(v)}
                    className={`flex-1 py-1.5 font-label text-[7px] uppercase tracking-wider font-bold transition-all border
                      ${severityFilter === v ? 'bg-[#ffd166] text-[#0f131e] border-[#ffd166]' : 'border-white/10 text-white/30 hover:border-white/20'}`}>
                    {l}
                  </button>
                ))}
              </div>
              {/* Status */}
              <div className="flex gap-1">
                {[['all','All'],['pending','Pend'],['assigned','Assgn'],['completed','Done']].map(([v,l]) => (
                  <button key={v} type="button" onClick={() => setStatusFilter(v)}
                    className={`flex-1 py-1.5 font-label text-[7px] uppercase tracking-wider font-bold transition-all border
                      ${statusFilter === v ? 'bg-white/10 text-white border-white/20' : 'border-white/5 text-white/20 hover:border-white/10'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Issue cards */}
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth:'none' }}>
              {loading && (
                <div className="flex items-center justify-center h-24 opacity-20">
                  <span className="material-symbols-outlined animate-spin text-2xl">sync</span>
                </div>
              )}
              {!loading && displayIssues.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 gap-2 opacity-20">
                  <span className="material-symbols-outlined text-3xl">search_off</span>
                  <p className="font-label text-[8px] uppercase tracking-widest">No issues match filters</p>
                </div>
              )}
              {displayIssues.map(issue => {
                const score = issue.urgency_score || 0;
                const isActive = activeIssue?.id === issue.id;
                const isReadOnly = viewMode === 'national' || issue.location?.state !== userState;
                return (
                  <div key={issue.id}
                    onClick={() => {
                      if (isReadOnly) return toast('National view: read-only', { icon:'🔒' });
                      setActiveIssue(issue); setRightTab('deploy'); setSelectedVolId('');
                    }}
                    className={`relative px-4 py-4 border-b border-white/[0.04] cursor-pointer transition-all group
                      ${isActive ? 'bg-[#ffd166]/[0.06] border-l-2 border-l-[#ffd166]' : 'hover:bg-white/[0.02]'}
                      ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {/* Severity accent line */}
                    {!isActive && <div className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ background: urgencyColor(score) }} />}

                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-headline text-[11px] font-bold text-white leading-tight line-clamp-2 flex-1">
                        {issue.issue_type?.toUpperCase() || issue.summary?.slice(0,40) || 'Unknown Issue'}
                      </p>
                      <Badge status={issue.status} />
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <span className="material-symbols-outlined text-xs text-white/20">location_on</span>
                      <span className="font-label text-[8px] text-white/40 uppercase">
                        {issue.location?.area_name || issue.location?.state || 'Unknown'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-16 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width:`${score}%`, background: urgencyColor(score) }} />
                        </div>
                        <span className="font-headline text-[9px] font-black" style={{ color: urgencyColor(score) }}>{score}</span>
                      </div>
                      {issue.people_affected && (
                        <span className="font-label text-[7px] text-white/20 uppercase">
                          {issue.people_affected?.toLocaleString()} affected
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* ── CENTER: Map ────────────────────────────────────────────────── */}
          <section className="col-span-12 lg:col-span-6 relative overflow-hidden">
            <div ref={mapRef} className="absolute inset-0" />
            <div className="absolute inset-0 pointer-events-none"
              style={{ boxShadow: 'inset 0 0 60px 15px rgba(7,12,24,0.85)' }} />

            {/* Map header overlay */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <div className={`flex items-center gap-2 px-4 py-2 backdrop-blur-xl border ${viewMode === 'state' ? 'bg-[#ffd166]/10 border-[#ffd166]/20' : 'bg-red-500/10 border-red-500/20'}`}>
                <span className={`material-symbols-outlined text-xs ${viewMode === 'state' ? 'text-[#ffd166]' : 'text-red-400'}`}>
                  {viewMode === 'state' ? 'location_on' : 'public'}
                </span>
                <span className={`font-label text-[8px] uppercase font-black tracking-widest ${viewMode === 'state' ? 'text-[#ffd166]' : 'text-red-400'}`}>
                  {viewMode === 'state' ? `${userState} Sector Map` : 'National View — Read Only'}
                </span>
              </div>
            </div>

            {/* Active issue info overlay */}
            {activeIssue && viewMode === 'state' && (
              <div className="absolute top-16 left-4 z-10 max-w-[220px]">
                <div className="bg-[#070c18]/95 backdrop-blur border border-[#ffd166]/20 p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-headline text-[10px] font-black text-[#ffd166] uppercase leading-tight">
                      {activeIssue.issue_type?.toUpperCase() || 'Selected Issue'}
                    </p>
                    <button onClick={() => setActiveIssue(null)} className="text-white/20 hover:text-white transition-colors flex-shrink-0">
                      <span className="material-symbols-outlined text-xs">close</span>
                    </button>
                  </div>
                  <p className="font-label text-[8px] text-white/40 uppercase mb-1">
                    {activeIssue.location?.area_name || activeIssue.location?.state}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width:`${activeIssue.urgency_score}%`, background: urgencyColor(activeIssue.urgency_score || 0)}} />
                    </div>
                    <span className="font-headline text-xs font-black" style={{color: urgencyColor(activeIssue.urgency_score || 0)}}>
                      {activeIssue.urgency_score}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom legend */}
            <div className="absolute bottom-4 left-4 right-4 flex justify-between pointer-events-none z-10">
              <div className="bg-[#070c18]/90 backdrop-blur border border-white/10 px-4 py-3">
                <p className="font-label text-[6px] uppercase text-white/20 tracking-widest mb-1.5">Severity Scale</p>
                <div className="flex gap-3">
                  {[['#ef4444','Critical'],['#f97316','High'],['#eab308','Medium'],['#22c55e','Low']].map(([c,l]) => (
                    <div key={l} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full" style={{background:c}}/>
                      <span className="font-label text-[6px] text-white/30 uppercase">{l}</span>
                    </div>
                  ))}
                </div>
              </div>
              {viewMode === 'state' && (
                <div className="bg-[#070c18]/90 backdrop-blur border border-white/10 px-4 py-3">
                  <p className="font-label text-[6px] uppercase text-white/20 mb-1">Assets Online</p>
                  <p className="font-headline text-base font-black text-green-400">{stats.available}</p>
                </div>
              )}
            </div>
          </section>

          {/* ── RIGHT: Deploy & Volunteers ────────────────────────────────── */}
          <aside className="col-span-12 lg:col-span-3 border-l border-white/[0.06] flex flex-col bg-[#060b14] overflow-hidden">

            {/* Tab bar */}
            <div className="flex-shrink-0 flex border-b border-white/[0.06]">
              {[['deploy','rocket_launch','Deploy'],['volunteers','group','Volunteers']].map(([v,icon,label]) => (
                <button key={v} type="button" onClick={() => setRightTab(v)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-4 font-label text-[8px] uppercase tracking-widest font-black transition-all border-b-2
                    ${rightTab === v ? 'border-[#ffd166] text-[#ffd166] bg-[#ffd166]/5' : 'border-transparent text-white/30 hover:text-white/60'}`}>
                  <span className="material-symbols-outlined text-sm">{icon}</span>
                  {label}
                </button>
              ))}
            </div>

            {/* ── DEPLOY TAB ─────────────────────────────────────────────── */}
            {rightTab === 'deploy' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{scrollbarWidth:'none'}}>
                {!activeIssue ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-3 opacity-25">
                    <span className="material-symbols-outlined text-4xl">ads_click</span>
                    <p className="font-label text-[8px] uppercase tracking-widest text-center">
                      Select an issue from the left panel to begin deployment
                    </p>
                  </div>
                ) : viewMode === 'national' ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-3">
                    <span className="material-symbols-outlined text-4xl text-red-400/40">lock</span>
                    <p className="font-label text-[8px] uppercase tracking-widest text-center text-red-400/60">
                      Switch to Sector View to enable deployment actions
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Issue summary */}
                    <div className="p-4 border border-[#ffd166]/15 bg-[#ffd166]/[0.03]">
                      <div className="flex items-start justify-between mb-3">
                        <p className="font-headline text-xs font-black text-[#ffd166] uppercase leading-tight">
                          {activeIssue.issue_type?.toUpperCase() || 'Incident'}
                        </p>
                        <Badge status={activeIssue.status} />
                      </div>
                      <div className="space-y-1.5 text-[8px] font-label uppercase text-white/40">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-xs">location_on</span>
                          {activeIssue.location?.area_name || activeIssue.location?.state}
                        </div>
                        {activeIssue.people_affected && (
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-xs">groups</span>
                            {activeIssue.people_affected?.toLocaleString()} people affected
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-xs">crisis_alert</span>
                          Urgency: <span className="font-black" style={{color: urgencyColor(activeIssue.urgency_score || 0)}}>
                            {activeIssue.urgency_score || '?'}/100
                          </span>
                        </div>
                      </div>
                      {activeIssue.summary && (
                        <p className="mt-3 font-body text-[9px] text-white/40 leading-snug border-t border-white/5 pt-3">
                          {activeIssue.summary}
                        </p>
                      )}
                      {activeIssue.translation_detected && activeIssue.original_summary && (
                        <div className="mt-2 p-2 bg-blue-500/5 border border-blue-500/10 rounded-sm">
                           <p className="font-label text-[6px] text-blue-400 uppercase font-black mb-1">{t('dialect_original')}</p>
                           <p className="font-body text-[8px] text-white/30 italic leading-snug">
                              "{activeIssue.original_summary}"
                           </p>
                        </div>
                      )}
                    </div>

                    {/* Already assigned volunteer */}
                    {activeIssue.status !== 'pending' && activeIssue.routed_to_volunteer_id && (() => {
                      const vol = volunteers.find(v => v.id === activeIssue.routed_to_volunteer_id);
                      return vol ? (
                        <div className="p-3 bg-green-500/5 border border-green-500/15">
                          <p className="font-label text-[7px] uppercase text-green-400/60 mb-2 tracking-wider">Current Assignment</p>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-sm bg-green-500/20 flex items-center justify-center flex-shrink-0">
                              <span className="material-symbols-outlined text-xs text-green-400">person</span>
                            </div>
                            <div>
                              <p className="font-headline text-[10px] font-black text-white">{vol.name}</p>
                              <SkillDot skill={vol.skills?.[0] || vol.skill || 'general'} />
                            </div>
                          </div>
                        </div>
                      ) : null;
                    })()}

                    {/* Volunteer selector */}
                    <div>
                      <label className="font-label text-[8px] uppercase tracking-widest text-white/30 mb-2 block">
                        Select Volunteer
                      </label>
                      {availableVols.length === 0 ? (
                        <div className="p-4 border border-orange-500/20 bg-orange-500/5 flex items-center gap-2">
                          <span className="material-symbols-outlined text-orange-400 text-sm">warning</span>
                          <p className="font-label text-[8px] text-orange-400 uppercase tracking-wider">
                            No available volunteers in {userState}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto" style={{scrollbarWidth:'none'}}>
                          {availableVols.map(vol => (
                            <div key={vol.id}
                              onClick={() => setSelectedVolId(vol.id)}
                              className={`flex items-center gap-3 p-3 border cursor-pointer transition-all
                                ${selectedVolId === vol.id ? 'border-[#ffd166]/40 bg-[#ffd166]/5' : 'border-white/5 hover:border-white/10 bg-white/[0.01]'}`}>
                              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background: SKILL_COLORS[vol.skills?.[0] || vol.skill] || '#6b7280'}} />
                              <div className="flex-1">
                                <p className="font-headline text-[10px] font-bold text-white">{vol.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <SkillDot skill={vol.skills?.[0] || vol.skill || 'general'} />
                                  <span className="font-label text-[6px] text-white/20 uppercase">{vol.district || vol.location?.area_name}</span>
                                </div>
                              </div>
                              {selectedVolId === vol.id && (
                                <span className="material-symbols-outlined text-[#ffd166] text-sm">check_circle</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Deploy button */}
                    <button
                      onClick={handleDeploy}
                      disabled={deploying || availableVols.length === 0}
                      className="w-full py-4 bg-[#ffd166] text-[#0f131e] font-headline font-black text-xs uppercase tracking-[0.3em] transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-base">rocket_launch</span>
                      {deploying ? 'Authorizing...' : 'Deploy Response'}
                    </button>

                    {/* Assistance Request Tool */}
                    {!showRequestHelp ? (
                      <button onClick={() => setShowRequestHelp(true)} className="w-full py-2.5 border border-[#ffd166]/20 bg-[#ffd166]/5 text-[#ffd166] font-label text-[8px] uppercase tracking-widest hover:bg-[#ffd166]/10 transition-all flex items-center justify-center gap-2">
                         <span className="material-symbols-outlined text-sm">support</span>
                         Request External Support
                      </button>
                    ) : (
                      <div className="p-3 border border-[#ffd166]/20 bg-[#ffd166]/5 space-y-3 animate-in slide-in-from-top duration-300">
                         <div className="flex justify-between items-center">
                            <span className="font-label text-[8px] uppercase text-[#ffd166] font-black">ESCALATE TO HQ</span>
                            <button onClick={() => setShowRequestHelp(false)} className="text-white/20 hover:text-white"><span className="material-symbols-outlined text-xs">close</span></button>
                         </div>
                         <div className="p-2 bg-blue-500/5 border border-blue-500/10 rounded-sm">
                            <p className="font-label text-[7px] text-blue-400 uppercase font-black mb-1 italic">Protocol Notice</p>
                            <p className="font-body text-[8px] text-white/40 leading-tight">Requests are reviewed and routed by National Command. You cannot specify the target state directly.</p>
                         </div>
                         <textarea 
                           placeholder="Describe operational deficit and resource needs..."
                           value={requestTarget.reason}
                           onChange={e => setRequestTarget(p => ({...p, reason: e.target.value}))}
                           className="w-full bg-[#070c18] border border-white/10 p-2 text-[9px] font-body text-white min-h-[60px]"
                         />
                         <button 
                           onClick={handleCreateRequest}
                           disabled={!requestTarget.reason}
                           className="w-full py-2 bg-[#ffd166] text-[#0f131e] font-label text-[8px] uppercase tracking-widest font-black disabled:opacity-40"
                         >
                           Broadband Uplink
                         </button>
                      </div>
                    )}

                    {/* Cancel */}
                    <button onClick={() => { setActiveIssue(null); setSelectedVolId(''); }}
                      className="w-full py-2.5 border border-white/10 text-white/30 font-label text-[8px] uppercase tracking-widest hover:border-white/20 hover:text-white/50 transition-all">
                      Clear Selection
                    </button>
                  </>
                )}
              </div>
            )}

            {/* ── VOLUNTEERS TAB ─────────────────────────────────────────── */}
            {rightTab === 'volunteers' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Add volunteer button */}
                <div className="flex-shrink-0 px-4 py-3 border-b border-white/[0.04]">
                  <button onClick={() => { setShowAddVol(!showAddVol); setEditVol(null); }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-[#ffd166]/30 text-[#ffd166] font-label text-[8px] uppercase tracking-widest hover:bg-[#ffd166]/5 transition-all font-bold">
                    <span className="material-symbols-outlined text-sm">{showAddVol ? 'remove' : 'person_add'}</span>
                    {showAddVol ? 'Cancel' : 'Register Volunteer'}
                  </button>
                </div>

                {/* Add form */}
                {showAddVol && (
                  <form onSubmit={handleAddVolunteer} className="flex-shrink-0 px-4 py-4 border-b border-white/[0.04] bg-[#ffd166]/[0.02] space-y-3">
                    {[
                      {id:'name',label:'Full Name',type:'text',placeholder:'Ravi Kumar',key:'name'},
                      {id:'phone',label:'Phone',type:'tel',placeholder:'+91 9876543210',key:'phone'},
                      {id:'district',label:'District',type:'text',placeholder:'Wayanad',key:'district'},
                    ].map(f => (
                      <div key={f.id}>
                        <label className="font-label text-[7px] uppercase text-white/20 tracking-wider block mb-1">{f.label}</label>
                        <input type={f.type} placeholder={f.placeholder} required={f.id !== 'phone'} value={volForm[f.key]}
                          onChange={e => setVolForm(p => ({...p, [f.key]: e.target.value}))}
                          className="w-full bg-white/5 border border-white/10 text-[10px] font-body px-3 py-2 text-white placeholder:text-white/20 outline-none focus:border-[#ffd166]/30 transition-all"/>
                      </div>
                    ))}
                    <div>
                      <label className="font-label text-[7px] uppercase text-white/20 tracking-wider block mb-1">Skill</label>
                      <select value={volForm.skill} onChange={e => setVolForm(p => ({...p, skill: e.target.value}))}
                        className="w-full bg-[#0f131e] border border-white/10 text-[10px] font-body px-3 py-2 text-white outline-none focus:border-[#ffd166]/30">
                        {SKILLS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                      </select>
                    </div>
                    <button type="submit"
                      className="w-full py-2.5 bg-[#ffd166] text-[#0f131e] font-label text-[8px] uppercase tracking-widest font-black hover:opacity-90 transition-all">
                      Register to {userState}
                    </button>
                  </form>
                )}

                {/* Edit form */}
                {editVol && (
                  <form onSubmit={handleUpdateVol} className="flex-shrink-0 px-4 py-4 border-b border-white/[0.04] bg-blue-500/[0.03] space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-label text-[8px] uppercase text-blue-400 tracking-wider font-bold">Edit Volunteer</span>
                      <button type="button" onClick={() => setEditVol(null)} className="text-white/20 hover:text-white">
                        <span className="material-symbols-outlined text-xs">close</span>
                      </button>
                    </div>
                    {[{label:'Name',key:'name'},{label:'Phone',key:'phone'},{label:'District',key:'district'}].map(f => (
                      <div key={f.key}>
                        <label className="font-label text-[7px] uppercase text-white/20 tracking-wider block mb-1">{f.label}</label>
                        <input value={editVol[f.key] || ''} onChange={e => setEditVol(p => ({...p,[f.key]:e.target.value}))}
                          className="w-full bg-white/5 border border-white/10 text-[10px] px-3 py-2 text-white outline-none focus:border-blue-400/30"/>
                      </div>
                    ))}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="font-label text-[7px] uppercase text-white/20 block mb-1">Skill</label>
                        <select value={editVol.skill || editVol.skills?.[0] || ''} onChange={e => setEditVol(p => ({...p,skill:e.target.value}))}
                          className="w-full bg-[#0f131e] border border-white/10 text-[10px] px-2 py-2 text-white outline-none">
                          {SKILLS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="font-label text-[7px] uppercase text-white/20 block mb-1">Status</label>
                        <select value={editVol.status || 'available'} onChange={e => setEditVol(p => ({...p, status:e.target.value}))}
                          className="w-full bg-[#0f131e] border border-white/10 text-[10px] px-2 py-2 text-white outline-none">
                          {['available','assigned','inactive'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                    <button type="submit" className="w-full py-2 bg-blue-500/80 text-white font-label text-[8px] uppercase tracking-widest font-black hover:bg-blue-500 transition-all">
                      Save Changes
                    </button>
                  </form>
                )}

                {/* Volunteer list */}
                <div className="flex-1 overflow-y-auto" style={{scrollbarWidth:'none'}}>
                  {stateVols.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-24 gap-2 opacity-20">
                      <span className="material-symbols-outlined text-2xl">group_off</span>
                      <p className="font-label text-[7px] uppercase tracking-widest">No volunteers in {userState}</p>
                    </div>
                  )}
                  {stateVols.map(vol => {
                    const skill = vol.skills?.[0] || vol.skill || 'general';
                    const statusColors = {
                      available:'text-green-400 bg-green-500/10 border-green-500/20',
                      assigned: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                      inactive: 'text-white/20 bg-white/5 border-white/10',
                    };
                    return (
                      <div key={vol.id}
                        className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.04] hover:bg-white/[0.02] group transition-all">
                        {/* Skill color dot */}
                        <div className="w-8 h-8 rounded-sm flex-shrink-0 flex items-center justify-center"
                          style={{background:`${SKILL_COLORS[skill]}20`, border:`1px solid ${SKILL_COLORS[skill]}40`}}>
                          <span className="material-symbols-outlined text-xs" style={{color: SKILL_COLORS[skill]}}>person</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-headline text-[10px] font-bold text-white truncate">{vol.name}</p>
                            <span className={`font-label text-[6px] uppercase px-1.5 py-0.5 border font-bold ${statusColors[vol.status] || statusColors.inactive}`}>
                              {vol.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <SkillDot skill={skill} />
                            <span className="font-label text-[6px] text-white/20 uppercase">{vol.district || vol.location?.area_name || '—'}</span>
                          </div>
                        </div>
                        {/* Actions */}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button type="button" onClick={() => { setEditVol({...vol, skill}); setShowAddVol(false); }}
                            className="p-1 hover:text-blue-400 text-white/20 transition-colors">
                            <span className="material-symbols-outlined text-xs">edit</span>
                          </button>
                          <button type="button" onClick={() => handleToggleAvailability(vol)}
                            className="p-1 hover:text-[#ffd166] text-white/20 transition-colors" title="Toggle availability">
                            <span className="material-symbols-outlined text-xs">
                              {vol.status === 'available' ? 'pause_circle' : 'play_circle'}
                            </span>
                          </button>
                          <button type="button" onClick={() => handleRemoveVol(vol.id, vol.name)}
                            className="p-1 hover:text-red-400 text-white/20 transition-colors">
                            <span className="material-symbols-outlined text-xs">delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Summary footer */}
                <div className="flex-shrink-0 px-4 py-3 border-t border-white/[0.06] flex justify-between text-[7px] font-label uppercase text-white/20">
                  <span>{stateVols.length} total</span>
                  <span className="text-green-400">{availableVols.length} available</span>
                  <span className="text-blue-400">{stateVols.filter(v=>v.status==='assigned').length} assigned</span>
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>
      <BroadcastReceiver />
    </div>
  );
}
