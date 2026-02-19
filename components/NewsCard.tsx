
import React, { useState, useRef, useEffect } from 'react';

export interface DisseminationStatus {
  facebook?: boolean;
  telegram?: boolean;
  youtube?: boolean;
}

interface NewsCardProps {
  title?: string;
  category?: string;
  source?: string;
  image?: string;
  url?: string;
  date?: string;
  summary?: string;
  tags?: string[];
  sentiment?: string;
  videoUrl?: string | null;
  metrics?: { views?: string; shares?: string };
  platform?: 'facebook' | 'telegram' | 'youtube' | 'web';
  dissemination?: DisseminationStatus;
  isLoading?: boolean;
  isSaved?: boolean;
  isPosted?: boolean;
  isRecommended?: boolean;
  isGeneratingVideo?: boolean;
  isSummarizing?: boolean;
  onToggleSave?: () => void;
  onPost?: () => void;
  onDisseminate?: (platform: keyof DisseminationStatus) => void;
  onGenerateVideo?: () => void;
  onSummarize?: () => void;
  onPlayVideo?: (url: string) => void;
}

const NewsCard: React.FC<NewsCardProps> = ({ 
  title, 
  category, 
  source,
  image, 
  url = "https://nova.ai/news",
  date,
  summary,
  tags,
  sentiment,
  videoUrl,
  metrics,
  platform = 'web',
  // Fix: Explicitly cast default empty object to DisseminationStatus to resolve property access errors in JSX
  dissemination = {} as DisseminationStatus,
  isLoading, 
  isSaved, 
  isPosted, 
  isRecommended,
  isGeneratingVideo,
  isSummarizing,
  onToggleSave,
  onPost,
  onDisseminate,
  onGenerateVideo,
  onSummarize,
  onPlayVideo
}) => {
  const [copied, setCopied] = useState(false);
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [showPostedToast, setShowPostedToast] = useState(false);
  const [showDisseminateMenu, setShowDisseminateMenu] = useState(false);
  
  // Video Player States
  const [isPlayingInline, setIsPlayingInline] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!videoUrl) {
      setIsPlayingInline(false);
    }
  }, [videoUrl]);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDisseminateMenu(!showDisseminateMenu);
  };

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isSaved) {
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 2000);
    }
    onToggleSave?.();
  };

  const handlePostClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isPosted) {
      setShowPostedToast(true);
      setTimeout(() => setShowPostedToast(false), 2000);
    }
    onPost?.();
  };

  const handleVideoAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoUrl) {
      setIsPlayingInline(true);
      onPlayVideo?.(videoUrl);
    } else {
      onGenerateVideo?.();
    }
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      const dur = videoRef.current.duration;
      setCurrentTime(cur);
      setProgress((cur / dur) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const newTime = (parseFloat(e.target.value) / 100) * videoRef.current.duration;
      videoRef.current.currentTime = newTime;
      setProgress(parseFloat(e.target.value));
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getSentimentStyles = (s?: string) => {
    const sentiment = s?.toLowerCase();
    if (sentiment === 'positive') return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (sentiment === 'negative') return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    return 'bg-slate-700/50 text-slate-400 border-slate-700';
  };

  const getPlatformIcon = () => {
    switch (platform) {
      case 'facebook': return (
        <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
      );
      case 'telegram': return (
        <svg className="w-4 h-4 text-sky-400" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0C5.346 0 0 5.346 0 11.944c0 6.598 5.346 11.944 11.944 11.944 6.598 0 11.944-5.346 11.944-11.944C23.888 5.346 18.542 0 11.944 0zm5.206 8.19c-.176 1.832-.93 6.31-1.318 8.37-.164.877-.488 1.17-.8 1.2-.685.064-1.206-.452-1.87-.887-1.037-.682-1.623-1.106-2.628-1.77-1.164-.766-.41-1.185.253-1.875.174-.18 3.193-2.923 3.253-3.18.007-.03.014-.145-.054-.205-.068-.06-.17-.04-.243-.023-.104.023-1.76 1.116-4.97 3.284-.47.323-.895.483-1.275.474-.42-.01-1.22-.236-1.817-.43-.733-.24-1.317-.367-1.267-.775.026-.212.316-.43.87-.65 3.403-1.483 5.672-2.46 6.805-2.93 3.237-1.34 3.91-1.57 4.348-1.57.097 0 .314.024.453.137.118.096.15.225.158.318.008.093.01 1.05.01 1.05z"/></svg>
      );
      case 'youtube': return (
        <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
      );
      default: return null;
    }
  };

  if (isLoading) {
    return (
      <div className="group relative rounded-2xl overflow-hidden bg-slate-800/50 border border-slate-700/30" role="status" aria-busy="true">
        <div className="aspect-video w-full bg-slate-700/50 animate-pulse" />
        <div className="p-4 space-y-3">
          <div className="h-3 w-1/4 bg-slate-700/50 rounded animate-pulse" />
          <div className="space-y-2">
            <div className="h-4 w-full bg-slate-700/50 rounded animate-pulse" />
            <div className="h-4 w-5/6 bg-slate-700/50 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`group relative rounded-2xl overflow-hidden bg-slate-800 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-500/20 border ${isRecommended ? 'border-blue-500/50 shadow-lg shadow-blue-900/10' : 'border-slate-700/50'} ${isPosted ? 'border-indigo-500/30' : ''}`} role="article">
      <div className="aspect-video w-full overflow-hidden relative cursor-pointer bg-black" onClick={handleVideoAction}>
        {!isPlayingInline ? (
          <>
            <img src={image} alt={title} className={`w-full h-full object-cover transition-transform group-hover:scale-105 ${isGeneratingVideo ? 'blur-sm grayscale' : ''}`} />
            {isGeneratingVideo && (
              <div className="absolute inset-0 bg-blue-600/20 flex items-center justify-center backdrop-blur-[2px]">
                <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            )}
            {videoUrl && !isGeneratingVideo && (
              <div className="absolute inset-0 bg-slate-900/20 group-hover:bg-slate-900/40 transition-colors flex items-center justify-center">
                 <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center shadow-xl shadow-blue-900/40 group-hover:scale-110 transition-transform">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                 </div>
              </div>
            )}
            {platform !== 'web' && (
              <div className="absolute top-3 left-3 flex gap-2">
                <div className="p-1.5 bg-slate-900/80 backdrop-blur-md rounded-lg border border-white/10 shadow-lg">
                  {getPlatformIcon()}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="relative w-full h-full group/player">
            <video ref={videoRef} src={videoUrl || ""} autoPlay onTimeUpdate={handleTimeUpdate} onLoadedMetadata={handleLoadedMetadata} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} className="w-full h-full object-contain" />
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-slate-950/90 to-transparent opacity-0 group-hover/player:opacity-100 transition-opacity flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <button onClick={togglePlay} className="text-white hover:text-blue-400">{isPlaying ? 'Pause' : 'Play'}</button>
                <input type="range" min="0" max="100" value={progress} onChange={handleScrub} className="flex-1 accent-blue-500" />
                <button onClick={(e) => { e.stopPropagation(); setIsPlayingInline(false); }} className="text-[9px] text-white">Close</button>
              </div>
            </div>
          </div>
        )}

        <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
          <button onClick={handleSaveClick} className={`p-2 rounded-full backdrop-blur-md ${isSaved ? 'bg-blue-600' : 'bg-slate-900/60 hover:bg-slate-900'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill={isSaved ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
          </button>
          <button onClick={handlePostClick} className={`p-2 rounded-full backdrop-blur-md ${isPosted ? 'bg-indigo-600' : 'bg-slate-900/60 hover:bg-slate-900'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill={isPosted ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor"><path d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
          </button>
          <div className="relative">
            <button onClick={handleShare} className="p-2 rounded-full backdrop-blur-md bg-slate-900/60 hover:bg-slate-900">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
            </button>
            {showDisseminateMenu && (
              <div className="absolute top-0 right-12 bg-slate-900 border border-slate-800 rounded-xl p-2 flex flex-col gap-2 shadow-2xl z-50 animate-fade-in">
                <button onClick={(e) => { e.stopPropagation(); onDisseminate?.('facebook'); }} className={`p-2 rounded-lg hover:bg-blue-600/20 flex items-center gap-2 text-[10px] ${dissemination.facebook ? 'text-blue-400 font-bold' : 'text-slate-400'}`}>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  {dissemination.facebook ? 'Broadcasted' : 'To Facebook'}
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDisseminate?.('telegram'); }} className={`p-2 rounded-lg hover:bg-sky-600/20 flex items-center gap-2 text-[10px] ${dissemination.telegram ? 'text-sky-400 font-bold' : 'text-slate-400'}`}>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0C5.346 0 0 5.346 0 11.944c0 6.598 5.346 11.944 11.944 11.944 6.598 0 11.944-5.346 11.944-11.944C23.888 5.346 18.542 0 11.944 0zm5.206 8.19c-.176 1.832-.93 6.31-1.318 8.37-.164.877-.488 1.17-.8 1.2-.685.064-1.206-.452-1.87-.887-1.037-.682-1.623-1.106-2.628-1.77-1.164-.766-.41-1.185.253-1.875.174-.18 3.193-2.923 3.253-3.18.007-.03.014-.145-.054-.205-.068-.06-.17-.04-.243-.023-.104.023-1.76 1.116-4.97 3.284-.47.323-.895.483-1.275.474-.42-.01-1.22-.236-1.817-.43-.733-.24-1.317-.367-1.267-.775.026-.212.316-.43.87-.65 3.403-1.483 5.672-2.46 6.805-2.93 3.237-1.34 3.91-1.57 4.348-1.57.097 0 .314.024.453.137.118.096.15.225.158.318.008.093.01 1.05.01 1.05z"/></svg>
                  {dissemination.telegram ? 'Broadcasted' : 'To Telegram'}
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDisseminate?.('youtube'); }} className={`p-2 rounded-lg hover:bg-red-600/20 flex items-center gap-2 text-[10px] ${dissemination.youtube ? 'text-red-400 font-bold' : 'text-slate-400'}`}>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                  {dissemination.youtube ? 'Broadcasted' : 'To YouTube'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="p-4 flex flex-col h-full gap-2">
        <div className="flex justify-between items-center">
          <div className="flex flex-col gap-1 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">{category}</span>
              {source && <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">• {source}</span>}
              {sentiment && <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest ${getSentimentStyles(sentiment)}`}>{sentiment}</span>}
            </div>
            {metrics && (
              <div className="flex gap-3 text-[9px] font-mono text-slate-500">
                {metrics.views && <span className="flex items-center gap-1">👁️ {metrics.views}</span>}
                {metrics.shares && <span className="flex items-center gap-1">🔄 {metrics.shares}</span>}
              </div>
            )}
          </div>
          <span className="text-[10px] text-slate-500 font-mono self-start ml-2">{formatDate(date)}</span>
        </div>
        <h3 className="text-sm font-semibold text-slate-100 line-clamp-2 leading-tight">{title}</h3>
        {summary && (
          <div className="mt-1 p-2 bg-slate-700/30 rounded-lg border border-slate-700/50 animate-fade-in">
            <p className="text-[11px] text-blue-300 italic leading-relaxed"><span className="font-bold text-blue-400 not-italic mr-1">Nova Summary:</span>{summary}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewsCard;
