
import React from 'react';

interface NewsCardProps {
  title: string;
  category: string;
  image: string;
}

const NewsCard: React.FC<NewsCardProps> = ({ title, category, image }) => {
  return (
    <div className="group relative rounded-2xl overflow-hidden bg-slate-800 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-500/20">
      <div className="aspect-video w-full overflow-hidden">
        <img src={image} alt={title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
      </div>
      <div className="p-4">
        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">{category}</span>
        <h3 className="mt-1 text-sm font-semibold text-slate-100 line-clamp-2">{title}</h3>
      </div>
    </div>
  );
};

export default NewsCard;
