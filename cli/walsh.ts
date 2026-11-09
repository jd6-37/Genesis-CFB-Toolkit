// Node CLI: list a BW95 ROM's Walsh Reports, or set one team's report (the Teams tab's editor).
//   tsx cli/walsh.ts BW95.md                          (lists every team's report length)
//   tsx cli/walsh.ts BW95.md OUT.md --team Pitt --offense "…" --defense "…"
// Setting a report trims every other report longer than 650 characters, as the editor does.
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { openRom } from '../src/core/romfile';
import { parseBw95 } from '../src/core/bw95';
import { fixChecksums } from '../src/core/build';
import { sha1Hex } from '../src/core/bytes';
import { readReports, reportLength, REPORT_LIMIT, showReport, writeReports } from '../src/core/walshReports';

const args = process.argv.slice(2);
const opt = (k: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};

async function main() {
  const [inPath, outPath] = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
  const file = await openRom(basename(inPath), new Uint8Array(readFileSync(inPath)));
  if (file.known?.kind !== 'bw95') throw new Error('not a BW95 ROM');
  const rom = file.data;
  const names = parseBw95(rom).map((t) => t.school);
  if (!outPath) {
    readReports(rom).forEach((r, s) => {
      const n = reportLength(r);
      console.log(`${names[s].padEnd(16)} ${String(n).padStart(4)}${n > REPORT_LIMIT ? '  (longer than 650)' : ''}`);
    });
    return;
  }
  const team = opt('--team');
  const slot = names.indexOf(team ?? '');
  if (slot < 0) throw new Error(`--team ${team}: no such team`);
  const now = showReport(readReports(rom)[slot]);
  const trimmed = writeReports(rom, new Map([[slot, { offense: opt('--offense') ?? now.offense, defense: opt('--defense') ?? now.defense }]]));
  fixChecksums(rom);
  writeFileSync(outPath, rom);
  console.log(JSON.stringify({ out: outPath, sha1: await sha1Hex(rom), team: names[slot], trimmed: trimmed.map((s) => names[s]) }));
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
