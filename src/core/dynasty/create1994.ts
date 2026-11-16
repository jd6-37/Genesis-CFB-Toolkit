// A new dynasty in the 107-team 1994 Season Edition (user, 2026-11-15: "Make it compatible with our latest 1994
// rom"). There is no College Football 27 data for 1994, so the dynasty is made from the ROM itself:
//   - The 32 per team: the ROM's roster records (steps), its fine-ratings table at 0x2E0000 (offsets) and its
//     names table at 0x2C0000 (class, name). Players without a name keep none (user: "keep names blank but do
//     assign a class": the Rosters lane finishes the names for the release). A class the ROM doesn't have is
//     given so each team ends up with a typical mix (user: "assign randomly to achieve a good balance of each class
//     on each team"); the 36 original teams' unnamed players have JR in the ROM as a placeholder and count as
//     unknown too. A named player found in the real 1994 lists (rosters1994.ts) takes his height, hometown and,
//     where the ROM only has the placeholder, his class from them.
//   - The backups: one per slot, a real player of the school from the 1994 lists who isn't among the ROM's named
//     32 (user: "We actually have full IRL rosters for most of the 94 teams. Let's use that for creating the
//     backups"), his name, number, class and size; his ratings generated like the random bench's (bench.ts).
//     Where a school's list runs out, a generated player.
//   - Heights nobody has are drawn from the lists' players of the same position; hometowns from the school's own
//     players in the lists, else mostly from towns in the school's state.
//   - Starting prestige: the 1994 preseason AP poll, then the teams' OVRs (prestige.ts).
import { parseBw95 } from '../bw95';
import { GROUP_ATTRS, GROUP_COLUMNS, type Group } from '../rosterLayouts';
import { hasOlPatch, OL_PATCH } from '../rosterOlPatch';
import { jerseyNumber, openRosterRom, readPlayer, teamLayout } from '../rosterRom';
import { readWideSeason, wideSeasonProblems } from '../seasonWide';
import { ratingProblems, readRating } from '../teamRatings';
import { assignBlack, skinFor } from './appearance';
import { randomBench, type BenchIdentity } from './bench';
import { recordYear } from './career';
import { slotPosition } from './depth';
import { DYNASTY_EDITION, hasDynastyHooks, readNamesTable } from './dynastyArea';
import { EDITIONS, editionOfRom } from './edition';
import { hasFineRatings, readFineOffsets } from './fine';
import { whiteHomeOf } from './kit';
import { CLASSES, DYNASTY_FILE, rng, type BwSlot, type ClassYear, type CreateOptions, type DPlayer, type Dynasty, type DTeam } from './model';
import { NO_NUMBER, numberAllowed, replacementNumber, sideOf } from './numbers';
import { startingPrestige1994 } from './prestige';
import { ovrOf, ratingsFromSlot, valueOfFine } from './ratings';
import { nameKey, parseRosters1994, type Roster1994Row } from './rosters1994';
import { SCHOOL_STATE } from './schoolStates';

/**
 * The class mix a team's 32 gets (Claude's pick, 2026-11-15): the ROM's named 1994 players with a class
 * (FR 103, SO 351, JR 660, SR 615 of 1,729), rounded to 32: 2 FR, 6 SO, 12 JR, 12 SR.
 */
export const CLASS_MIX_1994: [ClassYear, number][] = [['FR', 2], ['SO', 6], ['JR', 12], ['SR', 12]];

/** Positions in the 1994 lists that fit a slot's position, best first ('' = the list has none). */
const FITS: Record<string, string[][]> = {
  QB: [['QB']], HB: [['HB'], ['FB']], FB: [['FB'], ['HB']], WR: [['WR']], TE: [['TE']],
  LT: [['OL'], ['C']], LG: [['OL'], ['C']], RG: [['OL'], ['C']], RT: [['OL'], ['C']], C: [['C'], ['OL']],
  LE: [['DE'], ['DL'], ['OLB']], RE: [['DE'], ['DL'], ['OLB']], DT: [['DT'], ['DL'], ['DE']],
  LOLB: [['OLB'], ['LB'], ['DE']], ROLB: [['OLB'], ['LB'], ['DE']], MLB: [['LB'], ['OLB']],
  CB: [['CB'], ['DB'], ['S']], FS: [['S'], ['DB'], ['CB']], SS: [['S'], ['DB'], ['CB']], K: [['K'], ['P']], P: [['P'], ['K']],
};
const OLDER: Record<string, number> = { SR: 0, JR: 1, SO: 2, FR: 3, '': 4 };
const CLS = (s: string): ClassYear | undefined => (CLASSES as readonly string[]).includes(s) ? (s as ClassYear) : undefined;

const gauss = (r: () => number) => { let s = 0; for (let i = 0; i < 6; i++) s += r(); return s - 3; };
const pick = <T>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)];

/** A new 1994 dynasty from the user's 1994 Season Edition ROM and the built-in 1994 rosters (rosters1994.ts). */
export function createDynasty1994(rom: Uint8Array, rostersText: string, opt: CreateOptions): Dynasty {
  const roster = openRosterRom(rom);
  if (!roster.wide || !hasDynastyHooks(rom)) throw new Error(`A dynasty needs ${DYNASTY_EDITION}.`);
  if (editionOfRom(rom)?.id !== '1994') throw new Error(`This isn't the ${EDITIONS['1994'].name}.`);
  const p = wideSeasonProblems(rom);
  if (p.length) throw new Error(`This ROM's season settings can't be read: ${p.join('; ')}.`);
  const n = roster.teams.length;
  const blocks = parseBw95(rom, n);
  const teams: DTeam[] = roster.teams.map((t, i) => ({
    index: i, school: t.school, nickname: t.nickname, city: t.other,
    colors: [blocks[i].home[3], blocks[i].home[5], blocks[i].home[11], blocks[i].home[14]],
  }));
  const seed = opt.seed ?? Date.now();
  const r = rng(seed);
  const offRand = rng((seed ^ 0x46524331) >>> 0);
  const drawn = () => Math.floor(offRand() * 16) - 8;

  // The 1994 lists by school, and by name for the ROM's players.
  const lists = new Map<string, Roster1994Row[]>();
  for (const row of parseRosters1994(rostersText)) lists.set(row.school, [...(lists.get(row.school) ?? []), row]);
  const all = [...lists.values()].flat();
  const heights = new Map<string, number[]>(), towns = new Map<string, Roster1994Row[]>();
  for (const x of all) {
    if (x.heightIn) heights.set(x.pos, [...(heights.get(x.pos) ?? []), x.heightIn]);
    if (x.hometown && x.state) towns.set(x.school, [...(towns.get(x.school) ?? []), x]);
  }
  const allTowns = all.filter((x) => x.hometown && x.state);
  const byState = new Map<string, Roster1994Row[]>();
  for (const x of allTowns) byState.set(x.state, [...(byState.get(x.state) ?? []), x]);
  const madeHeight = (pos: string) => pick(r, heights.get(listPos(pos)) ?? heights.get('') ?? [73]) ?? 73;
  // A school's own players' towns when its list has them; else mostly towns of its state (Claude's pick: 60%), the rest anywhere.
  const madeTown = (school: string) => {
    if ((towns.get(school)?.length ?? 0) >= 5) return pick(r, towns.get(school)!);
    const home = byState.get(SCHOOL_STATE[school] ?? '') ?? [];
    return pick(r, home.length >= 5 && r() < 0.6 ? home : allTowns);
  };

  // ---- the 32 per team, from the ROM
  const romNames = readNamesTable(rom, n);
  const fineRom = hasFineRatings(rom);
  const olPlus = hasOlPatch(roster) ? OL_PATCH.pounds : 0;
  const players: DPlayer[] = [];
  const slots = teams.map(() => new Array<number | null>(32).fill(null));
  const bw = teams.map(() => new Array<BwSlot | null>(32).fill(null));
  const unknownClass: DPlayer[][] = teams.map(() => []);
  const usedRows = teams.map(() => new Set<number>());
  for (const t of teams) {
    const list = lists.get(t.school) ?? [];
    const byName = new Map(list.map((x) => [nameKey(x.first, x.last), x]));
    for (const def of teamLayout(roster, t.index)) {
      const rec = readPlayer(roster, t.index, def.slot);
      const order = GROUP_ATTRS[def.group];
      const romOffs = fineRom ? readFineOffsets(rom, t.index, def.slot) : null;
      const attrs = GROUP_COLUMNS[def.group];
      const steps = attrs.map((a) => rec.ratings[order.indexOf(a)] ?? 0);
      const offs = attrs.map((a, i) => {
        const off = romOffs ? romOffs[order.indexOf(a)] : drawn();
        return Math.max(0, Math.min(240, 16 * steps[i] + off)) - 16 * steps[i]; // the app's numbers run 0-100
      });
      const b: BwSlot = { label: def.label, group: def.group, attrs, steps, offs, weightPlus: def.group === 'OL' ? olPlus : 0 };
      bw[t.index][def.slot] = b;
      const nm = romNames[t.index][def.slot];
      const named = !!nm && (!!nm.first || !!nm.last);
      const real = named ? byName.get(nameKey(nm!.first, nm!.last)) : undefined;
      if (real) usedRows[t.index].add(real.row);
      const pos = slotPosition(def.label);
      // The ROM's class unless it has none, or (the 36 original teams) only the JR placeholder of a player the lists know better.
      let cls: ClassYear | undefined = nm && nm.cls <= 4 ? CLASSES[nm.cls] : undefined;
      if (t.index < 36 && cls === 'JR' && (!named || (real && CLS(real.cls) && real.cls !== 'JR'))) cls = named && real ? CLS(real.cls) : undefined;
      if (!cls && real) cls = CLS(real.cls);
      const ratings = extraRatings(ratingsFromSlot(b), def.group, r);
      const town = real?.hometown && real.state ? real : madeTown(t.school);
      const pl: DPlayer = {
        id: players.length + 1, first: named ? nm!.first : '', last: named ? nm!.last : '', pos, team: t.index, cls: cls ?? 'JR',
        jersey: jerseyNumber(rec.numberByte) ?? NO_NUMBER, heightIn: real?.heightIn || madeHeight(pos), weight: ratings.Weight ?? 200,
        hometown: town.hometown, state: town.state, ovr: 0, ratings, skin: 0, status: 'active', srcId: 100000 + 32 * t.index + def.slot,
      };
      pl.ovr = ovrOf(pl);
      players.push(pl);
      slots[t.index][def.slot] = pl.id;
      if (!cls) unknownClass[t.index].push(pl);
    }
  }
  // Classes nobody has: each team toward the mix, the class short the most first (ties at random).
  teams.forEach((t) => {
    const have = new Map<ClassYear, number>(CLASS_MIX_1994.map(([c]) => [c, 0]));
    for (const id of slots[t.index]) { const pl = id ? players[id - 1] : null; if (pl && !unknownClass[t.index].includes(pl)) have.set(pl.cls, (have.get(pl.cls) ?? 0) + 1); }
    const todo = unknownClass[t.index].map((x) => ({ x, k: r() })).sort((a, b) => a.k - b.k).map((e) => e.x);
    for (const pl of todo) {
      const [c] = CLASS_MIX_1994.map(([c, want]) => [c, want - (have.get(c) ?? 0) + r() * 0.5] as [ClassYear, number]).sort((a, b) => b[1] - a[1])[0];
      pl.cls = c;
      have.set(c, (have.get(c) ?? 0) + 1);
    }
  });
  assignBlack(players, r).forEach((black, i) => { players[i].skin = skinFor(black, r); });

  const season = readWideSeason(rom);
  const teamOvr = ratingProblems(rom).length ? undefined : Array.from({ length: n }, (_, t) => readRating(rom, t));
  const startYear = opt.startYear ?? EDITIONS['1994'].startYear;
  const base: Dynasty = {
    ...DYNASTY_FILE,
    edition: '1994',
    id: opt.id ?? `d${Date.now().toString(36)}${Math.floor(r() * 1e6).toString(36)}`,
    name: opt.name.trim() || 'My Dynasty',
    created: opt.created ?? new Date().toISOString(),
    startYear,
    userTeams: opt.userTeams ?? [],
    teams,
    whiteHome: whiteHomeOf(rom),
    players,
    seasons: [{
      index: 0, year: startYear, conf: season.conf, confNames: season.names, confWeeks: { start: season.start, games: season.games },
      ...(season.titleGames ? { titleGames: season.titleGames } : {}),
      slots, bw, bench: teams.map(() => new Array(32).fill(null)), benchBw: teams.map(() => new Array(32).fill(null)), teamOvr,
      prestige: startingPrestige1994(teams.map((t) => t.school), teamOvr), imports: [],
    }],
  };

  // ---- the backups: real players from the lists, generated ratings (bench.ts)
  const numbers = teams.map((t) => ({ O: new Set<number>(), D: new Set<number>() }));
  for (const pl of players) if (pl.jersey !== NO_NUMBER) numbers[pl.team!][sideOf(pl.pos)].add(pl.jersey);
  const ident = (team: number, _slot: number, pos: string): BenchIdentity | null => {
    const list = (lists.get(teams[team].school) ?? []).filter((x) => !usedRows[team].has(x.row));
    const tiers = [...(FITS[pos] ?? [[pos]]), ['']];
    for (const tier of tiers) {
      const fit = list.filter((x) => tier.includes(x.pos)).sort((a, b) => OLDER[a.cls] - OLDER[b.cls] || a.row - b.row);
      if (!fit.length) continue;
      // Upperclassmen first (the second string of a 1994 team), the order within a class shuffled.
      const best = fit.filter((x) => OLDER[x.cls] === OLDER[fit[0].cls]);
      const x = pick(r, best);
      usedRows[team].add(x.row);
      const side = numbers[team][sideOf(pos)];
      let jersey = x.number !== null && numberAllowed(pos, x.number) && !side.has(x.number) ? x.number : (x.number === null ? null : replacementNumber(pos, x.number, side));
      if (jersey === null) jersey = NO_NUMBER; else side.add(jersey);
      const town = x.hometown && x.state ? x : madeTown(teams[team].school);
      return { first: x.first, last: x.last, jersey, heightIn: x.heightIn || madeHeight(pos), weight: x.weight, cls: CLS(x.cls),
        hometown: town.hometown, state: town.state, srcId: 200000 + x.row };
    }
    return null;
  };
  const d = randomBench(base, (seed ^ 0x42454e43) >>> 0, ident);
  // Skin tones of the real backups by their names, as for the 32 (generated ones got theirs with their names).
  const real = d.players.filter((x) => (x.srcId ?? 0) >= 200000);
  assignBlack(real, r).forEach((black, i) => { real[i].skin = skinFor(black, r); });
  return { ...d, players: recordYear(d.players, startYear) };
}

/** A slot position's position in the 1994 lists. */
function listPos(pos: string): string {
  return ({ LT: 'OL', LG: 'OL', RG: 'OL', RT: 'OL', LE: 'DE', RE: 'DE', LOLB: 'OLB', ROLB: 'OLB', MLB: 'LB', FS: 'S', SS: 'S' } as Record<string, string>)[pos] ?? pos;
}

/**
 * The related group's rating a lineup change can need (lineup.ts: DE/DT may move to LB, LB to DE), which the
 * ROM doesn't have (Claude's pick, 2026-11-15): a lineman's Quickness near his Speed, a linebacker's Power near
 * his Tackling, a little below.
 */
function extraRatings(ratings: DPlayer['ratings'], group: Group, r: () => number): DPlayer['ratings'] {
  const out = { ...ratings };
  const near = (v: number | undefined) => valueOfFine(Math.max(0, Math.min(240, Math.round(2.4 * ((v ?? 50) - 4 + 4 * gauss(r))))));
  if (group === 'DL' && out.Quickness === undefined) out.Quickness = near(out.Speed);
  if (group === 'LB' && out.Power === undefined) out.Power = near(out.Tackling);
  return out;
}
