import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase.js';
import Sidebar from '../components/Sidebar.jsx';
import toast from 'react-hot-toast';
import { useLanguage } from '../utils/i18n.jsx';
import { extractIntelFrontend } from '../utils/gemini.js';
import NotificationBell from '../components/NotificationBell.jsx';
import BroadcastReceiver from '../components/BroadcastReceiver.jsx';

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
  const { t, lang } = useLanguage();
  const [profile, setProfile] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [volunteers, setVols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reporting, setReporting] = useState(false);
  const [intelType, setIntelType] = useState('text'); 
  const [intelContent, setIntelContent] = useState('');
  const [intelFile, setIntelFile] = useState(null);
  const [gpsCoords, setGpsCoords] = useState(null);
  const [capturingGps, setCapturingGps] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [verifyingTaskId, setVerifyingTaskId] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const verifyFileRef = useRef(null);

  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const markersRef = useRef([]);
  const mapReadyRef = useRef(false);

  useEffect(() => {
    if (!auth.currentUser || !db) return;
    const q = query(collection(db, 'volunteers'), where('email', '==', auth.currentUser.email));
    return onSnapshot(q, snap => {
      if (!snap.empty) {
        setProfile({ id: snap.docs[0].id, ...snap.docs[0].data() });
      }
    });
  }, []);

  useEffect(() => {
    if (!profile || !db) return;
    const q = query(collection(db, 'issues'), where('routed_to_volunteer_id', '==', profile.id));
    return onSnapshot(q, snap => {
      const allTasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTasks(allTasks.filter(t => t.status !== 'completed'));
      setLoading(false);
    });
  }, [profile]);

  useEffect(() => {
    if (!db) return;
    return onSnapshot(collection(db, 'volunteers'), snap => {
      setVols(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  const updateTaskStatus = async (taskId, newStatus) => {
    const loadToast = toast.loading(`Updating Mission Status: ${newStatus}...`);
    try {
      await updateDoc(doc(db, 'issues', taskId), {
        status: newStatus,
        last_updated: serverTimestamp()
      });
      await addDoc(collection(db, 'events'), {
        type: 'status_update',
        message: `Task Status: ${newStatus.toUpperCase()} - Updated by Specialist ${profile?.name}`,
        state: profile?.location?.state || 'Unknown',
        timestamp: serverTimestamp()
      });
      toast.success(`Mission Status Synchronized: ${newStatus.toUpperCase()}`, { id: loadToast });
    } catch (err) {
      toast.error('Sync error: ' + err.message, { id: loadToast });
    }
  };

   const handleVerification = async (e) => {
    const file = e.target.files[0];
    if (!file || !verifyingTaskId) return;

    const loadToast = toast.loading('ARIA — Processing Visual Verification...');
    try {
      await new Promise(r => setTimeout(r, 2000));
      await updateDoc(doc(db, 'issues', verifyingTaskId), {
         status: 'completed',
         last_updated: serverTimestamp(),
         verified: true
      });
      await addDoc(collection(db, 'events'), {
        type: 'completed',
        message: `Mission Verified: Sector Secured by Specialist ${profile?.name}`,
        state: profile?.location?.state || 'Unknown',
        timestamp: serverTimestamp()
      });
      setVerifyingTaskId(null);
      toast.success('Sector Verified & Secured', { id: loadToast });
    } catch (err) {
      toast.error('Verification failed: ' + err.message, { id: loadToast });
    }
  };

  const initMap = useCallback(() => {
    if (!mapRef.current || !window.google?.maps) return;
    if (googleMapRef.current) return;
    
    try {
      const center = DISTRICT_CENTERS[profile?.district] || STATE_CENTERS[profile?.location?.state] || { lat: 20, lng: 78 };
      googleMapRef.current = new window.google.maps.Map(mapRef.current, {
        center, zoom: 12, styles: MAP_STYLE, disableDefaultUI: true,
      });
      mapReadyRef.current = true;
    } catch (err) {
      console.error("Map init error:", err);
    }
  }, [profile]);

  useEffect(() => {
    if (googleMapRef.current && profile) {
      const center = DISTRICT_CENTERS[profile?.district] || STATE_CENTERS[profile?.location?.state] || { lat: 20, lng: 78 };
      googleMapRef.current.setCenter(center);
      googleMapRef.current.setZoom(12);
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
    activeTasks.forEach(task => {
      if (!task.location?.lat || !task.location?.lng) return;
      const pos = { lat: Number(task.location.lat), lng: Number(task.location.lng) };
      try {
        const marker = new window.google.maps.Marker({
          position: pos,
          map: googleMapRef.current,
          title: task.summary || '',
          icon: {
            path: 'M 0,-14 C -6,-14 -10,-8 -10,-3 C -10,6 0,14 0,14 C 0,14 10,6 10,-3 C 10,-8 6,-14 0,-14 Z',
            fillColor: '#ffd166', fillOpacity: 0.9,
            strokeColor: '#ffd166', strokeWeight: 1, scale: 1, anchor: new window.google.maps.Point(0, 14),
          }
        });
        markersRef.current.push(marker);
      } catch (e) {}
    });
  }, [tasks]);

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

  const handleTransmitSignal = async () => {
    if (!intelContent) return toast.error('Signal transmission requires payload');
    setReporting(true);
    const loadToast = toast.loading('ARIA — Processing Tactical Signal...');
    try {
      const extracted = await extractIntelFrontend(intelContent);
      
      // Smart Allocation: Find nearby available volunteer with MATCHING SKILLS
      const targetSkill = extracted.issue_type === 'medical' ? 'medical' : 
                          extracted.issue_type === 'flood' ? 'rescue' :
                          extracted.issue_type === 'fire' ? 'rescue' :
                          extracted.issue_type === 'food' ? 'food' : 'general';

      const nearbyVol = volunteers.find(v => 
        v.status === 'available' && 
        v.location?.state === profile?.location?.state && 
        v.id !== profile?.id &&
        (v.skills || []).includes(targetSkill)
      );
      
      const payload = {
        ...extracted,
        source: 'field_worker',
        status: nearbyVol ? 'assigned' : 'pending',
        routing_status: nearbyVol ? 'deployed' : 'pending',
        reporter_id: profile?.id || 'anonymous_field',
        timestamp: serverTimestamp(),
        location: {
          area_name: profile?.district || 'Sector Alpha',
          ...(gpsCoords || {}),
          state: profile?.location?.state || 'Unknown'
        }
      };

      if (nearbyVol) {
        payload.routed_to_volunteer_id = nearbyVol.id;
        await updateDoc(doc(db, 'volunteers', nearbyVol.id), { status: 'assigned' });
      }

      await addDoc(collection(db, 'issues'), payload);

      await addDoc(collection(db, 'events'), {
        type: nearbyVol ? 'assignment' : 'issue_created',
        message: nearbyVol 
          ? `AUTO-ALLOCATION: Specialist ${nearbyVol.name} (${targetSkill.toUpperCase()}) deployed to new ${extracted.issue_type.toUpperCase()} signal`
          : `New Issue Reported: ${extracted.issue_type.toUpperCase()} in ${profile?.district || 'Alpha Sector'} - STANDBY FOR SPECIALIST`,
        state: profile?.location?.state || 'Unknown',
        timestamp: serverTimestamp()
      });

      if (nearbyVol) {
        toast.success(`ARIA: Auto-Allocated ${targetSkill.toUpperCase()} Specialist ${nearbyVol.name}`, { icon: '🤖' });
      } else {
        toast.success(`Intelligence Ingested: Awaiting ${targetSkill.toUpperCase()} Specialist`, { id: loadToast });
      }
      setIntelContent('');
      setGpsCoords(null);
      setIntelFile(null);
    } catch (err) {
      toast.error('Uplink Failed: ' + err.message, { id: loadToast });
    } finally {
      setReporting(false);
    }
  };

  return (
    <div className="bg-background text-on-surface font-body min-h-screen dot-grid relative">
      <Sidebar />
      <BroadcastReceiver />

      <main className="ml-20 md:ml-64 flex-1 flex flex-col min-w-0">
        <header className="flex justify-between items-center w-full px-6 h-16 bg-background/90 backdrop-blur-xl border-b border-on-surface/5 z-20">
          <div className="flex items-center gap-4">
             <div className="w-2 h-2 rounded-full bg-primary-container animate-pulse shadow-[0_0_8px_#ffd166]"></div>
             <h1 className="font-headline text-lg tracking-[0.3em] uppercase font-bold text-primary">Field Operations Deck</h1>
          </div>
          <div className="flex items-center gap-6">
            <NotificationBell />
            <div className="h-8 w-px bg-white/5"></div>
            {profile && (
              <div className="flex items-center gap-3">
                <span className="font-label text-[9px] text-on-surface/40 uppercase tracking-widest hidden sm:block">Specialist: {profile.name}</span>
                <div className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                   <span className="material-symbols-outlined text-sm text-primary-container">person</span>
                </div>
              </div>
            )}
          </div>
        </header>

        <section className="flex-1 flex flex-col lg:flex-row overflow-hidden h-[calc(100vh-64px)]">
           <div className="flex-1 relative bg-[#07090f] border-r border-white/5">
               <div ref={mapRef} className="absolute inset-0 z-0"></div>
               <div className="absolute top-4 left-4 z-10">
                  <div className="bg-[#0f131e]/90 backdrop-blur-md border border-[#ffd166]/20 px-4 py-2 flex items-center gap-3">
                     <span className="w-2 h-2 rounded-full bg-[#ffd166] animate-pulse"></span>
                     <span className="font-label text-[8px] uppercase tracking-[0.3em] text-primary font-bold">Operational Sector Map</span>
                  </div>
               </div>
           </div>

           <div className="w-full lg:w-[480px] bg-background/80 backdrop-blur-2xl flex flex-col overflow-hidden border-l border-white/5 p-6 h-full">
            <div className="flex justify-between items-end border-b border-white/5 pb-4">
               <div>
                  <p className="font-label text-[9px] uppercase tracking-widest text-white/20">Authorized Targets</p>
                  <h2 className="font-headline text-2xl font-bold uppercase tracking-tight text-primary">Your Missions</h2>
               </div>
                <span className="font-label text-[10px] text-on-surface/40 uppercase tracking-widest">{tasks.length} Active Briefs</span>
            </div>

             <div className="flex-1 overflow-y-auto pt-6 space-y-4" style={{ scrollbarWidth: 'none' }}>
                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                  <div>
                    <p className="font-label text-[9px] uppercase tracking-widest text-white/20">Authorized Targets</p>
                    <h2 className="font-headline text-lg font-bold uppercase tracking-tight text-primary">Your Missions</h2>
                  </div>
                  <span className="font-label text-[9px] text-on-surface/40 uppercase tracking-widest">{tasks.length} Active</span>
                </div>

                {loading ? (
                  <div className="animate-pulse space-y-4">
                     {[1,2].map(i => <div key={i} className="h-32 bg-white/5 rounded-sm"></div>)}
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="h-32 bg-[#0a0e19] shadow-[inset_0_0_20px_rgba(255,255,255,0.02)] border border-dashed border-[#1e2535] flex flex-col items-center justify-center gap-2 opacity-50">
                     <span className="material-symbols-outlined text-2xl text-white/20">radar</span>
                     <p className="font-label text-[8px] uppercase tracking-widest text-on-surface/40">Radar Clear — Standby</p>
                  </div>
                ) : tasks.map(task => {
                  const isCrit = task.urgency_score >= 80;
                  return (
                   <div key={task.id} className={`group relative p-4 border ${isCrit ? 'border-red-500/30' : 'border-white/10'} bg-white/[0.02] hover:bg-white/[0.04] transition-all overflow-hidden`}>
                     <div className="relative z-10">
                       <div className="flex items-center gap-3 mb-2 text-white/80">
                          <div className={`p-1.5 rounded-sm bg-white/5 border border-white/10 ${isCrit ? 'text-red-500' : 'text-primary'}`}>
                            <span className="material-symbols-outlined text-lg">
                               {task.issue_type === 'medical' ? 'medical_services' : task.issue_type === 'flood' ? 'waves' : 'warning_emerald'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-headline text-xs font-black uppercase tracking-tight truncate">{task.issue_type}</h3>
                            <p className="font-label text-[7px] uppercase tracking-widest text-white/30">{task.location?.area_name}</p>
                          </div>
                       </div>
                       <p className="font-body text-[9px] text-white/60 mb-2 truncate">"{task.summary}"</p>
                       
                       <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-white/5">
                        {task.status === 'in_progress' ? (
                          <label className="col-span-2 cursor-pointer">
                            <div className="w-full py-2 bg-green-500 text-white font-label text-[8px] uppercase font-black tracking-[0.2em] hover:bg-green-600 transition-all text-center">
                               Visual Verification Required
                            </div>
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*"
                              onChange={(e) => {
                                setVerifyingTaskId(task.id);
                                handleVerification(e);
                              }}
                            />
                          </label>
                        ) : (
                          <button 
                            onClick={() => updateTaskStatus(task.id, 'in_progress')}
                            className="col-span-2 py-2 border border-primary text-primary font-label text-[8px] uppercase font-black tracking-[0.2em] hover:bg-primary/5 transition-all"
                          >
                             En Route / Initiating Signal
                          </button>
                        )}
                      </div>
                     </div>
                   </div>
                  )
                })}
             </div>
           </div>
        </section>
      </main>
    </div>
  );
}
