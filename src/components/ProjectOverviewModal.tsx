import React from 'react';
import { Download, FileText, Play, X } from 'lucide-react';
import { PatternProject } from '../types/pattern';
import {
  calculateDimensions,
  computeColorUsage,
  CROCHET_METHOD_SPECS,
  getTotalRowsForProject,
  YARN_WEIGHT_SPECS,
} from '../utils/crochetMath';
import { exportPatternAsPdf, exportPatternAsPng } from '../utils/exporter';
import { PatternThumbnail } from './PatternThumbnail';

interface ProjectOverviewModalProps {
  project: PatternProject | null;
  onClose: () => void;
  onStartWorking: () => void;
  onOpenDesigner: () => void;
}

export const ProjectOverviewModal: React.FC<ProjectOverviewModalProps> = ({
  project,
  onClose,
  onStartWorking,
  onOpenDesigner,
}) => {
  if (!project) return null;

  const usage = computeColorUsage(project).filter((u) => u.stitchCount > 0);
  const totalStitches = project.width * project.height;
  const totalRows = getTotalRowsForProject(project);
  const dims = calculateDimensions(
    project.width,
    project.height,
    project.settings.stitchGaugePer10Cm,
    project.settings.rowGaugePer10Cm
  );
  const methodSpec = CROCHET_METHOD_SPECS[project.settings.method];
  const weightSpec = YARN_WEIGHT_SPECS[project.settings.yarnWeight];

  const dirLabel =
    project.settings.workingDirection === 'alternating'
      ? 'Alternating rows'
      : project.settings.workingDirection === 'right_to_left'
        ? 'Always Right to Left'
        : 'Always Left to Right';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-xs">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-[#E6E0D4] bg-[#FAF7F2] shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-[#E6E0D4] bg-white px-6 py-4">
          <div>
            <h2 className="font-display text-xl font-bold text-[#1E1D20]">{project.name}</h2>
            <p className="mt-0.5 text-xs text-[#615B69]">
              Project Overview · {project.width} × {project.height} stitches · {totalRows} rows ·{' '}
              {usage.length} colours
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E6E0D4] bg-[#FAF7F2] text-[#524D59] hover:bg-[#EFE9DD]"
            aria-label="Close overview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-12">
          {/* Left: Visual previews */}
          <div className="space-y-4 lg:col-span-5">
            <div className="overflow-hidden rounded-xl border border-[#E6E0D4] bg-white p-3">
              <div className="mb-2 text-xs font-semibold text-[#524D59]">Pattern Grid Preview</div>
              <div className="aspect-square w-full overflow-hidden rounded-lg bg-[#F3EFE7]">
                <PatternThumbnail project={project} />
              </div>
            </div>

            {project.sourceImageDataUrl && (
              <div className="overflow-hidden rounded-xl border border-[#E6E0D4] bg-white p-3">
                <div className="mb-2 text-xs font-semibold text-[#524D59]">Source Photograph</div>
                <img
                  src={project.sourceImageDataUrl}
                  alt={`Original photo for ${project.name}`}
                  className="h-40 w-full rounded-lg object-contain bg-[#F3EFE7]"
                />
              </div>
            )}
          </div>

          {/* Right: Specs + Yarn Legend */}
          <div className="space-y-5 lg:col-span-7">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[#E6E0D4] bg-white p-3">
                <div className="text-[11px] text-[#615B69]">Total Stitches</div>
                <div className="mt-1 font-mono text-lg font-bold tabular-nums text-[#1E1D20]">
                  {totalStitches.toLocaleString()}
                </div>
              </div>
              <div className="rounded-xl border border-[#E6E0D4] bg-white p-3">
                <div className="text-[11px] text-[#615B69]">Total Rows</div>
                <div className="mt-1 font-mono text-lg font-bold tabular-nums text-[#1E1D20]">
                  {totalRows}
                </div>
              </div>
              <div className="rounded-xl border border-[#E6E0D4] bg-white p-3">
                <div className="text-[11px] text-[#615B69]">Finished Size</div>
                <div className="mt-1 font-mono text-sm font-bold tabular-nums text-[#1E1D20]">
                  {dims.widthCm.toFixed(1)} × {dims.heightCm.toFixed(1)} cm
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#E6E0D4] bg-white p-4">
              <h3 className="text-xs font-semibold text-[#3C3844]">Crochet Specifications</h3>
              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
                <div className="flex justify-between border-b border-[#F3EFE7] pb-1.5">
                  <dt className="text-[#615B69]">Method</dt>
                  <dd className="font-medium text-[#1E1D20]">{methodSpec?.shortLabel}</dd>
                </div>
                <div className="flex justify-between border-b border-[#F3EFE7] pb-1.5">
                  <dt className="text-[#615B69]">Working Direction</dt>
                  <dd className="font-medium text-[#1E1D20]">{dirLabel}</dd>
                </div>
                <div className="flex justify-between border-b border-[#F3EFE7] pb-1.5">
                  <dt className="text-[#615B69]">Handedness</dt>
                  <dd className="font-medium text-[#1E1D20]">
                    {project.settings.handedness === 'right' ? 'Right-handed' : 'Left-handed'}
                  </dd>
                </div>
                <div className="flex justify-between border-b border-[#F3EFE7] pb-1.5">
                  <dt className="text-[#615B69]">Hook Size</dt>
                  <dd className="font-mono font-medium tabular-nums text-[#1E1D20]">
                    {project.settings.hookSizeMm} mm
                  </dd>
                </div>
                <div className="flex justify-between border-b border-[#F3EFE7] pb-1.5">
                  <dt className="text-[#615B69]">Yarn Weight</dt>
                  <dd className="font-medium text-[#1E1D20]">{weightSpec?.label}</dd>
                </div>
                <div className="flex justify-between border-b border-[#F3EFE7] pb-1.5">
                  <dt className="text-[#615B69]">Gauge (10 cm)</dt>
                  <dd className="font-mono font-medium tabular-nums text-[#1E1D20]">
                    {project.settings.stitchGaugePer10Cm} sts × {project.settings.rowGaugePer10Cm} rows
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border border-[#E6E0D4] bg-white p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[#3C3844]">
                  Colour Legend & Yarn Estimates ({usage.length} colours)
                </h3>
              </div>
              <div className="mt-3 max-h-48 overflow-y-auto divide-y divide-[#F3EFE7]">
                {usage.map((u) => (
                  <div key={u.color.id + u.colorIndex} className="flex items-center justify-between py-2 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="h-5 w-5 shrink-0 rounded-md border border-black/15"
                        style={{ backgroundColor: u.color.hex }}
                      />
                      <span className="truncate font-medium text-[#1E1D20]">{u.color.name}</span>
                      <span className="font-mono text-[11px] text-[#7A7483]">{u.color.hex}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums text-[#3C3844]">
                      <span>{u.stitchCount} sts</span>
                      <span className="text-[#7A7483]">~{u.estimatedMeters.toFixed(1)}m</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E6E0D4] bg-white px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => exportPatternAsPng(project, true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6E0D4] bg-[#FAF7F2] px-3.5 py-2 text-xs font-semibold text-[#3C3844] hover:bg-[#EFE9DD] min-h-[42px]"
            >
              <Download className="h-3.5 w-3.5" />
              High-Res PNG
            </button>
            <button
              type="button"
              onClick={() => exportPatternAsPdf(project)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6E0D4] bg-[#FAF7F2] px-3.5 py-2 text-xs font-semibold text-[#3C3844] hover:bg-[#EFE9DD] min-h-[42px]"
            >
              <FileText className="h-3.5 w-3.5" />
              Export PDF
            </button>
            <button
              type="button"
              onClick={onOpenDesigner}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6E0D4] bg-white px-3.5 py-2 text-xs font-semibold text-[#3C3844] hover:bg-[#F3EFE7] min-h-[42px]"
            >
              Edit in Designer
            </button>
          </div>

          <button
            type="button"
            onClick={onStartWorking}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1F2024] px-6 py-3 text-sm font-semibold text-[#F5C451] shadow-sm transition-colors hover:bg-[#2E3036] min-h-[46px]"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Start Working</span>
          </button>
        </div>
      </div>
    </div>
  );
};
