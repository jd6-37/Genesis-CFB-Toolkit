// The CFP bracket model (bracket.ts) against finished season saves: every game of the bracket is found in the save's
// playoff weeks, each round's winners meet in the next, and the title game's winner is the season's champion.
// Usage: npx tsx cli/brackettest.ts ROM SAVE...
import { readFileSync } from 'node:fs';
import { loadRom, newDynasty } from './dynastysim';
import { importSave } from '../src/core/dynasty/model';
import { seasonView } from '../src/core/dynasty/derive';
import { bracketOf } from '../src/core/dynasty/bracket';
const rom = await loadRom(process.argv[2]);
const base = newDynasty(rom, 1);
let fails = 0;
for (const f of process.argv.slice(3)) {
  const d = importSave(base, new Uint8Array(readFileSync(f))).dynasty;
  const v = seasonView(d, d.seasons[0]);
  const b = bracketOf(d, v);
  const name = f.split('/').pop();
  if (!b) { console.log(name, 'no bracket'); fails++; continue; }
  const problems: string[] = [];
  const all = b.games.flat();
  const missing = all.filter((g) => g.game === null).length;
  if (missing) problems.push(`${missing} games not found`);
  const unplayed = all.filter((g) => !g.a.won && !g.b.won).length;
  if (unplayed) problems.push(`${unplayed} without a winner`);
  // Every playoff-week game of the save is in the bracket.
  const inBracket = new Set(all.map((g) => g.game));
  const extra = v.games.filter((g) => g.week >= v.lastRegularWeek + 2 && !inBracket.has(g.index)).length;
  if (extra) problems.push(`${extra} playoff games not in the bracket`);
  if (b.champion !== v.champion) problems.push(`champion ${b.champion} != ${v.champion}`);
  if (!b.final) problems.push('field not final');
  if (problems.length) fails++;
  console.log(name, b.size, b.rounds.map((r, i) => `${r} ${b.games[i].length}`).join(', '), '→', d.teams[b.champion ?? 0]?.school, problems.length ? 'FAIL: ' + problems.join('; ') : 'ok');
}
console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);
