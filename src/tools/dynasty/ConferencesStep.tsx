// The offseason's Conferences step (user, 2026-11-16: "We can edit conferences/conf alignment in dynasty offseason like
// we can in toolkit, right? If not, build that (for 94 and 26)"): the Toolkit's conference editor on the new season's
// conferences (src/core/dynasty/conferences.ts). Edits stay on the page until they're saved; saving a move or new
// conference games makes a new schedule.
import { Button, Note } from '../../ui';
import { useState } from 'react';
import { alignmentChanged, BOWL_TIES_1994, confChanged, confIssues, confLock, confSetupOf, setConferences, type ConfSetup } from '../../core/dynasty/conferences';
import { editionOf } from '../../core/dynasty/edition';
import { INDEPENDENT } from '../../core/seasonWide';
import { SeasonWide } from '../season/SeasonWide';
import type { Dynasty } from '../../core/dynasty/model';
import { href, useDyn } from './ui';

export function ConferencesStep({ commit, busy }: { commit: (d: Dynasty, done?: string) => Promise<void>; busy: boolean }) {
  const { d } = useDyn();
  const season = d.seasons[d.seasons.length - 1];
  const ed = editionOf(d);
  const saved = confSetupOf(d, season);
  const [draft, setDraft] = useState<ConfSetup>(saved);
  const [error, setError] = useState<string | null>(null);
  const lock = confLock(d);
  const changed = confChanged(draft, saved);
  const remake = !!season.schedule && alignmentChanged(draft, saved);
  const ok = changed && !lock && confIssues(d, draft).length === 0;
  const prev = d.seasons[d.seasons.length - 2];
  // The editor marks what differs from last season (moved teams in yellow, changed conferences outlined).
  const loaded = prev ? confSetupOf(d, prev) : saved;

  const save = async () => {
    setError(null);
    try {
      const next = setConferences(d, draft);
      await commit(next, remake ? `The ${season.year} conferences are saved, with a new schedule.` : `The ${season.year} conferences are saved.`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const hint = ed.id === '1994' ? (
    <>
      The bowls take each conference's champion by its place in this list, whatever its name: the first goes to the
      Sugar Bowl, the second and sixth to the Rose Bowl, and so on (under each name). Independents play no conference
      games.
    </>
  ) : undefined;
  const tag = ed.id === '1994'
    ? (c: number) => (c < INDEPENDENT ? `Champion: ${BOWL_TIES_1994[c]}` : 'Independents')
    : undefined;

  return (
    <>
      <p>
        The {season.year} conferences. Underlined teams are in a different conference than in {prev?.year ?? 'the last season'}.
        The app makes the {season.year} schedule from these conferences, and the {season.year} ROM carries them, so the
        game's standings{ed.id === '1994' ? ', title games and bowls' : ', title games and playoff'} follow them.
      </p>
      {lock && <Note>{lock}</Note>}
      <div className="dy-confedit">
      <SeasonWide
        teams={d.teams.map((t) => t.school)} season={draft} loaded={loaded} onChange={(s) => { setDraft(s as ConfSetup); setError(null); }}
        rules={ed.confRules} tag={tag} hint={hint} disabled={!!lock || busy}
        footer={<>Conference games and weeks are how the app makes the schedule: each conference's games start in that week. Moving a team or changing a conference's games makes a new schedule when you save; changes you made to the schedule are lost. A new name keeps the schedule. Earlier seasons keep their conferences.</>}
      />
      </div>
      {error && <Note kind="error">{error}</Note>}
      {changed && !lock && <Note>{remake ? 'Saving makes a new schedule.' : 'Your changes are not saved yet.'}</Note>}
      <div className="dy-row dy-next">
        <Button onClick={save} disabled={!ok || busy}>Save the conferences</Button>
        <Button variant="quiet" onClick={() => { setDraft(saved); setError(null); }} disabled={!changed || busy}>Undo changes</Button>
        <Button variant="quiet" href={href('offseason/schedule')}>Next: the schedule</Button>
      </div>
    </>
  );
}
