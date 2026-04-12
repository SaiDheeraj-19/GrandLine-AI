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

export default function RaiseIssue() {
  const { lang } = useLanguage();
  const [profile, setProfile] = useState(null);
  const [reporting, setReporting] = useState(false);
  const [intelContent, setIntelContent] = useState('');
  const [intelFile, setIntelFile] = useState(null);
  const [gpsCoords, setGpsCoords] = useState(null);
  const [capturingGps, setCapturingGps] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [volunteers, setVols] = useState([]);

  const mapRef = useRef(null);
  const googleMapRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
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
    if (!db) return;
    return onSnapshot(collection(db, 'volunteers'), snap => {
      setVols(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

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
    if (window.google?.maps) {
      initMap();
    } else {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}`;
      script.async = true;
      script.onload = initMap;
      document.head.appendChild(script);
    }
  }, [initMap]);

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
          ? `AUTO-ALLOCATION: Specialist ${nearbyVol.name} deployed to new ${extracted.issue_type.toUpperCase()} signal`
          : `New Issue Reported: ${extracted.issue_type.toUpperCase()} in ${profile?.district || 'Alpha Sector'}`,
        state: profile?.location?.state || 'Unknown',
        timestamp: serverTimestamp()
      });

      toast.success('Intelligence Ingested Successfully', { id: loadToast });
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
             <h1 className="font-headline text-lg tracking-[0.3em] uppercase font-bold text-primary">Emergency Signal Deck</h1>
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
           </div>

           <div className="w-full lg:w-[480px] bg-background/80 backdrop-blur-2xl flex flex-col overflow-hidden border-l border-white/5 p-6 h-full">
              <div className="relative overflow-hidden p-6 bg-primary/5 border border-primary/20 group h-full flex flex-col">
                <div className="mb-6">
                   <h2 className="font-headline text-2xl font-bold text-primary uppercase tracking-tighter">Emergency Signal Uplink</h2>
                   <p className="font-label text-[10px] text-white/30 uppercase mt-1">Direct ARIA Intelligence Node</p>
                </div>

                <div className="flex items-center justify-between p-4 bg-black/40 border border-[#1e2535] rounded-sm mb-6">
                   <div className="flex items-center gap-3">
                      <span className={`material-symbols-outlined text-sm ${gpsCoords ? 'text-primary animate-pulse' : 'text-white/10'}`}>
                         {gpsCoords ? 'location_searching' : 'location_disabled'}
                      </span>
                      <p className="font-mono text-[10px] text-primary">
                         {gpsCoords ? `${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lng.toFixed(4)}` : 'SIGNAL OFFLINE'}
                      </p>
                   </div>
                   <button onClick={captureGps} disabled={capturingGps} className={`px-4 py-2 font-label text-[9px] uppercase tracking-widest font-black transition-all border ${gpsCoords ? 'border-[#ffd166] text-primary bg-[#ffd166]/10' : 'border-white/10 text-on-surface/40 hover:border-[#ffd166] hover:text-primary'}`}>
                      {capturingGps ? 'Locking...' : gpsCoords ? 'Recalibrate' : 'Share GPS'}
                   </button>
                </div>

                <div className="relative flex-1 mb-6">
                  <textarea
                    value={intelContent}
                    onChange={e => setIntelContent(e.target.value)}
                    placeholder="> AWAITING TEXTURAL INTEL..."
                    className="w-full h-full bg-black/80 shadow-inner border border-[#1e2535] p-6 text-sm font-mono text-primary focus:border-[#ffd166]/50 outline-none transition-all placeholder:text-primary/20 resize-none"
                  />
                  
                  <div className="absolute top-4 right-4 flex flex-col gap-3">
                    <button 
                      type="button"
                      onClick={async () => {
                        if (!isRecording) {
                          try {
                            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                            const mediaRecorder = new MediaRecorder(stream);
                            mediaRecorderRef.current = mediaRecorder;
                            audioChunksRef.current = [];
                            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
                            mediaRecorder.onstop = async () => {
                              const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                              const formData = new FormData();
                              formData.append('file', audioBlob, 'intel.wav');
                              formData.append('model', 'saaras:v3');
                              const langMap = { hi: 'hi-IN', te: 'te-IN', tm: 'ta-IN', ml: 'ml-IN', mr: 'mr-IN', bn: 'bn-IN', gu: 'gu-IN', kn: 'kn-IN', pa: 'pa-IN', en: 'en-IN' };
                              formData.append('language_code', langMap[lang] || 'en-IN');
                              const loadToast = toast.loading('Sarvam — Processing Neural Link...');
                              try {
                                const response = await fetch('https://api.sarvam.ai/speech-to-text', {
                                  method: 'POST',
                                  headers: { 'api-subscription-key': 'sk_39c5ri93_We8aEsffU6hHfWNnCRy9Hm2F' },
                                  body: formData
                                });
                                const data = await response.json();
                                if (data.transcript) {
                                  setIntelContent(prev => prev + (prev ? ' ' : '') + data.transcript);
                                  toast.success('Intelligence Synchronized', { id: loadToast });
                                }
                              } catch (err) { toast.error('Sarvam Error: ' + err.message, { id: loadToast }); }
                            };
                            mediaRecorder.start();
                            setIsRecording(true);
                            toast('Sarvam Link Active', { icon: '🤖' });
                          } catch (err) { toast.error('Audio Error: ' + err.message); }
                        } else {
                          if (mediaRecorderRef.current) {
                            mediaRecorderRef.current.stop();
                            mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
                          }
                          setIsRecording(false);
                        }
                      }}
                      className={`w-10 h-10 rounded-full bg-black/40 border transition-all flex items-center justify-center ${isRecording ? 'border-red-500 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'border-white/10 text-white/40 hover:text-primary hover:border-primary'}`}
                    >
                      <span className={`material-symbols-outlined text-lg ${isRecording ? 'animate-pulse' : ''}`}>mic</span>
                    </button>
                    
                    <label className="w-10 h-10 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-white/40 hover:text-primary hover:border-primary transition-all cursor-pointer">
                      <span className="material-symbols-outlined text-lg">image</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) { setIntelFile(file); toast.success(`Payload Attached: ${file.name}`, { icon: '📷' }); }
                      }} />
                    </label>
                  </div>
                </div>

                {isRecording && (
                   <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/30 flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                      <span className="font-label text-[10px] text-red-500 uppercase tracking-widest font-black">Recording Audio stream...</span>
                   </div>
                )}

                {intelFile && (
                  <div className="mb-6 px-4 py-3 bg-primary/10 border border-primary/20 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-primary">
                      <span className="material-symbols-outlined text-sm">attach_file</span>
                      <span className="font-label text-[10px] uppercase tracking-widest truncate">{intelFile.name}</span>
                    </div>
                    <button onClick={() => setIntelFile(null)} className="text-primary hover:scale-110"><span className="material-symbols-outlined text-sm">close</span></button>
                  </div>
                )}

                <button 
                  onClick={handleTransmitSignal}
                  disabled={reporting}
                  className="w-full py-5 bg-primary text-background font-label font-black text-[11px] uppercase tracking-[0.4em] hover:tracking-[0.5em] transition-all flex items-center justify-center gap-3 group shrink-0"
                >
                  {reporting ? 'UPLINKING...' : 'TRANSMIT TACTICAL SIGNAL'}
                  <span className="material-symbols-outlined text-lg transition-transform group-hover:translate-x-1">bolt</span>
                </button>
              </div>
           </div>
        </section>
      </main>
    </div>
  );
}
