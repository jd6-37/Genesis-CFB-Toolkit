// Rosters (user, 2026-11-17): every player of the dynasty in one table, filterable and sortable by everything, with
// backups and headshots switchable and impact players marked. The filters live in the address (#rosters/<query>),
// written with replaceState so typing doesn't add history or scroll the page.
import { useMemo, useState } from 'react';
import { Button, Check, Field, PageHead, Select, Table } from '../../ui';
import type { DPlayer } from '../../core/dynasty/model';
import { impactSet } from '../../core/dynasty/impact';
import { INDEPENDENT } from '../../core/dynasty/derive';
import { spotLabel } from '../../core/dynasty/lineup';
import { shownOf } from '../../core/dynasty/ratings';
import type { Attr } from '../../core/rosterLayouts';
import { Headshot, ImpactDot, href, heightText, useDyn } from './ui';

const RATING_COLS: { key: Attr; label: string }[] = [
  { key: 'Speed', label: 'SPD' },
  { key: 'Quickness', label: 'QCK' },
  { key: 'Awareness', label: 'AWR' },
  { key: 'Hands', label: 'HND' },
  { key: 'Power', label: 'PWR' },
  { key: 'Tackling', label: 'TCK' },
  { key: 'Blocking', label: 'BLK' },
  { key: 'Range', label: 'RNG' },
  { key: 'Accuracy', label: 'ACC' },
];
const POS_GROUPS: { id: string; label: string; pos: string[] }[] = [
  { id: 'QB', label: 'Quarterbacks', pos: ['QB'] },
  { id: 'RB', label: 'Running backs', pos: ['HB', 'FB'] },
  { id: 'WR', label: 'Wide receivers', pos: ['WR'] },
  { id: 'TE', label: 'Tight ends', pos: ['TE'] },
  { id: 'OL', label: 'Offensive line', pos: ['LT', 'LG', 'C', 'RG', 'RT'] },
  { id: 'DL', label: 'Defensive line', pos: ['LE', 'DT', 'RE'] },
  { id: 'LB', label: 'Linebackers', pos: ['LOLB', 'MLB', 'ROLB'] },
  { id: 'DB', label: 'Defensive backs', pos: ['CB', 'FS', 'SS'] },
  { id: 'ST', label: 'Kickers and punters', pos: ['K', 'P'] },
];
const CLASSES = ['FR', 'SO', 'JR', 'SR', 'SR+'];
const PAGE = 100;

type SortKey = 'name' | 'jersey' | 'team' | 'pos' | 'cls' | 'ovr' | 'ht' | 'wt' | Attr;
interface Filters {
  q: string; team: string; conf: string; pos: string; cls: string;
  backups: boolean; impact: boolean; heads: boolean;
  min: Record<string, string>; max: Record<string, string>;
  sort: SortKey; desc: boolean; page: number;
}
const DEFAULTS: Filters = { q: '', team: '', conf: '', pos: '', cls: '', backups: true, impact: false, heads: false, min: {}, max: {}, sort: 'ovr', desc: true, page: 0 };

function fromArg(arg: string | undefined): Filters {
  const f: Filters = { ...DEFAULTS, min: {}, max: {} };
  if (!arg) return f;
  const q = new URLSearchParams(decodeURIComponent(arg));
  f.q = q.get('q') ?? '';
  f.team = q.get('team') ?? '';
  f.conf = q.get('conf') ?? '';
  f.pos = q.get('pos') ?? '';
  f.cls = q.get('cls') ?? '';
  f.backups = q.get('bk') !== '0';
  f.impact = q.get('imp') === '1';
  f.heads = q.get('hs') === '1';
  f.sort = (q.get('s') as SortKey) || 'ovr';
  f.desc = q.get('d') !== '0';
  f.page = Math.max(0, Number(q.get('p') ?? 0) || 0);
  for (const [k, v] of q) {
    if (k.startsWith('min.')) f.min[k.slice(4)] = v;
    if (k.startsWith('max.')) f.max[k.slice(4)] = v;
  }
  return f;
}

function toArg(f: Filters): string {
  const q = new URLSearchParams();
  if (f.q) q.set('q', f.q);
  if (f.team) q.set('team', f.team);
  if (f.conf) q.set('conf', f.conf);
  if (f.pos) q.set('pos', f.pos);
  if (f.cls) q.set('cls', f.cls);
  if (!f.backups) q.set('bk', '0');
  if (f.impact) q.set('imp', '1');
  if (f.heads) q.set('hs', '1');
  if (f.sort !== 'ovr') q.set('s', f.sort);
  if (!f.desc) q.set('d', '0');
  if (f.page) q.set('p', String(f.page));
  for (const [k, v] of Object.entries(f.min)) if (v !== '') q.set(`min.${k}`, v);
  for (const [k, v] of Object.entries(f.max)) if (v !== '') q.set(`max.${k}`, v);
  const s = q.toString();
  return s ? encodeURIComponent(s) : '';
}

/** A rating as the game's Team Rosters shows it (0-99), or undefined when the player has none. */
const rated = (p: DPlayer, k: Attr) => (p.ratings[k] === undefined ? undefined : shownOf(p.ratings[k]!));

interface Row { p: DPlayer; team: number; school: string; conf: number; slot: number; label: string; impact: boolean }

export function Rosters({ arg }: { arg?: string }) {
  const { d, v } = useDyn();
  const [f, setF] = useState<Filters>(() => fromArg(arg));
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<Filters>, keepPage = false) => {
    const next = { ...f, ...patch, ...(keepPage ? {} : { page: 0 }) };
    setF(next);
    const a = toArg(next);
    try { window.history.replaceState(null, '', `#rosters${a ? `/${a}` : ''}`); } catch { /* the address only */ }
  };

  const rows = useMemo<Row[]>(() => {
    const imp = impactSet(d, v.season);
    const slotOf = new Map<number, [number, number]>();
    v.season.slots.forEach((ids, team) => ids.forEach((id, slot) => { if (id) slotOf.set(id, [team, slot]); }));
    return d.players
      .filter((p) => p.status === 'active' && p.team !== null)
      .map((p) => {
        const at = slotOf.get(p.id);
        return {
          p, team: p.team!, school: d.teams[p.team!].school, conf: v.season.conf[p.team!],
          slot: at ? at[1] : -1, label: at ? spotLabel(at[1]) : p.pos, impact: imp.has(p.id),
        };
      });
  }, [d, v.season]);

  const shown = useMemo(() => {
    const words = f.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const group = POS_GROUPS.find((g) => `g.${g.id}` === f.pos);
    const num = (s: string | undefined) => (s === undefined || s === '' || Number.isNaN(Number(s)) ? null : Number(s));
    const ranges = [...new Set([...Object.keys(f.min), ...Object.keys(f.max)])].map((k) => ({ k, lo: num(f.min[k]), hi: num(f.max[k]) })).filter((r) => r.lo !== null || r.hi !== null);
    const value = (r: Row, k: string): number | undefined => (k === 'ovr' ? r.p.ovr : k === 'wt' ? r.p.weight : k === 'ht' ? r.p.heightIn : rated(r.p, k as Attr));
    const out = rows.filter((r) => {
      if (!f.backups && r.slot < 0) return false;
      if (f.impact && !r.impact) return false;
      if (f.team !== '' && r.team !== Number(f.team)) return false;
      if (f.conf !== '' && r.conf !== Number(f.conf)) return false;
      if (f.cls && r.p.cls !== f.cls) return false;
      if (f.pos && (group ? !group.pos.includes(r.p.pos) : r.p.pos !== f.pos)) return false;
      if (words.length) {
        const name = `${r.p.first} ${r.p.last}`.toLowerCase();
        if (!words.every((w) => name.includes(w))) return false;
      }
      for (const { k, lo, hi } of ranges) {
        const x = value(r, k);
        if (x === undefined) return false;
        if (lo !== null && x < lo) return false;
        if (hi !== null && x > hi) return false;
      }
      return true;
    });
    const key = (r: Row): string | number | undefined => {
      switch (f.sort) {
        case 'name': return `${r.p.last} ${r.p.first}`.toLowerCase();
        case 'jersey': return r.p.jersey;
        case 'team': return r.school;
        case 'pos': return r.p.pos;
        case 'cls': return CLASSES.indexOf(r.p.cls);
        case 'ovr': return r.p.ovr;
        case 'ht': return r.p.heightIn;
        case 'wt': return r.p.weight;
        default: return rated(r.p, f.sort);
      }
    };
    const dir = f.desc ? -1 : 1;
    return out.sort((a, b) => {
      const x = key(a), y = key(b);
      if (x === undefined || y === undefined) return x === y ? b.p.ovr - a.p.ovr : x === undefined ? 1 : -1; // blanks last
      const c = typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number);
      return c ? c * dir : b.p.ovr - a.p.ovr;
    });
  }, [rows, f]);

  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const page = Math.min(f.page, pages - 1);
  const list = shown.slice(page * PAGE, page * PAGE + PAGE);
  const confs = v.season.confNames.map((name, c) => ({ name: c === INDEPENDENT ? 'Independents' : name, c })).filter(({ c }) => v.season.conf.includes(c));
  const filtered = f.q || f.team || f.conf || f.pos || f.cls || !f.backups || f.impact || Object.values(f.min).some(Boolean) || Object.values(f.max).some(Boolean);
  const head = (key: SortKey, label: string, title?: string, left = false) => {
    const on = f.sort === key;
    return (
      <th className={left ? 'ui-left' : undefined} aria-sort={on ? (f.desc ? 'descending' : 'ascending') : 'none'}>
        <button type="button" className="dy-sort" title={title} onClick={() => set({ sort: key, desc: on ? !f.desc : !['name', 'team', 'pos'].includes(key) })}>
          {label}{on ? (f.desc ? ' ▼' : ' ▲') : ''}
        </button>
      </th>
    );
  };
  const range = (k: string, label: string) => (
    <div className="dy-range" key={k} role="group" aria-label={label}>
      <span>{label}</span>
      <Field label={`${label} at least`} hideLabel compact digits maxLength={3} placeholder="min" value={f.min[k] ?? ''} onChange={(x) => set({ min: { ...f.min, [k]: x.replace(/\D/g, '') } })} />
      <Field label={`${label} at most`} hideLabel compact digits maxLength={3} placeholder="max" value={f.max[k] ?? ''} onChange={(x) => set({ max: { ...f.max, [k]: x.replace(/\D/g, '') } })} />
    </div>
  );

  return (
    <section>
      <PageHead title="Rosters">Every player in the dynasty this season. Sort by any column; a gold dot marks the impact players.</PageHead>
      <div className="dy-rfilters">
        <div className="dy-rfilters-toggle">
          <Button variant="quiet" onClick={() => setOpen(!open)}>{open ? 'Hide filters' : filtered ? 'Filters (on)' : 'Filters'}</Button>
        </div>
        <div id="dy-rfilters-body" className={`dy-rfilters-body${open ? ' is-open' : ''}`}>
        <div className="dy-rfilters-main">
          <Field label="Search by name" value={f.q} onChange={(x) => set({ q: x })} placeholder="Name" />
          <Select label="Team" value={f.team} onChange={(x) => set({ team: String(x) })}
            options={[{ value: '', label: 'All teams' }, ...d.teams.slice().sort((a, b) => a.school.localeCompare(b.school)).map((t) => ({ value: String(t.index), label: t.school }))]} />
          <Select label="Conference" value={f.conf} onChange={(x) => set({ conf: String(x) })}
            options={[{ value: '', label: 'All conferences' }, ...confs.map(({ name, c }) => ({ value: String(c), label: name }))]} />
          <Select label="Position" value={f.pos} onChange={(x) => set({ pos: String(x) })}
            options={[{ value: '', label: 'All positions' }, ...POS_GROUPS.flatMap((g) => [
              { value: `g.${g.id}`, label: g.label, group: 'Groups' },
            ]), ...POS_GROUPS.flatMap((g) => g.pos).map((p) => ({ value: p, label: p, group: 'Positions' }))]} />
          <Select label="Class" value={f.cls} onChange={(x) => set({ cls: String(x) })}
            options={[{ value: '', label: 'All classes' }, ...CLASSES.map((c) => ({ value: c, label: c }))]} />
        </div>
        <div className="dy-row dy-rfilters-checks">
          <Check checked={f.backups} onChange={(x) => set({ backups: x })}>Backups</Check>
          <Check checked={f.impact} onChange={(x) => set({ impact: x })}>Impact players only</Check>
          <Check checked={f.heads} onChange={(x) => set({ heads: x }, true)}>Headshots</Check>
        </div>
        <details className="dy-rfilters-more" open={Object.values(f.min).some(Boolean) || Object.values(f.max).some(Boolean) || undefined}>
          <summary>Ratings, height and weight</summary>
          <div className="dy-rfilters-ranges">
            {range('ovr', 'OVR')}
            {RATING_COLS.map((c) => range(c.key, c.key))}
            {range('wt', 'Weight')}
          </div>
        </details>
        </div>
        <div className="dy-row">
          <p className="dy-small" aria-live="polite"><strong>{shown.length.toLocaleString('en-US')}</strong> {shown.length === 1 ? 'player' : 'players'}</p>
          {filtered && <Button variant="quiet" onClick={() => set({ ...DEFAULTS, heads: f.heads, sort: f.sort, desc: f.desc, min: {}, max: {} })}>Clear filters</Button>}
        </div>
      </div>

      {list.length ? (
        <div className="dy-scroll dy-rtable">
          <Table>
            <thead>
              <tr>
                {head('name', 'Name', undefined, true)}
                {head('jersey', '#')}
                {head('team', 'Team', undefined, true)}
                {head('pos', 'Pos', undefined, true)}
                {head('cls', 'Class')}
                {head('ovr', 'OVR')}
                {RATING_COLS.map((c) => <th key={c.key} aria-sort={f.sort === c.key ? (f.desc ? 'descending' : 'ascending') : 'none'}>
                  <button type="button" className="dy-sort" title={c.key} onClick={() => set({ sort: c.key, desc: f.sort === c.key ? !f.desc : true })}>
                    <abbr title={c.key}>{c.label}</abbr>{f.sort === c.key ? (f.desc ? ' ▼' : ' ▲') : ''}
                  </button>
                </th>)}
                {head('ht', 'Ht', 'Height')}
                {head('wt', 'Wt', 'Weight')}
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.p.id}>
                  <td className="ui-left dy-rname">
                    <span className="dy-rname-in">
                      {f.heads && <Headshot p={r.p} size={36} />}
                      <a href={href(`player/${r.p.id}`)}>{r.p.first} {r.p.last}</a>
                    </span>
                  </td>
                  <td className="ui-num">{r.p.jersey < 0 ? '' : r.p.jersey}</td>
                  <td className="ui-left"><a href={href(`team/${r.team}`)}>{r.school}</a></td>
                  <td className="ui-left dy-strong">{r.impact && <ImpactDot />}{r.slot >= 0 ? r.label : <span className="dy-dim" title="Backup">{r.p.pos}</span>}</td>
                  <td>{r.p.cls}</td>
                  <td className="ui-num dy-strong">{r.p.ovr}</td>
                  {RATING_COLS.map((c) => <td key={c.key} className="ui-num">{rated(r.p, c.key) ?? ''}</td>)}
                  <td>{heightText(r.p.heightIn)}</td>
                  <td className="ui-num">{r.p.weight || ''}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      ) : (
        <p className="dy-dim">No players match. Loosen a filter or clear them.</p>
      )}

      {pages > 1 && (
        <nav className="dy-row dy-rpages" aria-label="Pages">
          <Button variant="quiet" disabled={page === 0} onClick={() => { set({ page: page - 1 }, true); window.scrollTo(0, 0); }}>Previous</Button>
          <span className="dy-small">Page {page + 1} of {pages}</span>
          <Button variant="quiet" disabled={page >= pages - 1} onClick={() => { set({ page: page + 1 }, true); window.scrollTo(0, 0); }}>Next</Button>
        </nav>
      )}
      <p className="dy-small dy-dim">Backups are shown by their position in gray. Ratings are shown as the game's Team Rosters shows them (0 to 99); a blank means the player's position doesn't use that rating.</p>
    </section>
  );
}
