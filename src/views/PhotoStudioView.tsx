import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Check,
  FlipHorizontal2,
  FlipVertical2,
  Image as ImageIcon,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Upload,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  AspectRatioPreset,
  DitheringMethod,
  Handedness,
  PatternProject,
  PixelationOptions,
  PixelPreset,
} from '../types/pattern';
import {
  getDefaultPixelationOptions,
  PIXEL_PRESETS,
  PixelationResult,
  processImagePixels,
} from '../utils/pixelator';
import { createBlankProject } from '../utils/projectFactory';

interface PhotoStudioViewProps {
  defaultHandedness: Handedness;
  onCreateFromPhoto: (project: PatternProject) => void;
}

const ASPECT_RATIOS: Array<{ id: AspectRatioPreset; label: string; ratio: number | null }> = [
  { id: '1:1', label: '1:1 Square', ratio: 1 },
  { id: '3:4', label: '3:4 Portrait', ratio: 3 / 4 },
  { id: '4:5', label: '4:5 Frame', ratio: 4 / 5 },
  { id: '9:16', label: '9:16 Tall', ratio: 9 / 16 },
  { id: 'custom', label: 'Custom', ratio: null },
];

export const PhotoStudioView: React.FC<PhotoStudioViewProps> = ({
  defaultHandedness,
  onCreateFromPhoto,
}) => {
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [imageName, setImageName] = useState('Photo Pattern');
  const [options, setOptions] = useState<PixelationOptions>(getDefaultPixelationOptions);

  // Transform / crop state
  const [orientation, setOrientation] = useState<'square' | 'portrait' | 'landscape'>('square');
  const [aspectPreset, setAspectPreset] = useState<AspectRatioPreset>('1:1');
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0); // normalized -0.5..0.5
  const [panY, setPanY] = useState(0);
  const [rotation, setRotation] = useState(0); // degrees -180..180
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [lockAspectToGrid, setLockAspectToGrid] = useState(true);

  // Camera capture modal state
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Preview & Comparison state
  const [compareMode, setCompareMode] = useState<'split' | 'pixel' | 'original'>('split');
  const [splitPos, setSplitPos] = useState(50);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<PixelationResult | null>(null);
  const [croppedDataUrl, setCroppedDataUrl] = useState<string | null>(null);

  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pixelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalCompareCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragStateRef = useRef<{ active: boolean; startX: number; startY: number; basePanX: number; basePanY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    basePanX: 0,
    basePanY: 0,
  });

  const workerRef = useRef<Worker | null>(null);
  const requestCounterRef = useRef(0);

  useEffect(() => {
    try {
      const w = new Worker(new URL('../workers/pixelator.worker.ts', import.meta.url), {
        type: 'module',
      });
      workerRef.current = w;
      w.onmessage = (event) => {
        const data = event.data as {
          requestId: number;
          width: number;
          height: number;
          grid: number[];
          palette: PixelationResult['palette'];
          previewBuffer: ArrayBuffer;
        };
        if (data.requestId !== requestCounterRef.current) return;
        setResult({
          width: data.width,
          height: data.height,
          grid: data.grid,
          palette: data.palette,
          previewRgba: new Uint8ClampedArray(data.previewBuffer),
        });
        setIsProcessing(false);
      };
      return () => {
        w.terminate();
        workerRef.current = null;
      };
    } catch {
      return undefined;
    }
  }, []);

  const loadImageFromSrc = (src: string, title: string) => {
    const img = new Image();
    img.onload = () => {
      setImageEl(img);
      setImageName(title);
      setZoom(1);
      setPanX(0);
      setPanY(0);
      setRotation(0);
      setFlipH(false);
      setFlipV(false);

      // Set sensible initial orientation matching the image
      if (img.width > img.height * 1.15) {
        setOrientation('landscape');
        setAspectPreset('4:5');
        setOptions((prev) => ({ ...prev, width: 60, height: 48 }));
      } else if (img.height > img.width * 1.15) {
        setOrientation('portrait');
        setAspectPreset('3:4');
        setOptions((prev) => ({ ...prev, width: 45, height: 60 }));
      } else {
        setOrientation('square');
        setAspectPreset('1:1');
        setOptions((prev) => ({ ...prev, width: 48, height: 48 }));
      }
    };
    img.src = src;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const cleanTitle = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        loadImageFromSrc(reader.result, cleanTitle || 'Uploaded Pattern');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const openCamera = async () => {
    setCameraError(null);
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setCameraError(
        'Camera permission was denied or unavailable. You can still upload a PNG/JPG photo or use your device camera picker.'
      );
    }
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  const snapPhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const c = document.createElement('canvas');
    c.width = video.videoWidth || 640;
    c.height = video.videoHeight || 480;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL('image/png');
    closeCamera();
    loadImageFromSrc(dataUrl, `Camera Pattern ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
  };

  const getCropRatio = useCallback((): number => {
    if (aspectPreset === 'custom') {
      return options.width / Math.max(1, options.height);
    }
    const base = ASPECT_RATIOS.find((a) => a.id === aspectPreset)?.ratio ?? 1;
    if (orientation === 'landscape' && base < 1) return 1 / base;
    if (orientation === 'portrait' && base > 1) return 1 / base;
    if (orientation === 'square') return 1;
    return base;
  }, [aspectPreset, orientation, options.width, options.height]);

  const applyAspectAndOrientation = (
    nextOrientation: 'square' | 'portrait' | 'landscape',
    nextAspect: AspectRatioPreset
  ) => {
    setOrientation(nextOrientation);
    setAspectPreset(nextAspect);
    if (nextAspect === 'custom') return;
    let ratio = ASPECT_RATIOS.find((a) => a.id === nextAspect)?.ratio ?? 1;
    if (nextOrientation === 'square') ratio = 1;
    else if (nextOrientation === 'landscape' && ratio < 1) ratio = 1 / ratio;
    else if (nextOrientation === 'portrait' && ratio > 1) ratio = 1 / ratio;

    setOptions((prev) => {
      const base = Math.max(prev.width, prev.height);
      if (ratio >= 1) {
        return { ...prev, width: base, height: Math.max(8, Math.round(base / ratio)) };
      }
      return { ...prev, width: Math.max(8, Math.round(base * ratio)), height: base };
    });
  };

  // Render cropped canvas + dispatch pixelation
  const runConversion = useCallback(() => {
    if (!imageEl) return;

    const ratio = getCropRatio();
    const workMax = 320;
    const workW = ratio >= 1 ? workMax : Math.max(64, Math.round(workMax * ratio));
    const workH = ratio >= 1 ? Math.max(64, Math.round(workMax / ratio)) : workMax;

    const offscreen = document.createElement('canvas');
    offscreen.width = workW;
    offscreen.height = workH;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = options.bgReplacementHex || '#FAF5E8';
    ctx.fillRect(0, 0, workW, workH);

    const coverScale = Math.max(workW / imageEl.width, workH / imageEl.height) * zoom;
    ctx.save();
    ctx.translate(workW / 2 + panX * workW, workH / 2 + panY * workH);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -coverScale : coverScale, flipV ? -coverScale : coverScale);
    ctx.drawImage(imageEl, -imageEl.width / 2, -imageEl.height / 2);
    ctx.restore();

    // Update interactive crop preview canvas
    const cropCanvas = cropCanvasRef.current;
    if (cropCanvas) {
      cropCanvas.width = workW;
      cropCanvas.height = workH;
      const cctx = cropCanvas.getContext('2d');
      if (cctx) {
        cctx.drawImage(offscreen, 0, 0);
      }
    }

    // Update original compare canvas
    const origCanvas = originalCompareCanvasRef.current;
    if (origCanvas) {
      origCanvas.width = workW;
      origCanvas.height = workH;
      origCanvas.getContext('2d')?.drawImage(offscreen, 0, 0);
    }

    setCroppedDataUrl(offscreen.toDataURL('image/jpeg', 0.8));

    const imgData = ctx.getImageData(0, 0, workW, workH);
    setIsProcessing(true);
    const reqId = ++requestCounterRef.current;

    if (workerRef.current) {
      const buf = imgData.data.buffer.slice(0);
      workerRef.current.postMessage(
        {
          requestId: reqId,
          rgbaBuffer: buf,
          srcWidth: workW,
          srcHeight: workH,
          options,
        },
        [buf]
      );
    } else {
      const syncRes = processImagePixels(imgData.data, workW, workH, options);
      setResult(syncRes);
      setIsProcessing(false);
    }
  }, [imageEl, getCropRatio, zoom, panX, panY, rotation, flipH, flipV, options]);

  useEffect(() => {
    if (!imageEl) return;
    const timer = window.setTimeout(() => {
      runConversion();
    }, 90);
    return () => window.clearTimeout(timer);
  }, [imageEl, runConversion]);

  // Paint pixel preview canvas whenever result updates
  useEffect(() => {
    const canvas = pixelCanvasRef.current;
    if (!canvas || !result) return;
    canvas.width = result.width;
    canvas.height = result.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imgData = new ImageData(new Uint8ClampedArray(result.previewRgba), result.width, result.height);
    ctx.putImageData(imgData, 0, 0);
  }, [result]);

  const handlePresetClick = (presetId: Exclude<PixelPreset, 'custom'>) => {
    const p = PIXEL_PRESETS[presetId];
    setOptions((prev) => ({ ...prev, preset: presetId, ...p.patch }));
  };

  const handleDimensionChange = (dim: 'width' | 'height', value: number) => {
    const clamped = Math.max(4, Math.min(200, value || 4));
    const ratio = getCropRatio();
    setOptions((prev) => {
      if (lockAspectToGrid && aspectPreset !== 'custom') {
        if (dim === 'width') {
          return { ...prev, width: clamped, height: Math.max(4, Math.min(200, Math.round(clamped / ratio))) };
        }
        return { ...prev, width: Math.max(4, Math.min(200, Math.round(clamped * ratio))), height: clamped };
      }
      return { ...prev, [dim]: clamped };
    });
  };

  const handleConvertToProject = () => {
    if (!result) return;
    const base = createBlankProject({
      name: imageName,
      craftType: 'crochet',
      crochetCategory: 'standard',
      width: result.width,
      height: result.height,
      palette: result.palette,
      handedness: defaultHandedness,
    });
    const finalProject: PatternProject = {
      ...base,
      grid: result.grid,
      sourceImageDataUrl: croppedDataUrl ?? undefined,
    };
    onCreateFromPhoto(finalProject);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E6E0D4] pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#1E1D20]">
            Photo Studio & Pixelator
          </h1>
          <p className="mt-0.5 text-xs text-[#615B69]">
            All photo cropping and colour quantization runs privately on your device — nothing is uploaded externally.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#DED7C8] bg-white px-4 py-2.5 text-xs font-semibold text-[#1E1D20] hover:bg-[#F3EFE7] min-h-[42px]">
            <Upload className="h-4 w-4 text-[#7C6A9A]" />
            <span>Upload Image</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={openCamera}
            className="inline-flex items-center gap-2 rounded-xl border border-[#DED7C8] bg-white px-4 py-2.5 text-xs font-semibold text-[#1E1D20] hover:bg-[#F3EFE7] min-h-[42px]"
          >
            <Camera className="h-4 w-4 text-[#7C6A9A]" />
            <span>Take Photo</span>
          </button>

          {result && (
            <button
              type="button"
              onClick={handleConvertToProject}
              className="inline-flex items-center gap-2 rounded-xl bg-[#7C6A9A] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#6A5888] min-h-[42px]"
            >
              <Check className="h-4 w-4" />
              <span>Save & Open in Designer</span>
            </button>
          )}
        </div>
      </div>

      {!imageEl ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#D6CFC0] bg-white px-6 py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EDE8F5] text-[#7C6A9A]">
            <ImageIcon className="h-8 w-8" />
          </div>
          <h2 className="mt-4 font-display text-xl font-bold text-[#1E1D20]">
            Import a photograph to convert into stitches
          </h2>
          <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[#615B69]">
            Supports PNG, JPG, and JPEG files or live camera capture. Crop, remove backgrounds, pick Median-Cut yarn colours, and preview every stitch before crocheting.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#7C6A9A] px-5 py-3 text-sm font-semibold text-white hover:bg-[#6A5888] min-h-[44px]">
              <Upload className="h-4 w-4" />
              <span>Choose PNG / JPG File</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            <button
              type="button"
              onClick={openCamera}
              className="inline-flex items-center gap-2 rounded-xl border border-[#DED7C8] bg-[#FAF7F2] px-5 py-3 text-sm font-semibold text-[#1E1D20] hover:bg-[#EFE9DD] min-h-[44px]"
            >
              <Camera className="h-4 w-4 text-[#7C6A9A]" />
              <span>Use Camera</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left 7 columns: Crop Canvas + Side-by-Side / Split Pixel Preview */}
          <div className="space-y-5 lg:col-span-7">
            {/* Interactive Crop & Transform Box */}
            <div className="rounded-2xl border border-[#E6E0D4] bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-[#1E1D20]">
                  1. Crop & Frame (drag image to reposition)
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.max(1, Number((z - 0.2).toFixed(2))))}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E6E0D4] bg-[#FAF7F2] text-[#3C3844] hover:bg-[#EFE9DD]"
                    title="Zoom out"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <span className="font-mono text-xs tabular-nums text-[#524D59] px-1">
                    {zoom.toFixed(1)}×
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoom((z) => Math.min(4, Number((z + 0.2).toFixed(2))))}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E6E0D4] bg-[#FAF7F2] text-[#3C3844] hover:bg-[#EFE9DD]"
                    title="Zoom in"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRotation((r) => ((r - 90 + 180) % 360) - 180)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E6E0D4] bg-[#FAF7F2] text-[#3C3844] hover:bg-[#EFE9DD]"
                    title="Rotate 90° left"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRotation((r) => ((r + 90 + 180) % 360) - 180)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E6E0D4] bg-[#FAF7F2] text-[#3C3844] hover:bg-[#EFE9DD]"
                    title="Rotate 90° right"
                  >
                    <RotateCw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlipH((v) => !v)}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                      flipH
                        ? 'border-[#7C6A9A] bg-[#EDE8F5] text-[#4B3D63]'
                        : 'border-[#E6E0D4] bg-[#FAF7F2] text-[#3C3844]'
                    }`}
                    title="Flip horizontal"
                  >
                    <FlipHorizontal2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlipV((v) => !v)}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                      flipV
                        ? 'border-[#7C6A9A] bg-[#EDE8F5] text-[#4B3D63]'
                        : 'border-[#E6E0D4] bg-[#FAF7F2] text-[#3C3844]'
                    }`}
                    title="Flip vertical"
                  >
                    <FlipVertical2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center rounded-xl bg-[#1F2024] p-4">
                <canvas
                  ref={cropCanvasRef}
                  onPointerDown={(e) => {
                    dragStateRef.current = {
                      active: true,
                      startX: e.clientX,
                      startY: e.clientY,
                      basePanX: panX,
                      basePanY: panY,
                    };
                    (e.target as HTMLElement).setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    if (!dragStateRef.current.active) return;
                    const rect = (e.target as HTMLElement).getBoundingClientRect();
                    const dx = (e.clientX - dragStateRef.current.startX) / Math.max(100, rect.width);
                    const dy = (e.clientY - dragStateRef.current.startY) / Math.max(100, rect.height);
                    setPanX(Math.max(-0.8, Math.min(0.8, dragStateRef.current.basePanX + dx)));
                    setPanY(Math.max(-0.8, Math.min(0.8, dragStateRef.current.basePanY + dy)));
                  }}
                  onPointerUp={() => {
                    dragStateRef.current.active = false;
                  }}
                  className="max-h-72 max-w-full cursor-grab rounded-lg border border-[#F5C451]/60 active:cursor-grabbing touch-none"
                />
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="flex justify-between text-[11px] font-medium text-[#524D59]">
                    <span>Fine Rotation</span>
                    <span className="font-mono tabular-nums">{rotation}°</span>
                  </label>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    value={rotation}
                    onChange={(e) => setRotation(Number(e.target.value))}
                    className="mt-1 w-full accent-[#7C6A9A]"
                  />
                </div>
                <div>
                  <label className="flex justify-between text-[11px] font-medium text-[#524D59]">
                    <span>Crop Zoom</span>
                    <span className="font-mono tabular-nums">{zoom.toFixed(2)}×</span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={4}
                    step={0.05}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="mt-1 w-full accent-[#7C6A9A]"
                  />
                </div>
              </div>
            </div>

            {/* Live Converted Pixel Preview & Original Comparison */}
            <div className="rounded-2xl border border-[#E6E0D4] bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold text-[#1E1D20]">
                    2. Converted Stitch Preview{' '}
                    {isProcessing && <span className="text-[#7C6A9A]">· Updating…</span>}
                  </div>
                  {result && (
                    <div className="text-[11px] text-[#615B69] font-mono tabular-nums">
                      {result.width} × {result.height} stitches · {result.palette.length} yarn colours
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 rounded-xl bg-[#F3EFE7] p-1">
                  {(
                    [
                      ['split', 'Compare Split'],
                      ['pixel', 'Stitch Grid'],
                      ['original', 'Original'],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setCompareMode(mode)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                        compareMode === mode
                          ? 'bg-white text-[#1E1D20] shadow-xs'
                          : 'text-[#615B69] hover:text-[#1E1D20]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative mx-auto flex aspect-square max-h-[380px] w-full items-center justify-center overflow-hidden rounded-xl border border-[#E6E0D4] bg-[#F3EFE7]">
                <canvas
                  ref={originalCompareCanvasRef}
                  className={`max-h-full max-w-full object-contain ${
                    compareMode === 'pixel' ? 'hidden' : 'block'
                  }`}
                />
                <canvas
                  ref={pixelCanvasRef}
                  className={`absolute inset-0 m-auto h-full w-full object-contain ${
                    compareMode === 'original' ? 'hidden' : 'block'
                  }`}
                  style={{
                    imageRendering: 'pixelated',
                    clipPath:
                      compareMode === 'split'
                        ? `inset(0 0 0 ${splitPos}%)`
                        : undefined,
                  }}
                />
                {compareMode === 'split' && (
                  <div
                    className="pointer-events-none absolute inset-y-0 w-0.5 bg-[#F5C451] shadow"
                    style={{ left: `${splitPos}%` }}
                  />
                )}
              </div>

              {compareMode === 'split' && (
                <div className="mt-3 flex items-center gap-3 text-[11px] text-[#524D59]">
                  <span className="shrink-0 font-medium">Original</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={splitPos}
                    onChange={(e) => setSplitPos(Number(e.target.value))}
                    className="w-full accent-[#D49A2A]"
                    aria-label="Compare original and pixelated image"
                  />
                  <span className="shrink-0 font-medium">Stitch Pattern</span>
                </div>
              )}

              {result && (
                <div className="mt-4 border-t border-[#F3EFE7] pt-3">
                  <div className="mb-2 text-[11px] font-semibold text-[#524D59]">
                    Extracted Yarn Palette ({result.palette.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.palette.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-1.5 rounded-lg border border-[#E6E0D4] bg-[#FAF7F2] px-2 py-1 text-[11px]"
                        title={`${c.name} (${c.hex})`}
                      >
                        <span
                          className="h-3.5 w-3.5 rounded-sm border border-black/15"
                          style={{ backgroundColor: c.hex }}
                        />
                        <span className="max-w-[110px] truncate font-medium text-[#1E1D20]">
                          {c.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right 5 columns: Controls */}
          <div className="space-y-4 lg:col-span-5">
            {/* Dimensions & Aspect */}
            <div className="rounded-2xl border border-[#E6E0D4] bg-white p-4 space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#1E1D20]">
                <SlidersHorizontal className="h-4 w-4 text-[#7C6A9A]" />
                <span>Format & Stitch Grid Dimensions</span>
              </div>

              <div>
                <span className="text-[11px] font-medium text-[#615B69]">Orientation</span>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {(['square', 'portrait', 'landscape'] as const).map((ori) => (
                    <button
                      key={ori}
                      type="button"
                      onClick={() => applyAspectAndOrientation(ori, aspectPreset)}
                      className={`rounded-xl border py-2 text-xs font-semibold capitalize min-h-[38px] ${
                        orientation === ori
                          ? 'border-[#7C6A9A] bg-[#EDE8F5] text-[#4B3D63]'
                          : 'border-[#E6E0D4] bg-[#FAF7F2] text-[#524D59]'
                      }`}
                    >
                      {ori}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-medium text-[#615B69]">Aspect Ratio Preset</span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {ASPECT_RATIOS.map((ar) => (
                    <button
                      key={ar.id}
                      type="button"
                      onClick={() => applyAspectAndOrientation(orientation, ar.id)}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium min-h-[36px] ${
                        aspectPreset === ar.id
                          ? 'border-[#7C6A9A] bg-[#EDE8F5] text-[#4B3D63]'
                          : 'border-[#E6E0D4] bg-white text-[#524D59]'
                      }`}
                    >
                      {ar.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#615B69]">
                    Width (stitches)
                  </label>
                  <input
                    type="number"
                    min={4}
                    max={200}
                    value={options.width}
                    onChange={(e) => handleDimensionChange('width', Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-[#DED7C8] bg-[#FAF7F2] px-3 py-2 font-mono text-sm tabular-nums text-[#1E1D20]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#615B69]">
                    Height (rows)
                  </label>
                  <input
                    type="number"
                    min={4}
                    max={200}
                    value={options.height}
                    onChange={(e) => handleDimensionChange('height', Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-[#DED7C8] bg-[#FAF7F2] px-3 py-2 font-mono text-sm tabular-nums text-[#1E1D20]"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-[#3C3844]">
                <input
                  type="checkbox"
                  checked={lockAspectToGrid}
                  onChange={(e) => setLockAspectToGrid(e.target.checked)}
                  className="h-4 w-4 accent-[#7C6A9A]"
                />
                <span>Keep grid proportions locked to aspect ratio</span>
              </label>
            </div>

            {/* Pixelation Presets */}
            <div className="rounded-2xl border border-[#E6E0D4] bg-white p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#1E1D20]">
                <Wand2 className="h-4 w-4 text-[#7C6A9A]" />
                <span>Conversion Preset</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(PIXEL_PRESETS) as Array<Exclude<PixelPreset, 'custom'>>).map(
                  (presetKey) => {
                    const p = PIXEL_PRESETS[presetKey];
                    return (
                      <button
                        key={presetKey}
                        type="button"
                        onClick={() => handlePresetClick(presetKey)}
                        className={`rounded-xl border p-2.5 text-left transition-colors ${
                          options.preset === presetKey
                            ? 'border-[#7C6A9A] bg-[#EDE8F5]'
                            : 'border-[#E6E0D4] bg-[#FAF7F2] hover:bg-[#F3EFE7]'
                        }`}
                      >
                        <div className="text-xs font-semibold text-[#1E1D20]">{p.label}</div>
                        <div className="mt-0.5 line-clamp-2 text-[10px] text-[#615B69]">
                          {p.description}
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* Quantization & Dithering */}
            <div className="rounded-2xl border border-[#E6E0D4] bg-white p-4 space-y-3.5">
              <div className="text-xs font-semibold text-[#1E1D20]">
                Colour Quantization & Dithering
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-[#524D59]">
                  <span>Number of Colours</span>
                  <span className="font-mono font-semibold tabular-nums">{options.maxColors}</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={36}
                  value={options.maxColors}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      preset: 'custom',
                      maxColors: Number(e.target.value),
                    }))
                  }
                  className="mt-1 w-full accent-[#7C6A9A]"
                />
              </div>

              <div>
                <span className="text-[11px] font-medium text-[#524D59]">Dithering Algorithm</span>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ['none', 'None'],
                      ['floyd_steinberg', 'Floyd–Steinberg'],
                      ['ordered', 'Ordered'],
                    ] as Array<[DitheringMethod, string]>
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() =>
                        setOptions((prev) => ({ ...prev, preset: 'custom', dithering: id }))
                      }
                      className={`rounded-lg border py-2 text-[11px] font-semibold min-h-[36px] ${
                        options.dithering === id
                          ? 'border-[#7C6A9A] bg-[#EDE8F5] text-[#4B3D63]'
                          : 'border-[#E6E0D4] bg-[#FAF7F2] text-[#524D59]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {options.dithering !== 'none' && (
                <div>
                  <div className="flex justify-between text-[11px] text-[#524D59]">
                    <span>Dithering Tolerance</span>
                    <span className="font-mono tabular-nums">{options.ditheringTolerance}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={options.ditheringTolerance}
                    onChange={(e) =>
                      setOptions((prev) => ({
                        ...prev,
                        preset: 'custom',
                        ditheringTolerance: Number(e.target.value),
                      }))
                    }
                    className="mt-1 w-full accent-[#7C6A9A]"
                  />
                </div>
              )}

              <label className="flex items-center gap-2 text-xs text-[#3C3844]">
                <input
                  type="checkbox"
                  checked={options.snapToYarnLibrary}
                  onChange={(e) =>
                    setOptions((prev) => ({ ...prev, snapToYarnLibrary: e.target.checked }))
                  }
                  className="h-4 w-4 accent-[#7C6A9A]"
                />
                <span>Match colours to real Yarn Palette library</span>
              </label>
            </div>

            {/* Image Fine-Tuning & Background Removal */}
            <div className="rounded-2xl border border-[#E6E0D4] bg-white p-4 space-y-3">
              <div className="text-xs font-semibold text-[#1E1D20]">
                Image Adjustments & Background
              </div>

              {(
                [
                  ['brightness', 'Brightness', -60, 60],
                  ['contrast', 'Contrast', -60, 60],
                  ['saturation', 'Saturation', -80, 80],
                  ['colorIntensity', 'Colour Intensity', 0, 100],
                  ['sharpness', 'Sharpness', 0, 100],
                  ['detailLevel', 'Detail Level', 0, 100],
                ] as const
              ).map(([key, label, min, max]) => (
                <div key={key}>
                  <div className="flex justify-between text-[11px] text-[#524D59]">
                    <span>{label}</span>
                    <span className="font-mono tabular-nums">{options[key]}</span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    value={options[key]}
                    onChange={(e) =>
                      setOptions((prev) => ({
                        ...prev,
                        preset: 'custom',
                        [key]: Number(e.target.value),
                      }))
                    }
                    className="mt-0.5 w-full accent-[#7C6A9A]"
                  />
                </div>
              ))}

              <div>
                <div className="flex justify-between text-[11px] text-[#524D59]">
                  <span>Pixel Smoothing Size</span>
                  <span className="font-mono tabular-nums">{options.pixelSize}×</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={1}
                  value={options.pixelSize}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      preset: 'custom',
                      pixelSize: Number(e.target.value),
                    }))
                  }
                  className="mt-0.5 w-full accent-[#7C6A9A]"
                />
              </div>

              <div className="border-t border-[#F3EFE7] pt-3 space-y-2.5">
                <label className="flex items-center justify-between text-xs font-medium text-[#1E1D20]">
                  <span>Remove Backdrop Around Subject</span>
                  <input
                    type="checkbox"
                    checked={options.removeBackground}
                    onChange={(e) =>
                      setOptions((prev) => ({ ...prev, removeBackground: e.target.checked }))
                    }
                    className="h-4 w-4 accent-[#7C6A9A]"
                  />
                </label>

                {options.removeBackground && (
                  <div className="space-y-2 rounded-xl bg-[#FAF7F2] p-3">
                    <div>
                      <div className="flex justify-between text-[11px] text-[#524D59]">
                        <span>Background Tolerance</span>
                        <span className="font-mono tabular-nums">{options.bgTolerance}</span>
                      </div>
                      <input
                        type="range"
                        min={8}
                        max={75}
                        value={options.bgTolerance}
                        onChange={(e) =>
                          setOptions((prev) => ({ ...prev, bgTolerance: Number(e.target.value) }))
                        }
                        className="mt-1 w-full accent-[#7C6A9A]"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[#524D59]">
                      <span>Replace Backdrop Colour</span>
                      <input
                        type="color"
                        value={options.bgReplacementHex}
                        onChange={(e) =>
                          setOptions((prev) => ({ ...prev, bgReplacementHex: e.target.value }))
                        }
                        className="h-7 w-10 cursor-pointer rounded border border-[#DED7C8]"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Camera Modal */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#E6E0D4] bg-[#FAF7F2] p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3">
              <h3 className="font-display text-lg font-bold text-[#1E1D20]">Take Photo</h3>
              <button
                type="button"
                onClick={closeCamera}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E6E0D4] bg-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {cameraError ? (
              <div className="rounded-xl border border-[#E6E0D4] bg-white p-4 text-xs text-[#524D59] space-y-3">
                <p>{cameraError}</p>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#7C6A9A] px-4 py-2.5 text-xs font-semibold text-white">
                  <Camera className="h-4 w-4" />
                  <span>Open Device Camera / Photo Picker</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => {
                      closeCamera();
                      handleFileChange(e);
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-xl bg-black">
                  <video ref={videoRef} autoPlay playsInline className="aspect-[4/3] w-full object-cover" />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeCamera}
                    className="rounded-xl border border-[#E6E0D4] bg-white px-4 py-2.5 text-xs font-semibold text-[#3C3844]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={snapPhoto}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#7C6A9A] px-5 py-2.5 text-xs font-semibold text-white"
                  >
                    <Camera className="h-4 w-4" />
                    <span>Capture Photo</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
