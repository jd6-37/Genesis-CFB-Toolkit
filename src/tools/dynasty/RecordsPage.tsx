// The records book (records.ts): single-season and career player records and team records,
// league-wide or one school's. Mobile first: the tables stack on phones.
import { useMemo, useState } from 'react';
import { playerName, RECORD_STATS, seasonRecords } from '../../core/dynasty/derive';
import { careerRecords, teamRecords } from '../../core/dynasty/records';
import { TeamLink, href, playerOf, useDyn } from './ui';

export function Records({ arg }: { arg?: string }) {
  const { d } = useDyn();
  const [stat, setStat] = useState(0);
  const school = arg !== undefined && arg !== '' && d.teams[Number(arg)] ? Number(arg) : undefined;
  const st = RECORD_STATS[stat];
  const season = useMemo(() => seasonRecords(d, st, school), [d, st, school]);
  const career = useMemo(() => careerRecords(d, st, school), [d, st, school]);
  const teams = useMemo(() => teamRecords(d, school), [d, school]);
  const others = useMemo(() => d.teams.filter((t) => !d.userTeams.includes(t.index)).sort((a, b) => a.school.localeCompare(b.school)), [d]);
  const who = (id: number | null) => {
    const p = id !== null ? playerOf(d, id) : undefined;
    return p ? <a href={href(`player/${p.id}`)}>{playerName(p)}</a> : 'Unknown player';
  };
  return (
    <section className="dy-records">
      <div className="dy-pagehead">
        <h2>Records book</h2>
        <p>{school !== undefined ? `${d.teams[school].school} records` : 'League records'} since {d.startYear}.</p>
      </div>
      <div className="dy-row dy-records-pick">
        <select aria-label="School" value={school ?? ''} onChange={(e) => { location.hash = href(e.target.value === '' ? 'records' : `records/${e.target.value}`); }}>
          <option value="">Whole league</option>
          {d.userTeams.map((t) => <option key={t} value={t}>{d.teams[t].school}</option>)}
          <option disabled>──────────</option>
          {others.map((t) => <option key={t.index} value={t.index}>{t.school}</option>)}
        </select>
        <select aria-label="Stat" value={stat} onChange={(e) => setStat(Number(e.target.value))}>
          {RECORD_STATS.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
        </select>
      </div>
      <div className="dy-team-cols">
        <div>
          <h3 className="dy-sub">{st.label} in a season</h3>
          {season.length ? (
            <table className="dy-table">
              <tbody>
                {season.map((r, i) => (
                  <tr key={i}>
                    <td className="dy-dim">{i + 1}</td>
                    <td className="dy-left">{who(r.player)}{school === undefined && <div className="dy-small dy-dim">{d.teams[r.team].school}</div>}</td>
                    <td>{r.year}</td>
                    <td className="dy-strong">{r.value.toLocaleString('en-US')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="dy-dim">No stats yet.</p>}
        </div>
        <div>
          <h3 className="dy-sub">{st.label} in a career</h3>
          {career.length ? (
            <table className="dy-table">
              <tbody>
                {career.map((r, i) => (
                  <tr key={r.player}>
                    <td className="dy-dim">{i + 1}</td>
                    <td className="dy-left">{who(r.player)}{school === undefined && <div className="dy-small dy-dim">{d.teams[r.team].school}</div>}</td>
                    <td>{r.first === r.last ? r.first : `${r.first}-${String(r.last).slice(2)}`}</td>
                    <td className="dy-strong">{r.value.toLocaleString('en-US')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="dy-dim">No stats yet.</p>}
        </div>
      </div>
      <h3 className="dy-sub">Team records</h3>
      <div className="dy-records-teams">
        {teams.map((t) => (
          <div key={t.label}>
            <h4>{t.label}</h4>
            {t.list.length ? (
              <table className="dy-table">
                <tbody>
                  {t.list.map((r, i) => (
                    <tr key={i}>
                      <td className="dy-strong">{r.value.toLocaleString('en-US')}</td>
                      <td className="dy-left">{school === undefined && <TeamLink team={r.team} rank={false} size={16} />}<div className="dy-small dy-dim">{r.note}</div></td>
                      <td>{r.year}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="dy-dim dy-small">Once a season is over.</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
