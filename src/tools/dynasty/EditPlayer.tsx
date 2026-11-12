// Roster editing on the player and team pages (edit.ts). Mobile first: one column of fields on phones.

import { Button, Note, SubHead } from '../../ui';
import { useState } from 'react';
import { applyEdits, editLock, editLook, newSkin, type PlayerEdit } from '../../core/dynasty/edit';
import { BEARD_LABELS, BEARD_STYLES, HAIR_COLOR_LABELS, HAIR_STYLE_LABELS, HAIR_STYLES, lookChoices, MOUTH_LABELS, MOUTHS, type LookEdit } from '../../core/dynasty/headshot';
import { SKIN_TONES } from '../../core/dynasty/appearance';
import { CLASSES, type ClassYear, type DPlayer } from '../../core/dynasty/model';
import { makeRecruit, POSITIONS, recruitTemplates } from '../../core/dynasty/offseason';
import { GROUP_OF_ROLE, RATINGS, roleOfPos, shownOf, type Ratings } from '../../core/dynasty/ratings';
import { GROUP_COLUMNS } from '../../core/rosterLayouts';
import { rng } from '../../core/dynasty/model';
import { Headshot, useDyn } from './ui';

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
  if (!open) return <Button variant="quiet" onClick={() => setOpen(true)}>Edit player</Button>;
  const text = (k: 'first' | 'last' | 'hometown' | 'state', label: string) => (
    <label>{label}<input value={String(val(k) ?? '')} onChange={(e) => set(k, e.target.value)} /></label>
  );
  const number = (k: 'jersey' | 'heightIn' | 'weight' | 'pot', label: string) => (
    <label>{label}<input type="number" inputMode="numeric" value={String(val(k) ?? '')} onChange={(e) => set(k, e.target.value === '' ? undefined : Number(e.target.value))} /></label>
  );
  return (
    <form className="dy-edit" onSubmit={(e) => { e.preventDefault(); void save(form); }}>
      <SubHead>Edit {p.first} {p.last}</SubHead>
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
      <SubHead>Ratings</SubHead>
      <p className="dy-dim dy-small">As the game's Team Rosters shows them. Every point counts in games (the fine-ratings mod); the game shows whole numbers up to 99.</p>
      <div className="dy-edit-grid">
        {RATINGS.filter((a) => uses.has(a) || p.ratings[a] !== undefined).map((a) => {
          const v = rating(a);
          const weight = a === 'Weight';
          return (
            <label key={a}>{LABEL[a] ?? a}
              <input type="number" inputMode="decimal" min={weight ? 140 : 0} max={weight ? 380 : 100} value={v === undefined ? '' : String(Math.round(v * 10) / 10)}
                onChange={(e) => setRating(a, Number(e.target.value))} />
              {!weight && v !== undefined && <span className="dy-dim dy-small">In the game: {shownOf(v)}</span>}
            </label>
          );
        })}
      </div>
      {error && <Note kind="error">{error}</Note>}
      <div className="dy-row">
        <Button type="submit">Save</Button>
        <Button variant="quiet" onClick={() => { setOpen(false); setForm({}); setError(null); }}>Cancel</Button>
        <Button variant="danger" onClick={() => void save({ team: null })}>Release him</Button>
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
      <Button variant="quiet" onClick={() => void add()}>Add a player</Button>
    </div>
  );
}

/**
 * The portrait's look (user, 2026-11-12: editable any time; nothing of it goes into the ROM). The preview is
 * the same live drawing as the page's headshot, so saving just stores the choices.
 */
export function EditLook({ p }: { p: DPlayer }) {
  const { d, commit } = useDyn();
  const [open, setOpen] = useState(false);
  const [skin, setSkin] = useState(p.skin);
  const [look, setLook] = useState<Required<LookEdit>>(() => lookChoices(p));
  const [error, setError] = useState<string | null>(null);
  if (!open) {
    return <Button variant="quiet" onClick={() => { setSkin(p.skin); setLook(lookChoices(p)); setOpen(true); }}>Edit appearance</Button>;
  }
  const draft: DPlayer = { ...p, skin, look };
  const save = async (change: Parameters<typeof editLook>[2]) => {
    try {
      setError(null);
      await commit(editLook(d, p.id, change));
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const pick = <K extends keyof LookEdit>(k: K, v: Required<LookEdit>[K]) => setLook({ ...look, [k]: v });
  return (
    <form className="dy-edit dy-look" onSubmit={(e) => { e.preventDefault(); void save({ skin, look }); }}>
      <SubHead>Appearance</SubHead>
      <p className="dy-dim dy-small">Only the app's portrait: nothing here changes the game.</p>
      <div className="dy-look-body">
        <Headshot p={draft} size={120} />
        <div className="dy-edit-grid">
          <label>Skin tone
            <select value={skin} onChange={(e) => setSkin(Number(e.target.value))}>{SKIN_TONES.map((t, i) => <option key={t.label} value={i}>{t.label}</option>)}</select>
          </label>
          <label>Hair
            <select value={look.hair} onChange={(e) => pick('hair', e.target.value as Required<LookEdit>['hair'])}>{HAIR_STYLES.map((h) => <option key={h} value={h}>{HAIR_STYLE_LABELS[h]}</option>)}</select>
          </label>
          <label>Hair color
            <select value={look.hairColor} onChange={(e) => pick('hairColor', Number(e.target.value))}>{HAIR_COLOR_LABELS.map((h, i) => <option key={h} value={i}>{h}</option>)}</select>
          </label>
          <label>Facial hair
            <select value={look.beard} onChange={(e) => pick('beard', e.target.value as Required<LookEdit>['beard'])}>{BEARD_STYLES.map((b) => <option key={b} value={b}>{BEARD_LABELS[b]}</option>)}</select>
          </label>
          <label>Expression
            <select value={look.mouth} onChange={(e) => pick('mouth', e.target.value as Required<LookEdit>['mouth'])}>{MOUTHS.map((m) => <option key={m} value={m}>{MOUTH_LABELS[m]}</option>)}</select>
          </label>
          <label className="dy-check"><input type="checkbox" checked={look.eyeBlack} onChange={(e) => pick('eyeBlack', e.target.checked)} /> Eye black</label>
        </div>
      </div>
      {error && <Note kind="error">{error}</Note>}
      <div className="dy-row">
        <Button type="submit">Save</Button>
        <Button variant="quiet" onClick={() => setOpen(false)}>Cancel</Button>
        {p.look && <Button variant="quiet" onClick={() => void save({ look: null })}>Back to his original look</Button>}
      </div>
    </form>
  );
}
