// Stats (user, 2026-11-26: "separate the Stats section into Player (what we have now) and Team tabs … the player
// stats leaderboards [get] a 'view all' button that shows a data grid of all players, sortable … showcase all of the
// data we have for stats").
//   #stats                        Players: the leader boards, each with View all
//   #stats/players/<cat>[/<q>]    every player of a category, sortable, filterable, paged
//   #stats/teams[/<q>]            every team, from the same player lines added up per team, plus the scores
// What the save has: each team's players' season lines by category (passing, rushing, receiving, kicking, punting,
// defense) and every game's score. Not in it: yards or turnovers allowed, first downs, penalties, time of possession.
import { useMemo, useState } from 'react';
import { Button, Check, Field, Num, PageHead, Segments, Select, Table, Tabs } from '../../ui';
import { INDEPENDENT, leaders, playerLines, playerName, statValue, type PlayerLine, type StatCategory } from '../../core/dynasty/derive';
import { href, playerOf, TeamLink, useDyn } from './ui';

type Val = (s: Record<string, number>) => number | null;
interface Col { key: string; label: string; title: string; val: Val; digits?: number }

const n = (k: string): Val => (s) => s[k] ?? 0;
const ratio = (a: string, b: string, scale = 1): Val => (s) => (s[b] ? (scale * (s[a] ?? 0)) / s[b] : null);
/** The NCAA passer rating (efficiency): (8.4 yds + 330 td + 100 comp − 200 int) / att. */
const rating: Val = (s) => (s.att ? (8.4 * s.yds + 330 * s.td + 100 * s.comp - 200 * s.int) / s.att : null);

const CATS: { cat: StatCategory; label: string; sort: string; base: string; cols: Col[] }[] = [
  { cat: 'passing', label: 'Passing', sort: 'yds', base: 'att', cols: [
    { key: 'comp', label: 'Cmp', title: 'Completions', val: n('comp') },
    { key: 'att', label: 'Att', title: 'Attempts', val: n('att') },
    { key: 'pct', label: 'Pct', title: 'Completion percentage', val: ratio('comp', 'att', 100), digits: 1 },
    { key: 'yds', label: 'Yds', title: 'Passing yards', val: n('yds') },
    { key: 'ypa', label: 'Y/A', title: 'Yards per attempt', val: ratio('yds', 'att'), digits: 1 },
    { key: 'td', label: 'TD', title: 'Touchdowns', val: n('td') },
    { key: 'int', label: 'Int', title: 'Interceptions', val: n('int') },
    { key: 'rate', label: 'Rate', title: 'Passer rating (NCAA)', val: rating, digits: 1 },
  ] },
  { cat: 'rushing', label: 'Rushing', base: 'att', sort: 'yds', cols: [
    { key: 'att', label: 'Att', title: 'Carries', val: n('att') },
    { key: 'yds', label: 'Yds', title: 'Rushing yards', val: n('yds') },
    { key: 'avg', label: 'Avg', title: 'Yards per carry', val: ratio('yds', 'att'), digits: 1 },
    { key: 'long', label: 'Long', title: 'Longest run', val: n('long') },
    { key: 'td', label: 'TD', title: 'Touchdowns', val: n('td') },
    { key: 'fum', label: 'Fum', title: 'Fumbles', val: n('fum') },
  ] },
  { cat: 'receiving', label: 'Receiving', base: 'rec', sort: 'yds', cols: [
    { key: 'rec', label: 'Rec', title: 'Receptions', val: n('rec') },
    { key: 'yds', label: 'Yds', title: 'Receiving yards', val: n('yds') },
    { key: 'avg', label: 'Avg', title: 'Yards per catch', val: ratio('yds', 'rec'), digits: 1 },
    { key: 'long', label: 'Long', title: 'Longest catch', val: n('long') },
    { key: 'td', label: 'TD', title: 'Touchdowns', val: n('td') },
    { key: 'drops', label: 'Drops', title: 'Dropped passes', val: n('drops') },
    { key: 'fum', label: 'Fum', title: 'Fumbles', val: n('fum') },
  ] },
  { cat: 'defense', label: 'Defense', base: 'tkl', sort: 'tkl', cols: [
    { key: 'tkl', label: 'Tkl', title: 'Tackles', val: n('tkl') },
    { key: 'sacks', label: 'Sacks', title: 'Sacks', val: n('sacks') },
    { key: 'int', label: 'Int', title: 'Interceptions', val: n('int') },
  ] },
  { cat: 'kicking', label: 'Kicking', base: 'fga', sort: 'fgm', cols: [
    { key: 'fgm', label: 'FG', title: 'Field goals made', val: n('fgm') },
    { key: 'fga', label: 'FGA', title: 'Field goals tried', val: n('fga') },
    { key: 'pct', label: 'Pct', title: 'Field goal percentage', val: ratio('fgm', 'fga', 100), digits: 1 },
    { key: 'long', label: 'Long', title: 'Longest field goal', val: n('long') },
    { key: 'blocked', label: 'Blk', title: 'Blocked', val: n('blocked') },
    { key: 'xpm', label: 'XP', title: 'Extra points made', val: n('xpm') },
    { key: 'xpa', label: 'XPA', title: 'Extra points tried', val: n('xpa') },
  ] },
  { cat: 'punting', label: 'Punting', base: 'punts', sort: 'yds', cols: [
    { key: 'punts', label: 'Punts', title: 'Punts', val: n('punts') },
    { key: 'yds', label: 'Yds', title: 'Punting yards', val: n('yds') },
    { key: 'avg', label: 'Avg', title: 'Yards per punt', val: ratio('yds', 'punts'), digits: 1 },
    { key: 'long', label: 'Long', title: 'Longest punt', val: n('long') },
    { key: 'in10', label: 'In 10', title: 'Inside the 10', val: n('in10') },
  ] },
];
const catOf = (c: string | undefined) => CATS.find((x) => x.cat === c) ?? CATS[0];

/** The leader boards (as before), each with View all. */
const BOARDS: { title: string; cat: StatCategory; key: string }[] = [
  { title: 'Passing yards', cat: 'passing', key: 'yds' },
  { title: 'Passing touchdowns', cat: 'passing', key: 'td' },
  { title: 'Rushing yards', cat: 'rushing', key: 'yds' },
  { title: 'Rushing touchdowns', cat: 'rushing', key: 'td' },
  { title: 'Receiving yards', cat: 'receiving', key: 'yds' },
  { title: 'Receptions', cat: 'receiving', key: 'rec' },
  { title: 'Tackles', cat: 'defense', key: 'tkl' },
  { title: 'Sacks', cat: 'defense', key: 'sacks' },
  { title: 'Interceptions', cat: 'defense', key: 'int' },
  { title: 'Field goals', cat: 'kicking', key: 'fgm' },
];

type Query = { sort: string; asc: boolean; conf: string; team: string; q: string; per: boolean; page: number };
const readQ = (s: string | undefined, sort: string): Query => {
  const p = new URLSearchParams(s ?? '');
  return { sort: p.get('sort') || sort, asc: p.get('dir') === 'asc', conf: p.get('conf') ?? '', team: p.get('team') ?? '', q: p.get('q') ?? '', per: p.get('per') === '1', page: Math.max(0, Number(p.get('page')) || 0) };
};
const writeQ = (q: Query, sort: string) => {
  const p = new URLSearchParams();
  if (q.sort !== sort) p.set('sort', q.sort);
  if (q.asc) p.set('dir', 'asc');
  if (q.conf) p.set('conf', q.conf);
  if (q.team) p.set('team', q.team);
  if (q.q) p.set('q', q.q);
  if (q.per) p.set('per', '1');
  if (q.page) p.set('page', String(q.page));
  return p.toString();
};
const fmt = (x: number | null, digits = 0) => (x === null ? '' : digits ? x.toFixed(digits) : Math.round(x).toLocaleString('en-US'));
const PAGE = 50;

export function Stats({ arg }: { arg?: string }) {
  const [part, cat, q] = (arg ?? '').split('/');
  const tab = part === 'teams' ? 'teams' : 'players';
  return (
    <section>
      <PageHead title="Stats">{tab === 'teams' ? 'Every team this season: totals added up from its players, and points from its games.' : 'This season so far.'}</PageHead>
      <Tabs label="Stats" value={tab} onChange={(x) => { window.location.hash = x === 'teams' ? 'stats/teams' : 'stats'; }}
        tabs={[{ value: 'players', label: 'Players' }, { value: 'teams', label: 'Teams' }]} />
      {tab === 'teams' ? <TeamStats key={arg} q={cat} /> : part === 'players' ? <AllPlayers key={arg} cat={catOf(cat).cat} q={q} /> : <Boards />}
    </section>
  );
}

function PlayerLink({ l }: { l: PlayerLine }) {
  const { d } = useDyn();
  const p = playerOf(d, l.player);
  return p ? <a href={href(`player/${p.id}`)}>{p.jersey >= 0 && (p.first || p.last) && `#${p.jersey} `}{playerName(p)}</a> : <span className="dy-dim">Unknown player</span>;
}

function Boards() {
  const { d, v } = useDyn();
  const lines = useMemo(() => playerLines(v), [v]);
  if (!v.save) return <p className="dy-dim">No stats yet: import a save from this season.</p>;
  return (
    <div className="dy-boards">
      {BOARDS.map((b) => (
        <Table key={b.title} figures className="dy-board">
          <caption>{b.title}</caption>
          <tbody>
            {leaders(lines, b.cat, b.key, 10).map((l, i) => (
              <tr key={`${l.team}-${l.slot}`}>
                <td className="dy-dim">{i + 1}</td>
                <td className="ui-left"><PlayerLink l={l} /> <span className="dy-dim dy-small">{d.teams[l.team].school}</span></td>
                <td className="dy-strong"><Num value={statValue(l, b.key)} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={3} className="ui-left"><a className="dy-viewall" href={href(`stats/players/${b.cat}/${writeQ({ ...readQ('', ''), sort: b.key }, catOf(b.cat).sort)}`.replace(/\/$/, ''))}>View all</a></td></tr></tfoot>
        </Table>
      ))}
    </div>
  );
}

/** Sortable header cell. */
function Head({ c, q, set, left }: { c: { key: string; label: string; title: string }; q: Query; set: (p: Partial<Query>) => void; left?: boolean }) {
  const on = q.sort === c.key;
  const text = ['name', 'team'].includes(c.key);
  return (
    <th className={left ? 'ui-left' : undefined} aria-sort={on ? (q.asc ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="dy-sort" title={c.title} onClick={() => set({ sort: c.key, asc: on ? !q.asc : text, page: 0 })}>
        {c.label}{on ? (q.asc ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  );
}

function useQuery(base: string, sort: string, given: string | undefined) {
  const [q, setQ] = useState<Query>(() => readQ(given, sort));
  const set = (p: Partial<Query>) => {
    const next = { ...q, ...('page' in p ? {} : { page: 0 }), ...p };
    setQ(next);
    const a = writeQ(next, sort);
    try { window.history.replaceState(null, '', `#${base}${a ? `/${a}` : ''}`); } catch { /* the address only */ }
  };
  return [q, set] as const;
}

function Filters({ q, set, count, noun, team = true, search = false }: { q: Query; set: (p: Partial<Query>) => void; count: number; noun: [string, string]; team?: boolean; search?: boolean }) {
  const { d, v } = useDyn();
  const confs = v.season.confNames.map((name, c) => ({ name: c === INDEPENDENT ? 'Independents' : name, c })).filter(({ c }) => v.season.conf.includes(c));
  return (
    <div className="dy-sfilters">
      <div className="dy-sfilters-main">
        {search && <Field label="Search by name" value={q.q} onChange={(x) => set({ q: x })} placeholder="Name" />}
        {team && <Select label="Team" value={q.team} onChange={(x) => set({ team: String(x) })}
          options={[{ value: '', label: 'All teams' }, ...d.teams.slice().sort((a, b) => a.school.localeCompare(b.school)).map((t) => ({ value: String(t.index), label: t.school }))]} />}
        <Select label="Conference" value={q.conf} onChange={(x) => set({ conf: String(x) })}
          options={[{ value: '', label: 'All conferences' }, ...confs.map(({ name, c }) => ({ value: String(c), label: name }))]} />
      </div>
      <div className="dy-row">
        <Check checked={q.per} onChange={(x) => set({ per: x })}>Per game</Check>
        <p className="dy-small" aria-live="polite"><strong>{count.toLocaleString('en-US')}</strong> {count === 1 ? noun[0] : noun[1]}</p>
      </div>
    </div>
  );
}

function Pages({ q, set, total }: { q: Query; set: (p: Partial<Query>) => void; total: number }) {
  const pages = Math.max(1, Math.ceil(total / PAGE));
  if (pages < 2) return null;
  const page = Math.min(q.page, pages - 1);
  return (
    <nav className="dy-row dy-rpages" aria-label="Pages">
      <Button variant="quiet" disabled={page === 0} onClick={() => { set({ page: page - 1 }); window.scrollTo(0, 0); }}>Previous</Button>
      <span className="dy-small">Page {page + 1} of {pages}</span>
      <Button variant="quiet" disabled={page >= pages - 1} onClick={() => { set({ page: page + 1 }); window.scrollTo(0, 0); }}>Next</Button>
    </nav>
  );
}

/** Columns that a per-game view divides by games played (counts; not averages, percentages or longest). */
const perGame = (k: string) => !['pct', 'ypa', 'rate', 'avg', 'long', 'w', 'l', 'diff'].includes(k);

function AllPlayers({ cat, q: given }: { cat: StatCategory; q?: string }) {
  const { d, v } = useDyn();
  const def = catOf(cat);
  const [q, set] = useQuery(`stats/players/${cat}`, def.sort, given);
  const games = useMemo(() => v.records.map((r) => r.w + r.l), [v]);
  const rows = useMemo(() => {
    const words = q.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const out = playerLines(v).filter((l) => l.cat === cat && def.cols.some((c) => (c.val(l.s as never) ?? 0) > 0)).filter((l) => {
      if (q.team && l.team !== Number(q.team)) return false;
      if (q.conf && v.season.conf[l.team] !== Number(q.conf)) return false;
      if (words.length) { const nm = playerName(playerOf(d, l.player)).toLowerCase(); if (!words.every((w) => nm.includes(w))) return false; }
      return true;
    });
    const col = def.cols.find((c) => c.key === q.sort);
    // An average, percentage or rating ranks the players with at least a quarter of the leader's attempts (carries,
    // catches, kicks …) first: five carries at 17 yards don't lead the country.
    const rate = !!col?.digits;
    const top = Math.max(0, ...out.map((l) => statValue(l, def.base)));
    const qualified = (l: PlayerLine) => !rate || statValue(l, def.base) >= top / 4;
    const val = (l: PlayerLine) => {
      if (q.sort === 'name') return playerName(playerOf(d, l.player)).toLowerCase();
      if (q.sort === 'team') return d.teams[l.team].school;
      const x = col ? col.val(l.s as never) : null;
      return x === null ? null : q.per && col && perGame(col.key) ? x / Math.max(1, games[l.team]) : x;
    };
    return out.sort((a, b) => {
      const qa = qualified(a), qb = qualified(b);
      if (qa !== qb) return qa ? -1 : 1;
      const x = val(a), y = val(b);
      if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
      const c = typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number);
      return q.asc ? c : -c;
    });
  }, [v, d, cat, def, q, games]);
  const rateSort = !!def.cols.find((c) => c.key === q.sort)?.digits;
  if (!v.save) return <p className="dy-dim">No stats yet: import a save from this season.</p>;
  const page = Math.min(q.page, Math.max(0, Math.ceil(rows.length / PAGE) - 1));
  const list = rows.slice(page * PAGE, page * PAGE + PAGE);
  const label = (l: PlayerLine) => v.season.bw?.[l.team]?.[l.slot]?.label ?? playerOf(d, l.player)?.pos ?? '';
  return (
    <>
      <p className="dy-small"><a href={href('stats')}>Leaders</a> › All players</p>
      <Segments label="Category" value={cat} onChange={(x) => { window.location.hash = `stats/players/${x}`; }} options={CATS.map((c) => ({ value: c.cat, label: c.label }))} />
      <Filters q={q} set={set} count={rows.length} noun={['player', 'players']} search />
      <div className="dy-scroll dy-rtable dy-stable">
        <Table figures>
          <thead>
            <tr>
              <th className="dy-dim">#</th>
              <Head c={{ key: 'name', label: 'Player', title: 'Player' }} q={q} set={set} left />
              <th className="ui-left">Pos</th>
              <Head c={{ key: 'team', label: 'Team', title: 'Team' }} q={q} set={set} left />
              {def.cols.map((c) => <Head key={c.key} c={c} q={q} set={set} />)}
            </tr>
          </thead>
          <tbody>
            {list.map((l, i) => (
              <tr key={`${l.team}-${l.slot}`}>
                <td className="dy-dim">{page * PAGE + i + 1}</td>
                <td className="ui-left dy-rname"><PlayerLink l={l} /></td>
                <td className="ui-left">{label(l)}</td>
                <td className="ui-left"><TeamLink team={l.team} rank={false} /></td>
                {def.cols.map((c) => {
                  const x = c.val(l.s as never);
                  const shown = x === null ? null : q.per && perGame(c.key) ? x / Math.max(1, games[l.team]) : x;
                  return <td key={c.key} className={q.sort === c.key ? 'dy-strong' : undefined}>{fmt(shown, q.per && perGame(c.key) ? 1 : c.digits)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      <Pages q={q} set={set} total={rows.length} />
      {rateSort && <p className="dy-small dy-dim">Sorted by an average: players with at least a quarter of the leader's {def.base === 'att' ? 'attempts' : def.base === 'rec' ? 'catches' : def.base === 'fga' ? 'field goal tries' : def.base === 'punts' ? 'punts' : 'tackles'} come first.</p>}
    </>
  );
}

// ---- teams

type TeamRow = { team: number; g: number; s: Record<string, number> };
const TEAM_VIEWS: { id: string; label: string; sort: string; cols: Col[] }[] = [
  { id: 'overview', label: 'Overview', sort: 'ppg', cols: [
    { key: 'w', label: 'W', title: 'Wins', val: n('w') },
    { key: 'l', label: 'L', title: 'Losses', val: n('l') },
    { key: 'ppg', label: 'PPG', title: 'Points per game', val: ratio('pf', 'g'), digits: 1 },
    { key: 'oppg', label: 'Opp PPG', title: 'Points allowed per game', val: ratio('pa', 'g'), digits: 1 },
    { key: 'diff', label: 'Diff', title: 'Point difference per game', val: (s) => (s.g ? (s.pf - s.pa) / s.g : null), digits: 1 },
    { key: 'yds', label: 'Yds', title: 'Total yards (passing + rushing)', val: (s) => s.pyds + s.ryds },
    { key: 'ypg', label: 'Yds/G', title: 'Total yards per game', val: (s) => (s.g ? (s.pyds + s.ryds) / s.g : null), digits: 1 },
    { key: 'ypp', label: 'Y/Play', title: 'Yards per play', val: (s) => (s.patt + s.ratt ? (s.pyds + s.ryds) / (s.patt + s.ratt) : null), digits: 1 },
    { key: 'to', label: 'TO', title: 'Turnovers (interceptions thrown + fumbles)', val: (s) => s.pint + s.rfum + s.cfum },
    { key: 'take', label: 'Int', title: 'Interceptions made', val: n('dint') },
    { key: 'sacks', label: 'Sacks', title: 'Sacks', val: n('sacks') },
  ] },
  { id: 'passing', label: 'Passing', sort: 'pyds', cols: [
    { key: 'pcomp', label: 'Cmp', title: 'Completions', val: n('pcomp') },
    { key: 'patt', label: 'Att', title: 'Attempts', val: n('patt') },
    { key: 'ppct', label: 'Pct', title: 'Completion percentage', val: ratio('pcomp', 'patt', 100), digits: 1 },
    { key: 'pyds', label: 'Yds', title: 'Passing yards', val: n('pyds') },
    { key: 'pypa', label: 'Y/A', title: 'Yards per attempt', val: ratio('pyds', 'patt'), digits: 1 },
    { key: 'ptd', label: 'TD', title: 'Passing touchdowns', val: n('ptd') },
    { key: 'pint', label: 'Int', title: 'Interceptions thrown', val: n('pint') },
    { key: 'prate', label: 'Rate', title: 'Passer rating (NCAA)', val: (s) => (s.patt ? (8.4 * s.pyds + 330 * s.ptd + 100 * s.pcomp - 200 * s.pint) / s.patt : null), digits: 1 },
  ] },
  { id: 'rushing', label: 'Rushing', sort: 'ryds', cols: [
    { key: 'ratt', label: 'Att', title: 'Carries', val: n('ratt') },
    { key: 'ryds', label: 'Yds', title: 'Rushing yards', val: n('ryds') },
    { key: 'ravg', label: 'Avg', title: 'Yards per carry', val: ratio('ryds', 'ratt'), digits: 1 },
    { key: 'rtd', label: 'TD', title: 'Rushing touchdowns', val: n('rtd') },
    { key: 'fum', label: 'Fum', title: 'Fumbles (runs and catches)', val: (s) => s.rfum + s.cfum },
    { key: 'drops', label: 'Drops', title: 'Dropped passes', val: n('drops') },
  ] },
  { id: 'defense', label: 'Defense', sort: 'oppg', cols: [
    { key: 'pa', label: 'PA', title: 'Points allowed', val: n('pa') },
    { key: 'oppg', label: 'Opp PPG', title: 'Points allowed per game', val: ratio('pa', 'g'), digits: 1 },
    { key: 'tkl', label: 'Tkl', title: 'Tackles', val: n('tkl') },
    { key: 'sacks', label: 'Sacks', title: 'Sacks', val: n('sacks') },
    { key: 'dint', label: 'Int', title: 'Interceptions made', val: n('dint') },
  ] },
  { id: 'kicking', label: 'Kicking', sort: 'fgm', cols: [
    { key: 'fgm', label: 'FG', title: 'Field goals made', val: n('fgm') },
    { key: 'fga', label: 'FGA', title: 'Field goals tried', val: n('fga') },
    { key: 'fgpct', label: 'Pct', title: 'Field goal percentage', val: ratio('fgm', 'fga', 100), digits: 1 },
    { key: 'xpm', label: 'XP', title: 'Extra points made', val: n('xpm') },
    { key: 'punts', label: 'Punts', title: 'Punts', val: n('punts') },
    { key: 'pavg', label: 'Avg', title: 'Yards per punt', val: ratio('puyds', 'punts'), digits: 1 },
    { key: 'in10', label: 'In 10', title: 'Punts inside the 10', val: n('in10') },
  ] },
];

export function teamTotals(lines: PlayerLine[], records: { team: number; w: number; l: number; pf: number; pa: number }[]): TeamRow[] {
  const rows: TeamRow[] = records.map((r) => ({ team: r.team, g: r.w + r.l, s: { g: r.w + r.l, w: r.w, l: r.l, pf: r.pf, pa: r.pa } }));
  const add = (t: number, k: string, x: number) => { rows[t].s[k] = (rows[t].s[k] ?? 0) + x; };
  const KEYS: Record<StatCategory, [string, string][]> = {
    passing: [['comp', 'pcomp'], ['att', 'patt'], ['yds', 'pyds'], ['td', 'ptd'], ['int', 'pint']],
    rushing: [['att', 'ratt'], ['yds', 'ryds'], ['td', 'rtd'], ['fum', 'rfum']],
    receiving: [['drops', 'drops'], ['fum', 'cfum']],
    defense: [['tkl', 'tkl'], ['sacks', 'sacks'], ['int', 'dint']],
    kicking: [['fgm', 'fgm'], ['fga', 'fga'], ['xpm', 'xpm']],
    punting: [['punts', 'punts'], ['yds', 'puyds'], ['in10', 'in10']],
  };
  for (const l of lines) for (const [from, to] of KEYS[l.cat]) add(l.team, to, statValue(l, from));
  for (const r of rows) for (const k of ['pcomp', 'patt', 'pyds', 'ptd', 'pint', 'ratt', 'ryds', 'rtd', 'rfum', 'cfum', 'drops', 'tkl', 'sacks', 'dint', 'fgm', 'fga', 'xpm', 'punts', 'puyds', 'in10']) r.s[k] ??= 0;
  return rows;
}

function TeamStats({ q: given }: { q?: string }) {
  const { d, v } = useDyn();
  const [view, rest] = (given ?? '').includes('=') ? ['overview', given] : [given || 'overview', undefined];
  const def = TEAM_VIEWS.find((x) => x.id === view) ?? TEAM_VIEWS[0];
  const [q, set] = useQuery(`stats/teams/${def.id}`, def.sort, rest);
  const rows = useMemo(() => teamTotals(playerLines(v), v.records), [v]);
  const shown = useMemo(() => {
    const col = def.cols.find((c) => c.key === q.sort);
    const val = (r: TeamRow) => {
      if (q.sort === 'team') return d.teams[r.team].school;
      const x = col ? col.val(r.s) : null;
      return x === null ? null : q.per && col && perGame(col.key) && !/pg$|^diff$/.test(col.key) ? x / Math.max(1, r.g) : x;
    };
    return rows.filter((r) => r.g > 0 && (!q.conf || v.season.conf[r.team] === Number(q.conf))).sort((a, b) => {
      const x = val(a), y = val(b);
      if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
      const c = typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number);
      // Fewer is better for points allowed and turnovers: their first click sorts low to high.
      return q.asc ? c : -c;
    });
  }, [rows, def, q, v, d]);
  if (!v.save) return <p className="dy-dim">No stats yet: import a save from this season.</p>;
  const leaders = [
    { title: 'Points per game', key: 'ppg', low: false },
    { title: 'Fewest points allowed', key: 'oppg', low: true },
    { title: 'Total yards per game', key: 'ypg', low: false },
    { title: 'Sacks', key: 'sacks', low: false },
  ];
  const ov = TEAM_VIEWS[0];
  const played = rows.filter((r) => r.g > 0);
  return (
    <>
      <div className="dy-boards dy-boards-4">
        {leaders.map((b) => {
          const c = ov.cols.find((x) => x.key === b.key)!;
          const top = played.slice().sort((a, x) => ((c.val(a.s) ?? 0) - (c.val(x.s) ?? 0)) * (b.low ? 1 : -1)).slice(0, 5);
          return (
            <Table key={b.key} figures className="dy-board">
              <caption>{b.title}</caption>
              <tbody>{top.map((r, i) => <tr key={r.team}><td className="dy-dim">{i + 1}</td><td className="ui-left"><TeamLink team={r.team} /></td><td className="dy-strong">{fmt(c.val(r.s), c.digits)}</td></tr>)}</tbody>
            </Table>
          );
        })}
      </div>
      <Segments label="Team stats" value={def.id} onChange={(x) => { window.location.hash = `stats/teams/${x}`; }} options={TEAM_VIEWS.map((x) => ({ value: x.id, label: x.label }))} />
      <Filters q={q} set={set} count={shown.length} noun={['team', 'teams']} team={false} />
      <div className="dy-scroll dy-rtable dy-stable">
        <Table figures>
          <thead>
            <tr>
              <th className="dy-dim">#</th>
              <Head c={{ key: 'team', label: 'Team', title: 'Team' }} q={q} set={set} left />
              <th>G</th>
              {def.cols.map((c) => <Head key={c.key} c={c} q={q} set={set} />)}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={r.team} className={d.userTeams.includes(r.team) ? 'ui-row-mine' : undefined}>
                <td className="dy-dim">{i + 1}</td>
                <td className="ui-left dy-rname"><TeamLink team={r.team} /></td>
                <td>{r.g}</td>
                {def.cols.map((c) => {
                  const x = c.val(r.s);
                  const per = q.per && perGame(c.key) && !/pg$/.test(c.key);
                  return <td key={c.key} className={q.sort === c.key ? 'dy-strong' : undefined}>{fmt(x === null ? null : per ? x / Math.max(1, r.g) : x, per ? 1 : c.digits)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      <p className="dy-small dy-dim">
        Team totals add up the team's players' lines; points come from its games. The save doesn't keep yards or turnovers a
        defense allowed, first downs or penalties, so they aren't here.
      </p>
    </>
  );
}
