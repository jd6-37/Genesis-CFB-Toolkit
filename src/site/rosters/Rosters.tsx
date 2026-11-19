// The Rosters section (user, 2026-11-19; approved mockups "Rosters section mockups"): every team of the 2026 and 1994
// editions, the original game and the historic teams, as cards (a grid, then each team's full card) or as one table of
// every player. The rosters follow the latest test ROMs for now (`npm run site:rosters`).
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Button, Check, Combobox, Field, LinkSwitch, Select, Table } from '../../ui';
import { RosterCard, TeamLogo, ratingLabel } from './Card';
import { cardTitle, EDITIONS, editionInfo, pageData, parseRosterPath, rostersHref, shortName, type RosterPageData } from './pages';
import type { EditionData, GroupId, RatingKey, RosterPlayer, TeamSummary } from './types';

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
      {d.kind === 'team' && d.team && (
        <div className="rosters-team">
          <TeamSteps d={d} label="Teams" />
          <RosterCard team={d.team} edition={d.edition} sheet={d.sheet} />
          <TeamSteps d={d} label="Teams, after the card" />
          <p className="rosters-source">{source(d)}</p>
        </div>
      )}
      {d.kind === 'table' && <PlayerTable d={d} />}
    </div>
  );
}

/** Previous and next team in the edition (A-Z, around the end; user, 2026-11-19), and the way back to the grid. */
function TeamSteps({ d, label }: { d: RosterPageData; label: string }) {
  const i = d.teams.findIndex((t) => t.id === d.team!.id);
  const prev = d.teams[(i - 1 + d.teams.length) % d.teams.length], next = d.teams[(i + 1) % d.teams.length];
  const ed = editionInfo(d.edition);
  return (
    <nav className="rosters-steps" aria-label={label}>
      <Button variant="quiet" href={rostersHref(d.edition, prev.id)} label={`Previous team: ${prev.school}`}>← {prev.school}</Button>
      <a className="rosters-all" href={rostersHref(d.edition)}>All {ed.id === 'historic' ? 'historic' : ed.label} teams</a>
      <Button variant="quiet" href={rostersHref(d.edition, next.id)} label={`Next team: ${next.school}`}>{next.school} →</Button>
    </nav>
  );
}

const source = (d: RosterPageData) =>
  d.edition === 'original'
    ? "From the original Bill Walsh College Football '95. Ratings are the game's 16 steps, shown 0 to 100; the original rosters have no names."
    : `From Elevated ${d.build}. Ratings are the 0-99 numbers Team Rosters shows.`;

function Grid({ d }: { d: RosterPageData }) {
  return (
    <ul className="rosters-grid">
      {d.teams.map((t) => (
        <li key={t.id}>
          <a className="rosters-tile" data-brand="dynasty" href={rostersHref(d.edition, t.id)} style={{ '--team': t.color, '--stripe': t.stripe } as CSSProperties}>
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
  );
}

const POS: { value: '' | GroupId; label: string }[] = [
  { value: '', label: 'All positions' }, { value: 'QB', label: 'Quarterbacks' }, { value: 'RB', label: 'Running backs' },
  { value: 'REC', label: 'Receivers and tight ends' }, { value: 'OL', label: 'Offensive line' }, { value: 'DL', label: 'Defensive line' },
  { value: 'LB', label: 'Linebackers' }, { value: 'DB', label: 'Defensive backs' }, { value: 'KP', label: 'Kickers and punters' },
];
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
  const [pos, setPos] = useState<'' | GroupId>('');
  const [team, setTeam] = useState('');
  const [conf, setConf] = useState('');
  const [power, setPower] = useState(true);
  const [nonPower, setNonPower] = useState(true);
  const [sort, setSort] = useState<SortKey>('ovr');
  const [desc, setDesc] = useState(true);
  const [page, setPage] = useState(0);
  useEffect(() => {
    fetch(`/data/rosters/${d.edition}.json`).then((r) => r.json()).then(setSet);
  }, [d.edition]);
  const names = d.edition !== 'original';
  const confs = useMemo(() => [...new Set(d.teams.map((t) => t.conf).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b)), [d.teams]);
  const teamsShown = d.teams.filter((t) => {
    if (conf && t.conf !== conf) return false;
    const pc = POWER[d.edition];
    return !pc || (pc.includes(t.conf ?? '') ? power : nonPower);
  });
  const rows = useMemo(() => {
    if (!set) return [];
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const out: Row[] = [];
    const powerConfs = POWER[d.edition];
    for (const t of set.teams) {
      if (team && t.id !== team) continue;
      if (conf && t.conf !== conf) continue;
      if (powerConfs && !(powerConfs.includes(t.conf ?? '') ? power : nonPower)) continue;
      for (const p of t.players) {
        if (pos && p[8] !== pos) continue;
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
  }, [set, d.edition, q, pos, team, conf, power, nonPower, sort, desc]);
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
        <Select label="Position group" value={pos} options={POS} onChange={(v) => { setPos(v as '' | GroupId); setPage(0); }} />
        {confs.length > 0 && (
          <Select label="Conference" value={conf} options={[{ value: '', label: 'All conferences' }, ...confs.map((c) => ({ value: c, label: c }))]}
            onChange={(v) => { setConf(String(v)); setTeam(''); setPage(0); }} />
        )}
        <Select label="Team" value={team} options={[{ value: '', label: 'All teams' }, ...teamsShown.map((t) => ({ value: t.id, label: t.school }))]} onChange={(v) => { setTeam(String(v)); setPage(0); }} />
        {POWER[d.edition] && (
          <fieldset className="rosters-power">
            <legend>Show teams in</legend>
            <Check checked={power} onChange={(v) => { setPower(v); setTeam(''); setPage(0); }}>Power conf.</Check>
            <Check checked={nonPower} onChange={(v) => { setNonPower(v); setTeam(''); setPage(0); }}>Non-power conf.</Check>
          </fieldset>
        )}
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
                  {names && <td className="ui-left rosters-name" title={`${p[2]} ${p[3]}`.trim() || undefined}>{shortName(p[2], p[3]) || '–'}</td>}
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
