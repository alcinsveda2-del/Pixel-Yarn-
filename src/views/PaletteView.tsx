import React, { useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  BookmarkPlus,
  Check,
  Edit2,
  GitMerge,
  Palette,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import {
  YARN_LIBRARY,
  hexDistance,
  normalizeHex,
} from '../data/yarnLibrary';
import { PaletteColor, PatternProject, PersonalPalette } from '../types/pattern';
import {
  computeColorUsage,
  removeColorFromGridAndPalette,
  replaceColorInGrid,
} from '../utils/crochetMath';
import { createId } from '../utils/projectFactory';

interface PaletteViewProps {
  project: PatternProject | null;
  personalPalettes: PersonalPalette[];
  onUpdateProject: (updated: PatternProject) => void;
  onSavePersonalPalette: (palette: PersonalPalette) => void;
  onDeletePersonalPalette: (id: string) => void;
}

export const PaletteView: React.FC<PaletteViewProps> = ({
  project,
  personalPalettes,
  onUpdateProject,
  onSavePersonalPalette,
  onDeletePersonalPalette,
}) => {
  const [librarySearch, setLibrarySearch] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{
    hex: string;
    name: string;
    brand: string;
    yarnName: string;
  }>({ hex: '#7C6A9A', name: '', brand: '', yarnName: '' });

  // Custom color creator
  const [newColorHex, setNewColorHex] = useState('#7C6A9A');
  const [newColorName, setNewColorName] = useState('');
  const [newColorBrand, setNewColorBrand] = useState('');
  const [newColorYarn, setNewColorYarn] = useState('');

  // Replace / Merge tools
  const [replaceFromIdx, setReplaceFromIdx] = useState<number>(0);
  const [replaceToIdx, setReplaceToIdx] = useState<number>(0);
  const [mergeThreshold, setMergeThreshold] = useState<number>(16);
  const [personalPaletteName, setPersonalPaletteName] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const usage = useMemo(() => (project ? computeColorUsage(project) : []), [project]);

  const filteredLibrary = useMemo(() => {
    const q = librarySearch.trim().toLowerCase();
    if (!q) return YARN_LIBRARY;
    return YARN_LIBRARY.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.hex.toLowerCase().includes(q) ||
        (c.brand ?? '').toLowerCase().includes(q) ||
        (c.yarnName ?? '').toLowerCase().includes(q)
    );
  }, [librarySearch]);

  const showToast = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => setFeedback(null), 3000);
  };

  const addColorToProject = (color: PaletteColor) => {
    if (!project) return;
    const norm = normalizeHex(color.hex);
    if (project.palette.some((c) => c.hex.toUpperCase() === norm)) {
      showToast(`${color.name} (${norm}) is already in this pattern's palette.`);
      return;
    }
    const nextColor: PaletteColor = { ...color, id: createId('col'), hex: norm };
    onUpdateProject({
      ...project,
      palette: [...project.palette, nextColor],
      updatedAt: Date.now(),
    });
    showToast(`Added ${nextColor.name} to project palette.`);
  };

  const handleAddCustomColor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    const hex = normalizeHex(newColorHex);
    addColorToProject({
      id: createId('col'),
      hex,
      name: newColorName.trim() || `Custom ${hex}`,
      brand: newColorBrand.trim() || 'Custom Yarn',
      yarnName: newColorYarn.trim() || 'Custom Shade',
    });
    setNewColorName('');
  };

  const startEdit = (idx: number, col: PaletteColor) => {
    setEditingIndex(idx);
    setEditForm({
      hex: col.hex,
      name: col.name,
      brand: col.brand ?? '',
      yarnName: col.yarnName ?? '',
    });
  };

  const saveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || editingIndex === null) return;
    const nextPalette = project.palette.map((c, idx) =>
      idx === editingIndex
        ? {
            ...c,
            hex: normalizeHex(editForm.hex),
            name: editForm.name.trim() || c.name,
            brand: editForm.brand.trim() || undefined,
            yarnName: editForm.yarnName.trim() || undefined,
          }
        : c
    );
    onUpdateProject({
      ...project,
      palette: nextPalette,
      updatedAt: Date.now(),
    });
    setEditingIndex(null);
    showToast('Updated colour across the entire pattern.');
  };

  const handleDeleteColor = (removeIdx: number) => {
    if (!project || project.palette.length <= 1) return;
    const fallbackIdx = removeIdx === 0 ? 1 : 0;
    const { grid, palette } = removeColorFromGridAndPalette(
      project.grid,
      project.palette,
      removeIdx,
      fallbackIdx
    );
    onUpdateProject({
      ...project,
      grid,
      palette,
      updatedAt: Date.now(),
    });
    showToast('Removed colour and reassigned any matching stitches.');
  };

  const handleReplaceAcrossPattern = () => {
    if (!project || replaceFromIdx === replaceToIdx) return;
    const nextGrid = replaceColorInGrid(project.grid, replaceFromIdx, replaceToIdx);
    onUpdateProject({
      ...project,
      grid: nextGrid,
      updatedAt: Date.now(),
    });
    showToast(
      `Replaced ${project.palette[replaceFromIdx]?.name} with ${project.palette[replaceToIdx]?.name}.`
    );
  };

  const handleMergeSimilarColors = () => {
    if (!project || project.palette.length <= 1) return;
    const counts = new Map<number, number>();
    project.grid.forEach((idx) => counts.set(idx, (counts.get(idx) ?? 0) + 1));

    // Greedily merge less-used colors into closest dominant color within Lab distance threshold
    const order = project.palette
      .map((_, i) => i)
      .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));

    const kept: number[] = [];
    const remap = new Map<number, number>();

    for (const idx of order) {
      let mergedInto: number | null = null;
      for (const k of kept) {
        if (hexDistance(project.palette[idx].hex, project.palette[k].hex) <= mergeThreshold) {
          mergedInto = k;
          break;
        }
      }
      if (mergedInto !== null) {
        remap.set(idx, mergedInto);
      } else {
        kept.push(idx);
        remap.set(idx, idx);
      }
    }

    if (kept.length === project.palette.length) {
      showToast('No colours fell within that similarity threshold. Increase ΔE slightly.');
      return;
    }

    const newPalette: PaletteColor[] = [];
    const compactMap = new Map<number, number>();
    kept.sort((a, b) => a - b).forEach((oldIdx, newIdx) => {
      compactMap.set(oldIdx, newIdx);
      newPalette.push(project.palette[oldIdx]);
    });

    const newGrid = project.grid.map((cell) => {
      const targetOld = remap.get(cell) ?? cell;
      return compactMap.get(targetOld) ?? 0;
    });

    const removed = project.palette.length - newPalette.length;
    onUpdateProject({
      ...project,
      grid: newGrid,
      palette: newPalette,
      updatedAt: Date.now(),
    });
    showToast(`Merged ${removed} similar ${removed === 1 ? 'colour' : 'colours'} into nearest shades.`);
  };

  const handleSavePersonalPalette = (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    const p: PersonalPalette = {
      id: createId('pal'),
      name: personalPaletteName.trim() || `${project.name} Palette`,
      createdAt: Date.now(),
      colors: project.palette.map((c) => ({ ...c })),
    };
    onSavePersonalPalette(p);
    setPersonalPaletteName('');
    showToast(`Saved "${p.name}" to Personal Palettes.`);
  };

  const handleApplyPersonalPalette = (pal: PersonalPalette) => {
    if (!project || pal.colors.length === 0) return;
    // Remap every cell to perceptual closest shade in personal palette
    const newGrid = project.grid.map((oldIdx) => {
      const oldHex = project.palette[oldIdx]?.hex ?? '#FAF5E8';
      let bestI = 0;
      let bestD = Infinity;
      pal.colors.forEach((c, idx) => {
        const d = hexDistance(oldHex, c.hex);
        if (d < bestD) {
          bestD = d;
          bestI = idx;
        }
      });
      return bestI;
    });
    onUpdateProject({
      ...project,
      palette: pal.colors.map((c) => ({ ...c, id: createId('col') })),
      grid: newGrid,
      updatedAt: Date.now(),
    });
    showToast(`Applied personal palette "${pal.name}" to pattern.`);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E6E0D4] pb-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#1E1D20]">
            Yarn Palette & Colour Studio
          </h1>
          <p className="mt-0.5 text-xs text-[#615B69]">
            Edit project colours, count stitches, merge similar shades, and browse the yarn library.
          </p>
        </div>
        {feedback && (
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800">
            <Check className="h-3.5 w-3.5" />
            <span>{feedback}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Active Project Palette + Tools */}
        <div className="space-y-5 lg:col-span-7">
          {!project ? (
            <div className="rounded-2xl border border-[#E6E0D4] bg-white p-8 text-center">
              <Palette className="mx-auto h-8 w-8 text-[#7C6A9A]" />
              <p className="mt-2 text-sm font-semibold text-[#1E1D20]">
                Open or create a project to manage its pattern palette.
              </p>
            </div>
          ) : (
            <>
              {/* Active Project Colours */}
              <section className="rounded-2xl border border-[#E6E0D4] bg-white p-5">
                <div className="flex items-center justify-between border-b border-[#F3EFE7] pb-3">
                  <div>
                    <h2 className="font-display text-lg font-bold text-[#1E1D20]">
                      {project.name} Palette ({project.palette.length})
                    </h2>
                    <p className="text-xs text-[#615B69]">
                      Editing a colour updates every matching stitch in the pattern immediately.
                    </p>
                  </div>
                </div>

                <div className="mt-4 divide-y divide-[#F3EFE7]">
                  {usage.map((u) => (
                    <div key={u.color.id + u.colorIndex} className="py-3">
                      {editingIndex === u.colorIndex ? (
                        <form onSubmit={saveEdit} className="grid grid-cols-1 gap-2.5 sm:grid-cols-12 items-end bg-[#FAF7F2] p-3 rounded-xl border border-[#E6E0D4]">
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-semibold text-[#524D59]">Colour</label>
                            <input
                              type="color"
                              value={editForm.hex}
                              onChange={(e) => setEditForm((f) => ({ ...f, hex: e.target.value }))}
                              className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-[#DED7C8]"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-[10px] font-semibold text-[#524D59]">HEX</label>
                            <input
                              type="text"
                              value={editForm.hex}
                              onChange={(e) => setEditForm((f) => ({ ...f, hex: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-[#DED7C8] bg-white px-2.5 py-1.5 font-mono text-xs"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-[10px] font-semibold text-[#524D59]">Name</label>
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-[#DED7C8] bg-white px-2.5 py-1.5 text-xs"
                            />
                          </div>
                          <div className="sm:col-span-4 flex gap-1.5">
                            <input
                              type="text"
                              placeholder="Yarn Brand"
                              value={editForm.brand}
                              onChange={(e) => setEditForm((f) => ({ ...f, brand: e.target.value }))}
                              className="w-full rounded-lg border border-[#DED7C8] bg-white px-2.5 py-1.5 text-xs"
                            />
                            <button
                              type="submit"
                              className="rounded-lg bg-[#7C6A9A] px-3 py-1.5 text-xs font-semibold text-white shrink-0"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingIndex(null)}
                              className="rounded-lg border border-[#DED7C8] bg-white px-2.5 py-1.5 text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className="h-9 w-9 shrink-0 rounded-xl border border-black/15"
                              style={{ backgroundColor: u.color.hex }}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-semibold text-[#1E1D20]">
                                  {u.color.name}
                                </span>
                                <span className="font-mono text-xs text-[#615B69]">{u.color.hex}</span>
                              </div>
                              <div className="text-[11px] text-[#7A7483]">
                                {u.color.brand ? `${u.color.brand}` : 'Studio Shade'}
                                {u.color.yarnName ? ` · ${u.color.yarnName}` : ''}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right font-mono tabular-nums">
                              <div className="text-xs font-semibold text-[#1E1D20]">
                                {u.stitchCount} sts ({u.percentage.toFixed(1)}%)
                              </div>
                              <div className="text-[11px] text-[#615B69]">
                                ~{u.estimatedMeters.toFixed(1)} m yarn
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => startEdit(u.colorIndex, u.color)}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E6E0D4] bg-[#FAF7F2] text-[#3C3844] hover:bg-[#EFE9DD]"
                                title="Edit colour"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={project.palette.length <= 1}
                                onClick={() => handleDeleteColor(u.colorIndex)}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E6E0D4] bg-[#FAF7F2] text-[#B91C1C] hover:bg-red-50 disabled:opacity-35"
                                title="Delete colour"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Replace & Merge Tools */}
              <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#E6E0D4] bg-white p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#1E1D20]">
                    <ArrowRightLeft className="h-4 w-4 text-[#7C6A9A]" />
                    <span>Replace Colour in Pattern</span>
                  </div>
                  <div className="space-y-2">
                    <select
                      value={replaceFromIdx}
                      onChange={(e) => setReplaceFromIdx(Number(e.target.value))}
                      className="w-full rounded-xl border border-[#DED7C8] bg-[#FAF7F2] px-3 py-2 text-xs"
                    >
                      {project.palette.map((c, idx) => (
                        <option key={idx} value={idx}>
                          From: {c.name} ({c.hex})
                        </option>
                      ))}
                    </select>
                    <select
                      value={replaceToIdx}
                      onChange={(e) => setReplaceToIdx(Number(e.target.value))}
                      className="w-full rounded-xl border border-[#DED7C8] bg-[#FAF7F2] px-3 py-2 text-xs"
                    >
                      {project.palette.map((c, idx) => (
                        <option key={idx} value={idx}>
                          To: {c.name} ({c.hex})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleReplaceAcrossPattern}
                      disabled={replaceFromIdx === replaceToIdx}
                      className="w-full rounded-xl bg-[#1F2024] py-2.5 text-xs font-semibold text-[#FAF7F2] hover:bg-[#2E3036] disabled:opacity-40 min-h-[40px]"
                    >
                      Replace Across Pattern
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E6E0D4] bg-white p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#1E1D20]">
                    <GitMerge className="h-4 w-4 text-[#7C6A9A]" />
                    <span>Merge Similar Shades</span>
                  </div>
                  <p className="text-[11px] text-[#615B69]">
                    Combine closely matching hues to reduce yarn skeins needed.
                  </p>
                  <div>
                    <div className="flex justify-between text-[11px] text-[#524D59]">
                      <span>Similarity Threshold (ΔE)</span>
                      <span className="font-mono tabular-nums">{mergeThreshold}</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={45}
                      value={mergeThreshold}
                      onChange={(e) => setMergeThreshold(Number(e.target.value))}
                      className="mt-1 w-full accent-[#7C6A9A]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleMergeSimilarColors}
                    className="w-full rounded-xl border border-[#7C6A9A] bg-[#EDE8F5] py-2.5 text-xs font-semibold text-[#4B3D63] hover:bg-[#E1D8EE] min-h-[40px]"
                  >
                    Merge Similar Colours
                  </button>
                </div>
              </section>

              {/* Add Custom Colour */}
              <section className="rounded-2xl border border-[#E6E0D4] bg-white p-4">
                <h3 className="text-xs font-semibold text-[#1E1D20]">Add Custom Yarn Colour</h3>
                <form onSubmit={handleAddCustomColor} className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-12">
                  <div className="sm:col-span-2">
                    <input
                      type="color"
                      value={newColorHex}
                      onChange={(e) => setNewColorHex(e.target.value)}
                      className="h-10 w-full cursor-pointer rounded-xl border border-[#DED7C8]"
                      aria-label="Custom colour picker"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <input
                      type="text"
                      value={newColorName}
                      onChange={(e) => setNewColorName(e.target.value)}
                      placeholder="Colour Name"
                      className="w-full rounded-xl border border-[#DED7C8] bg-[#FAF7F2] px-3 py-2.5 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <input
                      type="text"
                      value={newColorBrand}
                      onChange={(e) => setNewColorBrand(e.target.value)}
                      placeholder="Yarn Brand"
                      className="w-full rounded-xl border border-[#DED7C8] bg-[#FAF7F2] px-3 py-2.5 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={newColorYarn}
                      onChange={(e) => setNewColorYarn(e.target.value)}
                      placeholder="Yarn Line"
                      className="w-full rounded-xl border border-[#DED7C8] bg-[#FAF7F2] px-3 py-2.5 text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      className="flex w-full items-center justify-center gap-1 rounded-xl bg-[#7C6A9A] py-2.5 text-xs font-semibold text-white hover:bg-[#6A5888] min-h-[40px]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </form>
              </section>
            </>
          )}
        </div>

        {/* Right: Yarn Library + Personal Palettes */}
        <div className="space-y-5 lg:col-span-5">
          {/* Personal Palettes */}
          <section className="rounded-2xl border border-[#E6E0D4] bg-white p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#1E1D20]">
              <BookmarkPlus className="h-4 w-4 text-[#7C6A9A]" />
              <span>Personal Palettes</span>
            </div>

            {project && (
              <form onSubmit={handleSavePersonalPalette} className="flex gap-2">
                <input
                  type="text"
                  value={personalPaletteName}
                  onChange={(e) => setPersonalPaletteName(e.target.value)}
                  placeholder="Save current palette as..."
                  className="flex-1 rounded-xl border border-[#DED7C8] bg-[#FAF7F2] px-3 py-2 text-xs"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-[#7C6A9A] px-3.5 py-2 text-xs font-semibold text-white shrink-0"
                >
                  Save
                </button>
              </form>
            )}

            {personalPalettes.length === 0 ? (
              <p className="text-xs text-[#615B69]">
                Save your favourite colour combinations here to reuse across projects.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {personalPalettes.map((pal) => (
                  <div
                    key={pal.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[#E6E0D4] bg-[#FAF7F2] p-2.5"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-[#1E1D20]">{pal.name}</div>
                      <div className="mt-1 flex gap-1">
                        {pal.colors.slice(0, 8).map((c, i) => (
                          <span
                            key={i}
                            className="h-3.5 w-3.5 rounded-sm border border-black/15"
                            style={{ backgroundColor: c.hex }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {project && (
                        <button
                          type="button"
                          onClick={() => handleApplyPersonalPalette(pal)}
                          className="rounded-lg border border-[#DED7C8] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#4B3D63] hover:bg-[#EDE8F5]"
                        >
                          Apply
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDeletePersonalPalette(pal.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[#B91C1C] hover:bg-red-50"
                        title="Delete personal palette"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Yarn Colour Library */}
          <section className="rounded-2xl border border-[#E6E0D4] bg-white p-4 space-y-3">
            <div>
              <h2 className="font-display text-base font-bold text-[#1E1D20]">
                Yarn Colour Library ({YARN_LIBRARY.length} shades)
              </h2>
              <p className="text-[11px] text-[#615B69]">
                Search by colour name, yarn brand, or HEX code.
              </p>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#7A7483]" />
              <input
                type="text"
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                placeholder="Search e.g. Lavender, #F5C451, CottonCraft..."
                className="w-full rounded-xl border border-[#DED7C8] bg-[#FAF7F2] py-2.5 pr-3 pl-9 text-xs"
              />
            </div>

            <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
              {filteredLibrary.map((yarn) => (
                <div
                  key={yarn.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-[#F3EFE7] bg-[#FAF7F2] px-3 py-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="h-7 w-7 shrink-0 rounded-lg border border-black/15"
                      style={{ backgroundColor: yarn.hex }}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-[#1E1D20]">{yarn.name}</div>
                      <div className="truncate text-[10px] text-[#615B69] font-mono">
                        {yarn.hex} · {yarn.brand}
                      </div>
                    </div>
                  </div>
                  {project && (
                    <button
                      type="button"
                      onClick={() => addColorToProject(yarn)}
                      className="shrink-0 rounded-lg border border-[#D8D0E4] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#4B3D63] hover:bg-[#EDE8F5] min-h-[34px]"
                    >
                      + Add
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
