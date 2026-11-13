// The Dynasty's reading pages: the news front page, scores, standings, rankings, teams, players,
// stat leaders and history.
import { playerHonors, seasonAwards } from '../../core/dynasty/awards';
import { academicGrade } from '../../core/dynasty/academics';
import { scheduleLock } from '../../core/dynasty/schedule';
import { setWhiteHome, whiteHomeLock } from '../../core/dynasty/kit';
import { Button, Modal, Note, Num, PageHead, Select, SubHead, Table } from '../../ui';
import { useEffect, useMemo, useState } from 'react';
import {
  champions, leaders, playerLines, playerName, seasonView, standings, statValue, teamHistory, weekName,
  INDEPENDENT, type PlayerLine, type StatCategory,
} from '../../core/dynasty/derive';
import { offseasonStories, stories, type Story } from '../../core/dynasty/news';
import { OffseasonSide, SeasonMore, SeasonSide } from './HomeSide';
import { AddPlayer, EditLook, EditPlayer } from './EditPlayer';
import { prestigeStars } from '../../core/dynasty/offseason';
import { MAX_PRESTIGE } from '../../core/dynasty/prestige';
import type { SaveGame } from '../../core/dynasty/save';
import type { DPlayer } from '../../core/dynasty/model';
import { GROUP_COLUMNS, type Attr } from '../../core/rosterLayouts';
import { fineAt, GROUP_OF_ROLE, RATINGS, roleOfPos, shownFine } from '../../core/dynasty/ratings';
import { trainingYears, experienceOf } from '../../core/dynasty/career';
import { seasonDone } from '../../core/dynasty/offseason';
import type { Dynasty } from '../../core/dynasty/model';
import { backupLabel, isBackup, lineupLock, moveToSpot, slotKind, slotOfSpot, spotLabel, spotsFor, SPOTS } from '../../core/dynasty/lineup';
import { playerOvr, roleOfSlot } from '../../core/dynasty/ovr';
import { accentOn, Empty, Headshot, StoryArt, TeamLink, TeamMark, href, heightText, hometownText, inkColor, mainColor, onColor, playerOf, rankText, recordText, teamCss, useDyn } from './ui';

// ---- front page

function NoResults() {
  return (
    <Empty>
      <p>No results yet. Play a week in the game, then import your save on the Manage page.</p>
      <Button href={href('manage')}>Import a save</Button>
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

/**
 * A story's headline as a link (user, 2026-11-12): a player of the week opens a window with his game; stories
 * about a player (stat leaders, milestones) go to his page; the rest to the team.
 */
function StoryLink({ s }: { s: Story }) {
  const [open, setOpen] = useState(false);
  if (s.box && s.player) {
    return (
      <>
        <a href={href(`player/${s.player}`)} onClick={(e) => { e.preventDefault(); setOpen(true); }}>{s.headline}</a>
        {open && <StoryBox s={s} onClose={() => setOpen(false)} />}
      </>
    );
  }
  return <a href={href(s.player ? `player/${s.player}` : `team/${s.teams[0]}`)}>{s.headline}</a>;
}

/** A player of the week's game: the result and his stat lines, with a link to his page. */
function StoryBox({ s, onClose }: { s: Story; onClose: () => void }) {
  const { d, v } = useDyn();
  const p = d.players[s.player! - 1];
  return (
    <Modal
      title={playerName(p)} onClose={onClose} media={<Headshot p={p} size={64} />}
      sub={<>#{p.jersey} {p.pos}, <TeamLink team={s.teams[0]} rank={false} size={16} /></>}
      actions={<><Button href={href(`player/${p.id}`)} onClick={onClose}>Player page</Button><Button variant="quiet" onClick={onClose}>Close</Button></>}
    >
        <p className="dy-small">{s.headline}{s.box!.result ? `: ${s.box!.result}` : ''}.</p>
        {s.box!.lines.map((l) => (
          <Table key={l.cat} figures className="dy-box-table">
            <thead><tr><th className="ui-left">{l.cat}</th>{l.cells.map(([k]) => <th key={k}>{k}</th>)}</tr></thead>
            <tbody><tr><td className="ui-left dy-dim">{weekName(v, s.week)}</td>{l.cells.map(([k, v]) => <td key={k}>{v}</td>)}</tr></tbody>
          </Table>
        ))}
    </Modal>
  );
}

export function Home() {
  const { d, v } = useDyn();
  // In the offseason (and before the first game of a season) the news is the offseason's.
  const offEvents = d.offseason ? d.offseason.events : !v.save ? v.season.events : undefined;
  const list = useMemo(
    () => (offEvents?.length ? offseasonStories(d, offEvents, d.offseason ? d.offseason.year : v.season.year - 1) : stories(d, v)),
    [d, v, offEvents],
  );
  if (!list.length) return <NoResults />;
  const [lead, ...rest] = list;
  const second = rest.slice(0, 3);
  const heads = rest.slice(3);
  return (
    <>
      {v.save && !d.offseason && <Ticker />}
      <div className="dy-front">
        <div className="dy-front-main">
          {lead && (
            <article className="dy-lead">
              <StoryArt teams={lead.teams} big />
              <h2><StoryLink s={lead} /></h2>
              <p>{lead.dek}</p>
            </article>
          )}
          <div className="dy-seconds">
            {second.map((s) => (
              <article key={s.id} className="dy-second">
                <StoryArt teams={s.teams} />
                <h3><StoryLink s={s} /></h3>
                <p>{s.dek}</p>
              </article>
            ))}
          </div>
          {v.save && <HomePoll />}
        </div>
        <aside className="dy-front-side">
          {heads.length > 0 && (
            <section>
              <SubHead level={2}>Headlines</SubHead>
              <ul className="dy-headlines">
                {heads.map((s) => (
                  <li key={s.id}>
                    <StoryLink s={s} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          <YourTeams />
          <SeasonSide />
          <OffseasonSide />
        </aside>
      </div>
      <SeasonMore />
    </>
  );
}

/** The Top 25 on the front page: on wider screens the top four as cards, the rest in columns. */
function HomePoll() {
  const { v } = useDyn();
  const prev = v.save?.season?.lastRanks ?? [];
  const row = (t: number, i: number) => {
    const was = prev[t];
    const move = was ? was - (i + 1) : 0;
    return { was, move, text: !was || was > 25 ? 'New' : move > 0 ? `Up ${move}` : move < 0 ? `Down ${-move}` : 'No change' };
  };
  const top = v.order.slice(0, 25);
  return (
    <section className="dy-poll">
      <SubHead level={2}><a href={href('top25')}>Top 25</a></SubHead>
      <ol className="dy-poll-top">
        {top.slice(0, 4).map((t, i) => {
          const m = row(t, i);
          return (
            <li key={t}>
              <span className="dy-top-n">{i + 1}</span>
              <span className="dy-poll-big"><TeamMark team={t} size={48} /></span>
              <TeamLink team={t} rank={false} />
              <span className="dy-num">{recordText(v.records[t])}</span>
              <span className={`dy-move${m.move > 0 ? ' dy-up' : m.move < 0 ? ' dy-down' : ''}`}>{m.text}</span>
            </li>
          );
        })}
      </ol>
      <ol className="dy-poll-rest" start={5}>
        {top.slice(4).map((t, k) => (
          <li key={t}>
            <span className="dy-top-n">{k + 5}</span>
            <TeamLink team={t} rank={false} />
            <span className="dy-num">{recordText(v.records[t])}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function YourTeams() {
  const { d, v } = useDyn();
  if (!d.userTeams.length) return null;
  return (
    <section>
      <SubHead level={2}>Your {d.userTeams.length > 1 ? 'teams' : 'team'}</SubHead>
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
      <PageHead
        title="Scores"
        actions={<>
          <Button variant="quiet" disabled={week === 0} href={href(`scores/${week - 1}`)}>Previous</Button>
          <Select label="Week" hideLabel value={week} options={Array.from({ length: v.weeks }, (_, w) => ({ value: w, label: weekName(v, w) }))} onChange={(x) => (window.location.hash = href(`scores/${x}`))} />
          <Button variant="quiet" disabled={week === v.weeks - 1} href={href(`scores/${week + 1}`)}>Next</Button>
        </>}
      />
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
      <PageHead title="Standings" />
      <div className="dy-confs">
        {confs.map(({ name, c }) => (
          <Table key={c} figures>
            <caption>{c === INDEPENDENT ? 'Independents' : name}</caption>
            <thead>
              <tr><th className="ui-left">Team</th>{c !== INDEPENDENT && <th>Conf</th>}<th>Overall</th><th>PF</th><th>PA</th><th>Streak</th></tr>
            </thead>
            <tbody>
              {standings(v, c).map((r) => (
                <tr key={r.team}>
                  <td className="ui-left"><TeamLink team={r.team} /></td>
                  {c !== INDEPENDENT && <td>{r.cw}-{r.cl}</td>}
                  <td>{recordText(r)}</td>
                  <td>{r.pf}</td>
                  <td>{r.pa}</td>
                  <td className="ui-text">{r.streak ? `${r.streak > 0 ? 'W' : 'L'}${Math.abs(r.streak)}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </Table>
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
      <PageHead title="Top 25">The game's own poll as of your latest save.</PageHead>
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
  const { d, v } = useDyn();
  return (
    <div className="dy-stat-tables">
      {STAT_TABLES.map((t) => {
        const rows = lines.filter((l) => l.cat === t.cat && t.cols.some(([k]) => statValue(l, k) > 0));
        if (!rows.length) return null;
        rows.sort((a, b) => statValue(b, t.sort) - statValue(a, t.sort));
        return (
          <Table key={t.cat} figures>
            <caption>{t.title}</caption>
            <thead><tr><th className="ui-left">Player</th><th>Pos</th>{t.cols.map(([k, label]) => <th key={k}>{label}</th>)}</tr></thead>
            <tbody>
              {rows.map((l) => (
                <tr key={`${l.cat}-${l.slot}`}>
                  <td className="ui-left"><PlayerCell line={l} /></td>
                  <td className="ui-text">{v.season.bw?.[l.team]?.[l.slot]?.label ?? playerOf(d, l.player)?.pos ?? ''}</td>
                  {t.cols.map(([k]) => <td key={k}><Num value={statValue(l, k)} /></td>)}
                </tr>
              ))}
            </tbody>
          </Table>
        );
      })}
    </div>
  );
}

// ---- teams

/** Prestige as stars out of six. */
function Prestige({ stars }: { stars: number }) {
  return (
    <span className="dy-prestige" role="img" aria-label={`Prestige: ${stars} of ${MAX_PRESTIGE} stars`} title={`Prestige: ${stars} of ${MAX_PRESTIGE} stars`}>
      {'★'.repeat(stars)}<span>{'★'.repeat(MAX_PRESTIGE - stars)}</span>
    </span>
  );
}

export function Teams() {
  const { d, v } = useDyn();
  const confs = v.season.confNames.map((name, c) => ({ name, c })).filter(({ c }) => v.season.conf.includes(c));
  return (
    <section>
      <PageHead title="Teams" />
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
  const { d, v, downloadRom, commit } = useDyn();
  const lines = useMemo(() => playerLines(v).filter((l) => l.team === team), [v, team]);
  const [moveError, setMoveError] = useState<string | null>(null);
  const t = d.teams[team];
  if (!t) return <Empty><p>There's no such team.</p></Empty>;
  const c = mainColor(d, team);
  const r = v.records[team];
  // The team's 32 in the ROM, in the game's roster order, then their backups (QB2, HB3 …), then anyone else.
  const row = (spot: number) => {
    const slot = slotOfSpot(spot);
    const p = playerOf(d, isBackup(spot) ? v.season.bench?.[team]?.[slot] ?? null : v.season.slots[team][slot]);
    const bw = (isBackup(spot) ? v.season.benchBw : v.season.bw)?.[team]?.[slot] ?? null;
    return p ? [{ p, spot, label: spotLabel(spot), ovr: bw ? playerOvr(slot, bw) : null }] : [];
  };
  const roster = SPOTS.filter((x) => !isBackup(x)).flatMap(row);
  const bench = SPOTS.filter(isBackup).flatMap(row);
  const placed = new Set([...roster, ...bench].map((x) => x.p.id));
  const reserves = d.players.filter((p) => p.team === team && p.status === 'active' && !placed.has(p.id));
  const mine = d.userTeams.includes(team);
  const lock = mine ? lineupLock(d, team) : null;
  const edit = mine && !lock ? { team, onError: setMoveError } : undefined;
  const games = v.games.filter((g) => g.visitor === team || g.home === team);
  const ovr = v.season.teamOvr?.[team];
  const conf = v.season.conf[team];
  const hist = teamHistory(d, team);
  return (
    <section>
      <header className="dy-teamhead" style={{ background: teamCss(c), color: onColor(c) }}>
        <div className="dy-teamhead-id">
          <TeamMark team={team} size={96} />
          <div>
            <h2>{t.school} {t.nickname}</h2>
            <p>
              <Prestige stars={prestigeStars(d, team)} />
              <span>{conf === INDEPENDENT ? 'Independent' : v.season.confNames[conf]}</span>
              <span className="dy-academics" role="img" aria-label={`Academics: ${academicGrade(t.school)}`} title={`Academics: ${academicGrade(t.school)}`}>
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 4 1 9l11 5 8-3.6V16h2V9L12 4zM5 12.7V16c0 1.7 3.1 3 7 3s7-1.3 7-3v-3.3l-7 3.2-7-3.2z" /></svg>
                {academicGrade(t.school)}
              </span>
              {v.save && <span className="dy-record"><strong>{recordText(r)}</strong>{conf !== INDEPENDENT && <>{' '}({r.cw}-{r.cl} in conference)</>}</span>}
              {v.save && v.rank[team] <= 25 && <span>No. {v.rank[team]}</span>}
            </p>
          </div>
        </div>
        {ovr && (
          <dl className={`dy-teamovr${onColor(c) === '#000' ? ' dy-on-light' : ''}`}>
            <div><dt>Offense</dt><dd>{ovr.off}</dd></div>
            <div><dt>Defense</dt><dd>{ovr.def}</dd></div>
          </dl>
        )}
        <span className="dy-teamhead-helmet"><TeamMark team={team} size={96} kind="helmet" /></span>
      </header>

      <div className="dy-team-cols">
        <div>
          {mine && d.whiteHome && (
            <div className="dy-homekit">
              <Select label="Home jersey" value={d.whiteHome[team] ? 'white' : 'dark'} options={[{ value: 'dark', label: 'Dark at home' }, { value: 'white', label: 'White at home' }]}
                onChange={(x) => { try { void commit(setWhiteHome(d, team, x === 'white')); setMoveError(null); } catch (e) { setMoveError((e as Error).message); } }} />
              {whiteHomeLock(d, team) && <p className="dy-small dy-dim">{whiteHomeLock(d, team)}</p>}
            </div>
          )}
          <SubHead>Schedule</SubHead>
          {mine && v.season.schedule && !scheduleLock(v.season) && <p className="dy-small"><a href={href(`schedule/${team}`)}>Change the schedule</a></p>}
          {games.length ? (
            <Table figures>
              <tbody>
                {games.map((g) => {
                  const home = g.home === team;
                  const opp = home ? g.visitor : g.home;
                  const us = home ? g.hs : g.vs, them = home ? g.vs : g.hs;
                  return (
                    <tr key={g.index}>
                      <td className="ui-left dy-dim">{weekName(v, g.week)}</td>
                      <td className="ui-left">{home ? 'vs.' : 'at'} {opp !== null ? <TeamLink team={opp} /> : 'To be decided'}</td>
                      <td>{us !== null && them !== null ? <span className={us > them ? 'dy-w' : 'dy-l'}>{us > them ? 'W' : us < them ? 'L' : 'T'} {us}-{them}</span> : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          ) : <p className="dy-dim">No games in the imported season.</p>}

          <SubHead>History</SubHead>
          <Table figures>
            <thead><tr><th className="ui-left">Season</th><th>Record</th><th>Final rank</th><th></th></tr></thead>
            <tbody>
              {hist.map((h) => (
                <tr key={h.year}>
                  <td className="ui-left">{h.year}</td>
                  <td>{h.imported ? recordText(h.record) : ''}</td>
                  <td>{h.imported && h.rank <= 25 ? h.rank : ''}</td>
                  <td className="ui-text">{h.champion ? 'National champions' : ''}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <div>
          <SubHead>Season stats</SubHead>
          {lines.some((l) => Object.values(l.s).some((x) => x > 0)) ? <StatTables lines={lines} /> : <p className="dy-dim">No stats yet.</p>}
        </div>
      </div>

      <SubHead>Active Roster</SubHead>
      <p className="dy-dim dy-small">
        The {roster.length} players in Bill Walsh '95 this season.
        {trainingYears(d).length > 0 && <> <a href={href(`training/${team}-${trainingYears(d)[0]}`)}>Training results</a></>}
      </p>
      {edit && <p className="dy-small">Choose a player's position to move him: the player there takes his place. ★ marks the Active Roster spots. A player can change position once a season (HB and FB, FB and TE, DE and OLB, OLB and MLB, K and P).</p>}
      {lock && mine && <p className="dy-dim dy-small">{lock}</p>}
      {mine && v.season.lineupEdited && (
        <Note>
          You changed the lineup. Download the {v.season.year} ROM again before you start the New Season.{' '}
          <Button variant="quiet" onClick={() => downloadRom(v.season.year)}>Download the {v.season.year} ROM</Button>
        </Note>
      )}
      {moveError && <Note kind="error">{moveError}</Note>}
      <RosterTable rows={roster} edit={edit} />
      <SubHead>Backups</SubHead>
      <p className="dy-dim dy-small">{bench.length + reserves.length} players who aren't on the Active Roster this season. Each backs up a spot and can move up when it opens.</p>
      <RosterTable rows={[...bench, ...reserves.map((p) => ({ p, spot: null, label: p.pos, ovr: null }))]} edit={edit} />
      <AddPlayer team={team} />
    </section>
  );
}

type RosterRow = { p: DPlayer; spot: number | null; label: string; ovr: number | null };

function RosterTable({ rows, edit }: { rows: RosterRow[]; edit?: { team: number; onError: (m: string | null) => void } }) {
  const { d, commit } = useDyn();
  const move = (p: DPlayer, spot: number) => {
    try {
      edit!.onError(null);
      void commit(moveToSpot(d, edit!.team, p.id, spot));
    } catch (e) {
      edit!.onError((e as Error).message);
    }
  };
  return (
    <div className="dy-scroll">
      <Table className="dy-roster">
        <thead>
          <tr><th className="ui-left">Pos</th><th>#</th><th className="ui-left">Name</th><th>OVR</th><th>Class</th><th className="dy-wide">Ht</th><th className="dy-wide">Wt</th><th className="ui-left dy-wide">Hometown</th></tr>
        </thead>
        <tbody>
          {rows.map(({ p, spot, label, ovr }) => (
            <tr key={`${spot ?? label}-${p.id}`}>
              <td className="ui-left dy-strong">
                {edit ? (
                  <Select
                    label={`Position of ${playerName(p)}`} hideLabel compact value={spot ?? ''}
                    options={(() => {
                      // By position, Active Roster spots (★) before their backups.
                      const ok = spotsFor(d, edit.team, p);
                      const kinds = [...new Set(ok.map((x) => slotKind(slotOfSpot(x))))];
                      return [
                        ...(spot === null ? [{ value: '', label, disabled: true }] : []),
                        ...kinds.flatMap((k) => ok.filter((x) => slotKind(slotOfSpot(x)) === k).map((x) => ({ value: x, label: `${spotLabel(x)}${isBackup(x) ? '' : ' ★'}`, group: k }))),
                      ];
                    })()}
                    onChange={(x) => move(p, Number(x))}
                  />
                ) : label}
              </td>
              <td className="ui-num">{p.jersey < 0 ? '' : p.jersey}</td>
              <td className="ui-left"><a href={href(`player/${p.id}`)}>{playerName(p)}</a></td>
              <td className="ui-num">{ovr ?? ''}</td>
              <td>{p.cls}</td>
              <td className="dy-wide">{heightText(p.heightIn)}</td>
              <td className="dy-wide ui-num">{p.weight || ''}</td>
              <td className="ui-left dy-dim dy-wide">{hometownText(p)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

// ---- players

/** Awards he won (awards.ts), newest first; nothing shows until he has one. */
function Honors({ id }: { id: number }) {
  const { d } = useDyn();
  const list = useMemo(() => playerHonors(d, id, d.seasons.map((s) => seasonAwards(d, s))), [d, id]);
  if (!list.length) return null;
  return (
    <>
      <SubHead>Honors</SubHead>
      <ul className="dy-honors">
        {list.map((h, i) => <li key={i}><a href={href(`awards/${h.year}`)}>{h.year}</a> {h.label}</li>)}
      </ul>
    </>
  );
}

export function Player({ id }: { id: number }) {
  const { d, v, dark } = useDyn();
  const p = d.players[id - 1];
  const seasons = useMemo(() => {
    if (!p) return [];
    // Every season he has stats in, newest first, with the school he played for (transfers show).
    return d.seasons.slice().reverse().map((s) => {
      const sv = s === v.season ? v : seasonView(d, s);
      const lines = playerLines(sv).filter((l) => l.player === p.id);
      return { year: s.year, team: lines[0]?.team ?? null, lines };
    });
  }, [d, v, p]);
  if (!p) return <Empty><p>There's no such player.</p></Empty>;
  const team = p.team;
  const experience = experienceOf(p, lastDoneYear(d), d.startYear);
  // His roster slots in the ROM this season (a kicker can also be the punter).
  const bwSlots = team === null ? [] : v.season.slots[team].flatMap((id, slot) => (id === p.id && v.season.bw?.[team]?.[slot] ? [slot] : []));
  // Or the slots he backs up on the bench.
  const benchSlots = team === null || bwSlots.length ? [] : (v.season.bench?.[team] ?? []).flatMap((id, slot) => (id === p.id && v.season.benchBw?.[team]?.[slot] ? [slot] : []));
  const onBench = benchSlots.length > 0;
  const shownSlots = onBench ? benchSlots : bwSlots;
  const rated = (slot: number) => (onBench ? v.season.benchBw : v.season.bw)![team!][slot]!;
  const c = team !== null ? mainColor(d, team) : '#ffffff';
  return (
    <section>
      <header className="dy-teamhead" style={team !== null ? { background: teamCss(c), color: onColor(c) } : undefined}>
        <div className="dy-teamhead-id">
        <Headshot p={p} size={120} />
        <div>
          {/* The number before the name in the school's second color, then a thin bar (user, 2026-11-12: "make the jersey number bigger, more prominent"; "i like how LSU roster puts the player number in yellow before the name"). */}
          <h2 className="dy-player-name">{p.jersey >= 0 && <><span className="dy-jersey" aria-label={`Number ${p.jersey}`} style={team !== null ? { color: accentOn(d, team) } : undefined}>{p.jersey}</span><span className="dy-jersey-bar" aria-hidden="true" /></>}<span>{playerName(p)}</span></h2>
          <p>
            <span>{shownSlots.length ? shownSlots.map((x) => (onBench ? backupLabel(x) : rated(x).label)).join(', ') : p.pos}</span>
            {team !== null && <span className="dy-status">{bwSlots.length ? 'Active Roster' : 'Backup'}</span>}
            <span>{p.cls}</span>
            <Experience p={p} />
            {p.recruit && <span title={`Signed in ${p.recruit.year}`}>{p.recruit.stars ? `${'★'.repeat(p.recruit.stars)} recruit` : 'Walk-on'} ({p.recruit.year})</span>}
            <span>{heightText(p.heightIn)}, {p.weight} lb</span>
            {team !== null && <a href={href(`team/${team}`)}>{d.teams[team].school}</a>}
            {p.hometown && <span>{hometownText(p)}</span>}
            {(p.transfers ?? []).filter((x) => x.to !== null && !(x.to === team && experience.label === 'TR')).map((x) => <span key={`${x.year}-${x.from}`}>Transferred from {d.teams[x.from].school} ({x.year + 1})</span>)}
          </p>
        </div>
        </div>
        <div className="dy-player-side">
          {shownSlots.length > 0 && (
            <dl className={`dy-teamovr${team !== null && onColor(c) === '#000' ? ' dy-on-light' : ''}`}>
              <div><dt>OVR</dt><dd>{playerOvr(shownSlots[0], rated(shownSlots[0]))}</dd></div>
            </dl>
          )}
          {/* The team's logo (user, 2026-11-12: "the team logo should go in the header too"). */}
          {team !== null && <a className="dy-player-logo" href={href(`team/${team}`)} aria-label={d.teams[team].school}><TeamMark team={team} size={96} /></a>}
        </div>
      </header>
      {seasons.filter((s) => s.year === v.season.year && s.lines.length > 0).map((s) => (
        <div key={s.year}>
          <SubHead>{s.year} season{s.team !== null && <span className="dy-sub-team"> at <TeamLink team={s.team} rank={false} /></span>}</SubHead>
          <StatTables lines={s.lines} />
        </div>
      ))}
      <div className="dy-edit-wrap">{p.status === 'active' && team !== null && <EditPlayer key={p.id} p={p} />}<EditLook key={`look-${p.id}`} p={p} /></div>
      <SubHead>Attribute ratings</SubHead>
      {shownSlots.length ? shownSlots.map((slot) => <BwRatings key={slot} team={team!} slot={slot} name={playerName(p)} bench={onBench} player={p} />) : (
        <p className="dy-dim">
          {v.season.bw ? `He isn't one of ${team !== null ? d.teams[team].school : 'his team'}'s 32 players in Bill Walsh '95 this season, so he has no ratings.` : 'Start this dynasty again to see the ratings (it was made before the app kept them).'}
        </p>
      )}
      <Honors id={p.id} />
      <Progression p={p} color={team !== null ? inkColor(d, team, dark) : 'var(--ink)'} />
      <CareerStats p={p} seasons={seasons} />
    </section>
  );
}

/**
 * His ratings season by season (user, 2026-11-12: a small chart of how each rating grew), from his year
 * records (`DPlayer.years`): OVR and the ratings his position uses, one small line each on the same 0-100
 * scale, so a big jump looks big. Shown from his second season.
 */
function Progression({ p, color }: { p: DPlayer; color: string }) {
  const years = (p.years ?? []).slice().sort((a, b) => a.year - b.year);
  if (years.length < 2) return null;
  const last = years[years.length - 1];
  const group = GROUP_OF_ROLE[roleOfPos(last.pos)];
  const attrs = (GROUP_COLUMNS[group] ?? []).filter((a) => a !== 'Weight');
  const kp = group === 'KP';
  const series = [
    { label: 'OVR', values: years.map((y) => y.ovr) },
    ...attrs.map((a) => ({ label: kp && a === 'Quickness' ? 'Kick distance' : a, values: years.map((y) => y.r[RATINGS.indexOf(a)] ?? 0) })),
  ];
  const W = 160, H = 44, PAD = 4;
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / (years.length - 1);
  const y = (v: number) => PAD + (1 - v / 100) * (H - 2 * PAD);
  return (
    <>
      <SubHead>Progression</SubHead>
      <p className="dy-dim dy-small">{years[0].year} to {last.year}, each season as he started it (0-100 for every line).</p>
      <div className="dy-prog">
        {series.map((s) => {
          // The change is between the two figures shown (22 → 20 is −2), not the rounded difference of the exact values.
          const first = s.values[0], end = s.values[s.values.length - 1], change = Math.round(end) - Math.round(first);
          return (
            <figure key={s.label} className="dy-prog-tile">
              <figcaption>
                <span>{s.label}</span>
                <span className="dy-prog-nums">{Math.round(first)} → <b>{Math.round(end)}</b> <span className={change > 0 ? 'dy-train-up' : change < 0 ? 'dy-train-down' : 'dy-dim'}>{change > 0 ? `+${change}` : change < 0 ? `−${-change}` : '±0'}</span></span>
              </figcaption>
              <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${s.label} by season: ${s.values.map((v, i) => `${years[i].year} ${Math.round(v)}`).join(', ')}`}>
                <line x1={PAD} x2={W - PAD} y1={y(50)} y2={y(50)} className="dy-prog-grid" />
                <polyline points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
                {s.values.map((v, i) => (
                  <circle key={i} cx={x(i)} cy={y(v)} r={4} fill={color} stroke="var(--surface)" strokeWidth={2}>
                    <title>{years[i].year} ({years[i].cls}): {Math.round(v)}</title>
                  </circle>
                ))}
              </svg>
              <div className="dy-prog-years"><span>{years[0].year}</span><span>{last.year}</span></div>
            </figure>
          );
        })}
      </div>
    </>
  );
}

/**
 * Career stats below the ratings (user, 2026-11-12: "Do we have career stats? Do they appear after one year
 * of stats below the ratings?"): a row per season (the school he played for, his class) and a career row,
 * per category he has stats in. Shown once he has stats from a season before this one, or from two seasons.
 */
function CareerStats({ p, seasons }: { p: DPlayer; seasons: { year: number; team: number | null; lines: PlayerLine[] }[] }) {
  const { v } = useDyn();
  const withStats = seasons.filter((s) => s.lines.length > 0).slice().reverse(); // oldest first
  if (!withStats.length || (withStats.length === 1 && withStats[0].year === v.season.year)) return null;
  const sum = (l: PlayerLine[], k: string) => (k === 'long' ? Math.max(0, ...l.map((x) => statValue(x, k))) : l.reduce((a, x) => a + statValue(x, k), 0));
  return (
    <>
      <SubHead>Career stats</SubHead>
      <div className="dy-stat-tables">
        {STAT_TABLES.map((t) => {
          const rows = withStats.map((s) => ({ s, lines: s.lines.filter((l) => l.cat === t.cat) })).filter((r) => r.lines.some((l) => t.cols.some(([k]) => statValue(l, k) > 0)));
          if (!rows.length) return null;
          const all = rows.flatMap((r) => r.lines);
          return (
            <div key={t.cat} className="dy-scroll-x">
            <Table figures>
              <caption>{t.title}</caption>
              <thead><tr><th className="ui-left">Season</th><th className="ui-left">Team</th><th>Class</th>{t.cols.map(([k, label]) => <th key={k}>{label}</th>)}</tr></thead>
              <tbody>
                {rows.map(({ s, lines }) => (
                  <tr key={s.year}>
                    <td className="ui-left">{s.year}</td>
                    <td className="ui-left">{s.team !== null ? <TeamLink team={s.team} rank={false} size={16} /> : ''}</td>
                    <td className="ui-text">{p.years?.find((y) => y.year === s.year)?.cls ?? ''}</td>
                    {t.cols.map(([k]) => <td key={k}><Num value={sum(lines, k)} /></td>)}
                  </tr>
                ))}
                {rows.length > 1 && (
                  <tr className="ui-total">
                    <td className="ui-left" colSpan={3}>Career</td>
                    {t.cols.map(([k]) => <td key={k}><Num value={sum(all, k)} /></td>)}
                  </tr>
                )}
              </tbody>
            </Table>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---- the game's ratings: a shape against the league average and a tile per rating

/** What each position group is called (singular, plural). */
const ROLE_NAMES: Record<string, [string, string]> = {
  QB: ['QB', 'QBs'], HB: ['HB', 'HBs'], FB: ['FB', 'FBs'], WR: ['WR', 'WRs'], TE: ['TE', 'TEs'],
  OL: ['offensive lineman', 'offensive linemen'], DE: ['DE', 'DEs'], DT: ['DT', 'DTs'], LB: ['LB', 'LBs'],
  CB: ['CB', 'CBs'], S: ['safety', 'safeties'], K: ['kicker', 'kickers'], P: ['punter', 'punters'],
};

const ordinal = (n: number) => {
  const t = n % 100, u = n % 10;
  return `${n}${t >= 11 && t <= 13 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th'}`;
};

function BwRatings({ team, slot, name, bench = false, player }: { team: number; slot: number; name: string; bench?: boolean; player?: DPlayer }) {
  const { d, v, dark } = useDyn();
  // A bench player is rated on the game's scale too (what he'd have if he played), against the players in the game.
  const b = (bench ? v.season.benchBw : v.season.bw)![team][slot]!;
  // Everyone at his position on every team (the OVR's groups): HB1 and HB2 together, all five linemen …
  const role = roleOfSlot(slot);
  const league = v.season.bw!.flatMap((t) => t.filter((x, k): x is NonNullable<typeof x> => !!x && roleOfSlot(k) === role));
  const n = league.length;
  // Fine values (16 × step + offset, ratings.ts): what the game plays with since the fine-ratings mod.
  const fv = (x: typeof b, i: number) => fineAt(x, i);
  const avg = b.attrs.map((_, i) => league.reduce((a, x) => a + fv(x, i), 0) / n);
  const rank = b.attrs.map((_, i) => 1 + league.filter((x) => fv(x, i) > fv(b, i)).length);
  const self = bench ? 0 : 1; // he's one of the league's players unless he's on the bench
  const tied = b.attrs.map((_, i) => league.filter((x) => fv(x, i) === fv(b, i)).length - self);
  // Weight: the share of starters he outweighs, counting those at his weight as half.
  const heavier = b.attrs.map((_, i) => league.reduce((a, x) => a + (fv(x, i) < fv(b, i) ? 1 : fv(x, i) === fv(b, i) ? 0.5 : 0), 0) - 0.5 * self);
  const color = inkColor(d, team, dark); // a color that shows on the page
  const [one, who] = ROLE_NAMES[role] ?? [b.label, `${b.label}s`];

  // Shape: the five ratings other than weight, 100 at the rim.
  // A rating everyone in the group has the same (linemen's Hands: 0) says nothing: no rank, not in the shape.
  const flat = b.attrs.map((_, i) => league.every((x) => x.steps[i] === league[0].steps[i]) && league.every((x) => x.steps[i] === 0));
  const axes = b.attrs.map((a, i) => ({ a, i })).filter((x) => x.a !== 'Weight' && !flat[x.i]);
  const C = 150, CY = 130, R = 96;
  const pt = (k: number, r: number) => {
    const ang = (-90 + (360 / axes.length) * k) * (Math.PI / 180);
    return [C + r * Math.cos(ang), CY + r * Math.sin(ang)];
  };
  const poly = (f: (i: number) => number) => axes.map((x, k) => pt(k, (Math.min(240, f(x.i)) / 240) * R).map((z) => z.toFixed(1)).join(',')).join(' ');
  // A kicker's or punter's Quick is his kick distance in the game.
  const label = (a: string) => (b.group === 'KP' && a === 'Quickness' ? 'Kick distance' : a);
  const tiles = b.attrs.map((a, i) => ({ a, i })).sort((x, y) => Number(x.a === 'Weight' || flat[x.i]) - Number(y.a === 'Weight' || flat[y.i]) || rank[x.i] - rank[y.i]);

  return (
    <div className="dy-bw">
      <p className="dy-dim">{bench ? `${d.teams[team].school}'s ${backupLabel(slot)}, not on the Active Roster this season: his ratings if he played, ranked against all ${n} active ${who}.` : `${d.teams[team].school}'s ${b.label}, ranked among all ${n} ${who}.`}</p>
      <div className="dy-bw-grid">
        <figure className="dy-shape">
          <svg viewBox="0 0 300 250" role="img" aria-label={`${name}'s ratings against the average ${one}`}>
            <polygon points={poly(() => 240)} className="dy-shape-rim" />
            <polygon points={poly(() => 120)} className="dy-shape-mid" />
            {axes.map((x, k) => { const [px, py] = pt(k, R); return <line key={x.a} x1={C} y1={CY} x2={px} y2={py} className="dy-shape-mid" />; })}
            <polygon points={poly((i) => avg[i])} className="dy-shape-avg" />
            <polygon points={poly((i) => fv(b, i))} style={{ fill: color, stroke: color }} className="dy-shape-him" />
            {axes.map((x, k) => {
              const [px, py] = pt(k, R + 18);
              return <text key={x.a} x={px} y={py + 4} textAnchor={Math.abs(px - C) < 5 ? 'middle' : px > C ? 'start' : 'end'}>{label(x.a)}</text>;
            })}
          </svg>
          <figcaption>
            <span><i style={{ background: color }} /> {name}</span>
            <span><i className="dy-key-avg" /> Average {one}</span>
          </figcaption>
        </figure>
        <div className="dy-tiles">
          {tiles.map(({ a, i }) => {
            const weight = a === 'Weight';
            const f = fv(b, i);
            const shown = weight ? `${140 + f + b.weightPlus} lb` : shownFine(f);
            const avgShown = weight ? `${Math.round(140 + avg[i] + b.weightPlus)} lb` : shownFine(Math.round(avg[i]));
            return (
              <div key={a} className="dy-tile">
                <div className="dy-tile-top"><span>{label(a)}</span><strong>{weight ? <>{parseInt(`${shown}`, 10)}<small> lb</small></> : shown}</strong></div>
                <div className="dy-pips" role="img" aria-label={`${shown}; average ${one} ${avgShown}`}>
                  {Array.from({ length: 15 }, (_, k) => {
                    // 15 pips of 16 fine points each; the one he's part of the way through is partly filled.
                    const part = Math.max(0, Math.min(1, (Math.min(240, f) - 16 * k) / 16));
                    return <span key={k} style={part >= 1 ? { background: color } : part > 0 ? { background: `linear-gradient(90deg, ${color} ${Math.round(part * 100)}%, transparent ${Math.round(part * 100)}%)` } : undefined} />;
                  })}
                  <i style={{ left: `calc(${(Math.min(240, avg[i]) / 240) * 100}% - 1px)` }} title={`Average ${one}`} />
                </div>
                <div className="dy-tile-note">
                  {flat[i] ? `The same for all ${n} ${who}` : weight ? `Heavier than ${Math.round((heavier[i] / Math.max(1, n - self)) * 100)}% of ${who}` : tied[i] > 0 ? <><strong>Tied for {ordinal(rank[i])}</strong> of {n} {who}, with {tied[i]} {tied[i] === 1 ? 'other' : 'others'}</> : <><strong>{ordinal(rank[i])}</strong> of {n} {who}</>}
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
      <PageHead title="Stat leaders">{v.season.year} season to date.</PageHead>
      <div className="dy-boards">
        {LEADER_BOARDS.map((b) => (
          <Table key={b.title} figures className="dy-board">
            <caption>{b.title}</caption>
            <tbody>
              {leaders(lines, b.cat, b.key, 10).map((l, i) => (
                <tr key={`${l.team}-${l.slot}`}>
                  <td className="dy-dim">{i + 1}</td>
                  <td className="ui-left"><PlayerCell line={l} /> <span className="dy-dim dy-small">{d.teams[l.team].school}</span></td>
                  <td className="dy-strong"><Num value={statValue(l, b.key)} /></td>
                </tr>
              ))}
            </tbody>
          </Table>
        ))}
      </div>
    </section>
  );
}

// ---- history

export function History() {
  const { d } = useDyn();
  const champs = useMemo(() => champions(d), [d]);
  const hasAwards = useMemo(() => d.seasons.some((s) => seasonAwards(d, s)), [d]);
  return (
    <section>
      <PageHead title="History">Every season of this dynasty since {d.startYear}.</PageHead>
      <div className="dy-row"><Button variant="quiet" href={href('records')}>Records book</Button>{hasAwards && <Button variant="quiet" href={href('awards')}>Season awards</Button>}</div>
      <div className="dy-team-cols">
        <div>
          <SubHead>National champions</SubHead>
          {champs.length ? (
            <Table figures>
              <tbody>
                {champs.slice().reverse().map((c) => (
                  <tr key={c.year}><td className="ui-left">{c.year}</td><td className="ui-left"><TeamLink team={c.team} rank={false} full /></td><td>{recordText(c.record)}</td></tr>
                ))}
              </tbody>
            </Table>
          ) : <p className="dy-dim">No champion yet. The national championship game crowns the first one.</p>}
          {d.userTeams.map((t) => (
            <div key={t}>
              <SubHead>{d.teams[t].school} by season</SubHead>
              <Table figures>
                <tbody>
                  {teamHistory(d, t).map((h) => (
                    <tr key={h.year}>
                      <td className="ui-left">{h.year}</td>
                      <td className={h.imported ? undefined : 'ui-text'}>{h.imported ? recordText(h.record) : 'No save yet'}</td>
                      <td>{h.imported && h.rank <= 25 ? `No. ${h.rank}` : ''}</td>
                      <td className="ui-text">{h.champion ? 'National champions' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** The last completed season: the one the offseason follows, else the current one once it's over. */
function lastDoneYear(d: Dynasty): number {
  const s = d.seasons[d.seasons.length - 1];
  if (d.offseason) return d.offseason.year;
  return seasonDone(d) ? s.year : s.year - 1;
}

/** Letters at his school ("2L"), "TR (Louisville)" or "HS", with an explanation on tap or hover. */
function Experience({ p }: { p: DPlayer }) {
  const { d } = useDyn();
  const [open, setOpen] = useState(false);
  if (p.team === null) return null;
  const x = experienceOf(p, lastDoneYear(d), d.startYear);
  const school = d.teams[p.team].school;
  const help = `Experience at ${school}: letters earned, one per season played there (2L = two seasons). TR: transferred in, no season there yet. HS: first season out of high school.`;
  const text = x.label === 'TR' && x.from !== null ? `TR (${d.teams[x.from].school})` : x.label;
  return (
    <span className="dy-exp">
      <button type="button" className="dy-exp-btn" title={help} aria-expanded={open} onClick={() => setOpen(!open)}>{text}</button>
      {open && <span className="dy-exp-help" role="note">{help}</span>}
    </span>
  );
}
