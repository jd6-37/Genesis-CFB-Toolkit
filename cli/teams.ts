// Node CLI: list or change a BW95 ROM's team settings, as the Teams tab does: styles, team OVRs
// (offense, defense) and home weather.
//   tsx cli/teams.ts IN.md                                     (lists every team)
//   tsx cli/teams.ts IN.md OUT.md --style "Navy=Option,3-4" --ovr "Navy=75,85" --weather "Navy=5,2,2,1"
// --ovr takes the shown OVRs 0-99 (an empty part keeps that one: "Navy=,85"); --weather the Fair,
// Windy, Rain and Snow weights 0-15. Each flag can be given more than once. Teams by school name as
// the ROM has them (a Team Swap result's new names) or by team number.
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { openRom } from '../src/core/romfile';
import { fixChecksums, openRosterRom } from '../src/core/rosterRom';
import { DEFENSE, OFFENSE, parseStyle, readStyle, styleProblems, writeStyle } from '../src/core/styles';
import { hasOvrTable, ratingProblems, readRating, readSim, readWeather, writeRating, writeWeather, type Weather } from '../src/core/teamRatings';
import { sha1Hex } from '../src/core/bytes';

async function main() {
  const args = process.argv.slice(2);
  const take = (flag: string) => {
    const out: string[] = [];
    for (let i = args.indexOf(flag); i >= 0; i = args.indexOf(flag)) out.push(...args.splice(i, 2).slice(1));
    return out;
  };
  const styles = take('--style');
  const ovrs = take('--ovr');
  const weathers = take('--weather');
  const [inp, out] = args;
  if (!inp) throw new Error('usage: tsx cli/teams.ts IN.md [OUT.md --style "Team=Offense,Defense" --ovr "Team=OFF,DEF" --weather "Team=F,W,R,S"]');
  const file = await openRom(basename(inp), new Uint8Array(readFileSync(inp)));
  const rom = openRosterRom(file.data);
  if (rom.game !== 'bw95') throw new Error('Not a BW95 ROM');
  const p = [...styleProblems(rom.data), ...ratingProblems(rom.data)];
  if (p.length) throw new Error(p.join('; '));
  const names = rom.teams.map((t) => t.school);
  const data = new Uint8Array(rom.data);
  const team = (c: string) => {
    const [who, rest = ''] = c.split('=');
    const t = /^\d+$/.test(who) ? +who : names.indexOf(who);
    if (!(t >= 0 && t < names.length)) throw new Error(`No team ${who}`);
    return { t, parts: rest.split(',') };
  };
  const int = (v: string, max: number) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > max) throw new Error(`${v} isn't a whole number 0-${max}`);
    return n;
  };
  for (const c of styles) {
    const { t, parts: [o, d] } = team(c);
    const now = readStyle(data, t);
    writeStyle(data, t, { offense: o ? parseStyle('offense', o) : now.offense, defense: d ? parseStyle('defense', d) : now.defense });
  }
  for (const c of ovrs) {
    const { t, parts: [o, d] } = team(c);
    const now = readRating(data, t);
    writeRating(data, t, { off: o ? int(o, 99) : now.off, def: d ? int(d, 99) : now.def });
  }
  for (const c of weathers) {
    const { t, parts } = team(c);
    if (parts.length !== 4) throw new Error(`${c}: give four weights, Fair,Windy,Rain,Snow`);
    writeWeather(data, t, parts.map((v) => int(v, 15)) as Weather);
  }
  if (out) {
    fixChecksums(data, 'bw95');
    writeFileSync(out, data);
  }
  console.log(JSON.stringify({ out: out ?? null, sha1: out ? await sha1Hex(data) : undefined, ovrTable: hasOvrTable(data) }));
  for (let t = 0; t < names.length; t++) {
    const st = readStyle(data, t);
    const r = readRating(data, t);
    const s = readSim(data, t);
    console.log(
      `${String(t).padStart(2)} ${names[t].padEnd(16)} ${OFFENSE[st.offense].padEnd(10)} ${DEFENSE[st.defense].padEnd(9)}` +
        ` OVR ${String(r.off).padStart(2)}/${String(r.def).padStart(2)} (sim ${String(s.off).padStart(3)}/${String(s.def).padStart(3)})` +
        `  weather ${readWeather(data, t).join(',')}`,
    );
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
