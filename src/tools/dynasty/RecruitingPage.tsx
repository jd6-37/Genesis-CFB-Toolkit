// Full recruiting: five weeks of points and offers for the user teams' boards, then signing day.
import { Button, Note, SubHead, Table } from '../../ui';
import { useMemo, useState } from 'react';
import type { Dynasty } from '../../core/dynasty/model';
import {
  contenderScores, finishRecruiting, weekContext, interestRanking, planProblems, reach, recruitingWeek,
  scoutCost, scoutLevel, scoutProspect, simRecruiting, PITCHES, type PitchKey, type PitchReaction, type Prospect, type RecruitingState, type ScoutLevel, type TeamPlan,
} from '../../core/dynasty/recruiting';
import { POSITIONS, POS_TARGET, prestigeStars } from '../../core/dynasty/offseason';
import { closeness } from '../../core/dynasty/schoolStates';
import { playerName } from '../../core/dynasty/derive';
import { GROUP_COLUMNS, type Attr } from '../../core/rosterLayouts';
import { rulesOf } from '../../core/dynasty/rules';
import { academicGrade, gradeOf } from '../../core/dynasty/academics';
import { pipelineStates } from '../../core/dynasty/recruiting';
import { SCHOOL_STATE, stateCode } from '../../core/dynasty/schoolStates';
import { GROUP_OF_ROLE, roleOfPos, shownOf } from '../../core/dynasty/ratings';
import { TeamLink, heightText, hometownText, useDyn } from './ui';
import { SimOffseason, getTemplates, type OffseasonActions } from './OffseasonPage';

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
const starText = (n: number) => `${n}★`;

/** Hometown (or the school he left) and size: what a team sees before scouting. */
const aboutText = (p: Prospect, d: Dynasty, team: number) => {
  const st = stateCode(p.player.state);
  const tag = p.from === team ? '' : st && SCHOOL_STATE[d.teams[team].school] === st ? ' (in-state)' : st && pipelineStates(d, team).some((x) => x.state === st) ? ' (pipeline state)' : '';
  return `${p.from === team ? 'Left your team (transfer portal)' : `${p.from !== null ? `Transfer from ${d.teams[p.from].school}, from ` : ''}${hometownText(p.player)}${tag}`}. ${heightText(p.player.heightIn)}, ${p.player.weight} lb`;
};

/** The pitches (user, 2026-11-12: his interests stay hidden; a pitch shows whether it matched). */
const PITCH: Record<PitchKey, string> = { pt: 'Playing time', prestige: 'Program prestige', home: 'Close to home', academics: 'Academics', contender: 'Championship contender' };
const REACT: Record<PitchReaction, { mark: string; text: string; cls: string }> = {
  good: { mark: '+', text: 'interested, and you\'re strong there', cls: 'dy-react-good' },
  ok: { mark: '~', text: 'interested, you\'re in between', cls: 'dy-react-ok' },
  bad: { mark: '−', text: 'interested, but you\'re weak there', cls: 'dy-react-bad' },
  no: { mark: '✗', text: 'not interested', cls: 'dy-react-no' },
};

/** The reactions so far to your pitches. */
function Reactions({ p, team }: { p: Prospect; team: number }) {
  const { d } = useDyn();
  const got = d.offseason!.recruiting!.reactions?.[team]?.[p.id];
  if (!got || !Object.keys(got).length) return null;
  return (
    <div className="dy-small dy-reactions">
      {PITCHES.filter((k) => got[k]).map((k) => {
        const x = REACT[got[k]!];
        return <span key={k} className={x.cls} title={`${PITCH[k]}: ${x.text}`}>{PITCH[k]} <b>{x.mark}</b></span>;
      })}
    </div>
  );
}

/** His five top schools by interest (yours marked). */
function TopSchools({ p, team }: { p: Prospect; team: number }) {
  const { d } = useDyn();
  const top = interestRanking(p).slice(0, 5);
  if (!top.length) return null;
  return (
    <div className="dy-small dy-dim dy-top-schools">
      Top schools: {top.map((x, i) => <span key={x.team} className={x.team === team ? 'dy-strong' : undefined}>{i ? ', ' : ''}{d.teams[x.team].school}</span>)}
    </div>
  );
}

/** The ratings his position uses in the game, as it shows them (no Weight: his size is shown). */
function RatingsLine({ p }: { p: Prospect }) {
  const group = GROUP_OF_ROLE[roleOfPos(p.player.pos)];
  if (!group) return null;
  const cols = GROUP_COLUMNS[group].filter((a) => a !== 'Weight');
  return (
    <div className="dy-scout-ratings dy-small">
      {cols.map((a) => (
        <span key={a}><span className="dy-dim">{group === 'KP' && a === 'Quickness' ? 'Kick distance' : a}</span> {shownOf(p.player.ratings[a] ?? 0)}</span>
      ))}
    </div>
  );
}

/** OVR if scouted, else a mark; the ratings once fully scouted. */
const SORT_RATINGS: Attr[] = ['Speed', 'Quickness', 'Power', 'Awareness', 'Hands', 'Range', 'Accuracy', 'Blocking', 'Tackling'];

const ovrText = (p: Prospect, lv: ScoutLevel) => (lv >= 1 ? `${p.player.ovr}` : '');

/** Scout buttons: OVR (10), all ratings (20 more), or both at once. */
function ScoutButtons({ p, team, lv, left, onScout }: { p: Prospect; team: number; lv: ScoutLevel; left: number; onScout: (id: number, level: ScoutLevel) => void }) {
  const { d } = useDyn();
  const rs = d.offseason!.recruiting!;
  if (lv >= 2) return null;
  const opts: { level: ScoutLevel; label: string }[] = lv === 0
    ? [{ level: 1, label: 'Scout OVR' }, { level: 2, label: 'Scout all' }]
    : [{ level: 2, label: 'Scout ratings' }];
  return (
    <>
      {opts.map((o) => {
        const cost = scoutCost(rulesOf(d), rs, team, p, o.level);
        return (
          <Button variant="quiet" key={o.level} disabled={cost > left} onClick={() => onScout(p.id, o.level)}
            title={cost > left ? `${cost} points: you have ${left} left this week` : undefined}>
            {o.label} <span className="dy-dim">{cost}</span>
          </Button>
        );
      })}
    </>
  );
}

/** Where the user team stands with a prospect. */
function standing(p: Prospect, team: number, d: Dynasty): string {
  const r0 = reach(p.stars, prestigeStars(d, team));
  const hard = r0 < 0.75 ? `. A long shot for a ${prestigeStars(d, team)}-star program` : '';
  return standingOnly(p, team, d) + hard;
}

function standingOnly(p: Prospect, team: number, d: Dynasty): string {
  if (p.committed === team) return 'Committed to you';
  if (p.committed !== null) return `Committed to ${d.teams[p.committed].school}`;
  const r = interestRanking(p);
  const i = r.findIndex((x) => x.team === team);
  if (i < 0) return r.length ? `${r.length} ${r.length === 1 ? 'school' : 'schools'} interested` : 'No interest yet';
  return i === 0 ? `You lead (${r.length} ${r.length === 1 ? 'school' : 'schools'})` : `You're ${ordinal(i + 1)} of ${r.length}`;
}

export function Recruiting({ actions, busy }: { actions: OffseasonActions; busy: string | null }) {
  const { d } = useDyn();
  const rs = d.offseason!.recruiting!;
  const users = d.userTeams;
  const [team, setTeam] = useState(users[0]);
  const [plans, setPlans] = useState<Record<number, TeamPlan>>(() =>
    Object.fromEntries(users.map((u) => [u, rs.plans[u] ? { points: { ...rs.plans[u].points }, offers: [], pitches: { ...rs.plans[u].pitches } } : { points: {}, offers: [] }])));
  const [err, setErr] = useState<string | null>(null);
  const byId = useMemo(() => new Map(rs.prospects.map((p) => [p.id, p])), [rs]);
  const plan = plans[team] ?? { points: {}, offers: [] };
  // Committed prospects leave the board.
  const board = Object.keys(plan.points).map(Number).map((id) => byId.get(id)!).filter((p) => p && (p.committed === null || p.committed === team));
  const spent = board.filter((p) => p.committed === null).reduce((a, p) => a + (plan.points[p.id] ?? 0), 0);
  const scoutSpent = rs.scoutSpent?.[team] ?? 0;
  const R = rulesOf(d);
  const left = R.userPoints - spent - scoutSpent;
  const scout = (id: number, level: ScoutLevel) =>
    void actions.run('Scouting…', async () => actions.commit(scoutProspect(d, team, id, level, spent)));
  const commits = rs.prospects.filter((p) => p.committed === team);
  const spots = rs.spots[team] ?? 0;

  const setPlan = (f: (p: TeamPlan) => TeamPlan) => {
    setErr(null);
    setPlans((all) => ({ ...all, [team]: f(all[team] ?? { points: {}, offers: [] }) }));
  };
  const add = (id: number) => setPlan((p) => (Object.keys(p.points).length >= R.boardSize ? p : { ...p, points: { ...p.points, [id]: 0 } }));
  const remove = (id: number) => setPlan((p) => { const points = { ...p.points }; delete points[id]; return { ...p, points }; });
  const setPoints = (id: number, v: number) => setPlan((p) => ({ ...p, points: { ...p.points, [id]: Math.max(0, Math.min(R.maxPerProspect, Math.round(v) || 0)) } }));
  const setPitch = (id: number, k: PitchKey | '') => setPlan((p) => { const pitches = { ...p.pitches }; if (k) pitches[id] = k; else delete pitches[id]; return { ...p, pitches }; });
  const offer = (id: number) => setPlan((p) => ({ ...p, offers: p.offers.includes(id) ? p.offers : [...p.offers, id] }));


  const runWeek = () => {
    // Points only for prospects still open; a user plan sends its new offers once.
    const send = Object.fromEntries(users.map((u) => {
      const p = plans[u] ?? { points: {}, offers: [] };
      const points = Object.fromEntries(Object.entries(p.points).filter(([id]) => byId.get(Number(id))?.committed === null));
      const pitches = Object.fromEntries(Object.entries(p.pitches ?? {}).filter(([id]) => id in points));
      return [u, { points, offers: p.offers, pitches }];
    }));
    const bad = users.flatMap((u) => planProblems(R, send[u], rs.scoutSpent?.[u] ?? 0).map((m) => `${d.teams[u].school}: ${m}`));
    if (bad.length) return setErr(bad.join(' '));
    void actions.run(`Recruiting week ${rs.week + 1}…`, async () => {
      await actions.commit(recruitingWeek(d, send));
      setPlans((all) => Object.fromEntries(Object.entries(all).map(([u, p]) => [u, { ...p, offers: [] }])));
    });
  };

  /** The computer recruits for the user teams for `weeks` weeks (the board isn't used). */
  const sim = (weeks: number) => void actions.run(weeks === 1 ? `Simming week ${rs.week + 1}…` : 'Simming recruiting…', async () => {
    await actions.commit(simRecruiting(d, weeks));
    setPlans((all) => Object.fromEntries(Object.entries(all).map(([u, p]) => [u, { ...p, offers: [] }])));
  });

  const thisWeek = rs.log.filter((l) => l.week === rs.week);
  return (
    <>
      <SubHead>{rs.week < R.weeks ? `Recruiting, week ${rs.week + 1} of ${R.weeks}` : 'Recruiting is over'}</SubHead>
      <p>
        Every week you have {R.userPoints.toLocaleString('en-US')} points to spend on up to {R.boardSize} prospects (at most {R.maxPerProspect} each); they go further with prospects from your state and your pipeline states.
        Interest grows with points, with an offer, and with how well your school fits what a prospect wants: playing time, program prestige, being close to home, academics and a shot at a championship. What he wants is hidden: pitch one of them, and after the week he reacts. + means it's one of his interests and your school is strong there (your points count more), ~ in between, − one of his interests but your school is weak there (your points count less than with no pitch), ✗ not one of his interests.
        Prospects rated above your program's prestige are harder to reach. A prospect commits when one school's interest is high enough and clearly
        ahead (the best ones not before week 3 or 4); at signing day the rest choose among the schools that offered. Players in the transfer portal are
        prospects too; your own players in the portal start on your board, and their old school (you) is one of their top schools. Scouting a high-school prospect shows his OVR ({R.scoutOvr} points), then all his ratings ({R.scoutRatings} more), out of the
        week's points; what you scout stays known. Portal players show everything.
      </p>
      {users.length > 1 && (
        <div className="dy-row">
          {users.map((u) => (
            <Button key={u} variant={u === team ? 'primary' : 'quiet'} onClick={() => setTeam(u)}>{d.teams[u].school}</Button>
          ))}
        </div>
      )}

      {rs.week > 0 && (
        <div className="dy-off-team">
          <h4>Week {rs.week} commitments</h4>
          <ul className="dy-plist">
            {thisWeek.filter((l) => l.team === team || l.flipFrom === team).map((l) => {
              const p = byId.get(l.prospect)!;
              return <li key={`${l.prospect}-${l.team}`}><span className="dy-strong">{playerName(p.player)}</span><span className="dy-dim">{starText(p.stars)} {p.player.pos}</span><span className="dy-small dy-dim">{l.flipFrom === team ? `flipped to ${d.teams[l.team].school}` : l.flipFrom !== undefined ? `flipped from ${d.teams[l.flipFrom].school}` : 'committed to you'}</span></li>;
            })}
          </ul>
          <p className="dy-small dy-dim">{thisWeek.length} commitments across the country this week.</p>
        </div>
      )}

      <div className="dy-off-team">
        <h4><TeamLink team={team} rank={false} /> <span className="dy-dim dy-small">{commits.length} of {spots} spots filled</span></h4>
        <SchoolPitch team={team} />
        <NeedsTable team={team} commits={commits} />
        {commits.length > 0 && (
          <ul className="dy-plist">
            {commits.sort((a, b) => b.stars - a.stars).map((p) => (
              <li key={p.id}><span className="dy-strong">{playerName(p.player)}</span><span className="dy-dim">{starText(p.stars)} {p.player.pos}</span><span className="dy-strong">{ovrText(p, scoutLevel(rs, team, p))}</span>{p.from !== null && <span className="dy-small dy-dim">transfer from {d.teams[p.from].school}</span>}</li>
            ))}
          </ul>
        )}
      </div>

      {rs.week < R.weeks && (
        <>
          <h4>Your board <span className="dy-dim dy-small">{spent + scoutSpent} of {R.userPoints} points{scoutSpent ? `, ${scoutSpent} on scouting` : ''}</span></h4>
          {board.filter((p) => p.committed === null).length === 0 && <p className="dy-dim">Add prospects from the list below.</p>}
          <ul className="dy-board">
            {board.filter((p) => p.committed === null).map((p) => {
              const offered = p.offers.includes(team) || plan.offers.includes(p.id);
              const lv = scoutLevel(rs, team, p);
              return (
                <li key={p.id}>
                  <ProspectTop p={p} lv={lv} />
                  <div className="dy-small dy-dim">{aboutText(p, d, team)}. {standing(p, team, d)}.</div>
                  <TopSchools p={p} team={team} />
                  {lv >= 2 && <RatingsLine p={p} />}
                  <Reactions p={p} team={team} />
                  <div className="dy-board-ctl">
                    <label>
                      <span className="dy-small">Pitch</span>
                      <select value={plan.pitches?.[p.id] ?? ''} onChange={(e) => setPitch(p.id, e.target.value as PitchKey | '')}>
                        <option value="">No pitch</option>
                        {PITCHES.map((k) => {
                          const x = rs.reactions?.[team]?.[p.id]?.[k];
                          return <option key={k} value={k}>{PITCH[k]}{x ? ` (${REACT[x].mark})` : ''}</option>;
                        })}
                      </select>
                    </label>
                    <label>
                      <span className="dy-small">Points</span>
                      <input type="number" inputMode="numeric" min={0} max={R.maxPerProspect} step={10} value={plan.points[p.id] ?? 0} onChange={(e) => setPoints(p.id, Number(e.target.value))} />
                    </label>
                    {offered ? <span className="dy-small dy-w">Offered</span> : <Button variant="quiet" onClick={() => offer(p.id)}>Offer</Button>}
                    <ScoutButtons p={p} team={team} lv={lv} left={left} onScout={scout} />
                    <button type="button" className="dy-linkbutton dy-small" onClick={() => remove(p.id)}>Remove</button>
                  </div>
                </li>
              );
            })}
          </ul>
          {err && <Note kind="error">{err}</Note>}
          <div className="dy-row dy-next">
            <Button disabled={!!busy} onClick={runWeek}>Run week {rs.week + 1}</Button>
          </div>
          <div className="dy-row">
            <Button variant="quiet" disabled={!!busy} onClick={() => sim(1)}>Sim week {rs.week + 1}</Button>
            {rs.week + 1 < R.weeks && <Button variant="quiet" disabled={!!busy} onClick={() => sim(R.weeks)}>Sim the rest of recruiting</Button>}
            <SimOffseason actions={actions} busy={busy} />
          </div>
          <p className="dy-small dy-dim">Simming lets the computer recruit for {users.length > 1 ? 'your teams' : d.teams[team].school} that week, as for every other team (your board isn't used).</p>
          <ProspectSearch team={team} onAdd={add} board={new Set(Object.keys(plan.points).map(Number))} full={Object.keys(plan.points).length >= R.boardSize} left={left} onScout={scout} />
        </>
      )}

      {rs.week >= R.weeks && (
        <div className="dy-row dy-next">
          <Button disabled={!!busy} onClick={() => actions.run('Signing day…', async () => actions.commit(finishRecruiting(d, await getTemplates(d))))}>Signing day</Button>
          <SimOffseason actions={actions} busy={busy} />
        </div>
      )}
    </>
  );
}

function ProspectSearch({ team, onAdd, board, full, left, onScout }: { team: number; onAdd: (id: number) => void; board: Set<number>; full: boolean; left: number; onScout: (id: number, level: ScoutLevel) => void }) {
  const { d } = useDyn();
  const rs = d.offseason!.recruiting!;
  const [pos, setPos] = useState('');
  const [minStars, setMinStars] = useState(0);
  const [kind, setKind] = useState<'all' | 'hs' | 'portal' | 'near'>('all');
  const [state, setState] = useState('');
  const [sort, setSort] = useState('stars');
  const [shown, setShown] = useState(30);
  const school = d.teams[team].school;
  const pipes = useMemo(() => new Set(pipelineStates(d, team).map((x) => x.state)), [d, team]);
  const states = useMemo(() => [...new Set(rs.prospects.map((p) => stateCode(p.player.state)).filter(Boolean))].sort(), [rs]);
  // Sorting by OVR or a rating only uses what's known (scouted; portal players fully): the rest go last.
  const key = (p: Prospect): number => {
    const lv = scoutLevel(rs, team, p);
    if (sort === 'stars') return p.stars * 1000 + (lv >= 1 ? p.player.ovr : -1);
    if (sort === 'ovr') return lv >= 1 ? p.player.ovr : -1;
    return lv >= 2 ? shownOf(p.player.ratings[sort as Attr] ?? 0) : -1;
  };
  const list = useMemo(() => rs.prospects
    .filter((p) => p.committed === null && !board.has(p.id) && (!pos || p.player.pos === pos) && p.stars >= minStars &&
      (kind === 'all' || (kind === 'hs' && p.id < 0) || (kind === 'portal' && p.id > 0) || (kind === 'near' && closeness(p.player.state, school) >= 0.6)) &&
      (!state || (state === 'pipeline' ? pipes.has(stateCode(p.player.state)) : stateCode(p.player.state) === state)))
    .sort((a, b) => key(b) - key(a) || b.stars - a.stars || a.player.last.localeCompare(b.player.last)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rs, board, pos, minStars, kind, team, school, state, sort, pipes]);
  return (
    <>
      <h4>Prospects</h4>
      <div className="dy-row dy-filters">
        <select aria-label="Position" value={pos} onChange={(e) => { setPos(e.target.value); setShown(30); }}>
          <option value="">All positions</option>
          {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select aria-label="Stars" value={minStars} onChange={(e) => { setMinStars(Number(e.target.value)); setShown(30); }}>
          <option value={0}>Any stars</option>
          {[5, 4, 3, 2].map((s) => <option key={s} value={s}>{s}★ and up</option>)}
        </select>
        <select aria-label="Kind" value={kind} onChange={(e) => { setKind(e.target.value as typeof kind); setShown(30); }}>
          <option value="all">High school and portal</option>
          <option value="hs">High school</option>
          <option value="portal">Transfer portal</option>
          <option value="near">Close to {school}</option>
        </select>
        <select aria-label="State" value={state} onChange={(e) => { setState(e.target.value); setShown(30); }}>
          <option value="">All states</option>
          <option value="pipeline">Your pipeline states</option>
          {states.map((x) => <option key={x} value={x}>{x}{pipes.has(x) ? ' (pipeline)' : ''}</option>)}
        </select>
        <select aria-label="Sort" value={sort} onChange={(e) => { setSort(e.target.value); setShown(30); }}>
          <option value="stars">Sort by stars</option>
          <option value="ovr">Sort by OVR (scouted)</option>
          {SORT_RATINGS.map((a) => <option key={a} value={a}>Sort by {a} (scouted)</option>)}
        </select>
      </div>
      <p className="dy-small dy-dim">{list.length.toLocaleString('en-US')} uncommitted prospects.{full ? ` Your board is full (${rulesOf(d).boardSize}).` : ''}</p>
      <ul className="dy-board">
        {list.slice(0, shown).map((p) => {
          const lv = scoutLevel(rs, team, p);
          return (
            <li key={p.id}>
              <ProspectTop p={p} lv={lv} />
              <div className="dy-small dy-dim">{aboutText(p, d, team)}. {standing(p, team, d)}.</div>
              <TopSchools p={p} team={team} />
              {lv >= 2 && <RatingsLine p={p} />}
              <Reactions p={p} team={team} />
              <div className="dy-board-ctl">
                <Button variant="quiet" disabled={full} onClick={() => onAdd(p.id)}>Add to board</Button>
                <ScoutButtons p={p} team={team} lv={lv} left={left} onScout={onScout} />
              </div>
            </li>
          );
        })}
      </ul>
      {list.length > shown && <button type="button" className="dy-linkbutton" onClick={() => setShown(shown + 30)}>Show more</button>}
    </>
  );
}

/** OVR for sorting: only what the team knows (unscouted last). */
const knownOvr = (rs: RecruitingState, team: number, p: Prospect) => (scoutLevel(rs, team, p) >= 1 ? p.player.ovr : -1);

/** Name, stars, position and the OVR (or a dash when not scouted). */
function ProspectTop({ p, lv }: { p: Prospect; lv: ScoutLevel }) {
  return (
    <div className="dy-board-top">
      <span className="dy-strong">{playerName(p.player)}</span>
      <span className="dy-dim">{starText(p.stars)} {p.player.pos} {lv >= 1 ? <span className="dy-strong">{p.player.ovr}</span> : <span title="Not scouted">OVR ?</span>}</span>
    </div>
  );
}

/**
 * Needs by position (user, 2026-11-12: "somewhere in recruiting we need a breakdown of our needs by
 * position"): players returning (those in the portal not counted), commitments, the target (two per
 * Active Roster spot) and what's still open.
 */
function NeedsTable({ team, commits }: { team: number; commits: Prospect[] }) {
  const { d } = useDyn();
  const rs = d.offseason!.recruiting!;
  const portal = new Set(rs.prospects.filter((p) => p.id > 0).map((p) => p.id));
  const rows = POSITIONS.map((pos) => {
    const roster = d.players.filter((p) => p.status === 'active' && p.team === team && p.pos === pos);
    const back = roster.filter((p) => !portal.has(p.id)).length;
    const gone = roster.length - back;
    const signed = commits.filter((p) => p.player.pos === pos).length;
    const need = Math.max(0, POS_TARGET[pos] - back - signed);
    return { pos, back, gone, signed, target: POS_TARGET[pos], need };
  });
  return (
    <details className="dy-needs" open>
      <summary>Needs by position: {rows.reduce((a, r) => a + r.need, 0)} open</summary>
      <Table figures>
        <thead><tr><th className="ui-left">Pos</th><th title="Players returning">Back</th><th title="Players in the transfer portal">Portal</th><th title="Commitments">Commits</th><th title="Two for each Active Roster spot">Target</th><th>Need</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.pos}>
              <td className="ui-left">{r.pos}</td><td>{r.back}</td><td>{r.gone || ''}</td><td>{r.signed || ''}</td><td>{r.target}</td><td className="dy-strong">{r.need || ''}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </details>
  );
}

/**
 * What the user's school offers (its pitches) and its pipeline states (user, 2026-11-12: "User needs to see
 * what his pipeline states are when recruiting"). Contender changes as commitments come in.
 */
function SchoolPitch({ team }: { team: number }) {
  const { d } = useDyn();
  const rs = d.offseason!.recruiting!;
  const ctx = useMemo(() => weekContext(d, rs), [d, rs]);
  const school = d.teams[team].school;
  const pipes = pipelineStates(d, team);
  const R = rulesOf(d);
  return (
    <p className="dy-small dy-pitch">
      <span>Prestige {'★'.repeat(prestigeStars(d, team))}</span>
      <span>Academics {academicGrade(school)}</span>
      <span>Championship contender {gradeOf(ctx.contender.get(team)!)}</span>
      <span>Pipeline states: {pipes.length ? pipes.map((x) => `${x.state} (${x.n})`).join(', ') : `none yet (${R.pipelineMin} players from a state)`}</span>
    </p>
  );
}
