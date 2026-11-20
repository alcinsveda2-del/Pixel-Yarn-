import React, { useEffect, useRef } from 'react';
import { PatternProject } from '../types/pattern';

interface PatternThumbnailProps {
  project: PatternProject;
  className?: string;
  highlightRow?: number; // 1-indexed optional crochet row to highlight
}

export const PatternThumbnail: React.FC<PatternThumbnailProps> = ({
  project,
  className = '',
  highlightRow,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = Math.max(1, project.width);
    const h = Math.max(1, project.height);
    const scale = Math.max(2, Math.min(12, Math.floor(280 / Math.max(w, h))));
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    for (let y = 0; y < h; y++) {
      const rowNum = h - y;
      const isHighlighted = highlightRow !== undefined && rowNum === highlightRow;
      for (let x = 0; x < w; x++) {
        const idx = project.grid[y * w + x] ?? 0;
        const color = project.palette[idx] ?? project.palette[0];
        ctx.fillStyle = color ? color.hex : '#FAF5E8';
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
      if (highlightRow !== undefined && !isHighlighted) {
        ctx.fillStyle = 'rgba(20, 20, 24, 0.42)';
        ctx.fillRect(0, y * scale, w * scale, scale);
      }
      if (isHighlighted) {
        ctx.strokeStyle = '#F5C451';
        ctx.lineWidth = Math.max(2, scale * 0.35);
        ctx.strokeRect(1, y * scale + 1, w * scale - 2, scale - 2);
      }
    }
  }, [project, highlightRow]);

  return (
    <canvas
      ref={canvasRef}
      className={`block h-full w-full object-contain ${className}`}
      style={{ imageRendering: 'pixelated' }}
      aria-label={`${project.name} pattern preview`}
    />
  );
};
