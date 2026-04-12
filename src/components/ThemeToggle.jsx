import React, { useState, useEffect } from 'react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState(localStorage.getItem('grandline_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('grandline_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <button 
      onClick={toggleTheme}
      className="w-full flex items-center gap-3 px-3 py-3 text-white/20 hover:text-primary transition-colors text-xs font-label uppercase tracking-widest text-left group"
      title="Toggle Visual Environment"
    >
      <span className="material-symbols-outlined text-sm group-hover:rotate-180 transition-transform duration-500">
        {theme === 'dark' ? 'light_mode' : 'dark_mode'}
      </span>
      <span className="hidden md:inline">
        {theme === 'dark' ? 'Clarity Mode' : 'Tactical Mode'}
      </span>
    </button>
  );
}
