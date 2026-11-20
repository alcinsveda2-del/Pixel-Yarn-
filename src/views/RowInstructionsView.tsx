import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  FileText,
  Play,
  Search,
} from 'lucide-react';
import { PatternProject } from '../types/pattern';
import { CROCHET_METHOD_SPECS } from '../utils/crochetMath';
import { exportPatternAsPdf } from '../utils/exporter';
import { generateAllRowInstructions } from '../utils/rowInstructions';

interface RowInstructionsViewProps {
  project: PatternProject | null;
  onStartWorkingAtRow: (rowNumber: number) => void;
  onToggleRowComplete: (rowNumber: number) => void;
}

export const RowInstructionsView: React.FC<RowInstructionsViewProps> = ({
  project,
  onStartWorkingAtRow,
  onToggleRowComplete,
}) => {
  const [jumpQuery, setJumpQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'remaining' | 'completed'>('all');

  const allInstructions = useMemo(
    () => (project ? generateAllRowInstructions(project) : []),
    [project]
  );

  if (!project) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-[#E6E0D4] bg-white p-10 text-center">
        <FileText className="mx-auto h-9 w-9 text-[#7C6A9A]" />
        <h2 className="mt-3 font-display text-xl font-bold text-[#1E1D20]">No Active Pattern</h2>
        <p className="mt-1 text-xs text-[#615B69]">
          Select or create a pattern to view automatically generated row-by-row instructions.
        </p>
      </div>
    );
  }

  const completedSet = new Set(project.progress.completedRows);
  const filtered = allInstructions.filter((inst) => {
    if (jumpQuery.trim() && String(inst.rowNumber) !== jumpQuery.trim()) {
      return false;
    }
    const isDone = completedSet.has(inst.rowNumber);
    if (filterMode === 'completed' && !isDone) return false;
    if (filterMode === 'remaining' && isDone) return false;
    return true;
  });

  const methodLabel = CROCHET_METHOD_SPECS[project.settings.method]?.label ?? 'Crochet';

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E6E0D4] pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#1E1D20]">
            Row Instructions · {project.name}
          </h1>
          <p className="mt-0.5 text-xs text-[#615B69]">
            {methodLabel} · {project.settings.handedness === 'right' ? 'Right-handed' : 'Left-handed'} ·{' '}
            {allInstructions[0]?.startingCorner}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportPatternAsPdf(project)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6E0D4] bg-white px-4 py-2.5 text-xs font-semibold text-[#1E1D20] hover:bg-[#F3EFE7] min-h-[42px]"
          >
            <FileText className="h-4 w-4 text-[#7C6A9A]" />
            <span>Export PDF</span>
          </button>
          <button
            type="button"
            onClick={() => onStartWorkingAtRow(project.progress.currentRow)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1F2024] px-4 py-2.5 text-xs font-semibold text-[#F5C451] hover:bg-[#2F3138] min-h-[42px]"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Start Working (Row {project.progress.currentRow})</span>
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E6E0D4] bg-white p-3.5">
        <div className="relative w-full sm:w-52">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#7A7483]" />
          <input
            type="number"
            min={1}
            max={allInstructions.length}
            value={jumpQuery}
            onChange={(e) => setJumpQuery(e.target.value)}
            placeholder="Filter row #..."
            className="w-full rounded-xl border border-[#DED7C8] bg-[#FAF7F2] py-2 pr-3 pl-9 font-mono text-xs tabular-nums"
          />
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-[#F3EFE7] p-1">
          {(
            [
              ['all', `All (${allInstructions.length})`],
              ['remaining', 'Remaining'],
              ['completed', `Completed (${completedSet.size})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilterMode(id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                filterMode === id ? 'bg-white text-[#1E1D20] shadow-xs' : 'text-[#615B69]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Instruction List */}
      <div className="space-y-3">
        {filtered.map((inst) => {
          const isDone = completedSet.has(inst.rowNumber);
          const isCurrent = inst.rowNumber === project.progress.currentRow;
          const rowCounter = project.progress.rowCounters[inst.rowNumber];

          return (
            <div
              key={inst.rowNumber}
              className={`rounded-2xl border p-4 transition-colors ${
                isCurrent
                  ? 'border-[#D49A2A] bg-[#FEF9EE]'
                  : isDone
                    ? 'border-[#E6E0D4] bg-[#F8F6F1] opacity-80'
                    : 'border-[#E6E0D4] bg-white'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onToggleRowComplete(inst.rowNumber)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DED7C8] bg-white text-[#7C6A9A] hover:bg-[#EDE8F5]"
                    title={isDone ? 'Mark row incomplete' : 'Mark row complete'}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <Circle className="h-5 w-5 text-[#9B8FB0]" />
                    )}
                  </button>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold tabular-nums text-[#1E1D20]">
                        Row {inst.rowNumber}
                      </span>
                      <span className="text-xs text-[#615B69]">·</span>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#4B3D63]">
                        {inst.direction === 'right_to_left' ? (
                          <ArrowLeft className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowRight className="h-3.5 w-3.5" />
                        )}
                        {inst.directionLabel}
                      </span>
                      <span className="text-xs text-[#615B69]">· {inst.sideLabel}</span>
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] tabular-nums text-[#615B69]">
                      {inst.totalStitches} stitches total
                      {rowCounter !== undefined && ` · Counter saved: ${rowCounter}/${inst.totalStitches}`}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onStartWorkingAtRow(inst.rowNumber)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#DED7C8] bg-white px-3 py-1.5 text-xs font-semibold text-[#1E1D20] hover:bg-[#1F2024] hover:text-[#F5C451] min-h-[38px]"
                >
                  <Play className="h-3 w-3 fill-current" />
                  <span>Work Row</span>
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 pl-12">
                {inst.runs.map((run, idx) => (
                  <div
                    key={idx}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#E6E0D4] bg-white px-2.5 py-1.5 text-xs"
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-sm border border-black/15"
                      style={{ backgroundColor: run.color.hex }}
                    />
                    <span className="font-mono font-bold tabular-nums text-[#1E1D20]">
                      {run.count}
                    </span>
                    <span className="text-[#3C3844]">{run.color.name}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
