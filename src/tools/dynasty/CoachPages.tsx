// The coaches' pages (spec: claude.ai project notes bw95-dynasty-coaches-spec.md; mockups: the "Dynasty coaches
// mockups" canvas): the Coaches page (every coach, by job) and a page per coach (ratings against the average
// head coach, his record and career, real seasons marked IRL).
import { useEffect, useMemo, useRef, useState } from 'react';
import { drawHeadshot, HEAD_SIZE } from '../../core/dynasty/headshot';
import { COACH_GLASSES, COACH_GLASSES_LABELS, COACH_HAIR, COACH_HAIR_COLOR_LABELS, COACH_HAIR_LABELS, COACH_HATS, COACH_HAT_LABELS, SKIN_LABELS, coachLook, coachLookChoices } from '../../core/dynasty/coachLook';
import { SCHOOL_COLORS } from '../../core/dynasty/schoolColors';
import {
  COACH_RATINGS, COACH_RATING_HELPS, COACH_RATING_LABELS, coachAge, coachOvr, coachRecord, dynastySeasons, headCoachField, type DCoach,
} from '../../core/dynasty/coaches';
import { Button, Check, DataTable, Empty, Field, Note, PageHead, Select, SubHead, Table, Tabs, Tag } from '../../ui';
import { createCoach, goalResults, heatLabel, hotSeat, setCoachLook, setManageXp, spendXp, tenure, xpCost } from '../../core/dynasty/carousel';
import type { CoachRating, CoachRatings } from '../../core/dynasty/coaches';
import { simNudges } from '../../core/dynasty/coachEffects';
import { href, inkColor, mainColor, onColor, TeamLink, TeamMark, teamCss, useDyn } from './ui';

const ordinal = (n: number) => {
  const t = n % 100, u = n % 10;
  return `${n}${t >= 11 && t <= 13 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th'}`;
};

/** A coach's prestige, 1-5 stars. */
export function CoachStars({ stars }: { stars: number }) {
  return (
    <span className="dy-prestige" role="img" aria-label={`Prestige: ${stars} of 5 stars`} title={`Prestige: ${stars} of 5 stars`}>
      {'★'.repeat(stars)}<span>{'★'.repeat(5 - stars)}</span>
    </span>
  );
}

/** A coach's 16-bit headshot (coachLook.ts): his team's colors on the polo and the hat, gray without a team. */
export function CoachHeadshot({ c, size = 120 }: { c: DCoach; size?: number }) {
  const { d, v } = useDyn();
  const ref = useRef<HTMLCanvasElement>(null);
  const year = d.offseason ? d.offseason.year + 1 : v.season.year;
  const t = c.team;
  const main = t !== null ? mainColor(d, t) : '#6b6e75';
  const second = (t !== null && SCHOOL_COLORS[d.teams[t].school]?.[1]) || '#ffffff';
  useEffect(() => {
    const g = ref.current?.getContext('2d');
    if (!g) return;
    g.putImageData(new ImageData(drawHeadshot(coachLook(c, year, t !== null ? [main, second] : null), main, second), HEAD_SIZE, HEAD_SIZE), 0, 0);
  }, [c, year, t, main, second]);
  return <canvas ref={ref} className="dy-headshot" width={HEAD_SIZE} height={HEAD_SIZE} style={{ width: size, height: size }} role="img" aria-label={c.name} />;
}

export function CoachLink({ coach }: { coach: DCoach }) {
  return <a href={href(`coach/${coach.id}`)}>{coach.name}</a>;
}

const recordText = (r: { w: number; l: number; t: number }) => (r.w + r.l + r.t ? `${r.w}-${r.l}${r.t ? `-${r.t}` : ''}` : '');

/** What he does now, for lists: the school he coaches, or his pool note. */
function jobText(d: ReturnType<typeof useDyn>['d'], c: DCoach) {
  if (c.status === 'retired') return 'Retired';
  if (c.team !== null) return null;
  return c.poolNote ?? 'Not coaching';
}

type Show = 'head' | 'hot' | 'pool' | 'retired' | 'all';

export function Coaches() {
  const { d, v } = useDyn();
  const [show, setShow] = useState<Show>('head');
  const [q, setQ] = useState('');
  const all = d.coaches ?? [];
  const year = v.season.year;
  const rows = useMemo(() => {
    const want = q.trim().toLowerCase();
    return all
      .filter((c) => c.status !== 'retired' || show === 'all' || show === 'retired')
      .filter((c) => (show === 'head' || show === 'hot' ? c.team !== null : show === 'pool' ? c.team === null && c.status === 'pool' : show === 'retired' ? c.status === 'retired' : true))
      .filter((c) => !want || c.name.toLowerCase().includes(want) || (c.team !== null && d.teams[c.team].school.toLowerCase().includes(want)) || (c.poolNote ?? '').toLowerCase().includes(want))
      .map((c) => ({ c, ovr: coachOvr(c.ratings), rec: coachRecord(d, c), heat: c.team !== null ? hotSeat(d, c) : null }))
      .filter((r) => show !== 'hot' || (r.heat ?? 0) >= 55)
      .sort((a, b) => (show === 'hot' ? (b.heat ?? 0) - (a.heat ?? 0) : 0) || b.ovr - a.ovr || a.c.name.localeCompare(b.c.name));
  }, [all, show, q, d]);
  if (!d.coaches) return <Empty><p>The coaches are being added to this dynasty. Reload the page if they don't appear.</p></Empty>;
  const heads = all.filter((c) => c.team !== null).length;
  const pool = all.filter((c) => c.team === null && c.status === 'pool').length;
  const retired = all.filter((c) => c.status === 'retired').length;
  return (
    <section>
      <PageHead title="Coaches" />
      <p className="dy-dim dy-small">Every team's head coach, and the pool of coaches without a head coaching job: coordinators and head coaches out of work. Ratings are made by the app from each coach's record; no real source rates coaches.</p>
      <div className="dy-coach-tools">
        <Tabs label="Coaches" value={show} onChange={setShow} tabs={[{ value: 'head', label: 'Head coaches', count: heads }, { value: 'hot', label: 'Hot seat' }, { value: 'pool', label: 'Pool', count: pool }, ...(retired ? [{ value: 'retired' as const, label: 'Retired', count: retired }] : []), { value: 'all', label: 'All', count: all.length }]} />
        <Field label="Find a coach or school" value={q} onChange={setQ} compact />
      </div>
      <DataTable
        rows={rows}
        rowKey={(r) => r.c.id}
        mine={(r) => r.c.team !== null && d.userTeams.includes(r.c.team)}
        empty="No coaches match."
        columns={[
          { key: 'name', label: 'Coach', left: true, cell: (r) => <CoachLink coach={r.c} /> },
          { key: 'job', label: 'Job', left: true, cell: (r) => (r.c.team !== null ? <TeamLink team={r.c.team} /> : <span className="dy-dim">{jobText(d, r.c)}</span>) },
          { key: 'age', label: 'Age', num: true, cell: (r) => coachAge(r.c, year) },
          { key: 'stars', label: 'Prestige', left: true, cell: (r) => <CoachStars stars={r.c.prestige} /> },
          { key: 'ovr', label: 'OVR', num: true, cell: (r) => r.ovr },
          { key: 'heat', label: 'Hot seat', left: true, cell: (r) => (r.heat !== null ? <HeatBar heat={r.heat} small /> : '') },
          { key: 'rec', label: 'Record', num: true, cell: (r) => recordText(r.rec) },
        ]}
      />
      <CreateCoach />
    </section>
  );
}

/** The hot seat, 0-100: green to 40, gold to 55, red above (firing is possible from 55 in a coach's fourth year). */
export function HeatBar({ heat, small }: { heat: number; small?: boolean }) {
  const tone = heat >= 55 ? 'var(--bad)' : heat >= 40 ? 'var(--star)' : 'var(--good)';
  return (
    <span className={small ? 'dy-heat dy-heat-small' : 'dy-heat'} role="img" aria-label={`Hot seat ${heat} of 100: ${heatLabel(heat)}`} title={`Hot seat ${heat}: ${heatLabel(heat)}`}>
      <span className="dy-heat-track"><span style={{ width: `${heat}%`, background: tone }} /></span>
      <span className="ui-num">{heat}</span>{!small && <span className="dy-heat-label" style={{ color: tone }}>{heatLabel(heat)}</span>}
    </span>
  );
}

const BLANK: CoachRatings = { passing: 60, running: 60, defense: 60, recruiting: 60, development: 60 };

/** Make a coach (spec: any time; he starts in the pool and is put on a team in the coaching carousel). */
function CreateCoach() {
  const { d, commit } = useDyn();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('40');
  const [r, setR] = useState<CoachRatings>(BLANK);
  const [err, setErr] = useState<string | null>(null);
  if (!open) return <div className="dy-row"><Button variant="quiet" onClick={() => setOpen(true)}>Create a coach</Button></div>;
  return (
    <div className="dy-createcoach">
      <SubHead>Create a coach</SubHead>
      <p className="dy-small dy-dim">He starts in the pool. Put him on a team in the coaching carousel, the offseason's first step.</p>
      <div className="dy-createcoach-fields">
        <Field label="Name" value={name} onChange={setName} maxLength={30} />
        <Field label="Age" type="number" min={25} max={85} value={age} onChange={setAge} />
        {COACH_RATINGS.map((k) => (
          <Field key={k} label={COACH_RATING_LABELS[k]} type="number" min={30} max={99} value={String(r[k])} onChange={(x) => setR({ ...r, [k]: Number(x) })} />
        ))}
      </div>
      <p className="dy-small">OVR {coachOvr(r)}</p>
      {err && <Note kind="error">{err}</Note>}
      <div className="dy-row">
        <Button onClick={() => { try { const next = createCoach(d, { name, age: Number(age), ratings: r }); void commit(next); setOpen(false); setName(''); setR(BLANK); setErr(null); window.location.hash = href(`coach/${next.coaches!.length - 1}`); } catch (e) { setErr((e as Error).message); } }}>Create</Button>
        <Button variant="quiet" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

/** His five ratings: a shape against the average head coach, and a tile per rating with his rank (as the player page). */
function CoachRatingsBox({ c, color }: { c: DCoach; color: string }) {
  const { d } = useDyn();
  const { heads, avg, rank, tied } = headCoachField(d);
  const n = heads.length;
  const C = 150, CY = 130, R = 96;
  const pt = (k: number, r: number) => {
    const ang = (-90 + (360 / COACH_RATINGS.length) * k) * (Math.PI / 180);
    return [C + r * Math.cos(ang), CY + r * Math.sin(ang)];
  };
  const poly = (f: (k: (typeof COACH_RATINGS)[number]) => number) => COACH_RATINGS.map((k, i) => pt(i, (Math.min(99, f(k)) / 99) * R).map((z) => z.toFixed(1)).join(',')).join(' ');
  const order = [...COACH_RATINGS].sort((a, b) => rank(c, a) - rank(c, b));
  const isHead = c.team !== null;
  return (
    <div className="dy-bw">
      <p>{isHead ? `Ranked among all ${n} head coaches.` : `Against the ${n} head coaches (he isn't one now).`}</p>
      <div className="dy-bw-grid">
        <figure className="dy-shape">
          <svg viewBox="-40 0 380 250" role="img" aria-label={`${c.name}'s ratings against the average head coach`}>
            <polygon points={poly(() => 99)} className="dy-shape-rim" />
            <polygon points={poly(() => 49.5)} className="dy-shape-mid" />
            {COACH_RATINGS.map((k, i) => { const [x, y] = pt(i, R); return <line key={k} x1={C} y1={CY} x2={x} y2={y} className="dy-shape-mid" />; })}
            <polygon points={poly((k) => avg[k])} className="dy-shape-avg" />
            <polygon points={poly((k) => c.ratings[k])} style={{ fill: color, stroke: color }} className="dy-shape-him" />
            {COACH_RATINGS.map((k, i) => {
              const [x, y] = pt(i, R + 18);
              return <text key={k} x={x} y={y + 4} textAnchor={Math.abs(x - C) < 5 ? 'middle' : x > C ? 'start' : 'end'}>{COACH_RATING_LABELS[k]}</text>;
            })}
          </svg>
          <figcaption>
            <span><i style={{ background: color }} /> {c.name}</span>
            <span><i className="dy-key-avg" /> Average head coach</span>
          </figcaption>
        </figure>
        <div className="dy-tiles">
          {order.map((k) => {
            const f = c.ratings[k];
            const a = avg[k];
            const rk = rank(c, k), tie = isHead ? tied(c, k) : heads.filter((x) => x.ratings[k] === f).length;
            return (
              <div key={k} className="dy-tile">
                <div className="dy-tile-top"><span>{COACH_RATING_LABELS[k]}</span><strong>{f}</strong></div>
                <div className="dy-pips" role="img" aria-label={`${f}; average head coach ${Math.round(a)}`}>
                  {Array.from({ length: 15 }, (_, i) => {
                    const part = Math.max(0, Math.min(1, (f / 99) * 15 - i));
                    return <span key={i} style={part >= 1 ? { background: color } : part > 0 ? { background: `linear-gradient(90deg, ${color} ${Math.round(part * 100)}%, transparent ${Math.round(part * 100)}%)` } : undefined} />;
                  })}
                  <i style={{ left: `calc(${(a / 99) * 100}% - 1px)` }} title="Average head coach" />
                </div>
                <div className="dy-tile-note">
                  {tie > 0 ? <><strong>Tied for {ordinal(rk)}</strong> of {n}</> : <><strong>{ordinal(rk)}</strong> of {n}</>}
                  <br /><span className="dy-dim">{COACH_RATING_HELPS[k]}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="dy-dim dy-small">Made by the app from his record, titles and the jobs he held; no real source rates coaches. OVR counts Recruiting and Development a little more, since they help every position.</p>
    </div>
  );
}

export function Coach({ id }: { id: number }) {
  const { d, v, dark } = useDyn();
  const c = d.coaches?.[id];
  const dyn = useMemo(() => (c ? dynastySeasons(d, c.id) : []), [d, c]);
  if (!c) return <Empty><p>There's no such coach.</p></Empty>;
  const team = c.team;
  const bg = team !== null ? mainColor(d, team) : null;
  const ink = team !== null ? inkColor(d, team, dark) : 'var(--text-muted)';
  const rec = coachRecord(d, c);
  const year = v.season.year;
  const irl = [...c.irl].reverse();
  const job = team !== null ? `Head coach, ${d.teams[team].school}` : c.status === 'retired' ? 'Retired' : `In the pool: ${c.poolNote ?? 'Not coaching'}`;
  return (
    <section>
      <header className="dy-teamhead" style={bg ? { background: teamCss(bg), color: onColor(bg) } : undefined}>
        <div className="dy-teamhead-id">
          <CoachHeadshot c={c} size={120} />
          <div>
            <h2>{c.name}</h2>
            <p>
              <span>{job}</span>
              {c.formerPlayer && <Tag>{c.formerPlayer.drafted ? 'Former NFL player' : 'Former player'}</Tag>}
              <CoachStars stars={c.prestige} />
              <span>Age {coachAge(c, year)}{c.bornGuess ? ' (estimated)' : ''}</span>
              {c.hometown && <span>{c.hometown}</span>}
              {c.alma && <span>{c.alma}</span>}
              {recordText(rec) && <span className="dy-record">Head coach record <strong>{recordText(rec)}</strong></span>}
            </p>
          </div>
        </div>
        <div className="dy-player-side">
          <dl className={`dy-teamovr${bg && onColor(bg) === '#000' ? ' dy-on-light' : ''}`}>
            <div><dt>OVR</dt><dd>{coachOvr(c.ratings)}</dd></div>
          </dl>
          {team !== null && <a className="dy-player-logo" href={href(`team/${team}`)} aria-label={d.teams[team].school}><TeamMark team={team} size={96} /></a>}
        </div>
      </header>
      <EditCoachLook c={c} />

      <SubHead>Ratings</SubHead>
      <CoachRatingsBox c={c} color={ink} />
      {d.coachSim && team !== null && (() => {
        const season = d.seasons[d.seasons.length - 1];
        const n = simNudges(d, season.coach)[team] ?? { off: 0, def: 0 };
        const sign = (x: number) => (x > 0 ? `+${x}` : x < 0 ? `−${-x}` : '0');
        return <p className="dy-small dy-dim">In the sim (Offseason rules: Coaches affect the sim): {d.teams[team].school}'s OFF {sign(n.off)}, DEF {sign(n.def)} in the {season.year} season ROM.</p>;
      })()}

      {team !== null && <GoalsBox team={team} />}
      <ManageXp c={c} />

      <SubHead>Career</SubHead>
      {dyn.length + irl.length ? (
        <Table className="dy-coach-career">
          <thead><tr><th className="ui-left">Year</th><th className="ui-left">School</th><th className="ui-left">Job</th><th>Record</th><th className="ui-left">Result</th><th className="ui-left">Source</th></tr></thead>
          <tbody>
            {[...dyn].reverse().map((s) => (
              <tr key={`d${s.year}`}>
                <td className="ui-left ui-num">{s.year}</td>
                <td className="ui-left"><TeamLink team={s.team} rank={false} /></td>
                <td className="ui-left">Head coach</td>
                <td className="ui-num">{s.w + s.l ? `${s.w}-${s.l}` : ''}</td>
                <td className="ui-left">{[s.champion ? 'National champions' : '', s.done && s.rank <= 25 ? `Final rank ${s.rank}` : '', !s.done && s.w + s.l ? 'In progress' : ''].filter(Boolean).join(', ')}</td>
                <td className="ui-left"><Tag tone="ink">Dynasty</Tag></td>
              </tr>
            ))}
            {irl.map((s, i) => (
              <tr key={`i${i}`}>
                <td className="ui-left ui-num">{s.year}</td>
                <td className="ui-left">{s.school}</td>
                <td className="ui-left">{s.role === 'HC' ? 'Head coach' : s.role === 'OC' ? 'Offensive coordinator' : s.role === 'DC' ? 'Defensive coordinator' : s.role}</td>
                <td className="ui-num">{s.w !== undefined && s.l !== undefined ? `${s.w}-${s.l}${s.t ? `-${s.t}` : ''}` : ''}</td>
                <td className="ui-left">{[s.conf ? 'Conference champions' : '', s.post ?? ''].filter(Boolean).join(', ')}</td>
                <td className="ui-left">{s.src ? <a href={`https://en.wikipedia.org/wiki/${encodeURIComponent(s.src).replace(/%2F/g, '/')}`} target="_blank" rel="noreferrer" title="Open the Wikipedia page"><Tag>IRL</Tag></a> : <Tag>IRL</Tag>}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : <p className="dy-dim">No seasons yet.</p>}
      <p className="dy-dim dy-small">IRL: his real seasons before the dynasty, from Wikipedia (the link opens the page the row comes from). Dynasty: seasons played in this dynasty.</p>
      {c.formerPlayer && <PlayerCareer id={c.formerPlayer.player} drafted={c.formerPlayer.drafted} />}
    </section>
  );
}

/** The team page's coach box: the head coach this season. */
export function TeamCoach({ team }: { team: number }) {
  const { d } = useDyn();
  const c = d.coaches?.find((x) => x.team === team);
  if (!d.coaches) return null;
  return (
    <div className="dy-teamcoach">
      <SubHead>Head coach</SubHead>
      {c ? (
        <p>
          <CoachHeadshot c={c} size={48} />
          <a href={href(`coach/${c.id}`)} className="dy-teamcoach-name">{c.name}</a>
          <span className="dy-dim"> OVR </span><span className="ui-num">{coachOvr(c.ratings)}</span>{' '}
          <CoachStars stars={c.prestige} />
        </p>
      ) : <p className="dy-dim">No head coach.</p>}
    </div>
  );
}

/** A season's head coach for the team's history table. */
export function SeasonCoach({ team, seasonIndex }: { team: number; seasonIndex: number }) {
  const { d } = useDyn();
  const id = d.seasons[seasonIndex]?.coach?.[team];
  const c = id === null || id === undefined ? undefined : d.coaches?.[id];
  return c ? <CoachLink coach={c} /> : null;
}

/** The team's head coach's goals for the season and his hot seat (team and coach pages). */
export function GoalsBox({ team }: { team: number }) {
  const { d, v } = useDyn();
  const si = d.seasons.length - 1;
  const id = d.seasons[si].coach?.[team];
  const c = id === null || id === undefined ? undefined : d.coaches?.[id];
  if (!c) return null;
  const res = goalResults(d, si, team, v);
  const heat = hotSeat(d, c, si);
  const years = tenure(d, c, si);
  return (
    <div className="dy-goals">
      <SubHead>{v.season.year} goals and hot seat</SubHead>
      {heat !== null && <HeatBar heat={heat} />}
      <p className="dy-small dy-dim">{c.name}'s {ordinal(years)} season at {d.teams[team].school}. {years <= 2 ? 'He can\'t be fired in his first two seasons.' : years === 3 ? 'In his third season only a disaster (far below the win goal and a poor signing class) gets him fired.' : 'From 55 on the hot seat, the higher it is the likelier he is fired after the season.'}{d.userTeams.includes(team) && d.yourCoachFired === false ? ' Your teams\' coaches can\'t be fired (Offseason rules).' : ''}</p>
      <Table>
        <thead><tr><th className="ui-left">Goal</th><th className="ui-left">So far</th></tr></thead>
        <tbody>
          {res.map((g, i) => (
            <tr key={i}>
              <td className="ui-left">{g.text}</td>
              <td className="ui-left"><span className={g.met === true ? 'dy-w' : g.met === false ? 'dy-l' : 'dy-dim'}>{g.met === true ? 'Met' : g.met === false ? 'Missed' : 'Open'}</span>{g.result ? `: ${g.result}` : ''}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

/** Manage XP (spec: per coach, off unless the user turns it on): on, the user spends his XP on his ratings. */
function ManageXp({ c }: { c: DCoach }) {
  const { d, commit } = useDyn();
  const [add, setAdd] = useState<Partial<Record<CoachRating, number>>>({});
  const [err, setErr] = useState<string | null>(null);
  if (c.status === 'retired') return null;
  const xp = c.xp ?? 0;
  const val = (k: CoachRating) => c.ratings[k] + (add[k] ?? 0);
  let spent = 0;
  for (const k of COACH_RATINGS) for (let i = 0; i < (add[k] ?? 0); i++) spent += xpCost(c.ratings[k] + i);
  const left = xp - spent;
  const bump = (k: CoachRating, n: number) => setAdd((a) => ({ ...a, [k]: Math.max(0, (a[k] ?? 0) + n) }));
  return (
    <div className="dy-xp">
      <SubHead>Manage XP</SubHead>
      <Check checked={!!c.manageXp} onChange={(on) => { setAdd({}); void commit(setManageXp(d, c.id, on)); }}>I spend his XP</Check>
      <p className="dy-small dy-dim">
        Head coaches earn XP each season: wins, postseason wins, titles, goals met and the signing class. Off: it's spent for him on his best areas when the season ends.
        On: you spend it here, and he gets job offers from other schools each offseason (the coaching carousel). A point costs more the higher the rating: 40 XP below 70, 80 to 79, 150 to 89, 300 from 90.
      </p>
      {c.manageXp && (
        <>
          <p><span className="ui-num">{left.toLocaleString('en-US')}</span> XP to spend{spent ? ` (${spent.toLocaleString('en-US')} picked)` : ''}</p>
          <Table>
            <thead><tr><th className="ui-left">Rating</th><th>Now</th><th>Next point</th><th></th></tr></thead>
            <tbody>
              {COACH_RATINGS.map((k) => (
                <tr key={k}>
                  <td className="ui-left">{COACH_RATING_LABELS[k]}</td>
                  <td className="ui-num">{val(k)}{add[k] ? <span className="dy-w"> +{add[k]}</span> : ''}</td>
                  <td className="ui-num">{val(k) >= 99 ? '' : xpCost(val(k))}</td>
                  <td className="dy-xp-btns">
                    <Button variant="quiet" label={`Take 1 off ${COACH_RATING_LABELS[k]}`} disabled={!add[k]} onClick={() => bump(k, -1)}>−</Button>
                    <Button variant="quiet" label={`Add 1 to ${COACH_RATING_LABELS[k]}`} disabled={val(k) >= 99 || xpCost(val(k)) > left} onClick={() => bump(k, 1)}>+</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          {err && <Note kind="error">{err}</Note>}
          <div className="dy-row">
            <Button disabled={!spent} onClick={() => { try { void commit(spendXp(d, c.id, add)); setAdd({}); setErr(null); } catch (e) { setErr((e as Error).message); } }}>Save</Button>
            <Button variant="quiet" disabled={!spent} onClick={() => setAdd({})}>Reset</Button>
          </div>
        </>
      )}
    </div>
  );
}

/** A former player's playing career in the dynasty (spec: at the bottom of his coach page). */
function PlayerCareer({ id, drafted }: { id: number; drafted: boolean }) {
  const { d } = useDyn();
  const p = d.players[id - 1];
  if (!p) return null;
  const years = p.years ?? [];
  return (
    <>
      <SubHead>Player career</SubHead>
      <p>
        <a href={href(`player/${p.id}`)}>{p.pos} {p.first} {p.last}</a>
        {p.leftYear !== undefined && <span className="dy-dim"> · left after {p.leftYear}{drafted ? ', drafted' : ''}</span>}
      </p>
      {years.length > 0 && (
        <Table>
          <thead><tr><th className="ui-left">Season</th><th className="ui-left">School</th><th className="ui-left">Pos</th><th className="ui-left">Class</th><th>OVR</th></tr></thead>
          <tbody>
            {years.map((y) => (
              <tr key={y.year}><td className="ui-left ui-num">{y.year}</td><td className="ui-left"><TeamLink team={y.team} rank={false} /></td><td className="ui-left">{y.pos}</td><td className="ui-left">{y.cls}</td><td className="ui-num">{y.ovr}</td></tr>
            ))}
          </tbody>
        </Table>
      )}
      <p className="dy-small dy-dim">His stats and honors are on his player page.</p>
    </>
  );
}

/** Edit a coach's headshot (any time; only the app's portrait, nothing goes into the ROM). */
function EditCoachLook({ c }: { c: DCoach }) {
  const { d, v, commit } = useDyn();
  const [open, setOpen] = useState(false);
  const year = d.offseason ? d.offseason.year + 1 : v.season.year;
  const ch = coachLookChoices(c, year);
  const set = (look: Parameters<typeof setCoachLook>[2]) => void commit(setCoachLook(d, c.id, look));
  if (!open) return <div className="dy-row"><Button variant="quiet" onClick={() => setOpen(true)}>Edit appearance</Button></div>;
  return (
    <div className="dy-coachlook">
      <Select label="Headwear" value={ch.hat} onChange={(x) => set({ hat: x as typeof ch.hat })} options={COACH_HATS.map((x) => ({ value: x, label: COACH_HAT_LABELS[x] }))} />
      <Select label="Glasses" value={ch.glasses} onChange={(x) => set({ glasses: x as typeof ch.glasses })} options={COACH_GLASSES.map((x) => ({ value: x, label: COACH_GLASSES_LABELS[x] }))} />
      <Select label="Hair" value={ch.hair} onChange={(x) => set({ hair: x as typeof ch.hair })} options={COACH_HAIR.map((x) => ({ value: x, label: COACH_HAIR_LABELS[x] }))} />
      <Select label="Hair color" value={String(ch.hairColor)} onChange={(x) => set({ hairColor: Number(x) })} options={COACH_HAIR_COLOR_LABELS.map((x, i) => ({ value: String(i), label: x }))} />
      <Select label="Skin tone" value={String(ch.skin)} onChange={(x) => set({ skin: Number(x) })} options={SKIN_LABELS.map((x, i) => ({ value: String(i), label: x }))} />
      <Select label="Facial hair" value={ch.beard} onChange={(x) => set({ beard: x as typeof ch.beard })} options={[{ value: 'none', label: 'None' }, { value: 'stubble', label: 'Stubble' }, { value: 'goatee', label: 'Goatee' }, { value: 'beard', label: 'Beard' }]} />
      <div className="dy-row"><Button variant="quiet" onClick={() => setOpen(false)}>Done</Button></div>
    </div>
  );
}
