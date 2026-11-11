// Node CLI: season settings of the 138-team 2026 Season Edition (for tests and emulator checks).
//   tsx cli/season138.ts IN.md                  (lists the conferences)
//   tsx cli/season138.ts IN.md OUT.md SPEC.json
// SPEC: { names?: {"SEC": "Southeastern", …}, conf?: {"Team": "Conference name" or 1-11},
//         weeks?: {"Conference": {start?: 1-12, games?: n}} }  (conference names as in the ROM before the edit)
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { openRom } from '../src/core/romfile';
import { fixChecksums, openRosterRom } from '../src/core/rosterRom';
import { confSizes, playedGames, readWideSeason, writeWideSeason, type WideSeason } from '../src/core/seasonWide';
import { sha1Hex } from '../src/core/bytes';

interface Spec {
  names?: Record<string, string>;
  conf?: Record<string, string | number>;
  weeks?: Record<string, { start?: number; games?: number }>;
}

async function main() {
  const [inp, out, specPath] = process.argv.slice(2);
  if (!inp) throw new Error('usage: tsx cli/season138.ts IN.md [OUT.md SPEC.json]');
  const file = await openRom(basename(inp), new Uint8Array(readFileSync(inp)));
  const rom = openRosterRom(file.data);
  if (!rom.wide) throw new Error('Not the 138-team 2026 Season Edition');
  const teams = rom.teams.map((t) => t.school);
  const data = new Uint8Array(rom.data);
  const s: WideSeason = readWideSeason(data);
  const before = [...s.names];
  const conf = (v: string | number) => {
    const c = typeof v === 'number' ? v - 1 : before.indexOf(v);
    if (!(c >= 0 && c < before.length)) throw new Error(`No conference ${v}`);
    return c;
  };
  if (specPath) {
    const spec: Spec = JSON.parse(readFileSync(specPath, 'utf8'));
    for (const [n, c] of Object.entries(spec.conf ?? {})) {
      const t = teams.indexOf(n);
      if (t < 0) throw new Error(`No team ${n}`);
      s.conf[t] = conf(c);
    }
    for (const [c, w] of Object.entries(spec.weeks ?? {})) {
      const k = conf(c);
      if (w.start !== undefined) s.start[k] = w.start - 1;
      if (w.games !== undefined) s.games[k] = w.games;
    }
    for (const [c, n] of Object.entries(spec.names ?? {})) s.names[conf(c)] = n;
    writeWideSeason(data, s);
  }
  if (out) {
    fixChecksums(data, 'bw95');
    writeFileSync(out, data);
    console.log(JSON.stringify({ out, sha1: await sha1Hex(data) }));
  }
  const sizes = confSizes(s);
  s.names.forEach((n, c) => {
    const list = teams.filter((_, t) => s.conf[t] === c).sort();
    const wk = c < 10 ? ` ${playedGames(s, c)} conference games from week ${s.start[c] + 1} (set ${s.games[c]})` : '';
    console.log(`${String(c + 1).padStart(2)} ${n.padEnd(22)} ${String(sizes[c]).padStart(2)} teams${wk}: ${list.join(', ')}`);
  });
}
main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
