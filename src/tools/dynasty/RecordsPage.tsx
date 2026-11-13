// The records book (records.ts): single-season and career player records and team records,
// league-wide or one school's. Mobile first: the tables stack on phones.
import { PageHead, SubHead, Table } from '../../ui';
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
      <PageHead title="Records book">{school !== undefined ? `${d.teams[school].school} records` : 'League records'} since {d.startYear}.</PageHead>
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
          <SubHead>{st.label} in a season</SubHead>
          {season.length ? (
            <Table figures>
              <tbody>
                {season.map((r, i) => (
                  <tr key={i}>
                    <td className="dy-dim">{i + 1}</td>
                    <td className="ui-left">{who(r.player)}{school === undefined && <div className="dy-small dy-dim">{d.teams[r.team].school}</div>}</td>
                    <td className="ui-text dy-rec-year">{r.year}</td>
                    <td className="dy-strong">{r.value.toLocaleString('en-US')}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : <p className="dy-dim">No stats yet.</p>}
        </div>
        <div>
          <SubHead>{st.label} in a career</SubHead>
          {career.length ? (
            <Table figures>
              <tbody>
                {career.map((r, i) => (
                  <tr key={r.player}>
                    <td className="dy-dim">{i + 1}</td>
                    <td className="ui-left">{who(r.player)}{school === undefined && <div className="dy-small dy-dim">{d.teams[r.team].school}</div>}</td>
                    <td className="ui-text dy-rec-year">{r.first === r.last ? r.first : `${r.first}-${String(r.last).slice(2)}`}</td>
                    <td className="dy-strong">{r.value.toLocaleString('en-US')}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : <p className="dy-dim">No stats yet.</p>}
        </div>
      </div>
      <SubHead>Team records</SubHead>
      <div className="dy-records-teams">
        {teams.map((t) => (
          <div key={t.label}>
            <h4>{t.label}</h4>
            {t.list.length ? (
              <Table figures>
                <tbody>
                  {t.list.map((r, i) => (
                    <tr key={i}>
                      <td className="dy-strong">{r.value.toLocaleString('en-US')}</td>
                      <td className="ui-left">{school === undefined && <TeamLink team={r.team} rank={false} size={16} />}<div className="dy-small dy-dim">{r.note}</div></td>
                      <td className="ui-text dy-rec-year">{r.year}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            ) : <p className="dy-dim dy-small">Once a season is over.</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
