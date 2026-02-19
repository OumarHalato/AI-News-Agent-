
import React, { useRef, useEffect } from 'react';
import { AudioVisualizerProps } from '../types';

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isActive, analyzer }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !analyzer) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let animationId: number;

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyzer.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;
        
        // Color gradient based on activity
        const hue = (i / bufferLength) * 360;
        ctx.fillStyle = isActive 
          ? `hsla(${hue}, 70%, 50%, 0.8)` 
          : `rgba(100, 116, 139, 0.3)`;

        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };

    draw();

    return () => cancelAnimationFrame(animationId);
  }, [analyzer, isActive]);

  return (
    <div className="w-full h-24 bg-slate-900/50 rounded-xl overflow-hidden flex items-end border border-slate-800 shadow-inner">
      <canvas 
        ref={canvasRef} 
        width={600} 
        height={100} 
        className="w-full h-full object-cover"
      />
    </div>
  );
};

export default AudioVisualizer;
