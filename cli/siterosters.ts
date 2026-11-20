// The website's Rosters section data (user, 2026-11-19): every team's 32 as the game's Team Rosters shows them, read
// from the ROMs, plus each edition's logo sheet. The site follows the latest test ROMs for now ("soon only public
// releases"), so this runs again on each new mainline. Writes public/data/rosters/<edition>.json and
// public/media/rosters/logos-<edition>.png (owner's exceptions to "no ROM data in the repo", 2026-11-19).
//
//   npm run site:rosters -- ELEVATED_2026 ELEVATED_1994 BW95
//
// The historic teams come from the 2026 ROM (Exhibition teams after the 138 season teams; mainline since test72).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { openRom } from '../src/core/romfile';
import { jerseyNumber, openRosterRom, readPlayer, teamLayout } from '../src/core/rosterRom';
import { GROUP_ATTRS, type Attr } from '../src/core/rosterLayouts';
import { readFineOffsets } from '../src/core/dynasty/fine';
import { readNamesTable } from '../src/core/dynasty/dynastyArea';
import { ovrAt, roleOfPos, setRatingScale, shownFineInSlot, valueOfFine } from '../src/core/dynasty/ratings';
import { CLASSES } from '../src/core/dynasty/model';
import { SCHOOL_STATE } from '../src/core/dynasty/schoolStates';
import { teamArt } from '../src/core/dynasty/art';
import { hasV8 } from '../src/core/ratingsV8';
import { readRating } from '../src/core/teamRatings';
import { readWideSeason } from '../src/core/seasonWide';
import { readManifest } from '../src/core/manifest';
import { parseBw95 } from '../src/core/bw95';
import { setupTeamsOf, teamsOf } from '../src/core/wide';
import { ownUniforms } from '../src/core/kits';
import { olPatchState, OL_PATCH } from '../src/core/rosterOlPatch';
import type { EditionData, EditionId, RatingKey, RosterPlayer, TeamRoster } from '../src/site/rosters/types';
import { encodePng } from './png';
import { impactSlots, fineValue } from '../src/core/dynasty/impact';

/** The historic teams' hand-picked impact slots (hist.py's table HIM, 3 bytes a team, 0xFF = none), found through the
 * pick hook HPK's `mulu.w #3,d1 / lea HIM,a1`; null when the ROM has none. */
function historicImpact(rom: Uint8Array): ((k: number) => number[] | null) {
  const pat = [0xc2, 0xfc, 0x00, 0x03, 0x43, 0xf9];
  for (let a = 0x2d9100; a < 0x2d9400; a++) {
    if (pat.every((b, i) => rom[a + i] === b)) {
      const him = (rom[a + 6] << 24 | rom[a + 7] << 16 | rom[a + 8] << 8 | rom[a + 9]) >>> 0;
      return (k) => {
        const s = [...rom.subarray(him + 3 * k, him + 3 * k + 3)].filter((x) => x !== 0xff && (x <= 3 || (x >= 9 && x <= 14) || (x >= 16 && x <= 30)));
        return s.length ? s : null;
      };
    }
  }
  return () => null;
}

/** The 3-4 bit of a team (POSBITS, through the roster labels' `lea` at 0x06B0FE). */
const fourThreeOf = (rom: Uint8Array, t: number) => {
  const a = (rom[0x06b100] << 24 | rom[0x06b101] << 16 | rom[0x06b102] << 8 | rom[0x06b103]) >>> 0;
  return ((rom[a + (t >> 3)] >> (t & 7)) & 1) === 0;
};

const KEY: Record<Attr, RatingKey> = {
  Speed: 'spd', Quickness: 'qck', Awareness: 'int', Hands: 'hnd', Power: 'pwr', Range: 'rng', Accuracy: 'acc', Tackling: 'tck', Blocking: 'blk', Weight: 'wt',
};
const CELL: [number, number] = [72, 58];
const SHEET_COLS = 12;

const rgb = (w: number) => [(w >> 1) & 7, (w >> 5) & 7, (w >> 9) & 7];
const hex = (w: number) => '#' + rgb(w).map((c) => (c * 36).toString(16).padStart(2, '0')).join('');
const lum = (w: number) => {
  const f = (c: number) => { const v = (c * 36) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = rgb(w).map(f);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const dist = (a: number, b: number) => rgb(a).reduce((s, c, i) => s + Math.abs(c - rgb(b)[i]), 0);
const isWhite = (w: number) => Math.min(...rgb(w)) >= 6;
/** One step darker on each channel (Genesis color word). */
const darker = (w: number) => rgb(w).map((c) => Math.max(0, c - 1)).reduce((a, c, i) => a | (c << (1 + 4 * i)), 0);
export const slug = (s: string) => s.toLowerCase().replace(/&/g, '').replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function load(path: string) {
  return (await openRom(path, new Uint8Array(readFileSync(path)))).data;
}

/** The names table the game reads (NAMEGET's `lea NAM1,a0` at 0x2B1078; a ROM with historic teams has a longer one). */
function namesAt(d: Uint8Array): number {
  const a = ((d[0x2b107a] << 24) | (d[0x2b107b] << 16) | (d[0x2b107c] << 8) | d[0x2b107d]) >>> 0;
  return d[0x2b1078] === 0x41 && d[0x2b1079] === 0xf9 && a < d.length - 4 && String.fromCharCode(...d.subarray(a, a + 4)) === 'NAM1' ? a : 0x2c0000;
}

/** The base school of a historic team's name ("Boston Col. '84" → "Boston College"), for its state. */
const HIST_SCHOOL: Record<string, string> = { 'Boston Col.': 'Boston College', FSU: 'Florida State' };

function edition(rom: Uint8Array, id: EditionId, from: number, to: number, build: string): EditionData {
  const rr = openRosterRom(rom, false, id === 'historic');
  const v8 = hasV8(rom);
  setRatingScale(v8);
  const n = setupTeamsOf(rom);
  const blocks = parseBw95(rom, n);
  const art = teamArt(rom, n);
  const names = id === 'original' ? null : readNamesTable(rom, n, namesAt(rom));
  const fine = id !== 'original';
  const season = id === '2026' || id === '1994' ? readWideSeason(rom) : null;
  const olPlus = olPatchState(rom) === 'installed' ? OL_PATCH.pounds : 0;
  const teams: TeamRoster[] = [];
  const hist = id === 'historic' ? historicImpact(rom) : null;
  const sheetRows = Math.ceil((to - from) / SHEET_COLS);
  const sheet = new Uint8Array(SHEET_COLS * CELL[0] * sheetRows * CELL[1] * 4);
  for (let t = from; t < to; t++) {
    const rt = rr.teams[t];
    const nib: (number[] | null)[] = Array(32).fill(null);
    const slotIndex: number[] = [];
    const players: RosterPlayer[] = teamLayout(rr, t).map((def, idx) => {
      const pl = readPlayer(rr, t, def.slot);
      const offs = fine ? readFineOffsets(rom, t, def.slot) : [0, 0, 0, 0, 0, 0];
      nib[def.slot] = GROUP_ATTRS[def.group].map((_, i) => fineValue(pl.ratings[i], offs[i] ?? 0));
      slotIndex[def.slot] = idx;
      const r: Partial<Record<RatingKey, number>> = {};
      const values: Partial<Record<Attr, number>> = {};
      let wt = 0;
      GROUP_ATTRS[def.group].forEach((a, i) => {
        const f = Math.max(0, 16 * pl.ratings[i] + offs[i]);
        if (a === 'Weight') { wt = 140 + f + (def.group === 'OL' ? olPlus : 0); r.wt = wt; values.Weight = 140 + f; return; }
        r[KEY[a]] = shownFineInSlot(def.slot, def.group, a, f);
        values[a] = valueOfFine(f);
      });
      const nm = names?.[t]?.[def.slot] ?? null;
      const cls = nm && nm.cls <= 4 ? CLASSES[nm.cls] : '';
      return [def.label, jerseyNumber(pl.numberByte), nm?.first ?? '', nm?.last ?? '', cls, ovrAt(values, roleOfPos(def.pool[0])), wt, r, def.group];
    });
    const home = blocks[t].home;
    const own = ownUniforms(rom, t);
    // The school's two main colors (user, 2026-11-20: "The header color should be the dark primary color of a school.
    // The side bar the lighter color"; before, a light main color fell back to dark gray: "why isn't Air Force header
    // blue? And Hawaii green?"). The first: the team color, else the helmet's, else the colored jersey. The second: the
    // first uniform color clearly different from it. The darker of the two is the header (darkened until it reads on
    // the white card), the lighter one the side bar (light gray when a school has one color).
    const colored = (w: number) => !isWhite(w) && (Math.max(...rgb(w)) - Math.min(...rgb(w)) >= 2 || lum(w) < 0.02);
    const first = [home[3], home[5], own.home[9], own.away[9], own.home[10], own.away[10]].find(colored) ?? 0x0444;
    const cands = [own.home[11], own.home[9], own.home[5], own.home[7], own.home[14], own.home[3], own.away[11], own.away[9], own.away[5], own.away[7], own.away[14], own.away[3]];
    const sec = cands.find((c) => dist(c, first) >= 4 && !isWhite(c));
    // A gray or black trim color is the header only when the main color is too light (Purdue, UCF: black and gold),
    // not over a dark main color (Western Kentucky's red); then the side bar is the next lighter color.
    const gray = (w: number) => Math.max(...rgb(w)) - Math.min(...rgb(w)) <= 1;
    const keep = sec !== undefined && gray(sec) && lum(first) <= 0.35;
    let color = sec !== undefined && !keep && lum(sec) < lum(first) ? sec : first;
    const light = keep ? cands.find((c) => dist(c, first) >= 4 && !isWhite(c) && lum(c) > lum(first)) : sec === undefined ? undefined : color === sec ? first : sec;
    while (lum(color) > 0.35) color = darker(color);
    const stripe = light === undefined ? '#c8c8c8' : hex(light);
    // The logo, centered in its sheet cell.
    let logo: [number, number] | null = null;
    const pic = art[t]?.logo;
    if (pic) {
      const k = t - from, cx = (k % SHEET_COLS) * CELL[0], cy = Math.floor(k / SHEET_COLS) * CELL[1];
      const ox = cx + Math.floor((CELL[0] - pic.width) / 2), oy = cy + Math.floor((CELL[1] - pic.height) / 2);
      const W = SHEET_COLS * CELL[0];
      for (let y = 0; y < Math.min(pic.height, CELL[1]); y++) {
        for (let x = 0; x < Math.min(pic.width, CELL[0]); x++) {
          const s = 4 * (y * pic.width + x), d = 4 * ((oy + y) * W + ox + x);
          sheet.set(pic.data.subarray(s, s + 4), d);
        }
      }
      logo = [cx, cy];
    }
    const base = id === 'historic' ? rt.school.replace(/\s*'\d\d$/, '') : rt.school;
    const conf = season ? (season.conf[t] < season.names.length ? season.names[season.conf[t]] : '') : '';
    teams.push({
      id: slug(rt.school), school: rt.school, nickname: rt.nickname, city: rt.other, state: SCHOOL_STATE[HIST_SCHOOL[base] ?? base] ?? '',
      conf, off: readRating(rom, t).off, def: readRating(rom, t).def, color: hex(color), stripe, logo, players,
      ...(fine ? { impact: (hist?.(t - from) ?? impactSlots(nib, id === '1994' ? '1994' : '2026', fourThreeOf(rom, t))).map((s) => slotIndex[s]).filter((i) => i !== undefined) } : {}),
    });
  }
  mkdirSync('public/media/rosters', { recursive: true });
  writeFileSync(`public/media/rosters/logos-${id}.png`, encodePng(SHEET_COLS * CELL[0], sheetRows * CELL[1], sheet));
  const ids = new Set(teams.map((t) => t.id));
  if (ids.size !== teams.length) throw new Error(`${id}: two teams with the same address`);
  return { edition: id, build, sheet: { width: SHEET_COLS * CELL[0], height: sheetRows * CELL[1], cell: CELL }, teams };
}

const [p26, p94, pStock] = process.argv.slice(2);
if (!pStock) throw new Error('Usage: npm run site:rosters -- ELEVATED_2026 ELEVATED_1994 BW95');
const r26 = await load(p26), r94 = await load(p94), rStock = await load(pStock), rHist = r26;
if (setupTeamsOf(rHist) <= teamsOf(rHist)) throw new Error('This 2026 ROM has no historic teams (2026 v2.0.1-test72 on).');
const buildOf = (d: Uint8Array) => readManifest(d)?.name ?? 'unknown build';
const sets = [
  edition(r26, '2026', 0, 138, buildOf(r26)),
  edition(r94, '1994', 0, 107, buildOf(r94)),
  edition(rStock, 'original', 0, 36, 'the original game'),
  edition(rHist, 'historic', teamsOf(rHist), setupTeamsOf(rHist), buildOf(rHist)),
];
mkdirSync('public/data/rosters', { recursive: true });
for (const s of sets) {
  writeFileSync(`public/data/rosters/${s.edition}.json`, JSON.stringify(s));
  console.log(`${s.edition}: ${s.teams.length} teams from ${s.build}`);
}
