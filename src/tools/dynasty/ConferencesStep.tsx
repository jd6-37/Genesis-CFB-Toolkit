// The offseason's Conferences step (user, 2026-11-16: "We can edit conferences/conf alignment in dynasty offseason like
// we can in toolkit, right? If not, build that (for 94 and 26)"): the Toolkit's conference editor on the new season's
// conferences (src/core/dynasty/conferences.ts). Edits stay on the page until they're saved; saving a move or new
// conference games makes a new schedule.
import { Button, Modal, Note } from '../../ui';
import { useState } from 'react';
import { alignmentChanged, BOWL_TIES_1994, confChanged, confIssues, confLock, confSetupOf, setConferences, type ConfSetup } from '../../core/dynasty/conferences';
import { editionOf } from '../../core/dynasty/edition';
import { INDEPENDENT } from '../../core/seasonWide';
import { SeasonWide } from '../season/SeasonWide';
import type { Dynasty } from '../../core/dynasty/model';
import { href, useDyn } from './ui';

export function ConferencesStep({ commit, busy, setup, warnReal }: {
  commit: (d: Dynasty, done?: string) => Promise<void>; busy: boolean;
  /** In setup (SetupPage): no Next link; the first season's wording. */
  setup?: boolean;
  /** Whether these conferences end the season's real schedule (setup: warn before saving). */
  warnReal?: (next: ConfSetup) => boolean;
}) {
  const { d } = useDyn();
  const season = d.seasons[d.seasons.length - 1];
  const ed = editionOf(d);
  const saved = confSetupOf(d, season);
  const [draft, setDraft] = useState<ConfSetup>(saved);
  const [error, setError] = useState<string | null>(null);
  const [sure, setSure] = useState(false);
  const loses = !!warnReal && warnReal(draft);
  const lock = confLock(d);
  const changed = confChanged(draft, saved);
  const remake = !!season.schedule && alignmentChanged(draft, saved);
  const ok = changed && !lock && confIssues(d, draft).length === 0;
  const prev = d.seasons[d.seasons.length - 2];
  // The editor marks what differs from last season (moved teams in yellow, changed conferences outlined).
  const loaded = prev ? confSetupOf(d, prev) : saved;

  const save = async () => {
    // Setup (user, 2026-11-20): a change in a conference's number of teams is warned about before the real schedule goes.
    if (loses && !sure) { setSure(true); return; }
    setSure(false);
    setError(null);
    try {
      const next = setConferences(d, draft);
      await commit(next, remake && !(season.schedule?.real && !loses) ? `The ${season.year} conferences are saved, with a new schedule.` : `The ${season.year} conferences are saved.`);
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
      {!setup && <p>
        The {season.year} conferences. Underlined teams are in a different conference than in {prev?.year ?? 'the last season'}.
        The app makes the {season.year} schedule from these conferences, and the {season.year} ROM carries them, so the
        game's standings{ed.id === '1994' ? ', title games and bowls' : ', title games and playoff'} follow them.
      </p>}
      {lock && <Note>{lock}</Note>}
      <div className="dy-confedit">
      <SeasonWide
        teams={d.teams.map((t) => t.school)} season={draft} loaded={loaded} onChange={(s) => { setDraft(s as ConfSetup); setError(null); }}
        edition={ed.id} rules={ed.confRules} tag={tag} hint={hint} disabled={!!lock || busy}
        footer={setup ? <>Conference games and weeks are how the app makes a new schedule. The real schedule keeps its own; changing them needs a new schedule.</> : <>Conference games and weeks are how the app makes the schedule: each conference's games start in that week. Every season gets a new schedule; last season's never carries over. Moving a team or changing a conference's games makes the {season.year} schedule again when you save, so changes you made to it on the Schedule step are lost. A new name or title game keeps it. Earlier seasons keep their conferences.</>}
      />
      </div>
      {error && <Note kind="error">{error}</Note>}
      {changed && !lock && loses && <Note kind="error">With these conferences a conference has another number of teams than in the real {season.year} season, so the season can't use the real schedule: saving makes a new one. To keep the real schedule, move teams in pairs (each to the other's conference).</Note>}
      {changed && !lock && !loses && <Note>{remake && !season.schedule?.real ? `Saving makes the ${season.year} schedule again.` : remake ? 'Teams that traded conferences trade schedules when you save.' : 'Your changes are not saved yet.'}</Note>}
      {sure && (
        <Modal title="Use a new schedule?" onClose={() => setSure(false)} actions={<>
          <Button onClick={() => void save()}>Save and make a new schedule</Button>
          <Button variant="quiet" onClick={() => setSure(false)}>Keep editing</Button>
        </>}>
          <p>A conference would have another number of teams than in the real {season.year} season, so the season can't use the real {season.year} schedule: the app makes a new one.</p>
          <p>To keep the real schedule, move teams in pairs instead: two teams that trade conferences trade schedules.</p>
        </Modal>
      )}
      <div className="dy-row dy-next">
        <Button onClick={save} disabled={!ok || busy}>Save the conferences</Button>
        <Button variant="quiet" onClick={() => { setDraft(saved); setError(null); }} disabled={!changed || busy}>Undo changes</Button>
        {!setup && <Button variant="quiet" href={href('offseason/schedule')}>Next: the schedule</Button>}
      </div>
    </>
  );
}
