// The offseason, step by step: departures, the transfer portal, signing day, cuts, the next season.
import { Button, Note, PageHead, SubHead, Table } from '../../ui';
import { useMemo, useState } from 'react';
import type { DPlayer, Dynasty, OffseasonEvent } from '../../core/dynasty/model';
import {
  applyCuts, cancelOffseason, classRankings, cutOrder, cutProblems, finishOffseason, recruitTemplates, runPortal, runSigningDay,
  seasonDone, startOffseason, groupMins, ROSTER_LIMIT, type RecruitTemplates,
} from '../../core/dynasty/offseason';
import { openRecruiting } from '../../core/dynasty/recruiting';
import { rulesOf } from '../../core/dynasty/rules';
import { EVEN_TRAINING, TRAINING_AREAS, TRAINING_POINTS, trainingProblems, type Training } from '../../core/dynasty/training';
import { simCuts, simOffseason } from '../../core/dynasty/sim';
import { DEPTH_SLOTS, confirmDepth, projectedDepth, projectedProblems } from '../../core/dynasty/offseason';
import { slotPosition } from '../../core/dynasty/depth';
import { rosterLayout } from '../../core/rosterLayouts';
import { Recruiting } from './RecruitingPage';
import { playerName } from '../../core/dynasty/derive';
import { TeamLink, hometownText, href, useDyn } from './ui';

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
const STEPS = ['Depth chart', 'Players leaving', 'Transfer portal', 'Signing day and cuts', 'Next season'] as const;
const STEP_OF = { depth: 0, portal: 1, recruiting: 2, signing: 2, cuts: 3, ready: 4 } as const;

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

export function Offseason({ actions, busy }: { actions: OffseasonActions; busy: string | null }) {
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
      <section className="dy-off">
        <PageHead title="Offseason" />
        {startedNew ? (
          <>
            <p>The {season.year} season is ready. Set your final depth chart on your team's page (the Pos menus), then download its ROM, start a New Season in the game with it, and import the save after you play.</p>
            <div className="dy-row">{users.map((u) => <Button variant="quiet" key={u}  href={href(`team/${u}`)}>{d.teams[u].school} depth chart</Button>)}</div>
            <Button onClick={() => actions.downloadRom(season.year)}>Download the {season.year} ROM</Button>
          </>
        ) : (
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

  const step = STEP_OF[st.step];
  return (
    <section className={st.step === 'recruiting' ? 'dy-off dy-off-wide' : 'dy-off'}>
      <PageHead title={`Offseason ${st.year}`} />
      <ol className="dy-steps">
        {STEPS.map((s0, i) => (st.mode === 'full' && i === 2 ? 'Recruiting' : s0)).map((s, i) => <li key={s} className={i < step ? 'dy-done' : i === step ? 'dy-now' : ''} aria-current={i === step ? 'step' : undefined}>{s}</li>)}
      </ol>

      {st.step === 'depth' && <ProjectedDepth actions={actions} busy={busy} />}

      {/* What happened so far, newest step first */}
      {st.step === 'portal' && (
        <>
          <SubHead>Players leaving</SubHead>
          {users.map((u) => {
            const team = (k: 'graduated' | 'pro' | 'returns') => of(k).filter((e) => e.team === u).map((e) => ({ p: pl(e.player) }));
            return (
              <div key={u} className="dy-off-team">
                <h4><TeamLink team={u} rank={false} /></h4>
                <p className="dy-small dy-dim">Going pro</p>
                <PlayerList rows={team('pro')} />
                <p className="dy-small dy-dim">Graduating</p>
                <PlayerList rows={team('graduated')} />
                <p className="dy-small dy-dim">Entering the transfer portal</p>
                <PlayerList rows={(st.portal ?? []).map(pl).filter((p) => p.team === u).map((p) => ({ p, extra: p.cls }))} />
                <p className="dy-small dy-dim">Back for a fifth year (SR+)</p>
                <PlayerList rows={team('returns')} />
              </div>
            );
          })}
          <p>
            Across the country {of('graduated').length.toLocaleString('en-US')} players graduate, {of('pro').length} go pro, {(st.portal ?? []).length} enter the
            transfer portal and {of('returns').length} seniors come back as SR+.
          </p>
          <p>Next: the transfer portal and signing day. Either quickly, with random signing classes for every team, or by recruiting yourself for {rulesOf(d).weeks} weeks (high-school players and the transfer portal).</p>
          <div className="dy-row dy-next">
            <Button disabled={!!busy} onClick={() => actions.run('Opening recruiting…', async () => actions.commit(openRecruiting(d, await getTemplates(d))))}>Recruit for {rulesOf(d).weeks} weeks</Button>
            <Button variant="quiet" disabled={!!busy} onClick={() => actions.run('Running the transfer portal…', () => actions.commit(runPortal(d)))}>Random classes</Button>
          </div>
          <div className="dy-row"><SimOffseason actions={actions} busy={busy} /></div>
        </>
      )}

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

      {st.step === 'cuts' && <SigningAndCuts actions={actions} busy={busy} />}

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
            label={`Start the ${st.year + 1} season`}
            onClick={() => actions.run('Setting the depth charts…', async () => {
              await actions.commit(finishOffseason(d), `The ${st.year + 1} season is ready. Download its ROM below.`);
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

function SigningAndCuts({ actions, busy }: { actions: OffseasonActions; busy: string | null }) {
  const { d } = useDyn();
  const st = d.offseason!;
  const pl = (id: number) => d.players[id - 1];
  const ranks = classRankings(st.events);
  const signed = st.events.filter((e): e is Extract<OffseasonEvent, { kind: 'signed' }> => e.kind === 'signed');
  const [cuts, setCuts] = useState<Record<number, number[]>>(() => ({ ...(st.suggestedCuts ?? {}) }));
  const [err, setErr] = useState<string | null>(null);
  const rosters = useMemo(
    () => Object.fromEntries(d.userTeams.map((u) => [u, cutOrder(d.players.filter((p) => p.team === u && p.status === 'active'), rulesOf(d))])),
    [d],
  );
  const toggle = (u: number, id: number) => {
    setErr(null);
    setCuts((c) => ({ ...c, [u]: (c[u] ?? []).includes(id) ? (c[u] ?? []).filter((x) => x !== id) : [...(c[u] ?? []), id] }));
  };
  return (
    <>
      <SubHead>Signing day</SubHead>
      {d.userTeams.map((u) => {
        const r = ranks.find((x) => x.team === u);
        return (
          <div key={u} className="dy-off-team">
            <h4><TeamLink team={u} rank={false} /> <span className="dy-dim dy-small">No. {r?.rank} class</span></h4>
            <PlayerList rows={signed.filter((s) => s.team === u).sort((a, b) => b.stars - a.stars || b.ovr - a.ovr).map((s) => ({ p: pl(s.player), extra: `${stars(s.stars)}, ${hometownText(pl(s.player))}` }))} />
          </div>
        );
      })}
      <h4>Top classes</h4>
      <ol className="dy-classes">
        {ranks.slice(0, 10).map((c) => {
          const mine = signed.filter((s) => s.team === c.team);
          return (
            <li key={c.team}>
              <TeamLink team={c.team} rank={false} />
              <span className="dy-dim dy-small">{c.signed} signed{[5, 4].map((k) => { const n = mine.filter((s) => s.stars === k).length; return n ? <span key={k}>, <b>{n}</b> × {k}★</span> : null; })}</span>
            </li>
          );
        })}
      </ol>

      <SubHead>Cuts</SubHead>
      <p>
        Every team cuts to {ROSTER_LIMIT}. The computer cuts for the other teams the same way it suggests yours, which are checked already: next season's
        Active Roster (★) stays, and backups go first by what they'll be worth when they could start (expected OVR the next two seasons, so seniors
        go first). Keep at least {groupMins(rulesOf(d)).map((g) => `${g.min} ${g.name}`).join(', ')}, and a player for every Active Roster spot.
      </p>
      {d.userTeams.map((u) => {
        const { order: roster, active } = rosters[u];
        const mine = cuts[u] ?? [];
        const over = roster.length - ROSTER_LIMIT;
        const left = over - mine.length;
        return (
          <div key={u} className="dy-off-team">
            <h4><TeamLink team={u} rank={false} /> <span className="dy-dim dy-small">{roster.length} players</span></h4>
            {over <= 0 ? <p className="dy-dim">{roster.length} players: no cuts needed.</p> : (
              <>
                <p className={left > 0 ? 'dy-l' : 'dy-dim'}>{left > 0 ? `Cut ${left} more.` : left < 0 ? `${-left} more than needed: that's fine.` : 'Ready.'}</p>
                <ul className="dy-cutlist">
                  {roster.map((p) => (
                    <li key={p.id}>
                      <label>
                        <input type="checkbox" checked={mine.includes(p.id)} onChange={() => toggle(u, p.id)} />
                        <span>{playerName(p)}{active.has(p.id) && <span className="dy-dim" title="Active Roster next season"> ★</span>}</span>
                        <span className="dy-dim">{p.pos}</span>
                        <span className="dy-dim">{p.cls}</span>
                        <span className="dy-strong">{p.ovr}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        );
      })}
      <TrainingFocus actions={actions} busy={busy} />
      {err && <Note kind="error">{err}</Note>}
      <Next
        busy={busy}
        label="Make the cuts and train"
        onClick={() => {
          const bad = d.userTeams.flatMap((u) => cutProblems(d, u, cuts[u] ?? []).map((m) => `${d.teams[u].school}: ${m}`));
          if (trainingBad(d)) bad.push('Training focus: use exactly 100 points.');
          if (bad.length) return setErr(bad.join(' '));
          void actions.run('Making the cuts…', async () => actions.commit(applyCuts(d, cuts, await getTemplates(d))));
        }}
      />
      <div className="dy-row">
        <Button variant="quiet" disabled={!!busy} onClick={() => actions.run('Making the cuts…', async () => actions.commit(simCuts(d, await getTemplates(d))))}>Sim the cuts</Button>
        <SimOffseason actions={actions} busy={busy} />
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
        season. Signing day hasn't happened yet, so a thin position may show a player in two spots.
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
                          {!here && <option value="">Nobody</option>}
                          {cands.map((p) => {
                            const at = c.indexOf(p.id);
                            return <option key={p.id} value={p.id}>{playerName(p)}, {p.cls} {p.ovr}{at >= 0 && at !== slot ? ` (${LAYOUT[at].label})` : ''}</option>;
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
