// The patch list: `patches.json` in the Elevated repo (github.com/jd6-37/Bill-Walsh-CFB-95-Elevated)
// names the released BPS patches, so the Patch tab always offers the latest release without an app
// update. The app reads the list and the patch files from GitHub, applies the chosen patch in the
// browser, and checks the result against the list. Format: docs/patches.md.

import { applyBps } from './bps';
import { sha1Hex } from './bytes';

export const PATCH_REPO = 'jd6-37/Bill-Walsh-CFB-95-Elevated';
export const PATCH_REPO_URL = `https://github.com/${PATCH_REPO}`;

export interface PatchChoice {
  id: string;
  label: string;
  about?: string;
}

export interface Patch {
  content: string;
  fatigue: string;
  /** Display name of the patched ROM, e.g. "Elevated v1.1.0 (Fixed Fatigue)". */
  name: string;
  /** Path from the repo root. Missing for older releases: listed only so the app recognizes their ROMs. */
  file?: string;
  size?: number;
  sha256?: string;
  /** SHA-1 of the patched ROM. */
  rom: string;
}

export interface Release {
  version: string;
  name: string;
  date?: string;
  patches: Patch[];
}

export interface PatchList {
  app: string;
  tool: 'patches';
  version: 1;
  original: { name: string; sha1: string };
  contents: PatchChoice[];
  fatigue: PatchChoice[];
  /** Newest first. The first release is the current one. */
  releases: Release[];
}

const SHA1 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Checks a parsed patches.json; returns the problems (empty when it's fine). */
export function patchListProblems(v: unknown): string[] {
  const out: string[] = [];
  const m = v as Partial<PatchList>;
  if (!m || typeof m !== 'object') return ['not a JSON object'];
  if (m.tool !== 'patches' || !isStr(m.app)) out.push('not a patch list (tool must be "patches")');
  if (m.version !== 1) out.push(`unknown version ${String(m.version)} (this app reads version 1)`);
  if (!m.original || !SHA1.test(m.original.sha1 ?? '') || !isStr(m.original.name)) out.push('original: needs name and sha1');
  const ids = (list: unknown, what: string) => {
    if (!Array.isArray(list) || !list.length) {
      out.push(`${what}: needs at least one entry`);
      return new Set<string>();
    }
    for (const c of list as PatchChoice[]) if (!isStr(c?.id) || !isStr(c?.label)) out.push(`${what}: every entry needs id and label`);
    return new Set((list as PatchChoice[]).map((c) => c?.id));
  };
  const contents = ids(m.contents, 'contents');
  const fatigue = ids(m.fatigue, 'fatigue');
  if (!Array.isArray(m.releases) || !m.releases.length) out.push('releases: needs at least one release');
  else {
    for (const r of m.releases) {
      if (!isStr(r?.version) || !isStr(r?.name) || !Array.isArray(r?.patches)) {
        out.push('releases: every release needs version, name and patches');
        continue;
      }
      for (const p of r.patches) {
        const at = `${r.version} ${p?.name ?? '(no name)'}`;
        if (!isStr(p?.name)) out.push(`${at}: needs a name`);
        if (!contents.has(p?.content)) out.push(`${at}: content "${p?.content}" isn't in contents`);
        if (!fatigue.has(p?.fatigue)) out.push(`${at}: fatigue "${p?.fatigue}" isn't in fatigue`);
        if (!SHA1.test(p?.rom ?? '')) out.push(`${at}: rom must be the patched ROM's SHA-1 (40 lowercase hex digits)`);
        if (p?.file !== undefined) {
          if (!isStr(p.file) || p.file.startsWith('/') || p.file.includes('..')) out.push(`${at}: file must be a path in the repo`);
          if (!SHA256.test(p.sha256 ?? '')) out.push(`${at}: a patch with a file needs its sha256`);
          if (typeof p.size !== 'number') out.push(`${at}: a patch with a file needs its size`);
        }
      }
    }
    const offered = m.releases[0]?.patches?.filter((p) => p?.file) ?? [];
    const seen = new Set<string>();
    for (const p of offered) {
      const k = `${p.content}/${p.fatigue}`;
      if (seen.has(k)) out.push(`${m.releases[0].version}: two patches for ${k}`);
      seen.add(k);
    }
  }
  return out;
}

/** Where the list and the patch files are read from. `ref` is the branch or tag (main by default;
 *  the page's `?patches=<branch>` picks another one, to try a release before it goes to main). */
export function patchBase(ref = 'main'): string {
  return `https://raw.githubusercontent.com/${PATCH_REPO}/${ref}/`;
}

export function refFromPage(search: string): string {
  const ref = new URLSearchParams(search).get('patches');
  return ref && /^[A-Za-z0-9._/-]+$/.test(ref) && !ref.includes('..') ? ref : 'main';
}

export async function fetchPatchList(base: string): Promise<PatchList> {
  let res: Response;
  try {
    res = await fetch(`${base}patches.json`, { cache: 'no-cache' });
  } catch {
    throw new Error("couldn't reach GitHub");
  }
  if (!res.ok) throw new Error(res.status === 404 ? "the list isn't there yet" : `GitHub answered ${res.status}`);
  let v: unknown;
  try {
    v = await res.json();
  } catch {
    throw new Error("the list isn't valid JSON");
  }
  const problems = patchListProblems(v);
  if (problems.length) throw new Error(`the list has problems: ${problems.slice(0, 3).join('; ')}`);
  return v as PatchList;
}

/** The patches of the current release that can be applied. */
export const offered = (m: PatchList): Patch[] => m.releases[0].patches.filter((p) => p.file);

/** A released ROM by its SHA-1, and whether it's from the current release. */
export function findRelease(m: PatchList, sha1: string): { release: Release; patch: Patch; current: boolean } | null {
  for (const [i, release] of m.releases.entries()) {
    const patch = release.patches.find((p) => p.rom === sha1);
    if (patch) return { release, patch, current: i === 0 };
  }
  return null;
}

async function sha256Hex(d: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', d as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Checks a downloaded patch file against the list. */
export async function checkPatchFile(p: Patch, data: Uint8Array): Promise<void> {
  if (data.length !== p.size || (await sha256Hex(data)) !== p.sha256) {
    throw new Error(
      "The patch file doesn't match the patch list. If a new release was just published, GitHub may still be " +
        'serving the old files: try again in a few minutes.',
    );
  }
}

export async function fetchPatchFile(base: string, p: Patch): Promise<Uint8Array> {
  let res: Response;
  try {
    res = await fetch(base + p.file!.split('/').map(encodeURIComponent).join('/'), { cache: 'no-cache' });
  } catch {
    throw new Error("Couldn't download the patch from GitHub. Check your connection and try again.");
  }
  if (!res.ok) throw new Error(`Couldn't download the patch from GitHub (${res.status}).`);
  const data = new Uint8Array(await res.arrayBuffer());
  await checkPatchFile(p, data);
  return data;
}

/** Applies a listed patch to the original ROM and checks the result's SHA-1. */
export async function applyListed(original: Uint8Array, p: Patch, patchFile: Uint8Array): Promise<{ data: Uint8Array; sha1: string }> {
  const data = applyBps(original, patchFile);
  const sha1 = await sha1Hex(data);
  if (sha1 !== p.rom) throw new Error(`The patched ROM isn't the one the list expects (SHA-1 ${sha1}).`);
  return { data, sha1 };
}

/** File name for a patched ROM: the patch's name with .md, as in the releases. */
export const romFileName = (patchFile: string): string => `${patchFile.split('/').pop()!.replace(/\.bps$/i, '')}.md`;
