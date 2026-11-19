// The Rosters section (user, 2026-11-19; approved mockups "Rosters section mockups"): every team of the 2026 and 1994
// editions, the original game and the historic teams, as cards (a grid, then each team's full card) or as one table of
// every player. The rosters follow the latest test ROMs for now (`npm run site:rosters`).
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Button, Check, Combobox, Field, LinkSwitch, Select, Table } from '../../ui';
import { RosterCard, TeamLogo, ratingLabel } from './Card';
import { cardTitle, EDITIONS, editionInfo, pageData, parseRosterPath, rostersHref, shortName, type RosterPageData } from './pages';
import type { EditionData, RatingKey, RosterPlayer, TeamSummary } from './types';

/** The page for a /rosters address: its built data, or (dev server) fetched. */
export function RostersPage({ path, data }: { path: string; data: RosterPageData | null }) {
  const [d, setD] = useState(data);
  const at = parseRosterPath(path);
  useEffect(() => {
    if (d || !at) return;
    fetch(`/data/rosters/${at.edition}.json`).then((r) => r.json()).then((set: EditionData) => setD(pageData(path, set)));
  }, [d, path]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <div className="rosters"><p className="rosters-wait">Loading the rosters…</p></div>;
  return <Rosters d={d} />;
}

function Rosters({ d }: { d: RosterPageData }) {
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
      {d.kind === 'team' && d.team && <TeamPage d={d} />}
      {d.kind === 'table' && <PlayerTable d={d} />}
    </div>
  );
}

/** Previous and next team in the edition (A-Z, around the end; user, 2026-11-19), and the way back to the grid. */
/** Previous / next team (A-Z, wrapping), among the teams the filter keeps (the team shown may be outside it). */
function TeamSteps({ d, label, keep = () => true, query = '' }: { d: RosterPageData; label: string; keep?: (t: { conf: string }) => boolean; query?: string }) {
  const n = d.teams.length;
  const i = d.teams.findIndex((t) => t.id === d.team!.id);
  const step = (dir: 1 | -1) => {
    for (let k = 1; k < n; k++) { const t = d.teams[(i + dir * k + n * k) % n]; if (keep(t)) return t; }
    return null;
  };
  const prev = step(-1), next = step(1);
  const ed = editionInfo(d.edition);
  return (
    <nav className="rosters-steps" aria-label={label}>
      {prev ? <Button variant="quiet" href={rostersHref(d.edition, prev.id) + query} label={`Previous team: ${prev.school}`}>← {prev.school}</Button> : <span />}
      <a className="rosters-all" href={rostersHref(d.edition) + query}>All {ed.id === 'historic' ? 'historic' : ed.label} teams</a>
      {next ? <Button variant="quiet" href={rostersHref(d.edition, next.id) + query} label={`Next team: ${next.school}`}>{next.school} →</Button> : <span />}
    </nav>
  );
}

/** A team page: the conference filters (for previous / next), the steps, the card. */
function TeamPage({ d }: { d: RosterPageData }) {
  const f = useConfFilter(d, () => {});
  const hasFilters = POWER[d.edition] || d.teams.some((t) => t.conf);
  return (
    <div className="rosters-team">
      {hasFilters && <div className="rosters-filters rosters-grid-filters">{f.controls}</div>}
      <TeamSteps d={d} label="Teams" keep={f.keep} query={f.query} />
      <RosterCard team={d.team!} edition={d.edition} sheet={d.sheet} />
      <TeamSteps d={d} label="Teams, after the card" keep={f.keep} query={f.query} />
      <p className="rosters-source">{source(d)}</p>
    </div>
  );
}

const source = (d: RosterPageData) =>
  d.edition === 'original'
    ? "From the original Bill Walsh College Football '95. Ratings are the game's 16 steps, shown 0 to 100; the original rosters have no names."
    : `From Elevated ${d.build}. Ratings are the 0-99 numbers Team Rosters shows.`;

/** The conference filters both views share: a conference, and power / non-power (user, 2026-11-19: the cards too). */
function useConfFilter(d: RosterPageData, onChange: () => void) {
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
  useEffect(() => {
    const url = window.location.pathname + query + window.location.hash;
    if (url !== window.location.pathname + window.location.search + window.location.hash) window.history.replaceState(null, '', url);
  }, [query]);
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

interface Row { t: TeamSummary; p: RosterPlayer }

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

function PlayerTable({ d }: { d: RosterPageData }) {
  const [set, setSet] = useState<EditionData | null>(null);
  const [q, setQ] = useState('');
  const [posSet, setPosSet] = useState<Set<string>>(() => new Set(ALL_POSITIONS));
  const [team, setTeam] = useState('');
  const f = useConfFilter(d, () => { setTeam(''); setPage(0); });
  const [sort, setSort] = useState<SortKey>('ovr');
  const [desc, setDesc] = useState(true);
  const [page, setPage] = useState(0);
  useEffect(() => {
    fetch(`/data/rosters/${d.edition}.json`).then((r) => r.json()).then(setSet);
  }, [d.edition]);
  const names = d.edition !== 'original';
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
        if (sort === k) setDesc(!desc); else { setSort(k); setDesc(!['name', 'team', 'pos'].includes(k)); }
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
                  <td className="ui-left"><a href={rostersHref(d.edition, t.id)} className="rosters-teamlink" style={{ '--team': t.color } as CSSProperties}>{t.school}</a></td>
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
