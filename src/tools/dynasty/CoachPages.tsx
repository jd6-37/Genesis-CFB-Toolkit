// The coaches' pages (spec: claude.ai project notes bw95-dynasty-coaches-spec.md; mockups: the "Dynasty coaches
// mockups" canvas): the Coaches page (every coach, by job) and a page per coach (ratings against the average
// head coach, his record and career, real seasons marked IRL).
import { useMemo, useState } from 'react';
import {
  COACH_RATINGS, COACH_RATING_HELPS, COACH_RATING_LABELS, coachAge, coachOvr, coachRecord, dynastySeasons, headCoachField, type DCoach,
} from '../../core/dynasty/coaches';
import { DataTable, Empty, Field, PageHead, SubHead, Table, Tabs, Tag } from '../../ui';
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

type Show = 'head' | 'pool' | 'all';

export function Coaches() {
  const { d, v } = useDyn();
  const [show, setShow] = useState<Show>('head');
  const [q, setQ] = useState('');
  const all = d.coaches ?? [];
  const year = v.season.year;
  const rows = useMemo(() => {
    const want = q.trim().toLowerCase();
    return all
      .filter((c) => c.status !== 'retired' || show === 'all')
      .filter((c) => (show === 'head' ? c.team !== null : show === 'pool' ? c.team === null && c.status === 'pool' : true))
      .filter((c) => !want || c.name.toLowerCase().includes(want) || (c.team !== null && d.teams[c.team].school.toLowerCase().includes(want)) || (c.poolNote ?? '').toLowerCase().includes(want))
      .map((c) => ({ c, ovr: coachOvr(c.ratings), rec: coachRecord(d, c) }))
      .sort((a, b) => b.ovr - a.ovr || a.c.name.localeCompare(b.c.name));
  }, [all, show, q, d]);
  if (!d.coaches) return <Empty><p>The coaches are being added to this dynasty. Reload the page if they don't appear.</p></Empty>;
  const heads = all.filter((c) => c.team !== null).length;
  const pool = all.filter((c) => c.team === null && c.status === 'pool').length;
  return (
    <section>
      <PageHead title="Coaches" />
      <p className="dy-dim dy-small">Every team's head coach, and the pool of coaches without a head coaching job: coordinators and head coaches out of work. Ratings are made by the app from each coach's record; no real source rates coaches.</p>
      <div className="dy-coach-tools">
        <Tabs label="Coaches" value={show} onChange={setShow} tabs={[{ value: 'head', label: 'Head coaches', count: heads }, { value: 'pool', label: 'Pool', count: pool }, { value: 'all', label: 'All', count: all.length }]} />
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
          { key: 'rec', label: 'Record', num: true, cell: (r) => recordText(r.rec) },
        ]}
      />
    </section>
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
          {team !== null && <a href={href(`team/${team}`)} aria-label={d.teams[team].school}><TeamMark team={team} size={96} /></a>}
          <div>
            <h2>{c.name}</h2>
            <p>
              <span>{job}</span>
              <CoachStars stars={c.prestige} />
              <span>Age {coachAge(c, year)}{c.bornGuess ? ' (estimated)' : ''}</span>
              {c.hometown && <span>{c.hometown}</span>}
              {c.alma && <span>{c.alma}</span>}
              {recordText(rec) && <span className="dy-record">Head coach record <strong>{recordText(rec)}</strong></span>}
            </p>
          </div>
        </div>
        <dl className={`dy-teamovr${bg && onColor(bg) === '#000' ? ' dy-on-light' : ''}`}>
          <div><dt>OVR</dt><dd>{coachOvr(c.ratings)}</dd></div>
        </dl>
      </header>

      <SubHead>Ratings</SubHead>
      <CoachRatingsBox c={c} color={ink} />

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
