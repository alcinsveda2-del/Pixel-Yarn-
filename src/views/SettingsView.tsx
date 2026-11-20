import React, { useState } from 'react';
import {
  AlertTriangle,
  Download,
  FileText,
  Ruler,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  CrochetMethod,
  Handedness,
  PatternProject,
  WorkingDirection,
  YarnWeight,
} from '../types/pattern';
import {
  CROCHET_METHOD_SPECS,
  YARN_WEIGHT_SPECS,
  calculateDimensions,
  getRecommendedGauge,
  getTotalRowsForProject,
  resizeProjectGrid,
} from '../utils/crochetMath';
import { exportPatternAsPdf, exportPatternAsPng } from '../utils/exporter';
import { AppPreferences } from '../services/storage';

interface SettingsViewProps {
  project: PatternProject | null;
  allProjects: PatternProject[];
  preferences: AppPreferences;
  onUpdateProject: (updated: PatternProject) => void;
  onUpdatePreferences: (prefs: AppPreferences) => void;
  onImportProjectsBackup: (imported: PatternProject[]) => void;
  onClearAllData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  project,
  allProjects,
  preferences,
  onUpdateProject,
  onUpdatePreferences,
  onImportProjectsBackup,
  onClearAllData,
}) => {
  const [pdfOpts, setPdfOpts] = useState({
    includeGrid: true,
    includeLegend: true,
    includeSettings: true,
    includeInstructions: true,
  });
  const [confirmClear, setConfirmClear] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const notify = (msg: string) => {
    setStatusMsg(msg);
    window.setTimeout(() => setStatusMsg(null), 3500);
  };

  const updateProjectSettings = (patch: Partial<PatternProject['settings']>) => {
    if (!project) return;
    onUpdateProject({
      ...project,
      settings: {
        ...project.settings,
        ...patch,
      },
      updatedAt: Date.now(),
    });
  };

  const handleMethodOrWeightChange = (
    nextMethod: CrochetMethod,
    nextWeight: YarnWeight,
    syncGauge: boolean
  ) => {
    if (!project) return;
    const rec = getRecommendedGauge(nextMethod, nextWeight);
    const nextCategory = CROCHET_METHOD_SPECS[nextMethod]?.category ?? project.crochetCategory;
    onUpdateProject({
      ...project,
      crochetCategory: nextCategory,
      settings: {
        ...project.settings,
        method: nextMethod,
        yarnWeight: nextWeight,
        ...(syncGauge
          ? {
              stitchGaugePer10Cm: rec.stitchGaugePer10Cm,
              rowGaugePer10Cm: rec.rowGaugePer10Cm,
              hookSizeMm: rec.hookSizeMm,
            }
          : {}),
      },
      updatedAt: Date.now(),
    });
  };

  const handleDimensionsChange = (nextW: number, nextH: number) => {
    if (!project) return;
    const w = Math.max(4, Math.min(200, nextW || 4));
    const h = Math.max(4, Math.min(200, nextH || 4));
    const nextGrid = resizeProjectGrid(project.grid, project.width, project.height, w, h, 0);
    onUpdateProject({
      ...project,
      width: w,
      height: h,
      grid: nextGrid,
      progress: {
        ...project.progress,
        currentRow: Math.min(project.progress.currentRow, h),
        completedRows: project.progress.completedRows.filter((r) => r <= h),
      },
      updatedAt: Date.now(),
    });
  };

  const handleExportBackupJson = () => {
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), projects: allProjects }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pixelyarn-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Downloaded full JSON backup of your local projects.');
  };

  const handleImportBackupJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const list = Array.isArray(parsed) ? parsed : parsed.projects;
        if (!Array.isArray(list)) throw new Error('Invalid backup format');
        onImportProjectsBackup(list as PatternProject[]);
        notify(`Imported ${list.length} project(s) from backup.`);
      } catch {
        notify('Could not read backup file. Please choose a valid PixelYarn JSON export.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const dims = project
    ? calculateDimensions(
        project.width,
        project.height,
        project.settings.stitchGaugePer10Cm,
        project.settings.rowGaugePer10Cm
      )
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E6E0D4] pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#1E1D20]">
            Crochet Settings, Gauge & Exports
          </h1>
          <p className="mt-0.5 text-xs text-[#615B69]">
            Configure stitch method, handedness, yarn gauge, finished dimensions, and downloadable patterns.
          </p>
        </div>
        {statusMsg && (
          <div className="rounded-xl border border-[#D8D0E4] bg-[#EDE8F5] px-3.5 py-2 text-xs font-semibold text-[#4B3D63]">
            {statusMsg}
          </div>
        )}
      </div>

      {/* App-wide Handedness & Workspace Defaults */}
      <section className="rounded-2xl border border-[#E6E0D4] bg-white p-5 space-y-4">
        <h2 className="font-display text-lg font-bold text-[#1E1D20]">
          Studio Defaults & Handedness
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <span className="block text-xs font-semibold text-[#3C3844]">
              Default Handedness for New Projects
            </span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(['right', 'left'] as Handedness[]).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => onUpdatePreferences({ ...preferences, defaultHandedness: h })}
                  className={`rounded-xl border py-2.5 text-xs font-semibold min-h-[42px] ${
                    preferences.defaultHandedness === h
                      ? 'border-[#7C6A9A] bg-[#EDE8F5] text-[#4B3D63]'
                      : 'border-[#E6E0D4] bg-[#FAF7F2] text-[#524D59]'
                  }`}
                >
                  {h === 'right' ? 'Right-handed' : 'Left-handed'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-center space-y-2.5">
            <label className="flex items-center gap-2.5 text-xs font-medium text-[#1E1D20]">
              <input
                type="checkbox"
                checked={preferences.showGridLines}
                onChange={(e) =>
                  onUpdatePreferences({ ...preferences, showGridLines: e.target.checked })
                }
                className="h-4 w-4 accent-[#7C6A9A]"
              />
              <span>Show stitch gridlines in Designer by default</span>
            </label>
          </div>
        </div>
      </section>

      {project && dims && (
        <>
          {/* Active Project Crochet Settings & Gauge Calculator */}
          <section className="rounded-2xl border border-[#E6E0D4] bg-white p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F3EFE7] pb-3">
              <div>
                <h2 className="font-display text-lg font-bold text-[#1E1D20]">
                  Project Gauge & Stitch Settings · {project.name}
                </h2>
                <p className="text-xs text-[#615B69]">
                  Changing crochet method or yarn weight offers stitch-specific gauge presets; you can adjust any value manually.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleMethodOrWeightChange(project.settings.method, project.settings.yarnWeight, true)
                }
                className="rounded-xl border border-[#D8D0E4] bg-[#EDE8F5] px-3 py-2 text-xs font-semibold text-[#4B3D63] hover:bg-[#E1D8EE]"
              >
                Reset to Recommended Gauge
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-[#3C3844]">Crochet Method</label>
                <select
                  value={project.settings.method}
                  onChange={(e) =>
                    handleMethodOrWeightChange(
                      e.target.value as CrochetMethod,
                      project.settings.yarnWeight,
                      true
                    )
                  }
                  className="mt-1.5 w-full rounded-xl border border-[#DED7C8] bg-[#FAF7F2] px-3 py-2.5 text-xs"
                >
                  {(Object.keys(CROCHET_METHOD_SPECS) as CrochetMethod[]).map((m) => (
                    <option key={m} value={m}>
                      {CROCHET_METHOD_SPECS[m].label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3C3844]">Working Direction</label>
                <select
                  value={project.settings.workingDirection}
                  onChange={(e) =>
                    updateProjectSettings({
                      workingDirection: e.target.value as WorkingDirection,
                    })
                  }
                  className="mt-1.5 w-full rounded-xl border border-[#DED7C8] bg-[#FAF7F2] px-3 py-2.5 text-xs"
                >
                  <option value="alternating">Alternating (Back & Forth)</option>
                  <option value="right_to_left">Always Right to Left</option>
                  <option value="left_to_right">Always Left to Right</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3C3844]">Project Handedness</label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {(['right', 'left'] as Handedness[]).map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => updateProjectSettings({ handedness: h })}
                      className={`rounded-xl border py-2 text-xs font-semibold min-h-[40px] ${
                        project.settings.handedness === h
                          ? 'border-[#7C6A9A] bg-[#EDE8F5] text-[#4B3D63]'
                          : 'border-[#DED7C8] bg-[#FAF7F2] text-[#524D59]'
                      }`}
                    >
                      {h === 'right' ? 'Right' : 'Left'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3C3844]">Yarn Weight</label>
                <select
                  value={project.settings.yarnWeight}
                  onChange={(e) =>
                    handleMethodOrWeightChange(
                      project.settings.method,
                      e.target.value as YarnWeight,
                      true
                    )
                  }
                  className="mt-1.5 w-full rounded-xl border border-[#DED7C8] bg-[#FAF7F2] px-3 py-2.5 text-xs"
                >
                  {Object.values(YARN_WEIGHT_SPECS).map((yw) => (
                    <option key={yw.id} value={yw.id}>
                      {yw.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3C3844]">
                  Crochet Hook Size (mm)
                </label>
                <input
                  type="number"
                  step={0.25}
                  min={0.5}
                  max={25}
                  value={project.settings.hookSizeMm}
                  onChange={(e) =>
                    updateProjectSettings({ hookSizeMm: Number(e.target.value) || 4 })
                  }
                  className="mt-1.5 w-full rounded-xl border border-[#DED7C8] bg-[#FAF7F2] px-3 py-2 font-mono text-xs tabular-nums"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-[#3C3844]">Yarn Brand</label>
                  <input
                    type="text"
                    value={project.settings.yarnBrand}
                    onChange={(e) => updateProjectSettings({ yarnBrand: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-[#DED7C8] bg-[#FAF7F2] px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3C3844]">Yarn Name</label>
                  <input
                    type="text"
                    value={project.settings.yarnName}
                    onChange={(e) => updateProjectSettings({ yarnName: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-[#DED7C8] bg-[#FAF7F2] px-3 py-2 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Gauge & Dimensions Live Calculator */}
            <div className="rounded-2xl border border-[#E6E0D4] bg-[#FAF7F2] p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#1E1D20]">
                <Ruler className="h-4 w-4 text-[#7C6A9A]" />
                <span>Gauge & Finished Dimension Calculator</span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="block text-[11px] font-medium text-[#524D59]">
                    Stitches / 10 cm
                  </label>
                  <input
                    type="number"
                    step={0.5}
                    min={1}
                    max={100}
                    value={project.settings.stitchGaugePer10Cm}
                    onChange={(e) =>
                      updateProjectSettings({
                        stitchGaugePer10Cm: Math.max(0.5, Number(e.target.value) || 1),
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-[#DED7C8] bg-white px-3 py-2 font-mono text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#524D59]">
                    Rows / 10 cm
                  </label>
                  <input
                    type="number"
                    step={0.5}
                    min={1}
                    max={100}
                    value={project.settings.rowGaugePer10Cm}
                    onChange={(e) =>
                      updateProjectSettings({
                        rowGaugePer10Cm: Math.max(0.5, Number(e.target.value) || 1),
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-[#DED7C8] bg-white px-3 py-2 font-mono text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#524D59]">
                    Number of Stitches
                  </label>
                  <input
                    type="number"
                    min={4}
                    max={200}
                    value={project.width}
                    onChange={(e) => handleDimensionsChange(Number(e.target.value), project.height)}
                    className="mt-1 w-full rounded-xl border border-[#DED7C8] bg-white px-3 py-2 font-mono text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#524D59]">
                    Number of Rows
                  </label>
                  <input
                    type="number"
                    min={4}
                    max={200}
                    value={project.height}
                    onChange={(e) => handleDimensionsChange(project.width, Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-[#DED7C8] bg-white px-3 py-2 font-mono text-sm tabular-nums"
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 border-t border-[#E6E0D4] pt-3 sm:grid-cols-3">
                <div className="rounded-xl bg-white p-3 border border-[#E6E0D4]">
                  <div className="text-[11px] text-[#615B69]">Finished Width</div>
                  <div className="mt-0.5 font-mono text-base font-bold tabular-nums text-[#1E1D20]">
                    {dims.widthCm.toFixed(1)} cm{' '}
                    <span className="text-xs font-normal text-[#615B69]">
                      ({dims.widthIn.toFixed(1)} in)
                    </span>
                  </div>
                </div>
                <div className="rounded-xl bg-white p-3 border border-[#E6E0D4]">
                  <div className="text-[11px] text-[#615B69]">Finished Height</div>
                  <div className="mt-0.5 font-mono text-base font-bold tabular-nums text-[#1E1D20]">
                    {dims.heightCm.toFixed(1)} cm{' '}
                    <span className="text-xs font-normal text-[#615B69]">
                      ({dims.heightIn.toFixed(1)} in)
                    </span>
                  </div>
                </div>
                <div className="rounded-xl bg-white p-3 border border-[#E6E0D4]">
                  <div className="text-[11px] text-[#615B69]">Pattern Totals</div>
                  <div className="mt-0.5 font-mono text-sm font-bold tabular-nums text-[#1E1D20]">
                    {(project.width * project.height).toLocaleString()} sts ·{' '}
                    {getTotalRowsForProject(project)} rows
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Export Center */}
          <section className="rounded-2xl border border-[#E6E0D4] bg-white p-5 space-y-4">
            <h2 className="font-display text-lg font-bold text-[#1E1D20]">
              Pattern Export & Downloads
            </h2>
            <p className="text-xs text-[#615B69]">
              Generated locally on your device — works completely offline.
            </p>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {(
                [
                  ['includeGrid', 'Printable Grid'],
                  ['includeLegend', 'Colour-Count Table'],
                  ['includeSettings', 'Project Settings'],
                  ['includeInstructions', 'Row Instructions'],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-2 rounded-xl border border-[#E6E0D4] bg-[#FAF7F2] px-3 py-2.5 text-xs font-medium text-[#1E1D20]"
                >
                  <input
                    type="checkbox"
                    checked={pdfOpts[key]}
                    onChange={(e) =>
                      setPdfOpts((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                    className="h-4 w-4 accent-[#7C6A9A]"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => exportPatternAsPng(project, false)}
                className="inline-flex items-center gap-2 rounded-xl border border-[#DED7C8] bg-[#FAF7F2] px-4 py-2.5 text-xs font-semibold text-[#1E1D20] hover:bg-[#EFE9DD] min-h-[44px]"
              >
                <Download className="h-4 w-4 text-[#7C6A9A]" />
                <span>PNG Pattern Image</span>
              </button>
              <button
                type="button"
                onClick={() => exportPatternAsPng(project, true)}
                className="inline-flex items-center gap-2 rounded-xl border border-[#DED7C8] bg-[#FAF7F2] px-4 py-2.5 text-xs font-semibold text-[#1E1D20] hover:bg-[#EFE9DD] min-h-[44px]"
              >
                <Download className="h-4 w-4 text-[#7C6A9A]" />
                <span>High-Resolution PNG (with Legend)</span>
              </button>
              <button
                type="button"
                onClick={() => exportPatternAsPdf(project, pdfOpts)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#7C6A9A] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#6A5888] min-h-[44px]"
              >
                <FileText className="h-4 w-4" />
                <span>Download PDF Pattern</span>
              </button>
            </div>
          </section>
        </>
      )}

      {/* Local Storage Backup & Safety */}
      <section className="rounded-2xl border border-[#E6E0D4] bg-white p-5 space-y-4">
        <h2 className="font-display text-lg font-bold text-[#1E1D20]">
          Offline Storage & Backups
        </h2>
        <p className="text-xs leading-relaxed text-[#524D59]">
          All projects, yarn palettes, and row counters are stored privately in your browser’s IndexedDB storage. Export a JSON backup before clearing browser site data.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportBackupJson}
            className="inline-flex items-center gap-2 rounded-xl border border-[#DED7C8] bg-[#FAF7F2] px-4 py-2.5 text-xs font-semibold text-[#1E1D20] hover:bg-[#EFE9DD] min-h-[42px]"
          >
            <Download className="h-4 w-4 text-[#7C6A9A]" />
            <span>Export JSON Backup ({allProjects.length} projects)</span>
          </button>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#DED7C8] bg-white px-4 py-2.5 text-xs font-semibold text-[#1E1D20] hover:bg-[#F3EFE7] min-h-[42px]">
            <Upload className="h-4 w-4 text-[#7C6A9A]" />
            <span>Restore Backup JSON</span>
            <input
              type="file"
              accept="application/json"
              onChange={handleImportBackupJson}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-[#B91C1C] hover:bg-red-100 min-h-[42px]"
          >
            <Trash2 className="h-4 w-4" />
            <span>Clear Local Browser Data</span>
          </button>
        </div>
      </section>

      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#E6E0D4] bg-[#FAF7F2] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-[#B91C1C]">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="font-display text-lg font-bold text-[#1E1D20]">
                Clear All Local Projects?
              </h3>
            </div>
            <p className="text-xs leading-relaxed text-[#524D59]">
              Warning: Clearing browser data will permanently delete all {allProjects.length} local projects, custom palettes, and saved row progress on this device. Export a JSON backup first if you want to keep them.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="rounded-xl border border-[#E6E0D4] bg-white px-4 py-2 text-xs font-semibold text-[#3C3844]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearAllData();
                  setConfirmClear(false);
                }}
                className="rounded-xl bg-[#B91C1C] px-4 py-2 text-xs font-semibold text-white"
              >
                Delete All Local Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
