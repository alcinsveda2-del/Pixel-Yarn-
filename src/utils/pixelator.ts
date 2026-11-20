import {
  findNearestLibraryYarn,
  hexToRgb,
  labDistance,
  rgbToHex,
  rgbToLab,
} from '../data/yarnLibrary';
import {
  PaletteColor,
  PixelationOptions,
  PixelPreset,
} from '../types/pattern';

export const PIXEL_PRESETS: Record<
  Exclude<PixelPreset, 'custom'>,
  { label: string; description: string; patch: Partial<PixelationOptions> }
> = {
  smart: {
    label: 'Smart Conversion',
    description: 'Balanced 12-colour tapestry palette with gentle edge sharpening and light shading.',
    patch: {
      maxColors: 12,
      dithering: 'floyd_steinberg',
      ditheringTolerance: 30,
      sharpness: 25,
      colorIntensity: 15,
      detailLevel: 65,
      pixelSize: 1,
    },
  },
  clean_calm: {
    label: 'Clean and Calm',
    description: 'Smooth 8-colour blocks with zero dithering speckles for peaceful stitching.',
    patch: {
      maxColors: 8,
      dithering: 'none',
      ditheringTolerance: 0,
      sharpness: 10,
      colorIntensity: 10,
      detailLevel: 40,
      pixelSize: 2,
    },
  },
  more_details: {
    label: 'More Details',
    description: '16 colours with subtle ordered dithering to preserve gradients and features.',
    patch: {
      maxColors: 16,
      dithering: 'ordered',
      ditheringTolerance: 40,
      sharpness: 35,
      colorIntensity: 20,
      detailLevel: 80,
      pixelSize: 1,
    },
  },
  high_detail: {
    label: 'High Detail',
    description: 'Rich 24-colour portrait conversion with fine shading and crisp contrast.',
    patch: {
      maxColors: 24,
      dithering: 'floyd_steinberg',
      ditheringTolerance: 50,
      sharpness: 45,
      colorIntensity: 20,
      detailLevel: 95,
      pixelSize: 1,
    },
  },
  limited_colour: {
    label: 'Limited Colour',
    description: 'Bold 5-colour graphic conversion ideal for beginner tapestry or mosaic projects.',
    patch: {
      maxColors: 5,
      dithering: 'none',
      ditheringTolerance: 0,
      sharpness: 30,
      colorIntensity: 25,
      detailLevel: 30,
      pixelSize: 2,
    },
  },
};

export function getDefaultPixelationOptions(): PixelationOptions {
  return {
    preset: 'smart',
    width: 48,
    height: 48,
    maxColors: 12,
    dithering: 'floyd_steinberg',
    ditheringTolerance: 30,
    brightness: 0,
    contrast: 8,
    saturation: 5,
    sharpness: 25,
    colorIntensity: 15,
    detailLevel: 65,
    pixelSize: 1,
    snapToYarnLibrary: true,
    removeBackground: false,
    bgTolerance: 28,
    bgReplacementHex: '#FAF5E8',
  };
}

export interface PixelationResult {
  width: number;
  height: number;
  grid: number[];
  palette: PaletteColor[];
  previewRgba: Uint8ClampedArray; // width * height * 4
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

// Apply brightness, contrast, saturation, and color intensity
function adjustImageRgba(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  options: PixelationOptions
): Float32Array {
  const out = new Float32Array(width * height * 3);
  const brightOffset = options.brightness * 1.6;
  const contrastFactor = Math.pow((options.contrast + 100) / 100, 1.5);
  const satFactor = Math.max(0, 1 + (options.saturation + options.colorIntensity * 0.45) / 100);

  for (let i = 0; i < width * height; i++) {
    const si = i * 4;
    const di = i * 3;
    const alpha = src[si + 3] / 255;
    // Composite transparent pixels over replacement background color
    const [bgR, bgG, bgB] = hexToRgb(options.bgReplacementHex);
    let r = src[si] * alpha + bgR * (1 - alpha);
    let g = src[si + 1] * alpha + bgG * (1 - alpha);
    let b = src[si + 2] * alpha + bgB * (1 - alpha);

    // Brightness + Contrast
    r = (r + brightOffset - 128) * contrastFactor + 128;
    g = (g + brightOffset - 128) * contrastFactor + 128;
    b = (b + brightOffset - 128) * contrastFactor + 128;

    // Saturation / Color intensity
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = luma + (r - luma) * satFactor;
    g = luma + (g - luma) * satFactor;
    b = luma + (b - luma) * satFactor;

    out[di] = Math.max(0, Math.min(255, r));
    out[di + 1] = Math.max(0, Math.min(255, g));
    out[di + 2] = Math.max(0, Math.min(255, b));
  }
  return out;
}

// Real 3x3 unsharp mask sharpening + optional detail smoothing when pixelSize > 1
function applyConvolution(
  buf: Float32Array,
  width: number,
  height: number,
  sharpness: number,
  detailLevel: number,
  pixelSize: number
): Float32Array {
  const blurStrength = pixelSize > 1 ? Math.min(0.75, (pixelSize - 1) * 0.22 + (100 - detailLevel) * 0.003) : Math.max(0, (50 - detailLevel) * 0.004);
  const sharpAmount = (sharpness / 100) * 1.25;
  if (sharpAmount < 0.02 && blurStrength < 0.02) return buf;

  const res = new Float32Array(buf.length);
  for (let y = 0; y < height; y++) {
    const ym1 = Math.max(0, y - 1);
    const yp1 = Math.min(height - 1, y + 1);
    for (let x = 0; x < width; x++) {
      const xm1 = Math.max(0, x - 1);
      const xp1 = Math.min(width - 1, x + 1);
      const ci = (y * width + x) * 3;
      const top = (ym1 * width + x) * 3;
      const bot = (yp1 * width + x) * 3;
      const left = (y * width + xm1) * 3;
      const right = (y * width + xp1) * 3;

      for (let c = 0; c < 3; c++) {
        const center = buf[ci + c];
        const avgNeighbors = (buf[top + c] + buf[bot + c] + buf[left + c] + buf[right + c]) * 0.25;
        let val = center * (1 - blurStrength) + avgNeighbors * blurStrength;
        // Unsharp mask: val + amount * (val - avgNeighbors)
        val = val + sharpAmount * (val - avgNeighbors);
        res[ci + c] = Math.max(0, Math.min(255, val));
      }
    }
  }
  return res;
}

// Corner-seeded BFS flood-fill background removal using perceptual Lab distance
function applyBackgroundRemoval(
  buf: Float32Array,
  width: number,
  height: number,
  tolerance: number,
  replacementHex: string
): void {
  const [repR, repG, repB] = hexToRgb(replacementHex);
  const corners = [
    0,
    width - 1,
    (height - 1) * width,
    height * width - 1,
  ];
  // Compute average corner Lab or test each corner seed
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const cornerLabs = corners.map((idx) =>
    rgbToLab(buf[idx * 3], buf[idx * 3 + 1], buf[idx * 3 + 2])
  );

  for (const idx of corners) {
    if (!visited[idx]) {
      visited[idx] = 1;
      queue[tail++] = idx;
    }
  }

  const maxDist = Math.max(8, tolerance * 1.15);

  while (head < tail) {
    const idx = queue[head++];
    const x = idx % width;
    const y = (idx - x) / width;

    const neighbors = [
      x > 0 ? idx - 1 : -1,
      x < width - 1 ? idx + 1 : -1,
      y > 0 ? idx - width : -1,
      y < height - 1 ? idx + width : -1,
    ];

    for (const nIdx of neighbors) {
      if (nIdx < 0 || visited[nIdx]) continue;
      const nLab = rgbToLab(buf[nIdx * 3], buf[nIdx * 3 + 1], buf[nIdx * 3 + 2]);
      let minCornerDist = Infinity;
      for (const cLab of cornerLabs) {
        const d = labDistance(nLab, cLab);
        if (d < minCornerDist) minCornerDist = d;
      }
      if (minCornerDist <= maxDist) {
        visited[nIdx] = 1;
        queue[tail++] = nIdx;
      }
    }
  }

  for (let i = 0; i < width * height; i++) {
    if (visited[i]) {
      buf[i * 3] = repR;
      buf[i * 3 + 1] = repG;
      buf[i * 3 + 2] = repB;
    }
  }
}

// Area-average downsampling onto exact stitch grid (preserves proportions without aliasing)
function resampleToStitchGrid(
  buf: Float32Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
): Float32Array {
  const out = new Float32Array(dstW * dstH * 3);
  const scaleX = srcW / dstW;
  const scaleY = srcH / dstH;

  for (let dy = 0; dy < dstH; dy++) {
    const y0 = dy * scaleY;
    const y1 = Math.min(srcH, (dy + 1) * scaleY);
    const iy0 = Math.floor(y0);
    const iy1 = Math.min(srcH - 1, Math.floor(y1 - 1e-6));

    for (let dx = 0; dx < dstW; dx++) {
      const x0 = dx * scaleX;
      const x1 = Math.min(srcW, (dx + 1) * scaleX);
      const ix0 = Math.floor(x0);
      const ix1 = Math.min(srcW - 1, Math.floor(x1 - 1e-6));

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let weightSum = 0;

      for (let sy = iy0; sy <= iy1; sy++) {
        const wy = Math.min(y1, sy + 1) - Math.max(y0, sy);
        if (wy <= 0) continue;
        for (let sx = ix0; sx <= ix1; sx++) {
          const wx = Math.min(x1, sx + 1) - Math.max(x0, sx);
          if (wx <= 0) continue;
          const w = wx * wy;
          const si = (sy * srcW + sx) * 3;
          rSum += buf[si] * w;
          gSum += buf[si + 1] * w;
          bSum += buf[si + 2] * w;
          weightSum += w;
        }
      }

      const di = (dy * dstW + dx) * 3;
      const inv = weightSum > 0 ? 1 / weightSum : 1;
      out[di] = rSum * inv;
      out[di + 1] = gSum * inv;
      out[di + 2] = bSum * inv;
    }
  }
  return out;
}

// Median-Cut color quantization + 3 K-means refinement steps
function medianCutQuantize(
  pixels: Float32Array,
  pixelCount: number,
  maxColors: number
): Array<[number, number, number]> {
  const targetK = Math.max(2, Math.min(64, maxColors));
  const indices: number[] = [];
  for (let i = 0; i < pixelCount; i++) indices.push(i);

  interface Bucket {
    items: number[];
    range: number;
    channel: 0 | 1 | 2;
  }

  const analyzeBucket = (items: number[]): Bucket => {
    let minR = 255, maxR = 0, minG = 255, maxG = 0, minB = 255, maxB = 0;
    for (const idx of items) {
      const p = idx * 3;
      const r = pixels[p];
      const g = pixels[p + 1];
      const b = pixels[p + 2];
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      if (g < minG) minG = g;
      if (g > maxG) maxG = g;
      if (b < minB) minB = b;
      if (b > maxB) maxB = b;
    }
    const rRange = (maxR - minR) * 1.05; // perceptual weighting
    const gRange = (maxG - minG) * 1.25;
    const bRange = (maxB - minB) * 0.9;
    let channel: 0 | 1 | 2 = 0;
    let range = rRange;
    if (gRange > range) {
      range = gRange;
      channel = 1;
    }
    if (bRange > range) {
      range = bRange;
      channel = 2;
    }
    return { items, range, channel };
  };

  const buckets: Bucket[] = [analyzeBucket(indices)];

  while (buckets.length < targetK) {
    // Pick bucket with widest perceptual range that has > 1 pixel
    let splitIdx = -1;
    let bestScore = -1;
    for (let i = 0; i < buckets.length; i++) {
      if (buckets[i].items.length > 1 && buckets[i].range > bestScore) {
        bestScore = buckets[i].range;
        splitIdx = i;
      }
    }
    if (splitIdx === -1 || bestScore <= 1) break;

    const chosen = buckets.splice(splitIdx, 1)[0];
    const ch = chosen.channel;
    chosen.items.sort((a, b) => pixels[a * 3 + ch] - pixels[b * 3 + ch]);
    const mid = Math.floor(chosen.items.length / 2);
    buckets.push(analyzeBucket(chosen.items.slice(0, mid)));
    buckets.push(analyzeBucket(chosen.items.slice(mid)));
  }

  let centroids: Array<[number, number, number]> = buckets.map((b) => {
    let sr = 0, sg = 0, sb = 0;
    for (const idx of b.items) {
      sr += pixels[idx * 3];
      sg += pixels[idx * 3 + 1];
      sb += pixels[idx * 3 + 2];
    }
    const n = b.items.length || 1;
    return [sr / n, sg / n, sb / n];
  });

  // 3 K-means refinement passes to tighten palette accuracy
  for (let iter = 0; iter < 3; iter++) {
    const sumR = new Float64Array(centroids.length);
    const sumG = new Float64Array(centroids.length);
    const sumB = new Float64Array(centroids.length);
    const counts = new Int32Array(centroids.length);

    for (let i = 0; i < pixelCount; i++) {
      const r = pixels[i * 3];
      const g = pixels[i * 3 + 1];
      const b = pixels[i * 3 + 2];
      let bestC = 0;
      let bestDist = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const dr = r - centroids[c][0];
        const dg = g - centroids[c][1];
        const db = b - centroids[c][2];
        const d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
        if (d < bestDist) {
          bestDist = d;
          bestC = c;
        }
      }
      sumR[bestC] += r;
      sumG[bestC] += g;
      sumB[bestC] += b;
      counts[bestC]++;
    }

    centroids = centroids.map((prev, c) =>
      counts[c] > 0
        ? [sumR[c] / counts[c], sumG[c] / counts[c], sumB[c] / counts[c]]
        : prev
    );
  }

  return centroids;
}

const BAYER_4X4 = [
  [0 / 16 - 0.5, 8 / 16 - 0.5, 2 / 16 - 0.5, 10 / 16 - 0.5],
  [12 / 16 - 0.5, 4 / 16 - 0.5, 14 / 16 - 0.5, 6 / 16 - 0.5],
  [3 / 16 - 0.5, 11 / 16 - 0.5, 1 / 16 - 0.5, 9 / 16 - 0.5],
  [15 / 16 - 0.5, 7 / 16 - 0.5, 13 / 16 - 0.5, 5 / 16 - 0.5],
];

export function processImagePixels(
  srcRgba: Uint8ClampedArray,
  srcWidth: number,
  srcHeight: number,
  options: PixelationOptions
): PixelationResult {
  const dstW = Math.max(4, Math.min(200, Math.round(options.width)));
  const dstH = Math.max(4, Math.min(200, Math.round(options.height)));

  // 1. Color adjustments
  const adjusted = adjustImageRgba(srcRgba, srcWidth, srcHeight, options);

  // 2. Background removal (if requested) before downsampling
  if (options.removeBackground) {
    applyBackgroundRemoval(adjusted, srcWidth, srcHeight, options.bgTolerance, options.bgReplacementHex);
  }

  // 3. Sharpness & detail filtering
  const filtered = applyConvolution(
    adjusted,
    srcWidth,
    srcHeight,
    options.sharpness,
    options.detailLevel,
    options.pixelSize
  );

  // 4. Area-average resample onto exact stitch grid
  const stitchPixels = resampleToStitchGrid(filtered, srcWidth, srcHeight, dstW, dstH);
  const totalStitches = dstW * dstH;

  // 5. Median-Cut palette extraction
  const centroids = medianCutQuantize(stitchPixels, totalStitches, options.maxColors);

  // 6. Build final PaletteColor entries (optionally snapped to real Yarn Library shades)
  const paletteMap = new Map<string, PaletteColor>();
  centroids.forEach(([r, g, b], idx) => {
    if (options.snapToYarnLibrary) {
      const yarn = findNearestLibraryYarn(r, g, b);
      if (!paletteMap.has(yarn.hex)) {
        paletteMap.set(yarn.hex, {
          ...yarn,
          id: `col-${paletteMap.size + 1}-${yarn.id}`,
        });
      }
    } else {
      const hex = rgbToHex(r, g, b);
      if (!paletteMap.has(hex)) {
        const nearest = findNearestLibraryYarn(r, g, b);
        paletteMap.set(hex, {
          id: `col-${paletteMap.size + 1}`,
          hex,
          name: `${nearest.name} Shade`,
          brand: 'Custom Match',
          yarnName: 'Converted Color',
        });
      }
      void idx;
    }
  });

  const palette = Array.from(paletteMap.values());
  if (palette.length === 0) {
    palette.push({ id: 'col-1', hex: '#FAF5E8', name: 'Natural Cream' });
  }

  const paletteRgb = palette.map((p) => hexToRgb(p.hex));
  const paletteLab = paletteRgb.map(([r, g, b]) => rgbToLab(r, g, b));

  const findClosestPaletteIndex = (r: number, g: number, b: number): number => {
    const lab = rgbToLab(clampByte(r), clampByte(g), clampByte(b));
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < paletteLab.length; i++) {
      const d = labDistance(lab, paletteLab[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  };

  // 7. Dithering & pixel assignment
  const grid = new Array<number>(totalStitches);
  const workBuf = new Float32Array(stitchPixels);
  const ditherStrength = Math.max(0, Math.min(1, options.ditheringTolerance / 100));

  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const idx = y * dstW + x;
      const p = idx * 3;
      let r = workBuf[p];
      let g = workBuf[p + 1];
      let b = workBuf[p + 2];

      if (options.dithering === 'ordered' && ditherStrength > 0) {
        const bias = BAYER_4X4[y & 3][x & 3] * 64 * ditherStrength;
        r += bias;
        g += bias;
        b += bias;
      }

      const chosenIdx = findClosestPaletteIndex(r, g, b);
      grid[idx] = chosenIdx;

      if (options.dithering === 'floyd_steinberg' && ditherStrength > 0) {
        const [qr, qg, qb] = paletteRgb[chosenIdx];
        const errR = (r - qr) * ditherStrength;
        const errG = (g - qg) * ditherStrength;
        const errB = (b - qb) * ditherStrength;

        const distribute = (nx: number, ny: number, factor: number) => {
          if (nx < 0 || nx >= dstW || ny >= dstH) return;
          const np = (ny * dstW + nx) * 3;
          workBuf[np] += errR * factor;
          workBuf[np + 1] += errG * factor;
          workBuf[np + 2] += errB * factor;
        };

        distribute(x + 1, y, 7 / 16);
        distribute(x - 1, y + 1, 3 / 16);
        distribute(x, y + 1, 5 / 16);
        distribute(x + 1, y + 1, 1 / 16);
      }
    }
  }

  // Prune any unused colors from palette and compact grid indices
  const usedIndices = Array.from(new Set(grid)).sort((a, b) => a - b);
  const remap = new Map<number, number>();
  const finalPalette: PaletteColor[] = [];
  usedIndices.forEach((oldIdx, newIdx) => {
    remap.set(oldIdx, newIdx);
    finalPalette.push(palette[oldIdx]);
  });
  for (let i = 0; i < grid.length; i++) {
    grid[i] = remap.get(grid[i]) ?? 0;
  }

  const previewRgba = new Uint8ClampedArray(totalStitches * 4);
  for (let i = 0; i < totalStitches; i++) {
    const [r, g, b] = hexToRgb(finalPalette[grid[i]].hex);
    previewRgba[i * 4] = r;
    previewRgba[i * 4 + 1] = g;
    previewRgba[i * 4 + 2] = b;
    previewRgba[i * 4 + 3] = 255;
  }

  return {
    width: dstW,
    height: dstH,
    grid,
    palette: finalPalette,
    previewRgba,
  };
}
