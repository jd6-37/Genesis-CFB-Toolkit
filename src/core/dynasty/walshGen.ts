// Walsh Reports written by the app each offseason (user, 2026-11-16: "auto-generated Walsh reports … take into
// account roster changes (loss of star players, big transfer portal movement, new stars, returning award winners,
// etc), results and stats from last year, expectations for this year … not AI-generated reports … a large pool of
// phrases and formats that get picked from"; then "Yes def name names", "yes all teams every offseason. And the user
// should have the chance to edit them", preseason rankings in them, and players' strengths from their ratings).
//
// For every team: facts are gathered from the dynasty (last season's results, stats and awards; the offseason's
// departures, transfers and signings; the new depth chart and its ratings against every other team; the preseason
// poll; the schedule). Each fact can become a sentence, from a pool of wordings; each team gets a theme (champion,
// contender, rising, rebuilding …) that picks the opening and the closing line. Sentences are added by importance
// until the report is full (the game's limit is 650 characters for both paragraphs; walsh.ts). A seed from the
// dynasty, the season, the team and a "variant" number picks the wordings, so the same inputs always give the same
// report, and "Write it again" gives another.
//
// H-035 (2026-11-20, the style settled): the base game's way, as the 2026 edition's built-in preseason reports. No
// theme closers: each paragraph ends on the side's clearest strength or weakness, with its fact (`verdict`). Team-level
// facts (rank, last season, the conference favorite, a new coach, the dynasty era from year 4) open the offense
// paragraph. A position before every jersey number ("WR #18 Cooper Barkate"); a transfer by his school ("Duke transfer
// #10 Darian Mensah takes over at QB"); the app's preseason Heisman favorites as "early Heisman favorites".
//
// Writing rules (the project's Walsh Report rules and the user's review of the samples): Bill Walsh's scouting voice,
// third person, plain and factual with a little opinion at the end; a current player's jersey number before his name
// at his first mention, his last name after; former players without a number; no advice to the player; the game's
// font only (A-Z a-z 0-9 space . , ! ? ' " - & ( ) / : ; % + =), no word over 20 characters.

import { fcsLabel } from './fcs';
import { groupOf, moneyWords, NIL } from './nil';
import type { DPlayer, DSeason, Dynasty, OffseasonEvent, BwSlot } from './model';
import { rng } from './model';
import { seasonView, playerLines, standings, bowlOf, INDEPENDENT, type SeasonView, type PlayerLine } from './derive';
import { seasonAwards, type SeasonAwards } from './awards';
import { preseasonPoll, returningStarters, type PollEntry } from './poll';
import { editionOf } from './edition';
import { protectedPairs, rivalriesOf } from './schedule';
import { RIVALRIES } from './rivalries';
import { hotSeat, tenure } from './carousel';
import { REPORT_LIMIT, type Report } from '../walsh';
import { preseasonHeisman, type HeismanFavorite } from './heismanPre';

/** The game's text limit for a report, both paragraphs (walsh.ts). */
export const WALSH_LIMIT = REPORT_LIMIT;
const OFF_BUDGET = 345;

// ---------------------------------------------------------------- text helpers

/** Text the game's font can show: no accents, only its characters, single spaces. */
export function walshText(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
    .replace(/[^A-Za-z0-9 .,!?'"\-&()/:;%+=#]/g, '')
    .replace(/\s+/g, ' ').trim();
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const num = (n: number) => n.toLocaleString('en-US');
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const word = (n: number) => WORDS[n] ?? String(n);
const plural = (n: number, one: string, many = `${one}s`) => `${word(n)} ${n === 1 ? one : many}`;
/** "a 9-3" / "an 11-3" / "an 8-4". */
const aRec = (w: number, l: number) => `${/^(8|11|18)/.test(String(w)) ? 'an' : 'a'} ${w}-${l}`;
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

type Rand = () => number;
const pick = <T,>(r: Rand, xs: T[]): T => xs[Math.floor(r() * xs.length) % xs.length];
/** The value at the top `share` of a list (0.1 = the 90th percentile). */
const top = (xs: number[], share: number) => xs.slice().sort((a, b) => b - a)[Math.max(0, Math.floor(xs.length * share) - 1)] ?? Infinity;

// ---------------------------------------------------------------- roles and slots

/** The game's starters: the pro set on offense, the 4-3 on defense (lineup.ts slots). */
const OFF_START = [0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 13];
const DEF_START = [16, 17, 21, 18, 19, 20, 22, 24, 26, 28, 29];
const OL = [4, 5, 6, 7, 8];
const REC = [9, 10, 11, 13];
const WR = [9, 10, 11];
const DE = [16, 18];
const DL = [16, 17, 21, 18];
const LB = [19, 20, 22];
const DB = [24, 26, 28, 29];
const CB = [24, 26];

const POS_NOUN: Record<string, string> = {
  QB: 'quarterback', HB: 'halfback', RB: 'halfback', FB: 'fullback', WR: 'receiver', TE: 'tight end',
  LT: 'tackle', RT: 'tackle', OT: 'tackle', T: 'tackle', LG: 'guard', RG: 'guard', OG: 'guard', G: 'guard', C: 'center', OL: 'lineman',
  LE: 'defensive end', RE: 'defensive end', DE: 'defensive end', DT: 'defensive tackle', NT: 'nose tackle', DL: 'defensive lineman',
  LOLB: 'linebacker', ROLB: 'linebacker', OLB: 'linebacker', MLB: 'linebacker', ILB: 'linebacker', LB: 'linebacker',
  CB: 'cornerback', DB: 'defensive back', S: 'safety', FS: 'safety', SS: 'safety', K: 'kicker', P: 'punter', KP: 'kicker',
};
const CLASS_WORD: Record<string, string> = { FR: 'freshman', SO: 'sophomore', JR: 'junior', SR: 'senior', 'SR+': 'fifth-year senior' };
const noun = (p: DPlayer) => POS_NOUN[p.pos] ?? POS_NOUN[p.pos.replace(/[0-9]/g, '')] ?? 'player';
/** The short position before a jersey number, so "#18" is never read as a ranking (H-035): "WR #18 Cooper Barkate". */
const ROLE: Record<string, string> = {
  QB: 'QB', HB: 'HB', RB: 'HB', FB: 'FB', WR: 'WR', SE: 'WR', FL: 'WR', TE: 'TE',
  LT: 'OT', RT: 'OT', OT: 'OT', T: 'OT', LG: 'OG', RG: 'OG', OG: 'OG', G: 'OG', C: 'C', OL: 'OL',
  LE: 'DE', RE: 'DE', DE: 'DE', DT: 'DT', NT: 'DT', DL: 'DL',
  LOLB: 'LB', ROLB: 'LB', OLB: 'LB', MLB: 'LB', ILB: 'LB', LB: 'LB',
  CB: 'CB', DB: 'DB', S: 'S', FS: 'S', SS: 'S', K: 'K', P: 'P', KP: 'K',
};
const role = (p: DPlayer) => ROLE[p.pos] ?? ROLE[p.pos.replace(/[0-9]/g, '')] ?? '';

/** A fine rating of a slot (16 × step + offset; Weight in pounds), or null. */
function rating(b: BwSlot | null | undefined, attr: string): number | null {
  if (!b) return null;
  const i = b.attrs.indexOf(attr as BwSlot['attrs'][number]);
  if (i < 0) return null;
  const v = 16 * b.steps[i] + (b.offs?.[i] ?? 0);
  return attr === 'Weight' ? 140 + v + (b.weightPlus ?? 0) : v;
}

// ---------------------------------------------------------------- traits from ratings

/** A unit's trait, compared with every team's (0 = the lowest, 1 = the highest). */
interface TraitDef { key: string; slots: number[]; attr: string; side: 'off' | 'def' }
const TRAITS: TraitDef[] = [
  { key: 'qbArm', slots: [0], attr: 'Range', side: 'off' },
  { key: 'qbLegs', slots: [0], attr: 'Speed', side: 'off' },
  { key: 'qbHead', slots: [0], attr: 'Awareness', side: 'off' },
  { key: 'rbSpeed', slots: [1], attr: 'Speed', side: 'off' },
  { key: 'rbPower', slots: [1, 3], attr: 'Power', side: 'off' },
  { key: 'recSpeed', slots: WR, attr: 'Speed', side: 'off' },
  { key: 'recHands', slots: REC, attr: 'Hands', side: 'off' },
  { key: 'olSize', slots: OL, attr: 'Weight', side: 'off' },
  { key: 'olBlock', slots: OL, attr: 'Blocking', side: 'off' },
  { key: 'kLeg', slots: [15], attr: 'Range', side: 'off' },
  { key: 'dlRush', slots: DE, attr: 'Speed', side: 'def' },
  { key: 'dlPower', slots: DL, attr: 'Power', side: 'def' },
  { key: 'lbSpeed', slots: LB, attr: 'Speed', side: 'def' },
  { key: 'lbTackle', slots: LB, attr: 'Tackling', side: 'def' },
  { key: 'dbSpeed', slots: DB, attr: 'Speed', side: 'def' },
  { key: 'dbHands', slots: DB, attr: 'Hands', side: 'def' },
];

function traitTable(season: DSeason): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  const n = season.slots.length;
  for (const t of TRAITS) {
    const val = Array.from({ length: n }, (_, team) => {
      const v = t.slots.map((s) => rating(season.bw?.[team]?.[s], t.attr)).filter((x): x is number => x !== null);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
    });
    const sorted = val.filter((x) => !Number.isNaN(x)).sort((a, b) => a - b);
    out[t.key] = val.map((x) => (Number.isNaN(x) ? 0.5 : (sorted.filter((y) => y < x).length + sorted.filter((y) => y === x).length / 2) / sorted.length));
  }
  return out;
}

// ---------------------------------------------------------------- league facts

/** What the generator needs of the whole league for one season (worked out once). */
export interface WalshLeague {
  d: Dynasty;
  season: DSeason;
  prev: DSeason;
  vPrev: SeasonView;
  imported: boolean;
  poll: PollEntry[] | null;
  pollRank: Map<number, number>;
  awards: SeasonAwards | null;
  lines: PlayerLine[];
  traits: Record<string, number[]>;
  events: OffseasonEvent[];
  rivals: { a: number; b: number; name: string | null }[];
  /** Per team: starters lost in the offseason, and transfers who start (for "few teams lost more" lines). */
  lostStarters: number[];
  portalStarters: number[];
  /** The app's preseason Heisman favorites (top 10). */
  heisman: HeismanFavorite[];
  /** Final poll places of every season played so far (from the dynasty's fourth season; else empty), 0 = unranked. */
  eraRanks: number[][];
}

export function walshLeague(d: Dynasty, season: DSeason): WalshLeague | null {
  const i = d.seasons.indexOf(season);
  if (i < 1) return null;
  const prev = d.seasons[i - 1];
  const vPrev = seasonView(d, prev);
  const imported = prev.imports.length > 0;
  const poll = preseasonPoll(d, season);
  const schools = d.teams.map((t) => t.school);
  const named = new Map(RIVALRIES.map(([a, b, name]) => [`${a}|${b}`, name]));
  const rivals = protectedPairs(schools, editionOf(d).id, rivalriesOf(d)).map((p) => ({
    a: p.a, b: p.b, name: named.get(`${schools[p.a]}|${schools[p.b]}`) ?? named.get(`${schools[p.b]}|${schools[p.a]}`) ?? null,
  }));
  const events = season.events ?? [];
  const lostStarters = d.teams.map(() => 0);
  const portalStarters = d.teams.map(() => 0);
  const starterOf = (s: DSeason, team: number, id: number) => { const k = s.slots[team]?.indexOf(id) ?? -1; return k >= 0 && STARTERS.has(k); };
  for (const e of events) {
    if ((e.kind === 'graduated' || e.kind === 'pro') && starterOf(prev, e.team, e.player)) lostStarters[e.team]++;
    if (e.kind === 'transfer' && starterOf(prev, e.from, e.player)) lostStarters[e.from]++;
    if (e.kind === 'transfer' && e.to !== null && starterOf(season, e.to, e.player)) portalStarters[e.to]++;
    if (e.kind === 'fcs' && starterOf(season, e.to, e.player)) portalStarters[e.to]++;
  }
  const eraRanks = i >= 3
    ? d.seasons.slice(0, i).filter((x) => x.imports.length).map((x) => (x === prev ? vPrev : seasonView(d, x)).rank.map((rk) => (rk && rk <= 25 ? rk : 0)))
    : [];
  return {
    d, season, prev, vPrev, imported, poll, lostStarters, portalStarters, eraRanks,
    heisman: preseasonHeisman(d, season, 10),
    pollRank: new Map((poll ?? []).map((p) => [p.team, p.rank])),
    awards: imported ? seasonAwards(d, prev) : null,
    lines: imported ? playerLines(vPrev) : [],
    traits: traitTable(season),
    events,
    rivals,
  };
}

// ---------------------------------------------------------------- one team's facts

type Theme = 'champion' | 'contender' | 'rising' | 'falling' | 'rebuild' | 'portal' | 'steady' | 'longshot';

interface Facts {
  T: number;
  school: string;
  nick: string;
  city: string;
  conf: string | null;
  year: number;
  lastYear: number;
  edition: '2026' | '1994';
  rank: number | null; // preseason poll, 1-25
  firstVotes: number;
  w: number; l: number; cw: number; cl: number;
  pf: number; pa: number; games: number;
  confPlace: number | null;
  lastFinal: number | null; // last season's final poll place, 1-25
  champion: boolean;
  post: { name: string | null; won: boolean; opp: number; title: boolean; final: boolean }[];
  wonConf: boolean;
  offRet: number; defRet: number;
  gone: { p: DPlayer; why: 'graduated' | 'pro' | 'transfer'; to: number | null; starter: boolean; side: 'off' | 'def' | null; line: string | null }[];
  /** Transfers in: the school he came from as written ("Duke", or "Montana State (FCS)": fcs.ts). */
  inTransfers: { p: DPlayer; from: string; starter: boolean }[];
  recruits: { p: DPlayer; stars: number; starter: boolean }[];
  classRank: number | null;
  qb: DPlayer | null; qbNew: boolean;
  hb: DPlayer | null; wr: DPlayer | null; te: DPlayer | null;
  defStar: DPlayer | null;
  honors: { p: DPlayer; what: string; heisman: boolean }[];
  statOf: (p: DPlayer | null) => { pass?: { yds: number; td: number; int: number }; rush?: { yds: number; td: number }; rec?: { rec: number; yds: number; td: number }; def?: { tkl: number; sacks: number; int: number } };
  traits: Record<string, number>;
  bigGames: { opp: number; week: number; home: boolean; rank: number | null; rivalry: string | null }[];
  ovr: { off: number; def: number };
  theme: Theme;
  /** A new head coach this season (coaches.ts): his name and where he coached before (a school, or null). */
  newCoach: { name: string; from: string | null; former: boolean; fromRival: boolean } | null;
  /** A returning head coach who can be fired after this season and whose seat was hot last season. */
  seat: { name: string; heat: number } | null;
}

const STARTERS = new Set([...OFF_START, ...DEF_START]);

function factsOf(L: WalshLeague, T: number): Facts {
  const { d, season, prev, vPrev } = L;
  const team = d.teams[T];
  const ed = editionOf(d).id;
  const P = (id: number | null | undefined) => (id ? d.players[id - 1] : null);
  const rec = vPrev.records[T] ?? { w: 0, l: 0, cw: 0, cl: 0, pf: 0, pa: 0 };
  const games = rec.w + rec.l;
  const confIx = season.conf[T];
  const conf = confIx === INDEPENDENT || confIx === undefined ? null : season.confNames[confIx] ?? null;
  let confPlace: number | null = null;
  if (L.imported && prev.conf[T] !== INDEPENDENT) {
    const st = standings(vPrev, prev.conf[T]);
    const k = st.findIndex((x) => x.team === T);
    confPlace = k >= 0 ? k + 1 : null;
  }
  const lastFinal = L.imported && vPrev.rank[T] && vPrev.rank[T] <= 25 ? vPrev.rank[T] : null;

  // Postseason games of last season.
  const post: Facts['post'] = [];
  if (L.imported) {
    const lastWeek = Math.max(...vPrev.games.map((g) => g.week), 0);
    for (const g of vPrev.games) {
      if (g.week <= vPrev.lastRegularWeek || g.vs === null || g.hs === null) continue;
      if (g.visitor !== T && g.home !== T) continue;
      const mine = g.home === T ? g.hs : g.vs;
      const theirs = g.home === T ? g.vs : g.hs;
      const opp = (g.home === T ? g.visitor : g.home) ?? -1;
      const title = g.week === vPrev.lastRegularWeek + 1 && !!(vPrev.season.titleGames ?? []).some((x) => x & 1) && g.week < lastWeek;
      post.push({ name: vPrev.bowls ? bowlOf(vPrev, g) : null, won: mine > theirs, opp, title, final: g.week === lastWeek && !vPrev.bowls });
    }
  }
  const wonConf = post.some((g) => g.title && g.won) || (confPlace === 1 && !post.some((g) => g.title));

  // Returning starters by side (the same players starting for the team again).
  const before = new Set(prev.slots[T].filter((x): x is number => x !== null));
  const ret = (slots: number[]) => slots.filter((s) => { const id = season.slots[T][s]; return id !== null && before.has(id); }).length;
  const offRet = ret(OFF_START);
  const defRet = ret(DEF_START);

  // Stats of last season by player.
  const statOf = (p: DPlayer | null) => {
    const out: ReturnType<Facts['statOf']> = {};
    if (!p) return out;
    for (const l of L.lines) {
      if (l.player !== p.id) continue;
      const s = l.s as unknown as Record<string, number>;
      if (l.cat === 'passing' && s.att > 30) out.pass = { yds: s.yds, td: s.td, int: s.int };
      if (l.cat === 'rushing' && s.att > 20) out.rush = { yds: s.yds, td: s.td };
      if (l.cat === 'receiving' && s.rec > 8) out.rec = { rec: s.rec, yds: s.yds, td: s.td };
      if (l.cat === 'defense' && (s.tkl > 10 || s.sacks > 2 || s.int > 1)) out.def = { tkl: s.tkl, sacks: s.sacks, int: s.int };
    }
    return out;
  };

  // Departures (the offseason's events), with last season's line for the notable ones.
  const prevStarter = new Set(prev.slots[T].flatMap((id, s) => (id !== null && STARTERS.has(s) ? [id] : [])));
  const sideOf = (id: number) => { const s = prev.slots[T].indexOf(id); return s < 0 ? null : s < 16 || s === 31 ? 'off' as const : 'def' as const; };
  const gone: Facts['gone'] = [];
  for (const e of L.events) {
    if ((e.kind === 'graduated' || e.kind === 'pro') && e.team === T) {
      const p = d.players[e.player - 1];
      gone.push({ p, why: e.kind, to: null, starter: prevStarter.has(p.id), side: sideOf(p.id), line: lineText(statOf(p)) });
    }
    if (e.kind === 'transfer' && e.from === T) {
      const p = d.players[e.player - 1];
      gone.push({ p, why: 'transfer', to: e.to, starter: prevStarter.has(p.id), side: sideOf(p.id), line: lineText(statOf(p)) });
    }
  }
  gone.sort((a, b) => Number(b.starter) - Number(a.starter) || b.p.ovr - a.p.ovr);

  const nowStarter = new Set(season.slots[T].flatMap((id, s) => (id !== null && STARTERS.has(s) ? [id] : [])));
  const inTransfers = L.events.flatMap((e) => (e.kind === 'transfer' && e.to === T ? [{ p: d.players[e.player - 1], from: d.teams[e.from].school, starter: nowStarter.has(e.player) }]
    : e.kind === 'fcs' && e.to === T ? [{ p: d.players[e.player - 1], from: fcsLabel(e.school), starter: nowStarter.has(e.player) }] : []))
    .sort((a, b) => Number(b.starter) - Number(a.starter) || b.p.ovr - a.p.ovr);
  const recruits = L.events.flatMap((e) => (e.kind === 'signed' && e.team === T ? [{ p: d.players[e.player - 1], stars: e.stars, starter: nowStarter.has(e.player) }] : []))
    .sort((a, b) => b.stars - a.stars || b.p.ovr - a.p.ovr);
  const classEv = L.events.find((e) => e.kind === 'class' && e.team === T) as Extract<OffseasonEvent, { kind: 'class' }> | undefined;

  const qb = P(season.slots[T][0]);
  const qbNew = !!qb && prev.slots[T][0] !== qb.id;
  const best = (slots: number[]) => slots.map((s) => P(season.slots[T][s])).filter((p): p is DPlayer => !!p).sort((a, b) => b.ovr - a.ovr)[0] ?? null;
  const defStar = best(DEF_START);

  // Honors of last season, for players back with the team.
  const honors: Facts['honors'] = [];
  const here = (id: number) => d.players[id - 1]?.team === T && d.players[id - 1]?.status === 'active';
  if (L.awards) {
    const h = L.awards.heisman[0];
    if (h && here(h.player)) honors.push({ p: d.players[h.player - 1], what: 'the Heisman Trophy', heisman: true });
    for (const a of L.awards.position) if (a.winner && here(a.winner.player) && !honors.some((x) => x.p.id === a.winner!.player)) {
      honors.push({ p: d.players[a.winner.player - 1], what: `the award for the ${a.label.replace(/^Best /, 'best ')}`, heisman: false });
    }
    for (const c of L.awards.allAmerican[0]) if (here(c.player) && !honors.some((x) => x.p.id === c.player)) {
      honors.push({ p: d.players[c.player - 1], what: 'All-American', heisman: false });
    }
  }

  // Big games: ranked opponents (preseason poll) and rivalries, by week.
  const bigGames: Facts['bigGames'] = [];
  for (const g of season.schedule?.games ?? []) {
    if (g.visitor !== T && g.home !== T) continue;
    const opp = g.home === T ? g.visitor : g.home;
    const rv = L.rivals.find((x) => (x.a === T && x.b === opp) || (x.b === T && x.a === opp));
    const r = L.pollRank.get(opp) ?? null;
    if ((r !== null && r <= 15) || rv) bigGames.push({ opp, week: g.week, home: g.home === T, rank: r !== null && r <= 25 ? r : null, rivalry: rv ? rv.name ?? '' : null });
  }

  const pe = L.poll?.find((p) => p.team === T);
  const rank = pe && pe.rank <= 25 ? pe.rank : null;
  const traits = Object.fromEntries(Object.entries(L.traits).map(([k, v]) => [k, v[T]]));
  const ovr = season.teamOvr?.[T] ?? { off: 75, def: 75 };

  const f: Facts = {
    T, school: walshText(team.school), nick: walshText(team.nickname || team.school), city: walshText((team.city || '').split(',')[0] || team.school),
    conf: conf ? walshText(conf) : null, year: season.year, lastYear: prev.year, edition: ed,
    rank, firstVotes: pe?.firstVotes ?? 0,
    w: rec.w, l: rec.l, cw: rec.cw, cl: rec.cl, pf: rec.pf, pa: rec.pa, games,
    confPlace, lastFinal, champion: L.imported && vPrev.champion === T, post, wonConf,
    offRet, defRet, gone, inTransfers, recruits, classRank: classEv?.rank ?? null,
    qb, qbNew, hb: P(season.slots[T][1]), wr: best(WR), te: P(season.slots[T][13]), defStar,
    honors, statOf, traits, bigGames, ovr, theme: 'steady', newCoach: newCoachOf(d, season, prev, T, L.rivals), seat: seatOf(d, season, prev, T),
  };
  f.theme = themeOf(f, L);
  return f;
}

function lineText(s: ReturnType<Facts['statOf']>): string | null {
  if (s.pass && s.pass.yds >= 1500) return `${num(s.pass.yds)} passing yards`;
  if (s.rush && s.rush.yds >= 700) return `${num(s.rush.yds)} rushing yards`;
  if (s.rec && s.rec.yds >= 600) return `${num(s.rec.yds)} receiving yards`;
  if (s.def && s.def.sacks >= 7) return `${s.def.sacks} sacks`;
  if (s.def && s.def.int >= 4) return `${s.def.int} interceptions`;
  if (s.def && s.def.tkl >= 90) return `${s.def.tkl} tackles`;
  return null;
}

function themeOf(f: Facts, L: WalshLeague): Theme {
  const startersGone = f.gone.filter((g) => g.starter).length;
  const ret = f.offRet + f.defRet;
  if (f.champion) return 'champion';
  if (f.rank !== null && f.rank <= 6) return 'contender';
  if (f.inTransfers.filter((x) => x.starter).length >= 4) return 'portal';
  if (L.imported && f.lastFinal !== null && f.lastFinal <= 15 && (f.rank === null || f.rank - f.lastFinal >= 10)) return 'falling';
  if (ret <= 11 || startersGone >= 10) return 'rebuild';
  if (f.rank !== null && (f.lastFinal === null || f.lastFinal - f.rank >= 8)) return 'rising';
  if (f.rank === null && (f.ovr.off + f.ovr.def) / 2 < 74) return 'longshot';
  return 'steady';
}

// ---------------------------------------------------------------- names in the text

/** First mention "#9 Liam Szarka", then "Szarka"; a player with no name: "#9", described by class and position. */
class Names {
  private seen = new Set<number>();
  constructor(private d: Dynasty) {}
  /**
   * First mention "QB #9 Liam Szarka" (the position first, H-035), then "Szarka". `withRole` false when the sentence
   * puts a role word right before it ("Duke transfer #10 Darian Mensah").
   */
  ref(p: DPlayer, withRole = true): string {
    const named = !!(p.first || p.last);
    const last = walshText(p.last || p.first);
    if (this.seen.has(p.id)) return named ? last : `the ${noun(p)}`;
    this.seen.add(p.id);
    const no = p.jersey >= 0 ? `#${p.jersey}` : '';
    if (!named) return `${CLASS_WORD[p.cls] ?? ''} ${noun(p)} ${no}`.replace(/\s+/g, ' ').trim();
    const full = walshText(`${p.first} ${p.last}`);
    const name = full.split(' ').some((w) => w.length > 18) ? last : full;
    return `${withRole && no ? `${role(p)} ` : ''}${no} ${name}`.trim();
  }
  /** A former player: no number. */
  former(p: DPlayer): string {
    const named = !!(p.first || p.last);
    return named ? walshText(`${p.first} ${p.last}`) : `its ${CLASS_WORD[p.cls] ?? ''} ${noun(p)}`.replace(/\s+/g, ' ');
  }
  isSeen(p: DPlayer) { return this.seen.has(p.id); }
  mark(p: DPlayer) { this.seen.add(p.id); }
  /** Forget mentions (a sentence that was dropped). */
  snapshot() { return new Set(this.seen); }
  restore(s: Set<number>) { this.seen = s; }
}

// ---------------------------------------------------------------- sentences

interface Ctx { f: Facts; r: Rand; n: Names; L: WalshLeague; team: () => string; post: string; /** What has been said (no counting the same starters twice). */ said: Set<string> }

/** "Oregon" or "The Ducks", alternating so the report doesn't repeat itself. */
function teamNamer(f: Facts, r: Rand) {
  let k = 0;
  return () => {
    k++;
    if (k === 1) return f.school;
    return r() < 0.5 ? `the ${f.nick}` : f.school;
  };
}

type Gen = (c: Ctx) => string | null;
/** One fact: its importance (higher first) and how to say it. */
interface Item { side: 'off' | 'def'; weight: number; say: Gen; tag: string }

const S = (s: string | null) => (s ? cap(walshText(s)).replace(/\s+([.,!?])/g, '$1').replace(/\.\./g, '.').replace(/\.,/g, ',') : null);

// --- openings, by theme (offense paragraph)

function opening(c: Ctx): string {
  const { f, r } = c;
  const T = f.school, N = f.nick, Y = f.year, LY = f.lastYear;
  const rec = `${f.w}-${f.l}`;
  const rk = f.rank !== null ? `No. ${f.rank}` : null;
  const lastPost = f.post[f.post.length - 1];
  const bowlBit = lastPost?.name ? ` and ${lastPost.won ? 'won' : 'lost'} the ${lastPost.name}` : '';
  const by: Record<Theme, string[]> = {
    champion: [
      `${T} is the defending national champion, and the voters start it at ${rk ?? 'the top'} again.`,
      `The national title is ${T}'s to defend. The ${N} went ${rec} in ${LY} and open ${Y} ranked ${rk ?? 'among the best'}.`,
      `${T} finished ${LY} on top of college football at ${rec}${rk ? `, and the preseason poll has the ${N} at ${rk}` : ''}.`,
    ],
    contender: [
      `${T} opens ${Y} at ${rk} in the preseason poll${f.firstVotes ? ` with ${f.firstVotes} first-place ${f.firstVotes === 1 ? 'vote' : 'votes'}` : ''}.`,
      `The voters have ${T} at ${rk} to start ${Y}, and it isn't hard to see why.`,
      `${T} went ${rec} in ${LY}${bowlBit}, and starts ${Y} ranked ${rk}.`,
      `Expectations are high for the ${N}, ${rk} in the preseason poll.`,
    ],
    rising: [
      `${T} is on the way up. After going ${rec} in ${LY}, the ${N} open ${Y} ranked ${rk}.`,
      `The voters like what ${T} has coming back: ${rk} in the preseason poll after ${aRec(f.w, f.l)} season.`,
      `${T} starts ${Y} ranked ${rk}, its best start in a while.`,
    ],
    falling: [
      `${T} finished ${LY} ranked No. ${f.lastFinal}, but the voters aren't as sure about ${Y}${rk ? `: ${rk} in the preseason poll` : ' and left the ' + N + ' out of the preseason Top 25'}.`,
      `After ${aRec(f.w, f.l)} season, ${T} starts ${Y} with a lot to replace${rk ? ` and a ${rk} ranking` : ', unranked'}.`,
    ],
    rebuild: [
      ...(c.L.lostStarters[f.T] >= top(c.L.lostStarters, 0.1) ? [`Few teams lost more than ${T}.`, `${T} lost as many starters as anyone in the country.`] : []),
      `${T} has a lot of new faces in ${Y}.`,
      `This is a rebuilding year for the ${N}.`,
      `${T} went ${rec} in ${LY}, and much of that team is gone.`,
    ],
    portal: [
      ...(c.L.portalStarters[f.T] === Math.max(...c.L.portalStarters) ? [`No team used the transfer portal like ${T}.`] : []),
      ...(c.L.portalStarters[f.T] >= top(c.L.portalStarters, 0.05) ? [`Few teams leaned on the transfer portal more than ${T}.`] : []),
      `${T} rebuilt its roster through the transfer portal.`,
      `The ${N} will look very different in ${Y}: ${plural(f.inTransfers.length, 'transfer')} arrived in the offseason.`,
      // User, 2026-11-22: "lost six players to the portal but reloaded with seven".
      ...(f.gone.filter((g) => g.why === 'transfer').length >= 3 ? [`${T} lost ${word(f.gone.filter((g) => g.why === 'transfer').length)} players to the portal and reloaded with ${word(f.inTransfers.length)}.`] : []),
    ],
    steady: [
      `${T} went ${rec} in ${LY}${f.confPlace ? ` and finished ${ordinal(f.confPlace)} in the ${f.conf ?? 'conference'}` : ''}.`,
      `${T} is coming off ${aRec(f.w, f.l)} season${rk ? ` and starts ${Y} ranked ${rk}` : ''}.`,
      `After ${aRec(f.w, f.l)} season, ${T} returns ${plural(f.offRet + f.defRet, 'starter')}.`,
      `${T} brings back ${plural(f.offRet, 'starter')} on offense from a team that went ${rec}.`,
    ],
    longshot: f.w < f.l ? [
      `${T} went ${rec} in ${LY}, and the ${N} are trying to climb back.`,
      `It was a hard ${LY} for ${T} at ${rec}.`,
      `${T} is looking for a breakthrough after ${aRec(f.w, f.l)} season.`,
    ] : [
      `${T} went ${rec} in ${LY} and starts ${Y} outside the Top 25.`,
      `The voters left ${T} out of the preseason Top 25 after ${aRec(f.w, f.l)} season.`,
      `${T} is looking to build on ${aRec(f.w, f.l)} season.`,
    ],
  };
  const ok = (s: string) => !s.includes('null') && !(f.games === 0 && /\d+-\d+/.test(s));
  const pool = by[f.theme].filter(ok);
  const fallback = [`${T} opens ${Y} ${rk ? `ranked ${rk}` : 'outside the preseason Top 25'}.`, `${T} returns ${plural(f.offRet + f.defRet, 'starter')} for ${Y}.`, `${T} starts ${Y} with ${plural(f.offRet, 'starter')} back on offense.`].filter(ok);
  return pick(r, pool.length ? pool : by.steady.filter(ok).length ? by.steady.filter(ok) : fallback);
}

// --- the quarterback

const qbSay: Gen = (c) => {
  const { f, r, n } = c;
  const qb = f.qb;
  if (!qb) return null;
  const st = f.statOf(qb).pass;
  const tr = f.traits;
  const transfer = f.inTransfers.find((x) => x.p.id === qb.id);
  const recruit = f.recruits.find((x) => x.p.id === qb.id);
  const snap = n.snapshot();
  const seenBefore = n.isSeen(qb);
  const who = n.ref(qb);
  const style = tr.qbArm >= 0.85 && tr.qbLegs >= 0.85 ? pick(r, ['can beat you with his arm or his legs', 'is as dangerous running as he is throwing'])
    : tr.qbArm >= 0.85 ? pick(r, ['has a big arm', 'can make every throw', 'can stretch the field with his arm'])
    : tr.qbLegs >= 0.85 ? pick(r, ['can hurt you with his legs', 'is a threat to run on every play', 'is one of the fastest quarterbacks around'])
    : tr.qbHead >= 0.85 ? pick(r, ['rarely makes a bad decision', 'reads defenses as well as anyone'])
    : tr.qbArm <= 0.15 ? pick(r, ["doesn't have the arm to stretch the field", 'works the short passing game'])
    : null;
  if (transfer) {
    // H-035: "Duke transfer #10 Darian Mensah takes over at QB".
    n.restore(snap);
    const as = n.ref(qb, false);
    return `${walshText(transfer.from)} transfer ${as} takes over at QB${style ? ` and ${style}` : ''}.`;
  }
  if (recruit) return `${recruit.stars}-star freshman ${who} won the starting job${style ? ` and ${style}` : ''}.`;
  if (f.qbNew) {
    return pick(r, [
      `${who} takes over as the starter${style ? ` and ${style}` : ''}.`,
      `The new starter is ${who}${style ? `, who ${style}` : ''}.`,
      `Replacing the quarterback is the big job, and it falls to ${who}.`,
    ]);
  }
  // Already named (a returning Heisman winner, say): only last season's numbers, no second "is back".
  if (seenBefore) return st && st.yds >= 1500 ? `He threw for ${num(st.yds)} yards and ${st.td} touchdowns in ${f.lastYear}${style ? ` and ${style}` : ''}.` : null;
  if (st && st.yds >= 1500) {
    return pick(r, [
      `${who} is back at quarterback after throwing for ${num(st.yds)} yards and ${st.td} touchdowns in ${f.lastYear}.`,
      `${who} returns. He threw ${st.td} touchdown passes in ${f.lastYear}${st.int <= 6 ? ` and only ${st.int} ${st.int === 1 ? 'interception' : 'interceptions'}` : ''}.`,
      `${who} threw for ${num(st.yds)} yards in ${f.lastYear} and ${style ?? 'is back to run the offense'}.`,
    ]);
  }
  return pick(r, [
    `${who} returns as the starter${style ? ` and ${style}` : ''}.`,
    `${who} is the starter again${style ? `; he ${style}` : ''}.`,
  ]);
};

// --- skill players: stars and traits

const runnerSay: Gen = (c) => {
  const { f, r, n } = c;
  const hb = f.hb;
  if (!hb) return null;
  const st = f.statOf(hb).rush;
  const tr = f.traits;
  const style = tr.rbSpeed >= 0.85 ? pick(r, ['has breakaway speed', 'can go the distance on any carry', 'is a home-run threat', 'can outrun most defenses'])
    : tr.rbPower >= 0.85 ? pick(r, ['runs with power', 'is hard to bring down', 'punishes tacklers', 'gets the tough yards'])
    : null;
  if (st && st.yds >= 900) {
    const k = Math.floor(r() * 3);
    const who = n.ref(hb);
    return [
      `${who} ran for ${num(st.yds)} yards and ${st.td} touchdowns in ${f.lastYear}${style ? ` and ${style}` : ''}.`,
      `${who} is back after a ${num(st.yds)}-yard season.`,
      `The running game starts with ${who}, who had ${num(st.yds)} yards in ${f.lastYear}.`,
    ][k];
  }
  if (!style) return null;
  const who = n.ref(hb);
  return `${who} ${style}.`;
};

const receiverSay: Gen = (c) => {
  const { f, r, n } = c;
  const tr = f.traits;
  const wr = f.wr;
  const st = wr ? f.statOf(wr).rec : undefined;
  const strong = tr.recSpeed >= 0.85 || tr.recHands >= 0.85;
  const group = tr.recSpeed >= 0.85 && tr.recHands >= 0.85 ? pick(r, ['The receivers are fast and sure-handed', 'This receiving corps has speed and hands'])
    : tr.recSpeed >= 0.85 ? pick(r, ['The receivers are fast', 'There is speed to burn at receiver', `${f.school} has as much speed at receiver as anyone`])
    : tr.recHands >= 0.85 ? pick(r, ['The receivers catch everything thrown their way', 'This is a sure-handed group of receivers'])
    : tr.recSpeed <= 0.15 ? pick(r, ['Nobody at receiver can really stretch the field', 'The receivers lack speed', 'There is no deep threat at receiver'])
    : null;
  if (wr && st && st.yds >= 800) {
    const who = n.ref(wr);
    const lead = pick(r, [
      `${who} caught ${st.rec} passes for ${num(st.yds)} yards in ${f.lastYear}`,
      `${who} is back after ${num(st.yds)} receiving yards`,
      `The top target is ${who} (${st.rec} catches, ${num(st.yds)} yards)`,
    ]);
    return group ? `${lead}. ${group}.` : `${lead}.`;
  }
  if (!group) return null;
  return strong && wr && r() < 0.6 ? `${group}, led by ${n.ref(wr)}.` : `${group}.`;
};

const lineSay: Gen = (c) => {
  const { f, r } = c;
  const tr = f.traits;
  const olBack = OL.filter((s) => { const id = c.L.season.slots[f.T][s]; return id !== null && c.L.prev.slots[f.T].includes(id); }).length;
  if (tr.olSize >= 0.85 && tr.olBlock >= 0.7) return pick(r, ['The line is big and moves people.', `It's one of the biggest lines in the country, and it can block.`]);
  if (tr.olSize >= 0.85) return pick(r, ['The offensive line is big and heavy.', 'Up front, the line has plenty of size.']);
  if (tr.olBlock >= 0.85) return pick(r, ['The line opens holes and keeps the quarterback clean.', 'This is one of the best blocking lines around.']);
  if (olBack >= 5) return pick(r, ['All five starters are back on the line.', 'The whole offensive line returns.']);
  if (olBack <= 1) return pick(r, ['The line is almost all new.', `There are ${word(5 - olBack)} new starters on the line.`]);
  if (tr.olBlock <= 0.15) return pick(r, ['The line has to get better at opening holes.', 'The line struggles to block.']);
  if (tr.olSize <= 0.15) return 'The line is undersized.';
  return null;
};

const kickSay: Gen = (c) => {
  const { f, r } = c;
  if (f.traits.kLeg <= 0.1) return pick(r, ['Place kicking is a real worry.', 'The kicking game is a question mark.']);
  if (f.traits.kLeg >= 0.92) return pick(r, ['The kicker has range from well past midfield.', 'A strong-legged kicker gives the offense points from long range.']);
  return null;
};

// --- the offense as a whole

const schemeSay: Gen = (c) => {
  const { f, r } = c;
  const t = f.traits;
  if (t.rbPower >= 0.75 && t.olSize >= 0.7 && t.recSpeed < 0.5) return pick(r, ['This is a power running team that wants to wear you down.', `${cap(f.school)} likes to line up and run right at you.`, 'Expect a physical, run-first offense.']);
  if (t.qbArm >= 0.7 && t.recSpeed >= 0.7) return pick(r, ['Expect a lot of big plays down the field.', 'This offense is built to throw deep.', 'The passing game can strike from anywhere on the field.']);
  if (t.qbLegs >= 0.8 && t.rbSpeed >= 0.6) return pick(r, ['The offense is built on speed in the backfield.', 'Speed at quarterback and halfback makes this a dangerous running offense.']);
  if (t.recHands >= 0.7 && t.qbHead >= 0.7) return pick(r, ['Expect short, quick passes that keep the chains moving.', 'The passing game is patient and efficient.']);
  return null;
};

const offRetSay: Gen = (c) => {
  const { f, r } = c;
  if (c.said.has('goneOff')) return null;
  c.said.add('retOff');
  if (f.offRet >= 9) return pick(r, [`Nearly the whole offense is back: ${word(f.offRet)} starters return.`, `The offense returns ${plural(f.offRet, 'starter')}, so there is plenty of experience.`]);
  if (f.offRet <= 4) return pick(r, [`Only ${plural(f.offRet, 'starter')} return on offense.`, `The offense is mostly new, with ${plural(f.offRet, 'starter')} back.`]);
  return pick(r, [`${cap(word(f.offRet))} starters are back on offense.`, `The offense returns ${plural(f.offRet, 'starter')}.`]);
};

const scoringSay: Gen = (c) => {
  const { f, r } = c;
  if (!f.games) return null;
  const ppg = Math.round(f.pf / f.games);
  if (ppg >= 35) return pick(r, [`The ${f.nick} scored ${ppg} points a game in ${f.lastYear}.`, `${cap(f.school)} put up ${ppg} points a game in ${f.lastYear}, and the scoring should keep coming.`]);
  if (ppg <= 17) return pick(r, [`Points were hard to come by in ${f.lastYear}: ${ppg} a game.`, `The offense managed only ${ppg} points a game in ${f.lastYear}.`]);
  return pick(r, [`The offense averaged ${ppg} points a game in ${f.lastYear}.`, `${cap(f.school)} scored ${ppg} points a game in ${f.lastYear}.`]);
};

const teSay: Gen = (c) => {
  const { f, r, n } = c;
  const te = f.te;
  if (!te || n.isSeen(te)) return null;
  const st = f.statOf(te).rec;
  if (st && st.yds >= 450) { const who = n.ref(te); return pick(r, [`${who} caught ${st.rec} passes in ${f.lastYear}.`, `${who} is a reliable target (${num(st.yds)} yards in ${f.lastYear}).`]); }
  if (te.ovr >= 86) { const who = n.ref(te); return pick(r, [`${who} is a matchup problem.`, `${who} is one of the best tight ends in the country.`]); }
  return null;
};

// --- last season

const seasonSay: Gen = (c) => {
  const { f, r, L } = c;
  if (!f.games) return null;
  const last = f.post[f.post.length - 1];
  const oppName = last ? walshText(L.d.teams[last.opp]?.school ?? '') : '';
  if (f.champion) return pick(r, [`The ${f.nick} finished ${f.w}-${f.l} and won the national title in ${f.lastYear}.`]);
  if (last?.name) return last.won
    ? pick(r, [`${cap(f.school)} beat ${oppName} in the ${last.name} to finish ${f.lastYear} at ${f.w}-${f.l}.`, `The ${f.nick} won the ${last.name} and finished ${f.w}-${f.l}.`])
    : pick(r, [`${cap(f.school)} lost the ${last.name} to ${oppName} and finished ${f.w}-${f.l}.`, `The ${f.nick} finished ${f.w}-${f.l} after a loss in the ${last.name}.`]);
  if (last && last.final) return `${cap(f.school)} reached the national title game in ${f.lastYear} and lost to ${oppName}.`;
  if (last && !last.title) return pick(r, [`${cap(f.school)} made the playoff in ${f.lastYear} and ${last.won ? 'won a game' : `lost to ${oppName}`}.`, `${f.lastYear} ended in the playoff${last.won ? '' : `, with a loss to ${oppName}`}.`]);
  if (f.wonConf && f.conf) return pick(r, [`${cap(f.school)} won the ${f.conf} in ${f.lastYear}.`, `The ${f.nick} are the defending ${f.conf} champions.`]);
  if (f.confPlace && f.conf) return pick(r, [`${cap(f.school)} finished ${ordinal(f.confPlace)} in the ${f.conf} at ${f.cw}-${f.cl}.`, `The ${f.nick} were ${f.cw}-${f.cl} in ${f.conf} play.`]);
  return null;
};

// --- departures and arrivals

function goneSay(side: 'off' | 'def'): Gen {
  return (c) => {
    const { f, r, n } = c;
    const g = f.gone.filter((x) => x.side === side && x.starter);
    if (!g.length) return null;
    const counted = c.said.has(side === 'off' ? 'retOff' : 'retDef');
    c.said.add(side === 'off' ? 'goneOff' : 'goneDef');
    const top = g.filter((x) => x.p.ovr >= 82 || x.line).slice(0, 2);
    const unit = side === 'off' ? 'offense' : 'defense';
    const adj = side === 'off' ? 'offensive' : 'defensive';
    const why = (x: (typeof g)[number]) => (x.why === 'pro' ? 'left for the pros' : x.why === 'transfer' ? `transferred${x.to !== null ? ` to ${walshText(c.L.d.teams[x.to].school)}` : ''}` : 'graduated');
    if (top.length === 1) {
      const x = top[0];
      return pick(r, [
        `${n.former(x.p)}${x.line ? ` (${x.line})` : ''} ${why(x)}.`,
        `The ${unit} has to replace ${n.former(x.p)}, who ${why(x)}.`,
      ]) + (g.length >= 3 && !counted ? ` ${cap(word(g.length))} ${adj} starters are gone in all.` : '');
    }
    if (top.length === 2) {
      return pick(r, [
        `${n.former(top[0].p)} and ${n.former(top[1].p)} are gone from the ${unit}.`,
        `The ${unit} lost ${n.former(top[0].p)} and ${n.former(top[1].p)}${g.length > 2 && !counted ? `, ${word(g.length)} starters in all` : ''}.`,
      ]);
    }
    if (g.length >= 3 && !counted) return `${cap(word(g.length))} ${adj} starters are gone.`;
    return null;
  };
}

function arrivalSay(side: 'off' | 'def'): Gen {
  return (c) => {
    const { f, r, n } = c;
    const sideOf = (p: DPlayer) => { const s = c.L.season.slots[f.T].indexOf(p.id); return s < 0 ? null : s < 16 || s === 31 ? 'off' : 'def'; };
    const tr = f.inTransfers.filter((x) => x.starter && sideOf(x.p) === side && x.p.id !== f.qb?.id && !n.isSeen(x.p));
    const rc = f.recruits.filter((x) => x.starter && sideOf(x.p) === side && x.p.id !== f.qb?.id && !n.isSeen(x.p));
    if (tr.length >= 2) {
      const k = Math.floor(r() * 2);
      const a0 = tr[0].p, a1 = tr[1].p;
      if (k === 0) { const w0 = n.ref(a0), w1 = n.ref(a1); return `Transfers ${w0} and ${w1} step in as starters.`; }
      return `${cap(word(tr.length))} transfers start, among them ${n.ref(a0)}.`;
    }
    if (tr.length === 1) {
      // H-035: by the school he came from, with position and number, once.
      const x = tr[0], from = walshText(x.from), who = n.ref(x.p);
      return pick(r, [`${from} transfer ${who} starts.`, `${from} transfer ${who} steps in as a starter.`]);
    }
    if (rc.length && rc[0].stars >= 4) {
      const x = rc[0], who = n.ref(x.p);
      return pick(r, [`${x.stars}-star freshman ${who} starts right away.`, `Watch for ${x.stars}-star freshman ${who}, a starter from day one.`]);
    }
    return null;
  };
}

/** The head coach this season, when he's new (a coach who wasn't last season's). */
function newCoachOf(d: Dynasty, season: DSeason, prev: DSeason, T: number, rivals: { a: number; b: number }[]): Facts['newCoach'] {
  const now = season.coach?.[T], was = prev.coach?.[T];
  if (now === null || now === undefined || was === undefined || now === was) return null;
  const c = d.coaches?.[now];
  if (!c) return null;
  const from = prev.coach?.indexOf(now) ?? -1;
  const fromRival = from >= 0 && rivals.some((x) => (x.a === T && x.b === from) || (x.b === T && x.a === from));
  return { name: walshText(c.name), from: from >= 0 ? walshText(d.teams[from].school) : null, former: !!c.formerPlayer, fromRival };
}

/** The head coach is back on a hot seat (55 or more after last season) and can be fired after this one. */
function seatOf(d: Dynasty, season: DSeason, prev: DSeason, T: number): Facts['seat'] {
  const id = season.coach?.[T];
  if (id === null || id === undefined || prev.coach?.[T] !== id) return null;
  const c = d.coaches?.[id];
  const si = d.seasons.indexOf(season), pi = d.seasons.indexOf(prev);
  if (!c || si < 0 || pi < 0 || tenure(d, c, si) < 3) return null;
  const heat = hotSeat(d, c, pi);
  return heat !== null && heat >= 55 ? { name: walshText(c.name), heat } : null;
}

const coachSay: Gen = (c) => {
  const { f, r } = c;
  const k = f.newCoach;
  if (!k) return null;
  if (k.from && k.fromRival) return pick(r, [`${k.name} crosses the rivalry from ${k.from}, and fans on both sides will remember it.`, `${k.name} comes over from rival ${k.from}. That game just got bigger.`]);
  if (k.from) return pick(r, [`${k.name} comes over from ${k.from} for his first season.`, `In his first season, ${k.name} brings his program over from ${k.from}.`]);
  if (k.former) return pick(r, [`${k.name}, a former player, gets his first head coaching job.`, `In his first season, former player ${k.name} takes over.`]);
  return pick(r, [`In his first season, ${k.name} takes over the program.`, `${k.name} is the new head coach.`]);
};

const seatSay: Gen = (c) => {
  const { f, r } = c;
  const k = f.seat;
  if (!k) return null;
  return k.heat >= 75
    ? pick(r, [`${k.name} needs a winning season to keep his job.`, `This may be ${k.name}'s last chance to turn things around.`])
    : pick(r, [`${k.name}'s seat is warm going in, so a fast start matters.`, `The pressure is on ${k.name} to win now.`]);
};

const classSay: Gen = (c) => {
  const { f, r } = c;
  if (f.classRank === null || f.classRank > 10) return null;
  const five = f.recruits.filter((x) => x.stars === 5).length;
  return pick(r, [
    `${f.school} signed the No. ${f.classRank} recruiting class${five ? `, with ${plural(five, '5-star player')}` : ''}.`,
    `The ${ordinal(f.classRank)}-ranked signing class adds talent${five ? `, ${plural(five, '5-star recruit')} among it` : ''}.`,
  ]);
};

// --- honors

function honorSay(side: 'off' | 'def'): Gen {
  return (c) => {
    const { f, r, n } = c;
    const sideOf = (p: DPlayer) => { const s = c.L.season.slots[f.T].indexOf(p.id); return s < 0 ? null : s < 16 || s === 31 ? 'off' : 'def'; };
    const h = f.honors.find((x) => sideOf(x.p) === side && !n.isSeen(x.p)) ?? f.honors.find((x) => sideOf(x.p) === side && x.heisman);
    if (!h) return null;
    if (n.isSeen(h.p)) return h.heisman ? pick(r, [`He won the Heisman Trophy in ${f.lastYear}.`, `${walshText(h.p.last)} is the reigning Heisman winner.`]) : null;
    const who = n.ref(h.p);
    if (h.heisman) return pick(r, [`Heisman winner ${who} is back.`, `${who} won the Heisman Trophy in ${f.lastYear}, and he returns.`, `The reigning Heisman winner, ${who}, is back for another season.`]);
    if (h.what === 'All-American') return pick(r, [`All-American ${who} returns.`, `${who}, an All-American in ${f.lastYear}, is back.`]);
    return pick(r, [`${who} won ${h.what} in ${f.lastYear}.`, `${who} returns after winning ${h.what}.`]);
  };
}

// --- defense

const defOpenSay: Gen = (c) => {
  const { f, r } = c;
  const ppg = f.games ? f.pa / f.games : 0;
  // A defense ending on its returning starters (verdict) opens with points allowed instead.
  if (c.said.has('verdictRetDef') && !f.games) return null;
  if (f.games && (c.said.has('verdictRetDef') || r() < 0.6)) {
    const how = ppg <= 17 ? pick(r, ['one of the stingiest defenses in the country', 'a defense that was hard to score on']) : ppg >= 31 ? pick(r, ['a defense that struggled', 'a defense that gave up a lot of points']) : null;
    return pick(r, [
      `The ${f.nick} allowed ${Math.round(ppg)} points a game in ${f.lastYear}${how ? `, ${how}` : ''}.`,
      `${f.school}'s defense gave up ${Math.round(ppg)} points a game in ${f.lastYear}.`,
    ]);
  }
  c.said.add('retDef');
  const lines = [`${cap(word(f.defRet))} starters are back on defense.`, `The defense returns ${plural(f.defRet, 'starter')}.`];
  if (f.defRet >= 9) lines.push(`Nearly the whole defense is back: ${word(f.defRet)} starters return.`);
  if (f.defRet <= 4) lines.push(`The defense is mostly new, with only ${plural(f.defRet, 'starter')} back.`);
  return pick(r, lines);
};

const defStarSay: Gen = (c) => {
  const { f, r, n } = c;
  const p = f.defStar;
  if (!p || n.isSeen(p)) return null;
  const st = f.statOf(p).def;
  const ok = (st && (st.sacks >= 6 || st.int >= 4 || st.tkl >= 80)) || p.ovr >= 85;
  if (!ok) return null;
  const who = n.ref(p);
  if (st && st.sacks >= 6) return pick(r, [`${who} had ${st.sacks} sacks in ${f.lastYear}.`, `${who} led the way with ${st.sacks} sacks.`]);
  if (st && st.int >= 4) return pick(r, [`${who} picked off ${st.int} passes in ${f.lastYear}.`, `${who} had ${st.int} interceptions.`]);
  if (st && st.tkl >= 80) return pick(r, [`${who} made ${st.tkl} tackles in ${f.lastYear}.`, `${who} is the leader, with ${st.tkl} tackles in ${f.lastYear}.`]);
  return pick(r, [`The best player on the defense is ${who}.`, `Everything starts with ${who}.`, `${who} is the one to watch.`, `${who} anchors the defense.`, `The defense is built around ${who}.`]);
};

const frontSay: Gen = (c) => {
  const { f, r } = c;
  const t = f.traits;
  if (t.dlRush >= 0.85 && t.dlPower >= 0.7) return pick(r, ['The front four can rush the passer and hold up against the run.', 'Up front the line is fast off the edge and strong inside.']);
  if (t.dlRush >= 0.85) return pick(r, ['The ends get to the quarterback.', 'There is real speed off the edge.', 'The pass rush off the edge is a strength.']);
  if (t.dlPower >= 0.85) return pick(r, ['The line is hard to run on.', 'It is a stout front.']);
  if (t.dlPower <= 0.15) return pick(r, ['This team can be run on.', 'The front has to hold up better against the run.']);
  if (t.dlRush <= 0.15) return pick(r, ['The ends lack speed off the edge.', 'Pressure on the quarterback has to come from somewhere.']);
  return null;
};

const backSay: Gen = (c) => {
  const { f, r } = c;
  const t = f.traits;
  if (t.lbSpeed >= 0.85) return pick(r, ['The linebackers run sideline to sideline.', 'This is a fast group of linebackers.', 'The linebackers can run with backs and tight ends.', 'Speed at linebacker shuts down the outside run.']);
  if (t.dbSpeed >= 0.85 && t.dbHands >= 0.7) return pick(r, ['The secondary is fast and takes the ball away.', 'It is a fast, ballhawking secondary.']);
  if (t.dbSpeed >= 0.85) return pick(r, ['The corners can run with anyone.', 'The secondary has plenty of speed.']);
  if (t.dbHands >= 0.85) return pick(r, ['The secondary has a nose for the football.', 'The defensive backs catch what comes their way.']);
  if (t.dbSpeed <= 0.15) return pick(r, ["The secondary can't run with fast receivers.", 'The secondary lacks speed.']);
  if (t.lbTackle <= 0.15) return 'The linebackers miss too many tackles.';
  return null;
};

// --- the schedule and the closing line

const scheduleSay: Gen = (c) => {
  const { f, r, L } = c;
  const g = f.bigGames.slice().sort((a, b) => Number(b.rivalry !== null) - Number(a.rivalry !== null) || (a.rank ?? 99) - (b.rank ?? 99))[0];
  if (!g) return null;
  const opp = walshText(L.d.teams[g.opp].school);
  const oppR = g.rank ? `No. ${g.rank} ${opp}` : opp;
  const where = g.home ? `in ${f.city}` : 'on the road';
  const sameCity = opp.includes(f.city) || walshText((L.d.teams[g.opp].city || '').split(',')[0]) === f.city;
  const visit = sameCity ? 'comes to town' : `comes to ${f.city}`;
  const bring = sameCity ? `brings ${oppR} across town` : `brings ${oppR} to ${f.city}`;
  if (g.rivalry !== null) {
    const nm = g.rivalry;
    const self = nm.includes(opp);
    return pick(r, nm ? [
      self ? `${cap(nm)} is ${g.home ? `in ${f.city}` : 'on the road'} in Week ${g.week}${g.rank ? `, against No. ${g.rank} ${opp}` : ''}.` : `${cap(nm)} against ${oppR} is ${g.home ? `in ${f.city}` : 'on the road'} in Week ${g.week}.`,
      `Week ${g.week} brings ${nm}: ${oppR}, ${g.home ? 'at home' : 'on the road'}.`,
      `${oppR} ${g.home ? visit : 'is a road trip'} in Week ${g.week} for ${nm}.`,
    ] : [
      `The rivalry game with ${oppR} is ${where} in Week ${g.week}.`,
      `Rival ${oppR} ${g.home ? visit : 'is a road trip'} in Week ${g.week}.`,
    ]);
  }
  return pick(r, [
    `The big one is ${oppR} in Week ${g.week}${g.home ? ', at home' : ', on the road'}.`,
    `${oppR} ${g.home ? visit : 'is a road trip'} in Week ${g.week}.`,
    `Week ${g.week} ${g.home ? bring : `means a trip to ${oppR}`}.`,
  ]);
};

/**
 * How a paragraph ends (H-035; the base game's way): on the side's clearest strength or weakness, with the fact behind
 * it in the same sentence or one forced into the paragraph (`need`). No theme closers. A weakness wins over a strength
 * when both are clear; nothing clear: no ending line.
 */
interface Verdict { text: string; /** The item whose fact this sentence repeats: left out. */ drop?: string; /** The item it rests on: always in. */ need?: string; /** It counts the returning starters. */ ret?: boolean }
function verdict(c: Ctx, side: 'off' | 'def'): Verdict | null {
  const { f, r, L } = c;
  const t = f.traits;
  const strong: { v: number; out: Verdict }[] = [], weak: { v: number; out: Verdict }[] = [];
  if (side === 'off') {
    const olBack = OL.filter((sl) => { const id = L.season.slots[f.T][sl]; return id !== null && L.prev.slots[f.T].includes(id); }).length;
    if (f.offRet <= 4) weak.push({ v: 0.95, out: { text: pick(r, [`Only ${plural(f.offRet, 'starter')} return on offense, so experience is the question.`, `With ${plural(f.offRet, 'starter')} back, the offense is the question.`]), drop: 'ret', ret: true } });
    if (olBack <= 1) weak.push({ v: 0.9, out: { text: `${cap(word(5 - olBack))} new starters on the line make it the question.`, drop: 'ol' } });
    else if (t.olBlock <= 0.15) weak.push({ v: 1 - t.olBlock, out: { text: pick(r, ['The line has trouble opening holes, and that is the question.', 'Blocking up front is the question.']), drop: 'ol' } });
    if (t.recSpeed <= 0.15) weak.push({ v: 1 - t.recSpeed, out: { text: 'Nobody at receiver can stretch the field, so a deep threat is the question.', drop: 'wr' } });
    if (t.kLeg <= 0.1) weak.push({ v: 0.8, out: { text: 'Place kicking is the question.', drop: 'k' } });
    if (t.olSize >= 0.85 || t.olBlock >= 0.85 || olBack >= 5) strong.push({ v: Math.max(t.olSize, t.olBlock, olBack >= 5 ? 0.86 : 0), out: { text: pick(r, ['The line is the strength.', 'Up front is where this offense wins.']), need: 'ol' } });
    if (t.recSpeed >= 0.85 || t.recHands >= 0.85) strong.push({ v: Math.max(t.recSpeed, t.recHands), out: { text: pick(r, ['The receivers are the strength.', 'The passing game is the strength.']), need: 'wr' } });
    if (t.rbSpeed >= 0.85 || t.rbPower >= 0.85) strong.push({ v: Math.max(t.rbSpeed, t.rbPower), out: { text: 'The running game is the strength.', need: 'hb' } });
    if (f.qb && (t.qbArm >= 0.85 || t.qbLegs >= 0.85 || t.qbHead >= 0.85)) strong.push({ v: Math.max(t.qbArm, t.qbLegs, t.qbHead), out: { text: 'The quarterback is the strength.', need: 'qb' } });
  } else {
    if (f.defRet <= 4) weak.push({ v: 0.95, out: { text: pick(r, [`Only ${plural(f.defRet, 'starter')} return on defense, so this unit is the question.`, `With ${plural(f.defRet, 'starter')} back, the defense is the question.`]), ret: true } });
    if (t.dlPower <= 0.15) weak.push({ v: 1 - t.dlPower, out: { text: 'The front can be run on, and that is the question.', drop: 'front' } });
    else if (t.dlRush <= 0.15) weak.push({ v: 1 - t.dlRush, out: { text: 'The ends lack speed, so the pass rush is the question.', drop: 'front' } });
    if (t.dbSpeed <= 0.15) weak.push({ v: 1 - t.dbSpeed, out: { text: "The secondary can't run with fast receivers, and that is the question.", drop: 'back' } });
    else if (t.lbTackle <= 0.15) weak.push({ v: 1 - t.lbTackle, out: { text: 'The linebackers miss tackles, and that is the question.', drop: 'back' } });
    if (t.dlRush >= 0.85 || t.dlPower >= 0.85) strong.push({ v: Math.max(t.dlRush, t.dlPower), out: { text: pick(r, ['The front is the strength.', 'The line up front is the strength.']), need: 'front' } });
    if (t.lbSpeed >= 0.85) strong.push({ v: t.lbSpeed, out: { text: 'The linebackers are the strength.', need: 'back' } });
    else if (t.dbSpeed >= 0.85 || t.dbHands >= 0.85) strong.push({ v: Math.max(t.dbSpeed, t.dbHands), out: { text: 'The secondary is the strength.', need: 'back' } });
  }
  const best = (xs: { v: number; out: Verdict }[]) => xs.sort((a, b) => b.v - a.v)[0]?.out ?? null;
  const clear = best(weak) ?? best(strong);
  if (clear) return clear;
  // Nothing stands out: the side's experience, with the fact in the sentence.
  const back = side === 'off' ? f.offRet : f.defRet, unit = side === 'off' ? 'offense' : 'defense';
  return back >= 7
    ? { text: pick(r, [`With ${plural(back, 'starter')} back, experience is the strength of this ${unit}.`, `${cap(plural(back, 'starter'))} return, so experience is the strength.`]), drop: side === 'off' ? 'ret' : undefined, ret: true }
    : { text: `With ${plural(back, 'starter')} back, depth is the question.`, drop: side === 'off' ? 'ret' : undefined, ret: true };
}

// --- team-level lines for the opener, and the early Heisman favorites

/** "Navy is the American favorite": the highest-ranked team of its conference in the app's preseason poll. */
const favoriteSay: Gen = (c) => {
  const { f, L } = c;
  if (f.rank === null || !f.conf) return null;
  const mine = L.season.conf[f.T];
  const better = (L.poll ?? []).some((p) => p.rank < f.rank! && L.season.conf[p.team] === mine);
  return better ? null : pick(c.r, [`${f.school} is the ${f.conf} favorite.`, `The ${f.nick} are the team to beat in the ${f.conf}.`]);
};

/**
 * A big donor (nil.ts; user, 2026-11-22): the season he arrives. Amounts in words, the game's font has no dollar sign.
 * NIL in the reports only when it's notable (user, 2026-11-22): this, `nilSay`.
 */
const donorSay: Gen = (c) => {
  const { f, L } = c;
  if (L.season.nil?.donor?.[f.T] !== NIL.donorSeasons) return null;
  const was = L.prev.nil?.budget[f.T] ?? 0, now = L.season.nil.budget[f.T];
  const from = was > 0 ? `, up from ${moneyWords(was)}` : '';
  return pick(c.r, [
    `A big donor has changed the outlook at ${f.school}: its NIL budget is now ${moneyWords(now)}${from}.`,
    `New booster money has ${f.school} thinking big. Its NIL budget is ${moneyWords(now)}${from}.`,
  ]);
};

const GROUP_WORD: Record<string, string> = { QB: 'quarterback', RB: 'running back', WR: 'receiver', TE: 'tight end', OL: 'offensive lineman', DL: 'defensive lineman', LB: 'linebacker', DB: 'defensive back' };

/**
 * Notable NIL only (user, 2026-11-22): the biggest NIL budget in the country (half the time), or the country's
 * highest-paid player at a position group (kickers left out), when he plays here. Not in a donor year.
 */
const nilSay: Gen = (c) => {
  const { f, L } = c, d = L.d;
  const b = L.season.nil?.budget;
  if (!b || L.season.nil?.donor?.[f.T] === NIL.donorSeasons) return null;
  if (b[f.T] === Math.max(...b) && c.r() < 0.5) {
    return pick(c.r, [`No school spends more on NIL than ${f.school}: ${moneyWords(b[f.T])} this year.`, `${f.school} has the biggest NIL budget in the country, ${moneyWords(b[f.T])}.`]);
  }
  const top = new Map<string, DPlayer>();
  for (const p of d.players) {
    if (p.status !== 'active' || p.team === null || !(p.nil && p.nil > 0)) continue;
    const g = groupOf(p.pos);
    if (!GROUP_WORD[g]) continue;
    const cur = top.get(g);
    if (!cur || p.nil > (cur.nil ?? 0)) top.set(g, p);
  }
  const mine = [...top.entries()].filter(([, p]) => p.team === f.T).sort((x, y) => (y[1].nil ?? 0) - (x[1].nil ?? 0))[0];
  if (!mine) return null;
  const [g, p] = mine;
  return pick(c.r, [
    `${cap(c.n.ref(p))} is the highest-paid ${GROUP_WORD[g]} in the country, at ${moneyWords(p.nil!)}.`,
    `No ${GROUP_WORD[g]} in the country makes more in NIL than ${c.n.ref(p)}: ${moneyWords(p.nil!)}.`,
  ]);
};


/**
 * The dynasty era (user, 2026-11-18): only from the dynasty's fourth season, worded "this dynasty era (N years)", a
 * team's rise, fall or continued dominance over the seasons played, and rarely (about one team in four of those with a
 * clear pattern).
 */
const eraSay: Gen = (c) => {
  const { f, L } = c;
  const ranks = L.eraRanks.map((rk) => rk[f.T] || 99);
  if (ranks.length < 3 || c.r() >= 0.25) return null;
  const N = ranks.length, top10 = ranks.every((x) => x <= 10), first = ranks[0], last = ranks[N - 1];
  const era = `this dynasty era (${N} years)`;
  if (top10) return pick(c.r, [`${f.school} has finished in the top 10 every year of ${era}.`, `${f.school} continues its dominance of ${era}.`]);
  if (first > 25 && last <= 15 && ranks[N - 2] >= last) return `${f.school} has climbed steadily over ${era}.`;
  if (first <= 10 && last > 25) return `${f.school} has slipped over ${era}.`;
  return null;
};

/** A player on the app's preseason Heisman favorites list (heismanPre.ts, top 10): "among the early Heisman favorites". */
function heismanSay(side: 'off' | 'def'): Gen {
  return (c) => {
    const { f, r, n, L } = c;
    const h = L.heisman.find((x) => x.team === f.T && (x.slot < 16) === (side === 'off'));
    if (!h) return null;
    const p = L.d.players[h.player - 1];
    if (!p || n.isSeen(p)) return null;
    const who = n.ref(p);
    return pick(r, [`${who} is among the early Heisman favorites.`, `${who} starts the year as a Heisman contender.`]);
  };
}

// ---------------------------------------------------------------- assembly

/** Builds one paragraph: the must-have sentences, then the rest by weight while they fit, then its ending (verdict). */
function build(c: Ctx, first: (string | null)[], items: Item[], budget: number, last: string | null, v: Verdict | null = null): string {
  const out: string[] = first.filter((s): s is string => !!s);
  const len = () => out.join(' ').length + (last ? last.length + 1 : 0);
  // A little randomness in the order of facts of about the same weight; the ending's fact first, its repeat left out.
  const order = items.filter((it) => it.tag !== v?.drop).map((it) => ({ it, w: it.weight + c.r() * 1.5 + (it.tag === v?.need ? 100 : 0) })).sort((a, b) => b.w - a.w);
  for (const { it } of order) {
    const snap = c.n.snapshot();
    const s = S(it.say(c));
    if (!s) { c.n.restore(snap); continue; }
    if (len() + 1 + s.length > budget) { c.n.restore(snap); continue; }
    out.push(s);
  }
  if (last && len() <= budget) out.push(last);
  return out.join(' ');
}

const seedOf = (d: Dynasty, season: DSeason, team: number, variant: number) => {
  let h = (season.index + 1) * 2654435761 + team * 40503 + variant * 9973;
  for (const ch of d.id) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return h >>> 0;
};

/** One team's report. `variant` picks another set of wordings ("Write it again"). */
export function walshReport(L: WalshLeague, team: number, variant = 0): Report {
  const f = factsOf(L, team);
  const r = rng(seedOf(L.d, L.season, team, variant));
  const n = new Names(L.d);
  const c: Ctx = { f, r, n, L, team: teamNamer(f, r), post: '', said: new Set() };

  const offItems: Item[] = [
    { side: 'off', weight: f.newCoach ? 12 : 0, say: coachSay, tag: 'coach' },
    { side: 'off', weight: f.seat ? (f.seat.heat >= 75 ? 11 : 8) : 0, say: seatSay, tag: 'coach' },
    { side: 'off', weight: 9, say: qbSay, tag: 'qb' },
    { side: 'off', weight: f.honors.some((h) => h.heisman) ? 10 : 6, say: honorSay('off'), tag: 'honor' },
    { side: 'off', weight: 6, say: runnerSay, tag: 'hb' },
    { side: 'off', weight: 6, say: receiverSay, tag: 'wr' },
    { side: 'off', weight: 5, say: lineSay, tag: 'ol' },
    { side: 'off', weight: f.gone.some((g) => g.side === 'off' && g.starter && g.p.ovr >= 82) ? 7 : 4, say: goneSay('off'), tag: 'gone' },
    { side: 'off', weight: f.theme === 'portal' ? 8 : 4, say: arrivalSay('off'), tag: 'new' },
    { side: 'off', weight: 2, say: kickSay, tag: 'k' },
    { side: 'off', weight: 3.5, say: schemeSay, tag: 'scheme' },
    { side: 'off', weight: 3, say: offRetSay, tag: 'ret' },
    { side: 'off', weight: 2.5, say: scoringSay, tag: 'pts' },
    { side: 'off', weight: 3, say: teSay, tag: 'te' },
    { side: 'off', weight: f.theme === 'steady' || f.theme === 'longshot' ? 1 : 3, say: seasonSay, tag: 'season' },
    { side: 'off', weight: f.theme === 'contender' || f.theme === 'champion' ? 3 : 4, say: classSay, tag: 'class' },
    { side: 'off', weight: 8.5, say: heismanSay('off'), tag: 'heisman' },
  ];
  const defItems: Item[] = [
    { side: 'def', weight: 7, say: defStarSay, tag: 'star' },
    { side: 'def', weight: 6, say: honorSay('def'), tag: 'honor' },
    { side: 'def', weight: 6, say: frontSay, tag: 'front' },
    { side: 'def', weight: 5, say: backSay, tag: 'back' },
    { side: 'def', weight: f.gone.some((g) => g.side === 'def' && g.starter && g.p.ovr >= 82) ? 7 : 4, say: goneSay('def'), tag: 'gone' },
    { side: 'def', weight: f.theme === 'portal' ? 7 : 4, say: arrivalSay('def'), tag: 'new' },
    { side: 'def', weight: 8, say: heismanSay('def'), tag: 'heisman' },
    { side: 'def', weight: 3, say: scheduleSay, tag: 'sched' },
  ];

  // Team-level facts in the opener (H-035): the conference favorite (the app's own poll) and, from the dynasty's
  // fourth season, now and then a line about the dynasty era.
  const open = [S(opening(c)), S(favoriteSay(c)), S(eraSay(c)), S(donorSay(c)), S(nilSay(c))].filter(Boolean).join(' ');
  // An opening that counts starters says it once.
  if (open && /starters? on offense/.test(open)) c.said.add('retOff');
  if (open && /returns? \w+ starters?(?! on)/.test(open)) { c.said.add('retOff'); c.said.add('retDef'); }
  const vOff = verdict(c, 'off');
  const offense = build(c, [open], offItems, OFF_BUDGET, vOff && S(vOff.text), vOff);
  const defBudget = WALSH_LIMIT - offense.length;
  const vDef = verdict(c, 'def');
  if (vDef?.ret) c.said.add('verdictRetDef');
  const close = vDef && S(vDef.text);
  let defense = build(c, [S(defOpenSay(c))], defItems, defBudget - 2, close, vDef);
  // A defense with nothing that stands out (no star numbers, no strong traits) still gets its best player named.
  if (defense.length < 110) {
    const p = f.defStar;
    if (p && !n.isSeen(p)) {
      const line = pick(r, [`${n.ref(p)} leads the defense.`, `The defense counts on ${n.ref(p)}.`]);
      const at = close && defense.endsWith(close) ? defense.length - close.length : defense.length;
      const next = `${defense.slice(0, at).trimEnd()} ${line} ${defense.slice(at)}`.replace(/\s+/g, ' ').trim();
      if (offense.length + next.length <= WALSH_LIMIT) defense = next;
    }
  }
  // Never over the game's limit (a long name can push a sentence past it).
  while (offense.length + defense.length > WALSH_LIMIT && defense.includes('. ')) defense = defense.slice(0, defense.lastIndexOf('. ') + 1);
  return { offense: walshText(offense), defense: walshText(defense) };
}

/** Every team's generated report for a season (from the second season; null for the first). */
export function walshReports(d: Dynasty, season: DSeason, variants: Record<number, number> = {}): Report[] | null {
  const L = walshLeague(d, season);
  if (!L) return null;
  return d.teams.map((_, t) => walshReport(L, t, variants[t] ?? 0));
}

export { returningStarters };
