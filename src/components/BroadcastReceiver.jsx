import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useLanguage } from '../utils/i18n.jsx';

export default function BroadcastReceiver() {
  const { t } = useLanguage();
  const [activeBroadcast, setActiveBroadcast] = useState(null);

  useEffect(() => {
    if (!db) return;
    // Listen for the latest active broadcast within the last hour
    const oneHourAgo = new Date(Date.now() - 3600000);
    const q = query(
      collection(db, 'broadcasts'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const unsub = onSnapshot(q, snap => {
      if (!snap.empty) {
        const data = snap.docs[0].data();
        const broadcastId = snap.docs[0].id;
        const acknowledgedId = localStorage.getItem('grandline_last_broadcast');

        // Show if active, recent, AND not already acknowledged in this browser
        if (data.active && data.timestamp?.toDate() > oneHourAgo && acknowledgedId !== broadcastId) {
          setActiveBroadcast({ id: broadcastId, ...data });
        } else {
          setActiveBroadcast(null);
        }
      } else {
        setActiveBroadcast(null);
      }
    });

    return () => unsub();
  }, []);

  const handleAcknowledge = () => {
    if (activeBroadcast) {
      localStorage.setItem('grandline_last_broadcast', activeBroadcast.id);
      setActiveBroadcast(null);
    }
  };

  if (!activeBroadcast) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-red-950/40 backdrop-blur-md animate-in fade-in duration-500">
      <div className="relative w-full max-w-2xl bg-[#0a0e19] border-2 border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.3)] overflow-hidden">
        {/* Warning Background Pattern */}
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" 
             style={{ backgroundImage: 'repeating-linear-gradient(45deg, #ef4444, #ef4444 10px, transparent 10px, transparent 20px)' }}></div>
        
        {/* Header */}
        <div className="bg-red-500 p-4 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-white animate-pulse">campaign</span>
              <h2 className="font-headline text-lg font-black text-white uppercase tracking-[0.2em]">{t('alert_neural_broadcast')}</h2>
           </div>
           <span className="font-mono text-[10px] text-white/60 font-black">ORIGIN: NATIONAL_COMMAND</span>
        </div>

        <div className="p-8 relative">
           <div className="flex flex-col items-center text-center gap-6">
              <div className="w-16 h-16 rounded-full border-2 border-red-500/20 flex items-center justify-center relative">
                 <div className="absolute inset-0 rounded-full border-2 border-red-500 animate-ping opacity-20"></div>
                 <span className="material-symbols-outlined text-3xl text-red-500">priority_high</span>
              </div>

              <div>
                 <p className="font-label text-[10px] uppercase tracking-[0.3em] text-red-500/60 mb-2">Tactical Command Directive</p>
                 <h3 className="font-headline text-2xl font-black text-white uppercase leading-tight tracking-tight">
                    {activeBroadcast.message}
                 </h3>
              </div>

              <div className="w-full h-px bg-white/5 my-2"></div>

              <p className="font-body text-xs text-white/40 italic">
                 "This signal is a direct override from the National Center. All regional personnel are ordered to prioritize these instructions immediately."
              </p>

              <button 
                onClick={handleAcknowledge}
                className="px-10 py-3 bg-red-500 text-white font-label text-[10px] uppercase font-black tracking-[0.2em] hover:bg-red-600 transition-all shadow-lg"
              >
                 {t('btn_acknowledge')}
              </button>
           </div>
        </div>

        {/* Bottom Status Bar */}
        <div className="bg-black/40 border-t border-white/5 px-4 py-2 flex justify-between">
           <span className="font-mono text-[8px] text-red-500/40">ENCRYPTION: AES-256-GCM</span>
           <span className="font-mono text-[8px] text-red-500/40">SIGNAL STRENGTH: MAXIMUM</span>
        </div>
      </div>
    </div>
  );
}
