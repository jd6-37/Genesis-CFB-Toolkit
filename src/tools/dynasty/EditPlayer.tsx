// Roster editing on the player and team pages (edit.ts). Mobile first: one column of fields on phones.

import { useState } from 'react';
import { applyEdits, editLock, newSkin, type PlayerEdit } from '../../core/dynasty/edit';
import { CLASSES, type ClassYear, type DPlayer } from '../../core/dynasty/model';
import { makeRecruit, POSITIONS, recruitTemplates } from '../../core/dynasty/offseason';
import { GROUP_OF_ROLE, RATINGS, roleOfPos, shownOf, stepOf, type Ratings } from '../../core/dynasty/ratings';
import { GROUP_COLUMNS } from '../../core/rosterLayouts';
import { rng } from '../../core/dynasty/model';
import { useDyn } from './ui';

const LABEL: Partial<Record<string, string>> = { Weight: 'Game weight (lb)', Quickness: 'Quickness (K/P: kick distance)' };

export function EditPlayer({ p }: { p: DPlayer }) {
  const { d, commit } = useDyn();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PlayerEdit>({});
  const [error, setError] = useState<string | null>(null);
  const lock = editLock(d);
  if (lock) return null;
  const val = <K extends keyof PlayerEdit>(k: K) => (form[k] !== undefined ? form[k] : (p as unknown as PlayerEdit)[k]);
  const rating = (a: keyof Ratings) => form.ratings?.[a] ?? p.ratings[a];
  const set = (k: keyof PlayerEdit, v: unknown) => setForm({ ...form, [k]: v });
  const setRating = (a: keyof Ratings, v: number) => setForm({ ...form, ratings: { ...form.ratings, [a]: v } });
  const save = async (edit: PlayerEdit) => {
    try {
      setError(null);
      await commit(applyEdits(d, new Map([[p.id, edit]])));
      setOpen(false);
      setForm({});
    } catch (e) {
      setError((e as Error).message);
    }
  };
  // The ratings his position uses, and any others he has (the related group's, for position changes).
  const uses = new Set(GROUP_COLUMNS[GROUP_OF_ROLE[roleOfPos(String(val('pos')))]] ?? []);
  if (!open) return <button type="button" className="dy-button dy-quiet" onClick={() => setOpen(true)}>Edit player</button>;
  const text = (k: 'first' | 'last' | 'hometown' | 'state', label: string) => (
    <label>{label}<input value={String(val(k) ?? '')} onChange={(e) => set(k, e.target.value)} /></label>
  );
  const number = (k: 'jersey' | 'heightIn' | 'weight' | 'pot', label: string) => (
    <label>{label}<input type="number" inputMode="numeric" value={String(val(k) ?? '')} onChange={(e) => set(k, e.target.value === '' ? undefined : Number(e.target.value))} /></label>
  );
  return (
    <form className="dy-edit" onSubmit={(e) => { e.preventDefault(); void save(form); }}>
      <h3 className="dy-sub">Edit {p.first} {p.last}</h3>
      <div className="dy-edit-grid">
        {text('first', 'First name')}
        {text('last', 'Last name')}
        <label>Position
          <select value={String(val('pos'))} onChange={(e) => set('pos', e.target.value)}>{POSITIONS.map((x) => <option key={x}>{x}</option>)}</select>
        </label>
        <label>Class
          <select value={String(val('cls'))} onChange={(e) => set('cls', e.target.value as ClassYear)}>{CLASSES.map((x) => <option key={x}>{x}</option>)}</select>
        </label>
        {number('jersey', 'Number')}
        {number('heightIn', 'Height (in)')}
        {number('weight', 'Weight (lb)')}
        {text('hometown', 'Hometown')}
        {text('state', 'State')}
        {number('pot', 'Potential (OVR)')}
        <label>Team
          <select value={String(val('team') ?? '')} onChange={(e) => set('team', Number(e.target.value))}>
            {d.teams.slice().sort((a, b) => a.school.localeCompare(b.school)).map((t) => <option key={t.index} value={t.index}>{t.school}</option>)}
          </select>
        </label>
      </div>
      <h3 className="dy-sub">Ratings</h3>
      <p className="dy-dim dy-small">As the game shows them (0-100). The game has 16 steps (0, 6, 13 … 86, 93, 100): a number counts as the step it has reached.</p>
      <div className="dy-edit-grid">
        {RATINGS.filter((a) => uses.has(a) || p.ratings[a] !== undefined).map((a) => {
          const v = rating(a);
          const weight = a === 'Weight';
          return (
            <label key={a}>{LABEL[a] ?? a}
              <input type="number" inputMode="decimal" min={weight ? 140 : 0} max={weight ? 380 : 100} value={v === undefined ? '' : String(Math.round(v * 10) / 10)}
                onChange={(e) => setRating(a, Number(e.target.value))} />
              {!weight && v !== undefined && <span className="dy-dim dy-small">In the game: {shownOf(v)} (step {stepOf(v)})</span>}
            </label>
          );
        })}
      </div>
      {error && <p className="dy-note dy-note-error dy-small" role="alert">{error}</p>}
      <div className="dy-row">
        <button type="submit" className="dy-button">Save</button>
        <button type="button" className="dy-button dy-quiet" onClick={() => { setOpen(false); setForm({}); setError(null); }}>Cancel</button>
        <button type="button" className="dy-button dy-danger" onClick={() => void save({ team: null })}>Release him</button>
      </div>
    </form>
  );
}

/** "Add a player" on a team page: a generated walk-on at a position, to edit like any other. */
export function AddPlayer({ team }: { team: number }) {
  const { d, commit, go } = useDyn();
  const [pos, setPos] = useState('QB');
  if (editLock(d)) return null;
  const add = async () => {
    const r = rng((Date.now() ^ team) >>> 0);
    const s = d.seasons[d.seasons.length - 1];
    const p = makeRecruit(d, recruitTemplates(d), r, 0, team, pos, 2, s.year);
    const next = applyEdits(d, new Map(), [{ ...p, cls: 'FR', recruit: undefined, skin: newSkin(p) }]);
    await commit(next);
    go(`player/${next.players[next.players.length - 1].id}`);
  };
  return (
    <div className="dy-row">
      <select aria-label="Position" value={pos} onChange={(e) => setPos(e.target.value)}>{POSITIONS.map((x) => <option key={x}>{x}</option>)}</select>
      <button type="button" className="dy-button dy-quiet" onClick={() => void add()}>Add a player</button>
    </div>
  );
}
