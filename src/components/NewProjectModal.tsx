import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
  CraftType,
  CrochetCategory,
  CrochetMethod,
  Handedness,
  PatternProject,
  YarnWeight,
} from '../types/pattern';
import {
  CROCHET_METHOD_SPECS,
  YARN_WEIGHT_SPECS,
  calculateDimensions,
  getRecommendedGauge,
} from '../utils/crochetMath';
import { createBlankProject, mapCategoryToDefaultMethod } from '../utils/projectFactory';

interface NewProjectModalProps {
  isOpen: boolean;
  defaultHandedness: Handedness;
  initialCraftType?: CraftType;
  initialCategory?: CrochetCategory;
  onClose: () => void;
  onCreate: (project: PatternProject) => void;
}

const CRAFT_TYPES: Array<{ id: CraftType; label: string }> = [
  { id: 'crochet', label: 'Crochet' },
  { id: 'knitting', label: 'Knitting' },
  { id: 'embroidery', label: 'Embroidery' },
  { id: 'painting', label: 'Painting' },
  { id: 'fuse_beads', label: 'Fuse Beads' },
  { id: 'pixel_art', label: 'Pixel Art' },
  { id: 'other', label: 'Other' },
];

const CROCHET_CATEGORIES: Array<{ id: CrochetCategory; label: string; note: string }> = [
  { id: 'standard', label: 'Standard Crochet', note: 'Single, Half Double, Double Crochet' },
  { id: 'tunisian', label: 'Tunisian Crochet', note: 'Worked forward & return on right side' },
  { id: 'c2c', label: 'Corner-to-Corner (C2C)', note: 'Diagonal block-by-block reading' },
  { id: 'mosaic', label: 'Mosaic Crochet', note: 'Row-by-row overlay front-side chart' },
];

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  defaultHandedness,
  initialCraftType = 'crochet',
  initialCategory = 'standard',
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [craftType, setCraftType] = useState<CraftType>(initialCraftType);
  const [category, setCategory] = useState<CrochetCategory>(initialCategory);
  const [method, setMethod] = useState<CrochetMethod>(mapCategoryToDefaultMethod(initialCategory));
  const [yarnWeight, setYarnWeight] = useState<YarnWeight>('worsted');
  const [handedness, setHandedness] = useState<Handedness>(defaultHandedness);
  const [width, setWidth] = useState(40);
  const [height, setHeight] = useState(40);

  if (!isOpen) return null;

  const handleCategoryChange = (nextCat: CrochetCategory) => {
    setCategory(nextCat);
    setMethod(mapCategoryToDefaultMethod(nextCat));
  };

  const gauge = getRecommendedGauge(method, yarnWeight);
  const dims = calculateDimensions(width, height, gauge.stitchGaugePer10Cm, gauge.rowGaugePer10Cm);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const project = createBlankProject({
      name: name.trim() || `${CRAFT_TYPES.find((c) => c.id === craftType)?.label ?? 'Crochet'} Pattern`,
      craftType,
      crochetCategory: category,
      method,
      yarnWeight,
      handedness,
      width,
      height,
    });
    onCreate(project);
    setName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#E6E0D4] bg-[#FAF7F2] p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-[#E6E0D4] pb-4">
          <div>
            <h2 className="font-display text-xl font-bold text-[#1E1D20]">Create New Project</h2>
            <p className="mt-0.5 text-xs text-[#615B69]">
              Configure craft method, grid dimensions, and starting gauge.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#E6E0D4] bg-white text-[#524D59] hover:bg-[#F3EFE7]"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-[#3C3844]" htmlFor="new-proj-name">
              Project Name
            </label>
            <input
              id="new-proj-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Botanical Cushion Cover"
              className="mt-1.5 w-full rounded-xl border border-[#DED7C8] bg-white px-3.5 py-2.5 text-sm text-[#1E1D20] focus:border-[#7C6A9A] focus:outline-none"
            />
          </div>

          <div>
            <span className="block text-xs font-semibold text-[#3C3844]">Craft Medium</span>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CRAFT_TYPES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCraftType(item.id)}
                  className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors min-h-[40px] ${
                    craftType === item.id
                      ? 'border-[#7C6A9A] bg-[#EDE8F5] text-[#4B3D63]'
                      : 'border-[#E6E0D4] bg-white text-[#524D59] hover:bg-[#F3EFE7]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {craftType === 'crochet' && (
            <>
              <div>
                <span className="block text-xs font-semibold text-[#3C3844]">Crochet Style</span>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {CROCHET_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleCategoryChange(cat.id)}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        category === cat.id
                          ? 'border-[#7C6A9A] bg-[#EDE8F5]'
                          : 'border-[#E6E0D4] bg-white hover:bg-[#F3EFE7]'
                      }`}
                    >
                      <div className="text-xs font-semibold text-[#1E1D20]">{cat.label}</div>
                      <div className="mt-0.5 text-[11px] text-[#615B69]">{cat.note}</div>
                    </button>
                  ))}
                </div>
              </div>

              {category === 'standard' && (
                <div>
                  <label className="block text-xs font-semibold text-[#3C3844]" htmlFor="new-proj-stitch">
                    Crochet Stitch
                  </label>
                  <select
                    id="new-proj-stitch"
                    value={method}
                    onChange={(e) => setMethod(e.target.value as CrochetMethod)}
                    className="mt-1.5 w-full rounded-xl border border-[#DED7C8] bg-white px-3.5 py-2.5 text-sm text-[#1E1D20] focus:border-[#7C6A9A] focus:outline-none"
                  >
                    <option value="single_crochet">{CROCHET_METHOD_SPECS.single_crochet.label}</option>
                    <option value="half_double_crochet">{CROCHET_METHOD_SPECS.half_double_crochet.label}</option>
                    <option value="double_crochet">{CROCHET_METHOD_SPECS.double_crochet.label}</option>
                    <option value="other">{CROCHET_METHOD_SPECS.other.label}</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#3C3844]" htmlFor="new-proj-yarn">
                    Yarn Weight
                  </label>
                  <select
                    id="new-proj-yarn"
                    value={yarnWeight}
                    onChange={(e) => setYarnWeight(e.target.value as YarnWeight)}
                    className="mt-1.5 w-full rounded-xl border border-[#DED7C8] bg-white px-3.5 py-2.5 text-sm text-[#1E1D20] focus:border-[#7C6A9A] focus:outline-none"
                  >
                    {Object.values(YARN_WEIGHT_SPECS).map((yw) => (
                      <option key={yw.id} value={yw.id}>
                        {yw.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="block text-xs font-semibold text-[#3C3844]">Handedness</span>
                  <div className="mt-1.5 grid grid-cols-2 gap-2">
                    {(['right', 'left'] as const).map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setHandedness(h)}
                        className={`rounded-xl border py-2.5 text-xs font-semibold transition-colors min-h-[42px] ${
                          handedness === h
                            ? 'border-[#7C6A9A] bg-[#EDE8F5] text-[#4B3D63]'
                            : 'border-[#E6E0D4] bg-white text-[#524D59]'
                        }`}
                      >
                        {h === 'right' ? 'Right-handed' : 'Left-handed'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#3C3844]" htmlFor="new-proj-w">
                Width (Stitches)
              </label>
              <input
                id="new-proj-w"
                type="number"
                min={4}
                max={200}
                value={width}
                onChange={(e) => setWidth(Math.max(4, Math.min(200, Number(e.target.value) || 4)))}
                className="mt-1.5 w-full rounded-xl border border-[#DED7C8] bg-white px-3.5 py-2.5 font-mono text-sm tabular-nums text-[#1E1D20] focus:border-[#7C6A9A] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#3C3844]" htmlFor="new-proj-h">
                Height (Rows)
              </label>
              <input
                id="new-proj-h"
                type="number"
                min={4}
                max={200}
                value={height}
                onChange={(e) => setHeight(Math.max(4, Math.min(200, Number(e.target.value) || 4)))}
                className="mt-1.5 w-full rounded-xl border border-[#DED7C8] bg-white px-3.5 py-2.5 font-mono text-sm tabular-nums text-[#1E1D20] focus:border-[#7C6A9A] focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-xl border border-[#E6E0D4] bg-[#F3EFE7] px-4 py-3 text-xs text-[#524D59]">
            Estimated size at {gauge.stitchGaugePer10Cm} sts × {gauge.rowGaugePer10Cm} rows / 10 cm:{' '}
            <span className="font-mono font-semibold text-[#1E1D20] tabular-nums">
              {dims.widthCm.toFixed(1)} × {dims.heightCm.toFixed(1)} cm
            </span>{' '}
            · Hook {gauge.hookSizeMm} mm
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#E6E0D4] bg-white px-4 py-2.5 text-sm font-medium text-[#524D59] hover:bg-[#F3EFE7] min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#7C6A9A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#6A5888] min-h-[44px]"
            >
              Create Pattern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
