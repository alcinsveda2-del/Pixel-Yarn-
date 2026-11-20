import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BoxSelect,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FileText,
  Grid,
  Hand,
  PaintBucket,
  Pencil,
  Pipette,
  Play,
  Redo2,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { PatternProject } from '../types/pattern';
import { computeColorUsage, resizeProjectGrid } from '../utils/crochetMath';
import { exportPatternAsPdf, exportPatternAsPng } from '../utils/exporter';

type ToolMode = 'paint' | 'fill' | 'eyedropper' | 'eraser' | 'select' | 'pan';

interface DesignerViewProps {
  project: PatternProject | null;
  showGridLines: boolean;
  onToggleGridLines: () => void;
  onUpdateProject: (updated: PatternProject) => void;
  onOpenOverview: () => void;
  onStartWorking: () => void;
  onNavigatePalette: () => void;
  onNavigatePhotoStudio: () => void;
}

interface SelectionRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export const DesignerView: React.FC<DesignerViewProps> = ({
  project,
  showGridLines,
  onToggleGridLines,
  onUpdateProject,
  onOpenOverview,
  onStartWorking,
  onNavigatePalette,
  onNavigatePhotoStudio,
}) => {
  const [tool, setTool] = useState<ToolMode>('paint');
  const [activeColorIdx, setActiveColorIdx] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number; rowNum: number; colNum: number } | null>(
    null
  );
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const [undoStack, setUndoStack] = useState<number[][]>([]);
  const [redoStack, setRedoStack] = useState<number[][]>([]);
  const [showResizeModal, setShowResizeModal] = useState(false);
  const [resizeW, setResizeW] = useState(project?.width ?? 40);
  const [resizeH, setResizeH] = useState(project?.height ?? 40);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 720, height: 540 });

  // Refs for smooth pointer dragging without re-attaching listeners
  const draftGridRef = useRef<number[] | null>(null);
  const pointerStateRef = useRef<{
    active: boolean;
    mode: 'paint' | 'pan' | 'select' | null;
    startClientX: number;
    startClientY: number;
    startPanX: number;
    startPanY: number;
    selStartCell: { x: number; y: number } | null;
    didMutate: boolean;
  }>({
    active: false,
    mode: null,
    startClientX: 0,
    startClientY: 0,
    startPanX: 0,
    startPanY: 0,
    selStartCell: null,
    didMutate: false,
  });

  // Reset undo/redo and fit canvas when switching project
  useEffect(() => {
    setUndoStack([]);
    setRedoStack([]);
    setSelection(null);
    setPan({ x: 0, y: 0 });
    setZoom(1);
    if (project) {
      setResizeW(project.width);
      setResizeH(project.height);
      if (activeColorIdx >= project.palette.length) {
        setActiveColorIdx(project.palette.length > 1 ? 1 : 0);
      }
    }
  }, [project?.id]);

  // Observe container dimensions
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 50 && rect.height > 50) {
        setCanvasSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const usage = useMemo(() => (project ? computeColorUsage(project) : []), [project]);

  const marginLeft = 38;
  const marginBottom = 28;
  const marginTop = 14;
  const marginRight = 14;

  const getCellMetrics = useCallback(() => {
    if (!project) return { cellSize: 16, originX: marginLeft, originY: marginTop };
    const availW = Math.max(100, canvasSize.width - marginLeft - marginRight);
    const availH = Math.max(100, canvasSize.height - marginTop - marginBottom);
    const baseCell = Math.max(4, Math.min(availW / project.width, availH / project.height));
    const cellSize = baseCell * zoom;
    const gridW = project.width * cellSize;
    const gridH = project.height * cellSize;
    const originX = marginLeft + Math.floor((availW - gridW) / 2) + pan.x;
    const originY = marginTop + Math.floor((availH - gridH) / 2) + pan.y;
    return { cellSize, originX, originY };
  }, [project, canvasSize, zoom, pan]);

  const drawCanvas = useCallback(
    (gridOverride?: number[]) => {
      const canvas = canvasRef.current;
      if (!canvas || !project) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvasSize.width * dpr;
      canvas.height = canvasSize.height * dpr;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#F3EFE7';
      ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

      const { cellSize, originX, originY } = getCellMetrics();
      const gridData = gridOverride ?? project.grid;
      const gridW = project.width * cellSize;
      const gridH = project.height * cellSize;

      // Grid backdrop
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(originX, originY, gridW, gridH);

      // Cells
      for (let y = 0; y < project.height; y++) {
        const py = originY + y * cellSize;
        if (py + cellSize < 0 || py > canvasSize.height) continue;
        for (let x = 0; x < project.width; x++) {
          const px = originX + x * cellSize;
          if (px + cellSize < 0 || px > canvasSize.width) continue;
          const colorIdx = gridData[y * project.width + x] ?? 0;
          const col = project.palette[colorIdx] ?? project.palette[0];
          ctx.fillStyle = col ? col.hex : '#FAF5E8';
          ctx.fillRect(px, py, Math.ceil(cellSize), Math.ceil(cellSize));
        }
      }

      // Gridlines
      if (showGridLines && cellSize >= 4) {
        ctx.strokeStyle = 'rgba(30, 29, 32, 0.16)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= project.width; x++) {
          const px = Math.round(originX + x * cellSize) + 0.5;
          ctx.beginPath();
          ctx.moveTo(px, originY);
          ctx.lineTo(px, originY + gridH);
          ctx.stroke();
        }
        for (let y = 0; y <= project.height; y++) {
          const py = Math.round(originY + y * cellSize) + 0.5;
          ctx.beginPath();
          ctx.moveTo(originX, py);
          ctx.lineTo(originX + gridW, py);
          ctx.stroke();
        }

        // Bold 10-stitch guide lines
        ctx.strokeStyle = 'rgba(124, 106, 154, 0.55)';
        ctx.lineWidth = 1.25;
        for (let x = 0; x <= project.width; x += 10) {
          const px = Math.round(originX + x * cellSize) + 0.5;
          ctx.beginPath();
          ctx.moveTo(px, originY);
          ctx.lineTo(px, originY + gridH);
          ctx.stroke();
        }
        for (let row = 0; row <= project.height; row += 10) {
          const py = Math.round(originY + (project.height - row) * cellSize) + 0.5;
          ctx.beginPath();
          ctx.moveTo(originX, py);
          ctx.lineTo(originX + gridW, py);
          ctx.stroke();
        }
      }

      // Selection rectangle
      if (selection) {
        const minX = Math.min(selection.x0, selection.x1);
        const maxX = Math.max(selection.x0, selection.x1);
        const minY = Math.min(selection.y0, selection.y1);
        const maxY = Math.max(selection.y0, selection.y1);
        const sx = originX + minX * cellSize;
        const sy = originY + minY * cellSize;
        const sw = (maxX - minX + 1) * cellSize;
        const sh = (maxY - minY + 1) * cellSize;
        ctx.fillStyle = 'rgba(245, 196, 81, 0.25)';
        ctx.fillRect(sx, sy, sw, sh);
        ctx.strokeStyle = '#D49A2A';
        ctx.lineWidth = 2;
        ctx.strokeRect(sx, sy, sw, sh);
      }

      // Hover highlight
      if (hoverCell) {
        ctx.strokeStyle = '#1F2024';
        ctx.lineWidth = 2;
        ctx.strokeRect(
          originX + hoverCell.x * cellSize,
          originY + hoverCell.y * cellSize,
          cellSize,
          cellSize
        );
      }

      // Axis gutters (Row numbers on left, Column numbers on bottom)
      ctx.fillStyle = '#FAF7F2';
      ctx.fillRect(0, 0, marginLeft, canvasSize.height);
      ctx.fillRect(0, canvasSize.height - marginBottom, canvasSize.width, marginBottom);

      ctx.strokeStyle = '#E6E0D4';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(marginLeft + 0.5, 0);
      ctx.lineTo(marginLeft + 0.5, canvasSize.height - marginBottom);
      ctx.lineTo(canvasSize.width, canvasSize.height - marginBottom + 0.5);
      ctx.stroke();

      // Row labels (1 at bottom .. height at top)
      ctx.fillStyle = '#524D59';
      ctx.font = '600 10px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const rowStep = cellSize < 12 ? 5 : 1;
      for (let rowNum = 1; rowNum <= project.height; rowNum++) {
        if (rowNum === 1 || rowNum === project.height || rowNum % rowStep === 0) {
          const y = project.height - rowNum;
          const cy = originY + y * cellSize + cellSize / 2;
          if (cy >= marginTop && cy <= canvasSize.height - marginBottom) {
            ctx.fillText(String(rowNum), marginLeft - 6, cy);
          }
        }
      }

      // Column labels (1..width)
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const colStep = cellSize < 14 ? 5 : 1;
      for (let colNum = 1; colNum <= project.width; colNum++) {
        if (colNum === 1 || colNum === project.width || colNum % colStep === 0) {
          const x = colNum - 1;
          const cx = originX + x * cellSize + cellSize / 2;
          if (cx >= marginLeft && cx <= canvasSize.width - marginRight) {
            ctx.fillText(String(colNum), cx, canvasSize.height - marginBottom + 7);
          }
        }
      }
    },
    [project, canvasSize, getCellMetrics, showGridLines, selection, hoverCell]
  );

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const commitGridChange = useCallback(
    (nextGrid: number[]) => {
      if (!project) return;
      setUndoStack((prev) => [...prev.slice(-49), [...project.grid]]);
      setRedoStack([]);
      onUpdateProject({
        ...project,
        grid: nextGrid,
        updatedAt: Date.now(),
      });
    },
    [project, onUpdateProject]
  );

  const handleUndo = useCallback(() => {
    if (!project || undoStack.length === 0) return;
    const prevGrid = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    setRedoStack((r) => [...r, [...project.grid]]);
    onUpdateProject({ ...project, grid: prevGrid, updatedAt: Date.now() });
  }, [project, undoStack, onUpdateProject]);

  const handleRedo = useCallback(() => {
    if (!project || redoStack.length === 0) return;
    const nextGrid = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((s) => [...s, [...project.grid]]);
    onUpdateProject({ ...project, grid: nextGrid, updatedAt: Date.now() });
  }, [project, redoStack, onUpdateProject]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo]);

  const clientToCell = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas || !project) return null;
    const rect = canvas.getBoundingClientRect();
    const lx = clientX - rect.left;
    const ly = clientY - rect.top;
    if (lx < marginLeft || ly > canvasSize.height - marginBottom) return null;
    const { cellSize, originX, originY } = getCellMetrics();
    const x = Math.floor((lx - originX) / cellSize);
    const y = Math.floor((ly - originY) / cellSize);
    if (x < 0 || x >= project.width || y < 0 || y >= project.height) return null;
    return { x, y };
  };

  const floodFill = (grid: number[], startX: number, startY: number, newColorIdx: number): number[] => {
    if (!project) return grid;
    const target = grid[startY * project.width + startX];
    if (target === newColorIdx) return grid;
    const next = [...grid];
    const queue: number[] = [startY * project.width + startX];
    const visited = new Uint8Array(next.length);
    visited[startY * project.width + startX] = 1;

    while (queue.length > 0) {
      const idx = queue.pop()!;
      next[idx] = newColorIdx;
      const x = idx % project.width;
      const y = (idx - x) / project.width;
      const neighbors = [
        x > 0 ? idx - 1 : -1,
        x < project.width - 1 ? idx + 1 : -1,
        y > 0 ? idx - project.width : -1,
        y < project.height - 1 ? idx + project.width : -1,
      ];
      for (const n of neighbors) {
        if (n >= 0 && !visited[n] && next[n] === target) {
          visited[n] = 1;
          queue.push(n);
        }
      }
    }
    return next;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!project) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const cell = clientToCell(e.clientX, e.clientY);

    if (tool === 'pan' || e.button === 1 || (e.button === 0 && e.shiftKey && tool !== 'select')) {
      pointerStateRef.current = {
        active: true,
        mode: 'pan',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
        selStartCell: null,
        didMutate: false,
      };
      return;
    }

    if (!cell) return;

    if (tool === 'eyedropper') {
      const picked = project.grid[cell.y * project.width + cell.x] ?? 0;
      setActiveColorIdx(picked);
      setTool('paint');
      return;
    }

    if (tool === 'fill') {
      const filled = floodFill(project.grid, cell.x, cell.y, activeColorIdx);
      if (filled !== project.grid) commitGridChange(filled);
      return;
    }

    if (tool === 'select') {
      setSelection({ x0: cell.x, y0: cell.y, x1: cell.x, y1: cell.y });
      pointerStateRef.current = {
        active: true,
        mode: 'select',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
        selStartCell: cell,
        didMutate: false,
      };
      return;
    }

    // Paint or Eraser (Eraser paints index 0 base color)
    const targetColorIdx = tool === 'eraser' ? 0 : activeColorIdx;
    const draft = [...project.grid];
    const cellIdx = cell.y * project.width + cell.x;
    let mutated = false;
    if (draft[cellIdx] !== targetColorIdx) {
      draft[cellIdx] = targetColorIdx;
      mutated = true;
    }
    draftGridRef.current = draft;
    pointerStateRef.current = {
      active: true,
      mode: 'paint',
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y,
      selStartCell: null,
      didMutate: mutated,
    };
    drawCanvas(draft);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!project) return;
    const cell = clientToCell(e.clientX, e.clientY);
    setHoverCell(
      cell
        ? {
            x: cell.x,
            y: cell.y,
            colNum: cell.x + 1,
            rowNum: project.height - cell.y,
          }
        : null
    );

    const ps = pointerStateRef.current;
    if (!ps.active) return;

    if (ps.mode === 'pan') {
      setPan({
        x: ps.startPanX + (e.clientX - ps.startClientX),
        y: ps.startPanY + (e.clientY - ps.startClientY),
      });
      return;
    }

    if (ps.mode === 'select' && cell && ps.selStartCell) {
      setSelection({
        x0: ps.selStartCell.x,
        y0: ps.selStartCell.y,
        x1: cell.x,
        y1: cell.y,
      });
      return;
    }

    if (ps.mode === 'paint' && cell && draftGridRef.current) {
      const targetColorIdx = tool === 'eraser' ? 0 : activeColorIdx;
      const idx = cell.y * project.width + cell.x;
      if (draftGridRef.current[idx] !== targetColorIdx) {
        draftGridRef.current[idx] = targetColorIdx;
        ps.didMutate = true;
        drawCanvas(draftGridRef.current);
      }
    }
  };

  const handlePointerUp = () => {
    const ps = pointerStateRef.current;
    if (ps.active && ps.mode === 'paint' && ps.didMutate && draftGridRef.current) {
      commitGridChange(draftGridRef.current);
    }
    draftGridRef.current = null;
    pointerStateRef.current.active = false;
    pointerStateRef.current.mode = null;
  };

  const applySelectionAction = (fillWithIdx: number) => {
    if (!project || !selection) return;
    const minX = Math.min(selection.x0, selection.x1);
    const maxX = Math.max(selection.x0, selection.x1);
    const minY = Math.min(selection.y0, selection.y1);
    const maxY = Math.max(selection.y0, selection.y1);
    const next = [...project.grid];
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        next[y * project.width + x] = fillWithIdx;
      }
    }
    commitGridChange(next);
  };

  const handleResizeApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    const w = Math.max(4, Math.min(200, resizeW));
    const h = Math.max(4, Math.min(200, resizeH));
    const resizedGrid = resizeProjectGrid(project.grid, project.width, project.height, w, h, 0);
    setUndoStack((prev) => [...prev.slice(-49), [...project.grid]]);
    onUpdateProject({
      ...project,
      width: w,
      height: h,
      grid: resizedGrid,
      progress: {
        ...project.progress,
        currentRow: Math.min(project.progress.currentRow, h),
        completedRows: project.progress.completedRows.filter((r) => r <= h),
      },
      updatedAt: Date.now(),
    });
    setShowResizeModal(false);
  };

  if (!project) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-[#E6E0D4] bg-white p-10 text-center">
        <Grid className="mx-auto h-10 w-10 text-[#7C6A9A]" />
        <h2 className="mt-3 font-display text-xl font-bold text-[#1E1D20]">No Active Pattern</h2>
        <p className="mt-1.5 text-xs text-[#615B69]">
          Select an existing project or convert a photograph in Photo Studio to edit stitches here.
        </p>
        <button
          type="button"
          onClick={onNavigatePhotoStudio}
          className="mt-5 rounded-xl bg-[#7C6A9A] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#6A5888] min-h-[44px]"
        >
          Go to Photo Studio
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-4 pb-8">
      {/* Top Designer Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E6E0D4] bg-white px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="truncate font-display text-lg font-bold text-[#1E1D20]">{project.name}</h1>
            <span className="font-mono text-xs tabular-nums text-[#615B69]">
              {project.width} × {project.height}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-[#615B69] font-mono tabular-nums">
            {hoverCell
              ? `Row ${hoverCell.rowNum} · Col ${hoverCell.colNum} · ${
                  project.palette[project.grid[hoverCell.y * project.width + hoverCell.x] ?? 0]?.name ?? ''
                }`
              : 'Tap or drag cells to paint · Scroll or pinch buttons to zoom'}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowResizeModal(true)}
            className="rounded-xl border border-[#E6E0D4] bg-[#FAF7F2] px-3 py-2 text-xs font-semibold text-[#3C3844] hover:bg-[#EFE9DD] min-h-[40px]"
          >
            Resize Grid
          </button>
          <button
            type="button"
            onClick={() => exportPatternAsPng(project, false)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6E0D4] bg-white px-3 py-2 text-xs font-semibold text-[#3C3844] hover:bg-[#F3EFE7] min-h-[40px]"
          >
            <Download className="h-3.5 w-3.5" />
            <span>PNG</span>
          </button>
          <button
            type="button"
            onClick={() => exportPatternAsPdf(project)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6E0D4] bg-white px-3 py-2 text-xs font-semibold text-[#3C3844] hover:bg-[#F3EFE7] min-h-[40px]"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>PDF</span>
          </button>
          <button
            type="button"
            onClick={onOpenOverview}
            className="rounded-xl border border-[#D8D0E4] bg-[#EDE8F5] px-3.5 py-2 text-xs font-semibold text-[#4B3D63] hover:bg-[#E1D8EE] min-h-[40px]"
          >
            Overview
          </button>
          <button
            type="button"
            onClick={onStartWorking}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1F2024] px-4 py-2 text-xs font-semibold text-[#F5C451] hover:bg-[#2E3036] min-h-[40px]"
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>Start Working</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left/Center: Tool strip + Canvas */}
        <div className="space-y-3 lg:col-span-9">
          {/* Tools & Zoom Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#E6E0D4] bg-white p-2.5">
            <div className="flex flex-wrap items-center gap-1">
              {(
                [
                  ['paint', 'Paint', Pencil],
                  ['fill', 'Fill', PaintBucket],
                  ['eyedropper', 'Pick', Pipette],
                  ['eraser', 'Erase', Eraser],
                  ['select', 'Select', BoxSelect],
                  ['pan', 'Pan', Hand],
                ] as Array<[ToolMode, string, React.ComponentType<{ className?: string }>]>
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTool(id)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors min-h-[40px] ${
                    tool === id
                      ? 'bg-[#7C6A9A] text-white'
                      : 'bg-[#FAF7F2] text-[#3C3844] hover:bg-[#EFE9DD]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E6E0D4] bg-white text-[#3C3844] hover:bg-[#F3EFE7] disabled:opacity-40"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E6E0D4] bg-white text-[#3C3844] hover:bg-[#F3EFE7] disabled:opacity-40"
                title="Redo (Ctrl+Y)"
              >
                <Redo2 className="h-4 w-4" />
              </button>

              <div className="mx-1 h-5 w-px bg-[#E6E0D4]" />

              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.25).toFixed(2))))}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E6E0D4] bg-white text-[#3C3844] hover:bg-[#F3EFE7]"
                title="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setPan({ x: 0, y: 0 });
                }}
                className="rounded-xl border border-[#E6E0D4] bg-[#FAF7F2] px-2.5 py-2 font-mono text-xs tabular-nums text-[#3C3844] min-h-[40px]"
                title="Reset zoom & pan"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(6, Number((z + 0.25).toFixed(2))))}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E6E0D4] bg-white text-[#3C3844] hover:bg-[#F3EFE7]"
                title="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={onToggleGridLines}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold min-h-[40px] ${
                  showGridLines
                    ? 'border-[#7C6A9A] bg-[#EDE8F5] text-[#4B3D63]'
                    : 'border-[#E6E0D4] bg-white text-[#524D59]'
                }`}
              >
                {showGridLines ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                <span>Grid</span>
              </button>
            </div>
          </div>

          {/* Selection Actions Banner */}
          {selection && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D49A2A]/40 bg-[#FEF7E6] px-4 py-2.5 text-xs">
              <span className="font-semibold text-[#5C410A] font-mono tabular-nums">
                Selected Area: {Math.abs(selection.x1 - selection.x0) + 1} ×{' '}
                {Math.abs(selection.y1 - selection.y0) + 1} stitches
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => applySelectionAction(activeColorIdx)}
                  className="rounded-lg bg-[#7C6A9A] px-3 py-1.5 font-semibold text-white min-h-[34px]"
                >
                  Fill Selection
                </button>
                <button
                  type="button"
                  onClick={() => applySelectionAction(0)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#D49A2A]/40 bg-white px-3 py-1.5 font-semibold text-[#3C3844] min-h-[34px]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Clear to Base</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelection(null)}
                  className="rounded-lg px-2.5 py-1.5 font-medium text-[#524D59] hover:bg-black/5"
                >
                  Deselect
                </button>
              </div>
            </div>
          )}

          {/* Interactive Canvas Container */}
          <div
            ref={containerRef}
            className="h-[58vh] min-h-[380px] w-full overflow-hidden rounded-2xl border border-[#E6E0D4] bg-[#F3EFE7]"
          >
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={(e) => {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.15 : -0.15;
                setZoom((z) => Math.max(0.4, Math.min(6, Number((z + delta).toFixed(2)))));
              }}
              className={`h-full w-full touch-none ${
                tool === 'pan' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
              }`}
            />
          </div>
        </div>

        {/* Right: Colour Legend & Quick Picker */}
        <div className="rounded-2xl border border-[#E6E0D4] bg-white p-4 lg:col-span-3 flex flex-col max-h-[72vh]">
          <div className="flex items-center justify-between border-b border-[#F3EFE7] pb-3">
            <div>
              <h2 className="text-xs font-semibold text-[#1E1D20]">
                Pattern Palette ({project.palette.length})
              </h2>
              <p className="text-[11px] text-[#615B69]">Tap a colour to paint cells</p>
            </div>
            <button
              type="button"
              onClick={onNavigatePalette}
              className="rounded-lg border border-[#E6E0D4] bg-[#FAF7F2] px-2.5 py-1.5 text-[11px] font-semibold text-[#4B3D63] hover:bg-[#EDE8F5]"
            >
              Manage
            </button>
          </div>

          <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto pr-1">
            {usage.map((u) => {
              const isSelected = activeColorIdx === u.colorIndex;
              return (
                <button
                  key={u.color.id + u.colorIndex}
                  type="button"
                  onClick={() => {
                    setActiveColorIdx(u.colorIndex);
                    if (tool === 'pan' || tool === 'eyedropper' || tool === 'eraser') {
                      setTool('paint');
                    }
                  }}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl border p-2.5 text-left transition-colors min-h-[46px] ${
                    isSelected
                      ? 'border-[#7C6A9A] bg-[#EDE8F5]'
                      : 'border-[#F3EFE7] bg-[#FAF7F2] hover:border-[#D8D0E4]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="h-6 w-6 shrink-0 rounded-md border border-black/15"
                      style={{ backgroundColor: u.color.hex }}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-[#1E1D20]">
                        {u.color.name}
                      </div>
                      <div className="font-mono text-[10px] text-[#615B69]">{u.color.hex}</div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right font-mono text-[11px] tabular-nums text-[#3C3844]">
                    <div>{u.stitchCount}</div>
                    <div className="text-[10px] text-[#7A7483]">{u.percentage.toFixed(0)}%</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Resize Grid Modal */}
      {showResizeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleResizeApply}
            className="w-full max-w-sm rounded-2xl border border-[#E6E0D4] bg-[#FAF7F2] p-6 shadow-xl space-y-4"
          >
            <h3 className="font-display text-lg font-bold text-[#1E1D20]">Resize Stitch Grid</h3>
            <p className="text-xs text-[#615B69]">
              Anchored from Bottom-Left (Row 1) so completed lower rows remain intact.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#3C3844]">Width (stitches)</label>
                <input
                  type="number"
                  min={4}
                  max={200}
                  value={resizeW}
                  onChange={(e) => setResizeW(Number(e.target.value) || 4)}
                  className="mt-1 w-full rounded-xl border border-[#DED7C8] bg-white px-3 py-2 font-mono text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#3C3844]">Height (rows)</label>
                <input
                  type="number"
                  min={4}
                  max={200}
                  value={resizeH}
                  onChange={(e) => setResizeH(Number(e.target.value) || 4)}
                  className="mt-1 w-full rounded-xl border border-[#DED7C8] bg-white px-3 py-2 font-mono text-sm tabular-nums"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResizeModal(false)}
                className="rounded-xl border border-[#E6E0D4] bg-white px-4 py-2 text-xs font-semibold text-[#524D59]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#7C6A9A] px-4 py-2 text-xs font-semibold text-white"
              >
                Apply Size
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
