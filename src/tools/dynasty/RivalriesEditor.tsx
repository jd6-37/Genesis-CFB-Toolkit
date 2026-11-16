// Protected rivalries the dynasty's schedules keep (user, 2026-11-16: user-defined rivalries; "Also let the user define
// a preferred week"). Shown on the offseason's Schedule step. Edits stay on the page until they're saved; saving makes
// the new season's schedule again (schedule.ts setRivalries).
import { Button, Note, Select, SubHead } from '../../ui';
import { useState } from 'react';
import { editionOf } from '../../core/dynasty/edition';
import type { Dynasty } from '../../core/dynasty/model';
import type { Rivalry } from '../../core/dynasty/rivalries';
import { rivalriesCanRemake, rivalriesOf, rivalryIssues, setRivalries } from '../../core/dynasty/schedule';
import { useDyn } from './ui';

const same = (a: Rivalry[], b: Rivalry[]) => a.length === b.length && a.every((r, i) => r.a === b[i].a && r.b === b[i].b && r.week === b[i].week);

export function RivalriesEditor({ commit, busy }: { commit: (d: Dynasty, done?: string) => Promise<void>; busy: boolean }) {
  const { d } = useDyn();
  const saved = rivalriesOf(d);
  const [draft, setDraft] = useState<Rivalry[]>(saved);
  const [error, setError] = useState<string | null>(null);
  const weeks = editionOf(d).regWeeks;
  const season = d.seasons[d.seasons.length - 1];
  const remake = rivalriesCanRemake(d);
  const changed = !same(draft, saved);
  const issues = rivalryIssues(d, draft);
  const schools = d.teams.map((t) => t.school).sort((a, b) => a.localeCompare(b));
  const teamOptions = [{ value: '', label: 'Pick a team' }, ...schools.map((s) => ({ value: s, label: s }))];
  const weekOptions = [
    { value: '', label: 'Any week' },
    ...Array.from({ length: weeks }, (_, w) => ({ value: String(w), label: w === weeks - 1 ? `Week ${w + 1} (last)` : `Week ${w + 1}` })),
  ];
  const set = (i: number, r: Partial<Rivalry>) => {
    setDraft(draft.map((x, k) => (k === i ? { ...x, ...r } : x)));
    setError(null);
  };

  const save = async (list: Rivalry[] | null) => {
    setError(null);
    try {
      const next = setRivalries(d, list);
      setDraft(rivalriesOf(next));
      await commit(next, remake ? `Rivalries saved. The ${season.year} schedule was made again with them.` : 'Rivalries saved. They apply from the next schedule on.');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <section className="dy-rivals">
      <SubHead>Protected rivalries</SubHead>
      <p className="dy-dim">
        Every schedule the app makes includes these games. With a week, the game goes in that week. Saving makes the
        {` ${season.year} `}schedule again{remake ? '; changes you made to it are lost' : ''}.
        {d.rivalries ? '' : ` This is the built-in list for the ${editionOf(d).name}.`}
      </p>
      <ol className="dy-rivals-list">
        {draft.map((r, i) => (
          <li key={i}>
            <Select label={`Rivalry ${i + 1}, first team`} hideLabel compact value={r.a} options={teamOptions} disabled={busy} onChange={(v) => set(i, { a: v })} />
            <span className="dy-dim">vs.</span>
            <Select label={`Rivalry ${i + 1}, second team`} hideLabel compact value={r.b} options={teamOptions} disabled={busy} onChange={(v) => set(i, { b: v })} />
            <Select
              label={`Rivalry ${i + 1}, week`} hideLabel compact value={r.week === undefined ? '' : String(r.week)} options={weekOptions} disabled={busy}
              onChange={(v) => set(i, { week: v === '' ? undefined : Number(v) })}
            />
            <Button variant="quiet" disabled={busy} onClick={() => { setDraft(draft.filter((_, k) => k !== i)); setError(null); }}>Remove</Button>
          </li>
        ))}
      </ol>
      {changed && issues.length > 0 && <Note kind="error">{issues.slice(0, 3).join(' ')}</Note>}
      {error && <Note kind="error">{error}</Note>}
      {changed && issues.length === 0 && <Note>Your changes are not saved yet.</Note>}
      <div className="dy-row">
        <Button variant="quiet" disabled={busy} onClick={() => setDraft([...draft, { a: '', b: '' }])}>Add a rivalry</Button>
        <Button disabled={!changed || issues.length > 0 || busy} onClick={() => save(draft)}>Save rivalries</Button>
        <Button variant="quiet" disabled={!changed || busy} onClick={() => { setDraft(saved); setError(null); }}>Undo changes</Button>
        {d.rivalries && <Button variant="quiet" disabled={busy} onClick={() => save(null)}>Use the built-in list</Button>}
      </div>
    </section>
  );
}
