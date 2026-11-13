// Full recruiting: five weeks of points and offers for the user teams' boards, then signing day.
import { Button, Field, Meter, Note, Select, SubHead, Table, Tabs } from '../../ui';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Dynasty } from '../../core/dynasty/model';
import {
  commitNeed, finishRecruiting, weekContext, interestRanking, planProblems, reach, recruitingWeek,
  scoutCost, scoutLevel, scoutProspect, simRecruiting, PITCHES, type PitchKey, type PitchReaction, type Prospect, type RecruitingState, type ScoutLevel, type TeamPlan, type WeekContext,
} from '../../core/dynasty/recruiting';
import { POSITIONS, POS_TARGET, STAR_POINTS, prestigeStars } from '../../core/dynasty/offseason';
import { closeness } from '../../core/dynasty/schoolStates';
import { playerName } from '../../core/dynasty/derive';
import { GROUP_COLUMNS, type Attr } from '../../core/rosterLayouts';
import { rulesOf } from '../../core/dynasty/rules';
import { academicGrade, academicsOf, gradeOf } from '../../core/dynasty/academics';
import { costOf, interestRank, newOffers, offerCap, offersOut, pipelineStates, planCost, pointCost, withdrawOffer } from '../../core/dynasty/recruiting';
import { SCHOOL_STATE, stateCode } from '../../core/dynasty/schoolStates';
import { GROUP_OF_ROLE, roleOfPos, shownOf } from '../../core/dynasty/ratings';
import { Empty, Headshot, heightText, hometownText, inkColor, mainColor, onColor, useDyn } from './ui';
import { SimOffseason, getTemplates, type OffseasonActions } from './OffseasonPage';

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
const starText = (n: number) => `${n}★`;

/** The pitches (user, 2026-11-12: his interests stay hidden; a pitch shows whether it matched). */
const PITCH: Record<PitchKey, string> = { pt: 'Playing time', prestige: 'Program prestige', home: 'Close to home', academics: 'Academics', contender: 'Championship contender' };
const REACT: Record<PitchReaction, { mark: string; text: string; cls: string }> = {
  good: { mark: '+', text: 'interested, and you\'re strong there', cls: 'dy-react-good' },
  ok: { mark: '~', text: 'interested, you\'re in between', cls: 'dy-react-ok' },
  bad: { mark: '−', text: 'interested, but you\'re weak there', cls: 'dy-react-bad' },
  no: { mark: '✗', text: 'not interested', cls: 'dy-react-no' },
};

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

function standingOnly(p: Prospect, team: number, d: Dynasty): string {
  if (p.committed === team) return 'Committed to you';
  if (p.committed !== null) return `Committed to ${d.teams[p.committed].school}`;
  const r = interestRanking(p);
  const i = r.findIndex((x) => x.team === team);
  if (i < 0) return r.length ? `${r.length} ${r.length === 1 ? 'school' : 'schools'} interested` : 'No interest yet';
  return i === 0 ? `You lead (${r.length} ${r.length === 1 ? 'school' : 'schools'})` : `You're ${ordinal(i + 1)} of ${r.length}`;
}

type Tab = 'board' | 'prospects' | 'portal' | 'school' | 'classes';

/** His interest in a school as a share of what he needs to commit (the bars and their figures). */
const share = (R: ReturnType<typeof rulesOf>, p: Prospect, team: number) => Math.min(1, (p.interest[team] ?? 0) / commitNeed(R, p));
const pct = (v: number) => Math.round(v * 100);

/** In-state or pipeline, with the discount (empty for the rest). */
function discountTag(d: Dynasty, pipes: Pick<WeekContext, 'pipelines'>, p: Prospect, team: number): string {
  const c = pointCost(d, pipes, p, team);
  if (c >= 1) return '';
  const st = stateCode(p.player.state);
  return `${st && SCHOOL_STATE[d.teams[team].school] === st ? 'In state' : 'Pipeline state'}, ${Math.round((1 - c) * 100)}% off`;
}

/** Needs by position: players back (portal not counted), commitments, the target and what's open. */
function needsOf(d: Dynasty, rs: RecruitingState, team: number) {
  const portal = new Set(rs.prospects.filter((p) => p.id > 0).map((p) => p.id));
  const commits = rs.prospects.filter((p) => p.committed === team);
  return POSITIONS.map((pos) => {
    const roster = d.players.filter((p) => p.status === 'active' && p.team === team && p.pos === pos);
    const back = roster.filter((p) => !portal.has(p.id)).length;
    const signed = commits.filter((p) => p.player.pos === pos).length;
    return { pos, back, gone: roster.length - back, signed, target: POS_TARGET[pos], need: Math.max(0, POS_TARGET[pos] - back - signed) };
  });
}

/** What the page's parts share: the team, its plan and the ways to change it. */
interface Hub {
  team: number;
  plan: TeamPlan;
  pipes: Pick<WeekContext, 'pipelines'>;
  left: number;
  open: boolean;
  full: boolean;
  /** No room for another offer (the cap: open spots plus the rules' extra). */
  capped: boolean;
  cap: number;
  busy: boolean;
  add: (id: number) => void;
  remove: (id: number) => void;
  setPoints: (id: number, v: number) => void;
  setPitch: (id: number, k: PitchKey | '') => void;
  offer: (id: number) => void;
  /** Takes an offer back: one made this week leaves the plan, an older one is withdrawn at once. */
  withdraw: (id: number) => void;
  scout: (id: number, level: ScoutLevel) => void;
}

export function Recruiting({ actions, busy }: { actions: OffseasonActions; busy: string | null }) {
  const { d } = useDyn();
  const rs = d.offseason!.recruiting!;
  const users = d.userTeams;
  const [team, setTeam] = useState(users[0]);
  const [tab, setTab] = useState<Tab>('board');
  const [plans, setPlans] = useState<Record<number, TeamPlan>>(() =>
    Object.fromEntries(users.map((u) => [u, rs.plans[u] ? { points: { ...rs.plans[u].points }, offers: [], pitches: { ...rs.plans[u].pitches } } : { points: {}, offers: [] }])));
  const [err, setErr] = useState<string | null>(null);
  const byId = useMemo(() => new Map(rs.prospects.map((p) => [p.id, p])), [rs]);
  const plan = plans[team] ?? { points: {}, offers: [] };
  const R = rulesOf(d);
  const open = rs.week < R.weeks;
  const pipes = useMemo(() => ({ pipelines: new Map([[team, new Set(pipelineStates(d, team).map((x) => x.state))]]) }), [d, team]);
  // Committed prospects leave the board.
  const board = Object.keys(plan.points).map(Number).map((id) => byId.get(id)!).filter((p) => p && p.committed === null);
  const spent = board.reduce((a, p) => a + costOf(d, pipes, p, team, plan.points[p.id] ?? 0), 0);
  const scoutSpent = rs.scoutSpent?.[team] ?? 0;
  const left = R.userPoints - spent - scoutSpent;
  const commits = rs.prospects.filter((p) => p.committed === team);
  const spots = rs.spots[team] ?? 0;
  // Offers out, this week's new ones included, against the cap (open spots plus the rules' extra).
  const offers = offersOut(rs, team) + newOffers(rs, team, plan).length;
  const cap = offerCap(R, rs, team);

  const setPlan = (f: (p: TeamPlan) => TeamPlan) => {
    setErr(null);
    setPlans((all) => ({ ...all, [team]: f(all[team] ?? { points: {}, offers: [] }) }));
  };
  const hub: Hub = {
    team, plan, pipes, left, open, busy: !!busy, capped: offers >= cap, cap, full: Object.keys(plan.points).length >= R.boardSize,
    add: (id) => setPlan((p) => (Object.keys(p.points).length >= R.boardSize ? p : { ...p, points: { ...p.points, [id]: 0 } })),
    remove: (id) => setPlan((p) => { const points = { ...p.points }; delete points[id]; const pitches = { ...p.pitches }; delete pitches[id]; return { ...p, points, pitches }; }),
    setPoints: (id, v) => setPlan((p) => ({ ...p, points: { ...p.points, [id]: Math.max(0, Math.min(R.maxPerProspect, Math.round(v) || 0)) } })),
    setPitch: (id, k) => setPlan((p) => { const pitches = { ...p.pitches }; if (k) pitches[id] = k; else delete pitches[id]; return { ...p, pitches }; }),
    offer: (id) => setPlan((p) => ({ ...p, offers: p.offers.includes(id) ? p.offers : [...p.offers, id] })),
    withdraw: (id) => {
      setPlan((p) => ({ ...p, offers: p.offers.filter((x) => x !== id) }));
      if (byId.get(id)?.offers.includes(team)) void actions.run('Withdrawing the offer…', async () => actions.commit(withdrawOffer(d, team, id)));
    },
    scout: (id, level) => void actions.run('Scouting…', async () => actions.commit(scoutProspect(d, team, id, level, spent))),
  };

  const runWeek = () => {
    // Points only for prospects still open; a user plan sends its new offers once.
    const send = Object.fromEntries(users.map((u) => {
      const p = plans[u] ?? { points: {}, offers: [] };
      const points = Object.fromEntries(Object.entries(p.points).filter(([id]) => byId.get(Number(id))?.committed === null));
      const pitches = Object.fromEntries(Object.entries(p.pitches ?? {}).filter(([id]) => id in points));
      return [u, { points, offers: p.offers, pitches }];
    }));
    const ctx = weekContext(d, rs);
    const bad = users.flatMap((u) => planProblems(R, send[u], rs.scoutSpent?.[u] ?? 0, planCost(d, ctx, rs, u, send[u])).map((m) => `${d.teams[u].school}: ${m}`));
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

  const color = mainColor(d, team);
  return (
    <>
      <div className="dy-hub-band" style={{ background: color, color: onColor(color) }}>
        <div className="dy-hub-title">
          <h3>Recruiting</h3>
          <p>{open ? `Week ${rs.week + 1} of ${R.weeks}. Points reset every week.` : 'The weeks are over. Signing day settles the rest.'}</p>
        </div>
        <dl className="dy-hub-stats">
          {open && <div><dt>Points left</dt><dd className={left < 0 ? 'dy-hub-over' : undefined}>{left}<small> of {R.userPoints.toLocaleString('en-US')}</small></dd></div>}
          {open && <div><dt>On board</dt><dd>{board.length}<small> of {R.boardSize}</small></dd></div>}
          <div><dt>Commits</dt><dd>{commits.length}<small> of {spots} spots</small></dd></div>
          {open && <div><dt>Offers out</dt><dd className={offers > cap ? 'dy-hub-over' : undefined}>{offers}<small> of {cap}</small></dd></div>}
        </dl>
        {open
          ? <Button disabled={!!busy} onClick={runWeek}>{rs.week + 1 >= R.weeks ? 'Run the last week' : `Advance to week ${rs.week + 2}`}</Button>
          : <Button disabled={!!busy} onClick={() => actions.run('Signing day…', async () => actions.commit(finishRecruiting(d, await getTemplates(d))))}>Signing day</Button>}
      </div>
      {users.length > 1 && (
        <div className="dy-row dy-hub-teams">
          {users.map((u) => <Button key={u} variant={u === team ? 'primary' : 'quiet'} onClick={() => setTeam(u)}>{d.teams[u].school}</Button>)}
        </div>
      )}
      {err && <Note kind="error">{err}</Note>}
      <Tabs label="Recruiting sections" value={tab} onChange={setTab} tabs={[
        { value: 'board', label: 'Board', count: open ? board.length : undefined }, { value: 'prospects', label: 'Prospects' }, { value: 'portal', label: 'Transfer portal' },
        { value: 'school', label: 'My school' }, { value: 'classes', label: 'Top classes' },
      ]} />
      {tab === 'board' && <BoardTab hub={hub} board={board} commits={commits} toProspects={() => setTab('prospects')} />}
      {(tab === 'prospects' || tab === 'portal') && <ProspectsTab key={tab} hub={hub} portal={tab === 'portal'} />}
      {tab === 'school' && <SchoolTab team={team} />}
      {tab === 'classes' && <ClassesTab team={team} />}
      <div className="dy-row dy-hub-sim">
        {open && <Button variant="quiet" disabled={!!busy} onClick={() => sim(1)}>Sim week {rs.week + 1}</Button>}
        {open && rs.week + 1 < R.weeks && <Button variant="quiet" disabled={!!busy} onClick={() => sim(R.weeks)}>Sim the rest of recruiting</Button>}
        <SimOffseason actions={actions} busy={busy} />
      </div>
      {open && <p className="dy-small dy-dim">Simming lets the computer recruit for {users.length > 1 ? 'your teams' : d.teams[team].school} that week, as for every other team (your board isn't used).</p>}
    </>
  );
}

/** A list at the left and the chosen prospect's card at the right; on a phone one of the two. */
function Split({ list, card, shown, onBack }: { list: ReactNode; card: ReactNode; shown: boolean; onBack: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // On a phone the card replaces the list: bring its top into view.
  useEffect(() => {
    if (shown && window.matchMedia('(max-width: 999px)').matches) ref.current?.scrollIntoView({ block: 'start' });
  }, [shown]);
  return (
    <div className="dy-split" data-card={shown ? '1' : '0'} ref={ref}>
      <div className="dy-split-list">{list}</div>
      <div className="dy-split-card">
        <div className="dy-split-back"><Button variant="quiet" onClick={onBack}>Back to the list</Button></div>
        {card}
      </div>
    </div>
  );
}

function BoardTab({ hub, board, commits, toProspects }: { hub: Hub; board: Prospect[]; commits: Prospect[]; toProspects: () => void }) {
  const { d } = useDyn();
  const rs = d.offseason!.recruiting!;
  const R = rulesOf(d);
  const { team, plan } = hub;
  const [sort, setSort] = useState('interest');
  const [sel, setSel] = useState<number | null>(null);
  const [shown, setShown] = useState(false);
  const byId = new Map(rs.prospects.map((p) => [p.id, p]));
  const rank = (p: Prospect) => interestRanking(p).findIndex((x) => x.team === team);
  const rows = board.slice().sort((a, b) =>
    sort === 'stars' ? b.stars - a.stars || share(R, b, team) - share(R, a, team)
      : sort === 'pos' ? POSITIONS.indexOf(a.player.pos) - POSITIONS.indexOf(b.player.pos) || b.stars - a.stars
        : sort === 'points' ? (plan.points[b.id] ?? 0) - (plan.points[a.id] ?? 0)
          : share(R, b, team) - share(R, a, team));
  const cur = rows.find((p) => p.id === sel) ?? rows[0];
  const thisWeek = rs.log.filter((l) => l.week === rs.week && (l.team === team || l.flipFrom === team));
  const pick = (id: number) => { setSel(id); setShown(true); };
  return (
    <>
      {rs.week > 0 && (
        <Note kind={thisWeek.some((l) => l.team === team) ? 'ok' : 'info'}>
          Week {rs.week}: {thisWeek.length === 0 ? 'nobody committed to you.' : thisWeek.map((l) => {
            const p = byId.get(l.prospect)!;
            return `${playerName(p.player)} (${starText(p.stars)} ${p.player.pos}) ${l.flipFrom === team ? `flipped to ${d.teams[l.team].school}` : l.flipFrom !== undefined ? `flipped to you from ${d.teams[l.flipFrom].school}` : 'committed to you'}`;
          }).join('; ') + '.'} {rs.log.filter((l) => l.week === rs.week).length} commitments across the country.
        </Note>
      )}
      {hub.open && (rows.length === 0
        ? <Empty><p>Your board is empty. Find prospects to recruit, then set their points and pitches here.</p><Button onClick={toProspects}>Find prospects</Button></Empty>
        : (
          <Split shown={shown} onBack={() => setShown(false)}
            list={(
              <>
                <div className="dy-list-head">
                  <SubHead>Your board</SubHead>
                  <Select label="Sort" value={sort} onChange={setSort} options={[{ value: 'interest', label: 'Interest in you' }, { value: 'stars', label: 'Stars' }, { value: 'pos', label: 'Position' }, { value: 'points', label: 'Points this week' }]} />
                </div>
                <Table className="dy-board-table">
                  <thead><tr><th className="ui-left">Prospect</th><th className="ui-left">Pos</th><th className="dy-wide">Stars</th><th className="ui-left dy-wide">From</th><th className="ui-left">You</th><th className="ui-left dy-col-meter">Interest in you</th><th className="ui-left dy-wide">Pitch</th><th>Points</th></tr></thead>
                  <tbody>
                    {rows.map((p) => {
                      const i = rank(p);
                      const pitch = plan.pitches?.[p.id];
                      const x = pitch ? rs.reactions?.[team]?.[p.id]?.[pitch] : undefined;
                      const offered = p.offers.includes(team) || plan.offers.includes(p.id);
                      return (
                        <tr key={p.id} className={cur?.id === p.id ? 'ui-row-mine' : undefined}>
                          <td className="ui-left"><Button variant="link" strong onClick={() => pick(p.id)}>{playerName(p.player)}</Button>{offered && <span className="dy-chip">Offered</span>}{p.id > 0 && <span className="dy-chip">Transfer</span>}</td>
                          <td className="ui-left">{p.player.pos}</td>
                          <td className="dy-wide">{p.stars}</td>
                          <td className="ui-left dy-wide">{stateCode(p.player.state) || '-'}</td>
                          <td className="ui-left">{i < 0 ? '-' : ordinal(i + 1)}</td>
                          <td className="ui-left dy-col-meter"><span className="dy-meter-cell"><Meter value={share(R, p, team)} label={`${playerName(p.player)}'s interest in you`} /><span>{pct(share(R, p, team))}</span></span></td>
                          <td className="ui-left dy-wide">{pitch ? `${PITCH[pitch]}${x ? ` ${REACT[x].mark}` : ''}` : <span className="dy-dim">No pitch</span>}</td>
                          <td className="ui-num">{plan.points[p.id] ?? 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
                <p className="dy-small dy-dim">Pick a prospect to set his points and pitch. The interest bar is full when he has enough to commit.</p>
              </>
            )}
            card={cur ? <ProspectCard p={cur} hub={hub} /> : null}
          />
        ))}
      {commits.length > 0 && (
        <>
          <SubHead>Committed to you</SubHead>
          <ul className="dy-commit-list">
            {commits.slice().sort((a, b) => b.stars - a.stars).map((p) => (
              <li key={p.id}><Headshot p={p.player} size={40} plain /><span><span className="dy-strong">{playerName(p.player)}</span><br /><span className="dy-small dy-dim">{starText(p.stars)} {p.player.pos}{p.from !== null ? `, transfer from ${d.teams[p.from].school}` : `, ${hometownText(p.player)}`}</span></span><span className="dy-ovr">{ovrText(p, scoutLevel(rs, team, p))}</span></li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

/** A prospect's card: who he is, his top schools, this week's points and pitch, what's known, scouting. */
function ProspectCard({ p, hub }: { p: Prospect; hub: Hub }) {
  const { d, dark } = useDyn();
  const rs = d.offseason!.recruiting!;
  const R = rulesOf(d);
  const { team, plan } = hub;
  const lv = scoutLevel(rs, team, p);
  const onBoard = p.id in plan.points;
  const offered = p.offers.includes(team) || plan.offers.includes(p.id);
  const top = interestRanking(p).slice(0, 5);
  const got = rs.reactions?.[team]?.[p.id] ?? {};
  const tag = discountTag(d, hub.pipes, p, team);
  const need = needsOf(d, rs, team).find((n) => n.pos === p.player.pos)?.need ?? 0;
  const pts = plan.points[p.id] ?? 0;
  const cost = costOf(d, hub.pipes, p, team, pts);
  const color = inkColor(d, team, dark);
  const longShot = reach(p.stars, prestigeStars(d, team)) < 0.75;
  return (
    <section className="dy-card" aria-label={playerName(p.player)}>
      <div className="dy-card-head">
        <Headshot p={p.player} size={84} plain />
        <div className="dy-card-who">
          <h4>{playerName(p.player)}</h4>
          <p>{p.player.pos}, {p.stars} {p.stars === 1 ? 'star' : 'stars'}. {heightText(p.player.heightIn)}, {p.player.weight} lb</p>
          <p className="dy-dim">{p.from === team ? 'Left your team for the transfer portal' : `${p.from !== null ? `Transfer from ${d.teams[p.from].school}. ` : ''}${hometownText(p.player)}`}</p>
        </div>
        <div className="dy-card-ovr"><span>OVR</span><b title={lv >= 1 ? undefined : 'Not scouted'}>{lv >= 1 ? p.player.ovr : '?'}</b></div>
      </div>
      <p className="dy-chips">
        {tag && <span className="dy-chip">{tag}</span>}
        {need > 0 && <span className="dy-chip">Need at {p.player.pos}</span>}
        {longShot && <span className="dy-chip">A long shot for a {prestigeStars(d, team)}-star program</span>}
        {offered && <span className="dy-chip dy-chip-on">Offered</span>}
        {p.committed !== null && <span className="dy-chip dy-chip-on">{p.committed === team ? 'Committed to you' : `Committed to ${d.teams[p.committed].school}`}</span>}
      </p>

      <div className="dy-card-part">
        <h5>Top schools</h5>
        {top.length === 0 ? <p className="dy-dim">No school has his interest yet.</p> : (
          <div className="dy-schools">
            {top.map((x, i) => (
              <div key={x.team} className={x.team === team ? 'dy-strong' : undefined}>
                <span>{i + 1}</span><span>{d.teams[x.team].school}</span>
                <Meter value={share(R, p, x.team)} label={`Interest in ${d.teams[x.team].school}`} color={x.team === team ? color : undefined} />
                <span className="dy-schools-n">{pct(share(R, p, x.team))}</span>
              </div>
            ))}
          </div>
        )}
        <p className="dy-small dy-dim">{standingOnly(p, team, d)}. A full bar is enough to commit{p.stars >= 4 && rs.week + 1 < R.firstWeek[p.stars] ? `; he won't decide before week ${R.firstWeek[p.stars] - (p.id > 0 ? 1 : 0)}` : ''}.</p>
      </div>

      {hub.open && onBoard && p.committed === null && (
        <div className="dy-card-part">
          <h5>This week</h5>
          <div className="dy-week">
            <div>
              <label htmlFor={`pts-${p.id}`}>Points, up to {R.maxPerProspect}</label>
              <div className="dy-stepper">
                <button type="button" aria-label="10 fewer points" onClick={() => hub.setPoints(p.id, pts - 10)}>-</button>
                <input id={`pts-${p.id}`} type="number" inputMode="numeric" min={0} max={R.maxPerProspect} step={10} value={pts} onChange={(e) => hub.setPoints(p.id, Number(e.target.value))} />
                <button type="button" aria-label="10 more points" onClick={() => hub.setPoints(p.id, pts + 10)}>+</button>
              </div>
              {cost !== pts && <p className="dy-small">Costs <b>{cost}</b> ({tag.toLowerCase()})</p>}
            </div>
            <Select label="Pitch" value={plan.pitches?.[p.id] ?? ''} onChange={(v) => hub.setPitch(p.id, v as PitchKey | '')}
              options={[{ value: '', label: 'No pitch' }, ...PITCHES.map((k) => ({ value: k, label: `${PITCH[k]}${got[k] ? ` (${REACT[got[k]!].mark})` : ''}` }))]} />
          </div>
        </div>
      )}

      <div className="dy-card-part">
        <h5>What you have learned about him</h5>
        {Object.keys(got).length === 0
          ? <p className="dy-dim">Nothing yet. Pitch something and he reacts after the week.</p>
          : (
            <ul className="dy-learned">
              {PITCHES.filter((k) => got[k]).map((k) => {
                const x = REACT[got[k]!];
                const r = got[k] === 'no' ? 0 : interestRank(R, p, k);
                return <li key={k} className={x.cls}><b>{x.mark}</b> {PITCH[k]}: {r === 1 ? 'his main interest, ' : r > 1 ? 'a minor interest, ' : ''}{r ? x.text.replace(/^interested,? (and |but )?/, '') : x.text}</li>;
              })}
              {PITCHES.some((k) => !got[k]) && <li className="dy-learned-open">Not tried: {PITCHES.filter((k) => !got[k]).map((k) => PITCH[k]).join(', ')}</li>}
            </ul>
          )}
      </div>

      <div className="dy-card-part">
        <h5>Scouting</h5>
        {lv >= 2 ? <RatingsLine p={p} /> : <p>{p.id > 0 ? '' : lv === 1 ? 'His overall is known. His ratings are hidden.' : 'Nothing known yet.'}</p>}
        {hub.open && lv < 2 && <div className="dy-row"><ScoutButtons p={p} team={team} lv={lv} left={hub.left} onScout={hub.scout} /></div>}
      </div>

      {p.committed === null && (hub.open || offered) && (
        <div className="dy-card-part dy-row">
          {hub.open && !onBoard && <Button disabled={hub.full} onClick={() => hub.add(p.id)} title={hub.full ? `Your board is full (${R.boardSize})` : undefined}>Add to board</Button>}
          {hub.open && onBoard && !offered && <Button disabled={hub.capped} onClick={() => hub.offer(p.id)} title={hub.capped ? `You can have ${hub.cap} offers out at one time. Withdraw one first.` : undefined}>Offer a scholarship</Button>}
          {offered && <Button variant="quiet" disabled={hub.busy} onClick={() => hub.withdraw(p.id)}>Withdraw offer</Button>}
          {hub.open && onBoard && !offered && hub.capped && <p className="dy-small dy-dim">You can have {hub.cap} offers out at one time. Withdraw one to offer him.</p>}
          {hub.open && onBoard && <Button variant="quiet" onClick={() => hub.remove(p.id)}>Remove from board</Button>}
        </div>
      )}
    </section>
  );
}

function ProspectsTab({ hub, portal }: { hub: Hub; portal: boolean }) {
  const { d } = useDyn();
  const rs = d.offseason!.recruiting!;
  const R = rulesOf(d);
  const { team, plan } = hub;
  const [q, setQ] = useState('');
  const [pos, setPos] = useState('');
  const [minStars, setMinStars] = useState('0');
  const [kind, setKind] = useState('all');
  const [state, setState] = useState('');
  const [sort, setSort] = useState('stars');
  const [hide, setHide] = useState(true);
  const [count, setCount] = useState(30);
  const [sel, setSel] = useState<number | null>(null);
  const [shown, setShown] = useState(false);
  const school = d.teams[team].school;
  const pipeSet = hub.pipes.pipelines.get(team)!;
  const states = useMemo(() => [...new Set(rs.prospects.map((p) => stateCode(p.player.state)).filter(Boolean))].sort(), [rs]);
  const needs = useMemo(() => needsOf(d, rs, team), [d, rs, team]);
  const onBoard = (p: Prospect) => p.id in plan.points;
  // Sorting by OVR or a rating only uses what's known (scouted; portal players fully): the rest go last.
  const key = (p: Prospect): number => {
    const lv = scoutLevel(rs, team, p);
    if (sort === 'stars') return p.stars * 1000 + (lv >= 1 ? p.player.ovr : -1);
    if (sort === 'ovr') return knownOvr(rs, team, p);
    if (sort === 'interest') return share(R, p, team);
    return lv >= 2 ? shownOf(p.player.ratings[sort as Attr] ?? 0) : -1;
  };
  const text = q.trim().toLowerCase();
  const list = rs.prospects
    .filter((p) => p.committed === null && (portal ? p.id > 0 : true) && (!hide || !onBoard(p)) && (!pos || p.player.pos === pos) && p.stars >= Number(minStars) &&
      (portal || kind === 'all' || (kind === 'hs' && p.id < 0) || (kind === 'portal' && p.id > 0) || (kind === 'near' && closeness(p.player.state, school) >= 0.6)) &&
      (!state || (state === 'pipeline' ? pipeSet.has(stateCode(p.player.state)) : state === 'home' ? pointCost(d, hub.pipes, p, team) < 1 : stateCode(p.player.state) === state)) &&
      (!text || `${playerName(p.player)} ${hometownText(p.player)}`.toLowerCase().includes(text)))
    .sort((a, b) => key(b) - key(a) || b.stars - a.stars || a.player.last.localeCompare(b.player.last));
  const cur = list.find((p) => p.id === sel) ?? rs.prospects.find((p) => p.id === sel) ?? list[0];
  const reset = <T,>(f: (v: T) => void) => (v: T) => { f(v); setCount(30); };
  return (
    <>
      <Split shown={shown} onBack={() => setShown(false)}
        list={(
          <>
      <SubHead>Team needs</SubHead>
      <p className="dy-small dy-dim">Open spots by position, against two players for each Active Roster spot. Pick a position to filter the list.</p>
      <div className="dy-needs-strip">
        {needs.map((n) => (
          <button key={n.pos} type="button" aria-pressed={pos === n.pos} className={n.need ? 'dy-need-open' : undefined} onClick={() => reset(setPos)(pos === n.pos ? '' : n.pos)}>
            <b>{n.pos}</b><span className="dy-need-n">{n.need}</span><small>{n.need ? 'open' : 'covered'}</small>
          </button>
        ))}
      </div>
            <div className="dy-filters2">
              <Field label="Search" type="search" value={q} placeholder="Name or hometown" onChange={reset(setQ)} />
              <Select label="Position" value={pos} onChange={reset(setPos)} options={[{ value: '', label: 'All positions' }, ...POSITIONS.map((x) => ({ value: x, label: x }))]} />
              <Select label="Stars" value={minStars} onChange={reset(setMinStars)} options={[{ value: '0', label: 'Any' }, ...[5, 4, 3, 2].map((x) => ({ value: String(x), label: `${x} and up` }))]} />
              {!portal && <Select label="From" value={kind} onChange={reset(setKind)} options={[{ value: 'all', label: 'High school and portal' }, { value: 'hs', label: 'High school' }, { value: 'portal', label: 'Transfer portal' }, { value: 'near', label: `Close to ${school}` }]} />}
              <Select label="State" value={state} onChange={reset(setState)} options={[{ value: '', label: 'All states' }, { value: 'home', label: 'In state and pipelines' }, { value: 'pipeline', label: 'Your pipeline states' }, ...states.map((x) => ({ value: x, label: `${x}${pipeSet.has(x) ? ' (pipeline)' : ''}` }))]} />
              <Select label="Sort" value={sort} onChange={reset(setSort)} options={[{ value: 'stars', label: 'Stars' }, { value: 'interest', label: 'Interest in you' }, { value: 'ovr', label: 'OVR (known)' }, ...SORT_RATINGS.map((a) => ({ value: a, label: `${a} (scouted)` }))]} />
              <label className="dy-check"><input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} /> Hide prospects on my board</label>
            </div>
            <p className="dy-small dy-dim">{list.length.toLocaleString('en-US')} uncommitted {portal ? 'portal players' : 'prospects'}.{hub.full ? ` Your board is full (${R.boardSize}).` : ''}</p>
            <Table className="dy-prospect-table">
              <thead><tr><th className="ui-left">Prospect</th><th className="ui-left">Pos</th><th>Stars</th><th className="ui-left dy-wide">{portal ? 'Left' : 'Hometown'}</th><th>OVR</th><th className="ui-left dy-wide">Leader</th><th /></tr></thead>
              <tbody>
                {list.slice(0, count).map((p) => {
                  const lead = interestRanking(p)[0];
                  const tag = discountTag(d, hub.pipes, p, team);
                  return (
                    <tr key={p.id} className={cur?.id === p.id ? 'ui-row-mine' : undefined}>
                      <td className="ui-left"><Button variant="link" strong onClick={() => { setSel(p.id); setShown(true); }}>{playerName(p.player)}</Button>{!portal && p.id > 0 && <span className="dy-chip">Transfer</span>}</td>
                      <td className="ui-left">{p.player.pos}</td>
                      <td>{p.stars}</td>
                      <td className="ui-left dy-wide">{portal && p.from !== null ? d.teams[p.from].school : hometownText(p.player)}{tag && <span className="dy-small dy-dim"> {tag.split(',')[0]}</span>}</td>
                      <td className="ui-num">{ovrText(p, scoutLevel(rs, team, p)) || '?'}</td>
                      <td className="ui-left dy-wide">{lead ? (lead.team === team ? <b>You</b> : d.teams[lead.team].school) : <span className="dy-dim">Open</span>}</td>
                      <td>{onBoard(p) ? <span className="dy-small dy-dim">On board</span> : hub.open && <Button variant="quiet" disabled={hub.full} onClick={() => hub.add(p.id)} label={`Add ${playerName(p.player)} to your board`}>Add</Button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            {list.length === 0 && <p className="dy-dim">No prospect matches these filters.</p>}
            {list.length > count && <Button variant="quiet" onClick={() => setCount(count + 30)}>Show 30 more</Button>}
          </>
        )}
        card={cur ? <ProspectCard p={cur} hub={hub} /> : null}
      />
    </>
  );
}

/** OVR for sorting: only what the team knows (unscouted last). */
const knownOvr = (rs: RecruitingState, team: number, p: Prospect) => (scoutLevel(rs, team, p) >= 1 ? p.player.ovr : -1);

/**
 * What the user's school can pitch and how it stands (user, 2026-11-12: "User needs to see what his
 * pipeline states are when recruiting"; "a breakdown of our needs by position"), and the week's rules.
 */
function SchoolTab({ team }: { team: number }) {
  const { d } = useDyn();
  const rs = d.offseason!.recruiting!;
  const R = rulesOf(d);
  const ctx = useMemo(() => weekContext(d, rs), [d, rs]);
  const school = d.teams[team].school;
  const pipes = pipelineStates(d, team).filter((x) => x.state !== SCHOOL_STATE[school]);
  const place = (score: (t: number) => number) => 1 + d.teams.filter((t) => score(t.index) > score(team)).length;
  const needs = needsOf(d, rs, team);
  const openPos = needs.filter((n) => n.need > 0).map((n) => n.pos);
  const pitches: { name: string; v: number | null; fig: string; why: string }[] = [
    { name: PITCH.pt, v: null, fig: '', why: `Depends on the position: a prospect who would start hears it best. ${openPos.length ? `Open spots at ${openPos.join(', ')}.` : 'No open spots right now.'}` },
    { name: PITCH.home, v: null, fig: '', why: `Counts for prospects from ${SCHOOL_STATE[school] ?? 'your state'} and nearby states. It doesn't depend on your school.` },
    { name: PITCH.prestige, v: ctx.prestige.get(team)!, fig: `${prestigeStars(d, team)} stars, ${ordinal(place((t) => ctx.prestige.get(t)!))}`, why: 'Moves slowly with your results over several seasons.' },
    { name: PITCH.contender, v: ctx.contender.get(team)!, fig: `${gradeOf(ctx.contender.get(team)!)}, ${ordinal(place((t) => ctx.contender.get(t)!))}`, why: 'Last season\'s final poll and the roster as it stands, commitments included.' },
    { name: PITCH.academics, v: academicsOf(school), fig: `${academicGrade(school)}, ${ordinal(place((t) => academicsOf(d.teams[t].school)))}`, why: 'Fixed for the school.' },
  ];
  const got = rs.reactions?.[team] ?? {};
  const landed = PITCHES.map((k) => {
    const c = { good: 0, ok: 0, bad: 0, no: 0 };
    for (const r of Object.values(got)) if (r[k]) c[r[k]!]++;
    return { k, ...c };
  });
  return (
    <div className="dy-school">
      <div>
        <SubHead>What you can pitch</SubHead>
        <p className="dy-small dy-dim">How strong each pitch is at {school}, with its place among the {d.teams.length} schools. A strong pitch only helps with a prospect who cares about it. Strong from {pct(R.pitchStrongAt)}, weak below {pct(R.pitchWeakBelow)}.</p>
        <div className="dy-pitches">
          {pitches.map((x) => (
            <div key={x.name}>
              <h5>{x.name}</h5>
              {x.v !== null ? <span className="dy-meter-cell"><Meter value={x.v} label={`${x.name} at ${school}`} /><span>{pct(x.v)}</span></span> : <span />}
              <span className="dy-pitch-fig">{x.fig}</span>
              <p className="dy-small dy-dim">{x.why}</p>
            </div>
          ))}
        </div>

        <SubHead>How your pitches have landed</SubHead>
        <Table figures>
          <thead><tr><th className="ui-left">Pitch</th><th title="His interest, and you're strong there">+</th><th title="His interest, you're in between">~</th><th title="His interest, but you're weak there">−</th><th title="Not his interest">✗</th></tr></thead>
          <tbody>{landed.map((x) => <tr key={x.k}><td className="ui-left">{PITCH[x.k]}</td><td>{x.good || ''}</td><td>{x.ok || ''}</td><td>{x.bad || ''}</td><td>{x.no || ''}</td></tr>)}</tbody>
        </Table>
        <p className="dy-small dy-dim">+ his interest and you're strong there, ~ in between, − his interest but you're weak there, ✗ not his interest.</p>

        <SubHead>Needs by position</SubHead>
        <Table figures className="dy-needs-table">
          <thead><tr><th className="ui-left">Pos</th><th title="Players returning">Back</th><th title="Players in the transfer portal">Portal</th><th title="Commitments">Commits</th><th title="Two for each Active Roster spot">Target</th><th>Need</th></tr></thead>
          <tbody>{needs.map((r) => <tr key={r.pos}><td className="ui-left">{r.pos}</td><td>{r.back}</td><td>{r.gone || ''}</td><td>{r.signed || ''}</td><td>{r.target}</td><td>{r.need || ''}</td></tr>)}</tbody>
        </Table>
      </div>
      <aside>
        <section className="dy-card dy-card-pad">
          <h4>Home ground</h4>
          <dl className="dy-facts">
            <dt>In state, {Math.round((1 - R.inStateCost) * 100)}% off</dt><dd>{SCHOOL_STATE[school] ?? '-'}</dd>
            <dt>Pipelines, {Math.round((1 - R.pipelineCost) * 100)}% off</dt><dd>{pipes.length ? pipes.map((x) => `${x.state} (${x.n})`).join(', ') : `None yet: ${R.pipelineMin} players from a state make one`}</dd>
          </dl>
        </section>
        <section className="dy-card dy-card-pad dy-card-plain">
          <h4>How a week works</h4>
          <ul className="dy-rules">
            <li>{R.userPoints.toLocaleString('en-US')} points a week, on up to {R.boardSize} prospects, {R.maxPerProspect} at most on one. In-state and pipeline prospects cost fewer points.</li>
            <li>Interest grows with points, more with an offer, and with how well your school fits what he wants. Prospects rated above your prestige are harder to reach.</li>
            <li>You can have your open spots plus {R.offerExtra} offers out at one time; offers to prospects who have committed don't count. You can withdraw an offer from a prospect who hasn't committed: without it he can't commit to you or pick you at signing day.</li>
            <li>One pitch per prospect a week. He has a main interest and {R.pitchInterests > 2 ? 'minor ones' : 'a minor one'}; after the week he reacts. A pitch he doesn't care about costs you a little.</li>
            <li>Scouting a high-school prospect costs {R.scoutOvr} points for his overall, {R.scoutRatings} more for every rating. Portal players show everything.</li>
            <li>He commits when one school that offered has enough interest and a clear lead (the best ones not before week {R.firstWeek[4]} or {R.firstWeek[5]}). At signing day the rest choose among the schools that offered.</li>
          </ul>
        </section>
      </aside>
    </div>
  );
}

/** Every team's class so far (commitments), by the class points the offseason uses; one team's commits beside it. */
function ClassesTab({ team }: { team: number }) {
  const { d } = useDyn();
  const rs = d.offseason!.recruiting!;
  const [sel, setSel] = useState(team);
  const [all, setAll] = useState(false);
  const rows = useMemo(() => d.teams.map((t) => {
    const c = rs.prospects.filter((p) => p.committed === t.index);
    const by = (s: number) => c.filter((p) => p.stars === s).length;
    return { t: t.index, n: c.length, s5: by(5), s4: by(4), s3: by(3), s2: by(2) + by(1), tr: c.filter((p) => p.id > 0).length, pts: c.reduce((a, p) => a + STAR_POINTS[p.stars], 0) };
  }).sort((a, b) => b.pts - a.pts || b.n - a.n || d.teams[a.t].school.localeCompare(d.teams[b.t].school)), [d, rs]);
  const place = (t: number) => rows.findIndex((r) => r.t === t) + 1;
  const list = all ? rows : rows.filter((r, i) => i < 25 || r.t === team || r.t === sel);
  const commits = rs.prospects.filter((p) => p.committed === sel).sort((a, b) => b.stars - a.stars || b.player.ovr - a.player.ovr);
  const leads = sel === team ? rs.prospects.filter((p) => p.committed === null && interestRanking(p)[0]?.team === team && p.offers.includes(team)) : [];
  const color = mainColor(d, sel);
  return (
    <div className="dy-split dy-split-both">
      <div className="dy-split-list">
        <SubHead>Classes so far</SubHead>
        <p className="dy-small dy-dim">Commitments only, ranked by class points ({[5, 4, 3, 2].map((s) => `${s} stars ${STAR_POINTS[s]}`).join(', ')}). Pick a school to see its class.</p>
        <Table figures>
          <thead><tr><th>Rank</th><th className="ui-left">School</th><th>Commits</th><th className="dy-wide">5★</th><th className="dy-wide">4★</th><th className="dy-wide">3★</th><th className="dy-wide">2★ or less</th><th className="dy-wide">Transfers</th><th>Points</th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.t} className={r.t === team ? 'ui-row-mine' : undefined}>
                <td>{place(r.t)}</td>
                <td className="ui-left"><Button variant="link" strong={r.t === sel} onClick={() => setSel(r.t)}>{d.teams[r.t].school}</Button></td>
                <td>{r.n}</td><td className="dy-wide">{r.s5 || ''}</td><td className="dy-wide">{r.s4 || ''}</td><td className="dy-wide">{r.s3 || ''}</td><td className="dy-wide">{r.s2 || ''}</td><td className="dy-wide">{r.tr || ''}</td><td>{r.pts}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        {!all && rows.length > list.length && <Button variant="quiet" onClick={() => setAll(true)}>Show all {rows.length} schools</Button>}
      </div>
      <div className="dy-split-card">
        <section className="dy-card" aria-label={`${d.teams[sel].school}'s class`}>
          <div className="dy-card-band" style={{ background: color, color: onColor(color) }}>
            <h4>{d.teams[sel].school}</h4>
            <p>{ordinal(place(sel))} of {rows.length}. {commits.length} of {rs.spots[sel] ?? 0} spots filled.</p>
          </div>
          {commits.length === 0 ? <p className="dy-card-pad dy-dim">No commitments yet.</p> : (
            <ul className="dy-commit-list dy-card-pad">
              {commits.map((p) => (
                <li key={p.id}><Headshot p={p.player} size={40} plain /><span><span className="dy-strong">{playerName(p.player)}</span><br /><span className="dy-small dy-dim">{starText(p.stars)} {p.player.pos}{p.from !== null ? `, transfer from ${d.teams[p.from].school}` : `, ${hometownText(p.player)}`}</span></span><span className="dy-ovr">{ovrText(p, scoutLevel(rs, team, p))}</span></li>
              ))}
            </ul>
          )}
          {leads.length > 0 && (
            <div className="dy-card-part">
              <h5>You lead for</h5>
              <ul className="dy-commit-list">
                {leads.sort((a, b) => b.stars - a.stars).map((p) => {
                  const r = interestRanking(p);
                  const R = rulesOf(d);
                  return <li key={p.id}><Headshot p={p.player} size={40} plain /><span><span className="dy-strong">{playerName(p.player)}</span><br /><span className="dy-small dy-dim">{starText(p.stars)} {p.player.pos}</span></span><span className="dy-small">{pct(share(R, p, team))}{r[1] ? `, ${d.teams[r[1].team].school} ${pct(share(R, p, r[1].team))}` : ''}</span></li>;
                })}
              </ul>
              <p className="dy-small dy-dim">Offered and ahead, not committed. A small lead can flip before signing day.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
