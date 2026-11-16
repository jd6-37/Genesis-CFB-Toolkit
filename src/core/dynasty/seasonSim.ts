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

// The sim stat multipliers (H-021, src/core/simStats.ts): kept with the dynasty like the sim settings.
import { STATS_DEFAULTS, readSimStats, sameStats, statsProblems, writeSimStats, type SimStats } from '../simStats';

export const statsOf = (d: Dynasty): SimStats => d.simStats ?? STATS_DEFAULTS;

/** The dynasty with new multipliers (null or the defaults = back to the ROM's own). */
export function setStats(d: Dynasty, s: SimStats | null): Dynasty {
  if (s) {
    const bad = statsProblems(s);
    if (bad.length) throw new Error(bad.join(' '));
  }
  const next = { ...d };
  if (!s || sameStats(s, STATS_DEFAULTS)) delete next.simStats;
  else next.simStats = { ...s };
  return next;
}

/** Writes the dynasty's multipliers into a season ROM that has them (2026 test39 / 1994 test42 on); older ROMs stay. */
export function writeDynastyStats(rom: Uint8Array, d: Dynasty): void {
  if (!d.simStats || !readSimStats(rom)) return;
  writeSimStats(rom, d.simStats);
}
