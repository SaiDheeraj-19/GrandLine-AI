import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, signInAnonymously, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase.js';
import toast from 'react-hot-toast';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

export default function Login() {
  const [role, setRole] = useState('state_admin');
  const [email, setEmail] = useState('admin@grandline.ai');
  const [password, setPassword] = useState('Password@123');
  const [userState, setUserState] = useState('');

  // Sync email when role changes for easy demo
  const handleRoleChange = (newRole) => {
    setRole(newRole);
    if (newRole === 'super_admin') {
      setEmail('superadmin@grandline.ai');
    } else if (newRole === 'state_admin') {
      setEmail('admin@grandline.ai');
      setUserState('');
    } else {
      setEmail('volunteer@grandline.ai');
    }
    setPassword('Password@123');
  };

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (role === 'state_admin' && !userState) {
      toast.error('Tactical Jurisdiction Required: Please select a sector (state).');
      return;
    }

    setLoading(true);
    const loadToast = toast.loading('Synchronizing Neural Link...');
    
    try {
      let userCred;
      try {
        // Try signing in first
        userCred = await signInWithEmailAndPassword(auth, email, password);
      } catch (signInErr) {
        // If user doesn't exist, auto-create the account (demo/hackathon mode)
        const code = signInErr.code;
        if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/invalid-email' || code === 'auth/wrong-password') {
          userCred = await createUserWithEmailAndPassword(auth, email, password);
          toast('Account auto-initialized for first access.', { icon: '🔐' });
        } else {
          throw signInErr;
        }
      }

      // Persist tactical role and state for session differentiation
      localStorage.setItem('grandline_role', role);
      localStorage.setItem('grandline_state', userState);
      localStorage.setItem('grandline_uid', userCred.user.uid);
      
      toast.success(`Access Granted. Welcome, ${role.replace(/_/g, ' ').toUpperCase()}.`, { id: loadToast });
      
      // Strict Role-Based Redirect Matrix
      if (role === 'super_admin') navigate('/dashboard/national');
      else if (role === 'state_admin') navigate('/dashboard/state');
      else navigate('/dashboard/volunteer');
    } catch (err) {
      console.error(err);
      toast.error(`Authentication Failed: ${err.message}`, { id: loadToast });
    } finally {
      setLoading(false);
    }
  };

  const guestAccess = async () => {
    try {
      const userCred = await signInAnonymously(auth);
      localStorage.setItem('grandline_role', 'super_admin');
      localStorage.setItem('grandline_state', 'All');
      localStorage.setItem('grandline_uid', userCred.user.uid);
      toast.success('Bypassing Security. Entering as Global Observer.');
      navigate('/dashboard/national');
    } catch (err) {
      toast.error('Guest Protocol Failed.');
      console.error(err);
    }
  };

  return (
    <div className="bg-surface text-on-surface font-body min-h-screen flex items-center justify-center p-6 selection:bg-primary-container selection:text-on-primary-container relative overflow-hidden dot-grid">
      
      {/* Background Hero Visual */}
      <div className="fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-surface"></div>
        <img 
          className="absolute inset-0 w-full h-full object-cover opacity-10 mix-blend-overlay" 
          src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=2072"
          alt="Technical Grid Background"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-surface/80"></div>
      </div>

      {/* Login Container */}
      <main className="w-full max-w-xl relative z-10">
        <div className="scan-line top-0 animate-scan"></div>

        {/* Brand Header */}
        <div className="mb-12 flex flex-col items-start gap-2">
          <h1 className="font-headline text-5xl font-extrabold tracking-tighter text-[#ffd166]">
            GRANDLINE AI
          </h1>
          <div className="flex items-center gap-4">
            <div className="h-[2px] w-12 bg-[#ffd166]"></div>
            <p className="font-label text-[10px] uppercase tracking-[0.4em] text-white/40">
              Crisis Multiplier · Resource Intelligence
            </p>
          </div>
        </div>

        {/* Tactical Login Card */}
        <div className="relative glass-panel p-10 shadow-[0px_40px_100px_rgba(0,0,0,0.8)] overflow-hidden slide-up">
          <div className="absolute top-0 left-0 w-12 h-12 border-t border-l border-[#ffd166]/20"></div>
          <div className="absolute bottom-0 right-0 w-12 h-12 border-b border-r border-[#ffd166]/20"></div>

          <div className="flex flex-col gap-8">
            <div className="flex justify-between items-end border-b border-white/5 pb-4">
              <div>
                <span className="font-label text-[9px] uppercase tracking-[0.3em] text-white/20 block mb-1">Access Protocol v4.1</span>
                <h2 className="font-headline text-xl font-bold text-on-surface uppercase tracking-tight">System Login</h2>
              </div>
              <div className="text-right">
                <span className="font-label text-[9px] uppercase text-secondary/40 block mb-1">Neural Sync</span>
                <div className="flex items-center gap-2 text-secondary">
                  <span className="w-1.5 h-1.5 bg-secondary rounded-full animate-pulse shadow-[0_0_8px_#ffd166]"></span>
                  <span className="text-[10px] font-bold font-label tracking-widest">READY</span>
                </div>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              {/* Role Context */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleRoleChange('super_admin')}
                  className={`p-3 border-t-2 transition-all flex flex-col items-center gap-1 ${
                    role === 'super_admin' 
                    ? 'border-[#ffd166] bg-[#ffd166]/5' 
                    : 'border-white/5 bg-white/2 hover:bg-white/5'
                  }`}
                >
                  <span className={`material-symbols-outlined text-base ${role === 'super_admin' ? 'text-[#ffd166]' : 'text-white/20'}`}>public</span>
                  <span className={`font-label text-[7px] uppercase tracking-widest font-black ${role === 'super_admin' ? 'text-white' : 'text-white/20'}`}>
                    Super
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleChange('state_admin')}
                  className={`p-3 border-t-2 transition-all flex flex-col items-center gap-1 ${
                    role === 'state_admin' 
                    ? 'border-[#ffd166] bg-[#ffd166]/5' 
                    : 'border-white/5 bg-white/2 hover:bg-white/5'
                  }`}
                >
                  <span className={`material-symbols-outlined text-base ${role === 'state_admin' ? 'text-[#ffd166]' : 'text-white/20'}`}>shield_person</span>
                  <span className={`font-label text-[7px] uppercase tracking-widest font-black ${role === 'state_admin' ? 'text-white' : 'text-white/20'}`}>
                    State
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRoleChange('volunteer')}
                  className={`p-3 border-t-2 transition-all flex flex-col items-center gap-1 ${
                    role === 'volunteer' 
                    ? 'border-[#ffd166] bg-[#ffd166]/5' 
                    : 'border-white/5 bg-white/2 hover:bg-white/5'
                  }`}
                >
                  <span className={`material-symbols-outlined text-base ${role === 'volunteer' ? 'text-[#ffd166]' : 'text-white/20'}`}>volunteer_activism</span>
                  <span className={`font-label text-[7px] uppercase tracking-widest font-black ${role === 'volunteer' ? 'text-white' : 'text-white/20'}`}>
                    Field
                  </span>
                </button>
              </div>

              {role === 'state_admin' && (
                <div className="animate-fade-in">
                  <label className="font-label text-[9px] uppercase tracking-widest text-white/20 mb-2 block px-1">Tactical Jurisdiction (State)</label>
                  <select 
                    value={userState}
                    onChange={e => setUserState(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 text-xs font-body py-4 px-4 text-white focus:ring-1 focus:ring-[#ffd166]/30 appearance-none rounded-none outline-none"
                  >
                    <option value="" disabled className="bg-[#0f131e]">Select State</option>
                    {INDIAN_STATES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Input Fields */}
              <div className="space-y-4">
                <div>
                  <label className="font-label text-[9px] uppercase tracking-widest text-white/20 mb-2 block px-1">Access ID (Email)</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full bg-white/5 border-none focus:ring-1 focus:ring-[#ffd166]/30 text-xs font-body py-4 px-4 transition-all placeholder:text-white/10" 
                    placeholder="field.commander@grandline.ai" 
                  />
                </div>
                <div className="relative">
                  <label className="font-label text-[9px] uppercase tracking-widest text-white/20 mb-2 block px-1">Security Hash (Password)</label>
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="w-full bg-white/5 border-none focus:ring-1 focus:ring-[#ffd166]/30 text-xs font-body py-4 px-4 pr-12 transition-all placeholder:text-white/10" 
                    placeholder="••••••••••••" 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 bottom-4 text-white/20 hover:text-[#ffd166] transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">
                      {showPassword ? 'visibility' : 'visibility_off'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Login Button */}
              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-[#ffd166] text-[#0f131e] font-headline font-black py-5 uppercase tracking-[0.3em] text-xs hvr-shimmer relative overflow-hidden transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? 'INITIALIZING LINK...' : 'ENTER COMMAND CENTER'}
              </button>

              <div className="relative py-2 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
                <span className="relative bg-transparent px-4 font-label text-[8px] text-white/20 tracking-[0.5em] uppercase">OR</span>
              </div>

              <button 
                type="button"
                onClick={guestAccess}
                className="w-full bg-white/5 border border-white/10 text-white/40 font-label text-[9px] py-4 uppercase tracking-[0.2em] hover:bg-white/10 transition-all font-bold"
              >
                Enter as Guest Observer
              </button>
            </form>

            {/* Footer */}
            <div className="flex justify-between items-center text-[8px] font-label text-white/10 uppercase tracking-[0.3em] pt-4 border-t border-white/5">
              <span>Node: IND-SOUTH-1</span>
              <div className="flex items-center gap-1 text-[#ffd166]/30">
                <span className="material-symbols-outlined text-[10px]">lock_open</span>
                <span>SECURE AES-256</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Cinematic border overlay */}
      <div className="fixed inset-0 pointer-events-none border-[32px] border-[#0f131e] z-50 opacity-40"></div>
    </div>
  );
}
