import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase.js';
import Sidebar from '../components/Sidebar.jsx';
import toast from 'react-hot-toast';
import { extractIntelFrontend } from '../utils/gemini.js';
import NotificationBell from '../components/NotificationBell.jsx';

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#060b14' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#ffd166' }, { lightness: -40 }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#060b14' }, { weight: 3 }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#ffd166' }, { weight: 1 }, { opacity: 0.5 }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#ffd16650' }, { weight: 0.5 }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a1628' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#080d18' }] },
  { featureType: 'road', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
];

const STATE_CENTERS = {
  'Andhra Pradesh': { lat: 15.9129, lng: 79.74 }, 'Arunachal Pradesh': { lat: 28.218, lng: 94.7278 },
  'Assam': { lat: 26.2006, lng: 92.9376 }, 'Bihar': { lat: 25.0961, lng: 85.3131 },
  'Chhattisgarh': { lat: 21.2787, lng: 81.8661 }, 'Goa': { lat: 15.2993, lng: 74.124 },
  'Gujarat': { lat: 22.2587, lng: 71.1924 }, 'Haryana': { lat: 29.0588, lng: 76.0856 },
  'Himachal Pradesh': { lat: 31.1048, lng: 77.1734 }, 'Jharkhand': { lat: 23.6102, lng: 85.2799 },
  'Karnataka': { lat: 15.3173, lng: 75.7139 }, 'Kerala': { lat: 10.8505, lng: 76.2711 },
  'Madhya Pradesh': { lat: 22.9734, lng: 78.6569 }, 'Maharashtra': { lat: 19.7515, lng: 75.7139 },
  'Manipur': { lat: 24.6637, lng: 93.9063 }, 'Meghalaya': { lat: 25.467, lng: 91.3662 },
  'Mizoram': { lat: 23.1645, lng: 92.9376 }, 'Nagaland': { lat: 26.1584, lng: 94.5624 },
  'Odisha': { lat: 20.9517, lng: 85.0985 }, 'Punjab': { lat: 31.1471, lng: 75.3412 },
  'Rajasthan': { lat: 27.0238, lng: 74.2179 }, 'Sikkim': { lat: 27.533, lng: 88.5122 },
  'Tamil Nadu': { lat: 11.1271, lng: 78.6569 }, 'Telangana': { lat: 18.1124, lng: 79.0193 },
  'Tripura': { lat: 23.9408, lng: 91.9882 }, 'Uttar Pradesh': { lat: 26.8467, lng: 80.9462 },
  'Uttarakhand': { lat: 30.0668, lng: 79.0193 }, 'West Bengal': { lat: 22.9868, lng: 87.855 },
  'Delhi': { lat: 28.7041, lng: 77.1025 },
};

const DISTRICT_CENTERS = {
  'Chittoor': { lat: 13.2172, lng: 79.1003 },
  'Kadapa':   { lat: 14.4673, lng: 78.8242 },
  'Tirupati': { lat: 13.6285, lng: 79.4192 },
  'Nellore':  { lat: 14.4426, lng: 79.9865 },
  'Kurnool':  { lat: 15.8281, lng: 78.0373 },
  'Anantapur':{ lat: 14.6819, lng: 77.6006 },
};

export default function FieldCenter() {
  const [profile, setProfile] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reporting, setReporting] = useState(false);
  const [intelType, setIntelType] = useState('text'); // text, image, voice
  const [intelContent, setIntelContent] = useState('');
  const [intelFile, setIntelFile] = useState(null);
  const [gpsCoords, setGpsCoords] = useState(null);
  const [capturingGps, setCapturingGps] = useState(false);

  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const markersRef = useRef([]);
  const mapReadyRef = useRef(false);

  // 1. Find the logged-in volunteer's profile
  useEffect(() => {
    if (!auth.currentUser || !db) return;
    const q = query(collection(db, 'volunteers'), where('email', '==', auth.currentUser.email));
    return onSnapshot(q, snap => {
      if (!snap.empty) {
        setProfile({ id: snap.docs[0].id, ...snap.docs[0].data() });
      }
    });
  }, []);

  // 2. Load assigned tasks once profile is found
  useEffect(() => {
    if (!profile || !db) return;
    const q = query(collection(db, 'issues'), where('routed_to_volunteer_id', '==', profile.id));
    return onSnapshot(q, snap => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [profile]);

  // 3. Handle Status Update
  const updateTaskStatus = async (taskId, newStatus) => {
    const loadToast = toast.loading(`Updating Mission Status: ${newStatus}...`);
    try {
      await updateDoc(doc(db, 'issues', taskId), {
        status: newStatus,
        last_updated: serverTimestamp()
      });

      // Log Monitoring Event
      await addDoc(collection(db, 'events'), {
        type: 'status_update',
        message: `Field Mission Status: ${newStatus.toUpperCase()}`,
        state: profile?.location?.state || 'Unknown',
        userId: profile?.id || 'Unknown',
        issueId: taskId,
        timestamp: serverTimestamp()
      });

      toast.success(`Mission Status Synchronized: ${newStatus.toUpperCase()}`, { id: loadToast });
    } catch (err) {
      toast.error('Sync error: ' + err.message, { id: loadToast });
    }
  };

  const initMap = useCallback(() => {
    if (mapReadyRef.current || !mapRef.current || !window.google?.maps) return;
    mapReadyRef.current = true;
    try {
      googleMapRef.current = new window.google.maps.Map(mapRef.current, {
        center: { lat: 20, lng: 78 }, zoom: 5,
        styles: MAP_STYLE, disableDefaultUI: true, backgroundColor: '#070c18',
      });
    } catch (err) {
      console.error("FieldCenter: Map init failed:", err);
      mapReadyRef.current = false;
    }
  }, []);

  // Tactical Centering Effect
  useEffect(() => {
    if (!googleMapRef.current || !profile) return;

    const userState = (profile?.state || profile?.location?.state || '').trim();
    const userDistrict = (profile?.district || profile?.location?.area_name || '').trim();

    if (!userState && !userDistrict) return;

    // Priority 1: District Center
    const districtKey = userDistrict ? Object.keys(DISTRICT_CENTERS).find(
      k => k.trim().toLowerCase() === userDistrict.toLowerCase()
    ) : null;

    if (districtKey) {
      googleMapRef.current.setCenter(DISTRICT_CENTERS[districtKey]);
      googleMapRef.current.setZoom(11);
    } else if (userState) {
      // Priority 2: State Center
      const stateKey = Object.keys(STATE_CENTERS).find(
        k => k.trim().toLowerCase() === userState.toLowerCase()
      );
      if (stateKey) {
        googleMapRef.current.setCenter(STATE_CENTERS[stateKey]);
        googleMapRef.current.setZoom(8);
      }
    }
  }, [profile]);

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

  useEffect(() => {
    if (!googleMapRef.current || !window.google?.maps?.Marker) return;
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    
    const activeTasks = tasks.filter(t => t.status !== 'completed');
    if (activeTasks.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();
    let hasPoints = false;

    activeTasks.forEach(task => {
      if (!task.location?.lat || !task.location?.lng) return;
      const pos = { lat: Number(task.location.lat), lng: Number(task.location.lng) };
      bounds.extend(pos);
      hasPoints = true;

      try {
        const marker = new window.google.maps.Marker({
          position: pos,
          map: googleMapRef.current,
          title: task.summary || '',
          icon: {
            path: 'M 0,-14 C -6,-14 -10,-8 -10,-3 C -10,6 0,14 0,14 C 0,14 10,6 10,-3 C 10,-8 6,-14 0,-14 Z',
            fillColor: '#ffd166', fillOpacity: 0.9,
            strokeColor: '#ffd166', strokeWeight: 1,
            scale: 1, anchor: new window.google.maps.Point(0, 14),
          }
        });
        markersRef.current.push(marker);
      } catch (e) {}
    });

    if (hasPoints) {
      googleMapRef.current.fitBounds(bounds);
      // Don't zoom in too far if there's only one point
      if (activeTasks.length === 1) {
        const listener = window.google.maps.event.addListener(googleMapRef.current, 'idle', () => {
          googleMapRef.current.setZoom(12);
          window.google.maps.event.removeListener(listener);
        });
      }
    }
  }, [tasks]);

  // 3.5 Capture GPS
  const captureGps = () => {
    if (!navigator.geolocation) return toast.error('Geolocation not supported');
    setCapturingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setCapturingGps(false);
        toast.success('GPS Coordinates Locked');
      },
      (err) => {
        toast.error('GPS Lock Failed: ' + err.message);
        setCapturingGps(false);
      },
      { enableHighAccuracy: true }
    );
  };

  // 4. Handle Field Intelligence Submission (Report)
  const handleTransmitSignal = async () => {
    if (!intelContent && !intelFile) return toast.error('Signal transmission requires payload');
    
    setReporting(true);
    const loadToast = toast.loading('ARIA — Processing Tactical Signal...');
    
    try {
      let intelPayload = intelContent;
      let contentType = 'text';

      if (intelType === 'image' && intelFile) {
        contentType = 'image';
        intelPayload = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(intelFile);
        });
      }

      const extracted = await extractIntelFrontend(intelPayload, contentType);
      
      // Save to issues collection
      const issueRef = await addDoc(collection(db, 'issues'), {
        ...extracted,
        source: 'field_worker',
        status: 'pending',
        routing_status: 'pending',
        reporter_id: profile?.id || 'anonymous_field',
        timestamp: serverTimestamp(),
        location: {
          ...extracted.location,
          ...(gpsCoords || {}),
          state: profile?.location?.state || 'Unknown'
        }
      });

      // Log Monitoring Event
      await addDoc(collection(db, 'events'), {
        type: 'issue_creation',
        message: `New Issue Reported: ${extracted.issue_type.toUpperCase()} in ${extracted.location?.area_name}`,
        state: profile?.location?.state || 'Unknown',
        userId: profile?.id || 'anonymous_field',
        issueId: issueRef.id,
        timestamp: serverTimestamp()
      });

      toast.success('Intelligence Successfully Ingested by ARIA', { id: loadToast });
      setIntelContent('');
      setIntelFile(null);
      setGpsCoords(null);
      setIntelType('text');
    } catch (err) {
      toast.error('Uplink Failed: ' + err.message, { id: loadToast });
    } finally {
      setReporting(false);
    }
  };

  return (
    <div className="bg-background text-on-background font-body min-h-screen dot-grid relative">
      <Sidebar />

      <main className="ml-20 md:ml-64 flex-1 flex flex-col min-w-0">
        <header className="flex justify-between items-center w-full px-6 h-16 bg-[#0f131e]/90 backdrop-blur-xl border-b border-white/5 z-20">
          <div className="flex items-center gap-4">
             <div className="w-2 h-2 rounded-full bg-primary-container animate-pulse shadow-[0_0_8px_#ffd166]"></div>
             <h1 className="font-headline text-lg tracking-[0.3em] uppercase font-bold text-[#ffd166]">Field Operations Deck</h1>
          </div>
          
          <div className="flex items-center gap-6">
            <NotificationBell />
            <div className="h-8 w-px bg-white/5"></div>
            {profile && (
              <div className="flex items-center gap-3">
                <span className="font-label text-[9px] text-white/40 uppercase tracking-widest hidden sm:block">Specialist: {profile.name}</span>
                <div className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                   <span className="material-symbols-outlined text-sm text-primary-container">person</span>
                </div>
              </div>
            )}
          </div>
        </header>

        <section className="p-6 md:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 max-h-[calc(100vh-64px)] overflow-y-auto custom-scrollbar">
          
          {/* LEFT: Assigned Missions (8 Columns) */}
          <div className="lg:col-span-12 xl:col-span-8 space-y-6">
            
            {/* Tactical Map Section */}
            <div className="bg-[#0a0e19] border border-[#1e2535] relative overflow-hidden h-64 md:h-80 group shadow-2xl">
               <div ref={mapRef} className="absolute inset-0" />
               <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 40px rgba(0,0,0,0.6)' }}></div>
               <div className="absolute top-4 left-4 z-10">
                  <div className="bg-[#0f131e]/90 backdrop-blur-md border border-[#ffd166]/20 px-4 py-2 flex items-center gap-3">
                     <span className="w-2 h-2 rounded-full bg-[#ffd166] animate-pulse"></span>
                     <span className="font-label text-[8px] uppercase tracking-[0.3em] text-[#ffd166] font-bold">Operational Sector Map</span>
                  </div>
               </div>
               <div className="absolute bottom-4 right-4 z-10 flex flex-col items-end">
                  <p className="font-label text-[7px] text-white/20 uppercase tracking-widest mb-1">Assigned Support Zone</p>
                  <p className="font-headline text-xs font-black text-white uppercase tracking-wider">{profile?.district}, {profile?.state}</p>
               </div>
            </div>

            <div className="flex justify-between items-end border-b border-white/5 pb-4">
               <div>
                  <p className="font-label text-[9px] uppercase tracking-widest text-white/20">Authorized Targets</p>
                  <h2 className="font-headline text-2xl font-bold uppercase tracking-tight text-[#ffd166]">Your Missions</h2>
               </div>
                <span className="font-label text-[10px] text-white/40 uppercase tracking-widest">{tasks.filter(t => t.status !== 'completed').length} Active Briefs</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {loading ? (
                 Array(4).fill(0).map((_,i) => <div key={i} className="h-48 bg-white/5 animate-pulse rounded-sm"></div>)
               ) : tasks.filter(t => t.status !== 'completed').length === 0 ? (
                 <div className="col-span-2 h-64 bg-[#0a0e19] shadow-[inset_0_0_20px_rgba(255,255,255,0.02)] border border-dashed border-[#1e2535] flex flex-col items-center justify-center gap-4 opacity-50">
                    <span className="material-symbols-outlined text-5xl text-white/20">radar</span>
                    <p className="font-label text-xs uppercase tracking-widest text-white/40">Awaiting Command Authorization...</p>
                 </div>
               ) : tasks.filter(t => t.status !== 'completed').map(task => {
                 const isCrit = task.urgency_score >= 80;
                 const borderColor = isCrit ? 'border-l-red-500' : task.urgency_score >= 50 ? 'border-l-orange-500' : 'border-l-[#ffd166]';
                 const statusGlow = task.status === 'completed' ? 'bg-secondary' : 'bg-blue-400 animate-pulse shadow-[0_0_10px_rgba(96,165,250,0.8)]';

                 return (
                 <div key={task.id} className={`bg-[#0a0e19] shadow-[0_8px_30px_rgb(0,0,0,0.5)] border border-[#1e2535] border-l-4 ${borderColor} p-6 relative flex flex-col justify-between group hover:bg-[#0c1220] transition-colors overflow-hidden`}>
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>
                    
                    <div className="absolute top-0 right-4 px-3 py-1 bg-[#1e2535] rounded-b-md shadow-md border border-t-0 border-[#2a3441] z-10">
                       <span className={`font-mono text-[9px] uppercase font-bold tracking-widest ${isCrit ? 'text-red-400' : 'text-white/40'}`}>
                         ID: TS-{task.id.slice(0,5)}
                       </span>
                    </div>

                    <div className="relative z-10 flex-1">
                      <div className="flex items-center gap-3 mb-2 mt-4 text-white/80">
                         <div className={`p-2 rounded-sm bg-white/5 border border-white/10 ${isCrit ? 'text-red-500' : 'text-[#ffd166]'}`}>
                           <span className="material-symbols-outlined text-xl">
                              {task.issue_type === 'medical' ? 'medical_services' : task.issue_type === 'flood' ? 'waves' : 'warning_emerald'}
                           </span>
                         </div>
                         <div>
                           <p className="font-label text-[8px] uppercase tracking-[0.2em] text-white/30 mb-0.5">{task.issue_type} Protocol</p>
                           <h3 className="font-headline text-lg font-black uppercase text-white tracking-widest truncate max-w-[200px]" title={task.location?.area_name || 'Assigned Zone'}>
                             {task.location?.area_name || 'Assigned Zone'}
                           </h3>
                         </div>
                      </div>

                      <div className="mt-4 p-3 bg-black/40 border border-[#1e2535] rounded-sm min-h-[50px] flex items-center shadow-inner">
                        <p className="font-body text-xs text-white/60 leading-relaxed italic">
                           "{task.summary}"
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-5">
                         <div className="flex items-center gap-2 bg-[#1e2535]/30 p-2 border border-[#1e2535]">
                            <span className={`w-2 h-2 rounded-full ${statusGlow}`}></span>
                            <div className="flex flex-col">
                              <span className="font-label text-[7px] uppercase text-white/30 tracking-widest">Op Status</span>
                              <span className="font-mono text-[9px] uppercase font-bold text-white tracking-widest">{task.status || 'Active'}</span>
                            </div>
                         </div>
                         <div className="flex flex-col items-end justify-center bg-[#1e2535]/30 p-2 border border-[#1e2535]">
                            <span className="font-label text-[7px] uppercase text-white/30 tracking-widest mb-0.5">Threat Level</span>
                            <span className={`font-mono text-[10px] font-bold uppercase tracking-widest ${isCrit ? 'text-red-400' : 'text-orange-400'}`}>{task.urgency_score}% Crit</span>
                         </div>
                      </div>
                    </div>

                    <div className="relative z-10 flex gap-3 pt-5 mt-5 border-t border-[#1e2535]">
                       {task.status !== 'completed' && (
                         <>
                           <button 
                             onClick={() => updateTaskStatus(task.id, 'in-progress')}
                             className={`flex-1 py-2.5 font-label text-[9px] font-bold shadow-lg uppercase tracking-widest transition-all ${task.status === 'in-progress' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' : 'bg-[#1e2535] text-white/60 hover:bg-[#2a3441] border border-white/5 hover:text-white'}`}
                           >
                              {task.status === 'in-progress' ? 'Executing' : 'Engage'}
                           </button>
                           <button 
                             onClick={() => updateTaskStatus(task.id, 'completed')}
                             className="flex-1 py-2.5 bg-green-500/10 border border-green-500/30 text-green-400 font-label text-[9px] uppercase tracking-widest font-bold hover:bg-green-500/20 shadow-lg transition-all"
                           >
                              Secure
                           </button>
                           <a 
                             href={`https://www.google.com/maps/dir/?api=1&destination=${task.location?.lat},${task.location?.lng}`}
                             target="_blank"
                             rel="noreferrer"
                             className="w-12 flex items-center justify-center bg-[#1e2535] border border-white/5 text-white/50 hover:bg-[#ffd166] hover:text-black hover:border-[#ffd166] transition-all shadow-lg"
                             title="GPS Routing"
                           >
                              <span className="material-symbols-outlined text-[18px]">explore</span>
                           </a>
                         </>
                       )}
                       {task.status === 'completed' && (
                         <div className="w-full py-3 bg-secondary/10 border border-secondary/30 text-secondary text-center font-label text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-[inset_0_0_15px_rgba(34,197,94,0.1)]">
                            <span className="material-symbols-outlined text-sm">verified</span>
                            Sector Secured
                         </div>
                       )}
                    </div>
                 </div>
               )})}

            </div>

            {/* Mission History Section */}
            <div className="mt-12 space-y-6 pb-20">
               <div className="flex justify-between items-end border-b border-white/5 pb-4">
                  <div>
                     <p className="font-label text-[9px] uppercase tracking-widest text-white/20">Operational Log</p>
                     <h2 className="font-headline text-xl font-bold uppercase tracking-tight text-secondary">Mission History</h2>
                  </div>
                  <span className="font-label text-[9px] text-white/40 uppercase tracking-widest">{tasks.filter(t => t.status === 'completed').length} Resolved</span>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {tasks.filter(t => t.status === 'completed').map(task => (
                    <div key={task.id} className="bg-white/2 border border-white/5 p-4 relative group overflow-hidden">
                       <div className="flex justify-between items-start mb-2">
                          <span className="font-label text-[7px] text-secondary uppercase tracking-[0.2em] font-black">Secured</span>
                          <span className="font-label text-[7px] text-white/10 uppercase font-mono">{task.id.slice(0,5)}</span>
                       </div>
                       <h4 className="font-headline text-xs font-bold text-white/80 uppercase truncate">{task.location?.area_name || 'Assigned Zone'}</h4>
                       <p className="font-body text-[9px] text-white/30 mt-1 line-clamp-2 italic">"{task.summary}"</p>
                       <div className="mt-3 flex items-center gap-2">
                          <span className="text-[7px] font-label text-white/20 uppercase tracking-widest">{task.issue_type}</span>
                          <div className="h-px flex-1 bg-white/5"></div>
                          <span className="text-[7px] font-label text-white/20">LVL {task.urgency_score}</span>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          </div>

          {/* RIGHT: A.R.I.A Field Uplink (4 Columns) */}
          <div className="lg:col-span-12 xl:col-span-4 space-y-6">
            <div className="bg-[#0a0e19] shadow-[0_8px_30px_rgb(0,0,0,0.5)] border border-[#1e2535] p-8 relative overflow-hidden h-fit">
              <div className="scan-line top-0 opacity-10"></div>
              
              <div className="mb-8">
                 <h2 className="font-headline text-lg font-bold text-[#ffd166] uppercase tracking-tighter">Field Intelligence</h2>
                 <p className="font-label text-[9px] text-white/30 uppercase mt-1">Direct ARIA Uplink</p>
              </div>

              <div className="space-y-6">
                <div className="flex items-center gap-2 p-1.5 bg-black/60 border border-[#1e2535] rounded-sm shadow-inner">
                   {[
                     { id: 'text', icon: 'chat_bubble', label: 'Signal' },
                     { id: 'image', icon: 'photo_camera', label: 'Vision' },
                     { id: 'voice', icon: 'mic', label: 'Audio' }
                   ].map(t => (
                     <button
                       key={t.id}
                       onClick={() => setIntelType(t.id)}
                       className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-sm transition-all shadow-sm ${intelType === t.id ? 'bg-[#1e2535] border border-white/10 text-[#ffd166]' : 'text-white/30 hover:text-white/50 border border-transparent hover:bg-white/5'}`}
                     >
                       <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                       <span className="font-label text-[8px] uppercase tracking-[0.2em] font-black">{t.label}</span>
                     </button>
                   ))}
                </div>

                {/* GPS Signal Block */}
                <div className="flex items-center justify-between p-4 bg-black/40 border border-[#1e2535] rounded-sm">
                   <div className="flex items-center gap-3">
                      <span className={`material-symbols-outlined text-sm ${gpsCoords ? 'text-[#ffd166] animate-pulse' : 'text-white/10'}`}>
                         {gpsCoords ? 'location_searching' : 'location_disabled'}
                      </span>
                      <div>
                         <p className="font-label text-[8px] uppercase tracking-[0.2em] text-white/30">GPS Coordinates</p>
                         <p className="font-mono text-[9px] text-[#ffd166]">
                            {gpsCoords ? `${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lng.toFixed(4)}` : 'SIGNAL OFFLINE'}
                         </p>
                      </div>
                   </div>
                   <button 
                     onClick={captureGps}
                     disabled={capturingGps}
                     className={`px-3 py-1.5 font-label text-[8px] uppercase tracking-widest font-black transition-all border ${gpsCoords ? 'border-[#ffd166] text-[#ffd166] bg-[#ffd166]/10' : 'border-white/10 text-white/40 hover:border-[#ffd166] hover:text-[#ffd166]'}`}
                   >
                      {capturingGps ? 'Locking...' : gpsCoords ? 'Recalibrate' : 'Share GPS'}
                   </button>
                </div>

                {intelType === 'text' && (
                  <textarea 
                    value={intelContent}
                    onChange={e => setIntelContent(e.target.value)}
                    placeholder="> AWAITING TEXTURAL INTEL..."
                    className="w-full bg-black/80 shadow-inner border border-[#1e2535] p-5 text-xs font-mono text-[#ffd166] min-h-[140px] focus:border-[#ffd166]/50 outline-none transition-all placeholder:text-[#ffd166]/20 resize-none"
                  />
                )}

                {intelType === 'image' && (
                  <div className="space-y-4">
                     <label className="group h-[140px] w-full bg-black/80 shadow-inner border-2 border-dashed border-[#1e2535] flex flex-col items-center justify-center cursor-pointer hover:border-[#ffd166]/50 hover:bg-[#ffd166]/5 transition-all overflow-hidden relative">
                        {intelFile ? (
                           <div className="absolute inset-0 bg-[#0a0e19] flex items-center justify-center p-3 border border-[#ffd166]/30">
                              <span className="material-symbols-outlined text-[#ffd166] text-3xl mb-2 block text-center w-full">image</span>
                              <p className="font-mono text-[9px] font-bold text-[#ffd166] truncate max-w-[200px] uppercase tracking-widest absolute bottom-4 text-center w-full">{intelFile.name}</p>
                           </div>
                        ) : (
                           <>
                              <span className="material-symbols-outlined text-[#1e2535] text-4xl group-hover:text-[#ffd166] transition-colors mb-2">upload_file</span>
                              <span className="font-label text-[8px] font-bold text-white/30 uppercase tracking-[0.25em] group-hover:text-[#ffd166]">Secure Image Proof</span>
                           </>
                        )}
                        <input type="file" accept="image/*" onChange={e => setIntelFile(e.target.files[0])} className="hidden" />
                     </label>
                  </div>
                )}

                {intelType === 'voice' && (
                  <div className="h-[120px] bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-3">
                     <div className="h-10 w-10 rounded-full bg-[#ef4444]/10 border border-[#ef4444]/30 flex items-center justify-center animate-pulse">
                        <span className="material-symbols-outlined text-xl text-[#ef4444]">mic</span>
                     </div>
                     <p className="font-label text-[8px] text-white/40 uppercase tracking-widest">Awaiting Neural Transcription (v1.0)</p>
                     <span className="text-[7px] text-white/10 italic font-label">Audio nodes currently in bypass mode for demo</span>
                  </div>
                )}

                <button 
                  disabled={reporting}
                  onClick={handleTransmitSignal}
                  className="w-full py-4 bg-[#ffd166] text-[#0f131e] font-headline font-black text-[10px] uppercase tracking-[0.3em] hvr-shimmer relative overflow-hidden transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50"
                >
                  {reporting ? 'SYNCHRONIZING...' : 'TRANSMIT SIGNAL'}
                </button>
              </div>

              <div className="mt-8 pt-6 border-t border-white/5">
                 <div className="flex items-center gap-2 text-primary-container mb-2">
                    <span className="material-symbols-outlined text-sm">security</span>
                    <span className="font-label text-[8px] uppercase font-black tracking-widest">ARIA Field Intelligence protocol</span>
                 </div>
                 <p className="font-label text-[8px] text-white/20 uppercase leading-relaxed tracking-wider">
                    All field signals are automatically routed through ARIA for severity classification, language translation, and strategic prioritization.
                 </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
