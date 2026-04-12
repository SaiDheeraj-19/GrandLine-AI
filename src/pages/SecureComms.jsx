import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, limit, getDocs, where } from 'firebase/firestore';
import { db, auth } from '../firebase.js';
import Sidebar from '../components/Sidebar.jsx';
import NotificationBell from '../components/NotificationBell.jsx';
import toast from 'react-hot-toast';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

export default function SecureComms() {
  const [activeTab, setActiveTab] = useState(''); // 'national', 'state', or 'interstate'
  const [targetState, setTargetState] = useState(''); // For P2P inter-state
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]); // List of states we have talked to
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);
  
  const [selectedProfile, setSelectedProfile] = useState(null);

  const role = localStorage.getItem('grandline_role');
  const userState = localStorage.getItem('grandline_state');

  const handleViewProfile = async (email, senderRole) => {
    if (!email || senderRole !== 'volunteer') return;
    const t = toast.loading('Retrieving volunteer dossier...');
    try {
      const q = query(collection(db, 'volunteers'), where('email', '==', email), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setSelectedProfile({ id: snap.docs[0].id, ...snap.docs[0].data() });
        toast.dismiss(t);
      } else {
        toast.error("Dossier not found or classified.", { id: t });
      }
    } catch (err) {
      toast.error("Decryption failed: " + err.message, { id: t });
    }
  };

  useEffect(() => {
    if (role === 'super_admin') setActiveTab('national');
    else if (role === 'volunteer') setActiveTab('state');
    else setActiveTab('interstate'); // State admin default to inbox
  }, [role]);

  // 1. Listen for ALL interstate messages involving this state to build the "Inbox"
  useEffect(() => {
    if (role !== 'state_admin' || !userState) return;

    const q = query(
      collection(db, 'interstate_messages'),
      where('participants', 'array-contains', userState),
      orderBy('timestamp', 'desc')
    );

    const unsub = onSnapshot(q, snap => {
      const allMsgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Build unique conversations list based on the "other" state
      const threadMap = {};
      allMsgs.forEach(m => {
        const other = m.participants.find(p => p !== userState);
        if (other && !threadMap[other]) {
           threadMap[other] = {
             state: other,
             lastMsg: m.text,
             timestamp: m.timestamp,
             unread: false // Could implement unread logic later
           };
        }
      });
      setConversations(Object.values(threadMap));
    });

    return () => unsub();
  }, [role, userState]);

  useEffect(() => {
    if (!activeTab) return;

    let q;
    if (activeTab === 'national') {
      q = query(collection(db, 'comms_national'), orderBy('timestamp', 'asc'), limit(150));
    } else if (activeTab === 'state') {
      q = query(collection(db, `comms_state_${userState.replace(/\s+/g, '_')}`), orderBy('timestamp', 'asc'), limit(150));
    } else if (activeTab === 'interstate') {
       if (!targetState) {
          setMessages([]);
          return;
       }
       // Query the unified interstate_messages for this specific pair
       const pair = [userState, targetState].sort();
       q = query(
         collection(db, 'interstate_messages'), 
         where('participants', '==', pair),
         orderBy('timestamp', 'asc'), 
         limit(150)
       );
    }

    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    return () => unsub();
  }, [activeTab, userState, targetState]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !activeTab) return;
    if (activeTab === 'interstate' && !targetState) return;

    const msg = input.trim();
    const payload = {
      text: msg,
      senderRole: role,
      senderState: userState,
      senderEmail: auth.currentUser?.email || localStorage.getItem('grandline_uid') || 'Unknown Source',
      senderName: auth.currentUser?.displayName || (auth.currentUser?.email ? auth.currentUser.email.split('@')[0] : 'Unknown Agent'),
      timestamp: serverTimestamp()
    };

    setInput('');

    if (activeTab === 'national') {
      await addDoc(collection(db, 'comms_national'), payload);
    } else if (activeTab === 'state') {
      await addDoc(collection(db, `comms_state_${userState.replace(/\s+/g, '_')}`), payload);
    } else if (activeTab === 'interstate') {
      await addDoc(collection(db, 'interstate_messages'), {
        ...payload,
        receiverState: targetState,
        participants: [userState, targetState].sort()
      });
    }
  };

  if (!role) return null;

  return (
    <div className="bg-[#060b14] text-white font-body h-screen overflow-hidden flex">
      <Sidebar />
      <main className="flex-1 ml-20 md:ml-64 h-screen flex flex-col overflow-hidden relative">
        <header className="flex-shrink-0 flex items-center justify-between px-6 h-16 bg-[#060b14] border-b border-white/[0.06] z-50">
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-blue-400 text-2xl">cell_tower</span>
            <div>
              <span className="font-label text-[7px] uppercase tracking-[0.5em] text-blue-400/50 block">Encrypted Channels</span>
              <h1 className="font-headline text-base font-black text-white tracking-tight uppercase leading-tight">
                Secure Comms Matrix
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <NotificationBell />
          </div>
        </header>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Tabs Sidebar */}
          <div className="w-full md:w-80 flex-shrink-0 bg-[#0a1628]/50 border-r border-white/5 flex flex-col">
            <div className="p-4 border-b border-white/5 font-label text-[10px] uppercase tracking-widest text-[#ffd166]">Communication Nodes</div>
            
            {role === 'state_admin' && (
              <div className="flex flex-col flex-1 overflow-hidden">
                <button 
                  onClick={() => setActiveTab('national')}
                  className={`py-4 px-6 text-left text-xs font-label uppercase tracking-widest transition-all border-l-4 ${activeTab === 'national' ? 'text-[#ffd166] border-[#ffd166] bg-[#ffd166]/5' : 'border-transparent text-white/40 hover:text-white/70 hover:bg-white/5'}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-sm">public</span>
                    National Bridge
                  </div>
                </button>
                <button 
                  onClick={() => setActiveTab('state')}
                  className={`py-4 px-6 text-left text-xs font-label uppercase tracking-widest transition-all border-l-4 ${activeTab === 'state' ? 'text-blue-400 border-blue-400 bg-blue-500/5' : 'border-transparent text-white/40 hover:text-white/70 hover:bg-white/5'}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-sm">shield</span>
                    Tactical ({userState})
                  </div>
                </button>

                <div className="mt-4 px-6 py-2">
                   <p className="font-label text-[8px] uppercase tracking-[0.3em] text-white/20">Interstate Inbox</p>
                </div>

                <div className="flex-1 overflow-y-auto px-2 space-y-1 py-2">
                   {conversations.length === 0 && (
                     <p className="px-4 py-8 text-[9px] font-label text-white/10 uppercase text-center italic">No active state links</p>
                   )}
                   {conversations.map(conv => (
                     <button 
                       key={conv.state}
                       onClick={() => { setActiveTab('interstate'); setTargetState(conv.state); }}
                       className={`w-full p-4 text-left transition-all border border-transparent hover:border-white/10 group ${activeTab === 'interstate' && targetState === conv.state ? 'bg-purple-500/10 border-purple-500/30' : 'bg-white/[0.02]'}`}
                     >
                        <div className="flex justify-between items-start mb-1">
                           <p className={`font-headline text-[10px] font-black uppercase ${activeTab === 'interstate' && targetState === conv.state ? 'text-purple-400' : 'text-white/70'}`}>{conv.state}</p>
                           <span className="text-[7px] font-label text-white/20">{conv.timestamp?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <p className="font-body text-[9px] text-white/30 line-clamp-1 group-hover:text-white/50">{conv.lastMsg}</p>
                     </button>
                   ))}
                </div>

                <button 
                  onClick={() => setActiveTab('interstate')}
                  className={`mt-auto py-5 px-6 text-center text-[10px] font-label uppercase tracking-[0.2em] font-black transition-all border-t border-white/5 text-purple-400 hover:bg-purple-500/10`}
                >
                  + New Connection
                </button>
              </div>
            )}
            
            {role === 'super_admin' && (
              <div className="py-4 px-6 text-left text-xs font-label uppercase tracking-widest border-l-4 border-[#ffd166] text-[#ffd166] bg-[#ffd166]/5">
                National Bridge
              </div>
            )}
            
            {role === 'volunteer' && (
              <div className="py-4 px-6 text-left text-xs font-label uppercase tracking-widest border-l-4 border-blue-400 text-blue-400 bg-blue-500/5">
                {userState} Sector Tactical
              </div>
            )}
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col bg-[#060b14] relative">
            {role === 'state_admin' && activeTab === 'interstate' && (
              <div className="p-4 bg-purple-500/5 border-b border-purple-500/10 flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-purple-400">sync_alt</span>
                  <span className="font-label text-[10px] uppercase tracking-widest text-purple-400 flex-shrink-0">Establish Link with:</span>
                  <select 
                    value={targetState} 
                    onChange={e => setTargetState(e.target.value)}
                    className="bg-[#0a1628] border border-purple-500/20 text-xs font-label uppercase tracking-widest text-purple-100 outline-none p-2 w-64 focus:border-purple-500/50"
                  >
                    <option value="">-- Connect Node --</option>
                    {INDIAN_STATES.filter(s => s !== userState).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                {targetState && !conversations.find(c => c.state === targetState) && (
                  <div className="px-1 text-[9px] font-label text-white/40 uppercase tracking-widest italic animate-pulse">
                    Initiating new encrypted channel with {targetState}...
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-6">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-30">
                  <span className="material-symbols-outlined text-6xl mb-4">radar</span>
                  <span className="font-label text-sm uppercase tracking-widest">No Signals Intercepted</span>
                </div>
              )}
              {messages.map((m) => {
                const matchesUser = m.senderEmail === auth.currentUser?.email || m.senderEmail === localStorage.getItem('grandline_uid');
                const displayName = m.senderName || (m.senderEmail && m.senderEmail.includes('@') ? m.senderEmail.split('@')[0] : 'Unknown Agent');
                return (
                  <div key={m.id} className={`flex flex-col ${matchesUser ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2 mb-1.5 px-1">
                      <span className="font-label text-[9px] uppercase tracking-widest text-white/50">
                        {m.senderState === 'All' ? 'NATCOM' : m.senderState} • {m.senderRole} • 
                        <span 
                          onClick={() => handleViewProfile(m.senderEmail, m.senderRole)} 
                          className={`ml-1 ${m.senderRole === 'volunteer' ? 'cursor-pointer hover:text-white hover:underline decoration-[#ffd166]/50 transition-colors' : ''} text-[#ffd166]`}
                        >
                          {displayName}
                        </span>
                      </span>
                    </div>
                    <div className={`p-4 max-w-[75%] md:max-w-xl text-sm md:text-base font-body shadow-md ${matchesUser ? 'bg-blue-600/20 border border-blue-500/30 text-blue-50 rounded-tl-lg rounded-bl-lg rounded-tr-sm rounded-br-lg' : 'bg-white/5 border border-white/10 text-white/90 rounded-tr-lg rounded-br-lg rounded-tl-sm rounded-bl-lg'}`}>
                      {m.text}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} className="h-4" />
            </div>

            <form onSubmit={sendMessage} className="flex-shrink-0 p-4 md:p-6 bg-[#0a1628]/30 border-t border-white/10 flex gap-4 backdrop-blur-md">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Type transmission..."
                className="flex-1 bg-[#060b14] border border-white/20 p-4 font-body text-white outline-none focus:border-blue-500/50 shadow-inner"
              />
              <button
                type="submit"
                disabled={!input.trim() || (activeTab === 'interstate' && !targetState)}
                className="px-8 bg-blue-500 text-white font-label font-bold text-[10px] uppercase tracking-widest flex items-center justify-center hover:bg-blue-600 disabled:opacity-50 transition-colors shadow-lg"
              >
                Transmit
                <span className="material-symbols-outlined text-base ml-2">send</span>
              </button>
            </form>
          </div>
        </div>

        {/* Volunteer Dossier Overlay */}
        {selectedProfile && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#060b14]/90 backdrop-blur-sm p-6" onClick={() => setSelectedProfile(null)}>
            <div className="bg-[#0a0e19] border border-[#1e2535] shadow-[0_0_50px_rgba(0,0,0,0.8)] max-w-sm w-full relative overflow-hidden" onClick={e => e.stopPropagation()}>
               <div className="absolute top-0 left-0 w-full h-1 bg-[#ffd166]"></div>
               <button onClick={() => setSelectedProfile(null)} className="absolute top-4 right-4 text-white/40 hover:text-white">
                 <span className="material-symbols-outlined text-sm">close</span>
               </button>
               <div className="p-8 pb-6 text-center border-b border-[#1e2535] bg-gradient-to-b from-white/[0.02] to-transparent">
                  <div className="w-16 h-16 rounded-full border border-[#ffd166]/30 bg-[#ffd166]/10 flex items-center justify-center mx-auto mb-4 text-[#ffd166] shadow-[0_0_15px_rgba(255,209,102,0.1)]">
                     <span className="material-symbols-outlined text-2xl">badge</span>
                  </div>
                  <h3 className="font-headline font-black text-xl text-white uppercase tracking-wider">{selectedProfile.name}</h3>
                  <p className="font-label text-[9px] text-[#ffd166] uppercase tracking-[0.2em] mt-1">Field Operative</p>
               </div>
               <div className="p-6 bg-[#060b14] space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <p className="font-label text-[8px] uppercase text-white/30 tracking-widest mb-1">Assigned Zone</p>
                        <p className="font-mono text-xs text-white uppercase">{selectedProfile.district}</p>
                     </div>
                     <div>
                        <p className="font-label text-[8px] uppercase text-white/30 tracking-widest mb-1">State Sector</p>
                        <p className="font-mono text-xs text-white uppercase">{selectedProfile.state}</p>
                     </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <p className="font-label text-[8px] uppercase text-white/30 tracking-widest mb-1">Specialization</p>
                        <p className="font-mono text-xs text-white uppercase flex items-center gap-1">
                           <span className="material-symbols-outlined text-[12px] text-[#ffd166]">star</span>
                           {selectedProfile.skill}
                        </p>
                     </div>
                     <div>
                        <p className="font-label text-[8px] uppercase text-white/30 tracking-widest mb-1">Current Status</p>
                        <span className={`px-2 py-1 border text-[7px] font-label uppercase font-black tracking-widest inline-block ${selectedProfile.status==='available'?'bg-green-500/10 border-green-500/30 text-green-400': selectedProfile.status==='assigned' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-white/30'}`}>
                           {selectedProfile.status}
                        </span>
                     </div>
                  </div>
                  <div className="pt-2">
                     <p className="font-label text-[8px] uppercase text-white/30 tracking-widest mb-1">Comm Channel (Email)</p>
                     <p className="font-mono text-[9px] text-white/60 lowercase">{selectedProfile.email}</p>
                  </div>
               </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
