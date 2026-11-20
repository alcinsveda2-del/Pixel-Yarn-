import {
  ColorUsageStat,
  CrochetCategory,
  CrochetMethod,
  CrochetSettings,
  PaletteColor,
  PatternProject,
  YarnWeight,
} from '../types/pattern';

export interface MethodSpec {
  id: CrochetMethod;
  label: string;
  shortLabel: string;
  category: CrochetCategory;
  // Base stitch/row gauge multipliers relative to Worsted weight (16 sc / 18 rows per 10cm)
  stitchRatio: number;
  rowRatio: number;
  yarnPerStitchCm: number; // approximate yarn consumption per stitch at worsted weight
}

export const CROCHET_METHOD_SPECS: Record<CrochetMethod, MethodSpec> = {
  single_crochet: {
    id: 'single_crochet',
    label: 'Single Crochet (sc)',
    shortLabel: 'Single Crochet',
    category: 'standard',
    stitchRatio: 1.0,
    rowRatio: 1.125, // 16 sts x 18 rows in worsted
    yarnPerStitchCm: 2.2,
  },
  half_double_crochet: {
    id: 'half_double_crochet',
    label: 'Half Double Crochet (hdc)',
    shortLabel: 'Half Double',
    category: 'standard',
    stitchRatio: 0.875, // ~14 sts
    rowRatio: 0.75, // ~12 rows
    yarnPerStitchCm: 2.9,
  },
  double_crochet: {
    id: 'double_crochet',
    label: 'Double Crochet (dc)',
    shortLabel: 'Double Crochet',
    category: 'standard',
    stitchRatio: 0.8125, // ~13 sts
    rowRatio: 0.47, // ~7.5 rows
    yarnPerStitchCm: 3.8,
  },
  tunisian_simple: {
    id: 'tunisian_simple',
    label: 'Tunisian Simple Stitch (tss)',
    shortLabel: 'Tunisian Simple',
    category: 'tunisian',
    stitchRatio: 0.94, // ~15 sts
    rowRatio: 0.875, // ~14 rows
    yarnPerStitchCm: 3.1,
  },
  c2c: {
    id: 'c2c',
    label: 'Corner-to-Corner (C2C)',
    shortLabel: 'C2C',
    category: 'c2c',
    stitchRatio: 0.34, // ~5.5 tiles per 10cm
    rowRatio: 0.34, // square tiles
    yarnPerStitchCm: 16.5, // one C2C tile = ch3 + 3 dc
  },
  mosaic: {
    id: 'mosaic',
    label: 'Overlay Mosaic Crochet',
    shortLabel: 'Mosaic',
    category: 'mosaic',
    stitchRatio: 1.0, // ~16 sts
    rowRatio: 1.0, // ~16 rows
    yarnPerStitchCm: 2.6,
  },
  other: {
    id: 'other',
    label: 'Other / Custom Stitch',
    shortLabel: 'Custom Stitch',
    category: 'standard',
    stitchRatio: 1.0,
    rowRatio: 1.0,
    yarnPerStitchCm: 2.4,
  },
};

export interface YarnWeightSpec {
  id: YarnWeight;
  label: string;
  suggestedHookMm: number;
  baseScStitchesPer10Cm: number;
  yarnScale: number;
}

export const YARN_WEIGHT_SPECS: Record<YarnWeight, YarnWeightSpec> = {
  lace: { id: 'lace', label: 'Lace (0)', suggestedHookMm: 1.75, baseScStitchesPer10Cm: 32, yarnScale: 0.55 },
  fingering: { id: 'fingering', label: 'Fingering (1)', suggestedHookMm: 2.75, baseScStitchesPer10Cm: 26, yarnScale: 0.68 },
  sport: { id: 'sport', label: 'Sport (2)', suggestedHookMm: 3.5, baseScStitchesPer10Cm: 22, yarnScale: 0.8 },
  dk: { id: 'dk', label: 'DK / Light (3)', suggestedHookMm: 4.0, baseScStitchesPer10Cm: 19, yarnScale: 0.9 },
  worsted: { id: 'worsted', label: 'Worsted / Medium (4)', suggestedHookMm: 5.0, baseScStitchesPer10Cm: 16, yarnScale: 1.0 },
  bulky: { id: 'bulky', label: 'Bulky (5)', suggestedHookMm: 6.5, baseScStitchesPer10Cm: 12, yarnScale: 1.3 },
  super_bulky: { id: 'super_bulky', label: 'Super Bulky (6)', suggestedHookMm: 9.0, baseScStitchesPer10Cm: 8, yarnScale: 1.75 },
};

export function getRecommendedGauge(method: CrochetMethod, yarnWeight: YarnWeight): {
  stitchGaugePer10Cm: number;
  rowGaugePer10Cm: number;
  hookSizeMm: number;
} {
  const m = CROCHET_METHOD_SPECS[method];
  const y = YARN_WEIGHT_SPECS[yarnWeight];
  const stitchGaugePer10Cm = Math.max(2, Number((y.baseScStitchesPer10Cm * m.stitchRatio).toFixed(1)));
  const rowGaugePer10Cm = Math.max(2, Number((y.baseScStitchesPer10Cm * m.rowRatio).toFixed(1)));
  const hookSizeMm = method === 'tunisian_simple' ? Number((y.suggestedHookMm + 1.0).toFixed(2)) : y.suggestedHookMm;
  return { stitchGaugePer10Cm, rowGaugePer10Cm, hookSizeMm };
}

export function getDefaultCrochetSettings(
  method: CrochetMethod = 'single_crochet',
  yarnWeight: YarnWeight = 'worsted',
  handedness: 'right' | 'left' = 'right'
): CrochetSettings {
  const gauge = getRecommendedGauge(method, yarnWeight);
  return {
    method,
    workingDirection: 'alternating',
    handedness,
    yarnWeight,
    hookSizeMm: gauge.hookSizeMm,
    yarnBrand: 'StudioYarn',
    yarnName: 'Worsted Everyday',
    stitchGaugePer10Cm: gauge.stitchGaugePer10Cm,
    rowGaugePer10Cm: gauge.rowGaugePer10Cm,
  };
}

// Exact formula specified: Width in cm = stitch count / stitches per 10 cm * 10
export function calculateDimensions(
  stitchCount: number,
  rowCount: number,
  stitchGaugePer10Cm: number,
  rowGaugePer10Cm: number
): { widthCm: number; heightCm: number; widthIn: number; heightIn: number } {
  const safeStitchGauge = Math.max(0.5, stitchGaugePer10Cm || 16);
  const safeRowGauge = Math.max(0.5, rowGaugePer10Cm || 18);
  const widthCm = (stitchCount / safeStitchGauge) * 10;
  const heightCm = (rowCount / safeRowGauge) * 10;
  return {
    widthCm,
    heightCm,
    widthIn: widthCm / 2.54,
    heightIn: heightCm / 2.54,
  };
}

export function getTotalRowsForProject(project: Pick<PatternProject, 'width' | 'height' | 'settings'>): number {
  if (project.settings.method === 'c2c') {
    return Math.max(1, project.width + project.height - 1);
  }
  return Math.max(1, project.height);
}

export function computeColorUsage(project: PatternProject): ColorUsageStat[] {
  const counts = new Map<number, number>();
  const total = project.grid.length || 1;
  for (let i = 0; i < project.grid.length; i++) {
    const idx = project.grid[i];
    counts.set(idx, (counts.get(idx) ?? 0) + 1);
  }

  const methodSpec = CROCHET_METHOD_SPECS[project.settings.method] ?? CROCHET_METHOD_SPECS.single_crochet;
  const weightSpec = YARN_WEIGHT_SPECS[project.settings.yarnWeight] ?? YARN_WEIGHT_SPECS.worsted;
  const metersPerStitch = (methodSpec.yarnPerStitchCm * weightSpec.yarnScale) / 100;

  return project.palette.map((color, colorIndex) => {
    const stitchCount = counts.get(colorIndex) ?? 0;
    return {
      colorIndex,
      color,
      stitchCount,
      percentage: (stitchCount / total) * 100,
      estimatedMeters: stitchCount * metersPerStitch,
    };
  });
}

export function resizeProjectGrid(
  oldGrid: number[],
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number,
  fillIndex = 0
): number[] {
  const next = new Array<number>(newWidth * newHeight).fill(fillIndex);
  // Anchor bottom-left so Row 1 stays intact when resizing height/width
  for (let rowFromBottom = 0; rowFromBottom < Math.min(oldHeight, newHeight); rowFromBottom++) {
    const oldY = oldHeight - 1 - rowFromBottom;
    const newY = newHeight - 1 - rowFromBottom;
    for (let x = 0; x < Math.min(oldWidth, newWidth); x++) {
      next[newY * newWidth + x] = oldGrid[oldY * oldWidth + x] ?? fillIndex;
    }
  }
  return next;
}

export function replaceColorInGrid(
  grid: number[],
  fromIndex: number,
  toIndex: number
): number[] {
  return grid.map((val) => (val === fromIndex ? toIndex : val));
}

export function removeColorFromGridAndPalette(
  grid: number[],
  palette: PaletteColor[],
  removeIndex: number,
  replacementIndex: number
): { grid: number[]; palette: PaletteColor[] } {
  const safeReplacement = replacementIndex === removeIndex ? 0 : replacementIndex;
  const nextPalette = palette.filter((_, idx) => idx !== removeIndex);
  const nextGrid = grid.map((val) => {
    const mapped = val === removeIndex ? safeReplacement : val;
    return mapped > removeIndex ? mapped - 1 : mapped;
  });
  return { grid: nextGrid, palette: nextPalette };
}
