// The Dynasty section (#dynasty): a news site for the user's dynasty, kept in the browser, with its
// own pages. Spec: docs/dynasty.md.
import { TrainingResults } from './TrainingPage';
import { Rules } from './RulesPage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { openRom } from '../../core/romfile';
import { fetchCfb27Latest, CFB27_LATEST } from '../../core/cfb27Latest';
import { createDynasty, DYNASTY_FILE, importSave, OLD_DYNASTY, type Dynasty } from '../../core/dynasty/model';
import { applyEdits, editLock, playersCsv, readPlayersCsv, type CsvImport } from '../../core/dynasty/edit';
import { seasonView, weekName } from '../../core/dynasty/derive';
import { teamArt } from '../../core/dynasty/art';
import {
  deleteDynasty, dynastyFileName, dynastyFileText, listDynasties, loadArt, loadDynasty, loadRom, readDynastyFile, saveArt, saveDynasty, saveRom,
  type DynastySummary, type TeamArt,
} from '../../core/dynasty/storage';
import { Ctx, href, TeamMark, type DynCtx } from './ui';
import { Awards } from './AwardsPage';
import { Records } from './RecordsPage';
import { ScheduleEditor } from './SchedulePage';
import { History, Home, Leaders, Player, Rankings, Scores, Standings, Team, Teams } from './pages';
import { Offseason, type OffseasonActions } from './OffseasonPage';
import { seasonRom } from '../../core/dynasty/offseason';
import { canReplaceBench, randomBench } from '../../core/dynasty/bench';
import { Button, FileButton, Note, Table, ThemeToggle } from '../../ui';
import './dynasty.css';

const THEME_KEY = 'dynasty-theme';

const PAGES = [
  { id: 'home', label: 'Home' },
  { id: 'scores', label: 'Scores' },
  { id: 'standings', label: 'Standings' },
  { id: 'rankings', label: 'Top 25' },
  { id: 'teams', label: 'Teams' },
  { id: 'stats', label: 'Stats' },
  { id: 'history', label: 'History' },
  { id: 'offseason', label: 'Offseason' },
  { id: 'manage', label: 'Manage' },
] as const;

const parseHash = () => {
  const [, page = 'home', arg] = window.location.hash.replace(/^#/, '').split('/');
  return { page, arg };
};

const CURRENT = 'dynasty.current';
const getCurrent = () => {
  try {
    return localStorage.getItem(CURRENT);
  } catch {
    return null;
  }
};
const setCurrent = (id: string | null) => {
  try {
    if (id) localStorage.setItem(CURRENT, id);
    else localStorage.removeItem(CURRENT);
  } catch {
    /* storage off: the dynasty list still works */
  }
};

function download(name: string, text: BlobPart, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const readFile = async (f: File) => new Uint8Array(await f.arrayBuffer());

/** Asks for a file (from a click: the browser only opens the picker then). */
function chooseFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

type Note = { kind: 'error' | 'ok'; text: string } | null;

export default function DynastyApp({ toolkitHref }: { toolkitHref: string }) {
  const [route, setRoute] = useState(parseHash);
  const [romLater, setRomLater] = useState<number | null>(null);
  const [list, setList] = useState<DynastySummary[] | null>(null);
  const [d, setD] = useState<Dynasty | null>(null);
  const [art, setArt] = useState<TeamArt[] | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
    if (route.page !== 'manage') setNote(null);
  }, [route.page, route.arg]);

  const refresh = useCallback(async () => setList(await listDynasties()), []);
  const open = useCallback(async (id: string) => {
    const dyn = await loadDynasty(id);
    if (!dyn) return false;
    // Earlier test versions (CFB 27 ratings) can't be opened: delete them on the Manage page.
    if ((dyn.version ?? 1) < DYNASTY_FILE.version) {
      setNote({ kind: 'error', text: `${dyn.name}: ${OLD_DYNASTY}` });
      return false;
    }
    setD(dyn);
    setArt(await loadArt(id));
    setCurrent(id);
    return true;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await refresh();
        const id = getCurrent();
        if (!id || !(await open(id))) {
          const all = await listDynasties();
          if (all[0]) await open(all[0].id);
          else if (parseHash().page !== 'manage') window.location.hash = href('manage');
        }
      } catch (e) {
        setNote({ kind: 'error', text: (e as Error).message });
      }
    })();
  }, [refresh, open]);

  const commit = useCallback(async (next: Dynasty) => {
    setD(next);
    await saveDynasty(next);
    await refresh();
  }, [refresh]);

  const dlRef = useRef<(year: number) => void>(() => {});
  const v = useMemo(() => (d ? seasonView(d, d.seasons[d.seasons.length - 1]) : null), [d]);
  // Light or dark: the reader's choice, kept in this browser (it's a preference, not part of a dynasty).
  const [dark, setDarkState] = useState(() => { try { return localStorage.getItem(THEME_KEY) === 'dark'; } catch { return false; } });
  const setDark = (on: boolean) => { setDarkState(on); try { localStorage.setItem(THEME_KEY, on ? 'dark' : 'light'); } catch { /* private mode: the choice lasts for this visit */ } };
  const ctx: DynCtx | null = useMemo(
    () => (d && v ? { d, v, art, go: (p: string) => (window.location.hash = href(p)), commit, downloadRom: (y: number) => dlRef.current(y), dark } : null),
    [d, v, art, commit, dark],
  );

  const run = async (what: string, fn: () => Promise<void>) => {
    setBusy(what);
    setNote(null);
    try {
      await fn();
    } catch (e) {
      setNote({ kind: 'error', text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const actions: ManageActions = {
    create: (name, romFile) => run('Creating the dynasty…', async () => {
      const rom = (await openRom(romFile.name, await readFile(romFile))).data;
      const csv = new TextDecoder().decode(await fetchCfb27Latest());
      const dyn = createDynasty(rom, csv, { name });
      const pics = teamArt(rom);
      await saveDynasty(dyn);
      await saveArt(dyn.id, pics);
      await saveRom(dyn.id, rom);
      setD(dyn);
      setArt(pics);
      setCurrent(dyn.id);
      await refresh();
      setNote({ kind: 'ok', text: `${dyn.name} is ready: ${dyn.players.length.toLocaleString('en-US')} players on ${dyn.teams.length} teams. Play the ${dyn.seasons[0].year} season on your ROM as it is, and import your save whenever you like (after the last game at the latest). After the offseason the app gives you the next season's ROM.` });
    }),
    importSave: (f, allowOlder) => run('Importing the save…', async () => {
      if (!d) return;
      const r = importSave(d, await readFile(f), { allowOlder });
      await commit(r.dynasty);
      const nv = seasonView(r.dynasty, r.season);
      const added = r.newUserTeams.map((t) => r.dynasty.teams[t].school);
      setNote({
        kind: 'ok',
        text: `Imported: ${r.played} games played${r.newGames > 0 ? ` (${r.newGames} new)` : ''}, next up ${nv.currentWeek < nv.weeks ? weekName(nv, nv.currentWeek) : 'nothing (the season is over)'}.` +
          (added.length ? ` Your ${added.length > 1 ? 'teams' : 'team'}: ${added.join(', ')}.` : '') +
          (r.warning ? ` ${r.warning}` : ''),
      });
    }),
    addArt: (romFile) => run('Reading team art…', async () => {
      if (!d) return;
      const rom = (await openRom(romFile.name, await readFile(romFile))).data;
      const pics = teamArt(rom);
      if (pics.length !== d.teams.length) throw new Error(`This ROM has ${pics.length} teams; the dynasty has ${d.teams.length}.`);
      await saveArt(d.id, pics);
      await saveRom(d.id, rom);
      setArt(pics);
      setNote({ kind: 'ok', text: 'Team logos added.' });
    }),
    exportFile: () => d && download(dynastyFileName(d), dynastyFileText(d)),
    importFile: (f) => run('Opening the dynasty file…', async () => {
      const dyn = readDynastyFile(await f.text());
      await saveDynasty(dyn);
      await open(dyn.id);
      await refresh();
      setNote({ kind: 'ok', text: `${dyn.name} opened. Load your ROM below to show the team logos.` });
    }),
    open: (id) => run('Opening…', async () => {
      await open(id);
      window.location.hash = href('home');
    }),
    remove: (id) => run('Deleting…', async () => {
      await deleteDynasty(id);
      const all = await listDynasties();
      setList(all);
      if (d?.id === id) {
        setD(null);
        setArt(null);
        setCurrent(null);
        if (all[0]) await open(all[0].id);
      }
    }),
    rename: (name) => run('Saving…', async () => {
      if (d && name.trim()) await commit({ ...d, name: name.trim() });
    }),
    setUserTeams: (teams) => run('Saving…', async () => {
      if (d) await commit({ ...d, userTeams: teams });
    }),
    downloadRom: (year) => dlRef.current(year),
    commit,
    download: (name, text, type) => download(name, text, type),
    randomBench: () => run('Making random backups…', async () => {
      if (!d) return;
      await commit(randomBench(d));
      setNote({ kind: 'ok', text: 'Every team has new, generated backups. The Active Rosters are the same.' });
    }),
  };

  const getRom = async (): Promise<Uint8Array | null> => {
    if (!d) return null;
    const kept = await loadRom(d.id);
    if (kept) return kept;
    const f = await chooseFile('.md,.bin,.gen,.zip');
    if (!f) return null;
    const rom = (await openRom(f.name, await readFile(f))).data;
    await saveRom(d.id, rom);
    return rom;
  };
  const offActions: OffseasonActions = {
    commit: async (next, done) => {
      await commit(next);
      if (done) setNote({ kind: 'ok', text: done });
    },
    getRom,
    run,
    downloadRom: (year) => void run('Writing the ROM…', async () => {
      if (!d) return;
      const season = d.seasons.find((s) => s.year === year);
      if (!season) return;
      const rom = await getRom();
      if (!rom) throw new Error('Choose your ROM to write the season into it.');
      const slug = d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'dynasty';
      download(`${slug}-${year}.md`, seasonRom(d, season, rom) as Uint8Array<ArrayBuffer>, 'application/octet-stream');
      if (season.lineupEdited || !season.romDownloaded) await commit({ ...d, seasons: d.seasons.map((x) => (x === season ? { ...x, lineupEdited: false, romDownloaded: true } : x)) });
      setNote({
        kind: 'ok',
        text: `Downloaded the ${year} ROM. Start a New Season with it in the game: Season mode plays the dynasty's rosters, Exhibition keeps the real 2026 ones.`,
      });
    }),
  };
  dlRef.current = offActions.downloadRom;

  const { page, arg } = route;
  const num = arg !== undefined && /^\d+$/.test(arg) ? Number(arg) : undefined;
  const body = (() => {
    if (page === 'manage' || !ctx) return <Manage d={d} art={art} list={list} busy={busy} note={note} actions={actions} />;
    switch (page) {
      case 'scores': return <Scores week={num} />;
      case 'standings': return <Standings />;
      case 'rankings': return <Rankings />;
      case 'teams': return <Teams />;
      case 'team': return num !== undefined ? <Team team={num} /> : <Teams />;
      case 'player': return num !== undefined ? <Player id={num} /> : <Home />;
      case 'stats': return <Leaders />;
      case 'history': return <History />;
      case 'awards': return <Awards arg={arg} />;
      case 'records': return <Records arg={arg} />;
      case 'schedule': return <ScheduleEditor arg={arg} />;
      case 'offseason': return <Offseason actions={offActions} busy={busy} />;
      case 'rules': return <Rules actions={offActions} busy={busy} />;
      case 'training': return <TrainingResults arg={arg} />;
      default: return <Home />;
    }
  })();
  const navPage = page === 'team' || page === 'player' || page === 'schedule' ? (page === 'player' ? 'stats' : 'teams') : page === 'rules' ? 'manage' : page === 'training' ? 'offseason' : page === 'awards' || page === 'records' ? 'history' : page;
  const week = d?.offseason ? 'Offseason' : v && v.save ? (v.currentWeek < v.weeks ? weekName(v, v.currentWeek) : 'Season complete') : d && d.seasons.length > 1 ? 'Preseason' : null;

  return (
    <div className="dy" data-brand="dynasty" data-theme={dark ? 'dark' : 'light'}>
      <header className="dy-mast">
        <div className="dy-mast-inner">
          <span className="dy-mast-left">
            <a className="dy-back" href={toolkitHref}>Mod Toolkit</a>
            <ThemeToggle dark={dark} onChange={setDark} />
          </span>
          <a className="dy-title" href={href('home')}>
            <span className="dy-title-1">{d?.name ?? 'Dynasty'}</span>
            {d && <span className="dy-title-2">{d.offseason ? d.offseason.year : d.seasons[d.seasons.length - 1].year}{week ? `, ${week}` : ''}</span>}
          </a>
          <span className="dy-mast-teams">
            {ctx && d!.userTeams.map((t) => (
              <Ctx.Provider key={t} value={ctx}><a href={href(`team/${t}`)} aria-label={d!.teams[t].school}><TeamMark team={t} size={64} exact /></a></Ctx.Provider>
            ))}
          </span>
        </div>
        <nav className="dy-nav" aria-label="Dynasty">
          {PAGES.map((p) => (
            <a key={p.id} href={href(p.id)} aria-current={navPage === p.id ? 'page' : undefined} className={!ctx && p.id !== 'manage' ? 'dy-off' : ''}>
              {p.label}
            </a>
          ))}
        </nav>
      </header>
      <main className="dy-main">
        {note && page !== 'manage' && <Note kind={note.kind}>{note.text}</Note>}
        {ctx ? <Ctx.Provider value={ctx}>{body}</Ctx.Provider> : body}
        {d && !d.offseason && d.seasons.length > 1 && (() => {
          // The new season's ROM (user, 2026-11-12: the download "needs to be VERY obvious, like a modal window"):
          // asks until it's downloaded or the season's first save is imported; "Later" hides it until the next visit.
          const s = d.seasons[d.seasons.length - 1];
          if (s.romDownloaded || s.imports.length || romLater === s.year) return null;
          return (
            <div className="dy-modal-back" role="presentation">
              <div className="dy-modal" role="dialog" aria-modal="true" aria-labelledby="dy-rom-title">
                <h2 id="dy-rom-title">Download the {s.year} ROM</h2>
                <p>The {s.year} season is set up. Download its ROM and start a <b>New Season</b> in the game with it: it has the new rosters{s.schedule ? ' and schedule' : ''}, and the app can only import saves of seasons started with it.</p>
                <p className="dy-small dy-dim">You can still change your depth chart{s.schedule ? ' or your schedule' : ''} first (your team's page); then download it again.</p>
                <div className="dy-row">
                  <Button disabled={!!busy} onClick={() => offActions.downloadRom(s.year)}>Download the {s.year} ROM</Button>
                  {s.schedule && d.userTeams.length > 0 && <Button variant="quiet" onClick={() => { setRomLater(s.year); location.hash = href(`schedule/${d.userTeams[0]}`); }}>See the schedule first</Button>}
                  <Button variant="quiet" onClick={() => setRomLater(s.year)}>Later</Button>
                </div>
              </div>
            </div>
          );
        })()}
      </main>
    </div>
  );
}

// ---- Manage

interface ManageActions {
  create: (name: string, rom: File) => void;
  commit: (next: Dynasty) => Promise<void>;
  download: (name: string, text: string, type?: string) => void;
  downloadRom: (year: number) => void;
  importSave: (f: File, allowOlder: boolean) => void;
  addArt: (rom: File) => void;
  exportFile: () => void;
  importFile: (f: File) => void;
  open: (id: string) => void;
  remove: (id: string) => void;
  rename: (name: string) => void;
  setUserTeams: (teams: number[]) => void;
  randomBench: () => void;
}

function BenchChoice({ onRandom, busy }: { onRandom: () => void; busy: boolean }) {
  const [sure, setSure] = useState(false);
  return (
    <>
      <h3>Backups</h3>
      <p>
        Every team has a backup for each of the 32 players on its Active Roster, who moves up when a spot opens. The backups start as the
        next-best real players (CFB 27). In the first season you can replace them with generated players instead; the Active Rosters stay the same.
      </p>
      <div className="dy-row">
        {sure ? (
          <>
            <Button disabled={busy} onClick={() => { onRandom(); setSure(false); }}>Replace every team's backups</Button>
            <Button variant="quiet" onClick={() => setSure(false)}>Keep the real players</Button>
          </>
        ) : (
          <Button variant="quiet" onClick={() => setSure(true)}>Generate random backups</Button>
        )}
      </div>
    </>
  );
}


function Manage({ d, art, list, busy, note, actions }: {
  d: Dynasty | null;
  art: TeamArt[] | null;
  list: DynastySummary[] | null;
  busy: string | null;
  note: Note;
  actions: ManageActions;
}) {
  const [name, setName] = useState('');
  const [rename, setRename] = useState<string | null>(null);
  const [older, setOlder] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [addTeam, setAddTeam] = useState('');
  const season = d?.seasons[d.seasons.length - 1];
  const others = (list ?? []).filter((x) => x.id !== d?.id);

  return (
    <div className="dy-manage">
      {busy && <Note>{busy}</Note>}
      {note && <Note kind={note.kind}>{note.text}</Note>}

      {d && season && (
        <section className="dy-panel">
          <h2>{d.name}</h2>
          <p className="dy-dim">Started {new Date(d.created).toLocaleDateString('en-US', { dateStyle: 'medium' })} with the {d.startYear} rosters.</p>

          <h3>Import your save</h3>
          <p>
            After you play, load the game's battery save (the <code>.srm</code> file from RetroArch's Genesis Plus GX core). The
            app reads the results, rankings and season stats, and keeps every season.
          </p>
          <div className="dy-row">
            <FileButton label="Import save" accept=".srm,.sav,.bin" disabled={!!busy} onFile={(f) => actions.importSave(f, older)} />
            <label className="dy-check">
              <input type="checkbox" checked={older} onChange={(e) => setOlder(e.target.checked)} /> Allow a save with fewer results than the last one
            </label>
          </div>
          {season.imports.length > 0 && (
            <Table figures>
              <caption>{season.year} imports</caption>
              <thead><tr><th className="ui-left">Imported</th><th>Games played</th><th>Weeks complete</th></tr></thead>
              <tbody>
                {season.imports.slice().reverse().map((i) => (
                  <tr key={i.at}>
                    <td className="ui-left">{new Date(i.at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                    <td>{i.played}</td>
                    <td>{i.weeksDone}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          <h3>Your teams</h3>
          <p>The save marks the teams you play as; you can add or remove teams here too.</p>
          <ul className="dy-chips">
            {d.userTeams.map((t) => (
              <li key={t}>
                {d.teams[t].school}
                <button type="button" aria-label={`Remove ${d.teams[t].school}`} onClick={() => actions.setUserTeams(d.userTeams.filter((x) => x !== t))}>Remove</button>
              </li>
            ))}
          </ul>
          <div className="dy-row">
            <select aria-label="Team to add" value={addTeam} onChange={(e) => setAddTeam(e.target.value)}>
              <option value="">Choose a team</option>
              {d.teams.filter((t) => !d.userTeams.includes(t.index)).sort((a, b) => a.school.localeCompare(b.school)).map((t) => (
                <option key={t.index} value={t.index}>{t.school}</option>
              ))}
            </select>
            <Button disabled={addTeam === ''} onClick={() => { actions.setUserTeams([...d.userTeams, Number(addTeam)]); setAddTeam(''); }}>Add team</Button>
          </div>

          {!d.offseason && d.seasons.length > 1 && (() => {
            const year = d.seasons[d.seasons.length - 1].year;
            return (
              <>
                <h3>Season ROM</h3>
                <p>
                  The {year} rosters and team OVRs in your ROM's dynasty area: Season mode plays them, Exhibition keeps the real 2026
                  rosters, and New Season marks the save with the dynasty and season, so the app knows it. Start the {year} season in the
                  game with this ROM; saves of seasons started with another ROM can't be imported. (The first season needs no download:
                  play it on your ROM as it is.)
                </p>
                <Button disabled={!!busy} onClick={() => actions.downloadRom(year)}>Download the {year} ROM</Button>
              </>
            );
          })()}

          {canReplaceBench(d) && <BenchChoice onRandom={actions.randomBench} busy={!!busy} />}

          <PlayersCsv d={d} actions={actions} />

          <h3>Team logos</h3>
          {art ? (
            <p>Team logos come from your ROM and stay in this browser. They aren't in the dynasty file.</p>
          ) : (
            <>
              <p>This browser doesn't have the team logos yet (a dynasty file doesn't carry them). Load your ROM to add them.</p>
              <FileButton label="Load ROM for logos" accept=".md,.bin,.gen,.zip" disabled={!!busy} onFile={actions.addArt} />
            </>
          )}

          <h3>Offseason rules</h3>
          <p>Every number the computer's offseason uses (departures, development, transfers, recruiting, walk-ons, prestige), to change for this dynasty or move to another one. Spoilers.</p>
          <div className="dy-row"><Button variant="quiet" href={href('rules')}>Offseason rules</Button></div>

          <h3>Keep a copy</h3>
          <p>Your dynasty lives in this browser. Download it to keep a backup or to move it to another computer.</p>
          <div className="dy-row">
            <Button onClick={actions.exportFile}>Download dynasty file</Button>
            {rename === null ? (
              <Button variant="quiet" onClick={() => setRename(d.name)}>Rename</Button>
            ) : (
              <form className="dy-row" onSubmit={(e) => { e.preventDefault(); actions.rename(rename); setRename(null); }}>
                <input aria-label="Dynasty name" value={rename} onChange={(e) => setRename(e.target.value)} maxLength={40} />
                <Button type="submit">Save name</Button>
                <Button variant="quiet" onClick={() => setRename(null)}>Cancel</Button>
              </form>
            )}
            {confirm === d.id ? (
              <>
                <Button variant="danger" onClick={() => { actions.remove(d.id); setConfirm(null); }}>Delete {d.name} for good</Button>
                <Button variant="quiet" onClick={() => setConfirm(null)}>Keep it</Button>
              </>
            ) : (
              <Button variant="quiet" onClick={() => setConfirm(d.id)}>Delete</Button>
            )}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section className="dy-panel">
          <h2>Other dynasties</h2>
          <ul className="dy-list">
            {others.map((x) => (
              <li key={x.id}>
                <span><strong>{x.name}</strong> <span className="dy-dim">{x.year}{x.schools.length ? `, ${x.schools.join(', ')}` : ''}</span></span>
                <Button onClick={() => actions.open(x.id)}>Open</Button>
                {confirm === x.id ? (
                  <Button variant="danger" onClick={() => { actions.remove(x.id); setConfirm(null); }}>Delete for good</Button>
                ) : (
                  <Button variant="quiet" onClick={() => setConfirm(x.id)}>Delete</Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="dy-panel">
        <h2>Start a new dynasty</h2>
        <p>
          A dynasty needs the 138-team 2026 Season Edition of Bill Walsh '95 Elevated with dynasty support (v2.0.1-test9 or later). The players start from the
          built-in {CFB27_LATEST.label.replace('College Football 27', 'CFB 27')} rosters; redshirted players start one class up.
        </p>
        <form className="dy-row" onSubmit={(e) => e.preventDefault()}>
          <input aria-label="Dynasty name" placeholder="Dynasty name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          <FileButton label="Choose ROM and start" accept=".md,.bin,.gen,.zip" disabled={!!busy} onFile={(f) => actions.create(name, f)} />
        </form>
        <h3>Open a dynasty file</h3>
        <FileButton label="Open dynasty file" accept=".json" disabled={!!busy} onFile={actions.importFile} />
      </section>
    </div>
  );
}

/** Players CSV (edit.ts): download every player, import an edited file with a preview first. */
function PlayersCsv({ d, actions }: { d: Dynasty; actions: ManageActions }) {
  const [pending, setPending] = useState<CsvImport | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const lock = editLock(d);
  const slug = d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'dynasty';
  const year = d.offseason ? d.offseason.year + 1 : d.seasons[d.seasons.length - 1].year;
  return (
    <>
      <h3>Players (CSV)</h3>
      <p>
        Every player with his Bill Walsh '95 ratings as the game shows them (0-100), to edit in a spreadsheet. Import the file again:
        rows with an ID change that player, rows without one add a player, a cleared Team releases him. You see every change before it's applied.
      </p>
      <div className="dy-row">
        <Button variant="quiet" onClick={() => actions.download(`${slug}-players-${year}.csv`, playersCsv(d), 'text/csv')}>Download players CSV</Button>
        {lock ? <span className="dy-dim dy-small">{lock}</span> : (
          <FileButton label="Import players CSV" accept=".csv,text/csv" onFile={async (f) => {
            setMsg(null);
            setPending(readPlayersCsv(d, new TextDecoder().decode(await readFile(f))));
          }} />
        )}
      </div>
      {pending && (
        <div className="dy-note">
          {pending.problems.length > 0 && (
            <>
              <p><strong>{pending.problems.length} {pending.problems.length === 1 ? 'problem' : 'problems'}</strong>: fix the file and import it again.</p>
              <ul className="dy-small">{pending.problems.slice(0, 20).map((m) => <li key={m}>{m}</li>)}</ul>
            </>
          )}
          {pending.problems.length === 0 && (
            pending.changes.length ? (
              <>
                <p><strong>{pending.changes.length} {pending.changes.length === 1 ? 'player changes' : 'players change'}</strong>:</p>
                <ul className="dy-small dy-changes">{pending.changes.slice(0, 200).map((m, i) => <li key={i}>{m}</li>)}</ul>
                {pending.changes.length > 200 && <p className="dy-small dy-dim">and {pending.changes.length - 200} more.</p>}
                <div className="dy-row">
                  <Button onClick={async () => {
                    try {
                      await actions.commit(applyEdits(d, pending.edits, pending.adds));
                      setMsg({ kind: 'ok', text: `${pending.changes.length} ${pending.changes.length === 1 ? 'player' : 'players'} changed.${d.offseason ? '' : ' Download the season ROM again before you start the New Season.'}` });
                      setPending(null);
                    } catch (e) { setMsg({ kind: 'error', text: (e as Error).message }); }
                  }}>Apply the changes</Button>
                  <Button variant="quiet" onClick={() => setPending(null)}>Cancel</Button>
                </div>
              </>
            ) : <p>Nothing in the file differs from the dynasty.</p>
          )}
        </div>
      )}
      {msg && <Note kind={msg.kind}>{msg.text}</Note>}
    </>
  );
}
