// The front page's extras (user, 2026-11-12). In the season: next week's big games and a Heisman watch in
// the side column, the playoff picture, the national leaders and your conference in a band across the page
// below; in the offseason, your commitments and the class rankings in the side column.

import { SubHead } from '../../ui';
import { useMemo } from 'react';
import { INDEPENDENT, leaders, playerLines, playerName, standings, statValue, weekName, type PlayerLine, type StatCategory } from '../../core/dynasty/derive';
import { bigGames, heismanWatch, playoffPicture } from '../../core/dynasty/outlook';
import { classRankings, STAR_POINTS } from '../../core/dynasty/offseason';
import { TeamLink, href, playerOf, recordText, useDyn } from './ui';

export function SeasonSide() {
  const { d, v } = useDyn();
  if (!v.save || d.offseason) return <PreseasonClasses />;
  return (
    <>
      <BigGames />
      <Heisman />
    </>
  );
}

/** Below both columns, across the page: the playoff picture, the national leaders, your conference. */
export function SeasonMore() {
  const { d, v } = useDyn();
  if (!v.save || d.offseason) return null;
  return (
    <div className="dy-front-more">
      <Playoff />
      <NationalLeaders />
      <YourConferences />
    </div>
  );
}

export function OffseasonSide() {
  const { d } = useDyn();
  if (!d.offseason) return null;
  return (
    <>
      <Commitments />
      <ClassRankings events={d.offseason.events} />
    </>
  );
}

/** Before the first game of a season: the classes it signed. */
function PreseasonClasses() {
  const { d, v } = useDyn();
  if (d.offseason || v.save || !v.season.events) return null;
  return <ClassRankings events={v.season.events} />;
}

function PlayerLink({ id }: { id: number | null }) {
  const { d } = useDyn();
  const p = playerOf(d, id);
  return p ? <a href={href(`player/${p.id}`)}>#{p.jersey} {playerName(p)}</a> : <span className="dy-dim">Unknown player</span>;
}

function BigGames() {
  const { v } = useDyn();
  const week = v.currentWeek;
  if (week >= v.weeks) return null;
  const games = bigGames(v, week);
  if (!games.length) return null;
  return (
    <section>
      <SubHead level={2}>{weekName(v, week)}'s big games</SubHead>
      <ul className="dy-side-list dy-side-games">
        {games.map((g) => (
          <li key={g.index}>
            {g.visitor !== null ? <TeamLink team={g.visitor} /> : 'To be decided'}
            <span className="dy-dim"> at </span>
            {g.home !== null ? <TeamLink team={g.home} /> : 'To be decided'}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Playoff() {
  const { d, v } = useDyn();
  const pic = useMemo(() => playoffPicture(d, v), [d, v]);
  if (!pic) return null;
  const name = pic.size === 2 ? 'BCS' : `CFP ${pic.size}`;
  const row = (t: number, seed: number) => (
    <li key={t}>
      <span className="dy-side-n">{seed}</span>
      <TeamLink team={t} rank={false} />
      <span className="dy-num">{recordText(v.records[t])}</span>
      {pic.auto.has(t) && <span className="dy-tag" title="Automatic bid: conference leader">Auto</span>}
    </li>
  );
  // CFP 24: the eight with byes, then the last four in; the others in full.
  const shown = pic.size === 24 ? [...pic.field.slice(0, 8).map((t, i) => row(t, i + 1))] : pic.field.map((t, i) => row(t, i + 1));
  return (
    <section>
      <SubHead level={2}>Playoff picture</SubHead>
      <p className="dy-dim dy-small">{pic.final ? `The ${name} field.` : `${name}, if the season ended today: conference leaders take the automatic bids, the rest by the Top 25.`}</p>
      {pic.size === 24 && <h3 className="dy-side-sub">Byes</h3>}
      <ol className="dy-side-rank">{shown}</ol>
      {pic.size === 24 && (
        <>
          <h3 className="dy-side-sub">Last four in</h3>
          <ol className="dy-side-rank">{pic.field.slice(20).map((t, i) => row(t, i + 21))}</ol>
        </>
      )}
      {!pic.final && pic.out.length > 0 && (
        <>
          <h3 className="dy-side-sub">First four out</h3>
          <ul className="dy-side-rank">
            {pic.out.map((t) => (
              <li key={t}>
                <span className="dy-side-n" />
                <TeamLink team={t} />
                <span className="dy-num">{recordText(v.records[t])}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** "1,234 passing yards, 12 TD": the player's biggest line. */
function keyLine(lines: PlayerLine[]): string {
  const yds = (l: PlayerLine) => statValue(l, 'yds');
  const best = [...lines].sort((a, b) => yds(b) - yds(a))[0];
  if (!best) return '';
  const word = best.cat === 'passing' ? 'passing' : best.cat === 'rushing' ? 'rushing' : 'receiving';
  return `${yds(best).toLocaleString('en-US')} ${word} yards, ${statValue(best, 'td')} TD`;
}

function Heisman() {
  const { d, v } = useDyn();
  const list = useMemo(() => heismanWatch(v), [v]);
  if (!list.length) return null;
  return (
    <section>
      <SubHead level={2}>Heisman watch</SubHead>
      <ol className="dy-side-rank">
        {list.map((e, i) => (
          <li key={e.player} className="dy-side-player">
            <span className="dy-side-n">{i + 1}</span>
            <span>
              <PlayerLink id={e.player} />
              <span className="dy-side-meta">{v.season.bw?.[e.team]?.[e.lines[0].slot]?.label ?? playerOf(d, e.player)?.pos}, {d.teams[e.team].school}: {keyLine(e.lines)}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

const LEADER_CATS: [StatCategory, string][] = [['passing', 'Passing yards'], ['rushing', 'Rushing yards'], ['receiving', 'Receiving yards']];

function NationalLeaders() {
  const { d, v } = useDyn();
  const lines = useMemo(() => playerLines(v), [v]);
  if (!lines.length) return null;
  return (
    <section>
      <SubHead level={2}><a href={href('stats')}>National leaders</a></SubHead>
      {LEADER_CATS.map(([cat, label]) => {
        const top = leaders(lines, cat, 'yds', 3);
        if (!top.length) return null;
        return (
          <div key={cat}>
            <h3 className="dy-side-sub">{label}</h3>
            <ol className="dy-side-rank">
              {top.map((l, i) => (
                <li key={`${l.team}-${l.slot}`} className="dy-side-player">
                  <span className="dy-side-n">{i + 1}</span>
                  <span>
                    <PlayerLink id={l.player} />
                    <span className="dy-side-meta">{d.teams[l.team].school}</span>
                  </span>
                  <span className="dy-num">{statValue(l, 'yds').toLocaleString('en-US')}</span>
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </section>
  );
}

function YourConferences() {
  const { d, v } = useDyn();
  const confs = [...new Set(d.userTeams.map((t) => v.season.conf[t]))].filter((c) => c !== INDEPENDENT);
  if (!confs.length) return null;
  return (
    <>
      {confs.map((c) => (
        <section key={c}>
          <SubHead level={2}><a href={href('standings')}>{v.season.confNames[c]}</a></SubHead>
          <table className="dy-table dy-side-table">
            <thead><tr><th className="dy-left">Team</th><th>Conf</th><th>Overall</th></tr></thead>
            <tbody>
              {standings(v, c).map((r) => (
                <tr key={r.team} className={d.userTeams.includes(r.team) ? 'dy-side-mine' : undefined}>
                  <td className="dy-left"><TeamLink team={r.team} /></td>
                  <td>{r.cw}-{r.cl}</td>
                  <td>{recordText(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </>
  );
}

function Commitments() {
  const { d } = useDyn();
  const rs = d.offseason?.recruiting;
  if (!rs || !d.userTeams.length) return null;
  return (
    <section>
      <SubHead level={2}><a href={href('offseason')}>Your commitments</a></SubHead>
      {d.userTeams.map((t) => {
        const mine = rs.prospects.filter((p) => p.committed === t).sort((a, b) => b.stars - a.stars || a.player.last.localeCompare(b.player.last));
        return (
          <div key={t}>
            {d.userTeams.length > 1 && <h3 className="dy-side-sub">{d.teams[t].school}</h3>}
            {mine.length ? (
              <ul className="dy-side-list">
                {mine.slice(0, 6).map((p) => (
                  <li key={p.id}>
                    <span className="dy-stars" aria-label={`${p.stars} stars`}>{'★'.repeat(p.stars)}</span> {p.player.pos} {p.player.first} {p.player.last}
                  </li>
                ))}
                {mine.length > 6 && <li className="dy-dim">and {mine.length - 6} more</li>}
              </ul>
            ) : <p className="dy-dim dy-small">No commitments yet.</p>}
          </div>
        );
      })}
    </section>
  );
}

function ClassRankings({ events }: { events: Parameters<typeof classRankings>[0] }) {
  const { d } = useDyn();
  const rs = d.offseason?.recruiting;
  // After signing day the classes; while recruiting, the commitments so far (class points).
  let rows = classRankings(events).map((c) => ({ team: c.team, n: c.signed, points: c.points }));
  let title = 'Top classes';
  if (!rows.length && rs) {
    const by = new Map<number, { n: number; points: number }>();
    for (const p of rs.prospects) {
      if (p.committed === null) continue;
      const e = by.get(p.committed) ?? { n: 0, points: 0 };
      by.set(p.committed, { n: e.n + 1, points: e.points + STAR_POINTS[p.stars] });
    }
    rows = [...by].map(([team, e]) => ({ team, ...e })).sort((a, b) => b.points - a.points);
    title = 'Recruiting rankings';
  }
  if (!rows.length) return null;
  return (
    <section>
      <SubHead level={2}>{title}</SubHead>
      <ol className="dy-side-rank">
        {rows.slice(0, 10).map((r, i) => (
          <li key={r.team}>
            <span className="dy-side-n">{i + 1}</span>
            <TeamLink team={r.team} rank={false} />
            <span className="dy-num">{r.n} {r.n === 1 ? 'player' : 'players'}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
