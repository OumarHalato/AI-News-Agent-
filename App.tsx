
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type } from '@google/genai';
import { ConnectionStatus, Message, Category, SpeechRate, User } from './types';
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

const VIDEO_LOADING_MESSAGES = [
  "Nova AI is synthesizing broadcast feeds...",
  "Analyzing global news patterns...",
  "Synthesizing high-fidelity cinematic summary...",
  "Encoding semantic visual data...",
  "Nova preparing your cinematic briefing...",
  "Calibrating visual news engine..."
];

const getSystemInstruction = (
  category: Category, 
  speechRate: SpeechRate, 
  topInterests: string[], 
  recentKeywords: string[],
  user?: User
) => {
  const nameFragment = user?.isLoggedIn ? `The user's name is ${user.username}. Address them occasionally in your broadcast.` : "";
  
  return `
ROLE: You are 'Nova', a world-class AI News Anchor for Nova Networks.
TONE: Authoritative, charismatic, warm, and highly professional.
CURRENT CHANNEL: ${category === 'All' ? 'Global Feed' : category + ' Desk'}.
${nameFragment}

MISSION: Provide a high-fidelity, conversational news experience across Web, Facebook, Telegram, and YouTube.
`;
};

const CATEGORIES: { id: Category; label: string; icon: string; color: string }[] = [
  { id: 'Recommended', label: 'For You', icon: '✨', color: 'bg-gradient-to-r from-blue-600 to-indigo-600' },
  { id: 'Feed', label: 'My Feed', icon: '📢', color: 'bg-indigo-700' },
  { id: 'SocialMedia', label: 'Channels', icon: '📱', color: 'bg-purple-700' },
  { id: 'All', label: 'All News', icon: '🌍', color: 'bg-slate-700' },
  { id: 'Political', label: 'Political', icon: '🏛️', color: 'bg-purple-600' },
  { id: 'Economical', label: 'Economical', icon: '📉', color: 'bg-emerald-600' },
];

const INITIAL_NEWS = [
  { date: '2025-05-20T10:00:00Z', category: 'Political', source: 'BBC News', title: 'Global Summits Address New Diplomatic Challenges in 2025', image: 'https://picsum.photos/400/225?random=11', url: 'https://nova.ai/news/political/summit-2025', tags: ['Diplomacy', 'Summit2025'], sentiment: 'Neutral', platform: 'web' as const },
  { date: '2025-05-21T09:15:00Z', category: 'SocialMedia', source: 'Telegram Global', title: 'Massive Tech Adoption in Emerging Markets: A Live Discussion', image: 'https://picsum.photos/400/225?random=44', url: 'https://t.me/nova_global', tags: ['Tech', 'Emerging'], sentiment: 'Positive', platform: 'telegram' as const, metrics: { views: '1.2M', shares: '45K' } },
  { date: '2025-05-21T12:00:00Z', category: 'SocialMedia', source: 'YouTube Trends', title: 'Why 2025 is the Year of AI Creativity - Exclusive Interview', image: 'https://picsum.photos/400/225?random=55', url: 'https://youtube.com/nova_ai', tags: ['AI', 'Creativity'], sentiment: 'Positive', platform: 'youtube' as const, metrics: { views: '8.4M', shares: '120K' } },
  { date: '2025-05-20T15:30:00Z', category: 'SocialMedia', source: 'Facebook News', title: 'Community Projects: Rebuilding Urban Spaces with Solar Tech', image: 'https://picsum.photos/400/225?random=66', url: 'https://fb.com/nova_news', tags: ['Community', 'Solar'], sentiment: 'Positive', platform: 'facebook' as const, metrics: { views: '500K', shares: '12K' } },
];

const SOURCES = ['BBC News', 'The Economist', 'Reuters', 'Bloomberg', 'The Guardian', 'Telegram Global', 'YouTube Trends', 'Facebook News'];

const App: React.FC = () => {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [history, setHistory] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category>('Recommended');
  const [speechRate, setSpeechRate] = useState<SpeechRate>('normal');
  const [isNewsLoading, setIsNewsLoading] = useState(false);
  const [newsArticles, setNewsArticles] = useState(INITIAL_NEWS);
  const [savedArticles, setSavedArticles] = useState<SavedArticle[]>([]);
  const [postedArticles, setPostedArticles] = useState<PostedArticle[]>([]);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [userInterests, setUserInterests] = useState<UserInterests>({});
  
  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const [availableMicrophones, setAvailableMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState<string>('');
  const [inputSensitivity, setInputSensitivity] = useState<number>(30);
  const [inputLevel, setInputLevel] = useState<number>(0);
  const [showSettings, setShowSettings] = useState(false);

  const [summarizingArticleIds, setSummarizingArticleIds] = useState<Set<string>>(new Set());
  const [articleSummaries, setArticleSummaries] = useState<Record<string, string>>({});
  const [articleTags, setArticleTags] = useState<Record<string, string[]>>({});
  const [articleSentiments, setArticleSentiments] = useState<Record<string, string>>({});

  const [streamingUserText, setStreamingUserText] = useState('');
  const [streamingModelText, setStreamingModelText] = useState('');

  const [generatingVideoId, setGeneratingVideoId] = useState<string | null>(null);
  const [articleVideos, setArticleVideos] = useState<Record<string, string>>({});
  const [activeVideo, setActiveVideo] = useState<{url: string, title: string} | null>(null);
  const [videoLoadingMessageIdx, setVideoLoadingMessageIdx] = useState(0);

  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const sessionRef = useRef<any>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);
  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  useEffect(() => {
    const saved = localStorage.getItem('nova_saved_articles');
    if (saved) try { setSavedArticles(JSON.parse(saved)); } catch (e) {}
    const posted = localStorage.getItem('nova_posted_articles');
    if (posted) try { setPostedArticles(JSON.parse(posted)); } catch (e) {}
    const interests = localStorage.getItem('nova_user_interests');
    if (interests) try { setUserInterests(JSON.parse(interests)); } catch (e) {}
    
    const user = localStorage.getItem('nova_current_user');
    if (user) try { setCurrentUser(JSON.parse(user)); } catch (e) {}
  }, []);

  useEffect(() => {
    localStorage.setItem('nova_saved_articles', JSON.stringify(savedArticles));
    localStorage.setItem('nova_posted_articles', JSON.stringify(postedArticles));
    localStorage.setItem('nova_user_interests', JSON.stringify(userInterests));
    if (currentUser) {
      localStorage.setItem('nova_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('nova_current_user');
    }
  }, [savedArticles, postedArticles, userInterests, currentUser]);

  const trackInteraction = useCallback((category: string, weight: number = 1) => {
    setUserInterests(prev => ({ ...prev, [category]: ((prev[category] as number) || 0) + weight }));
  }, []);

  const topInterests = useMemo(() => Object.entries(userInterests).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 2).map(([cat]) => cat), [userInterests]);
  const recentKeywords = useMemo(() => history.filter(m => m.role === 'user').slice(-5).map(m => m.text).join(' ').toLowerCase().match(/\b(\w+)\b/g)?.slice(0, 8) || [], [history]);

  const fetchLatestNews = useCallback(async () => {
    setIsNewsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const newArticles = [
      { date: new Date().toISOString(), category: 'SocialMedia' as Category, source: 'Nova Channels', title: `Flash Update: ${['New AI Milestone', 'Global Crypto Shift', 'Sustainable Future Hub'][Math.floor(Math.random() * 3)]}`, image: `https://picsum.photos/400/225?random=${Math.floor(Math.random() * 100)}`, url: 'https://nova.ai/social', tags: ['Live', 'Nova'], sentiment: 'Positive', platform: 'telegram' as const, metrics: { views: '10K', shares: '200' } },
      ...newsArticles
    ].slice(0, 12);
    setNewsArticles(newArticles);
    setIsNewsLoading(false);
  }, [newsArticles]);

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
    
    if (message.serverContent?.interrupted) {
      stopAllAudio();
    }

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
          onerror: (e) => {
            console.error('Live API Session Error:', e);
            setStatus(ConnectionStatus.ERROR);
          },
          onclose: () => setStatus(ConnectionStatus.DISCONNECTED)
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: getSystemInstruction(selectedCategory, speechRate, topInterests, recentKeywords, currentUser || undefined),
          outputAudioTranscription: {}, inputAudioTranscription: {},
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (error) { setStatus(ConnectionStatus.ERROR); }
  }, [status, selectedCategory, speechRate, handleLiveMessage, topInterests, recentKeywords, currentUser]);

  const handleSummarize = async (article: any) => {
    if (summarizingArticleIds.has(article.title)) return;
    setSummarizingArticleIds(prev => new Set(prev).add(article.title));
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Headline: "${article.title}". JSON: summary, tags[], sentiment`,
        config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { summary: { type: Type.STRING }, tags: { type: Type.ARRAY, items: { type: Type.STRING } }, sentiment: { type: Type.STRING } }, required: ["summary", "tags", "sentiment"] } }
      });
      const result = JSON.parse(response.text || '{}');
      setArticleSummaries(prev => ({ ...prev, [article.title]: result.summary }));
      setArticleTags(prev => ({ ...prev, [article.title]: result.tags }));
      setArticleSentiments(prev => ({ ...prev, [article.title]: result.sentiment }));
    } catch (err) { console.error(err); } finally { setSummarizingArticleIds(prev => { const next = new Set(prev); next.delete(article.title); return next; }); }
  };

  const handleGenerateVideo = async (article: any) => {
    if (articleVideos[article.title]) { setActiveVideo({ url: articleVideos[article.title], title: article.title }); return; }
    setGeneratingVideoId(article.title);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: `Cinematic news briefing: ${article.title}`,
        config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
      });
      while (!operation.done) { await new Promise(r => setTimeout(r, 10000)); operation = await ai.operations.getVideosOperation({ operation }); }
      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const res = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        const url = URL.createObjectURL(await res.blob());
        setArticleVideos(prev => ({ ...prev, [article.title]: url }));
        setActiveVideo({ url, title: article.title });
      }
    } finally { setGeneratingVideoId(null); }
  };

  const toggleSaveArticle = (article: any) => {
    if (!currentUser?.isLoggedIn) {
      setIsAuthModalOpen(true);
      return;
    }
    setSavedArticles(prev => prev.some(a => a.title === article.title) ? prev.filter(a => a.title !== article.title) : [...prev, article]);
  };

  const togglePostArticle = (article: any) => {
    if (!currentUser?.isLoggedIn) {
      setIsAuthModalOpen(true);
      return;
    }
    setPostedArticles(prev => prev.some(a => a.title === article.title) ? prev.filter(a => a.title !== article.title) : [{ ...article, postedDate: new Date().toISOString(), summary: articleSummaries[article.title], videoUrl: articleVideos[article.title], tags: articleTags[article.title], sentiment: articleSentiments[article.title], dissemination: {} }, ...prev]);
  };

  const handleDisseminate = (articleTitle: string, platform: keyof DisseminationStatus) => {
    setPostedArticles(prev => prev.map(a => a.title === articleTitle ? { ...a, dissemination: { ...a.dissemination, [platform]: true } } : a));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setShowProfileMenu(false);
  };

  const filteredAndSortedNews = useMemo(() => {
    if (selectedCategory === 'Feed') return [...postedArticles].sort((a, b) => new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime());
    let result = [...newsArticles];
    if (selectedCategory !== 'All' && selectedCategory !== 'Recommended') result = result.filter(news => news.category === selectedCategory);
    return result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedCategory, newsArticles, postedArticles]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
      <header className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Nova <span className="text-blue-500">Channels</span></h1>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleConnection} 
            className={`px-6 py-2 rounded-full font-semibold transition-all flex items-center gap-2 ${status === ConnectionStatus.CONNECTED ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-900/20'}`}
          >
            {status === ConnectionStatus.CONNECTED ? 'End Session' : 'Start Session'}
          </button>

          {currentUser ? (
            <div className="relative">
              <button 
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-10 h-10 rounded-full border border-slate-700 overflow-hidden hover:border-blue-500 transition-colors bg-slate-800"
              >
                <img src={currentUser.avatar} alt={currentUser.username} className="w-full h-full object-cover" />
              </button>
              
              {showProfileMenu && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl py-2 z-50 animate-fade-in">
                  <div className="px-4 py-2 border-b border-slate-800 mb-1">
                    <p className="text-xs font-bold text-white truncate">{currentUser.username}</p>
                    <p className="text-[10px] text-slate-500 truncate">{currentUser.email}</p>
                  </div>
                  <button className="w-full text-left px-4 py-2 text-xs text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">Settings</button>
                  <button 
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button 
              onClick={() => setIsAuthModalOpen(true)}
              className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full text-sm font-bold border border-slate-700 transition-all"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(user) => setCurrentUser(user)}
      />

      {generatingVideoId && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center">
          <div className="w-24 h-24 mb-8 relative">
            <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full" />
            <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-blue-400 font-mono animate-pulse uppercase tracking-widest text-sm">{VIDEO_LOADING_MESSAGES[videoLoadingMessageIdx]}</p>
        </div>
      )}

      {activeVideo && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 flex items-center justify-center p-4">
          <div className="max-w-4xl w-full bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800">
            <div className="px-6 py-4 flex justify-between items-center border-b border-slate-800 bg-slate-900/80">
              <h3 className="text-sm font-bold text-white truncate max-w-[80%]">{activeVideo.title}</h3>
              <button onClick={() => setActiveVideo(null)} className="p-1.5 bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <video src={activeVideo.url} controls autoPlay className="w-full aspect-video" />
          </div>
        </div>
      )}

      <main className="flex-1 max-w-6xl mx-auto w-full p-6 space-y-8">
        <section className="flex flex-wrap gap-2 bg-slate-900/40 p-4 rounded-3xl border border-slate-800/50">
          {CATEGORIES.map(cat => (
            <button 
              key={cat.id} 
              onClick={() => {
                if (cat.id === 'Feed' && !currentUser?.isLoggedIn) {
                  setIsAuthModalOpen(true);
                } else {
                  setSelectedCategory(cat.id);
                }
              }} 
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${selectedCategory === cat.id ? `${cat.color} text-white shadow-lg` : 'bg-slate-900 border border-slate-800 text-slate-400 hover:border-slate-700'}`}
            >
              <span className="mr-2">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
               <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-600/5 rounded-full blur-3xl group-hover:bg-blue-600/10 transition-all duration-700" />
               <AudioVisualizer isActive={isListening} analyzer={analyzerRef.current || undefined} />
            </div>
            <div className="flex-1 bg-slate-900/80 border border-slate-800 rounded-3xl p-6 min-h-[400px] overflow-y-auto space-y-4 shadow-xl">
              {history.length === 0 && !streamingUserText && !streamingModelText && (
                <div className="h-full flex flex-col items-center justify-center text-slate-700 opacity-40">
                  <p className="text-xs font-bold uppercase tracking-widest">Frequency Silent</p>
                </div>
              )}
              {history.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-5 py-3 rounded-2xl shadow-md ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {streamingModelText && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] px-5 py-3 rounded-2xl bg-slate-800 text-slate-100 rounded-tl-none border border-blue-500/30 animate-pulse">
                    {streamingModelText}
                  </div>
                </div>
              )}
              {streamingUserText && (
                <div className="flex justify-end">
                  <div className="max-w-[80%] px-5 py-3 rounded-2xl bg-blue-600/40 text-blue-100 rounded-tr-none border border-blue-400/20 italic">
                    {streamingUserText}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-6 overflow-y-auto max-h-[800px] pr-2 scrollbar-hide">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
              {selectedCategory === 'Feed' ? 'Broadcasting Console' : 'Information Stream'}
            </h2>
            {filteredAndSortedNews.map((news, idx) => (
              <NewsCard 
                key={news.title + idx} 
                {...news}
                summary={articleSummaries[news.title] || (news as any).summary}
                tags={articleTags[news.title] || (news as any).tags}
                sentiment={articleSentiments[news.title] || (news as any).sentiment}
                videoUrl={articleVideos[news.title] || (news as any).videoUrl}
                isSaved={savedArticles.some(a => a.title === news.title)}
                isPosted={postedArticles.some(a => a.title === news.title)}
                isGeneratingVideo={generatingVideoId === news.title}
                isSummarizing={summarizingArticleIds.has(news.title)}
                onToggleSave={() => toggleSaveArticle(news)}
                onPost={() => togglePostArticle(news)}
                onDisseminate={(p) => handleDisseminate(news.title, p)}
                onGenerateVideo={() => handleGenerateVideo(news)}
                onSummarize={() => handleSummarize(news)}
                onPlayVideo={(url) => setActiveVideo({ url, title: news.title })}
              />
            ))}
            {filteredAndSortedNews.length === 0 && (
              <div className="text-center py-12 bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed">
                <p className="text-xs text-slate-600 italic">No content found in this channel.</p>
              </div>
            )}
          </div>
        </div>
      </main>
      <footer className="px-6 py-4 border-t border-slate-800/50 bg-slate-950 text-center text-[10px] text-slate-600 uppercase tracking-widest font-bold">
        Nova AI Networks Omnichannel Broadcast Agent © 2025
      </footer>
    </div>
  );
};

export default App;
