import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, where } from 'firebase/firestore';
import { auth, db } from '../firebase.js';
import Sidebar from '../components/Sidebar.jsx';
import toast from 'react-hot-toast';

const SKILL_COLORS = {
  medical: '#ef4444', rescue: '#f97316', food: '#22c55e',
  logistics: '#3b82f6', shelter: '#8b5cf6', water: '#06b6d4',
  counselling: '#ec4899', general: '#6b7280',
};

const SKILLS_LIST = ['medical', 'rescue', 'food', 'logistics', 'shelter', 'water', 'counselling', 'general'];

export default function Volunteers() {
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  
  const role = localStorage.getItem('grandline_role');
  const userState = localStorage.getItem('grandline_state');

  const [newVol, setNewVol] = useState({
    name: '',
    phone: '',
    district: '',
    ngo_name: '',
    state: role === 'state_admin' ? userState : '',
    skills: [],
    reach_radius_km: 50,
  });

  useEffect(() => {
    if (!db) return;
    
    // Geofencing: State Admin only sees their state, Super Admin sees all
    let q;
    if (role === 'state_admin') {
      q = query(collection(db, 'volunteers'), where('location.state', '==', userState), orderBy('name', 'asc'));
    } else {
      q = query(collection(db, 'volunteers'), orderBy('name', 'asc'));
    }

    return onSnapshot(q, snap => {
      setVolunteers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [role, userState]);

  const handleRegister = async (e) => {
    e.preventDefault();
    const loadToast = toast.loading('Synchronizing asset with Command Deck...');
    try {
      if (!newVol.name || !newVol.state || !newVol.district || newVol.skills.length === 0) {
        throw new Error('All tactical fields required (Name, District, State, Skills)');
      }

      await addDoc(collection(db, 'volunteers'), {
        name: newVol.name,
        phone: newVol.phone,
        email: `${newVol.name.toLowerCase().replace(/\s/g, '')}@grandline.ai`, // Auto-gen tactical email
        ngo_name: newVol.ngo_name || 'Independent Specialist',
        location: {
          state: newVol.state,
          district: newVol.district,
          lat: 20.5937, 
          lng: 78.9629,
        },
        skills: newVol.skills,
        reach_radius_km: Number(newVol.reach_radius_km),
        status: 'available',
        total_deployments: 0,
        people_helped: 0,
        timestamp: serverTimestamp(),
      });

      toast.success('Asset Integration Successful', { id: loadToast });
      setShowRegister(false);
      setNewVol({ name: '', phone: '', district: '', ngo_name: '', state: role === 'state_admin' ? userState : '', skills: [], reach_radius_km: 50 });
    } catch (err) {
      toast.error(err.message, { id: loadToast });
    }
  };

  const toggleSkill = (skill) => {
    setNewVol(prev => ({
      ...prev,
      skills: prev.skills.includes(skill) 
        ? prev.skills.filter(s => s !== skill) 
        : [...prev.skills, skill]
    }));
  };

  const totalHelp = volunteers.reduce((acc, v) => acc + (v.people_helped || 0), 0);
  const standbyCount = volunteers.filter(v => v.status === 'available').length;

  return (
    <div className="bg-background text-on-background font-body min-h-screen dot-grid relative">
      <Sidebar />

      {/* Registration Modal Overlay */}
      {showRegister && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#0a0e19]/90 backdrop-blur-md">
          <div className="glass-panel w-full max-w-lg p-8 relative overflow-hidden">
            <div className="scan-line top-0 opacity-10"></div>
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="font-headline text-xl font-bold text-[#ffd166] uppercase tracking-tighter">Asset Induction</h2>
                <p className="font-label text-[9px] text-white/30 uppercase mt-1">Register new field specialist</p>
              </div>
              <button 
                onClick={() => setShowRegister(false)}
                className="text-white/20 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-label text-[9px] uppercase tracking-widest text-white/40 ml-1">Full Name</label>
                  <input 
                    type="text" 
                    value={newVol.name}
                    required
                    onChange={e => setNewVol({...newVol, name: e.target.value})}
                    placeholder="E.g. Dr. ARYA Stark" 
                    className="w-full bg-white/5 border border-white/10 px-4 py-3 text-xs focus:border-[#ffd166]/50 transition-all outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-label text-[9px] uppercase tracking-widest text-white/40 ml-1">Phone Number</label>
                  <input 
                    type="tel" 
                    value={newVol.phone}
                    required
                    onChange={e => setNewVol({...newVol, phone: e.target.value})}
                    placeholder="+91 XXXX XXX XXX" 
                    className="w-full bg-white/5 border border-white/10 px-4 py-3 text-xs focus:border-[#ffd166]/50 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-label text-[9px] uppercase tracking-widest text-white/40 ml-1">State Jurisdiction</label>
                  <input 
                    type="text" 
                    value={newVol.state}
                    readOnly={role === 'state_admin'}
                    onChange={e => setNewVol({...newVol, state: e.target.value})}
                    placeholder="E.g. Kerala" 
                    className={`w-full bg-white/5 border border-white/10 px-4 py-3 text-xs outline-none transition-all ${role === 'state_admin' ? 'opacity-50 cursor-not-allowed border-secondary/20 text-secondary' : 'focus:border-[#ffd166]/50'}`}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-label text-[9px] uppercase tracking-widest text-white/40 ml-1">District / Area</label>
                  <input 
                    type="text" 
                    required
                    value={newVol.district}
                    onChange={e => setNewVol({...newVol, district: e.target.value})}
                    placeholder="E.g. Wayanad" 
                    className="w-full bg-white/5 border border-white/10 px-4 py-3 text-xs focus:border-[#ffd166]/50 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-label text-[9px] uppercase tracking-widest text-white/40 ml-1">Organization</label>
                  <input 
                    type="text" 
                    value={newVol.ngo_name}
                    onChange={e => setNewVol({...newVol, ngo_name: e.target.value})}
                    placeholder="Independent" 
                    className="w-full bg-white/5 border border-white/10 px-4 py-3 text-xs focus:border-[#ffd166]/50 transition-all outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-label text-[9px] uppercase tracking-widest text-white/40 ml-1">Reach Radius (KM)</label>
                  <input 
                    type="number" 
                    value={newVol.reach_radius_km}
                    onChange={e => setNewVol({...newVol, reach_radius_km: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 px-4 py-3 text-xs focus:border-[#ffd166]/50 transition-all outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-label text-[9px] uppercase tracking-widest text-white/40 ml-1">Specializations</label>
                <div className="flex flex-wrap gap-2">
                  {SKILLS_LIST.map(skill => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => toggleSkill(skill)}
                      className={`px-3 py-1.5 text-[8px] font-label uppercase tracking-widest border transition-all ${
                        newVol.skills.includes(skill) 
                        ? 'bg-primary-container/20 border-primary-container text-primary-container font-black' 
                        : 'bg-white/2 border-white/5 text-white/20'
                      }`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                type="submit"
                className="w-full py-4 bg-[#ffd166] text-[#0f131e] font-headline font-black text-[10px] uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(255,209,102,0.2)] hover:shadow-[0_0_30px_rgba(255,209,102,0.4)] transition-all"
              >
                Sync with Command Deck
              </button>
            </form>
          </div>
        </div>
      )}

      <main className="ml-20 md:ml-64 flex-1 flex flex-col min-w-0">
        <header className="flex justify-between items-center w-full px-6 h-16 bg-[#0f131e]/90 backdrop-blur-xl border-b border-white/5 z-20">
          <div className="flex items-center gap-4">
            <h1 className="font-headline text-lg tracking-[0.3em] uppercase font-bold text-[#ffd166]">Operations Portal</h1>
          </div>
          <button 
            onClick={() => setShowRegister(true)}
            className="px-6 py-2 bg-[#ffd166]/10 border border-[#ffd166]/30 text-[#ffd166] font-label text-[9px] uppercase tracking-widest hover:bg-[#ffd166] hover:text-[#0f131e] transition-all"
          >
            Induct New Asset
          </button>
        </header>

        <section className="p-6 md:p-10 space-y-8 max-h-[calc(100vh-64px)] overflow-y-auto custom-scrollbar">
          
          {/* Dashboard Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Personnel', val: volunteers.length, color: 'text-primary-container', icon: 'groups' },
              { label: 'Standby Status',  val: standbyCount,      color: 'text-secondary', icon: 'person_check' },
              { label: 'Deployed Active', val: volunteers.length - standbyCount, color: 'text-error', icon: 'deployed_code' },
              { label: 'Total Impact',    val: totalHelp > 999 ? `${(totalHelp/1000).toFixed(1)}k` : totalHelp, color: 'text-white', icon: 'volunteer_activism' },
            ].map(m => (
              <div key={m.label} className="bg-white/2 p-6 border border-white/5 relative overflow-hidden group">
                <div className="scan-line top-0 opacity-5"></div>
                <div className="flex justify-between items-start">
                  <span className={`material-symbols-outlined text-2xl ${m.color} opacity-40 group-hover:opacity-100 transition-opacity`}>{m.icon}</span>
                  <div className={`font-headline text-3xl font-black ${m.color} leading-none`}>{m.val}</div>
                </div>
                <p className="font-label text-[9px] uppercase tracking-[0.2em] text-white/20 mt-4">{m.label}</p>
              </div>
            ))}
          </div>

          {/* Asset Grid */}
          <div className="space-y-4">
            <div className="flex justify-between items-end border-b border-white/5 pb-4">
               <div>
                  <p className="font-label text-[9px] uppercase tracking-widest text-white/20">Operational Directory</p>
                  <h2 className="font-headline text-2xl font-bold uppercase tracking-tight text-[#ffd166]">Active Personnel</h2>
               </div>
               <div className="bg-white/5 px-4 py-2 flex items-center gap-4">
                  <span className="font-label text-[9px] uppercase tracking-widest text-white/40">Sort: A-Z / Hierarchy</span>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
              {loading ? (
                Array(6).fill(0).map((_,i) => <div key={i} className="h-40 bg-white/5 animate-pulse"></div>)
              ) : volunteers.map(vol => (
                <div key={vol.id} className="glass-panel p-6 group hover:border-[#ffd166]/20 transition-all relative">
                   <div className="absolute top-2 right-4 flex items-center gap-1.5 font-label text-[8px] uppercase tracking-tighter">
                      <span className={`w-1.5 h-1.5 rounded-full ${vol.status === 'available' ? 'bg-secondary animate-pulse shadow-[0_0_8px_#ffd166]' : 'bg-white/10'}`}></span>
                      <span className={vol.status === 'available' ? 'text-secondary' : 'text-white/20'}>{vol.status}</span>
                   </div>

                   <div className="flex flex-col h-full gap-4">
                      <div>
                         <h3 className="font-headline text-base font-bold text-on-surface uppercase tracking-tight">{vol.name}</h3>
                         <p className="font-label text-[10px] text-white/20 uppercase tracking-widest mt-1">{vol.ngo_name || 'Independent Specialist'}</p>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                         {(vol.skills || []).map(skill => (
                           <span key={skill} className="text-[8px] font-label uppercase tracking-widest border border-white/5 px-2 py-1 bg-white/2 text-white/40" style={{ borderColor: `${SKILL_COLORS[skill]}33`, color: SKILL_COLORS[skill] }}>
                              {skill}
                           </span>
                         ))}
                      </div>

                      <div className="mt-auto pt-4 border-t border-white/5 grid grid-cols-2 gap-4">
                         <div>
                            <span className="font-label text-[8px] uppercase text-white/20 block">State/Zone</span>
                            <span className="font-label text-[9px] uppercase font-bold text-white/60">{vol.location?.state}</span>
                         </div>
                         <div className="text-right">
                            <span className="font-label text-[8px] uppercase text-white/20 block">Deployments</span>
                            <span className="font-label text-[10px] font-bold text-[#ffd166]">{vol.total_deployments || 0}</span>
                         </div>
                      </div>
                   </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
