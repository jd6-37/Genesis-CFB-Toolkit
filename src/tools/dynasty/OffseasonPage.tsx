// The offseason, step by step: departures, the transfer portal, signing day, cuts, the next season.
import { Button, Note, PageHead, Steps, SubHead, Table, Tabs } from '../../ui';
import { useMemo, useState } from 'react';
import type { DPlayer, Dynasty, OffseasonEvent } from '../../core/dynasty/model';
import {
  applyCuts, cancelOffseason, classRankings, cutOrder, cutProblems, finishOffseason, recruitTemplates, runPortal, runSigningDay,
  seasonDone, startOffseason, suggestCuts, groupMins, ROSTER_LIMIT, type RecruitTemplates,
} from '../../core/dynasty/offseason';
import { openRecruiting } from '../../core/dynasty/recruiting';
import { rulesOf } from '../../core/dynasty/rules';
import { EVEN_TRAINING, TRAINING_AREAS, TRAINING_POINTS, trainingProblems, type Training } from '../../core/dynasty/training';
import { simCuts, simOffseason } from '../../core/dynasty/sim';
import { DEPTH_SLOTS, confirmDepth, projectedDepth, projectedProblems } from '../../core/dynasty/offseason';
import { slotPosition, teamDepth } from '../../core/dynasty/depth';
import { rosterLayout } from '../../core/rosterLayouts';
import { Recruiting } from './RecruitingPage';
import { playerName } from '../../core/dynasty/derive';
import { Headshot, TeamLink, hometownText, href, mainColor, onColor, useDyn } from './ui';
import { ScheduleEditor } from './SchedulePage';

export interface OffseasonActions {
  /** Saves the new dynasty (and shows errors). */
  commit: (d: Dynasty, done?: string) => Promise<void>;
  /** The ROM kept in this browser, or one the user picks now. */
  getRom: () => Promise<Uint8Array | null>;
  /** Runs a step with a busy note; errors show on the page. */
  run: (what: string, fn: () => Promise<void>) => Promise<void>;
  downloadRom: (year: number) => void;
}

/** The step whose results the page shows (the button below them runs the next one). */
/**
 * The offseason's steps, the new season's last three included (user, 2026-11-13: "I think the schedule
 * should be a proper step in the offseason, not a secondary button at the end"). The first five follow the
 * offseason state; the last three come once the new season is set up and can be visited in any order.
 */
const STEPS = ['Projected depth chart', 'Players leaving', 'Transfer portal', 'Signing day and cuts', 'Training', 'Training results', 'Depth chart', 'Schedule', 'Download the ROM'] as const;
const STEP_OF = { depth: 0, portal: 1, recruiting: 2, signing: 2, cuts: 3, ready: 5 } as const;
const FIRST_SEASON_STEP = 6;
const SEASON_STEPS = ['depth', 'schedule', 'rom'] as const;
type SeasonStep = typeof SEASON_STEPS[number];
const stepList = (full: boolean, links: boolean) => STEPS.map((label, i) => ({
  label: i === 2 && full ? 'Recruiting' : label,
  href: links && i >= FIRST_SEASON_STEP ? href(`offseason/${SEASON_STEPS[i - FIRST_SEASON_STEP]}`) : undefined,
}));

/** What new players are made from (the dynasty's own players). */
export const getTemplates = async (d: Dynasty): Promise<RecruitTemplates> => recruitTemplates(d);

const stars = (n: number) => (n ? `${n}★` : 'Walk-on');

/**
 * Sims the rest of the offseason for every team, yours included (it can't be undone once the next season is
 * set up, so it asks first).
 */
export function SimOffseason({ actions, busy }: { actions: OffseasonActions; busy: string | null }) {
  const { d } = useDyn();
  const [ask, setAsk] = useState(false);
  const year = (d.offseason?.year ?? d.seasons[d.seasons.length - 1].year) + 1;
  const mine = d.userTeams.length === 1 ? d.teams[d.userTeams[0]].school : 'your teams';
  if (!ask) return <Button variant="quiet" disabled={!!busy} onClick={() => setAsk(true)}>Sim the offseason</Button>;
  return (
    <div className="dy-sim-ask">
      <p>The computer plays the rest of the offseason for {mine} as for every other team: it recruits, makes the cuts and sets the depth charts. The {year} season is then ready to download, and this can't be undone.</p>
      <div className="dy-row">
        <Button disabled={!!busy} onClick={() => actions.run('Simming the offseason…', async () => {
          await actions.commit(simOffseason(d, await getTemplates(d)), `The ${year} season is ready. Download its ROM below.`);
          setAsk(false);
        })}>Sim to {year}</Button>
        <Button variant="quiet" onClick={() => setAsk(false)}>Cancel</Button>
      </div>
    </div>
  );
}

function PlayerList({ rows, note, limit = 8 }: { rows: { p: DPlayer; extra?: string }[]; note?: string; limit?: number }) {
  const [all, setAll] = useState(false);
  if (!rows.length) return <p className="dy-dim">{note ?? 'Nobody.'}</p>;
  const sorted = rows.slice().sort((a, b) => b.p.ovr - a.p.ovr);
  const shown = all ? sorted : sorted.slice(0, limit);
  return (
    <>
      <ul className="dy-plist">
        {shown.map(({ p, extra }) => (
          <li key={p.id}>
            <a href={href(`player/${p.id}`)}>{playerName(p)}</a>
            <span className="dy-dim">{p.pos}</span>
            <span className="dy-strong">{p.ovr}</span>
            {extra && <span className="dy-dim dy-small">{extra}</span>}
          </li>
        ))}
      </ul>
      {sorted.length > limit && (
        <button type="button" className="dy-linkbutton dy-small" onClick={() => setAll(!all)}>
          {all ? 'Show fewer' : `Show all ${sorted.length}`}
        </button>
      )}
    </>
  );
}

const trainingBad = (d: Dynasty) => d.userTeams.some((u) => trainingProblems(rulesOf(d), d.training?.[u] ?? EVEN_TRAINING).length > 0);

/**
 * Training focus (user, 2026-11-12): each of your teams splits 100 points over four areas before the
 * offseason, which shapes how its players develop. What each area affects is left unsaid here.
 */
function TrainingFocus({ actions, busy }: { actions: OffseasonActions; busy: string | null }) {
  const { d } = useDyn();
  const R = rulesOf(d);
  const set = (team: number, t: Training) => actions.commit({ ...d, training: { ...d.training, [team]: t } });
  return (
    <section className="dy-training">
      <h3>Training focus</h3>
      <p>Where your staff puts its time this offseason: {TRAINING_POINTS} points, at most {R.trainingMax} in one area. Even (25 each) is a balanced program. Returning players develop with the cuts, before the next season's depth charts.</p>
      {d.userTeams.map((u) => {
        const t = d.training?.[u] ?? EVEN_TRAINING;
        const total = TRAINING_AREAS.reduce((s, a) => s + t[a.key], 0);
        const problems = trainingProblems(R, t);
        return (
          <div key={u} className="dy-training-team">
            {d.userTeams.length > 1 && <h4><TeamLink team={u} /></h4>}
            {TRAINING_AREAS.map((a) => (
              <label key={a.key} className="dy-training-row">
                <span>{a.label}</span>
                <input type="range" min={0} max={R.trainingMax} step={1} value={t[a.key]} disabled={!!busy}
                  onChange={(e) => set(u, { ...t, [a.key]: Number(e.target.value) })} />
                <b>{t[a.key]}</b>
              </label>
            ))}
            <div className="dy-training-foot">
              <span className={total === TRAINING_POINTS ? '' : 'dy-training-off'}>{total} of {TRAINING_POINTS} points</span>
              <Button variant="quiet" disabled={!!busy} onClick={() => set(u, EVEN_TRAINING)}>Even</Button>
            </div>
            {problems.length > 0 && <Note kind="error">{problems.join(' ')}</Note>}
          </div>
        );
      })}
    </section>
  );
}

export function Offseason({ actions, busy, arg }: { actions: OffseasonActions; busy: string | null; arg?: string }) {
  const { d, v } = useDyn();
  const st = d.offseason;
  const season = d.seasons[d.seasons.length - 1];
  const pl = (id: number) => d.players[id - 1];
  const events = st?.events ?? [];
  const of = <K extends OffseasonEvent['kind']>(k: K) => events.filter((e) => e.kind === k) as Extract<OffseasonEvent, { kind: K }>[];
  const users = d.userTeams;

  if (!st) {
    const done = seasonDone(d);
    const startedNew = season.imports.length === 0 && d.seasons.length > 1;
    return (
      <section className={startedNew ? 'dy-off dy-off-wide' : 'dy-off'}>
        <PageHead title={startedNew ? `Offseason ${season.year - 1}` : 'Offseason'} />
        {startedNew ? <SeasonSteps actions={actions} step={(SEASON_STEPS as readonly string[]).includes(arg ?? '') ? (arg as SeasonStep) : 'depth'} /> : (
          <>
            <p>
              {done
                ? `The ${season.year} season is over. The offseason takes your dynasty to ${season.year + 1}: seniors leave, the transfer portal opens, every team signs a class and cuts to ${ROSTER_LIMIT}, and the returning players develop in offseason training.`
                : `The offseason starts once the ${season.year} season is over: import the save after the last game. ${v.save ? `So far ${v.games.filter((g) => g.vs !== null).length} of ${v.games.length} games are played.` : ''}`}
            </p>
            {users.length > 0 && <TrainingFocus actions={actions} busy={busy} />}
            <div className="dy-row">
              {done && (
                <Button disabled={!!busy} onClick={() => actions.run('Ending the season…', () => actions.commit(startOffseason(d)))}>Start the offseason</Button>
              )}
              {done && <SimOffseason actions={actions} busy={busy} />}
            </div>
          </>
        )}
      </section>
    );
  }

  const step = st.step === 'cuts' && st.cutsPicked ? 4 : STEP_OF[st.step];
  return (
    <section className={['recruiting', 'portal'].includes(st.step) || (st.step === 'cuts' && !st.cutsPicked) ? 'dy-off dy-off-wide' : 'dy-off'}>
      <PageHead title={`Offseason ${st.year}`} />
      <Steps label="Offseason steps" steps={stepList(st.mode === 'full', false)} current={step} />

      {st.step === 'depth' && <ProjectedDepth actions={actions} busy={busy} />}

      {/* What happened so far, newest step first */}
      {st.step === 'portal' && <Leaving actions={actions} busy={busy} />}

      {st.step === 'signing' && (
        <>
          <SubHead>Transfer portal</SubHead>
          {users.map((u) => (
            <div key={u} className="dy-off-team">
              <h4><TeamLink team={u} rank={false} /></h4>
              <p className="dy-small dy-dim">Leaving</p>
              <PlayerList rows={of('transfer').filter((e) => e.from === u).map((e) => ({ p: pl(e.player), extra: e.to !== null ? `to ${d.teams[e.to].school}` : 'out of the dynasty' }))} />
              <p className="dy-small dy-dim">Coming in</p>
              <PlayerList rows={of('transfer').filter((e) => e.to === u).map((e) => ({ p: pl(e.player), extra: `from ${d.teams[e.from].school}` }))} />
            </div>
          ))}
          <p>{of('transfer').length} players entered the portal; {of('transfer').filter((e) => e.to !== null).length} found a new team.</p>
          <h4>Biggest moves</h4>
          <PlayerList rows={of('transfer').filter((e) => e.to !== null).sort((a, b) => b.ovr - a.ovr).slice(0, 10).map((e) => ({ p: pl(e.player), extra: `${d.teams[e.from].school} to ${d.teams[e.to!].school}` }))} />
          <Next busy={busy} label="Signing day" onClick={() => actions.run('Signing the classes…', async () => actions.commit(runSigningDay(d, await getTemplates(d))))} />
          <div className="dy-row"><SimOffseason actions={actions} busy={busy} /></div>
        </>
      )}

      {st.step === 'recruiting' && <Recruiting actions={actions} busy={busy} />}

      {st.step === 'cuts' && (st.cutsPicked ? <TrainingStep actions={actions} busy={busy} /> : <SigningAndCuts actions={actions} busy={busy} />)}

      {st.step === 'ready' && (
        <>
          <SubHead>Cuts, walk-ons and training</SubHead>
          {users.map((u) => (
            <div key={u} className="dy-off-team">
              <h4><TeamLink team={u} rank={false} /></h4>
              <p className="dy-small dy-dim">Cut</p>
              <PlayerList rows={of('cut').filter((e) => e.team === u).map((e) => ({ p: pl(e.player) }))} />
              <p className="dy-small dy-dim">Walk-ons</p>
              <PlayerList rows={of('walkon').filter((e) => e.team === u).map((e) => ({ p: pl(e.player) }))} />
              <p className="dy-small dy-dim">Most improved in offseason training</p>
              <PlayerList rows={st.growth.filter((g) => pl(g.player).team === u).sort((a, b) => b.to - b.from - (a.to - a.from)).slice(0, 5).map((g) => ({ p: pl(g.player), extra: `${g.from} → ${g.to}` }))} />
              <p className="dy-small"><a href={href(`training/${u}-${st.year + 1}`)}>All training results</a></p>
            </div>
          ))}
          <p>
            Next: every team's depth chart for {st.year + 1} (its 32 players in Bill Walsh '95 and their backups, the best OVR at each spot, and the team OVRs). Then you can download
            the {st.year + 1} ROM.
          </p>
          <Next
            busy={busy}
            label={`Next: the ${st.year + 1} depth chart`}
            onClick={() => actions.run('Setting the depth charts…', async () => {
              await actions.commit(finishOffseason(d), `The ${st.year + 1} season is set up. Three steps are left: your depth chart, your schedule and the ROM.`);
            })}
          />
        </>
      )}

      <p className="dy-small dy-dim dy-restart">
        <button type="button" className="dy-linkbutton" onClick={() => actions.run('Starting over…', () => actions.commit(cancelOffseason(d)))}>Start the offseason over</button>
        {' '}(back to the end of the {st.year} season).
      </p>
    </section>
  );
}

function Next({ label, onClick, busy }: { label: string; onClick: () => void; busy: string | null }) {
  return <div className="dy-row dy-next"><Button disabled={!!busy} onClick={onClick}>{label}</Button></div>;
}

/** Which of the user's teams a step page shows (nothing for one team). */
function TeamSwitch({ team, onPick }: { team: number; onPick: (t: number) => void }) {
  const { d } = useDyn();
  if (d.userTeams.length < 2) return null;
  return <div className="dy-row dy-hub-teams">{d.userTeams.map((u) => <Button key={u} variant={u === team ? 'primary' : 'quiet'} onClick={() => onPick(u)}>{d.teams[u].school}</Button>)}</div>;
}

/**
 * Players leaving (user, 2026-11-13, the approved mockup): the counts on a band in the team's color, who
 * leaves and why, the starting spots they leave open with the next man up, and the training focus.
 * Transfers only enter the portal here: where they go is known at signing day.
 */
function Leaving({ actions, busy }: { actions: OffseasonActions; busy: string | null }) {
  const { d } = useDyn();
  const st = d.offseason!;
  const [team, setTeam] = useState(d.userTeams[0]);
  const [show, setShow] = useState<'all' | 'starters' | 'portal'>('all');
  const [all, setAll] = useState(false);
  const pl = (id: number) => d.players[id - 1];
  const of = (k: 'graduated' | 'pro' | 'returns') => st.events.filter((e): e is Extract<OffseasonEvent, { kind: 'graduated' | 'pro' | 'returns' }> => e.kind === k);
  const season = d.seasons[d.seasons.length - 1];
  const R = rulesOf(d);
  if (team === undefined) {
    return (
      <>
        <p>Across the country {of('graduated').length.toLocaleString('en-US')} players graduate, {of('pro').length} go pro, {(st.portal ?? []).length} enter the transfer portal and {of('returns').length} seniors come back as SR+.</p>
        <LeavingNext actions={actions} busy={busy} />
      </>
    );
  }
  const slots = season.slots[team] ?? [];
  const spotOf = (id: number) => { const i = slots.indexOf(id); return i < 0 ? '' : LAYOUT[i]?.label ?? ''; };
  const starter = (id: number) => { const s = spotOf(id); return !!s && !DEPTH_SLOTS.has(s); };
  const rows = [
    ...of('pro').filter((e) => e.team === team).map((e) => ({ p: pl(e.player), why: 'Going pro', portal: false })),
    ...of('graduated').filter((e) => e.team === team).map((e) => ({ p: pl(e.player), why: 'Graduating', portal: false })),
    ...(st.portal ?? []).map(pl).filter((p) => p.team === team).map((p) => ({ p, why: 'Entering the transfer portal', portal: true })),
  ].sort((a, b) => Number(starter(b.p.id)) - Number(starter(a.p.id)) || b.p.ovr - a.p.ovr);
  const gone = new Set(rows.map((r) => r.p.id));
  const back = of('returns').filter((e) => e.team === team).map((e) => pl(e.player));
  const list = rows.filter((r) => (show === 'starters' ? starter(r.p.id) : show === 'portal' ? r.portal : true));
  const stay = d.players.filter((p) => p.team === team && p.status === 'active' && !gone.has(p.id));
  const next = teamDepth(stay).slots;
  const holes = LAYOUT.map((def, i) => ({ label: def.label, was: slots[i] !== null && slots[i] !== undefined ? pl(slots[i]!) : undefined, now: next[i] !== null && pl(next[i]!).pos === slotPosition(def.label) ? pl(next[i]!) : undefined }))
    .filter((h) => !DEPTH_SLOTS.has(h.label) && h.was && gone.has(h.was.id));
  const color = mainColor(d, team);
  const n = (k: string) => rows.filter((r) => r.why.startsWith(k)).length;
  return (
    <>
      <div className="dy-hub-band" style={{ background: color, color: onColor(color) }}>
        <div className="dy-hub-title">
          <h3>Players leaving</h3>
          <p>{rows.length} {rows.length === 1 ? 'player is' : 'players are'} leaving {d.teams[team].school}.{back.length ? ` ${back.length} ${back.length === 1 ? 'senior comes' : 'seniors come'} back for a fifth year.` : ''}</p>
        </div>
        <dl className="dy-hub-stats">
          <div><dt>Graduating</dt><dd>{n('Graduating')}</dd></div>
          <div><dt>Going pro</dt><dd>{n('Going pro')}</dd></div>
          <div><dt>Into the portal</dt><dd>{n('Entering')}</dd></div>
          <div><dt>Starters lost</dt><dd>{holes.length}</dd></div>
        </dl>
        <Button disabled={!!busy} onClick={() => actions.run('Opening recruiting…', async () => actions.commit(openRecruiting(d, await getTemplates(d))))}>Recruit for {R.weeks} weeks</Button>
      </div>
      <TeamSwitch team={team} onPick={setTeam} />
      <div className="dy-school">
        <div>
          <Tabs label="Which players" value={show} onChange={(x) => { setShow(x); setAll(false); }} tabs={[
            { value: 'all', label: 'All', count: rows.length }, { value: 'starters', label: 'Starters', count: rows.filter((r) => starter(r.p.id)).length }, { value: 'portal', label: 'Transfer portal', count: rows.filter((r) => r.portal).length },
          ]} />
          {list.length === 0 ? <p className="dy-dim">Nobody.</p> : (
            <Table>
              <thead><tr><th className="ui-left">Player</th><th className="ui-left">Pos</th><th className="ui-left">Class</th><th className="ui-left dy-wide" title="His spot in last season's 32">Spot</th><th>OVR</th><th className="ui-left">Why</th></tr></thead>
              <tbody>
                {(all ? list : list.slice(0, 14)).map(({ p, why }) => (
                  <tr key={p.id}>
                    <td className="ui-left"><a className="dy-strong" href={href(`player/${p.id}`)}>{playerName(p)}</a></td>
                    <td className="ui-left">{p.pos}</td><td className="ui-left">{p.cls}</td>
                    <td className="ui-left dy-wide">{spotOf(p.id) ? <span className={starter(p.id) ? 'dy-strong' : undefined}>{starter(p.id) ? `Starter, ${spotOf(p.id)}` : spotOf(p.id)}</span> : <span className="dy-dim">Bench</span>}</td>
                    <td className="ui-num">{p.ovr}</td><td className="ui-left">{why}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {list.length > 14 && <Button variant="quiet" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${list.length}`}</Button>}
          {back.length > 0 && (
            <>
              <SubHead>Back for a fifth year</SubHead>
              <PlayerList rows={back.map((p) => ({ p, extra: 'SR+' }))} />
            </>
          )}
          <p className="dy-small dy-dim">Across the country {of('graduated').length.toLocaleString('en-US')} players graduate, {of('pro').length} go pro, {(st.portal ?? []).length} enter the transfer portal and {of('returns').length} seniors come back as SR+. Where the transfers go is decided in recruiting.</p>
        </div>
        <aside>
          <section className="dy-card">
            <div className="dy-card-pad"><h4>Holes this leaves</h4></div>
            {holes.length === 0 ? <p className="dy-card-pad dy-dim">Every starter is back.</p> : (
              <Table>
                <thead><tr><th className="ui-left">Spot</th><th className="ui-left">Next man up</th><th title="The starter who is leaving">Was</th><th>Now</th></tr></thead>
                <tbody>
                  {holes.map((h) => (
                    <tr key={h.label}>
                      <td className="ui-left dy-strong">{h.label}</td>
                      <td className="ui-left">{h.now ? <a href={href(`player/${h.now.id}`)}>{playerName(h.now)}</a> : <span className="dy-dim">Nobody yet</span>}{h.now && <span className="dy-small dy-dim"> {h.now.cls}</span>}</td>
                      <td className="ui-num dy-dim">{h.was!.ovr}</td><td className="ui-num">{h.now?.ovr ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <p className="dy-card-pad dy-small dy-dim">Last season's starter and the best player left at his spot. These are your needs in recruiting.</p>
          </section>
        </aside>
      </div>
      <LeavingNext actions={actions} busy={busy} second />
    </>
  );
}

/** The ways on from Players leaving: recruiting (the band has it too), random classes, or the sim. */
function LeavingNext({ actions, busy, second }: { actions: OffseasonActions; busy: string | null; second?: boolean }) {
  const { d } = useDyn();
  const weeks = rulesOf(d).weeks;
  return (
    <>
      <SubHead>Next</SubHead>
      <p>Recruit yourself for {weeks} weeks (high-school players and the transfer portal), or let every team sign a quick random class.</p>
      <div className="dy-row dy-next">
        <Button variant={second ? 'quiet' : 'primary'} disabled={!!busy} onClick={() => actions.run('Opening recruiting…', async () => actions.commit(openRecruiting(d, await getTemplates(d))))}>Recruit for {weeks} weeks</Button>
        <Button variant="quiet" disabled={!!busy} onClick={() => actions.run('Running the transfer portal…', () => actions.commit(runPortal(d)))}>Random classes</Button>
        <SimOffseason actions={actions} busy={busy} />
      </div>
    </>
  );
}

function SigningAndCuts({ actions, busy }: { actions: OffseasonActions; busy: string | null }) {
  const { d } = useDyn();
  const st = d.offseason!;
  const pl = (id: number) => d.players[id - 1];
  const ranks = classRankings(st.events);
  const signed = st.events.filter((e): e is Extract<OffseasonEvent, { kind: 'signed' }> => e.kind === 'signed');
  const moved = st.events.filter((e): e is Extract<OffseasonEvent, { kind: 'transfer' }> => e.kind === 'transfer');
  const [team, setTeam] = useState(d.userTeams[0]);
  const [cuts, setCuts] = useState<Record<number, number[]>>(() => ({ ...(st.suggestedCuts ?? {}) }));
  const [err, setErr] = useState<string | null>(null);
  const [allClass, setAllClass] = useState(false);
  const rosters = useMemo(
    () => Object.fromEntries(d.userTeams.map((u) => [u, cutOrder(d.players.filter((p) => p.team === u && p.status === 'active'), rulesOf(d))])),
    [d],
  );
  const toggle = (u: number, id: number) => {
    setErr(null);
    setCuts((c) => ({ ...c, [u]: (c[u] ?? []).includes(id) ? (c[u] ?? []).filter((x) => x !== id) : [...(c[u] ?? []), id] }));
  };
  const leftOf = (u: number) => rosters[u].order.length - ROSTER_LIMIT - (cuts[u] ?? []).length;
  const toCut = d.userTeams.reduce((a, u) => a + Math.max(0, leftOf(u)), 0);
  const go = () => {
    const bad = d.userTeams.flatMap((u) => cutProblems(d, u, cuts[u] ?? []).map((m) => `${d.teams[u].school}: ${m}`));
    if (bad.length) return setErr(bad.join(' '));
    // The picks are kept; the cuts are made together with the training, in the next step.
    void actions.run('Saving your cuts…', async () => actions.commit({ ...d, offseason: { ...st, suggestedCuts: { ...st.suggestedCuts, ...cuts }, cutsPicked: true } }));
  };
  const top = (
    <>
      <SubHead>Top classes</SubHead>
      <Table figures>
        <thead><tr><th>Rank</th><th className="ui-left">School</th><th>Signed</th><th>5★</th><th>4★</th><th>Points</th></tr></thead>
        <tbody>
          {ranks.filter((c, i) => i < 10 || d.userTeams.includes(c.team)).map((c) => {
            const mine = signed.filter((s) => s.team === c.team);
            return <tr key={c.team} className={d.userTeams.includes(c.team) ? 'ui-row-mine' : undefined}><td>{c.rank}</td><td className="ui-left"><TeamLink team={c.team} rank={false} /></td><td>{c.signed}</td><td>{mine.filter((s) => s.stars === 5).length || ''}</td><td>{mine.filter((s) => s.stars === 4).length || ''}</td><td>{c.points}</td></tr>;
          })}
        </tbody>
      </Table>
    </>
  );
  if (team === undefined) {
    return (
      <>
        {top}
        <Next busy={busy} label="Next: training" onClick={go} />
        <div className="dy-row"><SimOffseason actions={actions} busy={busy} /></div>
      </>
    );
  }
  const r = ranks.find((x) => x.team === team);
  const cls = [
    ...signed.filter((s) => s.team === team).map((s) => ({ p: pl(s.player), stars: s.stars, from: 'High school' })),
    ...moved.filter((e) => e.to === team).map((e) => ({ p: pl(e.player), stars: 0, from: `Transfer from ${d.teams[e.from].school}` })),
  ].sort((a, b) => b.p.ovr - a.p.ovr);
  const { order: roster, active } = rosters[team];
  const mine = cuts[team] ?? [];
  const over = roster.length - ROSTER_LIMIT;
  const left = over - mine.length;
  const missed = st.missed?.[team] ?? [];
  const color = mainColor(d, team);
  const pickRest = () => setCuts((c) => ({ ...c, [team]: [...mine, ...roster.filter((p) => !mine.includes(p.id) && !active.has(p.id)).slice(0, Math.max(0, left)).map((p) => p.id)] }));
  const ordinalPlace = (k: number) => `${k}${k % 100 >= 11 && k % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][k % 10] ?? 'th'}`;
  return (
    <>
      <div className="dy-hub-band" style={{ background: color, color: onColor(color) }}>
        <div className="dy-hub-title">
          <h3>Signing day</h3>
          <p>{cls.length} new {cls.length === 1 ? 'player' : 'players'} for {d.teams[team].school}.{missed.length ? ` ${missed.length} of your offers went elsewhere.` : ''}</p>
        </div>
        <dl className="dy-hub-stats">
          <div><dt>Class rank</dt><dd>{r?.rank ?? '-'}<small> of {d.teams.length}</small></dd></div>
          <div><dt>Signed</dt><dd>{signed.filter((s) => s.team === team).length}</dd></div>
          <div><dt>Transfers in</dt><dd>{moved.filter((e) => e.to === team).length}</dd></div>
          <div><dt>Cuts to make</dt><dd>{Math.max(0, left)}<small> of {Math.max(0, over)}</small></dd></div>
        </dl>
        <Button disabled={!!busy || toCut > 0} onClick={go} title={toCut > 0 ? 'Pick your cuts first' : undefined}>{toCut > 0 ? `Cut ${toCut} more to continue` : 'Next: training'}</Button>
      </div>
      <TeamSwitch team={team} onPick={setTeam} />
      {err && <Note kind="error">{err}</Note>}
      <div className="dy-school">
        <div>
          <SubHead>Your class</SubHead>
          {cls.length === 0 ? <p className="dy-dim">Nobody signed.</p> : (
            <Table>
              <thead><tr><th className="ui-left">Player</th><th className="ui-left">Pos</th><th>Stars</th><th className="ui-left dy-wide">Hometown</th><th className="ui-left dy-wide">From</th><th>OVR</th></tr></thead>
              <tbody>
                {(allClass ? cls : cls.slice(0, 12)).map(({ p, stars: s, from }) => (
                  <tr key={p.id}>
                    <td className="ui-left"><span className="dy-face-cell"><Headshot p={p} size={40} /><a className="dy-strong" href={href(`player/${p.id}`)}>{playerName(p)}</a></span></td>
                    <td className="ui-left">{p.pos}</td><td>{s || '-'}</td>
                    <td className="ui-left dy-wide">{hometownText(p)}</td><td className="ui-left dy-wide">{from}</td><td className="ui-num">{p.ovr}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {cls.length > 12 && <Button variant="quiet" onClick={() => setAllClass(!allClass)}>{allClass ? 'Show fewer' : `Show all ${cls.length}`}</Button>}
          {missed.length > 0 && (
            <>
              <SubHead>The ones that got away</SubHead>
              <Table>
                <thead><tr><th className="ui-left">Prospect</th><th className="ui-left">Pos</th><th>Stars</th><th className="ui-left">Signed with</th><th className="ui-left dy-wide">You finished</th></tr></thead>
                <tbody>
                  {missed.map((m) => (
                    <tr key={`${m.name}-${m.pos}`}>
                      <td className="ui-left dy-strong">{m.name}</td><td className="ui-left">{m.pos}</td><td>{m.stars}</td>
                      <td className="ui-left">{m.to !== null ? d.teams[m.to].school : <span className="dy-dim">Nobody</span>}</td>
                      <td className="ui-left dy-wide">{m.place ? ordinalPlace(m.place) : <span className="dy-dim">Not among his schools</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          )}
          {top}
        </div>
        <aside>
          <section className="dy-card">
            <div className="dy-card-pad">
              <h4>Roster cuts</h4>
              <p className={left > 0 ? 'dy-strong' : undefined}>
                {over <= 0 ? `${roster.length} players: no cuts needed.` : left > 0 ? `${roster.length} players, ${over} over the limit of ${ROSTER_LIMIT}. ${mine.length} picked, ${left} to go.` : left < 0 ? `${mine.length} picked, ${-left} more than needed: that's fine.` : `${mine.length} picked. Ready.`}
              </p>
              {over > 0 && <p className="dy-small dy-dim">The suggested cuts are checked already. Next season's starters (★) stay; backups go first by what they'll be worth when they could start. Keep at least {groupMins(rulesOf(d)).map((g) => `${g.min} ${g.name}`).join(', ')}.</p>}
            </div>
            {over > 0 && (
              <>
                <ul className="dy-cutlist">
                  {roster.map((p) => (
                    <li key={p.id}>
                      <label>
                        <input type="checkbox" checked={mine.includes(p.id)} onChange={() => toggle(team, p.id)} />
                        <span>{playerName(p)}{active.has(p.id) && <span className="dy-dim" title="Active Roster next season"> ★</span>}</span>
                        <span className="dy-dim">{p.pos}</span>
                        <span className="dy-dim">{p.cls}</span>
                        <span className="dy-ovr">{p.ovr}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="dy-card-pad dy-row">
                  <Button variant="quiet" disabled={left <= 0} onClick={pickRest}>Pick the rest for me</Button>
                  <Button variant="quiet" onClick={() => setCuts((c) => ({ ...c, [team]: suggestCuts(d, team) }))}>Back to the suggested cuts</Button>
                </div>
              </>
            )}
          </section>
        </aside>
      </div>
      <div className="dy-row dy-hub-sim">
        <Button variant="quiet" disabled={!!busy} onClick={() => actions.run('Making the cuts…', async () => actions.commit(simCuts(d, await getTemplates(d))))}>Sim the cuts</Button>
        <SimOffseason actions={actions} busy={busy} />
      </div>
    </>
  );
}

/**
 * Training (user, 2026-11-13, on cuts and training focus on one page: "I think these should probably be
 * separate steps, no?"): the training focus on its own page. The cuts picked in the step before are made
 * here, together with the training, so going back to change them is still possible.
 */
function TrainingStep({ actions, busy }: { actions: OffseasonActions; busy: string | null }) {
  const { d } = useDyn();
  const st = d.offseason!;
  const [err, setErr] = useState<string | null>(null);
  const n = d.userTeams.reduce((a, u) => a + (st.suggestedCuts?.[u] ?? []).length, 0);
  return (
    <>
      <TrainingFocus actions={actions} busy={busy} />
      {err && <Note kind="error">{err}</Note>}
      <div className="dy-row dy-next">
        <Button disabled={!!busy} onClick={() => {
          if (trainingBad(d)) return setErr('Use exactly 100 points.');
          void actions.run('Making the cuts and training…', async () => actions.commit(applyCuts(d, st.suggestedCuts ?? {}, await getTemplates(d))));
        }}>{n ? `Make the ${n} ${n === 1 ? 'cut' : 'cuts'} and train` : 'Train'}</Button>
        <Button variant="quiet" disabled={!!busy} onClick={() => actions.run('Back to the cuts…', async () => actions.commit({ ...d, offseason: { ...st, cutsPicked: false } }))}>Back to the cuts</Button>
      </div>
    </>
  );
}

/**
 * The new season's three steps (user, 2026-11-13: the schedule "should be a proper step in the offseason"):
 * the depth chart, the schedule, the ROM. The season is set up already, so they can be visited in any
 * order; each has a button to the next.
 */
function SeasonSteps({ actions, step }: { actions: OffseasonActions; step: SeasonStep }) {
  const { d } = useDyn();
  const season = d.seasons[d.seasons.length - 1];
  const [team, setTeam] = useState(d.userTeams[0]);
  const pl = (id: number) => d.players[id - 1];
  const steps = <Steps label="Offseason steps" steps={stepList(true, true)} current={FIRST_SEASON_STEP + SEASON_STEPS.indexOf(step)} />;
  if (step === 'depth') {
    const slots = team !== undefined ? season.slots[team] ?? [] : [];
    return (
      <>
        {steps}
        <SubHead>{season.year} depth chart</SubHead>
        {team === undefined ? <p>Every team's depth chart is set: the best OVR at each spot.</p> : (
          <>
            <p>The computer put the best OVR at each of {d.teams[team].school}'s 32 spots. Change it on your team's page (the Pos menus in the roster) if you want someone else to start.</p>
            <TeamSwitch team={team} onPick={setTeam} />
            <Table className="dy-depth-final">
              <thead><tr><th className="ui-left">Spot</th><th className="ui-left">Player</th><th className="ui-left">Class</th><th>OVR</th></tr></thead>
              <tbody>
                {LAYOUT.map((def, i) => {
                  const p = slots[i] !== null && slots[i] !== undefined ? pl(slots[i]!) : undefined;
                  return <tr key={def.label}><td className="ui-left dy-strong">{def.label}</td><td className="ui-left">{p ? <a href={href(`player/${p.id}`)}>{playerName(p)}</a> : <span className="dy-dim">Nobody</span>}</td><td className="ui-left">{p?.cls ?? ''}</td><td className="ui-num">{p?.ovr ?? ''}</td></tr>;
                })}
              </tbody>
            </Table>
          </>
        )}
        <div className="dy-row dy-next">
          <Button href={href('offseason/schedule')}>Next: the schedule</Button>
          {team !== undefined && <Button variant="quiet" href={href(`team/${team}`)}>Change the depth chart</Button>}
        </div>
      </>
    );
  }
  if (step === 'schedule') {
    return (
      <>
        {steps}
        <ScheduleEditor arg={team !== undefined ? String(team) : undefined} />
        <div className="dy-row dy-next"><Button href={href('offseason/rom')}>Next: download the ROM</Button></div>
      </>
    );
  }
  return (
    <>
      {steps}
      <SubHead>Download the {season.year} ROM</SubHead>
      <p>The {season.year} season is set up. Download its ROM and start a <b>New Season</b> in the game with it: it has the new rosters{season.schedule ? ' and your schedule' : ''}, and the app can only import saves of seasons started with it. Import the save after you play.</p>
      {season.romDownloaded && !season.lineupEdited && <Note kind="ok">You have downloaded the {season.year} ROM. Start a New Season in the game with it.</Note>}
      {season.romDownloaded && season.lineupEdited && <Note>You changed the schedule or the depth chart after downloading. Download the ROM again before you start the New Season.</Note>}
      <div className="dy-row dy-next">
        <Button onClick={() => actions.downloadRom(season.year)}>Download the {season.year} ROM</Button>
        <Button variant="quiet" href={href('offseason/depth')}>Back to the depth chart</Button>
      </div>
    </>
  );
}

const LAYOUT = rosterLayout('bw95', false, true);

/**
 * The projected depth chart (user, 2026-11-12: "a step for projected depth chart prior to players leaving.
 * That way we can move a HB2 to HB1 if we really want to ensure he doesn't transfer"): next season's
 * 32 for each of the user's teams after graduations and early entries. A player in a starting spot isn't
 * "blocked", so he's less likely to enter the portal. The final depth chart comes after the offseason.
 */
function ProjectedDepth({ actions, busy }: { actions: OffseasonActions; busy: string | null }) {
  const { d } = useDyn();
  const st = d.offseason!;
  const pl = (id: number) => d.players[id - 1];
  const [charts, setCharts] = useState<Record<number, (number | null)[]>>(() => Object.fromEntries(d.userTeams.map((u) => [u, projectedDepth(d, u).slice()])));
  const [err, setErr] = useState<string | null>(null);
  const of = (k: 'graduated' | 'pro') => st.events.filter((e) => e.kind === k);
  const pick = (u: number, slot: number, id: number) => {
    setErr(null);
    setCharts((all) => {
      const c = all[u].slice();
      const was = c.indexOf(id);
      if (was >= 0) c[was] = c[slot]; // swap with the spot he had
      c[slot] = id;
      return { ...all, [u]: c };
    });
  };
  return (
    <>
      <SubHead>Projected depth chart</SubHead>
      <p>
        Your {st.year + 1} depth chart as it stands after graduation and early entries ({of('graduated').length.toLocaleString('en-US')} graduates and{' '}
        {of('pro').length} early entries across the country; your teams' are listed in the next step). Players who start (★) are much less likely
        to enter the transfer portal, and players who got the ball last season are content too. You can change the depth chart again before the
        season. Signing day hasn't happened yet, so a spot with nobody to play it stays open for now.
      </p>
      {d.userTeams.map((u) => {
        const roster = d.players.filter((p) => p.team === u && p.status === 'active');
        const c = charts[u];
        return (
          <div key={u} className="dy-off-team">
            <h4><TeamLink team={u} rank={false} /></h4>
            <Table figures className="dy-depth">
              <thead><tr><th className="ui-left">Spot</th><th className="ui-left">Player</th><th>OVR</th></tr></thead>
              <tbody>
                {LAYOUT.map((def, slot) => {
                  const pos = slotPosition(def.label);
                  const here = c[slot] !== null ? pl(c[slot]!) : undefined;
                  const cands = roster.filter((p) => p.pos === pos || p.id === here?.id).sort((a, b) => b.ovr - a.ovr);
                  return (
                    <tr key={slot}>
                      <td className="ui-left">{def.label}{!DEPTH_SLOTS.has(def.label) && <span className="dy-dim" title="Starting spot"> ★</span>}</td>
                      <td className="ui-left">
                        <select aria-label={`${def.label}`} value={here?.id ?? ''} onChange={(e) => pick(u, slot, Number(e.target.value))}>
                          {!here && <option value="">Open</option>}
                          {cands.map((p) => {
                            const at = c.indexOf(p.id);
                            return <option key={p.id} value={p.id}>{playerName(p)}, {p.cls} {p.ovr}{at >= 0 && at !== slot ? ` (now at ${LAYOUT[at].label})` : ''}</option>;
                          })}
                        </select>
                      </td>
                      <td className="dy-strong">{here?.ovr ?? ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        );
      })}
      {err && <Note kind="error">{err}</Note>}
      <div className="dy-row dy-next">
        <Button disabled={!!busy} onClick={() => {
          const bad = d.userTeams.flatMap((u) => projectedProblems(d, u, charts[u]).map((m) => `${d.teams[u].school}: ${m}`));
          if (bad.length) return setErr(bad.join(' '));
          void actions.run('Players leaving…', async () => actions.commit(confirmDepth(d, charts)));
        }}>Next: players leaving</Button>
        <SimOffseason actions={actions} busy={busy} />
      </div>
    </>
  );
}
