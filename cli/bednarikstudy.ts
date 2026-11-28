// The Nagurski vs the Bednarik (user, 2026-11-28): how often their winners and top fives agree for a team-defense
// share, on finished season saves. Usage: npx tsx cli/bednarikstudy.ts ROM SAVE...
import { readFileSync } from 'node:fs';
import { loadRom, newDynasty } from './dynastysim';
import { importSave } from '../src/core/dynasty/model';
import { seasonView } from '../src/core/dynasty/derive';
import { awardWatch, candidates, POSITION_AWARDS, teamDefenseRank } from '../src/core/dynasty/awards';
const rom = await loadRom(process.argv[2]); const base = newDynasty(rom, 1);
const nag = POSITION_AWARDS.find((a) => a.key === 'nagurski')!, bed = POSITION_AWARDS.find((a) => a.key === 'bednarik')!;
const seasons = process.argv.slice(3).map((f) => { const d = importSave(base, new Uint8Array(readFileSync(f))).dynasty; const v = seasonView(d, d.seasons[0]); return { v, all: candidates(v) }; });
for (const sl of [10, 15, 20]) for (const t of [0.15, 0.2, 0.25]) {
  let s1 = 0, top5 = 0, rank = 0;
  for (const { v, all } of seasons) {
    const A = awardWatch(v, nag, all, 5), B = awardWatch(v, { ...bed, teamDefense: t, shortlist: sl }, all, 5);
    if (A[0].player === B[0].player) s1++;
    top5 += B.filter((c) => A.some((x) => x.player === c.player)).length;
    rank += teamDefenseRank(v)[B[0].team];
  }
  console.log(`shortlist ${sl} share ${t}: same winner ${s1}/${seasons.length}, shared of top 5 ${(top5 / seasons.length).toFixed(1)}, Bednarik winner's team defense rank avg ${(rank / seasons.length).toFixed(2)}`);
}
