// The Rosters section (user, 2026-11-19; approved mockups "Rosters section mockups"): every team of the 2026 and 1994
// editions, the original game and the historic teams, as cards (a grid, then each team's full card) or as one table of
// every player. The rosters follow the latest test ROMs for now (`npm run site:rosters`).
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Button, Check, Combobox, Field, LinkSwitch, Select, Table } from '../../ui';
import { RosterCard, TeamLogo, ratingLabel } from './Card';
import { cardTitle, EDITIONS, editionInfo, pageData, parseRosterPath, rostersHref, shortName, type RosterPageData } from './pages';
import type { EditionData, RatingKey, RosterPlayer, TeamRoster, TeamSummary } from './types';
import { rosterRoute } from '../routes';

/** The page for a /rosters address: its built data, or (dev server) fetched. */
export function RostersPage({ path: firstPath, data }: { path: string; data: RosterPageData | null }) {
  const [d, setD] = useState(data);
  const [path, setPath] = useState(firstPath);
  const at = parseRosterPath(path);
  // Previous / next between team pages without loading a new page, so the scroll position stays (user, 2026-11-19:
  // "it's annoying it jumps back up to the top every time you visit next/prev"). The edition's file is fetched once.
  const sets = useRef(new Map<string, Promise<EditionData>>());
  const show = async (to: string) => {
    const at2 = parseRosterPath(to);
    if (!at2) return false;
    if (!sets.current.has(at2.edition)) sets.current.set(at2.edition, fetch(`/data/rosters/${at2.edition}.json`).then((r) => r.json()));
    const next = pageData(to, await sets.current.get(at2.edition)!);
    if (!next) return false;
    setD(next);
    setPath(to);
    const r = rosterRoute(to, next);
    if (r) document.title = r.title;
    return true;
  };
  const nav = async (href: string) => {
    const u = new URL(href, window.location.href);
    if (await show(u.pathname)) window.history.pushState(null, '', u.pathname + u.search);
    else window.location.href = href;
  };
  useEffect(() => {
    const back = () => { void show(window.location.pathname).then((ok) => { if (!ok) window.location.reload(); }); };
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (d || !at) return;
    fetch(`/data/rosters/${at.edition}.json`).then((r) => r.json()).then((set: EditionData) => setD(pageData(path, set)));
  }, [d, path]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <div className="rosters"><p className="rosters-wait">Loading the rosters…</p></div>;
  return <Rosters d={d} nav={nav} />;
}

function Rosters({ d, nav }: { d: RosterPageData; nav: (href: string) => void }) {
  const ed = editionInfo(d.edition);
  const go = (id: string) => { window.location.href = rostersHref(d.edition, id); };
  return (
    <div className="rosters">
      <div className="rosters-head">
        <h1 className="home-h2">Rosters</h1>
        <p>
          Every team in the game, as its Team Rosters screen shows it. Pick an edition, then browse the cards or search every player in the table.
        </p>
        <div className="rosters-controls">
          <LinkSwitch label="Edition" items={EDITIONS.map((e) => ({ label: e.label, href: rostersHref(e.id, d.kind === 'table' ? 'table' : undefined), current: e.id === d.edition }))} />
          <LinkSwitch label="View" items={[
            { label: 'Cards', href: rostersHref(d.edition), current: d.kind !== 'table' },
            { label: 'Table', href: rostersHref(d.edition, 'table'), current: d.kind === 'table' },
          ]} />
          <div className="rosters-pick">
            <Combobox
              label="Go to a team" placeholder="Type a school" onPick={go}
              options={d.teams.map((t) => ({ value: t.id, label: t.school, sub: [t.nickname, t.city].filter(Boolean).join(', ') }))}
            />
          </div>
        </div>
      </div>
      {d.kind === 'cards' && <Grid d={d} />}
      {d.kind === 'team' && d.team && <TeamPage d={d} nav={nav} />}
      {d.kind === 'table' && <PlayerTable d={d} />}
    </div>
  );
}

/** Previous and next team in the edition (A-Z, around the end; user, 2026-11-19), and the way back to the grid. */
/** Previous / next team (A-Z, wrapping), among the teams the filter keeps (the team shown may be outside it). */
function TeamSteps({ d, label, keep = () => true, query = '', nav }: { d: RosterPageData; label: string; keep?: (t: { conf: string }) => boolean; query?: string; nav?: (href: string) => void }) {
  const n = d.teams.length;
  const i = d.teams.findIndex((t) => t.id === d.team!.id);
  const step = (dir: 1 | -1) => {
    for (let k = 1; k < n; k++) { const t = d.teams[(i + dir * k + n * k) % n]; if (keep(t)) return t; }
    return null;
  };
  const prev = step(-1), next = step(1);
  const ed = editionInfo(d.edition);
  return (
    <nav className="rosters-steps" aria-label={label} onClick={(e) => {
      // previous / next in place (a plain link still works: new tab, no script)
      const a = (e.target as Element).closest('a.ui-button') as HTMLAnchorElement | null;
      if (!a || !nav || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      nav(a.href);
    }}>
      {prev ? <Button variant="quiet" href={rostersHref(d.edition, prev.id) + query} label={`Previous team: ${prev.school}`}>← {prev.school}</Button> : <span />}
      <a className="rosters-all" href={rostersHref(d.edition) + query}>All {ed.id === 'historic' ? 'historic' : ed.label} teams</a>
      {next ? <Button variant="quiet" href={rostersHref(d.edition, next.id) + query} label={`Next team: ${next.school}`}>{next.school} →</Button> : <span />}
    </nav>
  );
}

/** A team page: the conference filters (for previous / next), the steps, the card. */
function TeamPage({ d, nav }: { d: RosterPageData; nav: (href: string) => void }) {
  const f = useConfFilter(d, () => {});
  const hasFilters = POWER[d.edition] || d.teams.some((t) => t.conf);
  return (
    <div className="rosters-team">
      {hasFilters && <div className="rosters-filters rosters-grid-filters">{f.controls}</div>}
      <TeamSteps d={d} label="Teams" keep={f.keep} query={f.query} nav={nav} />
      <RosterCard team={d.team!} edition={d.edition} sheet={d.sheet} />
      <TeamSteps d={d} label="Teams, after the card" keep={f.keep} query={f.query} nav={nav} />
      <p className="rosters-source">{source(d)}</p>
    </div>
  );
}

const source = (d: RosterPageData) =>
  d.edition === 'original'
    ? "From the original Bill Walsh College Football '95. Ratings are the game's 16 steps, shown 0 to 100; the original rosters have no names."
    : `From Elevated ${d.build}. Ratings are the 0-99 numbers Team Rosters shows.`;

/** The conference filters both views share: a conference, and power / non-power (user, 2026-11-19: the cards too). */
function useConfFilter(d: RosterPageData, onChange: () => void, extra: string | null = '') {
  const [conf, setConf] = useState('');
  const [power, setPower] = useState(true);
  const [nonPower, setNonPower] = useState(true);
  // Kept in the address (?conf=SEC&show=power), so the team pages' previous / next and the links between the grid and
  // the team pages keep the filter (user, 2026-11-19: the filters on the team page too). Read after the first render,
  // so the built page and the browser's first render match.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const c = q.get('conf') ?? '', show = q.get('show');
    if (c && d.teams.some((t) => t.conf === c)) setConf(c);
    if (show === 'power' || show === 'nonpower' || show === 'none') { setPower(show === 'power'); setNonPower(show === 'nonpower'); }
  }, [d.teams]);
  const query = (() => {
    const q = new URLSearchParams();
    if (conf) q.set('conf', conf);
    if (!power || !nonPower) q.set('show', power ? 'power' : nonPower ? 'nonpower' : 'none');
    const s = q.toString();
    return s ? `?${s}` : '';
  })();
  // Not on the first render: the address is read first (here and by the table), then written as the state changes.
  const loaded = useRef(false);
  useEffect(() => {
    if (!loaded.current) { loaded.current = true; return; }
    if (extra === null) return;
    const all = [query.slice(1), extra].filter(Boolean).join('&');
    const url = window.location.pathname + (all ? `?${all}` : '') + window.location.hash;
    if (url !== window.location.pathname + window.location.search + window.location.hash) window.history.replaceState(window.history.state, '', url);
  }, [query, extra]);
  const confs = useMemo(() => [...new Set(d.teams.map((t) => t.conf).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b)), [d.teams]);
  const pc = POWER[d.edition];
  const keep = (t: { conf: string }) => (!conf || t.conf === conf) && (!pc || (pc.includes(t.conf ?? '') ? power : nonPower));
  const controls = (
    <>
      {confs.length > 0 && (
        <Select label="Conference" value={conf} options={[{ value: '', label: 'All conferences' }, ...confs.map((c) => ({ value: c, label: c }))]}
          onChange={(v) => { setConf(String(v)); onChange(); }} />
      )}
      {pc && (
        <fieldset className="rosters-power">
          <legend>Show teams in</legend>
          <Check checked={power} onChange={(v) => { setPower(v); onChange(); }}>Power conf.</Check>
          <Check checked={nonPower} onChange={(v) => { setNonPower(v); onChange(); }}>Non-power conf.</Check>
        </fieldset>
      )}
    </>
  );
  return { keep, controls, query, deps: [conf, power, nonPower] as const };
}

function Grid({ d }: { d: RosterPageData }) {
  const f = useConfFilter(d, () => {});
  const teams = d.teams.filter(f.keep);
  const hasFilters = POWER[d.edition] || d.teams.some((t) => t.conf);
  return (
    <>
    {hasFilters && <div className="rosters-filters rosters-grid-filters">{f.controls}</div>}
    {teams.length === 0 && <p className="rosters-wait">No teams match.</p>}
    <ul className="rosters-grid">
      {teams.map((t) => (
        <li key={t.id}>
          <a className="rosters-tile" data-brand="dynasty" href={rostersHref(d.edition, t.id) + f.query} style={{ '--team': t.color, '--stripe': t.stripe } as CSSProperties}>
            <span className="rosters-tile-body">
              <span className="rosters-tile-title">{cardTitle(t, d.edition)}</span>
              <span className="rosters-tile-nick">{t.nickname}</span>
              <span className="rosters-tile-meta">
                <span>OFF <b>{t.off}</b></span><span>DEF <b>{t.def}</b></span>{t.conf && <span>{t.conf}</span>}
              </span>
            </span>
            <TeamLogo team={t} edition={d.edition} sheet={d.sheet} />
            <span className="rosters-tile-stripe" aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
    </>
  );
}

/** The table's position checkboxes (user, 2026-11-19: "a more advanced positions filter ... an array of checkboxes with
 * select none/all"): each roster label goes to one position, the depth number and side dropped. */
const POSITIONS: { id: string; side: 'Offense' | 'Defense' | 'Kicking' }[] = [
  { id: 'QB', side: 'Offense' }, { id: 'HB', side: 'Offense' }, { id: 'FB', side: 'Offense' }, { id: 'WR', side: 'Offense' }, { id: 'TE', side: 'Offense' },
  { id: 'OL', side: 'Offense' },
  { id: 'DE', side: 'Defense' }, { id: 'DT', side: 'Defense' }, { id: 'OLB', side: 'Defense' }, { id: 'MLB', side: 'Defense' }, { id: 'CB', side: 'Defense' }, { id: 'S', side: 'Defense' },
  { id: 'K', side: 'Kicking' }, { id: 'P', side: 'Kicking' },
];
const ALL_POSITIONS = POSITIONS.map((p) => p.id);
function positionOf(label: string): string {
  if (/^HB/.test(label)) return 'HB';
  if (/^(SE|FL|WR)/.test(label)) return 'WR';
  if (/^TE/.test(label)) return 'TE';
  if (['LT', 'LG', 'C', 'RG', 'RT'].includes(label)) return 'OL';
  if (/DE$/.test(label)) return 'DE';
  if (/^(DT|LDT|RDT|NT)/.test(label)) return 'DT';
  if (/OLB$/.test(label)) return 'OLB';
  if (/^(MLB|LILB|RILB|PLB)/.test(label)) return 'MLB';
  if (/CB/.test(label)) return 'CB';
  if (/^(FS|SS)/.test(label)) return 'S';
  return label;
}
const TABLE_RATINGS: RatingKey[] = ['spd', 'qck', 'int', 'hnd', 'pwr', 'rng', 'acc', 'tck', 'blk'];
type SortKey = 'name' | 'team' | 'pos' | 'no' | 'cls' | 'ovr' | 'wt' | RatingKey;
const PAGE = 100;
const CLASS_ORDER: Record<string, number> = { FR: 0, SO: 1, JR: 2, SR: 3, 'SR+': 4 };

interface Row { t: TeamRoster; p: RosterPlayer }

/**
 * The power conferences, for the table's Power / Non-power filters (user, 2026-11-19: "find the fastest HB in the SEC.
 * Or best QB on a non-P4 team"). 2026: the four the user named. 1994: the seven major conferences of the day, the
 * Bowl Coalition's five (SEC, ACC, Big East, Big Eight, Southwest) plus the Rose Bowl's Big Ten and Pac-10.
 * Independents (Notre Dame too) count as non-power.
 */
const POWER: Partial<Record<string, string[]>> = {
  '2026': ['SEC', 'Big Ten', 'ACC', 'Big 12'],
  '1994': ['SEC', 'Big Ten', 'ACC', 'Big Eight', 'Southwest', 'Pac-10', 'Big East'],
};

/** The hover card of a school name in the table: logo, school, OFF / DEF and the impact players, one row each:
 * position, number, name, OVR, in the game's pick order (ROM lane's suggestion, 2026-11-19). */
function TeamPeek({ t, d, x, y }: { t: TeamRoster; d: RosterPageData; x: number; y: number }) {
  const imp = (t.impact ?? []).map((i) => t.players[i]).filter(Boolean);
  const top = y + 8 + 260 > window.innerHeight ? Math.max(8, y - 300) : y + 8;
  return (
    <div className="rosters-peek" data-brand="dynasty" role="tooltip" style={{ left: Math.min(x, window.innerWidth - 380), top, '--team': t.color, '--stripe': t.stripe } as CSSProperties}>
      <div className="rosters-peek-head">
        <TeamLogo team={t} edition={d.edition} sheet={d.sheet} />
        <div>
          <p className="rosters-peek-school">{t.school}</p>
          <p className="rosters-peek-sub">{t.nickname}{t.conf ? ` • ${t.conf}` : ''}</p>
        </div>
      </div>
      <p className="rosters-peek-ovr">Offense <b>{t.off}</b> Defense <b>{t.def}</b></p>
      {imp.length > 0 && (
        <>
          <p className="rosters-peek-h">Impact players</p>
          <table className="rosters-peek-imp">
            <tbody>
              {imp.map((p) => (
                <tr key={p[0]}>
                  <td>{p[0]}</td><td>#{p[1] ?? '–'}</td><td className="rosters-peek-name">{`${p[2]} ${p[3]}`.trim() || '–'}</td><td><b>{p[5]}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

/** A column's first sort direction: text A-Z, numbers high to low. */
const DEFAULT_DESC = (k: SortKey) => !['name', 'team', 'pos'].includes(k);

function PlayerTable({ d }: { d: RosterPageData }) {
  const [set, setSet] = useState<EditionData | null>(null);
  const [q, setQ] = useState('');
  const [posSet, setPosSet] = useState<Set<string>>(() => new Set(ALL_POSITIONS));
  const [team, setTeam] = useState('');
  const [sort, setSort] = useState<SortKey>('ovr');
  const [desc, setDesc] = useState(true);
  const [page, setPage] = useState(0);
  // Every filter, the sort and the page in the address (user, 2026-11-20: clicking a team and then Back returns to the
  // same list): ?q=&pos=QB,HB&team=&sort=spd&dir=asc&page=2, plus useConfFilter's conf / show. Defaults are left out.
  const [ready, setReady] = useState(false);
  const extra = (() => {
    const u = new URLSearchParams();
    if (q.trim()) u.set('q', q.trim());
    if (posSet.size !== ALL_POSITIONS.length) u.set('pos', ALL_POSITIONS.filter((x) => posSet.has(x)).join(',') || 'none');
    if (team) u.set('team', team);
    if (sort !== 'ovr') u.set('sort', sort);
    if (desc !== DEFAULT_DESC(sort)) u.set('dir', desc ? 'desc' : 'asc');
    if (page) u.set('page', String(page + 1));
    return u.toString();
  })();
  const f = useConfFilter(d, () => { setTeam(''); setPage(0); }, ready ? extra : null);
  useEffect(() => {
    const u = new URLSearchParams(window.location.search);
    const s = u.get('sort') as SortKey | null;
    const sk = s && (['name', 'team', 'pos', 'no', 'cls', 'ovr', 'wt', ...TABLE_RATINGS] as string[]).includes(s) ? s : 'ovr';
    setQ(u.get('q') ?? '');
    const pos = u.get('pos');
    if (pos) setPosSet(new Set(pos === 'none' ? [] : pos.split(',').filter((x) => ALL_POSITIONS.includes(x))));
    if (u.get('team') && d.teams.some((t) => t.id === u.get('team'))) setTeam(u.get('team')!);
    setSort(sk);
    setDesc(u.get('dir') ? u.get('dir') === 'desc' : DEFAULT_DESC(sk));
    setPage(Math.max(0, Number(u.get('page') ?? 1) - 1) || 0);
    setReady(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetch(`/data/rosters/${d.edition}.json`).then((r) => r.json()).then(setSet);
  }, [d.edition]);
  // Back to the table: its rows come after the page has loaded, so the browser can't keep the scroll position; it is
  // saved when leaving and put back once the rows are there.
  const scrollKey = `rosters-scroll:${d.edition}`;
  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    const save = () => { try { sessionStorage.setItem(scrollKey, `${window.location.search}|${window.scrollY}`); } catch { /* private mode */ } };
    window.addEventListener('pagehide', save);
    return () => window.removeEventListener('pagehide', save);
  }, [scrollKey]);
  useEffect(() => {
    if (!set || !ready) return;
    try {
      const [search, y] = (sessionStorage.getItem(scrollKey) ?? '').split('|');
      if (y && search === window.location.search) setTimeout(() => window.scrollTo({ top: Number(y), behavior: 'instant' }), 0);
      sessionStorage.removeItem(scrollKey);
    } catch { /* private mode */ }
  }, [set, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const names = d.edition !== 'original';
  // A school name's hover card (user, 2026-11-20; desktop only): OFF / DEF and the three impact players.
  const [peekAt, setPeekAt] = useState<{ t: TeamRoster; x: number; y: number } | null>(null);
  const peek = (t: TeamRoster, el: HTMLElement) => {
    if (!window.matchMedia('(hover: hover) and (min-width: 1024px)').matches) return;
    const b = el.getBoundingClientRect();
    setPeekAt({ t, x: b.left, y: b.bottom });
  };
  const teamsShown = d.teams.filter(f.keep);
  const rows = useMemo(() => {
    if (!set) return [];
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const out: Row[] = [];
    for (const t of set.teams) {
      if (team && t.id !== team) continue;
      if (!f.keep(t)) continue;
      for (const p of t.players) {
        if (!posSet.has(positionOf(p[0]))) continue;
        const name = `${p[2]} ${p[3]}`.toLowerCase();
        if (words.length && !words.every((w) => name.includes(w))) continue;
        out.push({ t, p });
      }
    }
    const val = (r: Row): string | number => {
      switch (sort) {
        case 'name': return r.p[3] ? `${r.p[3]} ${r.p[2]}` : '~';
        case 'team': return r.t.school;
        case 'pos': return r.p[0];
        case 'no': return r.p[1] ?? -1;
        case 'cls': return CLASS_ORDER[r.p[4]] ?? -1;
        case 'ovr': return r.p[5];
        case 'wt': return r.p[6];
        default: return r.p[7][sort] ?? -1;
      }
    };
    return out.sort((a, b) => {
      const x = val(a), y = val(b);
      const c = typeof x === 'string' ? x.localeCompare(y as string) : x - (y as number);
      return (desc ? -c : c) || a.t.school.localeCompare(b.t.school);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set, q, posSet, team, ...f.deps, sort, desc]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const at = Math.min(page, pages - 1);
  const head = (k: SortKey, label: string, title?: string, left?: boolean) => (
    <th key={k} className={left ? 'ui-left' : undefined} aria-sort={sort === k ? (desc ? 'descending' : 'ascending') : 'none'}>
      <button type="button" className="rosters-sort" title={title} onClick={() => {
        if (sort === k) setDesc(!desc); else { setSort(k); setDesc(DEFAULT_DESC(k)); }
        setPage(0);
      }}>{label}{sort === k ? (desc ? ' ↓' : ' ↑') : ''}</button>
    </th>
  );
  return (
    <div className="rosters-table">
      <div className="rosters-filters">
        {names && <Field label="Name" type="search" value={q} placeholder="Any player" onChange={(v) => { setQ(v); setPage(0); }} />}
        {f.controls}
        <Select label="Team" value={team} options={[{ value: '', label: 'All teams' }, ...teamsShown.map((t) => ({ value: t.id, label: t.school }))]} onChange={(v) => { setTeam(String(v)); setPage(0); }} />
        <fieldset className="rosters-pos">
          <legend>Positions</legend>
          <div className="rosters-pos-all">
            <button type="button" className="rosters-pos-btn" onClick={() => { setPosSet(new Set(ALL_POSITIONS)); setPage(0); }}>All</button>
            <button type="button" className="rosters-pos-btn" onClick={() => { setPosSet(new Set()); setPage(0); }}>None</button>
          </div>
          {(['Offense', 'Defense', 'Kicking'] as const).map((side) => (
            <div className="rosters-pos-side" key={side} role="group" aria-label={side}>
              {POSITIONS.filter((x) => x.side === side).map(({ id }) => (
                <Check key={id} checked={posSet.has(id)} onChange={(v) => {
                  setPosSet((s) => { const n = new Set(s); if (v) n.add(id); else n.delete(id); return n; });
                  setPage(0);
                }}>{id === 'OL' ? 'OLINE' : id}</Check>
              ))}
            </div>
          ))}
        </fieldset>
      </div>
      {!set ? <p className="rosters-wait">Loading the players…</p> : (
        <>
          <Table className="rosters-players">
            <thead>
              <tr>
                {names && head('name', 'Name', undefined, true)}
                {head('team', 'Team', undefined, true)}
                {head('pos', 'Pos', 'Position', true)}
                {head('no', 'No.', 'Jersey number')}
                {names && head('cls', 'Class', undefined, true)}
                {head('ovr', 'OVR', 'Overall at his position')}
                {head('wt', 'WT.', 'Weight in pounds')}
                {TABLE_RATINGS.map((k) => head(k, k === 'pwr' ? 'PWR' : ratingLabel(k, 'QB')[0], ratingLabel(k, 'QB')[1]))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(at * PAGE, at * PAGE + PAGE).map(({ t, p }) => (
                <tr key={`${t.id}-${p[0]}`}>
                  {names && <td className="ui-left rosters-name" title={`${p[2]} ${p[3]}`.trim() || undefined}><span className="rosters-n-short">{shortName(p[2], p[3]) || '–'}</span><span className="rosters-n-full">{`${p[2]} ${p[3]}`.trim() || '–'}</span></td>}
                  <td className="ui-left"><a href={rostersHref(d.edition, t.id)} className="rosters-teamlink" style={{ '--team': t.color } as CSSProperties}
                    onMouseEnter={(e) => peek(t, e.currentTarget)} onMouseLeave={() => setPeekAt(null)} onFocus={(e) => peek(t, e.currentTarget)} onBlur={() => setPeekAt(null)}>{t.school}</a></td>
                  <td className="ui-left">{p[0]}</td>
                  <td>{p[1] ?? ''}</td>
                  {names && <td className="ui-left">{p[4]}</td>}
                  <td>{p[5]}</td>
                  <td>{p[6]}</td>
                  {TABLE_RATINGS.map((k) => <td key={k} className={p[7][k] === undefined ? 'rosters-none' : undefined}>{p[7][k] ?? '–'}</td>)}
                </tr>
              ))}
            </tbody>
          </Table>
          {peekAt && <TeamPeek t={peekAt.t} d={d} x={peekAt.x} y={peekAt.y} />}
          <div className="rosters-pager">
            <Button variant="quiet" disabled={at === 0} onClick={() => setPage(at - 1)}>Previous</Button>
            <span>{rows.length ? `${at * PAGE + 1}-${Math.min(rows.length, at * PAGE + PAGE)} of ${rows.length} players` : 'No players match'}</span>
            <Button variant="quiet" disabled={at >= pages - 1} onClick={() => setPage(at + 1)}>Next</Button>
          </div>
          <p className="rosters-source">{source(d)} A dash: the position doesn't have that rating. PWR is a lineman's power, POWER a ball carrier's: one column here.</p>
        </>
      )}
    </div>
  );
}
