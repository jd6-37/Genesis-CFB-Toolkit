// Coaches (user, 2026-11-16; spec: claude.ai project notes bw95-dynasty-coaches-spec.md). A dynasty starts with
// the real head coaches of its edition's year on their schools, and a pool of coaches without a head coaching job
// (coordinators, recently unemployed head coaches), from the built-in lists (coachData.ts). Each coach has five
// ratings and an OVR, a prestige of 1-5 stars and a career: his real seasons (IRL, from the lists) and the
// dynasty's seasons, which are read from the dynasty itself (who coached which team each season).
import type { Dynasty } from './model';
import { rng } from './model';
import type { CoachData, CoachDataEntry, CoachDataSeason } from './coachData';
import { seasonView } from './derive';
import { canonicalSchool } from './rivalries';

export const COACH_RATINGS = ['passing', 'running', 'defense', 'recruiting', 'development'] as const;
export type CoachRating = (typeof COACH_RATINGS)[number];
export const COACH_RATING_LABELS: Record<CoachRating, string> = {
  passing: 'Passing', running: 'Running', defense: 'Defense', recruiting: 'Recruiting', development: 'Development',
};
/** What each rating helps (the spec's effects; shown on the coach page). */
export const COACH_RATING_HELPS: Record<CoachRating, string> = {
  passing: 'QB, WR and TE development',
  running: 'HB, FB and OL development',
  defense: 'Every defender’s development',
  recruiting: 'Recruiting points',
  development: 'Every player’s development',
};
export type CoachRatings = Record<CoachRating, number>;

/** A real season from the lists (role HC, OC or DC; W-L for head coaches where known). */
export interface CoachSeasonIrl {
  year: number;
  school: string;
  role: string;
  w?: number;
  l?: number;
  t?: number;
  conf?: boolean;
  post?: string;
  /** Wikipedia page the row comes from (after /wiki/). */
  src?: string;
}

export interface DCoach {
  id: number;
  name: string;
  /** Birth year; `bornGuess` when the lists don't have it and the app estimated it. */
  born: number;
  bornGuess?: boolean;
  hometown?: string;
  alma?: string;
  /** Head coach of this team (the ROM's team number); null = not a head coach. */
  team: number | null;
  status: 'coach' | 'pool' | 'retired';
  /** In the pool: his job, if any ("OC at Alabama", "Not coaching"). */
  poolNote?: string;
  ratings: CoachRatings;
  /** 1-5 stars. */
  prestige: number;
  /** The lists' id for a real coach. */
  key?: string;
  wiki?: string;
  tags?: string[];
  /** His real seasons, oldest first. */
  irl: CoachSeasonIrl[];
  /** The user spends his XP (spec: off for every coach unless the user turns it on). */
  manageXp?: boolean;
  /** XP not spent yet (a coach the user manages keeps it until the user spends it). */
  xp?: number;
  /** The season he retired after. */
  retiredYear?: number;
  /** Made by the user in this dynasty. */
  created?: boolean;
}

/** The weights of the OVR: Development and Recruiting count a little more (they help every position). */
const WEIGHT: CoachRatings = { passing: 1, running: 1, defense: 1, recruiting: 1.25, development: 1.25 };
const WSUM = 5.5;
export const coachOvr = (r: CoachRatings) => Math.round(COACH_RATINGS.reduce((a, k) => a + r[k] * WEIGHT[k], 0) / WSUM);

export const coachAge = (c: DCoach, year: number) => year - c.born;

// ---- ratings for real coaches (Claude's method, spec "Ratings for real coaches"; marked as made by the app)

const PASS_TAGS = /air raid|spread|run and shoot|west coast|pro-style|fun and gun/i;
const RUN_TAGS = /wishbone|option|wing t|veer|power run/i;
const DEF_TAGS = /defen[cs]e|3-4|4-3|3-3-5|4-2-5|blitz/i;
const REC_TAGS = /recruit/i;

interface HcRecord { games: number; wins: number; years: number }
interface HcSummary { top: HcRecord; lower: HcRecord; titles: number; confs: number }

/**
 * His head coaching record, split by level: at the edition's own schools (I-A / FBS) and anywhere else (I-AA / FCS,
 * Division II, NAIA, junior colleges; NFL seasons have no W-L in the lists).
 */
function summarize(irl: CoachSeasonIrl[], topSchools: Set<string>): HcSummary {
  const s: HcSummary = { top: { games: 0, wins: 0, years: 0 }, lower: { games: 0, wins: 0, years: 0 }, titles: 0, confs: 0 };
  for (const r of irl) {
    if (r.role !== 'HC' || r.w === undefined || r.l === undefined) continue;
    const top = topSchools.has(canonicalSchool(r.school));
    const rec = top ? s.top : s.lower;
    const t = r.t ?? 0;
    rec.games += r.w + r.l + t;
    rec.wins += r.w + t / 2;
    rec.years++;
    if (top && /national champ/i.test(r.post ?? '')) s.titles++;
    if (r.conf) s.confs += top ? 1 : 0.5;
  }
  return s;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** A seed from a string (so a coach's spread of ratings is the same every time). */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** His target OVR from his head coaching record (a record below I-A / FBS counts for less), or his years as a coordinator. */
function targetOvr(irl: CoachSeasonIrl[], top: Set<string>): number {
  const s = summarize(irl, top);
  // A win share pulled toward .500 by 12 games (a short record says less).
  const pct = (r: HcRecord) => (r.wins + 6) / (r.games + 12);
  if (s.top.years || s.lower.years) {
    const vTop = 60 + (pct(s.top) - 0.5) * 70;
    const vLow = Math.min(74, 57 + (pct(s.lower) - 0.5) * 40);
    const wTop = s.top.games, wLow = s.lower.games * 0.4;
    const base = (vTop * wTop + vLow * wLow) / Math.max(1, wTop + wLow);
    const v = base + 3.5 * s.titles + Math.min(5, s.confs) + Math.min(4, (s.top.years + s.lower.years / 2) / 3);
    return clamp(v, 52, 95);
  }
  const coord = irl.filter((r) => r.role === 'OC' || r.role === 'DC').length;
  return clamp(55 + Math.min(10, coord * 0.8), 52, 68);
}

export function coachRatingsFor(entry: Pick<CoachDataEntry, 'key' | 'tags'>, irl: CoachSeasonIrl[], born: number, year: number, top: Set<string>): CoachRatings {
  const target = targetOvr(irl, top);
  const r = rng(hash(entry.key));
  const dc = irl.filter((x) => x.role === 'DC').length, oc = irl.filter((x) => x.role === 'OC').length;
  const tags = (entry.tags ?? []).join(' ');
  const lean: CoachRatings = { passing: 0, running: 0, defense: 0, recruiting: 0, development: 0 };
  if (dc > oc) lean.defense += 6, lean.passing -= 2, lean.running -= 2;
  if (oc > dc) lean.passing += 3, lean.running += 3, lean.defense -= 4;
  if (PASS_TAGS.test(tags)) lean.passing += 5, lean.running -= 2;
  if (RUN_TAGS.test(tags)) lean.running += 6, lean.passing -= 3;
  if (DEF_TAGS.test(tags)) lean.defense += 5;
  if (REC_TAGS.test(tags)) lean.recruiting += 8;
  const age = year - born;
  if (age >= 65) lean.recruiting -= 3, lean.development += 2;
  if (age <= 42) lean.recruiting += 2;
  const raw = Object.fromEntries(COACH_RATINGS.map((k) => [k, target + lean[k] + Math.round((r() - 0.5) * 8)])) as CoachRatings;
  // Shift all five so the OVR is the target (the leans and spread move the mix, not the level).
  const shift = target - COACH_RATINGS.reduce((a, k) => a + raw[k] * WEIGHT[k], 0) / WSUM;
  return Object.fromEntries(COACH_RATINGS.map((k) => [k, clamp(Math.round(raw[k] + shift), 30, 99)])) as CoachRatings;
}

/** Prestige 1-5 from his OVR and his titles (a national champion is at least 4 stars). */
export function prestigeFor(ovr: number, irl: CoachSeasonIrl[], top: Set<string>): number {
  const s = summarize(irl, top);
  const p = ovr >= 86 ? 5 : ovr >= 78 ? 4 : ovr >= 70 ? 3 : ovr >= 62 ? 2 : 1;
  return Math.max(p, s.titles ? 4 : 1);
}

// ---- the dynasty's coaches

/** The real coaches of the dynasty's edition: head coaches on their teams, everyone else in the pool. */
export function coachesFromData(d: Pick<Dynasty, 'teams' | 'startYear'>, data: CoachData): DCoach[] {
  const bySchool = new Map(d.teams.map((t) => [canonicalSchool(t.school), t.index]));
  const top = new Set(bySchool.keys());
  const irl: CoachSeasonIrl[][] = data.coaches.map(() => []);
  for (const s of data.seasons as CoachDataSeason[]) {
    const [c, year, school, role, w, l, t, conf, post, src] = s;
    // JSON keeps a missing W, L or T as null.
    irl[c].push({ year, school, role, w: w ?? undefined, l: l ?? undefined, t: t ?? undefined, conf: conf === 1 || undefined, post: post || undefined, src: src || undefined });
  }
  for (const list of irl) list.sort((a, b) => a.year - b.year);
  const year = d.startYear;
  const used = new Set<number>();
  const out: DCoach[] = data.coaches.map((e, id) => {
    const r = rng(hash(e.key) ^ 0x5bd1e995);
    // No birth year: from his first season (about 24 then), else about 45-60.
    const first = irl[id][0]?.year;
    // A listed birth year that can't be right (younger than 22 at his first season, or than 25 now) is guessed too.
    const listed = e.born && (!first || first - e.born >= 22) && year - e.born >= 25 ? e.born : undefined;
    const bornGuess = !listed;
    const born = listed ?? (first ? first - 24 - Math.floor(r() * 4) : year - 45 - Math.floor(r() * 15));
    let team: number | null = null;
    if (e.role === 'HC' && e.school !== undefined) {
      const t = bySchool.get(canonicalSchool(e.school));
      if (t !== undefined && !used.has(t)) { team = t; used.add(t); }
    }
    const ratings = coachRatingsFor(e, irl[id], born, year, top);
    const poolNote = team !== null ? undefined
      : e.role === 'OC' || e.role === 'DC' ? `${e.role} at ${e.school}`
      : e.note?.replace(/^last HC: [^;]*;\s*/i, '').replace(/^not coaching$/i, 'Not coaching') || 'Not coaching';
    return {
      id, name: e.name, born, ...(bornGuess ? { bornGuess } : {}), hometown: e.hometown, alma: e.alma,
      team, status: team !== null ? 'coach' : 'pool', ...(poolNote ? { poolNote } : {}),
      ratings, prestige: prestigeFor(coachOvr(ratings), irl[id], top),
      key: e.key, wiki: e.wiki, tags: e.tags, irl: irl[id],
    };
  });
  return out;
}

/**
 * Gives a dynasty its coaches (a new dynasty, or one made before coaches): the real coaches, and each season's
 * head coach per team (the same coach in every season so far: there was no carousel yet). A team the lists have
 * no head coach for gets none (a page shows "No head coach").
 */
export function withCoaches(d: Dynasty, data: CoachData): Dynasty {
  if (d.coaches) return d;
  if (data.year !== d.startYear) throw new Error(`The coaches file is for ${data.year}, the dynasty starts in ${d.startYear}.`);
  const coaches = coachesFromData(d, data);
  const byTeam = d.teams.map((t) => coaches.find((c) => c.team === t.index)?.id ?? null);
  return { ...d, coaches, seasons: d.seasons.map((s) => (s.coach ? s : { ...s, coach: [...byTeam] })) };
}

export const coachOf = (d: Dynasty, team: number): DCoach | undefined => {
  const id = d.coaches?.find((c) => c.team === team)?.id;
  return id === undefined ? undefined : d.coaches![id];
};

/** The head coaches each season, newest last: who coached `team` (null = nobody). */
export const seasonCoach = (d: Dynasty, seasonIndex: number, team: number): number | null => d.seasons[seasonIndex]?.coach?.[team] ?? null;

/** A dynasty season of a head coach (from the dynasty's own results). */
export interface CoachSeasonDyn { year: number; team: number; w: number; l: number; rank: number; champion: boolean; done: boolean }

export function dynastySeasons(d: Dynasty, coach: number): CoachSeasonDyn[] {
  const out: CoachSeasonDyn[] = [];
  for (const s of d.seasons) {
    const team = s.coach?.indexOf(coach) ?? -1;
    if (team < 0) continue;
    const v = seasonView(d, s);
    const r = v.records[team];
    out.push({ year: s.year, team, w: r.w, l: r.l, rank: v.rank[team], champion: v.champion === team, done: v.done });
  }
  return out;
}

/** His record as a head coach: real seasons (W-L known) and the dynasty's. */
export function coachRecord(d: Dynasty, c: DCoach): { w: number; l: number; t: number } {
  let w = 0, l = 0, t = 0;
  for (const r of c.irl) if (r.role === 'HC' && r.w !== undefined && r.l !== undefined) { w += r.w; l += r.l; t += r.t ?? 0; }
  for (const s of dynastySeasons(d, c.id)) { w += s.w; l += s.l; }
  return { w, l, t };
}

/** The average head coach's ratings and each coach's rank among the head coaches (1 = best), per rating. */
export function headCoachField(d: Dynasty) {
  const heads = (d.coaches ?? []).filter((c) => c.team !== null);
  const avg = Object.fromEntries(COACH_RATINGS.map((k) => [k, heads.reduce((a, c) => a + c.ratings[k], 0) / Math.max(1, heads.length)])) as CoachRatings;
  const rank = (c: DCoach, k: CoachRating) => 1 + heads.filter((x) => x.ratings[k] > c.ratings[k]).length;
  const tied = (c: DCoach, k: CoachRating) => heads.filter((x) => x.id !== c.id && x.ratings[k] === c.ratings[k]).length;
  return { heads, avg, rank, tied };
}

export const starsText = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);
