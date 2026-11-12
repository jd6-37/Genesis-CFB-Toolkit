// The schedule editor (user, 2026-11-12: "Generate each year, and then the user can edit … We don't need to edit
// cpu teams, only the dynasty team(s)"; "I would like to be able to edit conference games too"). From the second
// season, before its first import: a user team's 12 weeks, each with its opponent, site and week.
import { useMemo, useState } from 'react';
import { INDEPENDENT } from '../../core/dynasty/derive';
import { rivalryOf } from '../../core/dynasty/rivalries';
import {
  checkSchedule, editSchedule, flipHome, moveGame, protectedPairs, remakeSchedule, SCHED_WEEKS, scheduleLock, setOpponent, teamSchedule,
  type DSchedule,
} from '../../core/dynasty/schedule';
import { Empty, TeamLink, href, useDyn } from './ui';

export function ScheduleEditor({ arg }: { arg?: string }) {
  const { d, commit, downloadRom } = useDyn();
  const season = d.seasons[d.seasons.length - 1];
  const sched = season.schedule;
  const asked = Number(arg);
  const team = Number.isInteger(asked) && d.userTeams.includes(asked) ? asked : d.userTeams[0];
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const schools = useMemo(() => d.teams.map((t) => t.school), [d]);
  const check = useMemo(() => (sched ? checkSchedule(sched, schools, season.conf) : null), [sched, schools, season.conf]);
  if (!sched || !check) return <Empty><p>From the second season on, the app makes each season's schedule and you can change your teams' games. The first season plays the schedule chosen in the game (Real 2026 or Random).</p></Empty>;
  if (team === undefined) return <Empty><p>Pick your teams first (Manage): you can change their schedules.</p></Empty>;

  const lock = scheduleLock(season);
  const conf = season.conf;
  const name = (t: number) => d.teams[t].school;
  const rows = teamSchedule(sched, team);
  const sameConf = (a: number, b: number) => conf[a] === conf[b] && conf[a] !== INDEPENDENT;
  const others = d.teams.filter((t) => t.index !== team).sort((a, b) => a.school.localeCompare(b.school));
  const confTeams = others.filter((t) => sameConf(team, t.index));
  const restTeams = others.filter((t) => !sameConf(team, t.index));
  const myMissing = check.missing.filter(([a, b]) => a === team || b === team);
  const myRepeats = check.repeats.filter(([a, b]) => a === team || b === team);
  const isProtected = new Set(protectedPairs(schools).map((p) => `${Math.min(p.a, p.b)}-${Math.max(p.a, p.b)}`));
  const confTarget = conf[team] === INDEPENDENT ? 0 : season.confWeeks?.games[conf[team]];

  const change = async (fn: (s: DSchedule) => DSchedule, done: (s: DSchedule) => string) => {
    try {
      let after: DSchedule | undefined;
      const next = editSchedule(d, (s) => (after = fn(s)));
      await commit(next);
      setNote({ kind: 'ok', text: done(after!) });
    } catch (e) {
      setNote({ kind: 'error', text: (e as Error).message });
    }
  };
  const pickOpponent = (week: number, opp: number) => {
    // Already on the schedule another week: that game moves here.
    const already = rows.findIndex((x) => x?.opp === opp);
    if (already >= 0) { pickWeek(already, week); return; }
    const old = rows[week]!.opp;
    const oldOfNew = teamSchedule(sched, opp)[week]!.opp;
    void change((s) => setOpponent(s, week, team, opp), () =>
      `Week ${week + 1}: ${name(team)} plays ${name(opp)}; ${name(old)} plays ${name(oldOfNew)} instead.`);
  };
  const pickWeek = (from: number, to: number) => {
    const a = rows[from]!.opp, b = rows[to]!.opp;
    void change((s) => moveGame(s, team, from, to), () =>
      `${name(a)} moves to week ${to + 1} and ${name(b)} to week ${from + 1}; their other games those weeks switch too.`);
  };
  const remake = async () => {
    setConfirmNew(false);
    try {
      await commit(remakeSchedule(d, Math.floor(Math.random() * 0x7fffffff)));
      setNote({ kind: 'ok', text: `A new ${season.year} schedule for every team.` });
    } catch (e) {
      setNote({ kind: 'error', text: (e as Error).message });
    }
  };

  return (
    <section className="dy-sched">
      <div className="dy-pagehead">
        <h2>{season.year} schedule</h2>
        {d.userTeams.length > 1 && (
          <select aria-label="Team" value={team} onChange={(e) => { location.hash = href(`schedule/${e.target.value}`); }}>
            {d.userTeams.map((t) => <option key={t} value={t}>{name(t)}</option>)}
          </select>
        )}
      </div>
      <p className="dy-small dy-dim">
        Made with the game's rules for random schedules, with the traditional rivalries kept every season.
        {lock ? '' : ' Change an opponent, a week or home and away: the teams your change leaves without a game that week play each other, so everyone still plays every week.'}
      </p>
      {lock && <p className="dy-note dy-small">{lock}</p>}
      {note && <p className={`dy-note dy-note-${note.kind} dy-small`} role="status">{note.text}</p>}
      {!lock && season.romDownloaded && season.lineupEdited && (
        <p className="dy-note dy-small">
          You changed the schedule or lineup after downloading the ROM. Download the {season.year} ROM again before you start the New Season.{' '}
          <button type="button" className="dy-button dy-quiet" onClick={() => downloadRom(season.year)}>Download the {season.year} ROM</button>
        </p>
      )}

      <p className="dy-sched-sum">
        <TeamLink team={team} rank={false} />
        <span>{check.confGames[team]} conference games{confTarget ? ` (the conference plays ${confTarget})` : ''}</span>
        <span>{check.homeGames[team]} at home</span>
      </p>
      {myMissing.length > 0 && <p className="dy-note dy-small">Not on the schedule: {myMissing.map(([a, b]) => rivalryOf(name(a), name(b)) ?? `${name(a)} vs. ${name(b)}`).join(', ')}.</p>}
      {myRepeats.length > 0 && <p className="dy-note dy-small">Plays twice: {myRepeats.map(([a, b]) => name(a === team ? b : a)).join(', ')}.</p>}

      <ol className="dy-sched-list">
        {rows.map((g, w) => {
          if (!g) return <li key={w}><span className="dy-sched-week">Week {w + 1}</span><span className="dy-dim">No game</span></li>;
          const tags: string[] = [];
          if (sameConf(team, g.opp)) tags.push('Conference');
          const riv = rivalryOf(name(team), name(g.opp));
          if (riv) tags.push(isProtected.has(`${Math.min(team, g.opp)}-${Math.max(team, g.opp)}`) ? `${riv} (every season)` : riv);
          return (
            <li key={w}>
              <span className="dy-sched-week">Week {w + 1}</span>
              <div className="dy-sched-game">
                {lock ? (
                  <span>{g.home ? 'vs.' : 'at'} <TeamLink team={g.opp} rank={false} /></span>
                ) : (
                  <div className="dy-sched-edit">
                    <button type="button" className="dy-button dy-quiet dy-sched-site" aria-label={`Week ${w + 1}: ${g.home ? 'home' : 'away'}, switch`}
                      onClick={() => void change((s) => flipHome(s, w, team), () => `Week ${w + 1}: ${g.home ? 'at' : 'vs.'} ${name(g.opp)}.`)}>
                      {g.home ? 'vs.' : 'at'}
                    </button>
                    <select aria-label={`Week ${w + 1} opponent`} value={g.opp} onChange={(e) => pickOpponent(w, Number(e.target.value))}>
                      <optgroup label="Conference">{confTeams.map((t) => <option key={t.index} value={t.index}>{t.school}</option>)}</optgroup>
                      <optgroup label="Other teams">{restTeams.map((t) => <option key={t.index} value={t.index}>{t.school}</option>)}</optgroup>
                    </select>
                    <select aria-label={`Move the week ${w + 1} game`} value={w} onChange={(e) => pickWeek(w, Number(e.target.value))}>
                      {Array.from({ length: SCHED_WEEKS }, (_, k) => <option key={k} value={k}>{k === w ? `Week ${k + 1}` : `Move to week ${k + 1}`}</option>)}
                    </select>
                  </div>
                )}
                {tags.length > 0 && <span className="dy-small dy-dim">{tags.join(', ')}</span>}
              </div>
            </li>
          );
        })}
      </ol>
      {!lock && (
        <div className="dy-row">
          {confirmNew ? (
            <>
              <span className="dy-small">Every team gets new games, and your changes are gone.</span>
              <button type="button" className="dy-button" onClick={() => void remake()}>Make a new schedule</button>
              <button type="button" className="dy-button dy-quiet" onClick={() => setConfirmNew(false)}>Keep this one</button>
            </>
          ) : (
            <button type="button" className="dy-button dy-quiet" onClick={() => setConfirmNew(true)}>Make a new schedule…</button>
          )}
        </div>
      )}
    </section>
  );
}
