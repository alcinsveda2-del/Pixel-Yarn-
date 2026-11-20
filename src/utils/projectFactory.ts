import {
  CraftType,
  CrochetCategory,
  CrochetMethod,
  Handedness,
  PaletteColor,
  PatternProject,
  YarnWeight,
} from '../types/pattern';
import { getDefaultCrochetSettings } from './crochetMath';

export function createId(prefix = 'py'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export const DEFAULT_STARTER_PALETTE: PaletteColor[] = [
  { id: 'sp-cream', hex: '#FAF5E8', name: 'Natural Cream', brand: 'CottonCraft', yarnName: 'Soft Cotton DK' },
  { id: 'sp-lav', hex: '#B9A6D0', name: 'Soft Lavender', brand: 'Loom & Fiber', yarnName: 'Merino Blend' },
  { id: 'sp-plum', hex: '#7C6A9A', name: 'Muted Purple', brand: 'Loom & Fiber', yarnName: 'Merino Blend' },
  { id: 'sp-gold', hex: '#F5C451', name: 'Golden Yellow', brand: 'CottonCraft', yarnName: 'Soft Cotton DK' },
  { id: 'sp-sage', hex: '#638C72', name: 'Eucalyptus', brand: 'Loom & Fiber', yarnName: 'Merino Blend' },
  { id: 'sp-charcoal', hex: '#282A30', name: 'Deep Charcoal', brand: 'StudioYarn', yarnName: 'Worsted Everyday' },
];

export function mapCategoryToDefaultMethod(category: CrochetCategory): CrochetMethod {
  switch (category) {
    case 'tunisian':
      return 'tunisian_simple';
    case 'c2c':
      return 'c2c';
    case 'mosaic':
      return 'mosaic';
    default:
      return 'single_crochet';
  }
}

export function createBlankProject(params: {
  name: string;
  craftType?: CraftType;
  crochetCategory?: CrochetCategory;
  method?: CrochetMethod;
  yarnWeight?: YarnWeight;
  handedness?: Handedness;
  width?: number;
  height?: number;
  palette?: PaletteColor[];
}): PatternProject {
  const width = Math.max(4, Math.min(200, params.width ?? 36));
  const height = Math.max(4, Math.min(200, params.height ?? 36));
  const category = params.crochetCategory ?? 'standard';
  const method = params.method ?? mapCategoryToDefaultMethod(category);
  const now = Date.now();

  return {
    id: createId('proj'),
    name: params.name.trim() || 'Untitled Crochet Pattern',
    craftType: params.craftType ?? 'crochet',
    crochetCategory: category,
    createdAt: now,
    updatedAt: now,
    width,
    height,
    grid: new Array<number>(width * height).fill(0),
    palette: (params.palette ?? DEFAULT_STARTER_PALETTE).map((c) => ({ ...c })),
    settings: getDefaultCrochetSettings(
      method,
      params.yarnWeight ?? 'worsted',
      params.handedness ?? 'right'
    ),
    progress: {
      currentRow: 1,
      completedRows: [],
      rowCounters: {},
    },
    savedAsPattern: false,
  };
}

// Builds a genuine, symmetric 24x24 crochet heart/tulip sampler grid when the user explicitly requests a starter motif
export function createGuidedMotifProject(
  motif: 'heart' | 'tulip',
  handedness: Handedness = 'right'
): PatternProject {
  const w = 24;
  const h = 24;
  const grid = new Array<number>(w * h).fill(0);

  if (motif === 'heart') {
    const art = [
      '........................',
      '........................',
      '....PPPP........PPPP....',
      '...PLLLLP......PLLLLP...',
      '..PLLLLLLP....PLLLLLLP..',
      '..PLGGGGGLP..PLLLLLLLP..',
      '.PLGGGGGGGLPPLLLLLLLLLP.',
      '.PLGGGGGGGGLLLLLLLLLLLP.',
      '.PLGGGGGGGGLLLLLLLLLLLP.',
      '.PLGGGGGGGLLLLLLLLLLLLP.',
      '..PLGGGGGLLLLLLLLLLLLP..',
      '..PLLLLLLLLLLLLLLLLLLP..',
      '...PLLLLLLLLLLLLLLLLP...',
      '....PLLLLLLLLLLLLLLP....',
      '.....PLLLLLLLLLLLLP.....',
      '......PLLLLLLLLLLP......',
      '.......PLLLLLLLLP.......',
      '........PLLLLLLP........',
      '.........PLLLLP.........',
      '..........PLLP..........',
      '...........PP...........',
      '........................',
      '........................',
      '........................',
    ];
    const map: Record<string, number> = { '.': 0, L: 1, P: 2, G: 3 };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        grid[y * w + x] = map[art[y][x]] ?? 0;
      }
    }
    return {
      ...createBlankProject({
        name: 'Lavender Heart Tapestry',
        width: w,
        height: h,
        handedness,
      }),
      grid,
      savedAsPattern: true,
    };
  }

  // Geometric Tulip motif
  const art = [
    '........................',
    '........................',
    '.......P........P.......',
    '......PGP......PGP......',
    '......PGGP....PGGP......',
    '.....PGGGGPPPPGGGGP.....',
    '.....PGGGGGGGGGGGGP.....',
    '.....PGGGGGLLGGGGGP.....',
    '.....PGGGGLLLLGGGGP.....',
    '......PGGGLLLLGGGP......',
    '.......PGGGGGGGGP.......',
    '........PPPPPPPP........',
    '...........SS...........',
    '...........SS...........',
    '.....SSS...SS...SSS.....',
    '....SSSSS..SS..SSSSS....',
    '.....SSSSS.SS.SSSSS.....',
    '......SSSSSSSSSSSS......',
    '........SSSSSSSS........',
    '...........SS...........',
    '...........SS...........',
    '...........SS...........',
    '........................',
    '........................',
  ];
  const map: Record<string, number> = { '.': 0, L: 1, P: 2, G: 3, S: 4 };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      grid[y * w + x] = map[art[y][x]] ?? 0;
    }
  }
  return {
    ...createBlankProject({
      name: 'Marigold Tulip Cushion Panel',
      width: w,
      height: h,
      handedness,
    }),
    grid,
    savedAsPattern: true,
  };
}

export function duplicateProjectRecord(source: PatternProject): PatternProject {
  const now = Date.now();
  return {
    ...JSON.parse(JSON.stringify(source)),
    id: createId('proj'),
    name: `${source.name} (Copy)`,
    createdAt: now,
    updatedAt: now,
    progress: {
      currentRow: 1,
      completedRows: [],
      rowCounters: {},
    },
  };
}
