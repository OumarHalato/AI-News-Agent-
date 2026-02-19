
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { ConnectionStatus, Message } from './types';
import { decode, decodeAudioData, createBlob } from './utils/audioUtils';
import AudioVisualizer from './components/AudioVisualizer';
import NewsCard from './components/NewsCard';

const SYSTEM_INSTRUCTION = `
You are 'Nova', a professional and charismatic AI News Agent. 
Your goal is to provide brief, high-impact news updates and engage in conversational discussion about current events.
Keep your responses concise, like a radio news anchor. 
If the user asks for news, summarize top stories from the last 24 hours. 
If the user wants to chat, be insightful but stay on the topic of world events, technology, and culture.
Always use a warm, authoritative news-reading tone.
`;

const App: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [history, setHistory] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  
  // Refs for audio handling
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const sessionRef = useRef<any>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);

  // Transcriptions
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  const scrollToBottom = () => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history]);

  const stopAllAudio = () => {
    activeSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  };

  const handleLiveMessage = useCallback(async (message: LiveServerMessage) => {
    // 1. Handle Transcriptions
    if (message.serverContent?.outputTranscription) {
      currentOutputTranscription.current += message.serverContent.outputTranscription.text;
    } else if (message.serverContent?.inputTranscription) {
      currentInputTranscription.current += message.serverContent.inputTranscription.text;
    }

    if (message.serverContent?.turnComplete) {
      const userText = currentInputTranscription.current;
      const modelText = currentOutputTranscription.current;

      if (userText) {
        setHistory(prev => [...prev, { role: 'user', text: userText, timestamp: Date.now() }]);
      }
      if (modelText) {
        setHistory(prev => [...prev, { role: 'model', text: modelText, timestamp: Date.now() }]);
      }

      currentInputTranscription.current = '';
      currentOutputTranscription.current = '';
    }

    // 2. Handle Audio Output
    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    if (base64Audio && outputAudioContextRef.current) {
      const ctx = outputAudioContextRef.current;
      nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
      
      const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      
      source.onended = () => {
        activeSourcesRef.current.delete(source);
      };

      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += audioBuffer.duration;
      activeSourcesRef.current.add(source);
    }

    // 3. Handle Interruption
    if (message.serverContent?.interrupted) {
      stopAllAudio();
    }
  }, []);

  const toggleConnection = async () => {
    if (status === ConnectionStatus.CONNECTED) {
      // Disconnect
      sessionRef.current?.close();
      inputAudioContextRef.current?.close();
      outputAudioContextRef.current?.close();
      setStatus(ConnectionStatus.DISCONNECTED);
      setIsListening(false);
      return;
    }

    try {
      setStatus(ConnectionStatus.CONNECTING);
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Initialize Audio Contexts
      inputAudioContextRef.current = new AudioContext({ sampleRate: 16000 });
      outputAudioContextRef.current = new AudioContext({ sampleRate: 24000 });
      
      // Setup Analyzer for visualization
      analyzerRef.current = inputAudioContextRef.current.createAnalyser();
      analyzerRef.current.fftSize = 256;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            console.log('Gemini Live connected');
            setStatus(ConnectionStatus.CONNECTED);
            setIsListening(true);

            // Audio streaming from Mic
            const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(analyzerRef.current!);
            analyzerRef.current!.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current!.destination);
          },
          onmessage: handleLiveMessage,
          onerror: (e) => {
            console.error('Live API Error:', e);
            setStatus(ConnectionStatus.ERROR);
          },
          onclose: () => {
            console.log('Gemini Live closed');
            setStatus(ConnectionStatus.DISCONNECTED);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: SYSTEM_INSTRUCTION,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          },
          outputAudioTranscription: {},
          inputAudioTranscription: {},
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (error) {
      console.error('Failed to connect:', error);
      setStatus(ConnectionStatus.ERROR);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Nova <span className="text-blue-500">Live</span></h1>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${status === ConnectionStatus.CONNECTED ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
              <span className="text-xs text-slate-400 uppercase font-medium">{status}</span>
            </div>
          </div>
        </div>
        
        <button 
          onClick={toggleConnection}
          className={`px-6 py-2 rounded-full font-semibold transition-all flex items-center gap-2 ${
            status === ConnectionStatus.CONNECTED 
            ? 'bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500 hover:text-white' 
            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-900/20'
          }`}
        >
          {status === ConnectionStatus.CONNECTED ? 'End Broadcast' : 'Start Broadcast'}
        </button>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Chat & Controls */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Audio Visualizer Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Audio Levels</h2>
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className={`w-1 h-3 rounded-full ${isListening ? 'bg-blue-500 animate-bounce' : 'bg-slate-700'}`} style={{ animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            </div>
            <AudioVisualizer isActive={isListening} analyzer={analyzerRef.current || undefined} />
            <p className="mt-4 text-xs text-slate-500 italic text-center">
              {status === ConnectionStatus.CONNECTED ? "Speak clearly. Nova is listening for news inquiries..." : "Connect to begin the news broadcast."}
            </p>
          </div>

          {/* Conversation Log */}
          <div className="flex-1 bg-slate-900/80 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-xl min-h-[400px]">
             <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
               <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Transcript</h2>
               <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">Live Recording</span>
             </div>
             
             <div className="flex-1 overflow-y-auto p-6 space-y-6">
               {history.length === 0 && (
                 <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-4 opacity-50">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                   </svg>
                   <p>Start a conversation to see the transcript</p>
                 </div>
               )}
               {history.map((msg, i) => (
                 <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                   <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                     msg.role === 'user' 
                     ? 'bg-blue-600 text-white rounded-tr-none' 
                     : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                   }`}>
                     <p className="text-sm leading-relaxed">{msg.text}</p>
                   </div>
                   <span className="text-[10px] text-slate-500 mt-1 uppercase">
                     {msg.role === 'user' ? 'You' : 'Nova'} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   </span>
                 </div>
               ))}
               <div ref={historyEndRef} />
             </div>
          </div>
        </div>

        {/* Right: Dashboard / Related Info */}
        <div className="flex flex-col gap-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Trending Now</h2>
            <div className="space-y-4">
              <NewsCard 
                category="Technology" 
                title="Gemini 2.5 Revolutionizes Real-Time Voice Interaction" 
                image="https://picsum.photos/400/225?random=1" 
              />
              <NewsCard 
                category="World" 
                title="Global Markets React to New Sustainable Energy Policies" 
                image="https://picsum.photos/400/225?random=2" 
              />
              <NewsCard 
                category="Space" 
                title="Upcoming Lunar Mission Set for Historic Launch Next Week" 
                image="https://picsum.photos/400/225?random=3" 
              />
            </div>
          </div>

          <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-6 shadow-xl">
            <h2 className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-3">Broadcast Tips</h2>
            <ul className="text-xs text-slate-400 space-y-2">
              <li className="flex gap-2">
                <span className="text-blue-500 font-bold">•</span>
                <span>Ask: "What are the top tech stories today?"</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-500 font-bold">•</span>
                <span>Ask: "Explain the implications of the new energy bill."</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-500 font-bold">•</span>
                <span>Interrupt anytime by speaking—Nova will stop and listen.</span>
              </li>
            </ul>
          </div>
        </div>
      </main>

      {/* Footer / Status Bar */}
      <footer className="px-6 py-3 border-t border-slate-800 bg-slate-900/50 backdrop-blur-md flex justify-between items-center text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <span>Engine: Gemini 2.5 Native Audio</span>
          <span className="w-1 h-1 bg-slate-700 rounded-full" />
          <span>Latency: Ultra-Low</span>
        </div>
        <div>
          © 2024 Nova AI Networks
        </div>
      </footer>
    </div>
  );
};

export default App;
