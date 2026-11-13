// Season tool: rename Bill Walsh '95's four conferences, move teams between them, and lock in
// schedules. Teams that aren't locked keep the game's random schedules.
import { Button, Field, FileButton, Note, PageHead, Select, SubHead, Table } from '../../ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CONFERENCES, NAME_LEN, WEEKS, conferenceGames, isLocked, lockAll, lockTeam, readSeason, seasonFile, seasonFromFile,
  seasonProblems, setConference, setGame, setHome, setName, slotOf, teamGames, unlockAll, unlockTeam, writeSeason,
  type EditResult, type Opponent, type Season,
} from '../../core/season';
import { openRosterRom } from '../../core/rosterRom';
import { isWideBw95 } from '../../core/romfile';
import { readWideSeason, wideSeasonIssues, writeWideSeason, type WideSeason } from '../../core/seasonWide';
import { SeasonWide } from './SeasonWide';
import { WorkRomCard, type TeamSwapSource, type WorkApi } from '../shared/WorkRom';
import './season.css';

type Msg = { kind: 'error' | 'ok'; text: string } | null;

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
  // The 138-team edition: its own settings (as loaded, and now).
  const [wide, setWide] = useState<{ loaded: WideSeason; now: WideSeason } | null>(null);
  const [note, setNote] = useState<Msg>(null);

  // A new working ROM: read its season (Bill Walsh '95 only).
  useEffect(() => {
    setNote(null);
    setSeason(null);
    setRomProblem(null);
    setWide(null);
    if (!work) return;
    if (work.game !== 'bw95') {
      setRomProblem("The Season tab works on Bill Walsh College Football '95 ROMs; this one is for the Rosters tab only.");
      return;
    }
    if (isWideBw95(work.data)) {
      try {
        setTeams(openRosterRom(work.data).teams.map((t) => t.school));
        setWide({ loaded: readWideSeason(work.base), now: readWideSeason(work.data) });
      } catch (e) {
        setRomProblem((e as Error).message);
      }
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

  const changeWide = (s: WideSeason) => {
    if (!wide || !work) return;
    setWide({ ...wide, now: s });
    setNote(null);
    const issues = wideSeasonIssues(s);
    if (issues.length) {
      api.setBlocker(issues[0]);
      return;
    }
    try {
      writeWideSeason(work.data, s);
      api.setBlocker(null);
      api.edited();
    } catch (e) {
      api.setBlocker((e as Error).message);
    }
  };
  const undoWide = () => {
    if (!wide || !work) return;
    changeWide(wide.loaded);
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
      <PageHead title="Season">
        {wide ? (
          <>
            Rename the 2026 Season Edition's conferences, choose which of the 138 teams play in each, and set when each
            conference plays its conference games in random seasons.
          </>
        ) : (
          <>
            Rename Bill Walsh '95's four conferences, choose which teams play in each, and set schedules. Teams you lock
            play the opponents you pick every season; the others keep the game's random schedules.
          </>
        )}
      </PageHead>

      <WorkRomCard
        api={api}
        teamSwap={teamSwap}
        hint="Bill Walsh College Football '95: original, Elevated, a Team Swap result or an earlier edit. .md, .bin, .gen or .zip."
      />

      {work && wide ? (
        <SeasonWide key={work.id} teams={teams} season={wide.now} loaded={wide.loaded} onChange={changeWide} />
      ) : work && season ? (
        <SeasonEditor key={work.id} teams={teams} season={season} onChange={change} />
      ) : (
        <section className="waiting">
          <p>{romProblem ?? 'Load a ROM to see its conferences and schedules. You can drop the file anywhere on this page.'}</p>
        </section>
      )}

      {work && wide && (
        <footer className="dock">
          <p className="dock-count" aria-live="polite">
            {wideChanges(wide) ? `${wideChanges(wide)} conference${wideChanges(wide) === 1 ? '' : 's'} changed` : 'No season changes yet'}
            {api.edits.teams && <small className="dock-also">+ team changes</small>}
            {api.edits.rosters && <small className="dock-also">+ roster changes</small>}
          </p>
          {note && (
            <Note kind={note.kind}>
              {note.text}
            </Note>
          )}
          <div className="dock-actions">
            {wideChanges(wide) > 0 && (
              <Button variant="quiet" onClick={undoWide}>
                Undo season changes
              </Button>
            )}
            <Button
              onClick={() => setNote(api.save())}
              disabled={(!api.edits.any && !work.checkOff) || wideSeasonIssues(wide.now).length > 0}
            >
              Download ROM
            </Button>
          </div>
        </footer>
      )}

      {work && season && (
        <footer className="dock">
          <p className="dock-count" aria-live="polite">
            {lockedCount ? `${lockedCount} team${lockedCount === 1 ? '' : 's'} locked` : 'All schedules random'}
            {api.edits.teams && <small className="dock-also">+ team changes</small>}
            {api.edits.rosters && <small className="dock-also">+ roster changes</small>}
          </p>
          {note && (
            <Note kind={note.kind}>
              {note.text}
            </Note>
          )}
          {problem && (
            <Note kind="error">
              {problem}
            </Note>
          )}
          <div className="dock-actions">
            <FileButton variant="quiet" label="Load season file" accept=".json,application/json" onFile={(f) => void loadSeasonFile(f)} />
            <Button variant="quiet" onClick={saveFile}>
              Save season file
            </Button>
            <Button
              onClick={() => setNote(api.save())}
              disabled={(!api.edits.any && !work.checkOff) || !!problem}
            >
              Download ROM
            </Button>
          </div>
        </footer>
      )}
    </>
  );
}

/** Conferences whose name, members or weeks differ from the loaded ROM. */
function wideChanges(w: { loaded: WideSeason; now: WideSeason }): number {
  const { loaded, now } = w;
  return now.names.filter((n, c) => {
    if (n !== loaded.names[c]) return true;
    if (now.conf.some((x, t) => (x === c) !== (loaded.conf[t] === c))) return true;
    return c < now.start.length && (now.start[c] !== loaded.start[c] || now.games[c] !== loaded.games[c]);
  }).length;
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
          <SubHead id="sea-confs-h">Conferences</SubHead>
          <p className="hint">
            Each conference sends its best-ranked team to a bowl, so every conference needs at least 2 teams. Names can be up
            to {NAME_LEN} characters.
          </p>
        </div>
        <div className="sea-confs">
          {byConf.map((list, c) => (
            <div className="sea-conf" key={c}>
              <div className="sea-name">
                <Field
                  label={`Name of conference ${c + 1}`} hideLabel value={season.names[c]} maxLength={NAME_LEN} invalid={!season.names[c].trim()}
                  onChange={(v) => apply(() => setName(season, c, v))}
                  note={<>{list.length} teams · {season.names[c].length}/{NAME_LEN}</>}
                />
              </div>
              <ul>
                {list.map(({ n, t }) => (
                  <li key={t}>
                    <button className={`sea-team-link${t === team ? ' on' : ''}`} onClick={() => setTeam(t)}>
                      {n}
                      {isLocked(season, t) && <span className="sea-lock" title="Locked schedule"> ●</span>}
                    </button>
                    <Select
                      label={`Move ${n} to another conference`} hideLabel compact value="" placeholder="Move"
                      options={names.map((nm, k) => ({ value: k, label: nm })).filter((o) => o.value !== c)}
                      onChange={(v) => apply(() => setConference(season, t, +v))}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="sea-sec" aria-labelledby="sea-sched-h">
        <div className="sea-head">
          <SubHead id="sea-sched-h">Schedules</SubHead>
          <div className="sea-all">
            <Button variant="quiet" onClick={() => apply(() => lockAll(season))}>
              Lock every team
            </Button>
            <Button variant="quiet" onClick={() => apply(() => unlockAll(season))}>
              Make every team random
            </Button>
          </div>
        </div>

        <div className="sea-bar">
          <Select
            label="Team" value={team} onChange={(v) => setTeam(+v)}
            options={byConf.flatMap((list, c) => list.map(({ n, t }) => ({ value: t, label: `${isLocked(season, t) ? '● ' : ''}${n}`, group: names[c] })))}
          />
          <span className="sea-chip">{names[season.conf[team]]}</span>
          {locked ? (
            <>
              <span className="sea-state">Locked · {conferenceGames(season, team, DEFAULT_WEEKS)} conference games in weeks 1-12</span>
              <Button variant="quiet" onClick={() => apply(() => unlockTeam(season, team))}>
                Make random
              </Button>
            </>
          ) : (
            <>
              <span className="sea-state">Random schedule</span>
              <Button variant="quiet" onClick={() => apply(() => lockTeam(season, team))}>
                Lock this team's schedule
              </Button>
            </>
          )}
        </div>

        {error && (
          <Note kind="error">
            {error}
          </Note>
        )}
        {notes.length > 0 && (
          <Note kind="ok" block>
            <p>This also changed:</p>
            <ul>
              {notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </Note>
        )}

        {locked ? (
          <div className="sea-scroll">
            <Table edit className="sea-weeks">
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
                        <Select
                          label={`Week ${g.week + 1} opponent`} hideLabel compact tone={'conf' in o ? 'dim' : undefined} value={oppValue(o)}
                          onChange={(v) => {
                            const opp = parseOpp(v);
                            apply(() => setGame(season, team, g.week, opp, teams));
                          }}
                          options={[
                            ...names.map((nm, c) => ({ value: `c${c}`, label: `Any ${nm} team`, group: 'Random', disabled: !randomLeft(c) && !('conf' in o && o.conf === c) })),
                            ...byConf.flatMap((list, c) => list.filter(({ t }) => t !== team).map(({ n, t }) => ({ value: `t${t}`, label: `${isLocked(season, t) ? '● ' : ''}${n}`, group: names[c] }))),
                          ]}
                        />
                      </td>
                      <td className="sea-tag">{oc === season.conf[team] ? 'Conference' : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
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
