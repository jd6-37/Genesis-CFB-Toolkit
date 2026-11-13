// Roster editing on the player and team pages (edit.ts). Mobile first: one column of fields on phones.

import { Button, Check, Field, Note, Select, SubHead } from '../../ui';
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
    <Field label={label} value={String(val(k) ?? '')} onChange={(x) => set(k, x)} />
  );
  const number = (k: 'jersey' | 'heightIn' | 'weight' | 'pot', label: string) => (
    <Field label={label} type="number" value={String(val(k) ?? '')} onChange={(x) => set(k, x === '' ? undefined : Number(x))} />
  );
  return (
    <form className="dy-edit" onSubmit={(e) => { e.preventDefault(); void save(form); }}>
      <SubHead>Edit {p.first} {p.last}</SubHead>
      <div className="dy-edit-grid">
        {text('first', 'First name')}
        {text('last', 'Last name')}
        <Select label="Position" value={String(val('pos'))} options={POSITIONS.map((x) => ({ value: x, label: x }))} onChange={(x) => set('pos', x)} />
        <Select label="Class" value={String(val('cls'))} options={CLASSES.map((x) => ({ value: x, label: x }))} onChange={(x) => set('cls', x as ClassYear)} />
        {number('jersey', 'Number')}
        {number('heightIn', 'Height (in)')}
        {number('weight', 'Weight (lb)')}
        {text('hometown', 'Hometown')}
        {text('state', 'State')}
        {number('pot', 'Potential (OVR)')}
        <Select
          label="Team" value={String(val('team') ?? '')}
          options={d.teams.slice().sort((a, b) => a.school.localeCompare(b.school)).map((t) => ({ value: t.index, label: t.school }))}
          onChange={(x) => set('team', Number(x))}
        />
      </div>
      <SubHead>Ratings</SubHead>
      <p className="dy-dim dy-small">As the game's Team Rosters shows them. Every point counts in games (the fine-ratings mod); the game shows whole numbers up to 99.</p>
      <div className="dy-edit-grid">
        {RATINGS.filter((a) => uses.has(a) || p.ratings[a] !== undefined).map((a) => {
          const v = rating(a);
          const weight = a === 'Weight';
          return (
            <Field
              key={a} label={LABEL[a] ?? a} type="number" min={weight ? 140 : 0} max={weight ? 380 : 100}
              value={v === undefined ? '' : String(Math.round(v * 10) / 10)} onChange={(x) => setRating(a, Number(x))}
              note={!weight && v !== undefined ? `In the game: ${shownOf(v)}` : undefined}
            />
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
      <Select label="Position" hideLabel value={pos} options={POSITIONS.map((x) => ({ value: x, label: x }))} onChange={setPos} />
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
          <Select label="Skin tone" value={skin} options={SKIN_TONES.map((t, i) => ({ value: i, label: t.label }))} onChange={(x) => setSkin(Number(x))} />
          <Select label="Hair" value={look.hair} options={HAIR_STYLES.map((h) => ({ value: h, label: HAIR_STYLE_LABELS[h] }))} onChange={(x) => pick('hair', x as Required<LookEdit>['hair'])} />
          <Select label="Hair color" value={look.hairColor} options={HAIR_COLOR_LABELS.map((h, i) => ({ value: i, label: h }))} onChange={(x) => pick('hairColor', Number(x))} />
          <Select label="Facial hair" value={look.beard} options={BEARD_STYLES.map((b) => ({ value: b, label: BEARD_LABELS[b] }))} onChange={(x) => pick('beard', x as Required<LookEdit>['beard'])} />
          <Select label="Expression" value={look.mouth} options={MOUTHS.map((m) => ({ value: m, label: MOUTH_LABELS[m] }))} onChange={(x) => pick('mouth', x as Required<LookEdit>['mouth'])} />
          <Check checked={look.eyeBlack} onChange={(v) => pick('eyeBlack', v)}>Eye black</Check>
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
