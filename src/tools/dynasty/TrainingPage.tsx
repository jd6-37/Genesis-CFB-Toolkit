// Training results (user, 2026-11-12: "a Training Results page, roster ordered by most improved"): a team's
// returning players after an offseason's training, biggest OVR gain first, with what each rating did.
import { PageHead, Select, SubHead } from '../../ui';
import { useMemo } from 'react';
import { trainingResults, trainingYears, type TrainingRow } from '../../core/dynasty/career';
import { playerName } from '../../core/dynasty/derive';
import { RATINGS } from '../../core/dynasty/ratings';
import { Empty, TeamLink, href, useDyn } from './ui';

const SHORT: Record<string, string> = {
  Speed: 'SPD', Quickness: 'QUI', Power: 'POW', Awareness: 'AWR', Hands: 'HND', Range: 'RNG', Accuracy: 'ACC', Blocking: 'BLK', Tackling: 'TKL',
};

/** The ratings that moved (by at least half a point), biggest first; Weight in pounds at the end. */
function changes(row: TrainingRow): { label: string; up: boolean }[] {
  const out: { label: string; v: number; up: boolean }[] = [];
  let lbs = 0;
  RATINGS.forEach((a, i) => {
    const dv = row.r[i] - row.before.r[i];
    if (a === 'Weight') { lbs = Math.round(dv); return; }
    if (Math.abs(dv) >= 0.5) out.push({ label: `${SHORT[a] ?? a} ${dv > 0 ? '+' : '−'}${Math.round(Math.abs(dv))}`, v: dv, up: dv > 0 });
  });
  out.sort((a, b) => b.v - a.v);
  if (lbs) out.push({ label: `${lbs > 0 ? '+' : '−'}${Math.abs(lbs)} lb`, v: 0, up: lbs > 0 });
  return out;
}

export function TrainingResults({ arg }: { arg?: string }) {
  const { d } = useDyn();
  const years = trainingYears(d);
  const [t0, y0] = (arg ?? '').split('-').map(Number);
  const team = Number.isInteger(t0) && d.teams[t0] ? t0 : d.userTeams[0] ?? 0;
  const year = years.includes(y0) ? y0 : years[0];
  const rows = useMemo(() => (year ? trainingResults(d, team, year) : []), [d, team, year]);
  if (!years.length) return <Empty><p>Training results show after the first offseason's training (the cuts step).</p></Empty>;
  const go = (t: number, y: number) => { location.hash = href(`training/${t}-${y}`); };
  const others = d.teams.filter((t) => !d.userTeams.includes(t.index)).sort((a, b) => a.school.localeCompare(b.school));
  const gains = rows.map((r) => r.ovr - r.before.ovr);
  const avg = gains.length ? gains.reduce((a, b) => a + b, 0) / gains.length : 0;
  return (
    <section className="dy-train">
      <PageHead title="Training results" />
      <div className="dy-train-pick">
        <Select
          label="Team" value={team}
          options={[
            ...d.userTeams.map((t) => ({ value: t, label: d.teams[t].school, group: 'Your teams' })),
            ...others.map((t) => ({ value: t.index, label: t.school, group: 'All teams' })),
          ]}
          onChange={(x) => go(Number(x), year)}
        />
        <Select label="Offseason" value={year} options={years.map((y) => ({ value: y, label: `${y - 1} to ${y}` }))} onChange={(x) => go(team, Number(x))} />
      </div>
      <SubHead><TeamLink team={team} rank={false} /></SubHead>
      {rows.length ? (
        <>
          <p className="dy-small dy-dim">
            {rows.length} returning players, {avg >= 0 ? '+' : '−'}{Math.abs(avg).toFixed(1)} OVR on average. Players signed this offseason develop from next year.
          </p>
          <ol className="dy-train-list">
            {rows.map((row) => {
              const gain = row.ovr - row.before.ovr;
              return (
                <li key={row.player.id}>
                  <div className="dy-train-who">
                    <a href={href(`player/${row.player.id}`)}>{playerName(row.player)}</a>
                    <span className="dy-dim">{row.player.pos}, {row.before.cls} to {row.player.years?.find((y) => y.year === year)?.cls ?? row.player.cls}</span>
                    {row.from !== null && <span className="dy-dim">from {d.teams[row.from].school}</span>}
                  </div>
                  <div className="dy-train-ovr">
                    <span>{row.before.ovr} → <b>{row.ovr}</b></span>
                    <span className={gain > 0 ? 'dy-train-up' : gain < 0 ? 'dy-train-down' : 'dy-dim'}>{gain > 0 ? `+${gain}` : gain < 0 ? `−${-gain}` : '±0'}</span>
                  </div>
                  <ul className="dy-train-chips">
                    {changes(row).map((c) => <li key={c.label} className={c.up ? '' : 'dy-train-chip-down'}>{c.label}</li>)}
                  </ul>
                </li>
              );
            })}
          </ol>
        </>
      ) : <p className="dy-dim">No returning players on this team that year.</p>}
    </section>
  );
}
