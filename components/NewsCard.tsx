
import React from 'react';

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
  summary?: string;
  isSummarizing?: boolean;
  onSummarize?: () => void;
}

const NewsCard: React.FC<NewsCardProps> = ({ 
  title, 
  category, 
  source,
  image, 
  summary,
  isSummarizing,
  onSummarize
}) => {
  return (
    <div className="group relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-blue-500/50 transition-all duration-300 shadow-xl">
      <div className="aspect-video w-full overflow-hidden relative">
        <img src={image} alt={title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent opacity-60" />
        <div className="absolute top-3 left-3 px-2 py-1 bg-blue-600/80 backdrop-blur-md rounded-md text-[8px] font-black uppercase tracking-widest">
          {category}
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-start gap-2">
          <h3 className="text-xs font-bold text-slate-100 line-clamp-2 leading-tight uppercase tracking-tight">{title}</h3>
        </div>
        
        {summary ? (
          <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800 animate-fade-in">
            <p className="text-[10px] text-blue-100/80 leading-relaxed font-medium italic">
              {summary}
            </p>
          </div>
        ) : (
          <button 
            onClick={onSummarize}
            disabled={isSummarizing}
            className="w-full py-2 bg-slate-800 hover:bg-blue-600/20 border border-slate-700 hover:border-blue-500/50 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
          >
            {isSummarizing ? 'Synthesizing...' : 'Summarize Intelligence'}
          </button>
        )}
        
        <div className="flex items-center justify-between pt-1 border-t border-slate-800">
          <span className="text-[9px] font-mono text-slate-500 uppercase">{source}</span>
          <div className="flex gap-2">
            <div className="w-1 h-1 rounded-full bg-blue-500/40" />
            <div className="w-1 h-1 rounded-full bg-blue-500/40" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewsCard;
