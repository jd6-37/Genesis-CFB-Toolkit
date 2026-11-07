// Builds src/core/rosterStockDists.json, the stock rating distributions the CFB 27 conversion
// matches: per game, position role and rating, how many stock players sit at each step 0-15.
//   npx tsx cli/stockdists.ts OUT.json BW95 CF96 CF97     (the unmodified games; .md/.bin/.gen or .zip)
// The committed file must come out byte-identical (cli/rostertest.ts checks it with stock ROMs).
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openRom } from '../src/core/romfile';
import { getRating, openRosterRom, readPlayer, teamLayout } from '../src/core/rosterRom';
import { GROUP_ATTRS } from '../src/core/rosterLayouts';

/** Role of a slot, from its label (BW95 stock 4-3 and 3-4 labels; CF96/97). */
export function slotRole(label: string): string {
  const l = label.replace(/\d+$/, '');
  const map: Record<string, string> = {
    QB: 'QB', HB: 'HB', FB: 'FB',
    LT: 'OL', LG: 'OL', C: 'OL', RG: 'OL', RT: 'OL', T: 'OL', G: 'OL',
    SE: 'WR', FL: 'WR', WR: 'WR', TE: 'TE', K: 'K', P: 'P',
    LDE: 'DE', RDE: 'DE', DE: 'DE', LDT: 'DT', RDT: 'DT', DT: 'DT', NT: 'DT',
    LOLB: 'LB', ROLB: 'LB', MLB: 'LB', LILB: 'LB', RILB: 'LB', PLB: 'LB', LB: 'LB',
    LCB: 'CB', RCB: 'CB', SS: 'S', FS: 'S',
  };
  const r = map[l];
  if (!r) throw new Error(`no role for slot label ${label}`);
  return r;
}

/** The distributions file as a string, from the stock ROMs' bytes (as loaded, e.g. out of a zip). */
export function stockDistributionsJson(roms: Uint8Array[]): string {
  const result: { format: string; version: number; note: string; games: Record<string, unknown> } = {
    format: 'genesis-cfb-stock-rating-distributions',
    version: 1,
    note: 'counts[step] = number of stock players at that step (0-15), per game, role and rating; Weight steps are 140 + 16 x step lb',
    games: {},
  };
  for (const data of roms) {
    const rom = openRosterRom(data);
    if (rom.elevated) throw new Error('Not a stock ROM: it has the Elevated roster layout.');
    const roles: Record<string, { group: string; slots: number; ratings: Record<string, number[]> }> = {};
    for (const t of rom.teams) for (const def of teamLayout(rom, t.index)) {
      const role = slotRole(def.label);
      const r = (roles[role] ??= { group: def.group, slots: 0, ratings: {} });
      if (r.group !== def.group) throw new Error(`role ${role} mixes groups ${r.group}/${def.group}`);
      r.slots++;
      const p = readPlayer(rom, t.index, def.slot);
      for (const a of GROUP_ATTRS[def.group]) (r.ratings[a] ??= Array(16).fill(0))[getRating(p, def, a)!]++;
    }
    result.games[rom.game] = { romSha1: createHash('sha1').update(data).digest('hex'), teams: rom.teams.length, roles };
  }
  return JSON.stringify(result, null, 1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [out, ...paths] = process.argv.slice(2);
  if (!out || paths.length === 0) {
    console.error('usage: tsx cli/stockdists.ts OUT.json BW95 CF96 CF97');
    process.exit(2);
  }
  const roms = await Promise.all(paths.map(async (p) => (await openRom(basename(p), new Uint8Array(readFileSync(p)))).data));
  writeFileSync(out, stockDistributionsJson(roms));
  console.log('wrote', out);
}
