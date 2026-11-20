import { Handedness, PatternProject, PersonalPalette } from '../types/pattern';

const DB_NAME = 'pixelyarn_studio_db';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_PALETTES = 'personal_palettes';
const STORE_PREFS = 'preferences';

export interface AppPreferences {
  activeProjectId: string | null;
  defaultHandedness: Handedness;
  showGridLines: boolean;
  showRowNumbers: boolean;
}

const DEFAULT_PREFS: AppPreferences = {
  activeProjectId: null,
  defaultHandedness: 'right',
  showGridLines: true,
  showRowNumbers: true,
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PALETTES)) {
        db.createObjectStore(STORE_PALETTES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PREFS)) {
        db.createObjectStore(STORE_PREFS, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllProjects(): Promise<PatternProject[]> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const store = tx.objectStore(STORE_PROJECTS);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = (req.result as PatternProject[]) || [];
        list.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    const raw = localStorage.getItem('pixelyarn_projects_fallback');
    return raw ? (JSON.parse(raw) as PatternProject[]) : [];
  }
}

export async function saveProjectToDB(project: PatternProject): Promise<void> {
  const cloned: PatternProject = JSON.parse(JSON.stringify(project));
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      tx.objectStore(STORE_PROJECTS).put(cloned);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const existing = await getAllProjects();
    const idx = existing.findIndex((p) => p.id === cloned.id);
    if (idx >= 0) existing[idx] = cloned;
    else existing.unshift(cloned);
    localStorage.setItem('pixelyarn_projects_fallback', JSON.stringify(existing));
  }
}

export async function deleteProjectFromDB(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      tx.objectStore(STORE_PROJECTS).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const existing = await getAllProjects();
    localStorage.setItem(
      'pixelyarn_projects_fallback',
      JSON.stringify(existing.filter((p) => p.id !== id))
    );
  }
}

export async function getAllPersonalPalettes(): Promise<PersonalPalette[]> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PALETTES, 'readonly');
      const req = tx.objectStore(STORE_PALETTES).getAll();
      req.onsuccess = () => resolve((req.result as PersonalPalette[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function savePersonalPalette(palette: PersonalPalette): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PALETTES, 'readwrite');
      tx.objectStore(STORE_PALETTES).put(JSON.parse(JSON.stringify(palette)));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore fallback
  }
}

export async function deletePersonalPalette(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PALETTES, 'readwrite');
      tx.objectStore(STORE_PALETTES).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

export async function getPreferences(): Promise<AppPreferences> {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_PREFS, 'readonly');
      const req = tx.objectStore(STORE_PREFS).get('app_prefs');
      req.onsuccess = () => {
        const res = req.result as { key: string; value: AppPreferences } | undefined;
        resolve(res ? { ...DEFAULT_PREFS, ...res.value } : DEFAULT_PREFS);
      };
      req.onerror = () => resolve(DEFAULT_PREFS);
    });
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function savePreferences(prefs: AppPreferences): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PREFS, 'readwrite');
      tx.objectStore(STORE_PREFS).put({ key: 'app_prefs', value: prefs });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

export async function clearAllLocalData(): Promise<void> {
  localStorage.removeItem('pixelyarn_projects_fallback');
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_PROJECTS, STORE_PALETTES, STORE_PREFS], 'readwrite');
      tx.objectStore(STORE_PROJECTS).clear();
      tx.objectStore(STORE_PALETTES).clear();
      tx.objectStore(STORE_PREFS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}
