import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
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

export default function SuperAdminPersonnel() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showAdd, setShowAdd] = useState(false);
  const [selectedState, setSelectedState] = useState('Kerala');
  const [formData, setFormData] = useState({ name: '', phone: '' });

  useEffect(() => {
    const q = query(collection(db, 'state_admins'), orderBy('state', 'asc'));
    return onSnapshot(q, snap => {
      setAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    const t = toast.loading('Provisioning Sector Command Access...');
    try {
      // Check if state admin already exists for this state
      if (admins.find(a => a.state === selectedState)) {
         return toast.error(`A State Admin is already assigned to ${selectedState}`, { id: t });
      }

      const email = `admin_${selectedState.toLowerCase().replace(/\s+/g, '')}@grandline.ai`;
      const pass = `SEC-${Math.floor(1000 + Math.random()*9000)}`;

      await addDoc(collection(db, 'state_admins'), {
        state: selectedState,
        name: formData.name || 'Sector Controller',
        phone: formData.phone,
        email: email,
        temporary_password: pass,
        status: 'active',
        role: 'state_admin',
        createdAt: serverTimestamp()
      });

      toast.success('Sector Controller Provisioned!', { id: t });
      setFormData({ name: '', phone: '' });
      setShowAdd(false);
    } catch(err) {
      toast.error('Error: ' + err.message, { id: t });
    }
  };

  const handleDelete = async (vid) => {
    if(!window.confirm("Terminate this Sector Admin's access immediately?")) return;
    try {
      await deleteDoc(doc(db, 'state_admins', vid));
      toast.success('Clearance Revoked');
    } catch(err) {
      toast.error('Revocation failed');
    }
  };

  return (
    <div className="bg-[#060b14] text-white font-body h-screen overflow-hidden flex">
      <Sidebar />
      <main className="flex-1 ml-20 md:ml-64 h-screen flex flex-col overflow-hidden relative">
        <header className="flex-shrink-0 flex items-center justify-between px-6 h-16 bg-[#060b14]/95 backdrop-blur border-b border-white/[0.06] z-50">
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-[#ffd166] text-2xl">admin_panel_settings</span>
            <div>
              <span className="font-label text-[7px] uppercase tracking-[0.5em] text-[#ffd166]/50 block">National Command Overlay</span>
              <h1 className="font-headline text-base font-black text-white tracking-tight uppercase leading-tight">
                Sector Admin Management
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-500 font-label text-[9px] uppercase font-black hover:bg-red-500/20 transition-all">
                <span className="material-symbols-outlined text-sm">security_update_good</span>
                Provision Sector
             </button>
             <NotificationBell />
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 md:p-10 flex gap-6">
           {showAdd && (
              <div className="w-1/3 bg-[#07090f] border border-white/5 p-6 h-fit shrink-0">
                 <h2 className="font-headline font-black text-xl uppercase mb-6 text-red-500">Provision Sector Control</h2>
                 <form onSubmit={handleAdd} className="space-y-4">
                    <div>
                      <label className="font-label text-[8px] uppercase text-white/40 tracking-widest block mb-1">State / Territory</label>
                      <select required value={selectedState} onChange={e=>setSelectedState(e.target.value)} className="w-full bg-[#060b14] border border-white/10 p-3 text-sm font-body text-white outline-none focus:border-red-500/50">
                        {INDIAN_STATES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="font-label text-[8px] uppercase text-white/40 tracking-widest block mb-1">Controller Name</label>
                      <input type="text" required value={formData.name} onChange={e=>setFormData({...formData, name:e.target.value})} className="w-full bg-[#060b14] border border-white/10 p-3 text-sm font-body text-white outline-none focus:border-red-500/50" />
                    </div>
                    <div className="pt-4 flex gap-3">
                      <button type="submit" className="flex-1 bg-red-500 text-white font-headline font-black text-xs uppercase tracking-widest py-4 hover:bg-red-600 transition-colors">
                        Generate Identity
                      </button>
                      <button type="button" onClick={() => setShowAdd(false)} className="px-6 border border-white/10 text-white/40 font-label text-[9px] uppercase font-bold tracking-widest hover:text-white hover:border-white/30">
                        Cancel
                      </button>
                    </div>
                 </form>
              </div>
           )}

           <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max ${showAdd ? 'w-2/3' : 'w-full'}`}>
              {loading && <div className="col-span-full animate-pulse text-white/20 font-label uppercase">Scanning database...</div>}
              {admins.length === 0 && !loading && (
                 <div className="col-span-full border border-dashed border-white/10 p-12 text-center">
                    <span className="material-symbols-outlined text-4xl text-white/20 mb-3">grid_off</span>
                    <p className="font-label text-[10px] uppercase tracking-widest text-white/40">No Sector Admins Provisioned</p>
                 </div>
              )}
              {admins.map(adm => (
                 <div key={adm.id} className="bg-[#07090f] border border-white/5 p-5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3">
                       <button onClick={() => handleDelete(adm.id)} className="text-red-500/30 hover:text-red-500 transition-colors">
                         <span className="material-symbols-outlined text-sm">delete</span>
                       </button>
                    </div>
                    <p className="font-label text-[7px] uppercase tracking-widest text-[#ffd166]/60 mb-1">{adm.state} SECTOR</p>
                    <h3 className="font-headline font-black text-xl mb-4 text-white line-clamp-1">{adm.name}</h3>
                    
                    <div className="space-y-2 bg-[#060b14] p-3 border border-red-500/10">
                       <p className="flex justify-between items-center">
                         <span className="font-label text-[7px] uppercase text-white/30 tracking-widest">Email/Login</span>
                         <span className="font-mono text-[10px] text-white/80">{adm.email}</span>
                       </p>
                       <p className="flex justify-between items-center">
                         <span className="font-label text-[7px] uppercase text-white/30 tracking-widest">Passkey</span>
                         <span className="font-mono text-[11px] font-bold text-red-400 tracking-widest bg-red-500/10 px-2 py-0.5">{adm.temporary_password}</span>
                       </p>
                    </div>
                 </div>
              ))}
           </div>
        </div>
      </main>
    </div>
  );
}
