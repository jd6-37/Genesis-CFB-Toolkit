// Node CLI: apply a season setup to a BW95 ROM (for tests and emulator checks).
//   tsx cli/season.ts IN.md OUT.md SPEC.json [EXPECT.json]
// SPEC: { names?: [4 strings], conf?: {"Team": 0-3}, lockAll?: true, unlockAll?: true,
//         lock?: ["Team"], unlock?: ["Team"], games?: [{team, week (1-16), vs?: "Team", any?: 0-3, home?: bool}] }
// Prints the locked teams' schedules as the game should show them.
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { openRom } from '../src/core/romfile';
import { fixChecksums, openRosterRom } from '../src/core/rosterRom';
import {
  lockAll, lockTeam, readSeason, setConference, setGame, setHome, setName, teamGames, unlockAll, unlockTeam, writeSeason,
  type Season,
} from '../src/core/season';

interface Spec {
  names?: string[];
  conf?: Record<string, number>;
  lockAll?: boolean;
  unlockAll?: boolean;
  lock?: string[];
  unlock?: string[];
  games?: { team: string; week: number; vs?: string; any?: number; home?: boolean }[];
}

async function main() {
  const [inp, out, specPath] = process.argv.slice(2);
  const file = await openRom(basename(inp), new Uint8Array(readFileSync(inp)));
  const rom = openRosterRom(file.data);
  if (rom.game !== 'bw95') throw new Error('Not a BW95 ROM');
  const names = rom.teams.map((t) => t.school);
  const team = (n: string) => {
    const i = names.indexOf(n);
    if (i < 0) throw new Error(`No team ${n}`);
    return i;
  };
  const spec: Spec = JSON.parse(readFileSync(specPath, 'utf8'));
  let s: Season = readSeason(rom.data);
  spec.names?.forEach((n, c) => (s = setName(s, c, n)));
  for (const [n, c] of Object.entries(spec.conf ?? {})) s = setConference(s, team(n), c);
  if (spec.unlockAll) s = unlockAll(s);
  if (spec.lockAll) s = lockAll(s);
  for (const n of spec.lock ?? []) s = lockTeam(s, team(n));
  for (const n of spec.unlock ?? []) s = unlockTeam(s, team(n));
  for (const g of spec.games ?? []) {
    const opp = g.vs !== undefined ? { team: team(g.vs) } : { conf: g.any! };
    const r = setGame(s, team(g.team), g.week - 1, opp, names);
    s = r.season;
    for (const l of r.alsoChanged) console.log('  also:', l);
    if (g.home !== undefined) s = setHome(s, team(g.team), g.week - 1, g.home);
  }
  const data = new Uint8Array(rom.data);
  const res = writeSeason(data, s);
  fixChecksums(data, 'bw95');
  writeFileSync(out, data);
  const back = readSeason(data);
  const sched: Record<string, string[]> = {};
  for (let t = 0; t < 36; t++) {
    const g = teamGames(back, t);
    if (!g.length) continue;
    sched[names[t]] = g.map((x) => `${x.home ? 'vs' : '@'} ${'team' in x.opponent ? names[x.opponent.team] : `any ${back.names[x.opponent.conf]}`}`);
  }
  console.log(JSON.stringify({ out, locked: res.locked, walshSkipped: res.walshSkipped, names: back.names, schedules: sched }, null, 1));
  if (process.argv[5]) {
    // Machine-readable expectation for emulator checks: per locked team, [opponent team or -1-conference, home] per week.
    const locked: Record<number, [number, boolean][]> = {};
    for (let t = 0; t < 36; t++) {
      const g = teamGames(back, t);
      if (g.length) locked[t] = g.map((x) => ['team' in x.opponent ? x.opponent.team : -1 - x.opponent.conf, x.home]);
    }
    writeFileSync(process.argv[5], JSON.stringify({ conf: back.conf, locked }));
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
