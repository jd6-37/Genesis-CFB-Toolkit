// Headline windows (user, 2026-11-26: "make every headline open a modal like the player game stats headlines do …
// Even just the opponent and score would be useful"). A game's story opens its box score as far as the app knows it;
// a ranking story the poll; a stat story that stat's top five; a race the standings; the playoff field or the bowls.
// Every headline opens a window (user, 2026-11-27: "every headline should open to a modal"): a Top 25 move the poll
// around the team; any other story without its own window the team's (or player's) week.
import { createPortal } from 'react-dom';
import { useState } from 'react';
import { Button, Modal, Table } from '../../ui';
import type { Story } from '../../core/dynasty/news';
import type { SaveGame } from '../../core/dynasty/save';
import { bowlOf, bowlWeek, leaders, playerLines, playerName, standings, statValue, weekName } from '../../core/dynasty/derive';
import { kickoffRanks } from '../../core/dynasty/kickoffRanks';
import { kickoffOf } from '../../core/dynasty/schedule';
import { rivalryOf } from '../../core/dynasty/rivalries';
import { gameLeaders } from '../../core/dynasty/gameBox';
import { seriesStory } from '../../core/dynasty/series';
import { statsHref } from './StatsPage';
import { Headshot, TeamLink, TeamMark, href, recordText, useDyn, Ranked } from './ui';

type Played = SaveGame & { visitor: number; home: number; vs: number; hs: number };
type Win = 'game' | 'potw' | 'poll' | 'unbeaten' | 'stat' | 'race' | 'field' | 'rank' | 'team';

/** Which window a story opens: every story opens one. */
export function windowOf(s: Story, played: boolean): Win {
  if (s.box && s.player) return 'potw';
  if (s.game !== undefined && played) return 'game';
  if (s.kind === 'number1') return 'poll';
  if (s.kind === 'unbeaten') return 'unbeaten';
  if (s.stat) return 'stat';
  if (s.conf !== undefined) return 'race';
  if (s.kind === 'cfp') return 'field';
  if (s.poll) return 'rank';
  return 'team';
}

/** A story's headline: it opens the story's window (the link's address is the team's or player's page, for a new tab). */
export function StoryLink({ s }: { s: Story }) {
  const { v } = useDyn();
  const [open, setOpen] = useState(false);
  const g = s.game !== undefined ? (v.games.find((x) => x.index === s.game && x.vs !== null && x.visitor !== null && x.home !== null) as Played | undefined) : undefined;
  const win = windowOf(s, !!g);
  const page = href(s.player ? `player/${s.player}` : `team/${s.teams[0]}`);
  const close = () => setOpen(false);
  return (
    <>
      <a href={page} onClick={(e) => { e.preventDefault(); setOpen(true); }}>{s.headline}</a>
      {/* In a portal: a window opened from a headline would otherwise sit inside the headline's <h2> and take its
          type (user, 2026-11-28: the playoff field window in the lead story's big title font). */}
      {open && createPortal(
        win === 'game' ? <GameWindow s={s} g={g!} onClose={close} />
          : win === 'potw' ? <PlayerGameWindow s={s} onClose={close} />
            : win === 'poll' ? <PollWindow s={s} onClose={close} />
              : win === 'unbeaten' ? <UnbeatenWindow s={s} onClose={close} />
                : win === 'stat' ? <StatWindow s={s} onClose={close} />
                  : win === 'race' ? <RaceWindow s={s} onClose={close} />
                    : win === 'field' ? <FieldWindow s={s} onClose={close} />
                      : win === 'rank' ? <RankWindow s={s} onClose={close} />
                        : <TeamWindow s={s} onClose={close} />,
        document.body,
      )}
    </>
  );
}

const CloseButton = ({ onClose }: { onClose: () => void }) => <Button variant="quiet" onClick={onClose}>Close</Button>;

/** A game: the score, each team's leaders when the saves frame the week, the poll, the series and what's next. */
function GameWindow({ s, g, onClose }: { s: Story; g: Played; onClose: () => void }) {
  const { d, v } = useDyn();
  const name = (t: number) => d.teams[t].school;
  const ranks = kickoffRanks(d, v.season)[g.week];
  const label = kickoffOf(v.season, g)?.name ?? (() => { const r = rivalryOf(name(g.visitor), name(g.home)); return r ? r[0].toUpperCase() + r.slice(1) : null; })()
    ?? (v.bowls ? bowlOf(v, g) : null);
  // Each team's record after this game.
  const recAt = (t: number) => {
    let w = 0, l = 0;
    for (const x of v.games) {
      if (x.week > g.week || x.vs === null || x.hs === null || x.vs === x.hs || (x.visitor !== t && x.home !== t)) continue;
      if ((x.visitor === t) === (x.vs > x.hs)) w++; else l++;
    }
    return `${w}-${l}`;
  };
  const lines = gameLeaders(d, v.season, g.week, [g.visitor, g.home]);
  const latest = !v.games.some((x) => x.week > g.week && x.vs !== null);
  const series = seriesStory(d, g.visitor, g.home, { year: v.season.year, week: g.week }, name);
  const poll = (t: number) => {
    if (!latest || !ranks) return null;
    const a = ranks[t], b = v.rank[t];
    const inA = a >= 1 && a <= 25, inB = b >= 1 && b <= 25;
    if (!inA && !inB) return null;
    if (a === b) return `${name(t)} stays #${a}`;
    return `${name(t)} ${inA ? `#${a}` : 'unranked'} to ${inB ? `#${b}` : 'unranked'}`;
  };
  const polls = [poll(g.visitor), poll(g.home)].filter(Boolean);
  const next = (t: number) => {
    const n = v.games.find((x) => x.week > g.week && (x.visitor === t || x.home === t));
    if (!n) return `${name(t)}: season over`;
    const o = n.visitor === t ? n.home : n.visitor;
    const score = n.vs !== null && n.hs !== null ? ` (${n.vs === n.hs ? 'T' : (n.visitor === t) === (n.vs > n.hs) ? 'W' : 'L'} ${Math.max(n.vs, n.hs)}-${Math.min(n.vs, n.hs)})` : '';
    return `${name(t)}: ${weekName(v, n.week)}, ${n.visitor === t ? 'at' : 'vs.'} ${o === null ? 'to be decided' : name(o)}${score}`;
  };
  const won = (t: number) => (t === g.visitor ? g.vs > g.hs : g.hs > g.vs);
  const row = (t: number, pts: number) => (
    <div className={`dy-gw-row${won(t) ? ' dy-gw-won' : ''}`}>
      <TeamMark team={t} size={32} />
      <span className="dy-gw-team">
        {ranks && ranks[t] >= 1 && ranks[t] <= 25 && <span className="dy-gw-rank">{ranks[t]}</span>}
        <a href={href(`team/${t}`)}>{name(t)}</a>
        <span className="dy-gw-rec">{recAt(t)}</span>
      </span>
      <span className="dy-gw-pts">{pts}</span>
    </div>
  );
  // The named opening game and the postseason are at neutral sites (as far as the app knows).
  const neutral = !!kickoffOf(v.season, g) || g.week > v.lastRegularWeek;
  return (
    <Modal wide title={s.headline} onClose={onClose} sub={<>{weekName(v, g.week)}{label ? `, ${label}` : ''}</>}
      actions={<><Button href={href(`scores/${g.week}`)} onClick={onClose}>{weekName(v, g.week)} scores</Button><CloseButton onClose={onClose} /></>}>
      <div className="dy-gw-board">
        {row(g.visitor, g.vs)}
        {row(g.home, g.hs)}
        <p className="dy-gw-final">Final{neutral ? '' : `, at ${name(g.home)}`}</p>
      </div>
      {lines ? (
        <section>
          <h3 className="dy-gw-head">Game leaders</h3>
          <div className="dy-gw-leaders">
            {[g.visitor, g.home].map((t) => (
              <div key={t}>
                <p className="dy-gw-lteam"><TeamMark team={t} size={16} /> {name(t)}</p>
                {lines.get(t)!.length ? lines.get(t)!.map((l) => (
                  <p key={l.cat} className="dy-gw-line"><span className="dy-gw-cat">{l.cat}</span><a href={href(`player/${l.player}`)}>{l.name}</a><span className="dy-dim">{l.line}</span></p>
                )) : <p className="dy-gw-none dy-dim">No stats recorded.</p>}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <p className="dy-gw-note">No player stats for this game: they need saves imported right before and right after {weekName(v, g.week)}.</p>
      )}
      <section>
        <h3 className="dy-gw-head">Around the game</h3>
        <ul className="dy-gw-facts">
          {polls.length > 0 && <li><span className="dy-gw-cat">Poll</span><span>{polls.join('; ')}</span></li>}
          <li>
            <span className="dy-gw-cat">Series</span>
            <span>
              {series.record}.
              {series.facts.map((f) => <span key={f} className="dy-gw-fact">{f}.</span>)}
            </span>
          </li>
          {series.last.length > 0 && (
            <li>
              <span className="dy-gw-cat">Last met</span>
              <span>{series.last.map((m) => `${m.year}, ${m.winner === null ? `tie ${m.vs}-${m.hs}` : `${name(m.winner)} ${Math.max(m.vs, m.hs)}-${Math.min(m.vs, m.hs)}`}`).join('; ')}</span>
            </li>
          )}
          <li><span className="dy-gw-cat">Next</span><span>{next(g.visitor)}. {next(g.home)}.</span></li>
        </ul>
      </section>
    </Modal>
  );
}

/** A player of the week's game: the result and his stat lines, with a link to his page. */
function PlayerGameWindow({ s, onClose }: { s: Story; onClose: () => void }) {
  const { d, v } = useDyn();
  const p = d.players[s.player! - 1];
  return (
    <Modal
      title={playerName(p)} onClose={onClose} media={<Headshot p={p} size={64} />}
      sub={<>#{p.jersey} {p.pos}, <TeamLink team={s.teams[0]} size={16} /></>}
      actions={<><Button href={href(`player/${p.id}`)} onClick={onClose}>Player page</Button><CloseButton onClose={onClose} /></>}
    >
      <p className="dy-small">{s.headline}{s.box!.result ? `: ${s.box!.result}` : ''}.</p>
      {s.box!.lines.map((l) => (
        <Table key={l.cat} figures className="dy-box-table">
          <thead><tr><th className="ui-left">{l.cat}</th>{l.cells.map(([k]) => <th key={k}>{k}</th>)}</tr></thead>
          <tbody><tr><td className="ui-left dy-dim">{weekName(v, s.week)}</td>{l.cells.map(([k, x]) => <td key={k}>{x}</td>)}</tr></tbody>
        </Table>
      ))}
    </Modal>
  );
}

/** A new No. 1: the top 10 with each team's move this week. */
function PollWindow({ s, onClose }: { s: Story; onClose: () => void }) {
  const { d, v } = useDyn();
  const before = kickoffRanks(d, v.season)[s.week];
  return (
    <Modal title={s.headline} onClose={onClose} sub={<>The top 10 after {weekName(v, s.week)}</>}
      actions={<><Button href={href('rankings')} onClick={onClose}>Full rankings</Button><CloseButton onClose={onClose} /></>}>
      <ol className="dy-gw-list">
        {v.order.slice(0, 10).map((t, i) => {
          const was = before?.[t] ?? 0;
          const mv = was ? was - (i + 1) : 0;
          return (
            <li key={t} className={t === s.teams[0] ? 'dy-gw-hot' : ''}>
              <span className="dy-gw-n">{i + 1}</span><TeamMark team={t} size={20} /><a href={href(`team/${t}`)}><Ranked team={t} /></a>
              <span className="dy-dim">{recordText(v.records[t])}</span>
              <span className={`dy-gw-move${mv > 0 ? ' dy-up' : mv < 0 ? ' dy-down' : ''}`}>{!was || was > 25 ? 'New' : mv > 0 ? `Up ${mv}` : mv < 0 ? `Down ${-mv}` : 'No change'}</span>
            </li>
          );
        })}
      </ol>
    </Modal>
  );
}

/** The unbeaten teams, with their ranks. */
function UnbeatenWindow({ s, onClose }: { s: Story; onClose: () => void }) {
  const { d, v } = useDyn();
  return (
    <Modal title={s.headline} onClose={onClose} sub={<>After {weekName(v, s.week)}</>}
      actions={<><Button href={href('standings')} onClick={onClose}>Standings</Button><CloseButton onClose={onClose} /></>}>
      <ol className="dy-gw-list dy-gw-list-plain">
        {s.teams.map((t) => (
          <li key={t}>
            <span className="dy-gw-n">{v.rank[t] <= 25 ? v.rank[t] : ''}</span><TeamMark team={t} size={20} /><a href={href(`team/${t}`)}><Ranked team={t} /></a>
            <span className="dy-dim">{recordText(v.records[t])}</span><span />
          </li>
        ))}
      </ol>
    </Modal>
  );
}

/** A stat leader, milestone or record: that stat's top five this season. */
function StatWindow({ s, onClose }: { s: Story; onClose: () => void }) {
  const { d, v } = useDyn();
  const st = s.stat!;
  const top = leaders(playerLines(v), st.cat, st.key, 5);
  return (
    <Modal title={s.headline} onClose={onClose} sub={<>{st.label}, {v.season.year} season</>}
      actions={<><Button href={statsHref(st.cat, st.key)} onClick={onClose}>All {st.label.toLowerCase()}</Button><CloseButton onClose={onClose} /></>}>
      <ol className="dy-gw-list">
        {top.map((l, i) => {
          const p = l.player ? d.players[l.player - 1] : undefined;
          return (
            <li key={`${l.team}-${l.slot}`} className={l.player === s.player ? 'dy-gw-hot' : ''}>
              <span className="dy-gw-n">{i + 1}</span><TeamMark team={l.team} size={20} />
              <span>{p ? <a href={href(`player/${p.id}`)}>{playerName(p)}</a> : 'Unknown'} <span className="dy-dim dy-small"><Ranked team={l.team} /></span></span>
              <span />
              <span className="dy-gw-move dy-strong">{statValue(l, st.key).toLocaleString('en-US')}</span>
            </li>
          );
        })}
      </ol>
    </Modal>
  );
}

/** A conference race: the conference's standings. */
function RaceWindow({ s, onClose }: { s: Story; onClose: () => void }) {
  const { d, v } = useDyn();
  const c = s.conf!;
  return (
    <Modal title={s.headline} onClose={onClose} sub={<>{v.season.confNames[c] ?? 'Conference'} standings after {weekName(v, s.week)}</>}
      actions={<><Button href={href('standings')} onClick={onClose}>All standings</Button><CloseButton onClose={onClose} /></>}>
      <Table figures>
        <thead><tr><th className="ui-left">Team</th><th>Conf</th><th>Overall</th></tr></thead>
        <tbody>
          {standings(v, c).map((r) => (
            <tr key={r.team} className={d.userTeams.includes(r.team) ? 'dy-side-mine' : ''}>
              <td className="ui-left"><TeamLink team={r.team} size={16} /></td>
              <td>{r.cw}-{r.cl}</td><td>{r.w}-{r.l}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Modal>
  );
}

/** The playoff field (2026) or the bowl lineup (1994). */
function FieldWindow({ s, onClose }: { s: Story; onClose: () => void }) {
  const { d, v } = useDyn();
  const seeds = v.save?.season?.seeds ?? [];
  const bowls = v.bowls ? v.games.filter((g) => g.week === bowlWeek(v) && g.visitor !== null && g.home !== null) : [];
  return (
    <Modal title={s.headline} onClose={onClose} sub={<>{v.season.year} season</>}
      actions={<><Button href={href(`scores/${s.week}`)} onClick={onClose}>{weekName(v, s.week)} scores</Button><CloseButton onClose={onClose} /></>}>
      {bowls.length ? (
        <ul className="dy-gw-facts">
          {bowls.map((g) => (
            <li key={g.index}>
              <span className="dy-gw-cat">{bowlOf(v, g)}</span>
              <span><TeamLink team={g.visitor!} size={16} /> {g.vs ?? ''} <span className="dy-dim">vs.</span> <TeamLink team={g.home!} size={16} /> {g.hs ?? ''}</span>
            </li>
          ))}
        </ul>
      ) : (
        <ol className="dy-gw-list dy-gw-list-plain">
          {seeds.map((t, i) => (
            <li key={t}>
              <span className="dy-gw-n">{i + 1}</span><TeamMark team={t} size={20} /><a href={href(`team/${t}`)}><Ranked team={t} /></a>
              <span className="dy-dim">{recordText(v.records[t])}</span><span />
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

/** A team's result in a week ("W 31-10 vs. Iowa"), or null. */
function resultIn(v: ReturnType<typeof useDyn>['v'], name: (t: number) => string, t: number, week: number) {
  const g = v.games.find((x) => x.week === week && (x.visitor === t || x.home === t) && x.vs !== null && x.hs !== null);
  if (!g) return null;
  const mine = g.visitor === t ? g.vs! : g.hs!, theirs = g.visitor === t ? g.hs! : g.vs!, o = g.visitor === t ? g.home : g.visitor;
  return `${mine > theirs ? 'W' : mine < theirs ? 'L' : 'T'} ${Math.max(mine, theirs)}-${Math.min(mine, theirs)} ${g.visitor === t ? 'at' : 'vs.'} ${o === null ? 'TBD' : name(o)}`;
}
/** A team's next game after a week, or null. */
function nextAfter(v: ReturnType<typeof useDyn>['v'], name: (t: number) => string, t: number, week: number) {
  const n = v.games.find((x) => x.week > week && (x.visitor === t || x.home === t) && x.vs === null);
  if (!n) return null;
  const o = n.visitor === t ? n.home : n.visitor;
  return `${weekName(v, n.week)}, ${n.visitor === t ? 'at' : 'vs.'} ${o === null ? 'to be decided' : name(o)}`;
}

/** A team's move into or out of the Top 25: the bottom of the poll with the team, its week and its next game. */
function RankWindow({ s, onClose }: { s: Story; onClose: () => void }) {
  const { d, v } = useDyn();
  const t = s.teams[0], { was, now } = s.poll!;
  const name = (x: number) => d.teams[x].school;
  const before = kickoffRanks(d, v.season)[s.week];
  const from = Math.max(1, Math.min(was || 26, now, 26) - 4);
  const rows = v.order.slice(from - 1, 25);
  if (now > 25) rows.push(t);
  const res = resultIn(v, name, t, s.week), nx = nextAfter(v, name, t, s.week);
  return (
    <Modal title={s.headline} onClose={onClose} sub={<>The poll after {weekName(v, s.week)}</>}
      actions={<><Button href={href(`team/${t}`)} onClick={onClose}>Team page</Button><CloseButton onClose={onClose} /></>}>
      <p>{s.dek}</p>
      <ol className="dy-gw-list">
        {rows.map((x) => {
          const r = v.rank[x], w = before?.[x] ?? 0, mv = w && w <= 25 && r <= 25 ? w - r : 0;
          return (
            <li key={x} className={x === t ? 'dy-gw-hot' : ''}>
              <span className="dy-gw-n">{r}</span><TeamMark team={x} size={20} /><a href={href(`team/${x}`)}>{name(x)}</a>
              <span className="dy-dim">{recordText(v.records[x])}</span>
              <span className={`dy-gw-move${mv > 0 || (r <= 25 && (!w || w > 25)) ? ' dy-up' : mv < 0 || (r > 25 && w <= 25) ? ' dy-down' : ''}`}>
                {r <= 25 && (!w || w > 25) ? 'New' : r > 25 ? (w && w <= 25 ? `Out (was ${w})` : '') : mv > 0 ? `Up ${mv}` : mv < 0 ? `Down ${-mv}` : 'No change'}
              </span>
            </li>
          );
        })}
      </ol>
      <ul className="dy-gw-facts">
        {res && <li><span className="dy-gw-cat">{weekName(v, s.week)}</span><span>{res}</span></li>}
        <li><span className="dy-gw-cat">Next</span><span>{nx ?? 'Season over'}</span></li>
      </ul>
    </Modal>
  );
}

/** Any other story: the story's text, then its team's week (record, rank, result, next game) and its links. */
function TeamWindow({ s, onClose }: { s: Story; onClose: () => void }) {
  const { d, v } = useDyn();
  const name = (x: number) => d.teams[x].school;
  const teams = s.teams.slice(0, 2);
  return (
    <Modal title={s.headline} onClose={onClose} sub={<>{v.season.year}, {weekName(v, s.week)}</>}
      actions={<>
        {s.player ? <Button href={href(`player/${s.player}`)} onClick={onClose}>Player page</Button>
          : teams[0] !== undefined && <Button href={href(`team/${teams[0]}`)} onClick={onClose}>Team page</Button>}
        <CloseButton onClose={onClose} />
      </>}>
      {s.dek && <p>{s.dek}</p>}
      {teams.map((t) => {
        const res = resultIn(v, name, t, s.week), nx = nextAfter(v, name, t, s.week);
        return (
          <div key={t} className="dy-gw-teamweek">
            <div className="dy-gw-row"><TeamMark team={t} size={32} /><span className="dy-gw-team"><a href={href(`team/${t}`)}><Ranked team={t} /></a></span><span className="dy-dim">{recordText(v.records[t])}</span></div>
            <ul className="dy-gw-facts">
              {res && <li><span className="dy-gw-cat">{weekName(v, s.week)}</span><span>{res}</span></li>}
              <li><span className="dy-gw-cat">Next</span><span>{nx ?? 'Season over'}</span></li>
            </ul>
          </div>
        );
      })}
    </Modal>
  );
}
