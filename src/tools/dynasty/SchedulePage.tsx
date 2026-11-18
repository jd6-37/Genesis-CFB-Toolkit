// The schedule editor (user, 2026-11-12: "Generate each year, and then the user can edit … We don't need to edit
// cpu teams, only the dynasty team(s)"; "I would like to be able to edit conference games too"). From the second
// season, before its first import: a user team's 12 weeks, each with its opponent, site and week.
import { Button, Modal, Note, PageHead, Select, SubHead } from '../../ui';
import { useMemo, useState } from 'react';
import { INDEPENDENT } from '../../core/dynasty/derive';
import { rivalryOf } from '../../core/dynasty/rivalries';
import { editionOf } from '../../core/dynasty/edition';
import {
  checkSchedule, editSchedule, flipHome, moveGame, protectedPairs, remakeSchedule, rivalriesOf, scheduleLock, setOpponent, teamSchedule, weeksOf,
  type DSchedule,
} from '../../core/dynasty/schedule';
import { Empty, TeamLink, firstTeam, href, useDyn } from './ui';

export function ScheduleEditor({ arg }: { arg?: string }) {
  const { d, commit, downloadRom, focus } = useDyn();
  const season = d.seasons[d.seasons.length - 1];
  const sched = season.schedule;
  const asked = Number(arg);
  const team = Number.isInteger(asked) && d.userTeams.includes(asked) ? asked : firstTeam(d, focus);
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const schools = useMemo(() => d.teams.map((t) => t.school), [d]);
  const check = useMemo(() => (sched ? checkSchedule(sched, schools, season.conf, editionOf(d).id, rivalriesOf(d)) : null), [sched, schools, season.conf, d]);
  if (!sched || !check) return <Empty><p>From the second season on, the app makes each season's schedule and you can change your teams' games. The first season plays the schedule the game makes at New Season.</p></Empty>;
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
  const myOffWeek = check.offWeek.filter(([a, b]) => a === team || b === team);
  const isProtected = new Set(protectedPairs(schools, editionOf(d).id, rivalriesOf(d)).map((p) => `${Math.min(p.a, p.b)}-${Math.max(p.a, p.b)}`));
  const confTarget = conf[team] === INDEPENDENT ? 0 : season.confWeeks?.games[conf[team]];

  const change = async (fn: (s: DSchedule) => DSchedule, done: (s: DSchedule) => string) => {
    try {
      let after: DSchedule | undefined;
      const next = editSchedule(d, (s) => (after = fn(s)));
      await commit(next);
      setNote({ kind: 'ok', text: `Saved. ${done(after!)}` });
    } catch (e) {
      setNote({ kind: 'error', text: (e as Error).message });
    }
  };
  const pickOpponent = (week: number, opp: number) => {
    // Already on the schedule another week: that game moves here.
    const already = rows.findIndex((x) => x?.opp === opp);
    if (already >= 0) { if (rows[week]) pickWeek(already, week); return; } // a game can't move into a bye week
    const old = rows[week]?.opp ?? null;
    const oldOfNew = teamSchedule(sched, opp)[week]?.opp ?? null;
    void change((s) => setOpponent(s, week, team, opp), () =>
      `Week ${week + 1}: ${name(team)} plays ${name(opp)}; ` +
      (old !== null && oldOfNew !== null ? `${name(old)} plays ${name(oldOfNew)} instead.` : `${name(old ?? oldOfNew!)} has the bye instead.`));
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
      <PageHead
        title={`${season.year} schedule`}
        actions={d.userTeams.length > 1 ? <Select label="Team" hideLabel value={team} options={d.userTeams.map((t) => ({ value: t, label: name(t) }))} onChange={(x) => { location.hash = href(`schedule/${x}`); }} /> : undefined}
      />
      <p className="dy-small dy-dim">
        Made with the game's rules for random schedules, with the traditional rivalries kept every season.
        {lock ? '' : ' Change an opponent, a week or home and away: the teams your change leaves without a game that week play each other, so everyone still plays every week.'}
      </p>
      {lock && <Note>{lock}</Note>}
      {note && <Note kind={note.kind}>{note.text}</Note>}
      {!lock && season.romDownloaded && season.lineupEdited && (
        <Note>
          You changed the schedule or lineup after downloading the ROM. Download the {season.year} ROM again before you start the New Season.{' '}
          <Button variant="quiet" onClick={() => downloadRom(season.year)}>Download the {season.year} ROM</Button>
        </Note>
      )}

      <p className="dy-sched-sum">
        <TeamLink team={team} rank={false} />
        <span>{check.confGames[team]} conference games{confTarget ? ` (the conference plays ${confTarget})` : ''}</span>
        <span>{check.homeGames[team]} at home</span>
      </p>
      {myMissing.length > 0 && <Note>Not on the schedule: {myMissing.map(([a, b]) => rivalryOf(name(a), name(b)) ?? `${name(a)} vs. ${name(b)}`).join(', ')}.</Note>}
      {myOffWeek.length > 0 && <Note>Not in its week: {myOffWeek.map(([a, b, w]) => `${rivalryOf(name(a), name(b)) ?? `${name(a)} vs. ${name(b)}`} (week ${w + 1})`).join(', ')}.</Note>}
      {myRepeats.length > 0 && <Note>Plays twice: {myRepeats.map(([a, b]) => name(a === team ? b : a)).join(', ')}.</Note>}

      <ol className="dy-sched-list">
        {rows.map((g, w) => {
          if (!g) {
            // A bye (the 1994 Season Edition's 107 teams leave one team out each week): the user may still give his team a game.
            return (
              <li key={w}>
                <span className="dy-sched-week">Week {w + 1}</span>
                {lock ? <span className="dy-dim">Bye</span> : (
                  <div className="dy-sched-game">
                    <Select
                      label={`Week ${w + 1} opponent`} hideLabel value={-1}
                      options={[
                        { value: -1, label: 'Bye' },
                        ...confTeams.map((t) => ({ value: t.index, label: t.school, group: 'Conference' })),
                        ...restTeams.map((t) => ({ value: t.index, label: t.school, group: 'Other teams' })),
                      ]}
                      onChange={(x) => { if (Number(x) >= 0) pickOpponent(w, Number(x)); }}
                    />
                  </div>
                )}
              </li>
            );
          }
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
                    <Button variant="quiet" label={`Week ${w + 1}: ${g.home ? 'home' : 'away'}, switch`} onClick={() => void change((s) => flipHome(s, w, team), () => `Week ${w + 1}: ${g.home ? 'at' : 'vs.'} ${name(g.opp)}.`)}>{g.home ? 'vs.' : 'at'}</Button>
                    <Select
                      label={`Week ${w + 1} opponent`} hideLabel value={g.opp}
                      options={[
                        ...confTeams.map((t) => ({ value: t.index, label: t.school, group: 'Conference' })),
                        ...restTeams.map((t) => ({ value: t.index, label: t.school, group: 'Other teams' })),
                      ]}
                      onChange={(x) => pickOpponent(w, Number(x))}
                    />
                    <Select
                      label={`Move the week ${w + 1} game`} hideLabel value={w}
                      options={Array.from({ length: weeksOf(sched) }, (_, k) => k).filter((k) => k === w || rows[k]).map((k) => ({ value: k, label: k === w ? `Week ${k + 1}` : `Move to week ${k + 1}` }))}
                      onChange={(x) => pickWeek(w, Number(x))}
                    />
                  </div>
                )}
                {tags.length > 0 && <span className="dy-small dy-dim">{tags.join(', ')}</span>}
              </div>
            </li>
          );
        })}
      </ol>
      {!lock && (
        <>
          <SubHead>When you're done</SubHead>
          <p>Your changes are saved as you make them: there is nothing to confirm here. Next, download the {season.year} ROM and start a New Season in the game with it.</p>
          <div className="dy-row">
            <Button onClick={() => downloadRom(season.year)}>Download the {season.year} ROM</Button>
            <Button variant="quiet" href={href(`team/${team}/roster`)}>Depth chart</Button>
          </div>
          <SubHead>Start over</SubHead>
          <p className="dy-small dy-dim">Throws away this schedule, your changes included, and draws new games for every team.</p>
          <div className="dy-row"><Button variant="danger" onClick={() => setConfirmNew(true)}>Throw this schedule away…</Button></div>
          {confirmNew && (
            <Modal title={`A new ${season.year} schedule?`} onClose={() => setConfirmNew(false)}
              actions={<><Button variant="danger" onClick={() => void remake()}>Throw it away and make a new one</Button><Button variant="quiet" onClick={() => setConfirmNew(false)}>Keep my schedule</Button></>}>
              <p>Every team gets new games, and the changes you made are gone. This can't be undone.</p>
            </Modal>
          )}
        </>
      )}
    </section>
  );
}
