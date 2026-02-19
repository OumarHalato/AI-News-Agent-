
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type } from '@google/genai';
import { ConnectionStatus, Message, Category, SpeechRate, User, Language } from './types';
import { decode, decodeAudioData, createBlob } from './utils/audioUtils';
import AudioVisualizer from './components/AudioVisualizer';
import NewsCard, { DisseminationStatus } from './components/NewsCard';
import AuthModal from './components/AuthModal';

interface SavedArticle {
  title: string;
  category: string;
  source?: string;
  image: string;
  url: string;
  platform?: any;
  metrics?: any;
  groundingSources?: { title: string; uri: string }[];
}

interface PostedArticle extends SavedArticle {
  postedDate: string;
  summary?: string;
  videoUrl?: string;
  tags?: string[];
  sentiment?: string;
  dissemination?: DisseminationStatus;
}

interface UserInterests {
  [key: string]: number;
}

const LANGUAGES: Language[] = ['English', 'Amharic', 'Afaan Oromo', 'Tigrinya', 'Somali', 'Afar', 'French'];

const SOCIAL_CHANNELS = [
  {
    id: 'fb',
    name: 'Nova Facebook Page',
    platform: 'Facebook',
    description: 'Join our high-fidelity community for daily news updates and live discussions.',
    link: 'https://facebook.com/nova_networks_official',
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
    ),
    color: 'from-blue-600 to-blue-900',
    glow: 'shadow-blue-500/20'
  },
  {
    id: 'yt',
    name: 'Nova YouTube Channel',
    platform: 'YouTube',
    description: 'Watch cinematic daily briefings and exclusive AI-generated global documentaries.',
    link: 'https://youtube.com/@nova_networks',
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
    ),
    color: 'from-red-600 to-red-900',
    glow: 'shadow-red-500/20'
  },
  {
    id: 'tg',
    name: 'Nova Telegram Channel',
    platform: 'Telegram',
    description: 'Get instant notifications and participate in global news polls and analytics.',
    link: 'https://t.me/nova_networks_official',
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.762 5.319-1.083 7.029-.137.724-.403.967-.658.99-.554.051-1.002-.367-1.538-.72-.84-.551-1.314-.892-2.129-1.428-1.06-.7-1.353-1.12-.48-1.921.229-.21 4.197-3.844 4.274-4.17.01-.043.01-.203-.085-.285-.094-.084-.233-.056-.333-.033-.142.033-2.42 1.541-6.828 4.517-.645.443-1.23.66-1.753.647-.577-.014-1.686-.328-2.511-.597-1.012-.331-1.817-.506-1.747-.852a.66.66 0 0 1 .251-.444c.407-.267 1.45-.82 3.033-1.5 1.583-.68 3.51-1.517 5.782-2.511.933-.404 1.706-.578 2.304-.575z"/></svg>
    ),
    color: 'from-sky-500 to-sky-800',
    glow: 'shadow-sky-500/20'
  }
];

const getSystemInstruction = (
  category: Category, 
  speechRate: SpeechRate, 
  language: Language,
  user?: User
) => {
  return `
ROLE: You are 'Nova', a high-fidelity, multilingual AI News Agent for Nova Networks.
MISSION: Provide accurate, real-time news updates and professional translations.
PRIMARY LANGUAGE: ${language}.
CURRENT CHANNEL: ${category}.

CAPABILITIES:
1. Intelligent Search: Retrieve recent, relevant info and summarize top 3 points.
2. Translation: High-quality translations for Amharic, Afaan Oromo, Tigrinya, Somali, Afar, and International languages.
3. Tone: Cyberpunk, sleek, authoritative, yet accessible. Professional news anchor style.

INSTRUCTION: ${user?.isLoggedIn ? `Address the user as ${user.username}.` : ""}
If a user provides a topic, summarize the top 3 news points. Always offer to translate the summary into local Ethiopian languages if not already requested.
`;
};

const CATEGORIES: { id: Category; label: string; icon: string; color: string }[] = [
  { id: 'Recommended', label: 'For You', icon: '✨', color: 'bg-gradient-to-r from-blue-600 to-indigo-600' },
  { id: 'Feed', label: 'My Feed', icon: '📢', color: 'bg-indigo-700' },
  { id: 'SocialMedia', label: 'Channels', icon: '📱', color: 'bg-purple-700' },
  { id: 'All', label: 'Global', icon: '🌍', color: 'bg-slate-700' },
];

const INITIAL_NEWS = [
  { date: '2025-05-20T10:00:00Z', category: 'Political', source: 'Nova Global', title: 'Global Tech Summits Address AI Sovereignty in East Africa', image: 'https://picsum.photos/400/225?random=11', url: 'https://nova.ai/news/africa/tech-summit', tags: ['Tech', 'EastAfrica'], sentiment: 'Neutral', platform: 'web' as const },
];

const App: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [history, setHistory] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category>('Recommended');
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('English');
  const [speechRate, setSpeechRate] = useState<SpeechRate>('normal');
  const [newsArticles, setNewsArticles] = useState(INITIAL_NEWS);
  const [savedArticles, setSavedArticles] = useState<SavedArticle[]>([]);
  const [postedArticles, setPostedArticles] = useState<PostedArticle[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);

  const [summarizingArticleIds, setSummarizingArticleIds] = useState<Set<string>>(new Set());
  const [articleSummaries, setArticleSummaries] = useState<Record<string, string>>({});
  const [articleGrounding, setArticleGrounding] = useState<Record<string, any[]>>({});

  const [streamingUserText, setStreamingUserText] = useState('');
  const [streamingModelText, setStreamingModelText] = useState('');

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  useEffect(() => {
    const user = localStorage.getItem('nova_current_user');
    if (user) try { setCurrentUser(JSON.parse(user)); } catch (e) {}
  }, []);

  const stopAllAudio = useCallback(() => {
    activeSourcesRef.current.forEach(source => { try { source.stop(); } catch (e) {} });
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const handleLiveMessage = useCallback(async (message: LiveServerMessage) => {
    if (message.serverContent?.outputTranscription) {
      currentOutputTranscription.current += message.serverContent.outputTranscription.text;
      setStreamingModelText(currentOutputTranscription.current);
    } else if (message.serverContent?.inputTranscription) {
      currentInputTranscription.current += message.serverContent.inputTranscription.text;
      setStreamingUserText(currentInputTranscription.current);
    }
    
    if (message.serverContent?.interrupted) stopAllAudio();

    if (message.serverContent?.turnComplete) {
      setHistory(prev => [...prev, { role: 'user', text: currentInputTranscription.current, timestamp: Date.now() }, { role: 'model', text: currentOutputTranscription.current, timestamp: Date.now() }]);
      currentInputTranscription.current = ''; currentOutputTranscription.current = ''; setStreamingUserText(''); setStreamingModelText('');
    }

    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
    if (base64Audio && outputAudioContextRef.current) {
      const ctx = outputAudioContextRef.current;
      nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
      const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer; source.connect(ctx.destination);
      source.onended = () => activeSourcesRef.current.delete(source);
      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += audioBuffer.duration;
      activeSourcesRef.current.add(source);
    }
  }, [stopAllAudio]);

  const toggleConnection = useCallback(async () => {
    if (status === ConnectionStatus.CONNECTED) {
      sessionRef.current?.close(); setStatus(ConnectionStatus.DISCONNECTED); setIsListening(false); return;
    }
    try {
      setStatus(ConnectionStatus.CONNECTING);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      inputAudioContextRef.current = new AudioContext({ sampleRate: 16000 });
      outputAudioContextRef.current = new AudioContext({ sampleRate: 24000 });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setStatus(ConnectionStatus.CONNECTED); setIsListening(true);
            const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor); scriptProcessor.connect(inputAudioContextRef.current!.destination);
          },
          onmessage: handleLiveMessage,
          onerror: () => setStatus(ConnectionStatus.ERROR),
          onclose: () => setStatus(ConnectionStatus.DISCONNECTED)
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: getSystemInstruction(selectedCategory, speechRate, selectedLanguage, currentUser || undefined),
          outputAudioTranscription: {}, inputAudioTranscription: {},
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (error) { setStatus(ConnectionStatus.ERROR); }
  }, [status, selectedCategory, speechRate, selectedLanguage, handleLiveMessage, currentUser]);

  const handleSummarize = async (article: any) => {
    if (summarizingArticleIds.has(article.title)) return;
    setSummarizingArticleIds(prev => new Set(prev).add(article.title));
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Research this topic and provide a high-fidelity summary in ${selectedLanguage} with the top 3 points: "${article.title}"`,
        config: { tools: [{ googleSearch: {} }] }
      });
      setArticleSummaries(prev => ({ ...prev, [article.title]: response.text || "" }));
      if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        setArticleGrounding(prev => ({ ...prev, [article.title]: response.candidates![0].groundingMetadata!.groundingChunks! }));
      }
    } catch (err) { console.error(err); } finally { setSummarizingArticleIds(prev => { const next = new Set(prev); next.delete(article.title); return next; }); }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-blue-500/30">
      <header className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50 flex justify-between items-center shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/40 border border-blue-400/30">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter uppercase italic">Nova <span className="text-blue-500">Channels</span></h1>
            <p className="text-[10px] font-mono text-blue-400/70 tracking-widest uppercase">Multi-Lingual News Grid</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <button 
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-full text-xs font-bold text-slate-300 hover:border-blue-500 transition-all flex items-center gap-2"
            >
              🌐 {selectedLanguage}
            </button>
            {showLangMenu && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl py-2 z-50 animate-fade-in">
                {LANGUAGES.map(lang => (
                  <button 
                    key={lang} 
                    onClick={() => { setSelectedLanguage(lang); setShowLangMenu(false); }}
                    className={`w-full text-left px-4 py-2 text-xs transition-colors ${selectedLanguage === lang ? 'text-blue-400 bg-blue-500/10 font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button 
            onClick={toggleConnection} 
            className={`px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest transition-all ${status === ConnectionStatus.CONNECTED ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-900/20' : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/20'}`}
          >
            {status === ConnectionStatus.CONNECTED ? 'Kill Stream' : 'Go Live'}
          </button>

          {currentUser ? (
            <div className="relative">
              <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="w-10 h-10 rounded-xl border border-slate-700 overflow-hidden hover:border-blue-500 bg-slate-800">
                <img src={currentUser.avatar} alt={currentUser.username} className="w-full h-full object-cover" />
              </button>
              {showProfileMenu && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl py-2 z-50">
                  <div className="px-4 py-2 border-b border-slate-800 text-[10px] font-bold text-slate-500">{currentUser.username}</div>
                  <button onClick={() => setCurrentUser(null)} className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-red-500/10">Sign Out</button>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => setIsAuthModalOpen(true)} className="px-5 py-2 bg-slate-800 border border-slate-700 rounded-full text-xs font-bold">Sign In</button>
          )}
        </div>
      </header>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} onAuthSuccess={(user) => setCurrentUser(user)} />

      <main className="flex-1 max-w-6xl mx-auto w-full p-6 space-y-8">
        <section className="flex flex-wrap gap-2">
          {CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${selectedCategory === cat.id ? `${cat.color} text-white shadow-lg shadow-blue-900/20` : 'bg-slate-900 border border-slate-800 text-slate-500 hover:border-slate-700'}`}>
              <span className="mr-2">{cat.icon}</span> {cat.label}
            </button>
          ))}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[700px]">
          <div className="lg:col-span-2 flex flex-col gap-6 h-full">
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
               <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-600/5 rounded-full blur-3xl group-hover:bg-blue-600/10 transition-all duration-700" />
               <AudioVisualizer isActive={isListening} analyzer={undefined} />
               <div className="mt-4 flex items-center justify-between">
                 <div className="text-[10px] font-mono text-blue-500/60 uppercase tracking-widest">Signal Integrity: Optimal</div>
                 <div className="flex gap-2">
                   <div className={`w-1.5 h-1.5 rounded-full ${isListening ? 'bg-blue-500 animate-pulse' : 'bg-slate-700'}`} />
                   <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                 </div>
               </div>
            </div>
            <div className="flex-1 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 overflow-y-auto space-y-4 shadow-xl scrollbar-hide">
              {history.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-5 py-3 rounded-2xl ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700'}`}>
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              ))}
              {streamingModelText && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] px-5 py-3 rounded-2xl bg-slate-800 text-blue-100 rounded-tl-none border border-blue-500/30 animate-pulse italic">
                    {streamingModelText}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-6 overflow-y-auto pr-2 scrollbar-hide">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-3">
              <span className="w-8 h-px bg-slate-800" /> 
              {selectedCategory === 'SocialMedia' ? 'Official Channels' : 'Grounded Intelligence'} 
              <span className="w-full h-px bg-slate-800" />
            </h2>
            
            {selectedCategory === 'SocialMedia' ? (
              <div className="space-y-4">
                {SOCIAL_CHANNELS.map((channel) => (
                  <div key={channel.id} className={`group relative rounded-2xl p-5 bg-gradient-to-br ${channel.color} border border-white/10 shadow-xl overflow-hidden`}>
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                      {channel.icon}
                    </div>
                    <div className="relative z-10 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-white/10 rounded-lg">
                          {channel.icon}
                        </div>
                        <div>
                          <h3 className="text-xs font-black uppercase tracking-widest text-white">{channel.name}</h3>
                          <p className="text-[8px] font-mono text-white/60 uppercase">{channel.platform}</p>
                        </div>
                      </div>
                      <p className="text-[10px] text-white/80 leading-relaxed font-medium">
                        {channel.description}
                      </p>
                      <a 
                        href={channel.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-xl text-[9px] font-black uppercase tracking-widest text-white transition-all transform active:scale-95"
                      >
                        Join {channel.platform}
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </a>
                    </div>
                    {/* Visual Pulse for "Live" effect */}
                    <div className="absolute bottom-4 right-4 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-ping" />
                      <span className="text-[8px] font-mono font-bold text-white/40 uppercase tracking-tighter">Connected</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              newsArticles.map((news, idx) => (
                <NewsCard 
                  key={news.title + idx} 
                  {...news}
                  summary={articleSummaries[news.title]}
                  isSummarizing={summarizingArticleIds.has(news.title)}
                  onSummarize={() => handleSummarize(news)}
                />
              ))
            )}
          </div>
        </div>
      </main>
      <footer className="px-6 py-4 border-t border-slate-800/50 bg-slate-950/80 text-center text-[9px] text-slate-600 uppercase tracking-[0.4em] font-black">
        Nova AI Networks // Multilingual Broadcast Node 001-ALPHA
      </footer>
    </div>
  );
};

export default App;
