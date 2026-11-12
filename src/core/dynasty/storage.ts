// Keeps dynasties in the browser (IndexedDB), and the team art taken from the user's ROM in a store
// of its own: the art is game art, so it never goes into a dynasty file the user exports.

import { DYNASTY_FILE, dynastyFromFile, type Dynasty } from './model';
import type { Picture } from '../render';

const DB = 'genesis-cfb-dynasty';
const DYN = 'dynasties';
const ART = 'art';

/** Team logo (small mascot), helmet and wordmark, per ROM team. */
export interface TeamArt {
  logo: Picture | null;
  helmet: Picture | null;
  word: Picture | null;
}

export interface DynastySummary {
  id: string;
  name: string;
  created: string;
  updated: string;
  year: number;
  userTeams: number[];
  schools: string[];
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DYN)) db.createObjectStore(DYN, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(ART)) db.createObjectStore(ART);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error("This browser can't keep dynasties (storage is off or full)."));
  });
}

async function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error ?? new Error('Storage error.'));
      tx.onabort = () => reject(tx.error ?? new Error('Storage error (the browser may be out of space).'));
    });
  } finally {
    db.close();
  }
}

interface Stored {
  id: string;
  updated: string;
  dynasty: Dynasty;
}

export async function listDynasties(): Promise<DynastySummary[]> {
  const all = (await run<Stored[]>(DYN, 'readonly', (s) => s.getAll() as IDBRequest<Stored[]>)) ?? [];
  return all
    .map(({ dynasty: d, updated }) => ({
      id: d.id,
      name: d.name,
      created: d.created,
      updated,
      year: d.seasons[d.seasons.length - 1].year,
      userTeams: d.userTeams,
      schools: d.userTeams.map((t) => d.teams[t]?.school ?? '?'),
    }))
    .sort((a, b) => b.updated.localeCompare(a.updated));
}

export async function loadDynasty(id: string): Promise<Dynasty | null> {
  const r = await run<Stored | undefined>(DYN, 'readonly', (s) => s.get(id) as IDBRequest<Stored | undefined>);
  return r ? r.dynasty : null;
}

export async function saveDynasty(d: Dynasty): Promise<void> {
  await run(DYN, 'readwrite', (s) => s.put({ id: d.id, updated: new Date().toISOString(), dynasty: d }));
}

export async function deleteDynasty(id: string): Promise<void> {
  await run(DYN, 'readwrite', (s) => s.delete(id));
  await run(ART, 'readwrite', (s) => s.delete(id));
}

export async function loadArt(id: string): Promise<TeamArt[] | null> {
  return (await run<TeamArt[] | undefined>(ART, 'readonly', (s) => s.get(id) as IDBRequest<TeamArt[] | undefined>)) ?? null;
}

export async function saveArt(id: string, art: TeamArt[]): Promise<void> {
  await run(ART, 'readwrite', (s) => s.put(art, id));
}

// ---- dynasty files

/** The file a user downloads to keep or move a dynasty (JSON; no game art). */
export function dynastyFileText(d: Dynasty): string {
  return JSON.stringify({ ...d, ...DYNASTY_FILE });
}

export function dynastyFileName(d: Dynasty): string {
  const slug = d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'dynasty';
  return `${slug}-${d.seasons[d.seasons.length - 1].year}.dynasty.json`;
}

export function readDynastyFile(text: string): Dynasty {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("This isn't a dynasty file (it isn't JSON).");
  }
  return dynastyFromFile(json);
}
