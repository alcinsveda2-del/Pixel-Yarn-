export type AppSection =
  | 'home'
  | 'photo-studio'
  | 'designer'
  | 'projects'
  | 'palette'
  | 'instructions'
  | 'settings';

export type CraftType =
  | 'crochet'
  | 'knitting'
  | 'embroidery'
  | 'painting'
  | 'fuse_beads'
  | 'pixel_art'
  | 'other';

export type CrochetCategory = 'standard' | 'tunisian' | 'c2c' | 'mosaic';

export type CrochetMethod =
  | 'single_crochet'
  | 'half_double_crochet'
  | 'double_crochet'
  | 'tunisian_simple'
  | 'c2c'
  | 'mosaic'
  | 'other';

export type WorkingDirection = 'alternating' | 'right_to_left' | 'left_to_right';

export type Handedness = 'right' | 'left';

export type YarnWeight =
  | 'lace'
  | 'fingering'
  | 'sport'
  | 'dk'
  | 'worsted'
  | 'bulky'
  | 'super_bulky';

export interface PaletteColor {
  id: string;
  hex: string;
  name: string;
  brand?: string;
  yarnName?: string;
  code?: string;
}

export interface PersonalPalette {
  id: string;
  name: string;
  createdAt: number;
  colors: PaletteColor[];
}

export interface CrochetSettings {
  method: CrochetMethod;
  workingDirection: WorkingDirection;
  handedness: Handedness;
  yarnWeight: YarnWeight;
  hookSizeMm: number;
  yarnBrand: string;
  yarnName: string;
  stitchGaugePer10Cm: number;
  rowGaugePer10Cm: number;
}

export interface ProjectProgress {
  currentRow: number; // 1-indexed (1..totalRows)
  completedRows: number[]; // unique sorted 1-indexed row numbers
  rowCounters: Record<number, number>; // independent per-row count (undefined means blank/unentered)
}

export interface PatternProject {
  id: string;
  name: string;
  craftType: CraftType;
  crochetCategory: CrochetCategory;
  createdAt: number;
  updatedAt: number;
  width: number; // stitch columns
  height: number; // pattern rows
  grid: number[]; // row-major top-to-bottom (y=0 is top, y=height-1 is bottom / Row 1)
  palette: PaletteColor[];
  sourceImageDataUrl?: string;
  settings: CrochetSettings;
  progress: ProjectProgress;
  savedAsPattern?: boolean;
}

export type PixelPreset =
  | 'smart'
  | 'clean_calm'
  | 'more_details'
  | 'high_detail'
  | 'limited_colour'
  | 'custom';

export type DitheringMethod = 'none' | 'floyd_steinberg' | 'ordered';

export type AspectRatioPreset = '1:1' | '3:4' | '4:5' | '9:16' | 'custom';

export interface PixelationOptions {
  preset: PixelPreset;
  width: number;
  height: number;
  maxColors: number;
  dithering: DitheringMethod;
  ditheringTolerance: number; // 0..100
  brightness: number; // -100..100
  contrast: number; // -100..100
  saturation: number; // -100..100
  sharpness: number; // 0..100
  colorIntensity: number; // 0..100 (vibrance/punch)
  detailLevel: number; // 0..100
  pixelSize: number; // 1..4 visual grouping / smoothing factor
  snapToYarnLibrary: boolean;
  removeBackground: boolean;
  bgTolerance: number; // 5..80
  bgReplacementHex: string;
}

export interface StitchRun {
  colorIndex: number;
  color: PaletteColor;
  count: number;
  startStitch: number; // 1-indexed within row
  endStitch: number; // 1-indexed within row
}

export interface RowCellInOrder {
  col: number; // 0-indexed x in grid
  row: number; // 0-indexed y in grid
  stepNumber: number; // 1-indexed stitch step in reading order
  colorIndex: number;
  color: PaletteColor;
}

export interface RowInstruction {
  rowNumber: number; // 1-indexed crochet row
  totalStitches: number;
  direction: 'right_to_left' | 'left_to_right' | 'diagonal_up_right' | 'diagonal_down_left';
  directionLabel: string;
  startingCorner: string;
  sideLabel: 'Right Side' | 'Wrong Side' | 'Front';
  runs: StitchRun[];
  cells: RowCellInOrder[];
}

export interface ColorUsageStat {
  colorIndex: number;
  color: PaletteColor;
  stitchCount: number;
  percentage: number;
  estimatedMeters: number;
}
