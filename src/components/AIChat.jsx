import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { chatWithAriaFrontend } from '../utils/gemini.js';

const QUICK_QUERIES = [
  'Provide a comprehensive analysis of my state metrics.',
  'Which state has the highest unmet need right now?',
  'List all critical issues above urgency score 80.',
  'Which volunteers are closest to the top 3 disasters?',
  'How many coverage gaps exist and where?',
  'Show me all escalated issues that need immediate attention.',
  'What skills are most needed across active incidents?',
];

export default function AIChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState([]);
  const [messages, setMessages] = useState([
    {
      role: 'aria',
      text: 'SYSTEM INITIALIZED. I am **ARIA** — Automated Resource Intelligence Assistant. Monitoring **28 states + 8 UTs** across India. All 22 scheduled languages understood. Routing engine live. State your query, **Operator**.',
    }
  ]);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(text) {
    const query = text || input.trim();
    if (!query || sending) return;
    setInput('');
    setSending(true);

    const newUserMsg = { role: 'user', text: query };
    setMessages(prev => [...prev, newUserMsg]);

    try {
      // Direct call to Gemini from local machine
      const responseText = await chatWithAriaFrontend(query, history);

      setHistory(prev => [
        ...prev,
        { role: 'user',  parts: [{ text: query }] },
        { role: 'model', parts: [{ text: responseText }] },
      ]);

      setMessages(prev => [...prev, { role: 'aria', text: responseText }]);
    } catch (err) {
      toast.error('Neural Link Interrupted.');
      setMessages(prev => [...prev, {
        role: 'aria',
        text: `Signal lost: ${err.message}. Please verify your API status.`,
      }]);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function renderText(text) {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1
        ? <strong key={i} className="font-headline font-bold text-primary-container uppercase tracking-tight">{part}</strong>
        : part
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(v => !v)}
        className={`fixed bottom-8 right-8 z-[60] w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 shadow-[0_0_30px_rgba(0,0,0,0.5)] ${open ? 'bg-error text-on-error rotate-90' : 'bg-primary-container text-on-primary-container hover:shadow-[0_0_50px_rgba(255,209,102,0.4)] hover:scale-110'}`}
      >
        <span className="material-symbols-outlined text-3xl font-bold">{open ? 'close' : 'psychology'}</span>
        {!open && <span className="absolute -top-1 -right-1 w-4 h-4 bg-secondary rounded-full border-4 border-background animate-pulse"></span>}
      </button>

      {open && (
        <div className="fixed bottom-28 right-8 z-50 w-[420px] max-h-[600px] flex flex-col bg-[#0f131e]/95 backdrop-blur-2xl border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.7)] overflow-hidden slide-up">
          <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none"></div>
          
          {/* Header */}
          <div className="p-6 border-b border-white/5 relative bg-[#ffd166]/5 overflow-hidden">
             <div className="scan-line top-0 opacity-20"></div>
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-primary-container/20 border border-primary-container/40 flex items-center justify-center relative">
                   <span className="material-symbols-outlined text-primary-container animate-pulse">psychology</span>
                </div>
                <div>
                   <h3 className="font-headline font-black text-primary-container text-xs tracking-[0.3em] uppercase">Neural Link ARIA</h3>
                   <div className="flex items-center gap-2 mt-1">
                      <span className="w-1 h-1 bg-secondary rounded-full"></span>
                      <p className="font-label text-[9px] text-white/30 uppercase tracking-widest">Quantum Synthesis Active</p>
                   </div>
                </div>
             </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative min-h-0">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 text-xs font-body leading-relaxed relative ${msg.role === 'user' ? 'bg-primary-container text-on-primary-container border-r-2 border-primary-fixed' : 'bg-white/5 text-primary border-l-2 border-primary-container'}`}>
                   {msg.role === 'user' && <span className="absolute -top-3 right-0 font-label text-[8px] uppercase tracking-widest text-[#ffd166]">Operator Signal</span>}
                   {msg.role === 'aria' && <span className="absolute -top-3 left-0 font-label text-[8px] uppercase tracking-widest text-secondary">Neural Response</span>}
                   {renderText(msg.text)}
                </div>
              </div>
            ))}

            {/* Typing */}
            {sending && (
              <div className="flex justify-start">
                 <div className="bg-white/5 p-4 flex gap-1 items-center">
                    <div className="w-1 h-1 bg-primary-container animate-bounce"></div>
                    <div className="w-1 h-1 bg-primary-container animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-1 h-1 bg-primary-container animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                 </div>
              </div>
            )}

            {messages.length === 1 && (
               <div className="grid grid-cols-1 gap-2 mt-4">
                  <p className="font-label text-[9px] text-white/20 uppercase tracking-widest text-center mb-2">Preset Intelligence Queries</p>
                  {QUICK_QUERIES.map(q => (
                    <button key={q} onClick={() => sendMessage(q)} className="text-left text-[10px] p-3 border border-white/5 hover:bg-white/5 hover:border-primary-container/20 transition-all font-label uppercase tracking-wider text-primary/60">
                       {q}
                    </button>
                  ))}
               </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-6 border-t border-white/5 relative">
             <div className="flex items-center gap-4">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="TRANSMIT TO ARIA..."
                  className="bg-transparent border-none focus:ring-0 text-xs font-label tracking-widest uppercase w-full resize-none custom-scrollbar p-0 h-8 placeholder:text-white/10"
                />
                <button 
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || sending}
                  className="material-symbols-outlined text-primary-container disabled:text-white/10 transition-colors"
                >
                  send
                </button>
             </div>
          </div>
        </div>
      )}
    </>
  );
}
