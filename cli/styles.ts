// Node CLI: list or change the CPU offense and defense styles of a BW95 ROM's teams.
//   tsx cli/styles.ts IN.md                                   (lists every team's styles)
//   tsx cli/styles.ts IN.md OUT.md "Florida State=Option,3-4" "Army=Pro Style" "Navy=,Multiple"
// Teams by school name as the ROM has them (a Team Swap result's new names) or by team number.
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { openRom } from '../src/core/romfile';
import { fixChecksums, openRosterRom } from '../src/core/rosterRom';
import { DEFENSE, OFFENSE, parseStyle, readStyle, styleInfo, styleProblems, writeStyle } from '../src/core/styles';
import { sha1Hex } from '../src/core/bytes';

async function main() {
  const [inp, out, ...changes] = process.argv.slice(2);
  if (!inp) throw new Error('usage: tsx cli/styles.ts IN.md [OUT.md "Team=Offense,Defense" ...]');
  const file = await openRom(basename(inp), new Uint8Array(readFileSync(inp)));
  const rom = openRosterRom(file.data);
  if (rom.game !== 'bw95') throw new Error('Not a BW95 ROM');
  const p = styleProblems(rom.data);
  if (p.length) throw new Error(p.join('; '));
  const names = rom.teams.map((t) => t.school);
  const data = new Uint8Array(rom.data);
  for (const c of changes) {
    const [who, both = ''] = c.split('=');
    const t = /^\d+$/.test(who) ? +who : names.indexOf(who);
    if (!(t >= 0 && t < names.length)) throw new Error(`No team ${who}`);
    const [o, d] = both.split(',');
    const now = readStyle(data, t);
    const flag = writeStyle(data, t, {
      offense: o ? parseStyle('offense', o) : now.offense,
      defense: d ? parseStyle('defense', d) : now.defense,
    });
    if (flag) console.log(`  ${names[t]}: 3-4 roster flag changed with the defense`);
  }
  if (out) {
    fixChecksums(data, 'bw95');
    writeFileSync(out, data);
  }
  const info = styleInfo(data);
  console.log(JSON.stringify({ out: out ?? null, sha1: out ? await sha1Hex(data) : undefined, veer: info.veer, elevated: info.elevated }));
  for (let t = 0; t < names.length; t++) {
    const st = readStyle(data, t);
    console.log(`${String(t).padStart(2)} ${names[t].padEnd(16)} ${OFFENSE[st.offense].padEnd(10)} ${DEFENSE[st.defense]}`);
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
