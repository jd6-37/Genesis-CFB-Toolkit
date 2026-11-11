// The 138-team 2026 Season Edition (Elevated v2.0.0 on): a 4 MB ROM whose team table (0x28DC) grew to
// one pointer per FBS team, with the per-team tables above 2 MB. The team blocks have the original
// format (names, group, roster), so the roster and rating code works on them; only the team count and
// the tables move. Layout from the build (claude/tools/t138_build.mts in the project notes):
//   0x218000 "OVR1" + N x {OFF, DEF}      0x218200 CPU style sets, 8 x 32 bytes (team t: byte t>>3, bit t&7)
//   0x218300 menu order, 0x218400 inverse  0x218500 end zones, N words     0x218700 fight songs, N bytes
//   0x218800 Walsh paragraph table, 6 + 2N longs (text from 0x219000)       0x230000 the new team blocks

import { rl } from './bytes';
import { isWideBw95 } from './romfile';

export const WIDE = {
  teamTable: 0x0028dc,
  ovr: 0x218000,
  styles: 0x218200,
  styleSet: 32,
  order: 0x218300,
  inverse: 0x218400,
  endZones: 0x218500,
  songs: 0x218700,
  walshTable: 0x218800,
  walsh: 0x219000,
} as const;

/** Teams in a wide ROM's team table (pointers to blocks, up to the first entry that isn't one). */
export function wideTeamCount(d: Uint8Array): number {
  let n = 0;
  while (n < 256) {
    const b = rl(d, WIDE.teamTable + 4 * n);
    if (b < 0x200 || b >= d.length || b === 0xffffffff) break;
    n++;
  }
  return n;
}

/** Why a wide ROM isn't the layout the tools know; empty if it is. */
export function wideLayoutProblems(d: Uint8Array): string[] {
  if (!isWideBw95(d)) return ['not the 138-team edition'];
  const n = wideTeamCount(d);
  if (n <= 36 || n > 256) return [`the team table has ${n} teams`];
  if (String.fromCharCode(...d.subarray(WIDE.ovr, WIDE.ovr + 4)) !== 'OVR1') return ['no team OVR table at 0x218000'];
  const intro = rl(d, WIDE.walshTable);
  if (String.fromCharCode(...d.subarray(intro, intro + 15)) !== 'Welcome to {c}.') return ['no Walsh Report table at 0x218800'];
  return [];
}

/** True for a wide ROM with the known layout. */
export const isWide = (d: Uint8Array) => isWideBw95(d) && !wideLayoutProblems(d).length;

/** How many teams a BW95 ROM has: 36, or the wide ROM's count. */
export const teamsOf = (d: Uint8Array) => (isWide(d) ? wideTeamCount(d) : 36);
