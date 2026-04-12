import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const role = localStorage.getItem('grandline_role');
  const uid = localStorage.getItem('grandline_uid');
  // Volunteers listen to their ID. Super Admins listen to the global broadcaster.
  const listenId = role === 'super_admin' ? 'super_admin_broadcaster' : uid;

  useEffect(() => {
    if (!db || !listenId) return;
    
    // Listen for unread notifications for this role/user
    const q = query(
      collection(db, 'notifications'), 
      where('userId', '==', listenId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [listenId]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (notifId) => {
    try {
      await updateDoc(doc(db, 'notifications', notifId), { read: true });
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 rounded-full hover:bg-white/5 transition-colors group"
      >
        <span className={`material-symbols-outlined text-2xl ${unreadCount > 0 ? 'text-[#ffd166] animate-bounce-tactical' : 'text-white/40'}`}>
          notifications
        </span>
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-error text-white text-[8px] font-black flex items-center justify-center rounded-full border-2 border-[#0f131e]">
            {unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-4 w-80 max-h-96 bg-[#0f131e]/98 backdrop-blur-2xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] z-[100] overflow-hidden flex flex-col">
          <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/2">
             <span className="font-headline text-[10px] font-black uppercase tracking-[0.2em] text-[#ffd166]">Tactical Intel Feed</span>
             <button onClick={() => setShowDropdown(false)} className="material-symbols-outlined text-white/20 hover:text-white text-sm">close</button>
          </div>
          
          <div className="overflow-y-auto custom-scrollbar flex-1">
            {notifications.length === 0 ? (
              <div className="p-8 text-center opacity-20 flex flex-col items-center gap-2">
                 <span className="material-symbols-outlined text-3xl">inbox</span>
                 <p className="font-label text-[10px] uppercase tracking-widest">No Signals Detected</p>
              </div>
            ) : (
              notifications.map(notif => (
                <div 
                  key={notif.id}
                  onClick={() => markAsRead(notif.id)}
                  className={`p-4 border-b border-white/5 cursor-pointer transition-all hover:bg-white/5 relative ${!notif.read ? 'bg-primary-container/2' : 'opacity-40'}`}
                >
                  {!notif.read && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-container"></div>}
                  <div className="flex items-start gap-3">
                     <span className={`material-symbols-outlined text-base ${notif.type === 'deployment' ? 'text-primary-container' : 'text-secondary'}`}>
                        {notif.type === 'deployment' ? 'rocket_launch' : 'person_pin'}
                     </span>
                     <div className="flex-1">
                        <p className="font-body text-[10px] text-white/90 leading-tight mb-1">{notif.message}</p>
                        <p className="font-label text-[7px] text-white/20 uppercase tracking-tighter">
                          {notif.createdAt?.toDate().toLocaleTimeString()} · {notif.type}
                        </p>
                     </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-3 bg-white/2 text-center">
             <span className="font-label text-[8px] text-white/10 uppercase tracking-[0.4em]">End of Transmission</span>
          </div>
        </div>
      )}
    </div>
  );
}
