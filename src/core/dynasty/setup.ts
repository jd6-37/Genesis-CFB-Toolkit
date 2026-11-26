// Starting a dynasty in steps (user, 2026-11-20, mockups approved): after the ROM and the dynasty's name, the first
// season's coaches, rosters, conferences and schedule, then one download. The first season is played on a ROM the app
// builds (`Dynasty.seasonOneRom`), so everything set here is in the game from week 1.
import { seasonPrestige } from './prestige';
import type { Dynasty, DSeason } from './model';
import type { DCoach } from './coaches';
import { coachOvr } from './coaches';
import { makeSchedule, readRealSchedule, realScheduleFor, RELEASE_CONF_WEEKS, rivalriesOf, seasonDivisions, type DSchedule } from './schedule';
import { editionOf } from './edition';
import { readWideSeason, wideSeasonProblems } from '../seasonWide';

/** The setup steps after Get started's ROM and Dynasty steps (route #setup/<step>). */
export const SETUP_STEPS = ['coaches', 'rosters', 'conferences', 'schedule', 'download'] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];
/** The steps bar: Get started's two, then these. */
export const SETUP_LABELS = ['ROM', 'Dynasty', 'Coaches', 'Rosters', 'Conferences', 'Schedule', 'Download'];

/** A new dynasty's first season on an app-built ROM, with the ROM's real schedule when it has one. */
export function startSetup(d: Dynasty, rom: Uint8Array): Dynasty {
  const s = d.seasons[0];
  const real = readRealSchedule(rom, d.teams.length);
  return {
    ...d, seasonOneRom: true, setupCoaches: (s.coach ?? []).slice(), setupConf: s.conf.slice(),
    seasons: [{ ...s, ...(real ? { schedule: real } : {}) }, ...d.seasons.slice(1)],
  };
}

/** Why the first season can't be set up any more (null if it can): only before its first import. */
export function setupLock(d: Dynasty): string | null {
  const s = d.seasons[d.seasons.length - 1];
  if (!d.seasonOneRom || d.seasons.length > 1 || d.offseason) return 'This is set up when a dynasty starts.';
  if (s.imports.length) return `The ${s.year} season has started: change this in the offseason, for the next season.`;
  return null;
}

/** The first season changed after its ROM was downloaded: download it again (as a lineup change). */
const changed = (s: DSeason): Partial<DSeason> =>
  s.romDownloaded ? { lineupEdited: true, rosterVersion: s.lineupEdited ? s.rosterVersion ?? 1 : (s.rosterVersion ?? 1) + 1 } : {};

function withSeason(d: Dynasty, f: (s: DSeason) => Partial<DSeason>): Dynasty {
  const s = d.seasons[d.seasons.length - 1];
  return { ...d, seasons: [...d.seasons.slice(0, -1), { ...s, ...f(s), ...changed(s) }] };
}

// ---- coaches (user: "hire/fire/swap with another coach. Creating a coach and assigning him to a team would fire the
// team's coach, sending him to the pool")

/** Seats a coach at a team: its coach (if any) goes to the pool; the coach's old team (if any) has no coach. */
export function setupHire(d: Dynasty, coachId: number, team: number): Dynasty {
  const lock = setupLock(d);
  if (lock) throw new Error(lock);
  const c = d.coaches?.[coachId];
  if (!c || c.status === 'retired') throw new Error('That coach can\'t be hired.');
  if (c.team === team) return d;
  const year = d.seasons[0].year;
  const coaches = d.coaches!.map((x): DCoach => {
    if (x.id === coachId) return { ...x, team, status: 'coach', poolNote: undefined };
    if (x.team === team) return { ...x, team: null, status: 'pool', poolNote: `Fired by ${d.teams[team].school} (${year})` };
    return x;
  });
  return withSeason({ ...d, coaches }, () => ({ coach: seats(coaches, d.teams.length) }));
}

/** Sends a team's coach to the pool; the job stays open until someone is hired (open jobs are filled at the end). */
export function setupFire(d: Dynasty, team: number): Dynasty {
  const lock = setupLock(d);
  if (lock) throw new Error(lock);
  const year = d.seasons[0].year;
  const coaches = d.coaches!.map((x): DCoach => (x.team === team ? { ...x, team: null, status: 'pool', poolNote: `Fired by ${d.teams[team].school} (${year})` } : x));
  return withSeason({ ...d, coaches }, () => ({ coach: seats(coaches, d.teams.length) }));
}

/** Two schools trade head coaches. */
export function setupSwap(d: Dynasty, a: number, b: number): Dynasty {
  const lock = setupLock(d);
  if (lock) throw new Error(lock);
  if (a === b) return d;
  const coaches = d.coaches!.map((x): DCoach => (x.team === a ? { ...x, team: b } : x.team === b ? { ...x, team: a } : x));
  return withSeason({ ...d, coaches }, () => ({ coach: seats(coaches, d.teams.length) }));
}

const seats = (coaches: DCoach[], n: number) => Array.from({ length: n }, (_, t) => coaches.find((c) => c.team === t)?.id ?? null);

/** Schools without a head coach now. */
export const openJobs = (d: Dynasty) => d.teams.map((t) => t.index).filter((t) => !d.coaches?.some((c) => c.team === t));

/** Fills every open job from the pool, best coach first to the school with the best team (end of the step). */
export function fillOpenJobs(d: Dynasty): Dynasty {
  let out = d;
  const s = d.seasons[d.seasons.length - 1];
  const open = openJobs(d).sort((a, b) => (s.prestige?.[b] ?? 0) - (s.prestige?.[a] ?? 0));
  for (const t of open) {
    const best = out.coaches!.filter((c) => c.status === 'pool').sort((x, y) => coachOvr(y.ratings) - coachOvr(x.ratings))[0];
    if (!best) break;
    out = setupHire(out, best.id, t);
  }
  return out;
}

/** The coach changes made in setup: each school whose coach differs from the one it started with. */
export function coachChanges(d: Dynasty, start: (number | null)[]): { team: number; from: number | null; to: number | null }[] {
  const now = d.seasons[0].coach ?? [];
  return now.map((to, team) => ({ team, from: start[team] ?? null, to })).filter((x) => x.from !== x.to);
}

// ---- schedule

/** The real schedule for the season's conferences, or null when a conference's team count changed (or no ROM table). */
export function realScheduleNow(d: Dynasty, rom: Uint8Array): DSchedule | null {
  if (wideSeasonProblems(rom).length) return null;
  return realScheduleFor(rom, readWideSeason(rom).conf, d.seasons[d.seasons.length - 1].conf);
}

/** Sets the first season's schedule: the real one (teams moved by swaps) or a new one from a seed. */
export function setupSchedule(d: Dynasty, rom: Uint8Array, kind: 'real' | 'new', seed = 1): Dynasty {
  const lock = setupLock(d);
  if (lock) throw new Error(lock);
  const s = d.seasons[d.seasons.length - 1];
  if (kind === 'real') {
    const real = realScheduleNow(d, rom);
    if (!real) throw new Error('The real schedule can\'t be used: a conference has another number of teams than in the real season.');
    return withSeason(d, () => ({ schedule: real }));
  }
  const sched = makeSchedule({
    schools: d.teams.map((t) => t.school),
    conf: s.conf,
    confWeeks: s.confWeeks ?? RELEASE_CONF_WEEKS,
    seed,
    weeks: editionOf(d).regWeeks,
    edition: editionOf(d).id,
    rivalries: rivalriesOf(d),
    divisions: seasonDivisions(d, s),
    strength: seasonPrestige(d, s),
    confNames: s.confNames,
  });
  return withSeason(d, () => ({ schedule: sched }));
}
