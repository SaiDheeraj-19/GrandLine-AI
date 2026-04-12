import React, { useState, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import toast from 'react-hot-toast';
import Sidebar from '../components/Sidebar.jsx';
import { extractIntelFrontend } from '../utils/gemini.js';

export default function Upload() {
  const [activeTab, setActiveTab] = useState('text');
  const [inputText, setInputText] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const onDrop = useCallback(acceptedFiles => {
    const file = acceptedFiles[0];
    if (!file) return;
    setImageFile(file);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [], 'application/pdf': [] },
    maxFiles: 1,
  });

  const runExtraction = async (payload) => {
    setLoading(true);
    setResult(null);
    const loadToast = toast.loading('Synchronizing with ARIA Neural Link...');
    try {
      const { httpsCallable } = await import('firebase/functions');
      const { functions } = await import('../firebase.js');
      const extractFunc = httpsCallable(functions, 'extractReport');
      
      const res = await extractFunc({
        text: payload.source === 'image' ? null : payload.text,
        imageBase64: payload.source === 'image' ? payload.image.split(',')[1] : null,
        imageMimeType: payload.source === 'image' ? payload.image.split(';')[0].split(':')[1] : null,
        source: payload.source,
        userLat: 20.5937, // Default India centre or get from geolocation
        userLng: 78.9629
      });
      
      setResult(res.data.extracted);
      toast.success('Fresh Incident Intel Extracted & Merged', { id: loadToast });
    } catch (err) {
      toast.error('Neural Link Interrupted: ' + (err.message || 'Check Browser Console'), { id: loadToast });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Voice protocols not supported in this browser environment');
      return;
    }
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'en-IN';
    recognition.continuous = true;
    recognition.onresult = (event) => {
      const text = Array.from(event.results).map(r => r[0].transcript).join(' ');
      setVoiceTranscript(text);
    };
    recognition.onend = () => {
      setListening(false);
    };
    recognition.start();
    setListening(true);
    setVoiceTranscript('');
  };

  const handleStopRecording = () => {
    recognitionRef.current?.stop();
    setListening(false);
    if (voiceTranscript) runExtraction({ text: voiceTranscript, source: 'voice' });
  };

  return (
    <div className="bg-background text-on-background font-body h-screen overflow-hidden dot-grid relative">
      <Sidebar />

      <main className="ml-20 md:ml-64 h-full flex flex-col overflow-hidden">
        <header className="flex justify-between items-center w-full px-6 h-16 bg-[#0f131e]/90 backdrop-blur-xl border-b border-white/5 z-20">
          <h1 className="font-headline text-lg tracking-[0.3em] uppercase font-bold text-[#ffd166]">
            Data Ingestion <span className="text-white/20 text-xs italic ml-2 tracking-normal">// Multi-Stream Feed</span>
          </h1>
          <div className="flex items-center gap-4 text-[9px] font-label uppercase tracking-widest text-[#ffd166]/60">
             <span className="w-1.5 h-1.5 bg-secondary rounded-full animate-pulse shadow-[0_0_8px_#ffd166]"></span>
             Processing Active
          </div>
        </header>

        <section className="flex-1 p-6 md:p-10 flex flex-col lg:flex-row gap-8 overflow-hidden">
          
          {/* Input Panel */}
          <div className="flex-1 flex flex-col gap-6 max-h-full overflow-y-auto custom-scrollbar">
            <div className="glass-panel p-8 space-y-8">
              <div className="flex gap-8 border-b border-white/5">
                {['text', 'image', 'voice'].map(tab => (
                  <button 
                    key={tab}
                    onClick={() => { setActiveTab(tab); setResult(null); }}
                    className={`pb-4 px-2 font-headline text-[10px] uppercase tracking-[0.3em] transition-all border-b-2 ${activeTab === tab ? 'border-[#ffd166] text-[#ffd166]' : 'border-transparent text-white/20 hover:text-white/40'}`}
                  >
                    {tab} Stream
                  </button>
                ))}
              </div>

              {activeTab === 'text' && (
                <div className="space-y-4 slide-up">
                  <p className="font-label text-[9px] uppercase tracking-widest text-white/20">Transmit Raw Report Data</p>
                  <textarea 
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    className="w-full h-40 bg-white/5 border border-white/5 p-4 text-xs font-body focus:ring-1 focus:ring-[#ffd166]/20 transition-all placeholder:text-white/10"
                    placeholder="Describe the situation here... (e.g., 'Heavy floods in Patna, 50 families need food.')"
                  />
                  <button 
                    disabled={loading || !inputText.trim()}
                    onClick={() => runExtraction({ text: inputText, source: 'text' })}
                    className="w-full bg-[#ffd166] text-[#0f131e] font-headline font-black py-5 text-xs tracking-widest uppercase hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-30"
                  >
                    {loading ? 'ANALYZING...' : 'TRANSMIT SIGNAL'}
                  </button>
                </div>
              )}

              {activeTab === 'image' && (
                <div className="space-y-6 slide-up">
                  <div {...getRootProps()} className={`border-2 border-dashed h-64 flex flex-col items-center justify-center transition-all cursor-pointer ${isDragActive ? 'border-[#ffd166] bg-[#ffd166]/5' : 'border-white/10 hover:border-white/20 hover:bg-white/2'}`}>
                    <input {...getInputProps()} />
                    {imagePreview ? (
                      <img src={imagePreview} className="h-full w-full object-contain p-4" alt="Preview" />
                    ) : (
                      <div className="text-center">
                        <span className="material-symbols-outlined text-4xl text-white/10 mb-2 block">cloud_upload</span>
                        <p className="font-label text-[9px] uppercase tracking-widest text-white/30">Drop Satellite / Field Media</p>
                      </div>
                    )}
                  </div>
                  <button 
                    disabled={loading || !imageFile}
                    onClick={() => runExtraction({ image: imagePreview, source: 'image' })}
                    className="w-full bg-[#ffd166] text-[#0f131e] font-headline font-black py-5 text-xs tracking-widest uppercase disabled:opacity-30"
                  >
                    {loading ? 'PARSING VISUALS...' : 'STREAM IMAGE INTEL'}
                  </button>
                </div>
              )}

              {activeTab === 'voice' && (
                <div className="space-y-8 flex flex-col items-center py-10 slide-up">
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${listening ? 'border-[#ffd166] scale-110 shadow-[0_0_50px_rgba(255,209,102,0.2)]' : 'border-white/10'}`}>
                    <span className={`material-symbols-outlined text-4xl ${listening ? 'text-[#ffd166] animate-pulse' : 'text-white/10'}`}>{listening ? 'mic' : 'mic_none'}</span>
                  </div>

                  <div className="text-center space-y-2">
                    <p className="font-headline text-xs font-bold uppercase tracking-widest">{listening ? 'Capturing Voice Stream...' : 'Voice Protocol Inactive'}</p>
                    <p className="font-label text-[9px] text-white/20 uppercase tracking-[0.2em]">{listening ? 'Real-time transcription active' : 'Click to begin transmission'}</p>
                  </div>

                  <div className="flex gap-4">
                    {!listening ? (
                      <button onClick={handleStartRecording} className="px-8 py-3 border border-[#ffd166] text-[#ffd166] font-headline text-[9px] uppercase tracking-widest">Begin Record</button>
                    ) : (
                      <button onClick={handleStopRecording} className="px-8 py-3 border border-error text-error font-headline text-[9px] uppercase tracking-widest animate-pulse">Terminate & Send</button>
                    )}
                  </div>

                  {listening && (
                    <div className="w-full bg-white/2 p-4 border border-white/5 slide-up">
                       <p className="font-body text-[10px] text-white/30 italic uppercase text-center">"{voiceTranscript || 'Detecting audio...'}"</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Results Panel */}
          <div className="flex-1 glass-panel p-8 relative overflow-hidden flex flex-col">
            <div className="scan-line top-0 opacity-10"></div>
            <div className="border-b border-white/5 pb-4 mb-6">
               <p className="font-label text-[9px] uppercase tracking-widest text-white/20">Extraction Result</p>
               <h2 className="font-headline text-xl font-bold uppercase tracking-tight text-[#ffd166]">Neural Analysis</h2>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {result ? (
                <div className="space-y-6 slide-up">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 p-4">
                        <span className="font-label text-[8px] uppercase text-white/20 block mb-1">Issue Type</span>
                        <span className="font-headline text-sm font-bold text-on-surface uppercase">{result.issue_type}</span>
                      </div>
                      <div className="bg-white/5 p-4 border-l-2 border-[#ffd166]">
                        <span className="font-label text-[8px] uppercase text-white/20 block mb-1">Urgency Score</span>
                        <span className="font-headline text-sm font-bold text-[#ffd166]">{result.urgency_score}/100</span>
                      </div>
                   </div>

                   <div className="p-4 bg-white/2 border border-white/5 space-y-2">
                       <p className="font-label text-[9px] uppercase tracking-widest text-white/20">Location Context</p>
                       <p className="font-headline text-sm font-bold uppercase">{result.location?.area_name}, {result.location?.state}</p>
                       <p className="text-[10px] font-label text-white/40 uppercase tracking-tighter">
                         LAT: {result.location?.lat?.toFixed?.(4) || '0.00' } / LON: {result.location?.lng?.toFixed?.(4) || '0.00'}
                       </p>
                   </div>

                   <div className="space-y-2">
                       <p className="font-label text-[9px] uppercase tracking-widest text-white/20">Intelligence Summary</p>
                       <p className="font-body text-xs leading-relaxed text-white/60">{result.summary}</p>
                   </div>

                   <div className="space-y-4">
                       <p className="font-label text-[9px] uppercase tracking-widest text-primary-container/30">Routing Protocol</p>
                       <div className="p-4 bg-secondary/5 border border-secondary/20">
                          <p className="font-label text-[9px] text-secondary uppercase font-bold mb-1">Immediate Strategy</p>
                          <p className="font-body text-[10px] italic text-secondary/80 ">{result.recommended_action}</p>
                       </div>
                   </div>

                   <button onClick={() => setResult(null)} className="w-full py-4 text-[9px] font-label uppercase text-white/20 tracking-widest hover:text-white transition-colors border-t border-white/5 mt-auto">Clear Session Results</button>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-10">
                   <span className="material-symbols-outlined text-6xl">neural_link</span>
                   <p className="font-headline text-xs uppercase tracking-[0.4em] mt-4">Awaiting Signal Ingestion</p>
                </div>
              )}
            </div>
          </div>

        </section>
      </main>
    </div>
  );
}
