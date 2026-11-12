// Full recruiting: five weeks of points and offers for the user teams' boards, then signing day.
import { useMemo, useState } from 'react';
import type { Dynasty } from '../../core/dynasty/model';
import {
  BOARD_SIZE, MAX_PER_PROSPECT, WEEKLY_POINTS, WEEKS, finishRecruiting, interestRanking, planProblems, reach, recruitingWeek,
  type Prospect, type TeamPlan,
} from '../../core/dynasty/recruiting';
import { POSITIONS, POS_TARGET, prestigeStars } from '../../core/dynasty/offseason';
import { closeness } from '../../core/dynasty/schoolStates';
import { playerName } from '../../core/dynasty/derive';
import { TeamLink, hometownText, useDyn } from './ui';
import { getTemplates, type OffseasonActions } from './OffseasonPage';

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
const starText = (n: number) => `${n}★`;

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
    Object.fromEntries(users.map((u) => [u, rs.plans[u] ? { points: { ...rs.plans[u].points }, offers: [] } : { points: {}, offers: [] }])));
  const [err, setErr] = useState<string | null>(null);
  const byId = useMemo(() => new Map(rs.prospects.map((p) => [p.id, p])), [rs]);
  const plan = plans[team] ?? { points: {}, offers: [] };
  // Committed prospects leave the board.
  const board = Object.keys(plan.points).map(Number).map((id) => byId.get(id)!).filter((p) => p && (p.committed === null || p.committed === team));
  const spent = board.filter((p) => p.committed === null).reduce((a, p) => a + (plan.points[p.id] ?? 0), 0);
  const commits = rs.prospects.filter((p) => p.committed === team);
  const spots = rs.spots[team] ?? 0;

  const setPlan = (f: (p: TeamPlan) => TeamPlan) => {
    setErr(null);
    setPlans((all) => ({ ...all, [team]: f(all[team] ?? { points: {}, offers: [] }) }));
  };
  const add = (id: number) => setPlan((p) => (Object.keys(p.points).length >= BOARD_SIZE ? p : { ...p, points: { ...p.points, [id]: 0 } }));
  const remove = (id: number) => setPlan((p) => { const points = { ...p.points }; delete points[id]; return { ...p, points }; });
  const setPoints = (id: number, v: number) => setPlan((p) => ({ ...p, points: { ...p.points, [id]: Math.max(0, Math.min(MAX_PER_PROSPECT, Math.round(v) || 0)) } }));
  const offer = (id: number) => setPlan((p) => ({ ...p, offers: p.offers.includes(id) ? p.offers : [...p.offers, id] }));

  // Needs: target minus roster (portal players out) minus commits.
  const needs = useMemo(() => {
    const portal = new Set(rs.prospects.filter((p) => p.id > 0).map((p) => p.id));
    const c: Record<string, number> = {};
    for (const p of d.players) if (p.status === 'active' && p.team === team && !portal.has(p.id)) c[p.pos] = (c[p.pos] ?? 0) + 1;
    for (const p of commits) c[p.player.pos] = (c[p.player.pos] ?? 0) + 1;
    return POSITIONS.map((pos) => ({ pos, n: POS_TARGET[pos] - (c[pos] ?? 0) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  }, [d, rs, team, commits]);

  const runWeek = () => {
    // Points only for prospects still open; a user plan sends its new offers once.
    const send = Object.fromEntries(users.map((u) => {
      const p = plans[u] ?? { points: {}, offers: [] };
      const points = Object.fromEntries(Object.entries(p.points).filter(([id]) => byId.get(Number(id))?.committed === null));
      return [u, { points, offers: p.offers }];
    }));
    const bad = users.flatMap((u) => planProblems(send[u]).map((m) => `${d.teams[u].school}: ${m}`));
    if (bad.length) return setErr(bad.join(' '));
    void actions.run(`Recruiting week ${rs.week + 1}…`, async () => {
      await actions.commit(recruitingWeek(d, send));
      setPlans((all) => Object.fromEntries(Object.entries(all).map(([u, p]) => [u, { ...p, offers: [] }])));
    });
  };

  const thisWeek = rs.log.filter((l) => l.week === rs.week);
  return (
    <>
      <h3 className="dy-sub">{rs.week < WEEKS ? `Recruiting, week ${rs.week + 1} of ${WEEKS}` : 'Recruiting is over'}</h3>
      <p>
        Every week you have {WEEKLY_POINTS.toLocaleString('en-US')} points to spend on up to {BOARD_SIZE} prospects (at most {MAX_PER_PROSPECT} each).
        Interest grows with points, with an offer, and with how well your school fits what a prospect wants: playing time, prestige and being close to home.
        Prospects rated above your program's prestige are harder to reach. A prospect commits when one school's interest is high enough and clearly
        ahead (the best ones not before week 3 or 4); at signing day the rest choose among the schools that offered. Players in the transfer portal are
        prospects too.
      </p>
      {users.length > 1 && (
        <div className="dy-row">
          {users.map((u) => (
            <button key={u} type="button" className={`dy-button${u === team ? '' : ' dy-quiet'}`} onClick={() => setTeam(u)}>{d.teams[u].school}</button>
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
        <p className="dy-small dy-dim">Needs: {needs.length ? needs.map((x) => `${x.pos} ${x.n}`).join(', ') : 'none'}</p>
        {commits.length > 0 && (
          <ul className="dy-plist">
            {commits.sort((a, b) => b.stars - a.stars).map((p) => (
              <li key={p.id}><span className="dy-strong">{playerName(p.player)}</span><span className="dy-dim">{starText(p.stars)} {p.player.pos}</span><span className="dy-strong">{p.player.ovr}</span>{p.from !== null && <span className="dy-small dy-dim">transfer from {d.teams[p.from].school}</span>}</li>
            ))}
          </ul>
        )}
      </div>

      {rs.week < WEEKS && (
        <>
          <h4>Your board <span className="dy-dim dy-small">{spent} of {WEEKLY_POINTS} points</span></h4>
          {board.filter((p) => p.committed === null).length === 0 && <p className="dy-dim">Add prospects from the list below.</p>}
          <ul className="dy-board">
            {board.filter((p) => p.committed === null).map((p) => {
              const offered = p.offers.includes(team) || plan.offers.includes(p.id);
              return (
                <li key={p.id}>
                  <div className="dy-board-top">
                    <span className="dy-strong">{playerName(p.player)}</span>
                    <span className="dy-dim">{starText(p.stars)} {p.player.pos} {p.player.ovr}</span>
                  </div>
                  <div className="dy-small dy-dim">{p.from !== null ? `Transfer from ${d.teams[p.from].school}` : hometownText(p.player)}. {standing(p, team, d)}.</div>
                  <div className="dy-board-ctl">
                    <label>
                      <span className="dy-small">Points</span>
                      <input type="number" inputMode="numeric" min={0} max={MAX_PER_PROSPECT} step={10} value={plan.points[p.id] ?? 0} onChange={(e) => setPoints(p.id, Number(e.target.value))} />
                    </label>
                    {offered ? <span className="dy-small dy-w">Offered</span> : <button type="button" className="dy-button dy-quiet" onClick={() => offer(p.id)}>Offer</button>}
                    <button type="button" className="dy-linkbutton dy-small" onClick={() => remove(p.id)}>Remove</button>
                  </div>
                </li>
              );
            })}
          </ul>
          {err && <p className="dy-note dy-note-error" role="alert">{err}</p>}
          <div className="dy-row dy-next">
            <button type="button" className="dy-button" disabled={!!busy} onClick={runWeek}>Run week {rs.week + 1}</button>
          </div>
          <ProspectSearch team={team} onAdd={add} board={new Set(Object.keys(plan.points).map(Number))} full={Object.keys(plan.points).length >= BOARD_SIZE} />
        </>
      )}

      {rs.week >= WEEKS && (
        <div className="dy-row dy-next">
          <button type="button" className="dy-button" disabled={!!busy} onClick={() => actions.run('Signing day…', async () => actions.commit(finishRecruiting(d, await getTemplates(d))))}>Signing day</button>
        </div>
      )}
    </>
  );
}

function ProspectSearch({ team, onAdd, board, full }: { team: number; onAdd: (id: number) => void; board: Set<number>; full: boolean }) {
  const { d } = useDyn();
  const rs = d.offseason!.recruiting!;
  const [pos, setPos] = useState('');
  const [minStars, setMinStars] = useState(0);
  const [kind, setKind] = useState<'all' | 'hs' | 'portal' | 'near'>('all');
  const [shown, setShown] = useState(30);
  const school = d.teams[team].school;
  const list = useMemo(() => rs.prospects
    .filter((p) => p.committed === null && !board.has(p.id) && p.from !== team && (!pos || p.player.pos === pos) && p.stars >= minStars &&
      (kind === 'all' || (kind === 'hs' && p.id < 0) || (kind === 'portal' && p.id > 0) || (kind === 'near' && closeness(p.player.state, school) >= 0.6)))
    .sort((a, b) => b.stars - a.stars || b.player.ovr - a.player.ovr), [rs, board, pos, minStars, kind, team, school]);
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
      </div>
      <p className="dy-small dy-dim">{list.length.toLocaleString('en-US')} uncommitted prospects.{full ? ` Your board is full (${BOARD_SIZE}).` : ''}</p>
      <ul className="dy-board">
        {list.slice(0, shown).map((p) => (
          <li key={p.id}>
            <div className="dy-board-top">
              <span className="dy-strong">{playerName(p.player)}</span>
              <span className="dy-dim">{starText(p.stars)} {p.player.pos} {p.player.ovr}</span>
            </div>
            <div className="dy-small dy-dim">{p.from !== null ? `Transfer from ${d.teams[p.from].school}` : hometownText(p.player)}. {standing(p, team, d)}.</div>
            <div className="dy-board-ctl">
              <button type="button" className="dy-button dy-quiet" disabled={full} onClick={() => onAdd(p.id)}>Add to board</button>
            </div>
          </li>
        ))}
      </ul>
      {list.length > shown && <button type="button" className="dy-linkbutton" onClick={() => setShown(shown + 30)}>Show more</button>}
    </>
  );
}
