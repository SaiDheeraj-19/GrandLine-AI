import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, orderBy, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../firebase.js';
import Sidebar from '../components/Sidebar.jsx';
import NotificationBell from '../components/NotificationBell.jsx';
import toast from 'react-hot-toast';

const SKILLS = ['medical','rescue','food','logistics','shelter','water','counselling','general'];
const SKILL_COLORS = {
  medical:'#ef4444', rescue:'#f97316', food:'#22c55e',
  logistics:'#3b82f6', shelter:'#8b5cf6', water:'#06b6d4',
  counselling:'#ec4899', general:'#6b7280',
};

export default function StateAdminVolunteers() {
  const userState = localStorage.getItem('grandline_state') || 'N/A';
  
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVol, setSelectedVol] = useState(null);
  const [volEvents, setVolEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  
  // Modal states
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', district: '', skill: 'rescue' });
  const [creds, setCreds] = useState(null);

  // Fetch state volunteers
  useEffect(() => {
    const q = query(
      collection(db, 'volunteers'),
      where('state', '==', userState)
    );
    return onSnapshot(q, snap => {
      setVolunteers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [userState]);

  // Fetch single volunteer activity
  useEffect(() => {
    if (!selectedVol) { setVolEvents([]); return; }
    setEventsLoading(true);
    const q = query(
      collection(db, 'events'),
      where('userId', '==', selectedVol.id),
      orderBy('timestamp', 'desc')
    );
    return onSnapshot(q, snap => {
      setVolEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setEventsLoading(false);
    });
  }, [selectedVol]);

  const generateCreds = () => {
    const randId = Math.floor(1000 + Math.random() * 9000);
    const email = `vol${randId}@grandline.ai`;
    const password = `pass${Math.floor(100 + Math.random()*900)}`;
    return { email, password };
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const t = toast.loading('Generating Volunteer ID & Access Credentials...');
    try {
      const generated = generateCreds();
      
      const newVol = {
        name: formData.name,
        phone: formData.phone,
        email: generated.email,
        temporary_password: generated.password, // Only display once!
        skill: formData.skill,
        skills: [formData.skill],
        district: formData.district,
        state: userState,
        location: { state: userState, area_name: formData.district, lat: 20, lng: 80 }, // Mock coord, they update via GPS
        status: 'available',
        role: 'volunteer',
        createdAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'volunteers'), newVol);
      
      await addDoc(collection(db, 'events'), {
        type: 'status_update',
        userId: docRef.id,
        state: userState,
        message: `Registered as ${formData.skill} specialist in ${formData.district}`,
        timestamp: serverTimestamp()
      });

      toast.success('Registration Complete', { id: t });
      setCreds({ ...generated, name: formData.name });
      setFormData({ name: '', phone: '', district: '', skill: 'rescue' });
      setShowAdd(false);
    } catch(err) {
      toast.error('Error: ' + err.message, { id: t });
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    const t = toast.loading('Updating...');
    try {
      await updateDoc(doc(db, 'volunteers', selectedVol.id), {
        name: formData.name,
        phone: formData.phone,
        district: formData.district,
        skill: formData.skill,
        skills: [formData.skill]
      });
      toast.success('Updated successfully', { id: t });
      setShowEdit(false);
      setSelectedVol(prev => ({ ...prev, ...formData, skills: [formData.skill] }));
    } catch(err) {
      toast.error('Update failed: ' + err.message, { id: t });
    }
  };

  const handleDelete = async (vid) => {
    if(!window.confirm("Are you sure you want to permanently delete this volunteer record?")) return;
    try {
      await deleteDoc(doc(db, 'volunteers', vid));
      if (selectedVol?.id === vid) setSelectedVol(null);
      toast.success('Record Deleted');
    } catch(err) {
      toast.error('Deletion failed');
    }
  };

  const toggleStatus = async (vol) => {
    const next = vol.status === 'available' ? 'inactive' : 'available';
    await updateDoc(doc(db, 'volunteers', vol.id), { status: next });
    toast.success(`Status updated to ${next}`, {icon: next === 'available' ? '✅' : '⏸️'});
  };

  return (
    <div className="bg-[#060b14] text-white font-body h-screen overflow-hidden flex">
      <Sidebar />
      <main className="flex-1 ml-20 md:ml-64 h-screen flex flex-col overflow-hidden relative">
        
        <header className="flex-shrink-0 flex items-center justify-between px-6 h-16 bg-[#060b14]/95 backdrop-blur border-b border-white/[0.06] z-50">
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-[#ffd166] text-2xl">groups</span>
            <div>
              <span className="font-label text-[7px] uppercase tracking-[0.5em] text-[#ffd166]/50 block">Volunteer Management</span>
              <h1 className="font-headline text-base font-black text-white tracking-tight uppercase leading-tight">
                {userState} Volunteer Roster
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <button onClick={() => { setShowAdd(true); setCreds(null); }} className="flex items-center gap-2 px-4 py-2 bg-[#ffd166]/10 border border-[#ffd166]/30 text-[#ffd166] font-label text-[9px] uppercase font-black hover:bg-[#ffd166]/20 transition-all">
                <span className="material-symbols-outlined text-sm">person_add</span>
                Onboard Volunteer
             </button>
             <NotificationBell />
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          
          {/* Vol List */}
          <div className="w-full lg:w-7/12 border-r border-white/5 flex flex-col overflow-hidden bg-[#060b14]">
            {creds && (
              <div className="m-4 p-4 border-2 border-green-500/40 bg-green-500/10 rounded-sm">
                 <div className="flex items-center gap-2 mb-2 text-green-400">
                   <span className="material-symbols-outlined">how_to_reg</span>
                   <p className="font-headline font-black text-sm uppercase">Success: Access Generated</p>
                 </div>
                 <p className="font-label text-[9px] text-green-100/60 uppercase tracking-widest mb-4">Provide these strictly to {creds.name} to login via Field Center.</p>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-[#060b14] border border-green-500/20">
                       <p className="text-[7px] font-label text-green-400/50 uppercase tracking-widest mb-1">User ID / Email</p>
                       <p className="font-mono text-sm text-green-400 font-bold">{creds.email}</p>
                    </div>
                    <div className="p-3 bg-[#060b14] border border-green-500/20">
                       <p className="text-[7px] font-label text-green-400/50 uppercase tracking-widest mb-1">Passkey</p>
                       <p className="font-mono text-sm text-[#ffd166] font-bold">{creds.password}</p>
                    </div>
                 </div>
                 <button onClick={() => setCreds(null)} className="mt-4 text-[8px] font-label text-green-400/50 hover:text-green-400 uppercase tracking-[0.2em] underline">Clear Confirmation</button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {loading && <div className="animate-pulse text-white/20 p-4 font-label uppercase text-xs">Scanning registry...</div>}
              {volunteers.map(vol => (
                <div key={vol.id} onClick={() => setSelectedVol(vol)}
                     className={`flex items-center justify-between p-4 border cursor-pointer transition-all ${selectedVol?.id === vol.id ? 'bg-white/[0.04] border-[#ffd166]/40' : 'bg-white/[0.01] border-white/5 hover:border-white/10'}`}>
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 border border-white/10 flex items-center justify-center bg-white/5" style={{borderColor: `${SKILL_COLORS[vol.skill]}40`}}>
                        <span className="material-symbols-outlined text-lg" style={{color: SKILL_COLORS[vol.skill] || '#999'}}>person</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-headline font-black text-sm">{vol.name}</p>
                          <span className={`px-2 py-0.5 border text-[6px] font-label uppercase font-black tracking-widest ${vol.status==='available'?'bg-green-500/10 border-green-500/30 text-green-400': vol.status==='assigned' ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/10 text-white/30'}`}>
                            {vol.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 opacity-60 flex-wrap">
                           <span className="font-label text-[8px] uppercase tracking-widest flex items-center gap-1"><span className="material-symbols-outlined text-[10px]">badge</span>{vol.email}</span>
                           <span className="font-label text-[8px] uppercase tracking-widest flex items-center gap-1"><span className="material-symbols-outlined text-[10px]">key</span>{vol.temporary_password || '********'}</span>
                           <span className="font-label text-[8px] uppercase tracking-widest flex items-center gap-1"><span className="material-symbols-outlined text-[10px]">location_on</span>{vol.district}</span>
                        </div>
                      </div>
                   </div>
                   <div className="flex gap-2">
                      <button onClick={(e) => { e.stopPropagation(); toggleStatus(vol); }} className="p-2 border border-white/10 text-white/30 hover:text-white hover:border-white/30 transition-all group" title="Toggle Status">
                        <span className="material-symbols-outlined text-sm">{vol.status === 'available' ? 'pause' : 'play_arrow'}</span>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setSelectedVol(vol); setFormData({name:vol.name, phone:vol.phone||'', skill:vol.skill||'rescue', district: vol.district}); setShowEdit(true); }} className="p-2 border border-white/10 text-blue-400/50 hover:text-blue-400 hover:border-blue-400/30 transition-all group" title="Edit">
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(vol.id); }} className="p-2 border border-white/10 text-red-500/50 hover:text-red-500 hover:border-red-500/30 transition-all group" title="Delete">
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                   </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity / Edit Side Panel */}
          <div className="w-full lg:w-5/12 bg-[#07090f] flex flex-col">
            {showAdd || showEdit ? (
              <div className="p-6">
                 <h2 className="font-headline font-black text-xl uppercase mb-6 flex items-center gap-2">
                   <span className="material-symbols-outlined text-[#ffd166]">{showEdit ? 'edit_square' : 'person_add'}</span>
                   {showEdit ? 'Modify Volunteer' : 'Volunteer Onboarding'}
                 </h2>
                 <form onSubmit={showEdit ? handleEdit : handleAdd} className="space-y-4">
                    <div>
                      <label className="font-label text-[8px] uppercase text-white/40 tracking-widest block mb-1">Full Name</label>
                      <input type="text" required value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} className="w-full bg-[#060b14] border border-white/10 p-3 text-sm font-body text-white outline-none focus:border-[#ffd166]/50" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="font-label text-[8px] uppercase text-white/40 tracking-widest block mb-1">District</label>
                        <input type="text" required value={formData.district} onChange={e=>setFormData({...formData, district:e.target.value})} className="w-full bg-[#060b14] border border-white/10 p-3 text-sm font-body text-white outline-none focus:border-[#ffd166]/50" />
                      </div>
                      <div>
                        <label className="font-label text-[8px] uppercase text-white/40 tracking-widest block mb-1">Primary Skill</label>
                        <select required value={formData.skill} onChange={e=>setFormData({...formData, skill:e.target.value})} className="w-full bg-[#060b14] border border-white/10 p-3 text-sm font-body text-white outline-none focus:border-[#ffd166]/50">
                          {SKILLS.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="font-label text-[8px] uppercase text-white/40 tracking-widest block mb-1">Contact Phone</label>
                      <input type="text" value={formData.phone} onChange={e=>setFormData({...formData, phone:e.target.value})} className="w-full bg-[#060b14] border border-white/10 p-3 text-sm font-body text-white outline-none focus:border-[#ffd166]/50" />
                    </div>
                    <div className="pt-4 flex gap-3">
                      <button type="submit" className="flex-1 bg-[#ffd166] text-[#060b14] font-headline font-black text-xs uppercase tracking-widest py-4 hover:translate-y-[-2px] transition-transform">
                        {showEdit ? 'Save Changes' : 'Generate Identity'}
                      </button>
                      <button type="button" onClick={() => { setShowAdd(false); setShowEdit(false); }} className="px-6 border border-white/10 text-white/40 font-label text-[9px] uppercase font-bold tracking-widest hover:text-white hover:border-white/30">
                        Cancel
                      </button>
                    </div>
                 </form>
              </div>
            ) : selectedVol ? (
              <div className="flex flex-col h-full">
                <div className="p-6 border-b border-white/5 bg-[#060b14] relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-1 h-full" style={{backgroundColor: SKILL_COLORS[selectedVol.skill]}}></div>
                   <p className="font-label text-[8px] uppercase text-white/30 tracking-[0.3em] mb-1">Volunteer Dossier</p>
                   <h2 className="font-headline font-black text-2xl uppercase">{selectedVol.name}</h2>
                   <div className="mt-3 flex gap-2">
                     <span className="px-2 py-1 bg-white/5 border border-white/10 font-label text-[7px] uppercase tracking-widest font-bold flex items-center gap-1 text-white/70">
                       <span className="material-symbols-outlined text-[10px]">star</span> {selectedVol.skill}
                     </span>
                     <span className="px-2 py-1 bg-white/5 border border-white/10 font-label text-[7px] uppercase tracking-widest font-bold flex items-center gap-1 text-white/70">
                       <span className="material-symbols-outlined text-[10px]">pin_drop</span> {selectedVol.district}
                     </span>
                   </div>
                </div>
                
                <div className="p-4 border-b border-white/5 bg-white/[0.01]">
                   <span className="font-label text-[9px] uppercase font-black text-[#ffd166] flex items-center gap-2">
                     <span className="material-symbols-outlined text-sm">history</span> Operational Activity Log
                   </span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                   {eventsLoading && <p className="text-[10px] text-white/30 font-mono uppercase">Decoding stream...</p>}
                   {!eventsLoading && volEvents.length === 0 && <p className="text-[9px] text-white/20 font-label uppercase tracking-widest opacity-50 flex items-center gap-2"><span className="material-symbols-outlined">hide_source</span> No field reports recorded</p>}
                   {volEvents.map(ev => (
                      <div key={ev.id} className="relative pl-6 border-l border-white/10 pb-4 last:pb-0">
                         <div className="absolute left-[-5px] top-0.5 w-2 h-2 rounded-full bg-[#ffd166]/50 ring-4 ring-[#07090f]"></div>
                         <p className="font-label text-[7px] uppercase text-[#ffd166]/60 tracking-widest mb-1">{ev.timestamp?.toDate().toLocaleString('en-IN')}</p>
                         <p className="font-body text-[11px] text-white/80">{ev.message}</p>
                         {ev.type && <span className="inline-block mt-2 font-mono text-[7px] bg-white/5 px-1 py-0.5 uppercase text-white/40">{ev.type}</span>}
                      </div>
                   ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-white/10 gap-4">
                <span className="material-symbols-outlined text-6xl">badge</span>
                <p className="font-label text-[10px] uppercase tracking-[0.2em]">Select volunteer to view activity</p>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
