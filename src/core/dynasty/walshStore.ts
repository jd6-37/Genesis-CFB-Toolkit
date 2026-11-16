// A season's Walsh Reports as the dynasty keeps them (user, 2026-11-16: "all teams every offseason. And the user
// should have the chance to edit them"): the generated ones (walshGen.ts) are worked out from the dynasty each time,
// so they follow preseason edits; the season keeps only the wording picked per team ("Write it again" moves its
// variant on) and the reports the user changed by hand, which win over the generated ones. The season ROM carries
// every team's report from the second season on (offseason.ts seasonRom → walshReports.ts writeReports).

import type { DSeason, Dynasty } from './model';
import { walshLeague, walshReport, walshText } from './walshGen';
import { reportProblems, type Report } from '../walshReports';

/** Why the newest season's reports can't be changed (null if they can). */
export function walshLock(d: Dynasty): string | null {
  const s = d.seasons[d.seasons.length - 1];
  if (s.index === 0) return "The first season keeps the ROM's own Walsh Reports. The app writes new ones in the offseason, for the next season.";
  if (s.imports.length) return `The ${s.year} season has started: its Walsh Reports are in the ROM you played. The next offseason writes new ones.`;
  return null;
}

export interface SeasonReport {
  report: Report;
  generated: Report;
  edited: boolean;
}

/** Every team's report for a season (null for the first season). */
export function seasonReports(d: Dynasty, season: DSeason): SeasonReport[] | null {
  const L = walshLeague(d, season);
  if (!L) return null;
  const v = season.walsh?.variants ?? {};
  const e = season.walsh?.edited ?? {};
  return d.teams.map((_, t) => {
    const generated = walshReport(L, t, v[t] ?? 0);
    return { report: e[t] ?? generated, generated, edited: !!e[t] };
  });
}

/** One team's report (cheaper than all of them). */
export function teamReport(d: Dynasty, season: DSeason, team: number): SeasonReport | null {
  const L = walshLeague(d, season);
  if (!L) return null;
  const generated = walshReport(L, team, season.walsh?.variants?.[team] ?? 0);
  const own = season.walsh?.edited?.[team];
  return { report: own ?? generated, generated, edited: !!own };
}

/** The newest season with a change to its Walsh state; a downloaded ROM has to be written again. */
function withWalsh(d: Dynasty, f: (w: NonNullable<DSeason['walsh']>) => NonNullable<DSeason['walsh']>): Dynasty {
  const lock = walshLock(d);
  if (lock) throw new Error(lock);
  const s = d.seasons[d.seasons.length - 1];
  const next: DSeason = {
    ...s,
    walsh: f({ variants: { ...(s.walsh?.variants ?? {}) }, edited: { ...(s.walsh?.edited ?? {}) } }),
    ...(s.romDownloaded ? { lineupEdited: true, rosterVersion: s.lineupEdited ? s.rosterVersion ?? 1 : (s.rosterVersion ?? 1) + 1 } : {}),
  };
  return { ...d, seasons: [...d.seasons.slice(0, -1), next] };
}

/** The user's own report for a team (null: back to the generated one). */
export function setWalshReport(d: Dynasty, team: number, r: Report | null): Dynasty {
  if (r) {
    const clean = { offense: walshText(r.offense), defense: walshText(r.defense) };
    const bad = reportProblems(clean);
    if (bad.length) throw new Error(bad.join(' '));
    return withWalsh(d, (w) => ({ ...w, edited: { ...w.edited, [team]: clean } }));
  }
  return withWalsh(d, (w) => { const edited = { ...w.edited }; delete edited[team]; return { ...w, edited }; });
}

/** Another wording for a team's generated report (an edited report is replaced by it). */
export function rewriteWalshReport(d: Dynasty, team: number): Dynasty {
  return withWalsh(d, (w) => {
    const edited = { ...w.edited };
    delete edited[team];
    return { variants: { ...w.variants, [team]: (w.variants?.[team] ?? 0) + 1 }, edited };
  });
}

/** How many teams have a report the user wrote. */
export const editedCount = (season: DSeason) => Object.keys(season.walsh?.edited ?? {}).length;
