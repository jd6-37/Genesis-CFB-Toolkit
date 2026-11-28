// The front page's extras (user, 2026-11-12). In the season: next week's big games and a Heisman watch in
// the side column, the playoff picture (1994: the bowl games), the national leaders and your conference in a band across the page
// below; in the offseason, your commitments and the class rankings in the side column.

import { hasNil, money } from '../../core/dynasty/nil';
import { SubHead, Table } from '../../ui';
import { useMemo } from 'react';
import { bowlOf, bowlWeek, INDEPENDENT, leaders, playerLines, playerName, standings, statValue, weekName, type PlayerLine, type StatCategory } from '../../core/dynasty/derive';
import { bigGames, heismanWatch, playoffPicture } from '../../core/dynasty/outlook';
import { preseasonHeisman } from '../../core/dynasty/heismanPre';
import { classRankings, STAR_POINTS } from '../../core/dynasty/offseason';
import { TeamLink, href, playerOf, recordText, useDyn, Ranked } from './ui';
import { preseasonPoll } from '../../core/dynasty/poll';

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
      <Bowls />
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
      <NilBox />
      <Commitments />
      <ClassRankings events={d.offseason.events} />
    </>
  );
}

/**
 * Your teams' NIL in the offseason (NIL dynasties; user-approved mockup 2026-11-23: "the booster line in What's next"):
 * next season's budget and the boosters' change.
 */
function NilBox() {
  const { d } = useDyn();
  const sn = d.offseason?.nil;
  if (!hasNil(d) || !sn) return null;
  return (
    <section>
      <SubHead level={2}>NIL</SubHead>
      {d.userTeams.map((t) => {
        const b = sn.boost[t] ?? 0;
        return (
          <p key={t} className="dy-small">
            <a href={href(`team/${t}/nil`)}><b>{d.teams[t].school}</b></a>: {money(sn.budget[t] ?? 0)} for {d.offseason!.year}.
            {' '}Boosters <b className={b >= 0 ? 'dy-up' : 'dy-down'}>{b >= 0 ? '+' : ''}{Math.round(b * 100)}%</b>{(sn.donor?.[t] ?? 0) > 0 ? ', and a big donor backs the program' : ''}.
          </p>
        );
      })}
    </section>
  );
}

/** Before the first game of a season: the classes it signed. */
function PreseasonClasses() {
  const { d, v } = useDyn();
  if (d.offseason || v.save) return null;
  const poll = preseasonPoll(d, v.season);
  return (
    <>
      {poll && (
        <section>
          <SubHead level={2}>Preseason Top 25</SubHead>
          <PreseasonTop25 compact />
          {!poll[0]?.real && <p className="dy-small"><a href={href('rankings')}>Points and last year's finish</a></p>}
        </section>
      )}
      <PreseasonHeisman />
      {v.season.events && <ClassRankings events={v.season.events} />}
    </>
  );
}

/** The preseason Heisman favorites (heismanPre.ts), in the Heisman watch's place until the first games are in. */
function PreseasonHeisman() {
  const { d, v } = useDyn();
  const pre = useMemo(() => preseasonHeisman(d, v.season, 5), [d, v.season]);
  if (!pre.length) return null;
  return (
    <section>
      <SubHead level={2}>Preseason Heisman favorites</SubHead>
      <ol className="dy-side-rank">
        {pre.map((h, i) => (
          <li key={h.player} className="dy-side-player">
            <span className="dy-side-n">{i + 1}</span>
            <span>
              <PlayerLink id={h.player} />
              <span className="dy-side-meta">{v.season.bw?.[h.team]?.[h.slot]?.label ?? h.role}, <Ranked team={h.team} />: OVR {h.ovr}{h.last ? `; last year ${h.last}` : ''}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PlayerLink({ id }: { id: number | null }) {
  const { d } = useDyn();
  const p = playerOf(d, id);
  return p ? <a href={href(`player/${p.id}`)}>{p.jersey >= 0 && (p.first || p.last) && `#${p.jersey} `}{playerName(p)}</a> : <span className="dy-dim">Unknown player</span>;
}

function BigGames() {
  const { v } = useDyn();
  const week = v.currentWeek;
  if (week >= v.weeks) return null;
  const games = bigGames(v, week);
  if (!games.length) return null;
  return (
    <section>
      <SubHead level={2}>{bigGamesTitle(weekName(v, week))}</SubHead>
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

/** 1994: the bowl games once the game has set them (after the last regular-season week), with their results. */
function Bowls() {
  const { v } = useDyn();
  if (!v.bowls) return null;
  const games = v.games.filter((g) => g.week === bowlWeek(v) && g.visitor !== null && g.home !== null);
  if (!games.length) return null;
  return (
    <section>
      <SubHead level={2}>Bowl games</SubHead>
      <ul className="dy-side-list dy-side-games">
        {games.map((g) => (
          <li key={g.index}>
            <span className="dy-small dy-dim dy-bowl-name">{bowlOf(v, g)}</span>
            <span className="dy-bowl-team"><TeamLink team={g.visitor!} />{g.vs !== null && <span className="dy-num">{g.vs}</span>}</span>
            <span className="dy-dim">vs.</span>
            <span className="dy-bowl-team"><TeamLink team={g.home!} />{g.hs !== null && <span className="dy-num">{g.hs}</span>}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "Week 5's big games", "Quarterfinals' big games" (a plural round name takes the apostrophe alone). */
const bigGamesTitle = (week: string) => `${week}${week.endsWith('s') ? "'" : "'s"} big games`;

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
      <p className="dy-small"><a href={href('scores/bracket')}>{pic.size === 2 ? 'BCS bracket' : 'CFP bracket'}</a></p>
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
  // Before the season's first games: the preseason favorites (user, 2026-11-18: "The pre-season favs would go away
  // once the season starts, replaced by the Watch").
  if (!list.length) return <PreseasonHeisman />;
  return (
    <section>
      <SubHead level={2}>Heisman watch</SubHead>
      <ol className="dy-side-rank">
        {list.map((e, i) => (
          <li key={e.player} className="dy-side-player">
            <span className="dy-side-n">{i + 1}</span>
            <span>
              <PlayerLink id={e.player} />
              <span className="dy-side-meta">{v.season.bw?.[e.team]?.[e.lines[0].slot]?.label ?? playerOf(d, e.player)?.pos}, <Ranked team={e.team} />: {keyLine(e.lines)}</span>
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
                    <span className="dy-side-meta"><Ranked team={l.team} /></span>
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
          <Table figures className="dy-side-table">
            <thead><tr><th className="ui-left">Team</th><th>Conf</th><th>Overall</th></tr></thead>
            <tbody>
              {standings(v, c).map((r) => (
                <tr key={r.team} className={d.userTeams.includes(r.team) ? 'dy-side-mine' : undefined}>
                  <td className="ui-left"><TeamLink team={r.team} /></td>
                  <td>{r.cw}-{r.cl}</td>
                  <td>{recordText(r)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
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
            <TeamLink team={r.team} />
            <span className="dy-num">{r.n} {r.n === 1 ? 'player' : 'players'}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The preseason poll (poll.ts) before a season's first import: the real AP poll in the first season, the app's after. */
export function PreseasonTop25({ compact = false }: { compact?: boolean }) {
  const { d, v } = useDyn();
  const poll = useMemo(() => preseasonPoll(d, v.season), [d, v.season]);
  if (!poll) return null;
  return (
    <ol className={`dy-top25${compact ? ' dy-compact' : ''}`}>
      {(compact ? poll.slice(0, 25) : poll).map((p, i) => {
        // The page lists every team (user, 2026-11-26), 26 and on in shorter rows with no points.
        const rest = i >= 25;
        return (
          <li key={p.team} className={rest ? `dy-top-rest${i === 25 ? ' dy-top-rest-first' : ''}` : undefined}>
            <span className="dy-top-n">{p.rank}</span>
            <TeamLink team={p.team} rank={false} size={compact || rest ? 20 : 48} />
            {!p.real && !rest && <span className="dy-num">{p.points}{p.firstVotes > 0 && !compact ? ` (${p.firstVotes})` : ''}</span>}
            {(p.real || rest) && <span />}
            {!compact && <span className="dy-move">{p.lastRank === null ? '' : p.lastRank <= 25 || rest ? `Was No. ${p.lastRank}` : 'Was unranked'}</span>}
          </li>
        );
      })}
    </ol>
  );
}
