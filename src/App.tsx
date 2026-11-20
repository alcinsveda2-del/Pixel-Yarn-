import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Camera,
  FolderOpen,
  Grid3X3,
  Home,
  ListOrdered,
  Menu,
  Palette,
  Play,
  Plus,
  Settings,
  X,
} from 'lucide-react';
import { NewProjectModal } from './components/NewProjectModal';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { ProjectOverviewModal } from './components/ProjectOverviewModal';
import {
  AppPreferences,
  clearAllLocalData,
  deletePersonalPalette,
  deleteProjectFromDB,
  getAllPersonalPalettes,
  getAllProjects,
  getPreferences,
  savePersonalPalette,
  savePreferences,
  saveProjectToDB,
} from './services/storage';
import {
  AppSection,
  CraftType,
  CrochetCategory,
  PatternProject,
  PersonalPalette,
} from './types/pattern';
import { getTotalRowsForProject } from './utils/crochetMath';
import {
  createGuidedMotifProject,
  duplicateProjectRecord,
} from './utils/projectFactory';
import { DesignerView } from './views/DesignerView';
import { HomeView } from './views/HomeView';
import { PaletteView } from './views/PaletteView';
import { PhotoStudioView } from './views/PhotoStudioView';
import { ProjectsView } from './views/ProjectsView';
import { RowInstructionsView } from './views/RowInstructionsView';
import { SettingsView } from './views/SettingsView';
import { WorkingModeView } from './views/WorkingModeView';

const NAV_ITEMS: Array<{
  id: AppSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'photo-studio', label: 'Photo Studio', icon: Camera },
  { id: 'designer', label: 'Designer', icon: Grid3X3 },
  { id: 'projects', label: 'Projects', icon: FolderOpen },
  { id: 'palette', label: 'Palette', icon: Palette },
  { id: 'instructions', label: 'Row Instructions', icon: ListOrdered },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function App() {
  const [section, setSection] = useState<AppSection>('home');
  const [projects, setProjects] = useState<PatternProject[]>([]);
  const [personalPalettes, setPersonalPalettes] = useState<PersonalPalette[]>([]);
  const [preferences, setPreferences] = useState<AppPreferences>({
    activeProjectId: null,
    defaultHandedness: 'right',
    showGridLines: true,
    showRowNumbers: true,
  });
  const [hydrated, setHydrated] = useState(false);

  const [newProjectModal, setNewProjectModal] = useState<{
    open: boolean;
    craftType: CraftType;
    category: CrochetCategory;
  }>({ open: false, craftType: 'crochet', category: 'standard' });

  const [overviewProjectId, setOverviewProjectId] = useState<string | null>(null);
  const [workingProjectId, setWorkingProjectId] = useState<string | null>(null);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  // Hydrate from IndexedDB on initial load
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [loadedProjects, loadedPalettes, loadedPrefs] = await Promise.all([
        getAllProjects(),
        getAllPersonalPalettes(),
        getPreferences(),
      ]);
      if (!mounted) return;
      setProjects(loadedProjects);
      setPersonalPalettes(loadedPalettes);
      const validActive =
        loadedPrefs.activeProjectId &&
        loadedProjects.some((p) => p.id === loadedPrefs.activeProjectId)
          ? loadedPrefs.activeProjectId
          : loadedProjects[0]?.id ?? null;
      setPreferences({ ...loadedPrefs, activeProjectId: validActive });
      setHydrated(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === preferences.activeProjectId) ?? null,
    [projects, preferences.activeProjectId]
  );

  const overviewProject = useMemo(
    () => projects.find((p) => p.id === overviewProjectId) ?? null,
    [projects, overviewProjectId]
  );

  const workingProject = useMemo(
    () => projects.find((p) => p.id === workingProjectId) ?? null,
    [projects, workingProjectId]
  );

  const updatePreferences = useCallback((next: AppPreferences) => {
    setPreferences(next);
    void savePreferences(next);
  }, []);

  const setActiveProjectId = useCallback(
    (id: string | null) => {
      updatePreferences({ ...preferences, activeProjectId: id });
    },
    [preferences, updatePreferences]
  );

  const handleCreateProject = useCallback(
    (project: PatternProject, targetSection: AppSection = 'designer') => {
      setProjects((prev) => [project, ...prev]);
      void saveProjectToDB(project);
      setActiveProjectId(project.id);
      setSection(targetSection);
    },
    [setActiveProjectId]
  );

  const handleUpdateProject = useCallback((updated: PatternProject) => {
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    void saveProjectToDB(updated);
  }, []);

  const handleDeleteProject = useCallback(
    (id: string) => {
      setProjects((prev) => {
        const remaining = prev.filter((p) => p.id !== id);
        if (preferences.activeProjectId === id) {
          updatePreferences({
            ...preferences,
            activeProjectId: remaining[0]?.id ?? null,
          });
        }
        return remaining;
      });
      if (overviewProjectId === id) setOverviewProjectId(null);
      if (workingProjectId === id) setWorkingProjectId(null);
      void deleteProjectFromDB(id);
    },
    [preferences, updatePreferences, overviewProjectId, workingProjectId]
  );

  const handleDuplicateProject = useCallback(
    (id: string) => {
      const src = projects.find((p) => p.id === id);
      if (!src) return;
      const copy = duplicateProjectRecord(src);
      setProjects((prev) => [copy, ...prev]);
      void saveProjectToDB(copy);
      setActiveProjectId(copy.id);
    },
    [projects, setActiveProjectId]
  );

  const handleRenameProject = useCallback(
    (id: string, nextName: string) => {
      const target = projects.find((p) => p.id === id);
      if (!target) return;
      handleUpdateProject({ ...target, name: nextName, updatedAt: Date.now() });
    },
    [projects, handleUpdateProject]
  );

  const handleToggleSavedPattern = useCallback(
    (id: string) => {
      const target = projects.find((p) => p.id === id);
      if (!target) return;
      handleUpdateProject({
        ...target,
        savedAsPattern: !target.savedAsPattern,
        updatedAt: Date.now(),
      });
    },
    [projects, handleUpdateProject]
  );

  // Resume at last unfinished row if user had closed/reopened
  const handleStartWorking = useCallback(
    (id: string, explicitRow?: number) => {
      const target = projects.find((p) => p.id === id);
      if (!target) return;
      setActiveProjectId(id);

      const total = getTotalRowsForProject(target);
      const completedSet = new Set(target.progress.completedRows);
      let startRow = explicitRow ?? target.progress.currentRow;

      if (explicitRow === undefined && completedSet.has(startRow)) {
        // Find first unfinished row
        for (let r = 1; r <= total; r++) {
          if (!completedSet.has(r)) {
            startRow = r;
            break;
          }
        }
      }

      if (startRow !== target.progress.currentRow) {
        handleUpdateProject({
          ...target,
          progress: {
            ...target.progress,
            currentRow: Math.max(1, Math.min(total, startRow)),
          },
          updatedAt: Date.now(),
        });
      }

      setOverviewProjectId(null);
      setWorkingProjectId(id);
    },
    [projects, setActiveProjectId, handleUpdateProject]
  );

  const handleToggleRowComplete = useCallback(
    (rowNumber: number) => {
      if (!activeProject) return;
      const set = new Set(activeProject.progress.completedRows);
      if (set.has(rowNumber)) set.delete(rowNumber);
      else set.add(rowNumber);
      handleUpdateProject({
        ...activeProject,
        progress: {
          ...activeProject.progress,
          completedRows: Array.from(set).sort((a, b) => a - b),
        },
        updatedAt: Date.now(),
      });
    },
    [activeProject, handleUpdateProject]
  );

  const handleSavePersonalPalette = useCallback((pal: PersonalPalette) => {
    setPersonalPalettes((prev) => [pal, ...prev]);
    void savePersonalPalette(pal);
  }, []);

  const handleDeletePersonalPalette = useCallback((id: string) => {
    setPersonalPalettes((prev) => prev.filter((p) => p.id !== id));
    void deletePersonalPalette(id);
  }, []);

  const handleImportBackup = useCallback(
    (imported: PatternProject[]) => {
      setProjects((prev) => {
        const map = new Map(prev.map((p) => [p.id, p]));
        imported.forEach((proj) => {
          if (proj && proj.id && Array.isArray(proj.grid)) {
            map.set(proj.id, proj);
            void saveProjectToDB(proj);
          }
        });
        const merged = Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
        if (!preferences.activeProjectId && merged[0]) {
          setActiveProjectId(merged[0].id);
        }
        return merged;
      });
    },
    [preferences.activeProjectId, setActiveProjectId]
  );

  const handleClearAllData = useCallback(async () => {
    await clearAllLocalData();
    setProjects([]);
    setPersonalPalettes([]);
    setWorkingProjectId(null);
    setOverviewProjectId(null);
    updatePreferences({
      activeProjectId: null,
      defaultHandedness: preferences.defaultHandedness,
      showGridLines: true,
      showRowNumbers: true,
    });
    setSection('home');
  }, [preferences.defaultHandedness, updatePreferences]);

  const navigateTo = (next: AppSection) => {
    setSection(next);
    setMobileMoreOpen(false);
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF7F2]">
        <div className="text-center">
          <div className="font-display text-2xl font-bold text-[#1E1D20]">PixelYarn</div>
          <p className="mt-1 text-xs text-[#615B69]">Loading local pattern studio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#FAF7F2] text-[#1E1D20]">
      {/* Desktop Sidebar Navigation (All 7 Main Navigation Sections) */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-[#E6E0D4] lg:bg-white">
        <div className="flex h-16 items-center justify-between border-b border-[#F3EFE7] px-5">
          <button
            type="button"
            onClick={() => navigateTo('home')}
            className="font-display text-xl font-bold tracking-tight text-[#1E1D20] whitespace-nowrap"
          >
            PixelYarn
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3" aria-label="Primary studio navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateTo(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors min-h-[44px] ${
                  isActive
                    ? 'bg-[#EDE8F5] font-semibold text-[#4B3D63]'
                    : 'text-[#524D59] hover:bg-[#FAF7F2] hover:text-[#1E1D20]'
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#7C6A9A]' : ''}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Active Project Quick Card in Sidebar */}
        <div className="border-t border-[#F3EFE7] p-4 space-y-3">
          {activeProject ? (
            <div className="rounded-xl border border-[#E6E0D4] bg-[#FAF7F2] p-3">
              <div className="text-[11px] font-medium text-[#615B69]">Active Pattern</div>
              <div className="mt-0.5 truncate text-xs font-bold text-[#1E1D20]">
                {activeProject.name}
              </div>
              <div className="mt-1 font-mono text-[11px] tabular-nums text-[#524D59]">
                Row {activeProject.progress.currentRow} / {getTotalRowsForProject(activeProject)}
              </div>
              <button
                type="button"
                onClick={() => handleStartWorking(activeProject.id)}
                className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#1F2024] py-2 text-xs font-semibold text-[#F5C451] hover:bg-[#2E3036] min-h-[38px]"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Start Working</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() =>
                setNewProjectModal({ open: true, craftType: 'crochet', category: 'standard' })
              }
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#7C6A9A] py-2.5 text-xs font-semibold text-white hover:bg-[#6A5888] min-h-[42px]"
            >
              <Plus className="h-4 w-4" />
              <span>New Pattern</span>
            </button>
          )}
          <PWAInstallButton />
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Compact Top Bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-[#E6E0D4] bg-[#FAF7F2]/95 px-4 backdrop-blur-md sm:px-6 lg:h-16">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigateTo('home')}
              className="font-display text-lg font-bold text-[#1E1D20] lg:hidden whitespace-nowrap"
            >
              PixelYarn
            </button>
            <span className="hidden text-sm font-semibold text-[#1E1D20] lg:inline whitespace-nowrap">
              {NAV_ITEMS.find((n) => n.id === section)?.label}
            </span>
            {activeProject && (
              <span className="truncate text-xs text-[#615B69]">
                · {activeProject.name} ({activeProject.width}×{activeProject.height})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="lg:hidden">
              <PWAInstallButton compact />
            </div>
            {activeProject && (
              <button
                type="button"
                onClick={() => setOverviewProjectId(activeProject.id)}
                className="hidden sm:inline-flex items-center rounded-xl border border-[#E6E0D4] bg-white px-3.5 py-2 text-xs font-semibold text-[#3C3844] hover:bg-[#F3EFE7] whitespace-nowrap min-h-[40px]"
              >
                Overview
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                setNewProjectModal({ open: true, craftType: 'crochet', category: 'standard' })
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#7C6A9A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#6A5888] whitespace-nowrap min-h-[40px]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Project</span>
            </button>
          </div>
        </header>

        {/* Active View Viewport */}
        <main className="flex-1 px-4 pt-5 pb-24 sm:px-6 lg:pb-8">
          {section === 'home' && (
            <HomeView
              projects={projects}
              activeProject={activeProject}
              onNavigate={navigateTo}
              onOpenNewProject={(craft = 'crochet', cat = 'standard') =>
                setNewProjectModal({ open: true, craftType: craft, category: cat })
              }
              onSelectProject={(id) => {
                setActiveProjectId(id);
                setSection('designer');
              }}
              onOpenOverview={(id) => setOverviewProjectId(id)}
              onStartWorking={(id) => handleStartWorking(id)}
              onCreateGuidedMotif={(motif) => {
                const proj = createGuidedMotifProject(motif, preferences.defaultHandedness);
                handleCreateProject(proj, 'designer');
              }}
            />
          )}

          {section === 'photo-studio' && (
            <PhotoStudioView
              defaultHandedness={preferences.defaultHandedness}
              onCreateFromPhoto={(proj) => handleCreateProject(proj, 'designer')}
            />
          )}

          {section === 'designer' && (
            <DesignerView
              project={activeProject}
              showGridLines={preferences.showGridLines}
              onToggleGridLines={() =>
                updatePreferences({
                  ...preferences,
                  showGridLines: !preferences.showGridLines,
                })
              }
              onUpdateProject={handleUpdateProject}
              onOpenOverview={() => activeProject && setOverviewProjectId(activeProject.id)}
              onStartWorking={() => activeProject && handleStartWorking(activeProject.id)}
              onNavigatePalette={() => navigateTo('palette')}
              onNavigatePhotoStudio={() => navigateTo('photo-studio')}
            />
          )}

          {section === 'projects' && (
            <ProjectsView
              projects={projects}
              activeProjectId={preferences.activeProjectId}
              onCreateNew={() =>
                setNewProjectModal({ open: true, craftType: 'crochet', category: 'standard' })
              }
              onSelectProject={(id) => {
                setActiveProjectId(id);
                setSection('designer');
              }}
              onOpenOverview={(id) => setOverviewProjectId(id)}
              onStartWorking={(id) => handleStartWorking(id)}
              onRenameProject={handleRenameProject}
              onDuplicateProject={handleDuplicateProject}
              onDeleteProject={handleDeleteProject}
              onToggleSavedPattern={handleToggleSavedPattern}
            />
          )}

          {section === 'palette' && (
            <PaletteView
              project={activeProject}
              personalPalettes={personalPalettes}
              onUpdateProject={handleUpdateProject}
              onSavePersonalPalette={handleSavePersonalPalette}
              onDeletePersonalPalette={handleDeletePersonalPalette}
            />
          )}

          {section === 'instructions' && (
            <RowInstructionsView
              project={activeProject}
              onStartWorkingAtRow={(rowNum) =>
                activeProject && handleStartWorking(activeProject.id, rowNum)
              }
              onToggleRowComplete={handleToggleRowComplete}
            />
          )}

          {section === 'settings' && (
            <SettingsView
              project={activeProject}
              allProjects={projects}
              preferences={preferences}
              onUpdateProject={handleUpdateProject}
              onUpdatePreferences={updatePreferences}
              onImportProjectsBackup={handleImportBackup}
              onClearAllData={handleClearAllData}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar (5 ergonomically spaced touch targets <= 15% viewport height) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-5 border-t border-[#E6E0D4] bg-white/95 backdrop-blur-md lg:hidden"
        aria-label="Mobile navigation"
      >
        {(
          [
            ['home', 'Home', Home],
            ['photo-studio', 'Photo', Camera],
            ['designer', 'Grid', Grid3X3],
            ['instructions', 'Rows', ListOrdered],
          ] as const
        ).map(([id, label, Icon]) => {
          const active = section === id && !mobileMoreOpen;
          return (
            <button
              key={id}
              type="button"
              onClick={() => navigateTo(id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${
                active ? 'text-[#5D4E7B]' : 'text-[#615B69]'
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? 'text-[#7C6A9A]' : ''}`} />
              <span>{label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setMobileMoreOpen((v) => !v)}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${
            mobileMoreOpen || section === 'projects' || section === 'palette' || section === 'settings'
              ? 'text-[#5D4E7B]'
              : 'text-[#615B69]'
          }`}
        >
          <Menu className="h-5 w-5" />
          <span>More</span>
        </button>
      </nav>

      {/* Mobile More Drawer (Projects, Palette, Settings, Start Working) */}
      {mobileMoreOpen && (
        <div
          className="fixed inset-0 z-40 flex items-end bg-black/45 lg:hidden"
          onClick={() => setMobileMoreOpen(false)}
        >
          <div
            className="w-full rounded-t-3xl border-t border-[#E6E0D4] bg-[#FAF7F2] p-5 pb-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-[#D5CEC0]" />
            <div className="flex items-center justify-between pb-3">
              <span className="font-display text-base font-bold text-[#1E1D20]">Studio Sections</span>
              <button
                type="button"
                onClick={() => setMobileMoreOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#E6E0D4] bg-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigateTo(item.id)}
                    className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-xs font-semibold min-h-[46px] ${
                      section === item.id
                        ? 'border-[#7C6A9A] bg-[#EDE8F5] text-[#4B3D63]'
                        : 'border-[#E6E0D4] bg-white text-[#1E1D20]'
                    }`}
                  >
                    <Icon className="h-4 w-4 text-[#7C6A9A]" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
            {activeProject && (
              <button
                type="button"
                onClick={() => {
                  setMobileMoreOpen(false);
                  handleStartWorking(activeProject.id);
                }}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1F2024] py-3 text-sm font-semibold text-[#F5C451] min-h-[48px]"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Start Working · {activeProject.name}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modals & Dedicated Working Mode */}
      <NewProjectModal
        isOpen={newProjectModal.open}
        defaultHandedness={preferences.defaultHandedness}
        initialCraftType={newProjectModal.craftType}
        initialCategory={newProjectModal.category}
        onClose={() => setNewProjectModal((s) => ({ ...s, open: false }))}
        onCreate={(proj) => handleCreateProject(proj, 'designer')}
      />

      <ProjectOverviewModal
        project={overviewProject}
        onClose={() => setOverviewProjectId(null)}
        onOpenDesigner={() => {
          if (overviewProject) {
            setActiveProjectId(overviewProject.id);
            setOverviewProjectId(null);
            setSection('designer');
          }
        }}
        onStartWorking={() => {
          if (overviewProject) {
            handleStartWorking(overviewProject.id);
          }
        }}
      />

      {workingProject && (
        <WorkingModeView
          project={workingProject}
          onUpdateProject={handleUpdateProject}
          onExit={() => setWorkingProjectId(null)}
        />
      )}

      <OfflineIndicator />
    </div>
  );
}
