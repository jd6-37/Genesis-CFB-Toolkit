// The Dynasty's reading pages: the news front page, scores, standings, rankings, teams, players,
// stat leaders and history.
import { useMemo, useState } from 'react';
import {
  champions, leaders, playerLines, playerName, RECORD_STATS, seasonRecords, standings, statValue, teamHistory, weekName,
  INDEPENDENT, type PlayerLine, type StatCategory,
} from '../../core/dynasty/derive';
import { stories } from '../../core/dynasty/news';
import type { SaveGame } from '../../core/dynasty/save';
import { nibbleToRating, nibbleToWeight, rosterLayout } from '../../core/rosterLayouts';
import { Empty, StoryArt, TeamLink, TeamMark, href, heightText, mainColor, onColor, playerOf, rankText, recordText, teamCss, useDyn } from './ui';

// ---- front page

function NoResults() {
  return (
    <Empty>
      <p>No results yet. Play a week in the game, then import your save on the Manage page.</p>
      <a className="dy-button" href={href('manage')}>Import a save</a>
    </Empty>
  );
}

/** The latest week with a result (or the first week). */
function latestWeek(games: SaveGame[]) {
  let w = 0;
  for (const g of games) if (g.vs !== null && g.week > w) w = g.week;
  return w;
}

function Ticker() {
  const { d, v } = useDyn();
  const week = latestWeek(v.games);
  const mine = (g: SaveGame) => d.userTeams.some((u) => u === g.visitor || u === g.home);
  const top = (g: SaveGame) => Math.min(g.visitor === null ? 999 : v.rank[g.visitor], g.home === null ? 999 : v.rank[g.home]);
  const games = v.games
    .filter((g) => g.week === week && g.visitor !== null && g.home !== null)
    .sort((a, b) => Number(mine(b)) - Number(mine(a)) || top(a) - top(b));
  return (
    <section className="dy-ticker" aria-label={`${weekName(v, week)} scores`}>
      <a className="dy-ticker-week" href={href(`scores/${week}`)}>{weekName(v, week)}</a>
      <div className="dy-ticker-games">
        {games.map((g) => (
          <a key={g.index} className={`dy-tick${mine(g) ? ' dy-tick-mine' : ''}`} href={href(`scores/${week}`)}>
            {[g.visitor!, g.home!].map((t, k) => {
              const pts = k ? g.hs : g.vs;
              const other = k ? g.vs : g.hs;
              const lost = pts !== null && other !== null && pts < other;
              return (
                <span key={k} className={`dy-tick-row${lost ? ' dy-lost' : ''}`}>
                  <TeamMark team={t} size={16} />
                  <span className="dy-tick-rank">{rankText(v, t)}</span>
                  <span className="dy-tick-name">{d.teams[t].school}</span>
                  <span className="dy-tick-pts">{pts ?? ''}</span>
                </span>
              );
            })}
            <span className="dy-tick-state">{g.vs !== null ? 'Final' : 'Upcoming'}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

export function Home() {
  const { d, v } = useDyn();
  const list = useMemo(() => stories(d, v), [d, v]);
  if (!v.save) return <NoResults />;
  const [lead, ...rest] = list;
  const second = rest.slice(0, 3);
  const heads = rest.slice(3);
  return (
    <>
      <Ticker />
      <div className="dy-front">
        <div className="dy-front-main">
          {lead && (
            <article className="dy-lead">
              <StoryArt teams={lead.teams} big />
              <h2>{lead.headline}</h2>
              <p>{lead.dek}</p>
            </article>
          )}
          <div className="dy-seconds">
            {second.map((s) => (
              <article key={s.id} className="dy-second">
                <StoryArt teams={s.teams} />
                <h3>{s.headline}</h3>
                <p>{s.dek}</p>
              </article>
            ))}
          </div>
        </div>
        <aside className="dy-front-side">
          {heads.length > 0 && (
            <section>
              <h2 className="dy-side-head">Headlines</h2>
              <ul className="dy-headlines">
                {heads.map((s) => (
                  <li key={s.id}>
                    <a href={href(`team/${s.teams[0]}`)}>{s.headline}</a>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <YourTeams />
          <section>
            <h2 className="dy-side-head">Top 25</h2>
            <Top25 compact />
          </section>
        </aside>
      </div>
    </>
  );
}

function YourTeams() {
  const { d, v } = useDyn();
  if (!d.userTeams.length) return null;
  return (
    <section>
      <h2 className="dy-side-head">Your {d.userTeams.length > 1 ? 'teams' : 'team'}</h2>
      {d.userTeams.map((t) => {
        const next = v.games.find((g) => g.vs === null && (g.visitor === t || g.home === t));
        const opp = next ? (next.visitor === t ? next.home : next.visitor) : null;
        return (
          <div key={t} className="dy-yours">
            <TeamLink team={t} />
            <span className="dy-num">{recordText(v.records[t])}</span>
            {next && (
              <span className="dy-yours-next">
                Next: {weekName(v, next.week)}, {next.visitor === t ? 'at' : 'vs.'} {opp !== null ? d.teams[opp].school : 'to be decided'}
              </span>
            )}
          </div>
        );
      })}
    </section>
  );
}

// ---- scores

export function Scores({ week: asked }: { week?: number }) {
  const { d, v } = useDyn();
  if (!v.save) return <NoResults />;
  const week = asked !== undefined && asked >= 0 && asked < v.weeks ? asked : latestWeek(v.games);
  const games = v.games.filter((g) => g.week === week);
  return (
    <section>
      <div className="dy-pagehead">
        <h2>Scores</h2>
        <div className="dy-weeknav">
          <a className="dy-button dy-quiet" aria-disabled={week === 0} href={week > 0 ? href(`scores/${week - 1}`) : undefined}>Previous</a>
          <select aria-label="Week" value={week} onChange={(e) => (window.location.hash = href(`scores/${e.target.value}`))}>
            {Array.from({ length: v.weeks }, (_, w) => <option key={w} value={w}>{weekName(v, w)}</option>)}
          </select>
          <a className="dy-button dy-quiet" aria-disabled={week === v.weeks - 1} href={week < v.weeks - 1 ? href(`scores/${week + 1}`) : undefined}>Next</a>
        </div>
      </div>
      <div className="dy-games">
        {games.map((g) => (
          <div key={g.index} className={`dy-game${d.userTeams.some((u) => u === g.visitor || u === g.home) ? ' dy-game-mine' : ''}`}>
            {[g.visitor, g.home].map((t, k) => {
              const pts = k ? g.hs : g.vs, other = k ? g.vs : g.hs;
              const won = pts !== null && other !== null && pts > other;
              return (
                <div key={k} className={`dy-game-row${won ? ' dy-won' : ''}`}>
                  {t !== null ? <TeamLink team={t} /> : <span className="dy-dim">To be decided</span>}
                  {t !== null && <span className="dy-dim dy-small">{recordText(v.records[t])}</span>}
                  <span className="dy-game-pts">{pts ?? ''}</span>
                </div>
              );
            })}
            <div className="dy-game-state">{g.vs !== null ? 'Final' : 'Not played yet'}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---- standings and rankings

export function Standings() {
  const { v } = useDyn();
  if (!v.save) return <NoResults />;
  const confs = v.season.confNames.map((name, c) => ({ name, c })).filter(({ c }) => v.season.conf.includes(c));
  return (
    <section>
      <div className="dy-pagehead"><h2>Standings</h2></div>
      <div className="dy-confs">
        {confs.map(({ name, c }) => (
          <table key={c} className="dy-table">
            <caption>{c === INDEPENDENT ? 'Independents' : name}</caption>
            <thead>
              <tr><th className="dy-left">Team</th>{c !== INDEPENDENT && <th>Conf</th>}<th>Overall</th><th>PF</th><th>PA</th><th>Streak</th></tr>
            </thead>
            <tbody>
              {standings(v, c).map((r) => (
                <tr key={r.team}>
                  <td className="dy-left"><TeamLink team={r.team} /></td>
                  {c !== INDEPENDENT && <td>{r.cw}-{r.cl}</td>}
                  <td>{recordText(r)}</td>
                  <td>{r.pf}</td>
                  <td>{r.pa}</td>
                  <td>{r.streak ? `${r.streak > 0 ? 'W' : 'L'}${Math.abs(r.streak)}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </section>
  );
}

function Top25({ compact = false }: { compact?: boolean }) {
  const { v } = useDyn();
  const prev = v.save?.season?.lastRanks ?? [];
  return (
    <ol className={`dy-top25${compact ? ' dy-compact' : ''}`}>
      {v.order.slice(0, 25).map((t, i) => {
        const was = prev[t];
        const move = was ? was - (i + 1) : 0;
        return (
          <li key={t}>
            <span className="dy-top-n">{i + 1}</span>
            <TeamLink team={t} rank={false} size={compact ? 20 : 48} />
            <span className="dy-num">{recordText(v.records[t])}</span>
            {!compact && (
              <span className={`dy-move${move > 0 ? ' dy-up' : move < 0 ? ' dy-down' : ''}`}>
                {!was || was > 25 ? 'New' : move > 0 ? `Up ${move}` : move < 0 ? `Down ${-move}` : ''}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function Rankings() {
  const { v } = useDyn();
  if (!v.save) return <NoResults />;
  return (
    <section>
      <div className="dy-pagehead"><h2>Top 25</h2><p>The game's own poll as of your latest save.</p></div>
      <Top25 />
    </section>
  );
}

// ---- stats tables

const STAT_TABLES: { cat: StatCategory; title: string; sort: string; cols: [string, string][] }[] = [
  { cat: 'passing', sort: 'yds', title: 'Passing', cols: [['comp', 'Comp'], ['att', 'Att'], ['yds', 'Yds'], ['td', 'TD'], ['int', 'Int']] },
  { cat: 'rushing', sort: 'yds', title: 'Rushing', cols: [['att', 'Att'], ['yds', 'Yds'], ['long', 'Long'], ['td', 'TD'], ['fum', 'Fum']] },
  { cat: 'receiving', sort: 'yds', title: 'Receiving', cols: [['rec', 'Rec'], ['yds', 'Yds'], ['long', 'Long'], ['td', 'TD'], ['drops', 'Drops']] },
  { cat: 'defense', sort: 'tkl', title: 'Defense', cols: [['tkl', 'Tackles'], ['sacks', 'Sacks'], ['int', 'Int']] },
  { cat: 'kicking', sort: 'fgm', title: 'Kicking', cols: [['fgm', 'FG'], ['fga', 'FGA'], ['long', 'Long'], ['xpm', 'XP'], ['xpa', 'XPA']] },
  { cat: 'punting', sort: 'yds', title: 'Punting', cols: [['punts', 'Punts'], ['yds', 'Yds'], ['long', 'Long'], ['in10', 'Inside 10']] },
];

function PlayerCell({ line }: { line: PlayerLine }) {
  const { d } = useDyn();
  const p = playerOf(d, line.player);
  return p ? <a href={href(`player/${p.id}`)}>#{p.jersey} {playerName(p)}</a> : <span className="dy-dim">Unknown player</span>;
}

function StatTables({ lines }: { lines: PlayerLine[] }) {
  const { d } = useDyn();
  return (
    <div className="dy-stat-tables">
      {STAT_TABLES.map((t) => {
        const rows = lines.filter((l) => l.cat === t.cat && t.cols.some(([k]) => statValue(l, k) > 0));
        if (!rows.length) return null;
        rows.sort((a, b) => statValue(b, t.sort) - statValue(a, t.sort));
        return (
          <table key={t.cat} className="dy-table">
            <caption>{t.title}</caption>
            <thead><tr><th className="dy-left">Player</th><th>Pos</th>{t.cols.map(([k, label]) => <th key={k}>{label}</th>)}</tr></thead>
            <tbody>
              {rows.map((l) => (
                <tr key={`${l.cat}-${l.slot}`}>
                  <td className="dy-left"><PlayerCell line={l} /></td>
                  <td>{playerOf(d, l.player)?.pos ?? ''}</td>
                  {t.cols.map(([k]) => <td key={k}>{statValue(l, k)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        );
      })}
    </div>
  );
}

// ---- teams

/** The 138-team edition's 32 roster slots in the game's order (every team plays the 4-3). */
const SLOT_ORDER = rosterLayout('bw95', false, true);

export function Teams() {
  const { d, v } = useDyn();
  const confs = v.season.confNames.map((name, c) => ({ name, c })).filter(({ c }) => v.season.conf.includes(c));
  return (
    <section>
      <div className="dy-pagehead"><h2>Teams</h2></div>
      <div className="dy-team-index">
        {confs.map(({ name, c }) => (
          <div key={c}>
            <h3>{c === INDEPENDENT ? 'Independents' : name}</h3>
            <ul>
              {d.teams
                .filter((t) => v.season.conf[t.index] === c)
                .sort((a, b) => a.school.localeCompare(b.school))
                .map((t) => <li key={t.index}><TeamLink team={t.index} rank={false} size={48} /></li>)}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Team({ team }: { team: number }) {
  const { d, v } = useDyn();
  const lines = useMemo(() => playerLines(v).filter((l) => l.team === team), [v, team]);
  const t = d.teams[team];
  if (!t) return <Empty><p>There's no such team.</p></Empty>;
  const c = mainColor(d, team);
  const r = v.records[team];
  // The team's 32 in the ROM, in the game's roster order (the kicker can also be the punter).
  const roster = SLOT_ORDER.flatMap((def) => {
    const p = playerOf(d, v.season.slots[team][def.slot]);
    return p ? [{ def, p, label: v.season.bw?.[team]?.[def.slot]?.label ?? def.label }] : [];
  });
  const games = v.games.filter((g) => g.visitor === team || g.home === team);
  const conf = v.season.conf[team];
  const hist = teamHistory(d, team);
  return (
    <section>
      <header className="dy-teamhead" style={{ background: teamCss(c), color: onColor(c) }}>
        <TeamMark team={team} size={96} />
        <div>
          <h2>{t.school} {t.nickname}</h2>
          <p>
            <span>{conf === INDEPENDENT ? 'Independent' : v.season.confNames[conf]}</span>
            {v.save && <span>{recordText(r)}, {r.cw}-{r.cl} in conference</span>}
            {v.save && v.rank[team] <= 25 && <span>No. {v.rank[team]}</span>}
          </p>
        </div>
        <TeamMark team={team} size={96} kind="helmet" />
      </header>

      <div className="dy-team-cols">
        <div>
          <h3 className="dy-sub">Schedule</h3>
          {games.length ? (
            <table className="dy-table">
              <tbody>
                {games.map((g) => {
                  const home = g.home === team;
                  const opp = home ? g.visitor : g.home;
                  const us = home ? g.hs : g.vs, them = home ? g.vs : g.hs;
                  return (
                    <tr key={g.index}>
                      <td className="dy-left dy-dim">{weekName(v, g.week)}</td>
                      <td className="dy-left">{home ? 'vs.' : 'at'} {opp !== null ? <TeamLink team={opp} /> : 'To be decided'}</td>
                      <td>{us !== null && them !== null ? <span className={us > them ? 'dy-w' : 'dy-l'}>{us > them ? 'W' : us < them ? 'L' : 'T'} {us}-{them}</span> : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <p className="dy-dim">No games in the imported season.</p>}

          <h3 className="dy-sub">History</h3>
          <table className="dy-table">
            <thead><tr><th className="dy-left">Season</th><th>Record</th><th>Final rank</th><th></th></tr></thead>
            <tbody>
              {hist.map((h) => (
                <tr key={h.year}>
                  <td className="dy-left">{h.year}</td>
                  <td>{h.imported ? recordText(h.record) : ''}</td>
                  <td>{h.imported && h.rank <= 25 ? h.rank : ''}</td>
                  <td>{h.champion ? 'National champions' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="dy-sub">Season stats</h3>
          {lines.some((l) => Object.values(l.s).some((x) => x > 0)) ? <StatTables lines={lines} /> : <p className="dy-dim">No stats yet.</p>}
        </div>
      </div>

      <h3 className="dy-sub">Roster</h3>
      <div className="dy-scroll">
        <table className="dy-table dy-roster">
          <thead>
            <tr><th className="dy-left">Pos</th><th>#</th><th className="dy-left">Name</th><th>Class</th><th>Ht</th><th>Wt</th><th className="dy-left">Hometown</th></tr>
          </thead>
          <tbody>
            {roster.map(({ def, p, label }) => (
              <tr key={def.slot}>
                <td className="dy-left dy-strong">{label}</td>
                <td>{p.jersey}</td>
                <td className="dy-left"><a href={href(`player/${p.id}`)}>{playerName(p)}</a></td>
                <td>{p.cls}</td>
                <td>{heightText(p.heightIn)}</td>
                <td>{p.weight || ''}</td>
                <td className="dy-left dy-dim">{[p.hometown, p.state].filter(Boolean).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---- players

export function Player({ id }: { id: number }) {
  const { d, v } = useDyn();
  const p = d.players[id - 1];
  const seasons = useMemo(() => {
    if (!p) return [];
    return [{ year: v.season.year, lines: playerLines(v).filter((l) => l.player === p.id) }];
  }, [d, v, p]);
  if (!p) return <Empty><p>There's no such player.</p></Empty>;
  const team = p.team;
  // His roster slots in the ROM this season (a kicker can also be the punter).
  const bwSlots = team === null ? [] : v.season.slots[team].flatMap((id, slot) => (id === p.id && v.season.bw?.[team]?.[slot] ? [slot] : []));
  const c = team !== null ? mainColor(d, team) : 0;
  return (
    <section>
      <header className="dy-teamhead" style={team !== null ? { background: teamCss(c), color: onColor(c) } : undefined}>
        {team !== null && <TeamMark team={team} size={64} />}
        <div>
          <h2>{playerName(p)}</h2>
          <p>
            <span>#{p.jersey} {bwSlots.length ? bwSlots.map((x) => v.season.bw![team!][x]!.label).join(', ') : p.pos}</span>
            <span>{p.cls}</span>
            <span>{heightText(p.heightIn)}, {p.weight} lb</span>
            {team !== null && <a href={href(`team/${team}`)}>{d.teams[team].school}</a>}
            {p.hometown && <span>{p.hometown}{p.state ? `, ${p.state}` : ''}</span>}
          </p>
        </div>
      </header>
      {seasons.map((s) => s.lines.length > 0 && (
        <div key={s.year}>
          <h3 className="dy-sub">{s.year} season</h3>
          <StatTables lines={s.lines} />
        </div>
      ))}
      <h3 className="dy-sub">Bill Walsh '95 ratings</h3>
      {bwSlots.length ? bwSlots.map((slot) => <BwRatings key={slot} team={team!} slot={slot} name={playerName(p)} />) : (
        <p className="dy-dim">
          {v.season.bw ? `He isn't one of ${team !== null ? d.teams[team].school : 'his team'}'s 32 players in Bill Walsh '95 this season, so he has no ratings.` : 'Start this dynasty again to see the ratings (it was made before the app kept them).'}
        </p>
      )}
    </section>
  );
}

// ---- the game's ratings: a shape against the league average and a tile per rating

const ordinal = (n: number) => {
  const t = n % 100, u = n % 10;
  return `${n}${t >= 11 && t <= 13 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th'}`;
};

function BwRatings({ team, slot, name }: { team: number; slot: number; name: string }) {
  const { d, v } = useDyn();
  const b = v.season.bw![team][slot]!;
  // The same slot on every team this season.
  const league = v.season.bw!.map((t) => t[slot]).filter((x): x is NonNullable<typeof x> => !!x && x.group === b.group);
  const n = league.length;
  const avg = b.attrs.map((_, i) => league.reduce((a, x) => a + x.steps[i], 0) / n);
  const rank = b.attrs.map((_, i) => 1 + league.filter((x) => x.steps[i] > b.steps[i]).length);
  // Weight: the share of starters he outweighs, counting those at his step as half.
  const heavier = b.attrs.map((_, i) => league.reduce((a, x) => a + (x.steps[i] < b.steps[i] ? 1 : x.steps[i] === b.steps[i] ? 0.5 : 0), 0) - 0.5);
  const c = mainColor(d, team);
  const color = onColor(c) === '#000' ? 'var(--gray)' : teamCss(c); // a light team color wouldn't show on white
  const who = `${b.label}s`;

  // Shape: the five ratings other than weight, step 15 at the rim.
  const axes = b.attrs.map((a, i) => ({ a, i })).filter((x) => x.a !== 'Weight');
  const C = 150, CY = 130, R = 96;
  const pt = (k: number, r: number) => {
    const ang = (-90 + (360 / axes.length) * k) * (Math.PI / 180);
    return [C + r * Math.cos(ang), CY + r * Math.sin(ang)];
  };
  const poly = (f: (i: number) => number) => axes.map((x, k) => pt(k, (f(x.i) / 15) * R).map((z) => z.toFixed(1)).join(',')).join(' ');
  // A kicker's or punter's Quick is his kick distance in the game.
  const label = (a: string) => (b.group === 'KP' && a === 'Quickness' ? 'Kick distance' : a);
  const tiles = b.attrs.map((a, i) => ({ a, i })).sort((x, y) => Number(x.a === 'Weight') - Number(y.a === 'Weight') || rank[x.i] - rank[y.i]);

  return (
    <div className="dy-bw">
      <p className="dy-dim">{d.teams[team].school}'s {b.label}, compared with the {n} starting {who}.</p>
      <div className="dy-bw-grid">
        <figure className="dy-shape">
          <svg viewBox="0 0 300 250" role="img" aria-label={`${name}'s ratings against the average ${b.label}`}>
            <polygon points={poly(() => 15)} className="dy-shape-rim" />
            <polygon points={poly(() => 7.5)} className="dy-shape-mid" />
            {axes.map((x, k) => { const [px, py] = pt(k, R); return <line key={x.a} x1={C} y1={CY} x2={px} y2={py} className="dy-shape-mid" />; })}
            <polygon points={poly((i) => avg[i])} className="dy-shape-avg" />
            <polygon points={poly((i) => b.steps[i])} style={{ fill: color, stroke: color }} className="dy-shape-him" />
            {axes.map((x, k) => {
              const [px, py] = pt(k, R + 18);
              return <text key={x.a} x={px} y={py + 4} textAnchor={Math.abs(px - C) < 5 ? 'middle' : px > C ? 'start' : 'end'}>{label(x.a)}</text>;
            })}
          </svg>
          <figcaption>
            <span><i style={{ background: color }} /> {name}</span>
            <span><i className="dy-key-avg" /> Average {b.label}</span>
          </figcaption>
        </figure>
        <div className="dy-tiles">
          {tiles.map(({ a, i }) => {
            const weight = a === 'Weight';
            const shown = weight ? `${nibbleToWeight(b.steps[i]) + b.weightPlus} lb` : nibbleToRating(b.steps[i]);
            return (
              <div key={a} className="dy-tile">
                <div className="dy-tile-top"><span>{label(a)}</span><strong>{shown}</strong></div>
                <div className="dy-pips" role="img" aria-label={`Step ${b.steps[i]} of 15; average ${b.label} ${avg[i].toFixed(1)}`}>
                  {Array.from({ length: 15 }, (_, k) => <span key={k} style={k < b.steps[i] ? { background: color } : undefined} />)}
                  <i style={{ left: `calc(${(avg[i] / 15) * 100}% - 1px)` }} title={`Average ${b.label}`} />
                </div>
                <div className="dy-tile-note">
                  {weight ? `Heavier than ${Math.round((heavier[i] / Math.max(1, n - 1)) * 100)}% of ${who}` : <><strong>{ordinal(rank[i])}</strong> of {n} {who}</>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---- leaders

const LEADER_BOARDS: { title: string; cat: StatCategory; key: string }[] = [
  { title: 'Passing yards', cat: 'passing', key: 'yds' },
  { title: 'Passing touchdowns', cat: 'passing', key: 'td' },
  { title: 'Rushing yards', cat: 'rushing', key: 'yds' },
  { title: 'Rushing touchdowns', cat: 'rushing', key: 'td' },
  { title: 'Receiving yards', cat: 'receiving', key: 'yds' },
  { title: 'Receptions', cat: 'receiving', key: 'rec' },
  { title: 'Tackles', cat: 'defense', key: 'tkl' },
  { title: 'Sacks', cat: 'defense', key: 'sacks' },
  { title: 'Interceptions', cat: 'defense', key: 'int' },
  { title: 'Field goals', cat: 'kicking', key: 'fgm' },
];

export function Leaders() {
  const { d, v } = useDyn();
  const lines = useMemo(() => playerLines(v), [v]);
  if (!v.save) return <NoResults />;
  return (
    <section>
      <div className="dy-pagehead"><h2>Stat leaders</h2><p>{v.season.year} season to date.</p></div>
      <div className="dy-boards">
        {LEADER_BOARDS.map((b) => (
          <table key={b.title} className="dy-table dy-board">
            <caption>{b.title}</caption>
            <tbody>
              {leaders(lines, b.cat, b.key, 10).map((l, i) => (
                <tr key={`${l.team}-${l.slot}`}>
                  <td className="dy-dim">{i + 1}</td>
                  <td className="dy-left"><PlayerCell line={l} /> <span className="dy-dim dy-small">{d.teams[l.team].school}</span></td>
                  <td className="dy-strong">{statValue(l, b.key).toLocaleString('en-US')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </section>
  );
}

// ---- history

export function History() {
  const { d } = useDyn();
  const [stat, setStat] = useState(0);
  const champs = useMemo(() => champions(d), [d]);
  const recs = useMemo(() => seasonRecords(d, RECORD_STATS[stat]), [d, stat]);
  return (
    <section>
      <div className="dy-pagehead"><h2>History</h2><p>Every season of this dynasty since {d.startYear}.</p></div>
      <div className="dy-team-cols">
        <div>
          <h3 className="dy-sub">National champions</h3>
          {champs.length ? (
            <table className="dy-table">
              <tbody>
                {champs.slice().reverse().map((c) => (
                  <tr key={c.year}><td className="dy-left">{c.year}</td><td className="dy-left"><TeamLink team={c.team} rank={false} full /></td><td>{recordText(c.record)}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <p className="dy-dim">No champion yet. The national championship game crowns the first one.</p>}
          {d.userTeams.map((t) => (
            <div key={t}>
              <h3 className="dy-sub">{d.teams[t].school} by season</h3>
              <table className="dy-table">
                <tbody>
                  {teamHistory(d, t).map((h) => (
                    <tr key={h.year}>
                      <td className="dy-left">{h.year}</td>
                      <td>{h.imported ? recordText(h.record) : 'No save yet'}</td>
                      <td>{h.imported && h.rank <= 25 ? `No. ${h.rank}` : ''}</td>
                      <td>{h.champion ? 'National champions' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        <div>
          <h3 className="dy-sub">Single-season records</h3>
          <select aria-label="Record" value={stat} onChange={(e) => setStat(Number(e.target.value))}>
            {RECORD_STATS.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
          </select>
          <table className="dy-table">
            <tbody>
              {recs.map((r, i) => {
                const p = playerOf(d, r.player);
                return (
                  <tr key={i}>
                    <td className="dy-dim">{i + 1}</td>
                    <td className="dy-left">{p ? <a href={href(`player/${p.id}`)}>#{p.jersey} {playerName(p)}</a> : 'Unknown player'} <span className="dy-dim dy-small">{d.teams[r.team].school}</span></td>
                    <td>{r.year}</td>
                    <td className="dy-strong">{r.value.toLocaleString('en-US')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
