// Kept saves (user, 2026-11-27): the dynasty file keeps the last 10 uploaded save files, gzipped, so each can be
// downloaded again (named for its season's ROM) or deleted. A deleted file only removes the copy: the import's
// results and stats stay (they come from SaveImport.data, which every import keeps).
import { fromBase64, toBase64, type Dynasty, type DSeason, type SaveImport } from './model';
import { seasonRomName } from './offseason';

export const KEEP_SAVES = 10;

async function through(bytes: Uint8Array, s: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(s));
  return new Uint8Array(await out.arrayBuffer());
}
export const gzipBytes = (b: Uint8Array) => through(b, new CompressionStream('gzip'));
export const gunzipBytes = (b: Uint8Array) => through(b, new DecompressionStream('gzip'));

/** Every import with its season, newest first. */
export function allImports(d: Dynasty): { season: DSeason; imp: SaveImport }[] {
  return d.seasons.flatMap((season) => season.imports.map((imp) => ({ season, imp })))
    .sort((a, b) => (a.imp.at < b.imp.at ? 1 : a.imp.at > b.imp.at ? -1 : 0));
}

/** Only the newest KEEP_SAVES imports keep their file. */
export function trimKept(d: Dynasty): Dynasty {
  const keep = new Set(allImports(d).filter((x) => x.imp.file).slice(0, KEEP_SAVES).map((x) => x.imp));
  let changed = false;
  const seasons = d.seasons.map((s) => {
    if (!s.imports.some((i) => i.file && !keep.has(i))) return s;
    changed = true;
    return { ...s, imports: s.imports.map((i) => (i.file && !keep.has(i) ? dropFile(i) : i)) };
  });
  return changed ? { ...d, seasons } : d;
}

const dropFile = (i: SaveImport): SaveImport => { const { file: _f, fileName: _n, ...rest } = i; return rest; };

/** The dynasty with the file kept on the import made at `at` in the last season, trimmed to KEEP_SAVES. */
export async function keepFile(d: Dynasty, at: string, file: Uint8Array, fileName: string): Promise<Dynasty> {
  const gz = toBase64(await gzipBytes(file));
  const last = d.seasons[d.seasons.length - 1];
  const imports = last.imports.map((i) => (i.at === at ? { ...i, file: gz, fileName } : i));
  return trimKept({ ...d, seasons: [...d.seasons.slice(0, -1), { ...last, imports }] });
}

/** The dynasty without the kept file of one import (its results stay). */
export function deleteKept(d: Dynasty, year: number, at: string): Dynasty {
  return { ...d, seasons: d.seasons.map((s) => (s.year !== year ? s : { ...s, imports: s.imports.map((i) => (i.at === at ? dropFile(i) : i)) })) };
}

/** The name a kept save downloads as: its season ROM's name with .srm, so the game finds it next to that ROM.
 *  The first season played on the user's own ROM (no app name): the name the file was uploaded with. */
export function keptName(d: Dynasty, season: DSeason, imp: SaveImport): string {
  if (season.romId) return seasonRomName(d, season).replace(/\.(md|bin|gen)$/i, '') + '.srm';
  return imp.fileName || `${season.year} save.srm`;
}

export async function keptBytes(imp: SaveImport): Promise<Uint8Array> {
  if (!imp.file) throw new Error('This save file is no longer kept.');
  return gunzipBytes(fromBase64(imp.file));
}
