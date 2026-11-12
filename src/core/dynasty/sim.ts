// Simming the offseason for the user's teams (user, 2026-11-12: "sim recruiting (all or by week), sim
// steps …, or sim all offseason"). The computer makes the user teams' choices as it does for every other
// team: it recruits for them (full recruiting), takes the suggested cuts and sets the depth charts.

import type { Dynasty } from './model';
import { applyCuts, confirmDepth, finishOffseason, runSigningDay, startOffseason, type RecruitTemplates } from './offseason';
import { finishRecruiting, openRecruiting, simRecruiting } from './recruiting';

/** The cuts step with the computer's cuts for the user teams too. */
export const simCuts = (d: Dynasty, tpl: RecruitTemplates) => applyCuts(d, {}, tpl);

/**
 * Plays the rest of the offseason, from the end of the season (or any step) to the next season, ready to
 * download. From the departures step it recruits for five weeks (full recruiting); random classes when
 * those were already chosen.
 */
export function simOffseason(d: Dynasty, tpl: RecruitTemplates): Dynasty {
  let x = d.offseason ? d : startOffseason(d);
  for (let guard = 0; guard < 10; guard++) {
    const st = x.offseason!;
    switch (st.step) {
      case 'depth': x = confirmDepth(x); break;
      case 'portal': x = openRecruiting(x, tpl); break;
      case 'recruiting': x = finishRecruiting(simRecruiting(x), tpl); break;
      case 'signing': x = runSigningDay(x, tpl); break;
      case 'cuts': x = simCuts(x, tpl); break;
      case 'ready': return finishOffseason(x);
    }
  }
  throw new Error('The offseason did not finish.');
}
