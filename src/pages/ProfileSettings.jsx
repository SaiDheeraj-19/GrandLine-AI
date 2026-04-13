import React, { useState, useEffect } from 'react';
import { updateProfile, updatePassword } from 'firebase/auth';
import { auth, db } from '../firebase.js';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import Sidebar from '../components/Sidebar.jsx';
import NotificationBell from '../components/NotificationBell.jsx';
import toast from 'react-hot-toast';

export default function ProfileSettings() {
  const user = auth.currentUser;
  
  const role = localStorage.getItem('grandline_role') || 'volunteer';
  const state = localStorage.getItem('grandline_state') || 'N/A';
  
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [status, setStatus] = useState('available');
  const [volId, setVolId] = useState(null);

  useEffect(() => {
    if (user) {
      setName(user.displayName || '');
      // Fetch volunteer status if applicable
      if (role === 'volunteer') {
        const fetchVol = async () => {
          const q = query(collection(db, 'volunteers'), where('email', '==', user.email));
          const snap = await getDocs(q);
          if (!snap.empty) {
            setVolId(snap.docs[0].id);
            setStatus(snap.docs[0].data().status || 'available');
          }
        };
        fetchVol();
      }
    }
  }, [user, role]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const t = toast.loading('Updating profile...');
    try {
      await updateProfile(user, { displayName: name });
      if (volId) {
        await updateDoc(doc(db, 'volunteers', volId), { 
          name,
          status 
        });
      }
      toast.success('Profile updated successfully', { id: t });
    } catch (error) {
      toast.error('Failed to update: ' + error.message, { id: t });
    } finally {
      setLoading(false);
    }
  };


  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (newPassword !== confirmPassword) {
      return toast.error('Passwords do not match');
    }
    if (newPassword.length < 6) {
      return toast.error('Passkey must be at least 6 characters');
    }
    
    setChangingPassword(true);
    const t = toast.loading('Updating passkey...');
    try {
      await updatePassword(user, newPassword);
      toast.success('Passkey updated securely', { id: t });
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') {
        toast.error('Security Protocol: Please sign out and sign back in to change your passkey.', { id: t, duration: 6000 });
      } else {
        toast.error('Update failed: ' + error.message, { id: t });
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const roleText = 
    role === 'super_admin' ? 'National Command' :
    role === 'state_admin' ? 'Sector Admin' : 'Field Specialist';

  return (
    <div className="bg-[#060b14] text-white font-body h-screen overflow-hidden flex relative">
      <Sidebar />

      <main className="flex-1 ml-20 md:ml-64 h-screen flex flex-col overflow-hidden relative">
        <header className="flex-shrink-0 flex items-center justify-between px-6 h-16 bg-[#060b14]/95 backdrop-blur border-b border-white/[0.06] z-50">
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-[#ffd166] text-2xl">manage_accounts</span>
            <div>
              <span className="font-label text-[7px] uppercase tracking-[0.5em] text-[#ffd166]/50 block">System Configuration</span>
              <h1 className="font-headline text-base font-black text-white tracking-tight uppercase leading-tight">
                Profile Settings
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <NotificationBell />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-10 flex justify-center items-start">
           <div className="w-full max-w-2xl bg-[#07090f] border border-white/5 shadow-2xl overflow-hidden mt-6">
              
              {/* Profile Header */}
              <div className="p-8 border-b border-white/5 bg-gradient-to-b from-white/[0.04] to-transparent relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                    <span className="material-symbols-outlined" style={{fontSize: '150px'}}>fingerprint</span>
                 </div>
                 <div className="relative z-10 flex items-center gap-6">
                    <div className="w-20 h-20 rounded-xl bg-white/5 border-2 border-[#ffd166]/40 flex flex-col items-center justify-center text-[#ffd166] shadow-[0_0_20px_rgba(255,209,102,0.1)]">
                       <span className="material-symbols-outlined text-4xl mb-1">person</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="font-label text-[8px] uppercase tracking-[0.2em] text-green-400">Online</span>
                      </div>
                      <h2 className="font-headline text-2xl font-black text-white">{name || 'Unnamed Identity'}</h2>
                      <p className="font-mono text-[10px] text-white/40 mt-1">{user?.email}</p>
                    </div>
                 </div>
              </div>

              {/* Settings Body */}
              <div className="p-8 space-y-10">
                 
                 {/* ID Badges */}
                 <section>
                    <h3 className="font-label text-[10px] uppercase tracking-[0.25em] text-white/30 mb-4 block">Access & Jurisdiction</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <div className="p-4 border border-white/10 bg-white/[0.01]">
                          <span className="font-label text-[7px] uppercase tracking-widest text-[#ffd166]/60">Clearance Level</span>
                          <p className="font-headline font-bold text-lg text-white mt-1 uppercase">{roleText}</p>
                       </div>
                       <div className="p-4 border border-white/10 bg-white/[0.01]">
                          <span className="font-label text-[7px] uppercase tracking-widest text-[#ffd166]/60">Assigned Sector</span>
                          <p className="font-headline font-bold text-lg text-white mt-1 uppercase">{role === 'super_admin' ? 'Global Command' : state}</p>
                       </div>
                    </div>
                 </section>

                 <hr className="border-white/5" />

                 {/* Identity Form */}
                 <section>
                    <h3 className="font-label text-[10px] uppercase tracking-[0.25em] text-white/30 mb-4 block">Identity Configuration</h3>
                    <form onSubmit={handleSave} className="space-y-4 max-w-md">
                        <div>
                           <label className="font-label text-[8px] uppercase text-white/60 tracking-wider block mb-1.5">Official Display Name</label>
                           <input 
                             type="text" 
                             required 
                             value={name} 
                             onChange={e => setName(e.target.value)} 
                             className="w-full bg-[#060b14] border border-white/10 p-3 text-sm font-body text-white outline-none focus:border-[#ffd166]/50 transition-all" 
                           />
                        </div>

                        {role === 'volunteer' && (
                          <div>
                            <label className="font-label text-[8px] uppercase text-white/60 tracking-wider block mb-1.5">Tactical Status</label>
                            <select 
                              value={status} 
                              onChange={e => setStatus(e.target.value)}
                              className="w-full bg-[#060b14] border border-white/10 p-3 text-sm font-body text-white outline-none focus:border-[#ffd166]/50 transition-all appearance-none cursor-pointer"
                            >
                               <option value="available">ACTIVE / AVAILABLE</option>
                               <option value="away">AWAY / ON BREAK</option>
                               <option value="on_leave">ON LEAVE / UNAVAILABLE</option>
                               <option value="inactive">INACTIVE</option>
                            </select>
                          </div>
                        )}

                       <button 
                         type="submit" 
                         disabled={loading}
                         className="px-6 py-3 bg-[#ffd166] text-[#060b14] font-label font-black text-[9px] uppercase tracking-widest hover:bg-opacity-90 disabled:opacity-50 transition-all disabled:cursor-not-allowed">
                          {loading ? 'Committing...' : 'Commit Changes'}
                       </button>
                    </form>
                 </section>

                 <hr className="border-white/5" />

                 {/* Security */}
                 <section>
                    <h3 className="font-label text-[10px] uppercase tracking-[0.25em] text-white/30 mb-4 block">Security Authentication</h3>
                     <div>
                        <p className="font-label text-[8px] uppercase text-white/50 tracking-widest mb-3">Update Passkey Directly</p>
                        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                           <div>
                              <label className="font-label text-[8px] uppercase text-white/60 tracking-wider block mb-1.5">New Passkey</label>
                              <input 
                                type="password" 
                                required 
                                minLength="6"
                                value={newPassword} 
                                onChange={e => setNewPassword(e.target.value)} 
                                className="w-full bg-[#060b14] border border-white/10 p-3 text-sm font-body text-white outline-none focus:border-red-500/50 transition-all" 
                              />
                           </div>
                           <div>
                              <label className="font-label text-[8px] uppercase text-white/60 tracking-wider block mb-1.5">Confirm Passkey</label>
                              <input 
                                type="password" 
                                required 
                                minLength="6"
                                value={confirmPassword} 
                                onChange={e => setConfirmPassword(e.target.value)} 
                                className="w-full bg-[#060b14] border border-white/10 p-3 text-sm font-body text-white outline-none focus:border-red-500/50 transition-all" 
                              />
                           </div>
                           <button 
                             type="submit" 
                             disabled={changingPassword || !newPassword || !confirmPassword}
                             className="px-6 py-3 border border-red-500/50 text-red-400 font-label font-black text-[9px] uppercase tracking-widest hover:bg-red-500/10 disabled:opacity-50 transition-all disabled:cursor-not-allowed">
                              {changingPassword ? 'Encrypting...' : 'Update Passkey'}
                           </button>
                        </form>
                     </div>
                 </section>

              </div>

           </div>
        </div>
      </main>
    </div>
  );
}
