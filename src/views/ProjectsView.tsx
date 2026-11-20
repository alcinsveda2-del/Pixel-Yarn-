import React, { useMemo, useState } from 'react';
import {
  Bookmark,
  Copy,
  Edit3,
  FolderOpen,
  Play,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { CrochetMethod, PatternProject } from '../types/pattern';
import { CROCHET_METHOD_SPECS, getTotalRowsForProject } from '../utils/crochetMath';
import { PatternThumbnail } from '../components/PatternThumbnail';

interface ProjectsViewProps {
  projects: PatternProject[];
  activeProjectId: string | null;
  onCreateNew: () => void;
  onSelectProject: (id: string) => void;
  onOpenOverview: (id: string) => void;
  onStartWorking: (id: string) => void;
  onRenameProject: (id: string, nextName: string) => void;
  onDuplicateProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onToggleSavedPattern: (id: string) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  activeProjectId,
  onCreateNew,
  onSelectProject,
  onOpenOverview,
  onStartWorking,
  onRenameProject,
  onDuplicateProject,
  onDeleteProject,
  onToggleSavedPattern,
}) => {
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_progress' | 'completed' | 'saved'>('all');
  const [sortBy, setSortBy] = useState<'created_desc' | 'created_asc' | 'updated_desc'>('updated_desc');

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects
      .filter((p) => {
        if (q && !p.name.toLowerCase().includes(q)) return false;
        if (methodFilter !== 'all' && p.settings.method !== methodFilter) return false;
        const total = getTotalRowsForProject(p);
        const done = p.progress.completedRows.length;
        if (statusFilter === 'completed' && done < total) return false;
        if (statusFilter === 'in_progress' && done >= total) return false;
        if (statusFilter === 'saved' && !p.savedAsPattern) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'created_desc') return b.createdAt - a.createdAt;
        if (sortBy === 'created_asc') return a.createdAt - b.createdAt;
        return b.updatedAt - a.updatedAt;
      });
  }, [projects, search, methodFilter, statusFilter, sortBy]);

  const startRename = (proj: PatternProject) => {
    setRenamingId(proj.id);
    setRenameValue(proj.name);
  };

  const submitRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (renamingId && renameValue.trim()) {
      onRenameProject(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E6E0D4] pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#1E1D20]">My Projects</h1>
          <p className="mt-0.5 text-xs text-[#615B69]">
            Each project keeps its own stitch grid, yarn palette, crochet settings, and row counters.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateNew}
          className="inline-flex items-center gap-2 rounded-xl bg-[#7C6A9A] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#6A5888] min-h-[42px]"
        >
          <Plus className="h-4 w-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-[#E6E0D4] bg-white p-4 md:grid-cols-12">
        <div className="relative md:col-span-4">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#7A7483]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects by name..."
            className="w-full rounded-xl border border-[#DED7C8] bg-[#FAF7F2] py-2.5 pr-3.5 pl-9 text-xs text-[#1E1D20] focus:border-[#7C6A9A] focus:outline-none"
          />
        </div>

        <div className="md:col-span-3">
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            aria-label="Filter by crochet method"
            className="w-full rounded-xl border border-[#DED7C8] bg-[#FAF7F2] px-3 py-2.5 text-xs text-[#1E1D20]"
          >
            <option value="all">All Crochet Methods</option>
            {(Object.keys(CROCHET_METHOD_SPECS) as CrochetMethod[]).map((m) => (
              <option key={m} value={m}>
                {CROCHET_METHOD_SPECS[m].shortLabel}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3">
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'all' | 'in_progress' | 'completed' | 'saved')
            }
            aria-label="Filter by status"
            className="w-full rounded-xl border border-[#DED7C8] bg-[#FAF7F2] px-3 py-2.5 text-xs text-[#1E1D20]"
          >
            <option value="all">All Statuses</option>
            <option value="in_progress">Unfinished / In Progress</option>
            <option value="completed">Completed</option>
            <option value="saved">Saved Patterns</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as 'created_desc' | 'created_asc' | 'updated_desc')
            }
            aria-label="Sort projects"
            className="w-full rounded-xl border border-[#DED7C8] bg-[#FAF7F2] px-3 py-2.5 text-xs text-[#1E1D20]"
          >
            <option value="updated_desc">Recently Edited</option>
            <option value="created_desc">Newest Created</option>
            <option value="created_asc">Oldest Created</option>
          </select>
        </div>
      </div>

      {/* Project Grid */}
      {filteredProjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D6CFC0] bg-white p-12 text-center">
          <FolderOpen className="mx-auto h-9 w-9 text-[#7C6A9A]" />
          <h2 className="mt-3 font-display text-lg font-bold text-[#1E1D20]">
            No matching projects
          </h2>
          <p className="mt-1 text-xs text-[#615B69]">
            Adjust your search or create a new pattern project.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((proj) => {
            const total = getTotalRowsForProject(proj);
            const done = proj.progress.completedRows.length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const isActive = proj.id === activeProjectId;
            const methodLabel = CROCHET_METHOD_SPECS[proj.settings.method]?.shortLabel ?? 'Crochet';

            return (
              <div
                key={proj.id}
                className={`flex flex-col justify-between rounded-2xl border bg-white p-4 transition-colors ${
                  isActive ? 'border-[#7C6A9A]' : 'border-[#E6E0D4]'
                }`}
              >
                <div>
                  <div className="flex gap-3.5">
                    <button
                      type="button"
                      onClick={() => onSelectProject(proj.id)}
                      className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-[#E6E0D4] bg-[#F3EFE7]"
                    >
                      <PatternThumbnail project={proj} />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="truncate font-display text-base font-bold text-[#1E1D20]">
                          {proj.name}
                        </h3>
                        <button
                          type="button"
                          onClick={() => onToggleSavedPattern(proj.id)}
                          title={proj.savedAsPattern ? 'Remove from Saved Patterns' : 'Save Pattern'}
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                            proj.savedAsPattern
                              ? 'border-[#D49A2A] bg-[#FEF7E6] text-[#B87A1E]'
                              : 'border-[#E6E0D4] bg-[#FAF7F2] text-[#7A7483]'
                          }`}
                        >
                          <Bookmark className={`h-3.5 w-3.5 ${proj.savedAsPattern ? 'fill-current' : ''}`} />
                        </button>
                      </div>

                      <div className="mt-1 text-xs text-[#615B69]">
                        {proj.width} × {proj.height} sts · {methodLabel}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#7A7483]">
                        Created {new Date(proj.createdAt).toLocaleDateString()}
                        {isActive && ' · Active'}
                      </div>

                      <div className="mt-2.5">
                        <div className="flex justify-between font-mono text-[11px] tabular-nums text-[#3C3844]">
                          <span>
                            Row {proj.progress.currentRow} · {done}/{total} done
                          </span>
                          <span>{pct}%</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#EFE9DD]">
                          <div
                            className="h-full rounded-full bg-[#7C6A9A]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#F3EFE7] pt-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startRename(proj)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E6E0D4] bg-[#FAF7F2] text-[#524D59] hover:bg-[#EFE9DD]"
                      title="Rename project"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDuplicateProject(proj.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E6E0D4] bg-[#FAF7F2] text-[#524D59] hover:bg-[#EFE9DD]"
                      title="Duplicate project"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingId(proj.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E6E0D4] bg-[#FAF7F2] text-[#B91C1C] hover:bg-red-50"
                      title="Delete project"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onOpenOverview(proj.id)}
                      className="rounded-lg border border-[#E6E0D4] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#3C3844] hover:bg-[#F3EFE7] min-h-[36px]"
                    >
                      Overview
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectProject(proj.id)}
                      className="rounded-lg border border-[#E6E0D4] bg-[#FAF7F2] px-2.5 py-1.5 text-xs font-semibold text-[#3C3844] hover:bg-[#EFE9DD] min-h-[36px]"
                    >
                      Open
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

      {/* Rename Modal */}
      {renamingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={submitRename}
            className="w-full max-w-sm rounded-2xl border border-[#E6E0D4] bg-[#FAF7F2] p-6 shadow-xl space-y-4"
          >
            <h3 className="font-display text-lg font-bold text-[#1E1D20]">Rename Project</h3>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
              className="w-full rounded-xl border border-[#DED7C8] bg-white px-3.5 py-2.5 text-sm text-[#1E1D20]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenamingId(null)}
                className="rounded-xl border border-[#E6E0D4] bg-white px-4 py-2 text-xs font-semibold text-[#524D59]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#7C6A9A] px-4 py-2 text-xs font-semibold text-white"
              >
                Save Name
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#E6E0D4] bg-[#FAF7F2] p-6 shadow-xl space-y-4">
            <h3 className="font-display text-lg font-bold text-[#1E1D20]">Delete Project?</h3>
            <p className="text-xs leading-relaxed text-[#524D59]">
              This will permanently remove the pattern grid, palette, and row progress from local storage.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="rounded-xl border border-[#E6E0D4] bg-white px-4 py-2 text-xs font-semibold text-[#524D59]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteProject(deletingId);
                  setDeletingId(null);
                }}
                className="rounded-xl bg-[#B91C1C] px-4 py-2 text-xs font-semibold text-white"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
