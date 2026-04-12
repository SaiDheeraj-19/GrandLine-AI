import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase.js';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import NationalMonitoring from './pages/NationalMonitoring.jsx';
import Upload from './pages/Upload.jsx';
import Volunteers from './pages/Volunteers.jsx';
import FieldCenter from './pages/FieldCenter.jsx';
import AIChat from './components/AIChat.jsx';
import SecureComms from './pages/SecureComms.jsx';
import StateAdminDashboard from './pages/StateAdminDashboard.jsx';
import StateAdminVolunteers from './pages/StateAdminVolunteers.jsx';
import SuperAdminPersonnel from './pages/SuperAdminPersonnel.jsx';
import ProfileSettings from './pages/ProfileSettings.jsx';

import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase.js';

function ProtectedRoute({ children, requiredRole }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fail-safe: if authentication doesn't resolve in 5 seconds, clear loading
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn("ProtectedRoute: Auth resolution timeout reached. Clearing loading state.");
        setLoading(false);
      }
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      clearTimeout(timeout);
      setUser(u);
      if (u) {
        try {
          const userSnap = await getDoc(doc(db, 'users', u.uid));
          if (userSnap.exists()) {
            const data = userSnap.data();
            setUserData(data);
            localStorage.setItem('grandline_role', data.role);
            localStorage.setItem('grandline_state', data.state);
          }
        } catch (err) {
          console.error("ProtectedRoute: Session error:", err);
        }
      }
      setLoading(false);
    });
    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  if (loading) return (
    <div className="h-screen w-screen bg-background flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 border-2 border-[#ffd166]/20 border-t-[#ffd166] animate-spin rounded-full"></div>
      <p className="font-label text-[10px] uppercase tracking-[0.5em] text-[#ffd166]/40">Securing Session Link...</p>
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;

  if (requiredRole && userData?.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function ConditionalAIChat() {
   const location = useLocation();
   const isLogin = location.pathname === '/login';
   if (isLogin) return null;
   return <AIChat />;
}

function RoleBasedRedirect() {
  const role = localStorage.getItem('grandline_role');
  if (role === 'super_admin' || role === 'admin') return <Navigate to="/dashboard/national" replace />;
  if (role === 'state_admin') return <Navigate to="/dashboard/state" replace />;
  if (role === 'volunteer') return <Navigate to="/dashboard/volunteer" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="relative min-h-screen bg-background text-on-background selection:bg-primary-container selection:text-on-primary-container">
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/dashboard/national" element={<ProtectedRoute requiredRole="super_admin"><NationalMonitoring /></ProtectedRoute>} />
          <Route path="/dashboard/national/admins" element={<ProtectedRoute requiredRole="super_admin"><SuperAdminPersonnel /></ProtectedRoute>} />
          <Route path="/dashboard/state"    element={<ProtectedRoute requiredRole="state_admin"><StateAdminDashboard /></ProtectedRoute>} />
          <Route path="/dashboard/state/volunteers" element={<ProtectedRoute requiredRole="state_admin"><StateAdminVolunteers /></ProtectedRoute>} />
          <Route path="/dashboard/volunteer" element={<ProtectedRoute requiredRole="volunteer"><FieldCenter /></ProtectedRoute>} />
          <Route path="/dashboard/comms" element={<ProtectedRoute><SecureComms /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><ProfileSettings /></ProtectedRoute>} />

          {/* Legacy & Support Routes */}
          <Route path="/upload"      element={<ProtectedRoute><Upload /></ProtectedRoute>} />
          <Route path="/volunteers"  element={<ProtectedRoute><Volunteers /></ProtectedRoute>} />
          <Route path="/field"       element={<ProtectedRoute><FieldCenter /></ProtectedRoute>} />
          
          <Route path="/"            element={<ProtectedRoute><RoleBasedRedirect /></ProtectedRoute>} />
          <Route path="*"            element={<Navigate to="/" replace />} />
        </Routes>

        {/* Neural Link ARIA — available on tactical pages */}
        <ConditionalAIChat />

        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#1b1f2b',
              color: '#fff2dc',
              border: '1px solid rgba(255, 209, 102, 0.1)',
              fontFamily: 'Manrope, sans-serif',
              fontSize: '11px',
              borderRadius: '0px',
              backdropFilter: 'blur(12px)',
            },
            success: { iconTheme: { primary: '#ffd166', secondary: '#0f131e' } },
            error:   { iconTheme: { primary: '#b81923', secondary: '#fff2dc' } },
          }}
        />
      </div>
    </BrowserRouter>
  );
}
