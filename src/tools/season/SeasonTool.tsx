// Season tool: rename Bill Walsh '95's four conferences, move teams between them, and lock in
// schedules. Teams that aren't locked keep the game's random schedules.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CONFERENCES, NAME_LEN, WEEKS, conferenceGames, isLocked, lockAll, lockTeam, readSeason, seasonFile, seasonFromFile,
  seasonProblems, setConference, setGame, setHome, setName, slotOf, teamGames, unlockAll, unlockTeam, writeSeason,
  type EditResult, type Opponent, type Season,
} from '../../core/season';
import { openRosterRom } from '../../core/rosterRom';
import { WorkRomCard, type TeamSwapSource, type WorkApi } from '../shared/WorkRom';
import './season.css';

type Note = { kind: 'error' | 'ok'; text: string } | null;

/** Weeks the game plays unless Game Setup's Weeks row is changed. */
const DEFAULT_WEEKS = 12;

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stem = (name: string) => name.replace(/\.(md|bin|gen|zip)$/i, '').replace(/(\s*\[(Season|Rosters)\])+$/i, '');
const safeName = (s: string) => s.replace(/[^A-Za-z0-9 &'.()[\]-]+/g, ' ').replace(/\s+/g, ' ').trim();

const oppValue = (o: Opponent) => ('team' in o ? `t${o.team}` : `c${o.conf}`);
const parseOpp = (v: string): Opponent => (v[0] === 't' ? { team: +v.slice(1) } : { conf: +v.slice(1) });

export function SeasonTool({
  api,
  teamSwap,
  registerDrop,
}: {
  api: WorkApi;
  teamSwap: TeamSwapSource | null;
  registerDrop: (fn: ((files: FileList | File[]) => void) | null) => void;
}) {
  const { work } = api;
  const [season, setSeason] = useState<Season | null>(null);
  const [teams, setTeams] = useState<string[]>([]);
  const [romProblem, setRomProblem] = useState<string | null>(null);
  const [note, setNote] = useState<Note>(null);

  // A new working ROM: read its season (Bill Walsh '95 only).
  useEffect(() => {
    setNote(null);
    setSeason(null);
    setRomProblem(null);
    if (!work) return;
    if (work.game !== 'bw95') {
      setRomProblem("The Season tab works on Bill Walsh College Football '95 ROMs; this one is for the Rosters tab only.");
      return;
    }
    try {
      setTeams(openRosterRom(work.data).teams.map((t) => t.school));
      setSeason(readSeason(work.data));
    } catch (e) {
      setRomProblem((e as Error).message);
    }
  }, [work]);

  /** Every change goes straight into the working ROM, so the Rosters tab and the download see it. */
  const change = (s: Season) => {
    setSeason(s);
    setNote(null);
    if (!work) return;
    const problems = seasonProblems(s);
    if (problems.length) {
      api.setBlocker(problems[0]);
      return;
    }
    try {
      writeSeason(work.data, s);
      api.setBlocker(null);
      api.edited();
    } catch (e) {
      api.setBlocker((e as Error).message);
    }
  };

  const loadSeasonFile = async (f: File) => {
    if (!work || !season) {
      setNote({ kind: 'error', text: "Load a Bill Walsh '95 ROM first, then the season file." });
      return;
    }
    try {
      const { season: s, teams: saved } = seasonFromFile(JSON.parse(await f.text()));
      change(s);
      const differ = saved.length === teams.length ? saved.filter((t, i) => t !== teams[i]).length : 0;
      setNote({
        kind: 'ok',
        text: `Loaded ${f.name}.` + (differ ? ` It was saved with ${differ} different team${differ === 1 ? '' : 's'}; they take the same places.` : ''),
      });
    } catch (e) {
      setNote({ kind: 'error', text: `${f.name}: ${(e as Error).message}` });
    }
  };

  const dropRef = useRef<(files: FileList | File[]) => void>(() => {});
  dropRef.current = (files) => {
    const f = Array.from(files)[0];
    if (f && /\.json$/i.test(f.name)) void loadSeasonFile(f);
    else void api.loadFiles(files);
  };
  useEffect(() => {
    registerDrop((files) => dropRef.current(files));
    return () => registerDrop(null);
  }, [registerDrop]);

  const saveFile = () => {
    if (!work || !season) return;
    download(`${safeName(stem(work.name))} season.json`, JSON.stringify(seasonFile(season, teams), null, 1), 'application/json');
  };

  const lockedCount = season ? season.slotTeam.filter((t) => t !== null).length : 0;
  const problem = season ? seasonProblems(season)[0] : undefined;

  return (
    <>
      <section className="tool-head" aria-label="Season">
        <h2>Season</h2>
        <p>
          Rename Bill Walsh '95's four conferences, choose which teams play in each, and set schedules. Teams you lock
          play the opponents you pick every season; the others keep the game's random schedules.
        </p>
      </section>

      <WorkRomCard
        api={api}
        teamSwap={teamSwap}
        hint="Bill Walsh College Football '95: original, Elevated, a Team Swap result or an earlier edit. .md, .bin, .gen or .zip."
      />

      {work && season ? (
        <SeasonEditor key={work.id} teams={teams} season={season} onChange={change} />
      ) : (
        <section className="waiting">
          <p>{romProblem ?? 'Load a ROM to see its conferences and schedules. You can drop the file anywhere on this page.'}</p>
        </section>
      )}

      {work && season && (
        <footer className="dock">
          <p className="dock-count" aria-live="polite">
            {lockedCount ? `${lockedCount} team${lockedCount === 1 ? '' : 's'} locked` : 'All schedules random'}
            {api.edits.teams && <small className="dock-also">+ team changes</small>}
            {api.edits.rosters && <small className="dock-also">+ roster changes</small>}
          </p>
          {note && (
            <p className={`note ${note.kind}`} role={note.kind === 'error' ? 'alert' : 'status'}>
              {note.text}
            </p>
          )}
          {problem && (
            <p className="note error" role="alert">
              {problem}
            </p>
          )}
          <div className="dock-actions">
            <label className="btn">
              Load season file
              <input
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void loadSeasonFile(f);
                  e.target.value = '';
                }}
              />
            </label>
            <button className="btn" onClick={saveFile}>
              Save season file
            </button>
            <button
              className="btn btn-go"
              onClick={() => setNote(api.save())}
              disabled={(!api.edits.any && !work.checkOff) || !!problem}
            >
              Download ROM
            </button>
          </div>
        </footer>
      )}
    </>
  );
}

function SeasonEditor({ teams, season, onChange }: { teams: string[]; season: Season; onChange: (s: Season) => void }) {
  const [team, setTeam] = useState(() => Math.max(0, teams.indexOf('Pitt')));
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState('');
  /** Runs an edit. Opponent changes replace the "also changed" list; home/away keeps it. */
  const apply = (fn: () => Season | EditResult, keepNotes = false) => {
    try {
      const r = fn();
      if ('season' in r) {
        onChange(r.season);
        setNotes(r.alsoChanged);
      } else {
        onChange(r);
        if (!keepNotes) setNotes([]);
      }
      setError('');
    } catch (e) {
      setError((e as Error).message);
      setNotes([]);
    }
  };
  const byConf = useMemo(
    () =>
      Array.from({ length: CONFERENCES }, (_, c) =>
        teams.map((n, t) => ({ n, t })).filter(({ t }) => season.conf[t] === c).sort((a, b) => a.n.localeCompare(b.n)),
      ),
    [teams, season.conf],
  );
  const names = season.names.map((n, c) => n.trim() || `Conference ${c + 1}`);
  const locked = isLocked(season, team);
  const games = teamGames(season, team);
  const randomLeft = (c: number) => teams.filter((_, t) => season.conf[t] === c && !isLocked(season, t)).length;

  return (
    <>
      <section className="sea-sec" aria-labelledby="sea-confs-h">
        <div className="sea-head">
          <h3 id="sea-confs-h">Conferences</h3>
          <p className="hint">
            Each conference sends its best-ranked team to a bowl, so every conference needs at least 2 teams. Names can be up
            to {NAME_LEN} characters.
          </p>
        </div>
        <div className="sea-confs">
          {byConf.map((list, c) => (
            <div className="sea-conf" key={c}>
              <label className="sea-name">
                <input
                  aria-label={`Name of conference ${c + 1}`}
                  value={season.names[c]}
                  maxLength={NAME_LEN}
                  onChange={(e) => apply(() => setName(season, c, e.target.value))}
                  aria-invalid={!season.names[c].trim()}
                />
                <small>
                  {list.length} teams · {season.names[c].length}/{NAME_LEN}
                </small>
              </label>
              <ul>
                {list.map(({ n, t }) => (
                  <li key={t}>
                    <button className={`sea-team-link${t === team ? ' on' : ''}`} onClick={() => setTeam(t)}>
                      {n}
                      {isLocked(season, t) && <span className="sea-lock" title="Locked schedule"> ●</span>}
                    </button>
                    <select
                      aria-label={`Move ${n} to another conference`}
                      value=""
                      onChange={(e) => apply(() => setConference(season, t, +e.target.value))}
                    >
                      <option value="" disabled hidden>
                        Move
                      </option>
                      {names.map((nm, k) =>
                        k === c ? null : (
                          <option key={k} value={k}>
                            {nm}
                          </option>
                        ),
                      )}
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="sea-sec" aria-labelledby="sea-sched-h">
        <div className="sea-head">
          <h3 id="sea-sched-h">Schedules</h3>
          <div className="sea-all">
            <button className="btn btn-quiet" onClick={() => apply(() => lockAll(season))}>
              Lock every team
            </button>
            <button className="btn btn-quiet" onClick={() => apply(() => unlockAll(season))}>
              Make every team random
            </button>
          </div>
        </div>

        <div className="sea-bar">
          <label className="sea-pick">
            <select aria-label="Team" value={team} onChange={(e) => setTeam(+e.target.value)}>
              {byConf.map((list, c) => (
                <optgroup key={c} label={names[c]}>
                  {list.map(({ n, t }) => (
                    <option key={t} value={t}>
                      {isLocked(season, t) ? '● ' : ''}
                      {n}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <span className="sea-chip">{names[season.conf[team]]}</span>
          {locked ? (
            <>
              <span className="sea-state">Locked · {conferenceGames(season, team, DEFAULT_WEEKS)} conference games in weeks 1-12</span>
              <button className="btn" onClick={() => apply(() => unlockTeam(season, team))}>
                Make random
              </button>
            </>
          ) : (
            <>
              <span className="sea-state">Random schedule</span>
              <button className="btn" onClick={() => apply(() => lockTeam(season, team))}>
                Lock this team's schedule
              </button>
            </>
          )}
        </div>

        {error && (
          <p className="note error" role="alert">
            {error}
          </p>
        )}
        {notes.length > 0 && (
          <div className="note ok sea-also" role="status">
            <p>This also changed:</p>
            <ul>
              {notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        )}

        {locked ? (
          <div className="sea-scroll">
            <table className="sea-weeks">
              <thead>
                <tr>
                  <th scope="col">Week</th>
                  <th scope="col">Where</th>
                  <th scope="col">Opponent</th>
                  <th scope="col">
                    <span className="sr-only">Conference game</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {games.map((g) => {
                  const o = g.opponent;
                  const oc = 'team' in o ? season.conf[o.team] : o.conf;
                  return (
                    <tr key={g.week} className={g.week === DEFAULT_WEEKS ? 'sea-extra-first' : g.week > DEFAULT_WEEKS ? 'sea-extra' : ''}>
                      <th scope="row">{g.week + 1}</th>
                      <td>
                        <div className="sea-ha" role="group" aria-label={`Week ${g.week + 1} home or away`}>
                          <button
                            aria-pressed={g.home}
                            className={g.home ? 'on' : ''}
                            onClick={() => apply(() => setHome(season, team, g.week, true), true)}
                          >
                            Home
                          </button>
                          <button
                            aria-pressed={!g.home}
                            className={!g.home ? 'on' : ''}
                            onClick={() => apply(() => setHome(season, team, g.week, false), true)}
                          >
                            Away
                          </button>
                        </div>
                      </td>
                      <td>
                        <select
                          aria-label={`Week ${g.week + 1} opponent`}
                          className={'conf' in o ? 'sea-any' : ''}
                          value={oppValue(o)}
                          onChange={(e) => {
                            const opp = parseOpp(e.target.value);
                            apply(() => setGame(season, team, g.week, opp, teams));
                          }}
                        >
                          <optgroup label="Random">
                            {names.map((nm, c) => (
                              <option key={c} value={`c${c}`} disabled={!randomLeft(c) && !('conf' in o && o.conf === c)}>
                                Any {nm} team
                              </option>
                            ))}
                          </optgroup>
                          {byConf.map((list, c) => (
                            <optgroup key={c} label={names[c]}>
                              {list
                                .filter(({ t }) => t !== team)
                                .map(({ n, t }) => (
                                  <option key={t} value={`t${t}`}>
                                    {isLocked(season, t) ? '● ' : ''}
                                    {n}
                                  </option>
                                ))}
                            </optgroup>
                          ))}
                        </select>
                      </td>
                      <td className="sea-tag">{oc === season.conf[team] ? 'Conference' : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="hint sea-foot">
              The game plays weeks 1-{DEFAULT_WEEKS} unless you change Weeks on Game Setup (1-{WEEKS}). Picking a team locks
              that team too (●), and the two teams' old opponents play each other that week. "Any … team" is one of that
              conference's random teams, dealt at the start of each season.
            </p>
          </div>
        ) : (
          <p className="sea-random">
            Each new season the game deals {teams[team]} into one of {names[season.conf[team]]}'s random places, so its
            opponents change from season to season. Lock its schedule to pick them.
            {slotOf(season, team) < 0 && ` ${names[season.conf[team]]} has ${randomLeft(season.conf[team])} random teams.`}
          </p>
        )}
      </section>
    </>
  );
}
