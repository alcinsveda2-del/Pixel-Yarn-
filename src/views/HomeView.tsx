import React, { useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Camera,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Grid3X3,
  Layers,
  Play,
  Plus,
  Sparkles,
} from 'lucide-react';
import {
  AppSection,
  CraftType,
  CrochetCategory,
  PatternProject,
} from '../types/pattern';
import { CROCHET_METHOD_SPECS, getTotalRowsForProject } from '../utils/crochetMath';
import { PatternThumbnail } from '../components/PatternThumbnail';

interface HomeViewProps {
  projects: PatternProject[];
  activeProject: PatternProject | null;
  onNavigate: (section: AppSection) => void;
  onOpenNewProject: (craftType?: CraftType, category?: CrochetCategory) => void;
  onSelectProject: (id: string) => void;
  onOpenOverview: (id: string) => void;
  onStartWorking: (id: string) => void;
  onCreateGuidedMotif: (motif: 'heart' | 'tulip') => void;
}

const TUTORIALS = [
  {
    id: 'tut-1',
    title: 'Reading Tapestry Crochet Rows & Alternating Direction',
    summary:
      'Row 1 always starts at the bottom edge of your chart. For right-handed crocheters, odd rows read right-to-left and even rows read left-to-right.',
    steps: [
      'When turning your work at the end of a row, carry unused yarn strands neatly inside the back of your stitches.',
      'Change yarn colour on the final yarn-over of the stitch right before the colour change so the next stitch sits cleanly.',
      'Use Working Mode to isolate only your active row and keep an independent stitch counter per row.',
    ],
  },
  {
    id: 'tut-2',
    title: 'Getting Accurate Photo-to-Pixel Conversions',
    summary:
      'High-contrast subjects with clean backgrounds produce the clearest crochet pixel blankets and wall hangings.',
    steps: [
      'Crop tightly around your subject in Photo Studio so every stitch counts toward recognizable detail.',
      'Use Clean and Calm (8 colours, zero dithering) for graphic logos, or Smart Conversion (12 colours) for portraits.',
      'Enable Background Removal to replace cluttered photo backdrops with a single solid base yarn colour.',
    ],
  },
  {
    id: 'tut-3',
    title: 'Understanding Gauge & Finished Dimensions',
    summary:
      'Different crochet stitches produce different stitch-to-row proportions. Always crochet a 10 × 10 cm gauge swatch before large blankets.',
    steps: [
      'Single crochet is nearly square (16 sts × 18 rows per 10 cm in worsted weight).',
      'Double crochet is much taller per row (13 sts × 7.5 rows per 10 cm), which stretches vertical aspect ratios unless adjusted.',
      'PixelYarn automatically calculates finished width = (stitches / stitch gauge) × 10 cm and height = (rows / row gauge) × 10 cm.',
    ],
  },
  {
    id: 'tut-4',
    title: 'Standard vs. Tunisian, C2C, and Mosaic Crochet',
    summary:
      'Choose the crochet construction method that fits your fabric drape and colour-change style.',
    steps: [
      'Standard Crochet: Versatile sc/hdc/dc tapestry or intarsia.',
      'Tunisian Simple Stitch: Worked across the front every row (no turning), creating crisp square pixel blocks.',
      'Corner-to-Corner (C2C): Worked diagonally in 3-dc tiles starting from the bottom corner.',
      'Overlay Mosaic: Worked front-side only with one colour per row and dropped dc stitches for geometric relief.',
    ],
  },
];

export const HomeView: React.FC<HomeViewProps> = ({
  projects,
  activeProject,
  onNavigate,
  onOpenNewProject,
  onSelectProject,
  onOpenOverview,
  onStartWorking,
  onCreateGuidedMotif,
}) => {
  const [openTutorialId, setOpenTutorialId] = useState<string>('tut-1');
  const [heroImgError, setHeroImgError] = useState(false);
  const [swatchImgError, setSwatchImgError] = useState(false);

  const recentProjects = projects.slice(0, 4);
  const savedPatterns = projects.filter((p) => p.savedAsPattern).slice(0, 4);

  const continueTarget =
    projects.find((p) => {
      const total = getTotalRowsForProject(p);
      return p.progress.completedRows.length < total;
    }) ?? activeProject;

  const getProgressStats = (p: PatternProject) => {
    const total = getTotalRowsForProject(p);
    const done = p.progress.completedRows.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, pct };
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-10">
      {/* Hero Split */}
      <section className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
        <div className="flex flex-col justify-between rounded-2xl border border-[#E6E0D4] bg-white p-6 sm:p-8 lg:col-span-7">
          <div>
            <p className="text-xs font-semibold text-[#7C6A9A]">
              PixelYarn Studio · Free Offline Pattern Companion
            </p>
            <h1 className="mt-2 max-w-xl font-display text-3xl font-bold tracking-tight text-[#1E1D20] sm:text-4xl [text-wrap:balance]">
              Turn photos and ideas into stitch-accurate crochet patterns
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#524D59]">
              Crop and quantize photographs locally on your device, refine every cell in the interactive pixel grid, calculate real stitch gauge, and crochet row by row with independent stitch counters.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onOpenNewProject('crochet', 'standard')}
              className="inline-flex items-center gap-2 rounded-xl bg-[#7C6A9A] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#6A5888] min-h-[44px]"
            >
              <Plus className="h-4 w-4" />
              <span>Create New Project</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('photo-studio')}
              className="inline-flex items-center gap-2 rounded-xl border border-[#DED7C8] bg-[#FAF7F2] px-4 py-3 text-sm font-semibold text-[#1E1D20] transition-colors hover:bg-[#EFE9DD] min-h-[44px]"
            >
              <Camera className="h-4 w-4 text-[#7C6A9A]" />
              <span>Import Photo</span>
            </button>

            {continueTarget && (
              <button
                type="button"
                onClick={() => onStartWorking(continueTarget.id)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1F2024] px-4 py-3 text-sm font-semibold text-[#F5C451] transition-colors hover:bg-[#2F3138] min-h-[44px]"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Continue Working</span>
              </button>
            )}
          </div>
        </div>

        <div className="relative min-h-[240px] overflow-hidden rounded-2xl border border-[#E6E0D4] bg-[#EFE9DD] lg:col-span-5">
          {!heroImgError ? (
            <img
              src="/src/assets/images/home_crochet_hero_1795156091600.jpg"
              alt="Cotton yarn skeins in lavender, cream, marigold, and charcoal beside a crochet hook and pixel tapestry swatch"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgError(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <Grid3X3 className="h-10 w-10 text-[#7C6A9A]" />
              <p className="mt-2 font-display text-lg font-semibold text-[#1E1D20]">PixelYarn Studio</p>
            </div>
          )}
          {continueTarget && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent p-5 text-white">
              <div className="text-[11px] font-medium text-[#F5C451]">Active Companion Project</div>
              <div className="mt-0.5 flex items-center justify-between gap-3">
                <div className="truncate font-display text-base font-bold">{continueTarget.name}</div>
                <span className="shrink-0 font-mono text-xs tabular-nums text-white/90">
                  Row {continueTarget.progress.currentRow} / {getTotalRowsForProject(continueTarget)}
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Craft Mediums & Crochet Methods */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-[#1E1D20]">Start by Craft or Method</h2>
            <p className="mt-0.5 text-xs text-[#615B69]">
              Every crochet style includes authentic stitch gauge defaults and row direction rules.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onCreateGuidedMotif('heart')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#D8D0E4] bg-[#EDE8F5] px-3 py-2 text-xs font-semibold text-[#4B3D63] hover:bg-[#E1D8EE] min-h-[40px]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Try 24×24 Heart Sampler</span>
            </button>
            <button
              type="button"
              onClick={() => onCreateGuidedMotif('tulip')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6E0D4] bg-white px-3 py-2 text-xs font-semibold text-[#3C3844] hover:bg-[#F3EFE7] min-h-[40px]"
            >
              <span>Try 24×24 Tulip Sampler</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              cat: 'standard' as CrochetCategory,
              title: 'Standard Crochet',
              detail: 'Single, Half Double & Double Crochet tapestry charts',
            },
            {
              cat: 'tunisian' as CrochetCategory,
              title: 'Tunisian Crochet',
              detail: 'Front-facing forward & return pixel stitch grids',
            },
            {
              cat: 'c2c' as CrochetCategory,
              title: 'Corner-to-Corner',
              detail: 'Diagonal tile-by-tile reading & block counts',
            },
            {
              cat: 'mosaic' as CrochetCategory,
              title: 'Mosaic Crochet',
              detail: 'Overlay front-side rows & colour change markers',
            },
          ].map((item) => (
            <button
              key={item.cat}
              type="button"
              onClick={() => onOpenNewProject('crochet', item.cat)}
              className="group flex flex-col justify-between rounded-2xl border border-[#E6E0D4] bg-white p-5 text-left transition-colors hover:border-[#7C6A9A] hover:bg-[#FAF8FD]"
            >
              <div>
                <div className="font-display text-base font-bold text-[#1E1D20] group-hover:text-[#5D4E7B]">
                  {item.title}
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-[#615B69]">{item.detail}</p>
              </div>
              <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#7C6A9A]">
                <span>Create Pattern</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </div>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#E6E0D4] bg-[#F3EFE7] px-4 py-3">
          <span className="text-xs font-semibold text-[#524D59] mr-2">Other Pixel Crafts:</span>
          {(
            [
              ['knitting', 'Knitting'],
              ['embroidery', 'Embroidery'],
              ['painting', 'Painting'],
              ['fuse_beads', 'Fuse Beads'],
              ['pixel_art', 'Pixel Art'],
              ['other', 'Other'],
            ] as Array<[CraftType, string]>
          ).map(([craft, label]) => (
            <button
              key={craft}
              type="button"
              onClick={() => onOpenNewProject(craft, 'standard')}
              className="rounded-lg border border-[#DED7C8] bg-white px-3 py-1.5 text-xs font-medium text-[#3C3844] transition-colors hover:border-[#7C6A9A] hover:text-[#4B3D63] min-h-[36px]"
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Recent Projects & Saved Patterns */}
      <section className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-[#1E1D20]">Recent Projects</h2>
            <button
              type="button"
              onClick={() => onNavigate('projects')}
              className="text-xs font-semibold text-[#7C6A9A] hover:underline min-h-[36px]"
            >
              View All Projects ({projects.length})
            </button>
          </div>

          {recentProjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#D6CFC0] bg-white p-8 text-center">
              <FolderOpen className="mx-auto h-8 w-8 text-[#7C6A9A]" />
              <h3 className="mt-3 font-display text-base font-bold text-[#1E1D20]">
                No patterns created yet
              </h3>
              <p className="mx-auto mt-1 max-w-sm text-xs text-[#615B69]">
                Upload a photo in Photo Studio, create a blank stitch grid, or load one of the 24×24 sampler motifs above to begin.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('photo-studio')}
                  className="rounded-xl bg-[#7C6A9A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#6A5888] min-h-[40px]"
                >
                  Open Photo Studio
                </button>
                <button
                  type="button"
                  onClick={() => onOpenNewProject('crochet', 'standard')}
                  className="rounded-xl border border-[#E6E0D4] bg-[#FAF7F2] px-4 py-2 text-xs font-semibold text-[#1E1D20] hover:bg-[#EFE9DD] min-h-[40px]"
                >
                  New Blank Grid
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {recentProjects.map((proj) => {
                const stats = getProgressStats(proj);
                const methodLabel = CROCHET_METHOD_SPECS[proj.settings.method]?.shortLabel ?? 'Crochet';
                return (
                  <div
                    key={proj.id}
                    className="flex flex-col justify-between rounded-2xl border border-[#E6E0D4] bg-white p-4"
                  >
                    <div className="flex gap-3.5">
                      <button
                        type="button"
                        onClick={() => onSelectProject(proj.id)}
                        className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-[#E6E0D4] bg-[#F3EFE7]"
                      >
                        <PatternThumbnail project={proj} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => onSelectProject(proj.id)}
                          className="block w-full truncate text-left font-display text-sm font-bold text-[#1E1D20] hover:text-[#7C6A9A]"
                        >
                          {proj.name}
                        </button>
                        <div className="mt-1 text-xs text-[#615B69]">
                          {proj.width} × {proj.height} sts · {methodLabel}
                        </div>
                        <div className="mt-2.5">
                          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-[#524D59]">
                            <span>
                              {stats.done} / {stats.total} rows
                            </span>
                            <span>{stats.pct}%</span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#EFE9DD]">
                            <div
                              className="h-full rounded-full bg-[#7C6A9A]"
                              style={{ width: `${stats.pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#F3EFE7] pt-3">
                      <button
                        type="button"
                        onClick={() => onOpenOverview(proj.id)}
                        className="rounded-lg border border-[#E6E0D4] bg-[#FAF7F2] px-3 py-1.5 text-xs font-semibold text-[#3C3844] hover:bg-[#EFE9DD] min-h-[36px]"
                      >
                        Overview
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectProject(proj.id)}
                          className="rounded-lg border border-[#E6E0D4] bg-white px-3 py-1.5 text-xs font-semibold text-[#3C3844] hover:bg-[#F3EFE7] min-h-[36px]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onStartWorking(proj.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#1F2024] px-3 py-1.5 text-xs font-semibold text-[#F5C451] hover:bg-[#2F3138] min-h-[36px]"
                        >
                          <Play className="h-3 w-3 fill-current" />
                          <span>Work</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Saved Patterns */}
        <div className="space-y-4 lg:col-span-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-[#1E1D20]">Saved Patterns</h2>
            <button
              type="button"
              onClick={() => onNavigate('projects')}
              className="text-xs font-semibold text-[#7C6A9A] hover:underline min-h-[36px]"
            >
              Manage Library
            </button>
          </div>

          <div className="rounded-2xl border border-[#E6E0D4] bg-white divide-y divide-[#F3EFE7]">
            {savedPatterns.length === 0 ? (
              <div className="p-6 text-center">
                <Layers className="mx-auto h-7 w-7 text-[#9B8FB0]" />
                <p className="mt-2 text-xs text-[#615B69]">
                  Star or mark any finished pattern in Projects to keep it pinned in your Saved Patterns library.
                </p>
              </div>
            ) : (
              savedPatterns.map((pat) => (
                <div key={pat.id} className="flex items-center justify-between gap-3 p-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-[#E6E0D4] bg-[#F3EFE7]">
                      <PatternThumbnail project={pat} />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-[#1E1D20]">{pat.name}</div>
                      <div className="text-xs text-[#615B69]">
                        {pat.width} × {pat.height} · {pat.palette.length} colours
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenOverview(pat.id)}
                    className="shrink-0 rounded-lg border border-[#E6E0D4] bg-[#FAF7F2] px-3 py-1.5 text-xs font-semibold text-[#3C3844] hover:bg-[#EFE9DD] min-h-[36px]"
                  >
                    Open
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Crochet Tutorials & Help */}
      <section className="grid grid-cols-1 gap-6 rounded-2xl border border-[#E6E0D4] bg-white p-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#7C6A9A]">
            <BookOpen className="h-4 w-4" />
            <span>Crochet Tutorials & Help</span>
          </div>
          <h2 className="font-display text-xl font-bold text-[#1E1D20]">
            Studio Reference Guide
          </h2>
          <p className="text-xs leading-relaxed text-[#524D59]">
            Practical guidance for reading pixel charts, avoiding diagonal drift in tapestry crochet, and dialing in gauge before starting a blanket.
          </p>
          <div className="overflow-hidden rounded-xl border border-[#E6E0D4] bg-[#F3EFE7]">
            {!swatchImgError ? (
              <img
                src="/src/assets/images/tutorial_crochet_swatch_1795156091219.jpg"
                alt="Close-up of tapestry single crochet stitches in cream, plum, and marigold yarn"
                referrerPolicy="no-referrer"
                onError={() => setSwatchImgError(true)}
                className="aspect-[4/3] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center text-xs text-[#615B69]">
                Tapestry Crochet Stitch Reference
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2.5 lg:col-span-8">
          {TUTORIALS.map((tut) => {
            const isOpen = openTutorialId === tut.id;
            return (
              <div
                key={tut.id}
                className="rounded-xl border border-[#E6E0D4] bg-[#FAF7F2] transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setOpenTutorialId(isOpen ? '' : tut.id)}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left min-h-[48px]"
                >
                  <div>
                    <div className="text-sm font-semibold text-[#1E1D20]">{tut.title}</div>
                    <div className="mt-0.5 text-xs text-[#615B69]">{tut.summary}</div>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-[#7C6A9A]" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-[#7C6A9A]" />
                  )}
                </button>
                {isOpen && (
                  <ul className="space-y-2 border-t border-[#E6E0D4] bg-white px-4 py-3.5 text-xs leading-relaxed text-[#3C3844] rounded-b-xl">
                    {tut.steps.map((step, i) => (
                      <li key={i} className="flex gap-2.5">
                        <span className="font-mono font-semibold text-[#7C6A9A]">0{i + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
