// Season tool: rename Bill Walsh '95's four conferences, move teams between them, and lock in
// schedules. Teams that aren't locked keep the game's random schedules.
import { useEffect, useMemo, useRef, useState } from 'react';
import { openRom } from '../../core/romfile';
import { fixChecksums, openRosterRom } from '../../core/rosterRom';
import {
  CONFERENCES, NAME_LEN, WEEKS, conferenceGames, isLocked, lockAll, lockTeam, readSeason, seasonFile, seasonFromFile,
  seasonProblems, setConference, setGame, setHome, setName, slotOf, teamGames, unlockAll, unlockTeam, writeSeason,
  type EditResult, type Opponent, type Season,
} from '../../core/season';
import type { TeamSwapSource } from '../rosters/RosterTool';
import './season.css';

type Note = { kind: 'error' | 'ok'; text: string } | null;

interface Loaded {
  name: string;
  label: string;
  data: Uint8Array;
  teams: string[];
  initial: Season;
}

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

const stem = (name: string) => name.replace(/\.(md|bin|gen|zip)$/i, '').replace(/\s*\[Season\]$/i, '');
const safeName = (s: string) => s.replace(/[^A-Za-z0-9 &'.()[\]-]+/g, ' ').replace(/\s+/g, ' ').trim();

function open(name: string, bytes: Uint8Array, label?: string): Loaded {
  const rom = openRosterRom(bytes);
  if (rom.game !== 'bw95') throw new Error("The Season tab works on Bill Walsh College Football '95 ROMs.");
  const initial = readSeason(rom.data);
  return { name, label: label ?? "Bill Walsh College Football '95", data: rom.data, teams: rom.teams.map((t) => t.school), initial };
}

const oppValue = (o: Opponent) => ('team' in o ? `t${o.team}` : `c${o.conf}`);
const parseOpp = (v: string): Opponent => (v[0] === 't' ? { team: +v.slice(1) } : { conf: +v.slice(1) });

export function SeasonTool({
  teamSwap,
  registerDrop,
}: {
  teamSwap: TeamSwapSource | null;
  registerDrop: (fn: ((files: FileList | File[]) => void) | null) => void;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [romNote, setRomNote] = useState<Note>(null);
  const [note, setNote] = useState<Note>(null);

  const take = (l: Loaded) => {
    setLoaded(l);
    setSeason(l.initial);
    setNote(null);
  };

  const loadFiles = async (files: FileList | File[]) => {
    const f = Array.from(files)[0];
    if (!f) return;
    setRomNote(null);
    try {
      if (/\.json$/i.test(f.name)) {
        await loadSeasonFile(f);
        return;
      }
      const r = await openRom(f.name, new Uint8Array(await f.arrayBuffer()));
      take(open(r.name, r.data, r.known?.label));
    } catch (e) {
      setRomNote({ kind: 'error', text: `${f.name}: ${(e as Error).message}` });
    }
  };
  const loadRef = useRef(loadFiles);
  loadRef.current = loadFiles;
  useEffect(() => {
    registerDrop((files) => loadRef.current(files));
    return () => registerDrop(null);
  }, [registerDrop]);

  const takeTeamSwap = () => {
    if (!teamSwap) return;
    setRomNote(null);
    try {
      const { name, data } = teamSwap.build();
      take(open(name, data, `Team Swap result (${teamSwap.count} team${teamSwap.count === 1 ? '' : 's'} swapped)`));
    } catch (e) {
      setRomNote({ kind: 'error', text: (e as Error).message });
    }
  };

  const loadSeasonFile = async (f: File) => {
    if (!loaded) {
      setRomNote({ kind: 'error', text: 'Load a ROM first, then the season file.' });
      return;
    }
    try {
      const { season: s, teams } = seasonFromFile(JSON.parse(await f.text()));
      setSeason(s);
      const differ = teams.length === loaded.teams.length ? teams.filter((t, i) => t !== loaded.teams[i]).length : 0;
      setNote({
        kind: 'ok',
        text: `Loaded ${f.name}.` + (differ ? ` It was saved with ${differ} different team${differ === 1 ? '' : 's'}; they take the same places.` : ''),
      });
    } catch (e) {
      setNote({ kind: 'error', text: `${f.name}: ${(e as Error).message}` });
    }
  };

  const changed = !!loaded && !!season && JSON.stringify(season) !== JSON.stringify(loaded.initial);
  const problems = season ? seasonProblems(season) : [];

  const doDownload = () => {
    if (!loaded || !season) return;
    try {
      const out = new Uint8Array(loaded.data);
      const res = writeSeason(out, season);
      fixChecksums(out, 'bw95');
      const name = `${safeName(stem(loaded.name))} [Season].md`;
      download(name, out as Uint8Array<ArrayBuffer>, 'application/octet-stream');
      setNote({
        kind: 'ok',
        text:
          `Saved ${name} with ${res.locked ? `${res.locked} locked team${res.locked === 1 ? '' : 's'}` : 'random schedules'}.` +
          ' Start a New Season in the game to use it.' +
          (res.walshSkipped.length ? ` The Walsh Report still says "${res.walshSkipped.join('", "')}" (the new name is too long to fit there).` : ''),
      });
    } catch (e) {
      setNote({ kind: 'error', text: (e as Error).message });
    }
  };

  const saveFile = () => {
    if (!loaded || !season) return;
    download(`${safeName(stem(loaded.name))} season.json`, JSON.stringify(seasonFile(season, loaded.teams), null, 1), 'application/json');
  };

  const lockedCount = season ? season.slotTeam.filter((t) => t !== null).length : 0;

  return (
    <>
      <section className="tool-head" aria-label="Season">
        <h2>Season</h2>
        <p>
          Rename Bill Walsh '95's four conferences, choose which teams play in each, and set schedules. Teams you lock
          play the opponents you pick every season; the others keep the game's random schedules.
        </p>
      </section>

      <section className="roms sea-roms" aria-label="ROM file">
        <label className={`rom${loaded ? ' rom-ok' : ''}`}>
          <span className="rom-title">ROM</span>
          {loaded ? (
            <span className="rom-status">
              {loaded.label}
              <small>{loaded.name} · choose another file to switch</small>
            </span>
          ) : (
            <span className="rom-status rom-empty">
              <span className="rom-choose">Choose file</span>
              <small>Bill Walsh College Football '95: original, Elevated, a Team Swap result or an earlier edit. .md, .bin, .gen or .zip.</small>
            </span>
          )}
          <input
            type="file"
            accept=".md,.bin,.gen,.zip"
            hidden
            onChange={(e) => {
              if (e.target.files) void loadFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
        {teamSwap && (
          <div className="sea-from-swap">
            <button className="btn btn-quiet" onClick={takeTeamSwap}>
              Use the Team Swap result ({teamSwap.count} team{teamSwap.count === 1 ? '' : 's'} swapped)
            </button>
            <p className="hint">Builds the ROM from the Team Swap tab and opens it here, so swaps and the season end up in one file.</p>
          </div>
        )}
        {romNote && (
          <p className={`note ${romNote.kind}`} role="alert">
            {romNote.text}
          </p>
        )}
      </section>

      {loaded && season ? (
        <SeasonEditor
          key={`${loaded.name}-${loaded.label}`}
          teams={loaded.teams}
          season={season}
          onChange={(s) => {
            setSeason(s);
            setNote(null);
          }}
        />
      ) : (
        <section className="waiting">
          <p>Load a ROM to see its conferences and schedules. You can drop the file anywhere on this page.</p>
        </section>
      )}

      {loaded && season && (
        <footer className="dock">
          <p className="dock-count" aria-live="polite">
            {lockedCount ? `${lockedCount} team${lockedCount === 1 ? '' : 's'} locked` : 'All schedules random'}
          </p>
          {note && (
            <p className={`note ${note.kind}`} role={note.kind === 'error' ? 'alert' : 'status'}>
              {note.text}
            </p>
          )}
          {problems.length > 0 && (
            <p className="note error" role="alert">
              {problems[0]}
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
            <button className="btn btn-go" onClick={doDownload} disabled={!changed || problems.length > 0}>
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
