import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Minus,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react';
import { getContrastTextColor } from '../data/yarnLibrary';
import { PatternProject } from '../types/pattern';
import { CROCHET_METHOD_SPECS, getTotalRowsForProject } from '../utils/crochetMath';
import { generateRowInstruction } from '../utils/rowInstructions';
import { PatternThumbnail } from '../components/PatternThumbnail';

interface WorkingModeViewProps {
  project: PatternProject;
  onUpdateProject: (updated: PatternProject) => void;
  onExit: () => void;
}

export const WorkingModeView: React.FC<WorkingModeViewProps> = ({
  project,
  onUpdateProject,
  onExit,
}) => {
  const totalRows = getTotalRowsForProject(project);
  const currentRow = Math.max(1, Math.min(totalRows, project.progress.currentRow || 1));
  const [showOverviewMap, setShowOverviewMap] = useState(true);
  const [showRowDrawer, setShowRowDrawer] = useState(false);

  const rowInstruction = useMemo(
    () => generateRowInstruction(project, currentRow),
    [project, currentRow]
  );

  const completedSet = useMemo(
    () => new Set(project.progress.completedRows),
    [project.progress.completedRows]
  );
  const isCurrentCompleted = completedSet.has(currentRow);
  const completedCount = project.progress.completedRows.filter((r) => r >= 1 && r <= totalRows).length;
  const progressPct = totalRows > 0 ? Math.round((completedCount / totalRows) * 100) : 0;

  // Independent counter for THIS specific row only! Undefined = blank.
  const rawCounter = project.progress.rowCounters[currentRow];
  const counterInputValue = rawCounter === undefined ? '' : String(rawCounter);
  const numericCounter = rawCounter ?? 0;
  const expectedStitches = rowInstruction.totalStitches;

  const activeStripRef = useRef<HTMLDivElement | null>(null);
  const activeCellRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll active stitch cell into view when counter changes
  useEffect(() => {
    if (activeCellRef.current && activeStripRef.current) {
      activeCellRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [numericCounter, currentRow]);

  const setRowCounter = (nextValue: number | undefined) => {
    const nextCounters = { ...project.progress.rowCounters };
    if (nextValue === undefined) {
      delete nextCounters[currentRow];
    } else {
      nextCounters[currentRow] = Math.max(0, nextValue);
    }
    onUpdateProject({
      ...project,
      updatedAt: Date.now(),
      progress: {
        ...project.progress,
        rowCounters: nextCounters,
      },
    });
  };

  const handleManualInputChange = (val: string) => {
    const trimmed = val.trim();
    if (trimmed === '') {
      setRowCounter(undefined);
      return;
    }
    const parsed = parseInt(trimmed, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      setRowCounter(parsed);
    }
  };

  const handleIncrement = () => {
    setRowCounter(rawCounter === undefined ? 1 : rawCounter + 1);
  };

  const handleDecrement = () => {
    if (rawCounter === undefined || rawCounter <= 0) {
      setRowCounter(0);
    } else {
      setRowCounter(rawCounter - 1);
    }
  };

  const jumpToRow = (targetRow: number) => {
    const clamped = Math.max(1, Math.min(totalRows, targetRow));
    onUpdateProject({
      ...project,
      updatedAt: Date.now(),
      progress: {
        ...project.progress,
        currentRow: clamped,
      },
    });
    setShowRowDrawer(false);
  };

  const handleCompleteRow = () => {
    const nextCompleted = Array.from(new Set([...project.progress.completedRows, currentRow])).sort(
      (a, b) => a - b
    );
    const nextCompletedSet = new Set(nextCompleted);

    // Move to next unfinished row after currentRow, or currentRow + 1, or stay at last row if all done
    let nextRow = currentRow;
    for (let r = currentRow + 1; r <= totalRows; r++) {
      if (!nextCompletedSet.has(r)) {
        nextRow = r;
        break;
      }
    }
    if (nextRow === currentRow && currentRow < totalRows) {
      nextRow = currentRow + 1;
    }

    onUpdateProject({
      ...project,
      updatedAt: Date.now(),
      progress: {
        ...project.progress,
        completedRows: nextCompleted,
        currentRow: nextRow,
      },
    });
  };

  const handleReopenRow = () => {
    const nextCompleted = project.progress.completedRows.filter((r) => r !== currentRow);
    onUpdateProject({
      ...project,
      updatedAt: Date.now(),
      progress: {
        ...project.progress,
        completedRows: nextCompleted,
      },
    });
  };

  // Determine which run the current stitch counter is inside (1-indexed stitch target = numericCounter + 1 when working)
  const activeStepHighlight = numericCounter > 0 ? Math.min(expectedStitches, numericCounter) : 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1F2024] text-[#FAF7F2]">
      {/* Top Bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#17181B] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-[#FAF7F2] hover:bg-white/10 min-h-[42px]"
          >
            <X className="h-4 w-4" />
            <span>Exit</span>
          </button>
          <div className="min-w-0">
            <h1 className="truncate font-display text-base font-bold text-[#FAF7F2] sm:text-lg">
              {project.name}
            </h1>
            <div className="text-[11px] text-[#B9B4C2]">
              {CROCHET_METHOD_SPECS[project.settings.method]?.shortLabel} ·{' '}
              {project.settings.handedness === 'right' ? 'Right-handed' : 'Left-handed'} ·{' '}
              {rowInstruction.startingCorner}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowOverviewMap((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-[#FAF7F2] hover:bg-white/10 min-h-[42px]"
          >
            {showOverviewMap ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span className="hidden sm:inline">{showOverviewMap ? 'Hide Map' : 'Show Map'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowRowDrawer(true)}
            className="rounded-xl border border-[#F5C451]/40 bg-[#F5C451]/10 px-3.5 py-2 text-xs font-semibold text-[#F5C451] hover:bg-[#F5C451]/20 min-h-[42px]"
          >
            Jump to Row
          </button>
        </div>
      </header>

      {/* Overall Progress Strip */}
      <div className="border-b border-white/10 bg-[#25262B] px-4 py-2.5 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 text-xs">
          <div className="font-mono font-semibold tabular-nums text-[#F5C451]">
            Row {currentRow} of {totalRows} – {progressPct}% completed ({completedCount}/{totalRows} rows)
          </div>
          <div className="hidden sm:block text-[#C9C4D3]">
            Auto-saved locally
          </div>
        </div>
        <div className="mx-auto mt-1.5 h-2 max-w-6xl overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[#F5C451] transition-[width] duration-200"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Main Scrollable Companion Workspace */}
      <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Primary Active Row Column */}
          <div className={`space-y-5 ${showOverviewMap ? 'lg:col-span-9' : 'lg:col-span-12'}`}>
            {/* Active Row Hero Card */}
            <section className="rounded-2xl border-2 border-[#F5C451] bg-[#28292F] p-4 sm:p-6 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-xl bg-[#F5C451] px-3.5 py-1.5 font-mono text-sm font-bold tabular-nums text-[#1E1D20]">
                    ROW {currentRow}
                  </span>
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#FAF7F2]">
                      {rowInstruction.direction === 'right_to_left' ? (
                        <ArrowLeft className="h-4 w-4 text-[#F5C451]" />
                      ) : (
                        <ArrowRight className="h-4 w-4 text-[#F5C451]" />
                      )}
                      <span>{rowInstruction.directionLabel}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-[#C9C4D3]">
                      {rowInstruction.sideLabel} · {expectedStitches} stitches · {rowInstruction.runs.length} colour{' '}
                      {rowInstruction.runs.length === 1 ? 'section' : 'changes'}
                    </div>
                  </div>
                </div>

                {isCurrentCompleted && (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600/20 border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Completed</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleReopenRow}
                      className="rounded-xl border border-white/20 px-3 py-1.5 text-xs font-medium text-[#FAF7F2] hover:bg-white/10 min-h-[36px]"
                    >
                      Reopen Row
                    </button>
                  </div>
                )}
              </div>

              {/* Large Clear Horizontal Grid of ONLY the Current Row */}
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-[11px] text-[#C9C4D3]">
                  <span>
                    Active Row Stitch Strip (in exact reading order:{' '}
                    {rowInstruction.direction === 'right_to_left' ? 'Right → Left' : 'Left → Right'})
                  </span>
                  <span className="font-mono tabular-nums">
                    Tap any stitch to jump counter
                  </span>
                </div>

                <div
                  ref={activeStripRef}
                  className="flex items-stretch gap-1 overflow-x-auto rounded-xl border border-[#F5C451]/50 bg-[#17181B] p-3"
                >
                  {rowInstruction.cells.map((cell) => {
                    const isWorked = rawCounter !== undefined && cell.stepNumber <= rawCounter;
                    const isNextStitch =
                      rawCounter !== undefined
                        ? cell.stepNumber === Math.min(expectedStitches, rawCounter + 1)
                        : cell.stepNumber === 1;
                    const textCol = getContrastTextColor(cell.color.hex);
                    const prevCell = rowInstruction.cells[cell.stepNumber - 2];
                    const isColorChange = prevCell && prevCell.colorIndex !== cell.colorIndex;

                    return (
                      <div
                        key={cell.stepNumber}
                        ref={isNextStitch ? activeCellRef : null}
                        onClick={() => setRowCounter(cell.stepNumber)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setRowCounter(cell.stepNumber);
                          }
                        }}
                        title={`Stitch #${cell.stepNumber}: ${cell.color.name}`}
                        className={`relative flex h-16 w-12 shrink-0 cursor-pointer flex-col items-center justify-between rounded-lg border p-1 transition-transform select-none ${
                          isColorChange ? 'ml-2' : ''
                        } ${
                          isNextStitch
                            ? 'ring-2 ring-[#F5C451] scale-105 z-10 border-[#F5C451]'
                            : isWorked
                              ? 'opacity-55 border-white/20'
                              : 'border-white/20 hover:scale-105'
                        }`}
                        style={{ backgroundColor: cell.color.hex, color: textCol }}
                      >
                        <span className="font-mono text-[11px] font-bold tabular-nums">
                          {cell.stepNumber}
                        </span>
                        <span className="max-w-full truncate text-[9px] font-semibold opacity-90">
                          {cell.color.name.split(' ')[0]}
                        </span>
                        {isWorked && (
                          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
                            <Check className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Independent Current Row Stitch Counter + Row Instructions */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
              {/* Independent Per-Row Stitch Counter */}
              <section className="rounded-2xl border border-white/10 bg-[#28292F] p-5 md:col-span-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-base font-bold text-[#FAF7F2]">
                      Row {currentRow} Stitch Counter
                    </h2>
                    <button
                      type="button"
                      onClick={() => setRowCounter(undefined)}
                      className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] font-medium text-[#C9C4D3] hover:bg-white/10 min-h-[34px]"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Reset</span>
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-[#B9B4C2]">
                    Independent counter saved specifically for Row {currentRow}.
                  </p>

                  <div className="mt-4 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleDecrement}
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-[#17181B] text-[#FAF7F2] hover:bg-white/10 active:scale-95"
                      aria-label="Decrease stitch count"
                    >
                      <Minus className="h-6 w-6" />
                    </button>

                    <div className="flex-1">
                      <div className="flex items-baseline justify-center gap-1.5 rounded-2xl border border-white/15 bg-[#17181B] px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          value={counterInputValue}
                          placeholder="—"
                          onChange={(e) => handleManualInputChange(e.target.value)}
                          aria-label={`Row ${currentRow} stitch count`}
                          className="w-20 bg-transparent text-center font-mono text-2xl font-bold tabular-nums text-[#F5C451] placeholder:text-white/30 focus:outline-none"
                        />
                        <span className="font-mono text-sm tabular-nums text-[#B9B4C2]">
                          / {expectedStitches}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleIncrement}
                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#7C6A9A] text-white hover:bg-[#8E7BAE] active:scale-95"
                      aria-label="Increase stitch count"
                    >
                      <Plus className="h-6 w-6" />
                    </button>
                  </div>
                </div>

                {/* Count comparison vs expected */}
                <div className="mt-4">
                  {rawCounter === undefined ? (
                    <div className="rounded-xl border border-white/10 bg-[#1F2024] px-3.5 py-2.5 text-xs text-[#C9C4D3]">
                      Counter blank — enter your count or tap + as you stitch.
                    </div>
                  ) : rawCounter === expectedStitches ? (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2.5 text-xs font-semibold text-emerald-300">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>Matches expected {expectedStitches} stitches!</span>
                    </div>
                  ) : rawCounter < expectedStitches ? (
                    <div className="rounded-xl border border-white/15 bg-[#1F2024] px-3.5 py-2.5 text-xs text-[#E3DCEB] font-mono tabular-nums">
                      {expectedStitches - rawCounter} stitches remaining in Row {currentRow}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3.5 py-2.5 text-xs font-semibold text-amber-200">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>
                        {rawCounter - expectedStitches} over expected {expectedStitches} stitches
                      </span>
                    </div>
                  )}
                </div>
              </section>

              {/* Row Instructions Grouped Runs */}
              <section className="rounded-2xl border border-white/10 bg-[#28292F] p-5 md:col-span-7">
                <h2 className="font-display text-base font-bold text-[#FAF7F2]">
                  Row {currentRow} Instructions
                </h2>
                <p className="mt-0.5 text-xs text-[#B9B4C2]">
                  {rowInstruction.directionLabel} · Colour changes grouped in order
                </p>

                <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
                  {rowInstruction.runs.map((run, idx) => {
                    const isActiveRun =
                      activeStepHighlight >= run.startStitch && activeStepHighlight <= run.endStitch;
                    const isRunCompleted = rawCounter !== undefined && rawCounter >= run.endStitch;

                    return (
                      <div
                        key={idx}
                        onClick={() => setRowCounter(run.endStitch)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setRowCounter(run.endStitch);
                          }
                        }}
                        className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 transition-colors ${
                          isActiveRun
                            ? 'border-[#F5C451] bg-[#F5C451]/15'
                            : isRunCompleted
                              ? 'border-white/10 bg-[#1F2024] opacity-60'
                              : 'border-white/10 bg-[#1F2024] hover:border-white/25'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="h-6 w-6 shrink-0 rounded-md border border-white/25"
                            style={{ backgroundColor: run.color.hex }}
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-[#FAF7F2]">
                              <span className="font-mono tabular-nums text-[#F5C451]">
                                {run.count}
                              </span>{' '}
                              {run.count === 1 ? 'stitch' : 'stitches'} in {run.color.name}
                            </div>
                            <div className="font-mono text-[11px] tabular-nums text-[#B9B4C2]">
                              Stitches #{run.startStitch}–{run.endStitch}
                              {idx < rowInstruction.runs.length - 1
                                ? ` · Change at #${run.endStitch + 1}`
                                : ''}
                            </div>
                          </div>
                        </div>
                        {isRunCompleted && <Check className="h-4 w-4 shrink-0 text-emerald-400" />}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>

          {/* Right Mini-Map Overview (Other rows faded, active row highlighted in gold) */}
          {showOverviewMap && (
            <aside className="rounded-2xl border border-white/10 bg-[#28292F] p-4 lg:col-span-3 flex flex-col justify-between">
              <div>
                <div className="text-xs font-semibold text-[#FAF7F2]">Pattern Context</div>
                <div className="mt-0.5 text-[11px] text-[#B9B4C2]">
                  Row {currentRow} highlighted in gold; other rows faded.
                </div>
                <div className="mt-3 aspect-square w-full overflow-hidden rounded-xl border border-white/10 bg-[#17181B] p-2">
                  <PatternThumbnail
                    project={project}
                    highlightRow={project.settings.method === 'c2c' ? undefined : currentRow}
                  />
                </div>
              </div>

              <div className="mt-4 space-y-2 border-t border-white/10 pt-3 text-xs text-[#C9C4D3]">
                <div className="flex justify-between">
                  <span>Hook Size</span>
                  <span className="font-mono text-[#FAF7F2]">{project.settings.hookSizeMm} mm</span>
                </div>
                <div className="flex justify-between">
                  <span>Completed Rows</span>
                  <span className="font-mono tabular-nums text-[#FAF7F2]">
                    {completedCount} / {totalRows}
                  </span>
                </div>
              </div>
            </aside>
          )}
        </div>
      </main>

      {/* Bottom Sticky Ergonomic Navigation Bar */}
      <footer className="border-t border-white/10 bg-[#17181B] px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => jumpToRow(currentRow - 1)}
            disabled={currentRow <= 1}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xs font-semibold text-[#FAF7F2] hover:bg-white/10 disabled:opacity-35 min-h-[48px]"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Previous Row</span>
          </button>

          <button
            type="button"
            onClick={handleCompleteRow}
            className="flex-1 max-w-md inline-flex items-center justify-center gap-2 rounded-xl bg-[#F5C451] px-6 py-3 text-sm font-bold text-[#1E1D20] shadow-lg transition-transform hover:bg-[#F7CF6F] active:scale-[0.98] min-h-[50px]"
          >
            <CheckCircle2 className="h-5 w-5" />
            <span>
              {isCurrentCompleted
                ? currentRow < totalRows
                  ? `Next Unfinished Row`
                  : `Row ${currentRow} Completed`
                : `Complete Row ${currentRow}`}
            </span>
          </button>

          <button
            type="button"
            onClick={() => jumpToRow(currentRow + 1)}
            disabled={currentRow >= totalRows}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xs font-semibold text-[#FAF7F2] hover:bg-white/10 disabled:opacity-35 min-h-[48px]"
          >
            <span>Next Row</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </footer>

      {/* Jump to Row Selector Modal */}
      {showRowDrawer && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl border border-white/15 bg-[#28292F] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h3 className="font-display text-lg font-bold text-[#FAF7F2]">Jump to Row</h3>
                <p className="text-xs text-[#B9B4C2]">
                  Tap any row (including completed rows) to inspect or edit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRowDrawer(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-[#FAF7F2]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-4 border-b border-white/10 px-5 py-2.5 text-[11px] text-[#C9C4D3]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-emerald-600 inline-block" /> Completed
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-[#F5C451] inline-block" /> Current
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 rounded bg-[#17181B] border border-white/20 inline-block" /> Remaining
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2 overflow-y-auto p-5 sm:grid-cols-6">
              {Array.from({ length: totalRows }, (_, i) => i + 1).map((r) => {
                const isDone = completedSet.has(r);
                const isCurr = r === currentRow;
                const rowCount = project.progress.rowCounters[r];
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => jumpToRow(r)}
                    className={`flex flex-col items-center justify-center rounded-xl border py-2.5 font-mono text-xs tabular-nums min-h-[52px] ${
                      isCurr
                        ? 'border-[#F5C451] bg-[#F5C451] font-bold text-[#1E1D20]'
                        : isDone
                          ? 'border-emerald-500/40 bg-emerald-600/25 font-semibold text-emerald-200'
                          : 'border-white/10 bg-[#17181B] text-[#FAF7F2] hover:border-white/30'
                    }`}
                  >
                    <span>R{r}</span>
                    {rowCount !== undefined && (
                      <span className="text-[10px] opacity-80">{rowCount}st</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
