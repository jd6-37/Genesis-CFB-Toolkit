// Starting a dynasty, steps 3-7 (user, 2026-11-20, mockups approved): Coaches, Rosters, Conferences, Schedule and the
// first season's ROM, on the dynasty Get started just made (route #setup/<step>). Every step is optional: Next keeps
// it as it is, "Skip to the download" keeps the changes so far and the defaults for the rest.
import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { Button, Check, Field, Modal, Note, Select, Steps, Table } from '../../ui';
import type { Dynasty } from '../../core/dynasty/model';
import { COACH_RATINGS, COACH_RATING_LABELS, coachOvr, type CoachRatings } from '../../core/dynasty/coaches';
import { createCoach } from '../../core/dynasty/carousel';
import { simNudges } from '../../core/dynasty/coachEffects';
import { randomBench } from '../../core/dynasty/bench';
import { losesRealSchedule } from '../../core/dynasty/conferences';
import { editionOf } from '../../core/dynasty/edition';
import { seasonRomName } from '../../core/dynasty/offseason';
import { coachChanges, SETUP_LABELS, fillOpenJobs, openJobs, realScheduleNow, SETUP_STEPS, setupFire, setupHire, setupLock, setupSchedule, setupSwap, type SetupStep } from '../../core/dynasty/setup';
import { zipName } from '../../core/zip';
import { ImpactStep } from './ImpactStep';
import { ConferencesStep } from './ConferencesStep';
import { ScheduleEditor } from './SchedulePage';
import { RivalriesEditor } from './RivalriesEditor';
import { SeasonGuide } from './GetStarted';
import { href, useDyn } from './ui';

export interface SetupActions {
  commit: (d: Dynasty) => Promise<void>;
  downloadRom: (year: number) => void;
  getRom: () => Promise<Uint8Array | null>;
  /** The players CSV box (Manage's). */
  playersCsv: ReactNode;
  exportFile: (d: Dynasty) => void;
}

const NEXT: Record<SetupStep, string> = { coaches: 'Next: rosters', rosters: 'Next: conferences', conferences: 'Next: schedule', schedule: 'Next: download', download: '' };

/** The coach switch's text (user, 2026-11-20). */
export const COACH_SIM_TEXT =
  'In Dynasty, coaches have skills and progression. With this on, they also count in simulated games: a head coach\'s Passing and Running skill levels affect his team\'s offensive performance in sims, and his Defense skill its defensive performance. A coach 6 or more points above the league\'s median head coach adds 1 to that side\'s team OVR; 6 or more below takes 1 off. Coach boosts do not affect either team in games you play.';

export function SetupPage({ step, actions, busy }: { step: SetupStep; actions: SetupActions; busy: boolean }) {
  const { d } = useDyn();
  const i = SETUP_STEPS.indexOf(step);
  // The real backups before generated ones were picked (this visit only), so the choice can go back.
  const benchBefore = useRef<Dynasty | null>(null);
  const lock = setupLock(d);
  const go = async (to: SetupStep) => {
    // Leaving the coaches: every open job is filled from the pool.
    if (step === 'coaches' && openJobs(d).length) await actions.commit(fillOpenJobs(d));
    window.location.hash = href(`setup/${to}`);
    window.scrollTo(0, 0);
  };
  const nav = step !== 'download' && (
    <div className="dy-setup-nav">
      <div className="dy-row">
        {i > 0 && <Button variant="quiet" onClick={() => void go(SETUP_STEPS[i - 1])}>Back</Button>}
        <span className="dy-setup-gap" />
        <Button variant="link" disabled={busy} onClick={() => void go('download')}>Skip to the download</Button>
        <Button disabled={busy} onClick={() => void go(SETUP_STEPS[i + 1])}>{NEXT[step]}</Button>
      </div>
      <p className="dy-small dy-dim">Next keeps this step as it is (the defaults if you change nothing). Skip to the download keeps your changes so far and the defaults for the rest.</p>
    </div>
  );
  return (
    <div className="dy-setup">
      <Steps label="Start a dynasty" steps={SETUP_LABELS.map((label, k) => ({ label, href: k >= 2 && k - 2 !== i ? href(`setup/${SETUP_STEPS[k - 2]}`) : undefined }))} current={i + 2} />
      {lock && step !== 'download' && <Note>{lock}</Note>}
      {step === 'coaches' && <CoachesStep actions={actions} busy={busy || !!lock} />}
      {step === 'rosters' && <RostersStep actions={actions} busy={busy || !!lock} before={benchBefore} />}
      {step === 'conferences' && <ConferencesSetup actions={actions} busy={busy || !!lock} />}
      {step === 'schedule' && <ScheduleSetup actions={actions} busy={busy || !!lock} />}
      {step === 'download' && <DownloadStep actions={actions} busy={busy} />}
      {nav}
    </div>
  );
}

// ---- 3. Coaches

function Marks({ off, def }: { off: number; def: number }) {
  const one = (v: number, side: string) => (
    <span className={`dy-mark ${v > 0 ? 'is-up' : v < 0 ? 'is-down' : ''}`} title={`${side}: ${v > 0 ? '+1 in sims' : v < 0 ? '−1 in sims' : 'no change'}`}>
      <span aria-hidden="true">{v > 0 ? '+' : v < 0 ? '−' : '·'}</span>{side}
    </span>
  );
  return <span className="dy-marks">{one(off, 'OFF')}{one(def, 'DEF')}</span>;
}

function CoachesStep({ actions, busy }: { actions: SetupActions; busy: boolean }) {
  const { d } = useDyn();
  const s = d.seasons[0];
  const [conf, setConf] = useState(String(d.userTeams.length ? s.conf[d.userTeams[0]] : 0));
  const [q, setQ] = useState('');
  const [swap, setSwap] = useState<number | null>(null);
  const [hire, setHire] = useState<number | null>(null);
  const [making, setMaking] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const start = useMemo(() => d.setupCoaches ?? s.coach ?? [], [d.setupCoaches, s.coach]);
  const nud = simNudges({ ...d, coachSim: true }, s.coach);
  const coachAt = (t: number) => { const id = s.coach?.[t]; return id === null || id === undefined ? undefined : d.coaches![id]; };
  const act = async (f: () => Dynasty) => { setErr(null); try { await actions.commit(f()); } catch (e) { setErr((e as Error).message); } };
  const changes = coachChanges(d, start);
  const name = (id: number | null) => (id === null ? 'nobody' : d.coaches![id].name);
  const ql = q.trim().toLowerCase();
  const rows = d.teams.filter((t) => (ql ? `${t.school} ${coachAt(t.index)?.name ?? ''}`.toLowerCase().includes(ql) : conf === 'all' || s.conf[t.index] === Number(conf)))
    .sort((a, b) => a.school.localeCompare(b.school));
  return (
    <section>
      <h1>Coaches</h1>
      <p>Every school's head coach for {s.year}. Create your own coach, hire or fire, or swap two schools' coaches. A fired coach goes to the pool of coaches without a job, where any school can hire him.</p>
      <div className="dy-setup-switch">
        <Check checked={!!d.coachSim} disabled={busy} onChange={(on) => void act(() => ({ ...d, coachSim: on || undefined }))}><strong>Coaches affect the sim</strong></Check>
        <p className="dy-small">{COACH_SIM_TEXT}</p>
      </div>
      {changes.length > 0 && (
        <div className="dy-setup-changes">
          <p><strong>Your changes</strong></p>
          <ul className="dy-small">{changes.map((c) => <li key={c.team}>{d.teams[c.team].school}: {name(c.from)} → {name(c.to)}</li>)}</ul>
          <Button variant="link" disabled={busy} onClick={() => void act(() => start.reduce<Dynasty>((x, id, t) => (id === null ? x : setupHire(x, id, t)), d))}>Undo all</Button>
        </div>
      )}
      <div className="dy-row dy-setup-filters">
        <Select label="Conference" hideLabel value={conf} onChange={setConf}
          options={[{ value: 'all', label: 'All schools' }, ...s.confNames.map((n, c) => ({ value: String(c), label: n })).filter((o) => s.conf.includes(Number(o.value)))]} />
        <Field label="Find a school or coach" hideLabel placeholder="Find a school or coach" value={q} onChange={setQ} />
        <Button variant="quiet" disabled={busy} onClick={() => setMaking(true)}>Create a coach</Button>
      </div>
      {err && <Note kind="error">{err}</Note>}
      <Table words>
        <thead><tr><th className="ui-left">School</th><th className="ui-left">Head coach</th><th>OVR</th>{d.coachSim && <th className="ui-left">In sims</th>}<th className="ui-left"><span className="ui-sr">Actions</span></th></tr></thead>
        <tbody>
          {rows.map((t) => {
            const c = coachAt(t.index);
            const mine = d.userTeams.includes(t.index);
            return (
              <tr key={t.index} className={mine ? 'dy-setup-mine' : undefined}>
                <td className="ui-left">{t.school}</td>
                <td className="ui-left">{c ? <a href={href(`coach/${c.id}`)}>{c.name}</a> : <span className="dy-dim">No head coach</span>}</td>
                <td>{c ? coachOvr(c.ratings) : ''}</td>
                {d.coachSim && <td className="ui-left">{c && <Marks {...nud[t.index]} />}</td>}
                <td className="ui-left"><span className="dy-row dy-setup-acts">
                  {c ? <>
                    <Button variant="link" disabled={busy} onClick={() => setSwap(t.index)}>Swap</Button>
                    <Button variant="link" disabled={busy} onClick={() => void act(() => setupFire(d, t.index))}>Fire</Button>
                  </> : <Button variant="link" disabled={busy} onClick={() => setHire(t.index)}>Hire</Button>}
                </span></td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      {openJobs(d).length > 0 && <p className="dy-small">{openJobs(d).length === 1 ? 'One school has' : `${openJobs(d).length} schools have`} no head coach. When you go on, the best coaches in the pool are hired for them.</p>}
      {swap !== null && <PickModal title={`Swap ${coachAt(swap)?.name ?? ''}`} text={`${d.teams[swap].school}'s coach goes to the school you pick, and that school's coach comes to ${d.teams[swap].school}.`}
        items={d.teams.filter((t) => t.index !== swap && coachAt(t.index)).map((t) => ({ key: t.index, label: t.school, sub: `${coachAt(t.index)!.name}, ${coachOvr(coachAt(t.index)!.ratings)}`, marks: d.coachSim ? nud[t.index] : undefined }))}
        onPick={(t) => { void act(() => setupSwap(d, swap, t)); setSwap(null); }} onClose={() => setSwap(null)} />}
      {hire !== null && <PickModal title={`Hire a coach for ${d.teams[hire].school}`} text="Coaches in the pool, best first."
        items={d.coaches!.filter((c) => c.status === 'pool').sort((a, b) => coachOvr(b.ratings) - coachOvr(a.ratings)).map((c) => ({ key: c.id, label: c.name, sub: `${coachOvr(c.ratings)}${c.poolNote ? `, ${c.poolNote}` : ''}` }))}
        onPick={(id) => { void act(() => setupHire(d, id, hire)); setHire(null); }} onClose={() => setHire(null)} />}
      {making && <MakeCoach onClose={() => setMaking(false)} onMake={(c, team) => act(() => { const x = createCoach(d, c); return setupHire(x, x.coaches!.length - 1, team); })} />}
    </section>
  );
}

function PickModal({ title, text, items, onPick, onClose }: {
  title: string; text: string; items: { key: number; label: string; sub: string; marks?: { off: number; def: number } }[];
  onPick: (key: number) => void; onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();
  const list = items.filter((x) => !ql || `${x.label} ${x.sub}`.toLowerCase().includes(ql)).slice(0, 40);
  return (
    <Modal title={title} onClose={onClose} actions={<Button variant="quiet" onClick={onClose}>Cancel</Button>}>
      <p>{text}</p>
      <Field label="Find" hideLabel placeholder="Find a school or coach" value={q} onChange={setQ} />
      <ul className="dy-setup-pick">
        {list.map((x) => (
          <li key={x.key}><button type="button" onClick={() => onPick(x.key)}><strong>{x.label}</strong><span className="dy-small dy-dim">{x.sub}</span>{x.marks && <Marks {...x.marks} />}</button></li>
        ))}
      </ul>
    </Modal>
  );
}

const BLANK: CoachRatings = { passing: 60, running: 60, defense: 60, recruiting: 60, development: 60 };

function MakeCoach({ onMake, onClose }: { onMake: (c: { name: string; age: number; ratings: CoachRatings }, team: number) => Promise<void>; onClose: () => void }) {
  const { d } = useDyn();
  const [name, setName] = useState('');
  const [age, setAge] = useState('40');
  const [r, setR] = useState<CoachRatings>(BLANK);
  const [team, setTeam] = useState(String(d.userTeams[0] ?? ''));
  return (
    <Modal title="Create a coach" onClose={onClose} actions={<>
      <Button disabled={!name.trim() || team === ''} onClick={() => { void onMake({ name, age: Number(age), ratings: r }, Number(team)); onClose(); }}>Create and hire him</Button>
      <Button variant="quiet" onClick={onClose}>Cancel</Button>
    </>}>
      <p>He becomes the head coach of the school you pick; its coach goes to the pool.</p>
      <div className="dy-createcoach-fields">
        <Field label="Name" value={name} onChange={setName} maxLength={30} />
        <Field label="Age" type="number" min={25} max={85} value={age} onChange={setAge} />
        {COACH_RATINGS.map((k) => (
          <Field key={k} label={COACH_RATING_LABELS[k]} type="number" min={30} max={99} value={String(r[k])} onChange={(x) => setR({ ...r, [k]: Number(x) })} />
        ))}
      </div>
      <p className="dy-small">OVR {coachOvr(r)}</p>
      <Select label="Head coach at" value={team} onChange={setTeam}
        options={[{ value: '', label: 'Choose a school' }, ...d.teams.slice().sort((a, b) => a.school.localeCompare(b.school)).map((t) => ({ value: String(t.index), label: t.school }))]} />
    </Modal>
  );
}

// ---- 4. Rosters

function RostersStep({ actions, busy, before }: { actions: SetupActions; busy: boolean; before: MutableRefObject<Dynasty | null> }) {
  const { d } = useDyn();
  const generated = !!d.benchGenerated;
  const pick = async (gen: boolean) => {
    if (gen === generated) return;
    if (gen) { before.current = d; await actions.commit({ ...randomBench(d), benchGenerated: true }); }
    else if (before.current) { await actions.commit(before.current); before.current = null; }
  };
  return (
    <section>
      <h1>Rosters</h1>
      <p>Every team's 32 on the Active Roster come from the ROM. Change who sits behind them, edit any player in a spreadsheet, and pick your teams' impact players.</p>
      <fieldset className="dy-start-choice">
        <legend>Backups</legend>
        <p className="dy-small dy-dim">Every team has a backup for each of the 32 players on its Active Roster. A backup moves up when a spot opens.</p>
        <label><input type="radio" name="dy-bench" checked={!generated} disabled={busy || (generated && !before.current)} onChange={() => void pick(false)} /> <span><strong>Real players</strong><br /><span className="dy-small dy-dim">{editionOf(d).id === '1994' ? 'Real players from the 1994 rosters (their ratings are generated).' : 'The next-best real players (CFB 27), with their names and ratings.'}</span></span></label>
        <label><input type="radio" name="dy-bench" checked={generated} disabled={busy} onChange={() => void pick(true)} /> <span><strong>Generated players</strong><br /><span className="dy-small dy-dim">Made-up backups at each spot. The Active Rosters stay the same.</span></span></label>
        {generated && !before.current && <p className="dy-small dy-dim">To get the real backups back, start the dynasty again.</p>}
      </fieldset>
      {actions.playersCsv}
      {d.userTeams.length ? <ImpactStep commit={(x) => actions.commit(x)} busy={busy} setup /> : <p className="dy-dim">Pick your team on the Dynasty step to choose its impact players; every team has the game's pick.</p>}
    </section>
  );
}

// ---- 5. Conferences

function ConferencesSetup({ actions, busy }: { actions: SetupActions; busy: boolean }) {
  const { d } = useDyn();
  const s = d.seasons[0];
  return (
    <section>
      <h1>Conferences</h1>
      <p>Move teams between conferences, rename them, and set their conference games and title games. To keep the real {s.year} schedule, move teams in pairs: two teams that trade conferences trade schedules. A change in a conference's number of teams needs a new schedule (the Schedule step makes it).</p>
      <ConferencesStep commit={(x) => actions.commit(x)} busy={busy} setup warnReal={(next) => losesRealSchedule(d, next)} />
    </section>
  );
}

// ---- 6. Schedule

function ScheduleSetup({ actions, busy }: { actions: SetupActions; busy: boolean }) {
  const { d } = useDyn();
  const s = d.seasons[0];
  const real = !!s.schedule?.real;
  const [canReal, setCanReal] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const confKey = s.conf.join(',');
  useEffect(() => { void actions.getRom().then((rom) => setCanReal(!!rom && !!realScheduleNow(d, rom))); }, [confKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const choose = async (kind: 'real' | 'new') => {
    setErr(null);
    try {
      const rom = await actions.getRom();
      if (!rom) throw new Error('Load your ROM first.');
      await actions.commit(setupSchedule(d, rom, kind, (Date.now() >>> 0) || 1));
    } catch (e) { setErr((e as Error).message); }
  };
  return (
    <section>
      <h1>Schedule</h1>
      <p>Pick the season's schedule, then change your teams' games if you like: the opponent, home or away, and the week.</p>
      <fieldset className="dy-eds">
        <legend className="ui-sr">Schedule</legend>
        <div className="dy-eds-grid">
          <label className={`dy-ed${real ? ' is-on' : ''}`}>
            <span className="dy-ed-top"><input type="radio" name="dy-sched" checked={real} disabled={busy || canReal === false} onChange={() => void choose('real')} /><strong>The real {s.year} schedule</strong></span>
            <p className="dy-ed-text">{canReal === false ? 'Not available: a conference has another number of teams than in the real season (Conferences step).' : 'As the ROM has it, with teams that traded conferences trading games. Teams play 10 to 12 games in 14 weeks.'}</p>
          </label>
          <label className={`dy-ed${!real ? ' is-on' : ''}`}>
            <span className="dy-ed-top"><input type="radio" name="dy-sched" checked={!real} disabled={busy} onChange={() => void choose('new')} /><strong>A new schedule</strong></span>
            <p className="dy-ed-text">Made by the app: {editionOf(d).regWeeks} games a team, each conference's games as set on Conferences, your protected rivalries kept. {!real && <Button variant="link" disabled={busy} onClick={() => void choose('new')}>Make another one</Button>}</p>
          </label>
        </div>
      </fieldset>
      {err && <Note kind="error">{err}</Note>}
      {d.userTeams.length ? <ScheduleEditor setup /> : <p className="dy-dim">Pick your team on the Dynasty step to change its games.</p>}
      {!real && <RivalriesEditor commit={(x) => actions.commit(x)} busy={busy} />}
    </section>
  );
}

// ---- 7. Download

function DownloadStep({ actions, busy }: { actions: SetupActions; busy: boolean }) {
  const { d } = useDyn();
  const s = d.seasons[0];
  const start = d.setupCoaches ?? [];
  const changes = coachChanges(d, start).length;
  const romConfChanged = !!d.setupConf && d.setupConf.some((c, t) => c !== s.conf[t]);
  const name = zipName(seasonRomName(d, { ...s, romId: s.romId ?? 'xxxxxx' }));
  const rows: [string, string, string][] = [
    ['Coaches', `${changes ? `${changes} ${changes === 1 ? 'change' : 'changes'}` : 'The real coaches'}; coaches affect the sim: ${d.coachSim ? 'on' : 'off'}`, 'coaches'],
    ['Rosters', `${d.benchGenerated ? 'Generated' : 'Real'} backups${Object.keys(s.impact ?? {}).length ? ', your impact players' : ''}`, 'rosters'],
    ['Conferences', romConfChanged ? 'Changed' : `As in ${s.year}`, 'conferences'],
    ['Schedule', s.schedule?.real ? `The real ${s.year} schedule${s.schedule.edited ? ', with your changes' : ''}` : `A new schedule${s.schedule?.edited ? ', with your changes' : ''}`, 'schedule'],
  ];
  return (
    <section>
      <h1>Download your ROM</h1>
      <p>Your {s.year} season, ready to play. Load it, start a <strong>New Season</strong> in Season mode, and play on it all season.</p>
      <ul className="dy-setup-sum">
        {rows.map(([k, v, step]) => <li key={k}><span>{k}</span><span>{v} <a href={href(`setup/${step}`)}>Change</a></span></li>)}
      </ul>
      <div className="dy-setup-dl">
        <Button disabled={busy} onClick={() => actions.downloadRom(s.year)}>Download the {s.year} ROM</Button>
        <p className="dy-small">{name}. Keep this name: the game finds your save by it.{s.romDownloaded ? ' Downloaded. If you change something above, download it again.' : ''}</p>
      </div>
      <h2>How a season works</h2>
      <SeasonGuide year={s.year} setup backup={<Button variant="quiet" onClick={() => actions.exportFile(d)}>Download dynasty file</Button>} />
      <div className="dy-start-go">
        <Button href={href('home')} strong>Go to {d.name}</Button>
      </div>
    </section>
  );
}
