import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase.js';
import toast from 'react-hot-toast';
import { useLanguage } from '../utils/i18n.jsx';

export default function Sidebar() {
  const navigate = useNavigate();
  const role = localStorage.getItem('grandline_role') || 'volunteer';
  const { lang, setLang, t } = useLanguage();

  const Item = ({ to, icon, label, end }) => (
    <NavLink 
      to={to} 
      end={end} 
      className={({ isActive }) =>
        `flex items-center gap-4 mx-3 px-3 py-3 transition-all duration-200 border-l-2 ${
          isActive 
            ? 'bg-primary-container/10 text-primary font-bold border-primary' 
            : 'text-on-surface/40 hover:bg-on-surface/5 hover:text-on-surface border-transparent'
        }`
      }
    >
      <span className="material-symbols-outlined text-xl">{icon}</span>
      <span className="font-headline tracking-wide text-xs hidden md:block uppercase leading-none">{t(label)}</span>
    </NavLink>
  );

  const handleSeed = async () => {
    const loadToast = toast.loading('Synchronizing tactical infrastructure...');
    try {
      const { httpsCallable } = await import('firebase/functions');
      const { functions } = await import('../firebase.js');
      const seedFunc = httpsCallable(functions, 'seedDatabase');
      const result = await seedFunc();
      
      toast.success(`Demo Data Synchronized: ${result.data.seeded_volunteers} volunteers, ${result.data.seeded_issues} issues.`, { id: loadToast });
    } catch (err) {
      console.error(err);
      toast.error('Sync failed: ' + err.message, { id: loadToast });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('grandline_role');
      toast.success('System Logged Out');
      navigate('/login');
    } catch (err) {
      toast.error('Logout failed');
    }
  };

  return (
    <nav className="fixed left-0 top-0 h-full z-40 flex flex-col bg-surface/95 backdrop-blur-xl w-20 md:w-64 border-r border-primary/10 shadow-[12px_0_40px_rgba(0,0,0,0.4)]">
      {/* Brand Header */}
      <div className="px-5 pt-7 pb-8 border-b border-white/5 relative overflow-hidden">
        <div className="scan-line top-0 opacity-10"></div>
        <h1 className="font-headline font-black text-primary text-lg tracking-tighter hidden md:block leading-none">GRANDLINE AI</h1>
        <div className="flex items-center gap-2 mt-2 hidden md:flex">
          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${role === 'admin' || role === 'super_admin' ? 'bg-error' : role === 'state_admin' ? 'bg-primary' : 'bg-primary'}`}></span>
          <p className="font-label text-[8px] text-on-surface/60 tracking-[0.3em] uppercase">{role === 'admin' || role === 'super_admin' ? t('sidebar_national') : role === 'state_admin' ? t('header_sector_bridge') : 'Field Specialist'}</p>
        </div>
        <span className="material-symbols-outlined text-primary md:hidden text-2xl">shield</span>
      </div>

      <div className="flex-1 py-6 space-y-1">
        <Item 
          to={(role === 'super_admin' || role === 'admin') ? '/dashboard/national' : role === 'state_admin' ? '/dashboard/state' : '/dashboard/volunteer'} 
          icon="radar" 
          label="sidebar_command_deck" 
        />
        
        {(role === 'admin' || role === 'super_admin') && (
          <>
            <Item to="/volunteers" icon="diversity_3"  label="Operations Overview" />
            <Item to="/dashboard/national/admins" icon="admin_panel_settings"  label="Sector Commands" />
          </>
        )}

        {role === 'state_admin' && (
          <Item to="/dashboard/state/volunteers" icon="groups" label="sidebar_volunteers" />
        )}

        {(role === 'volunteer' || role === 'user' || !role) && (
          <Item to="/dashboard/volunteer#uplink" icon="report_problem" label="Raise Problem" />
        )}

        <Item to="/dashboard/comms" icon="cell_tower" label="sidebar_comms" />
      </div>

      {/* Action Footer */}
      <div className="p-4 space-y-3 border-t border-white/5 bg-white/2">
        {/* Language Switcher */}
        <div className="flex items-center gap-2 px-3 py-1 bg-on-surface/5 rounded-sm overflow-hidden mb-2">
           <span className="material-symbols-outlined text-on-surface/20 text-sm">translate</span>
           <select 
             value={lang} 
             onChange={(e) => setLang(e.target.value)}
             className="bg-transparent text-on-surface/40 font-label text-[8px] uppercase tracking-widest outline-none border-none flex-1 cursor-pointer hover:text-primary transition-colors"
           >
             <option value="en" className="bg-surface">English (International)</option>
             <option value="hi" className="bg-surface">हिन्दी (Hindi)</option>
             <option value="te" className="bg-surface">తెలుగు (Telugu)</option>
             <option value="tm" className="bg-surface">தமிழ் (Tamil)</option>
             <option value="ml" className="bg-surface">മലയാളം (Malayalam)</option>
             <option value="mr" className="bg-surface">मराठी (Marathi)</option>
             <option value="bn" className="bg-surface">বাংলা (Bengali)</option>
             <option value="gu" className="bg-surface">ગુજરાતી (Gujarati)</option>
             <option value="kn" className="bg-surface">ಕನ್ನಡ (Kannada)</option>
             <option value="pa" className="bg-surface">ਪੰਜਾਬੀ (Punjabi)</option>
           </select>
        </div>

        {(role === 'admin' || role === 'super_admin') && (
          <button
            onClick={handleSeed}
            className="w-full hidden md:flex items-center justify-center gap-2 py-3 bg-white/5 border border-white/10 text-white/40 font-label text-[9px] tracking-widest uppercase hover:text-primary-container hover:border-primary-container/30 transition-all group"
          >
            <span className="material-symbols-outlined text-sm group-hover:rotate-12 transition-transform">database</span>
            Seed Demo Data
          </button>
        )}


        <button 
          onClick={() => navigate('/settings')}
          className="w-full flex items-center gap-3 px-3 py-3 text-on-surface/20 hover:text-primary transition-colors text-xs font-label uppercase tracking-widest text-left group"
        >
          <span className="material-symbols-outlined text-sm group-hover:-translate-x-1 transition-transform">manage_accounts</span>
          <span className="hidden md:inline">Profile Configuration</span>
        </button>

        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-3 text-on-surface/20 hover:text-error transition-colors text-xs font-label uppercase tracking-widest text-left group"
        >
          <span className="material-symbols-outlined text-sm group-hover:-translate-x-1 transition-transform">logout</span>
          <span className="hidden md:inline">Terminate Session</span>
        </button>
      </div>
    </nav>
  );
}
