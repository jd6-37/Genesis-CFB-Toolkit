// A dynasty's season sim settings (H-016; src/core/simSettings.ts): kept with the dynasty and written into every
// season ROM the app makes. Absent = the ROM's own settings (the defaults the ROM ships with).

import type { Dynasty } from './model';
import { SIM_DEFAULTS, fitRoll, readSimSettings, sameSim, simForRom, simProblems, writeSimSettings, type SimSettings } from '../simSettings';

/** A dynasty's settings; a roll range its scoring chances no longer allow (saved before H-018) is moved into range. */
export const simOf = (d: Dynasty): SimSettings => (d.sim ? fitRoll(d.sim) : SIM_DEFAULTS);

/** The dynasty with new settings (null or the defaults = back to the ROM's own). */
export function setSim(d: Dynasty, s: SimSettings | null): Dynasty {
  if (s) {
    const bad = simProblems(s);
    if (bad.length) throw new Error(bad.join(' '));
  }
  const next = { ...d };
  if (!s || sameSim(s, SIM_DEFAULTS)) delete next.sim;
  else next.sim = { ...s };
  return next;
}

/** Writes the dynasty's settings into a season ROM that has the sim settings mod; older ROMs stay as they are. */
export function writeDynastySim(rom: Uint8Array, d: Dynasty): void {
  if (!d.sim || !readSimSettings(rom)) return;
  writeSimSettings(rom, simForRom(rom, fitRoll(d.sim)));
}
