// A ROM handed from the Toolkit's Patch tab to the Dynasty app's Get started (user, 2026-11-20: after patching a
// Season Edition, "I want to play a dynasty. take me to the dynasty setup … straight to step 2"). Both apps are the
// same page (appNav.ts), so the ROM is passed in memory: Get started takes it once.
import { go } from '../../appNav';

export interface HandedRom {
  name: string;
  data: Uint8Array;
  /** The original game it was patched from, if it was patched in the Toolkit (kept for upgrades). */
  original?: Uint8Array;
}

let handed: HandedRom | null = null;

/** Opens Get started with this ROM. */
export function startDynastyWith(rom: HandedRom) {
  handed = rom;
  go('/dynasty#start');
  window.scrollTo(0, 0);
}

/** The ROM the Toolkit handed over, once (null if none). */
export function takeHandedRom(): HandedRom | null {
  const r = handed;
  handed = null;
  return r;
}
