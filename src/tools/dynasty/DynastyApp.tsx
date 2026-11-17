// The Dynasty section (/dynasty): a news site for the user's dynasty, kept in the browser, with its
// own pages. Spec: docs/dynasty.md.
import { TrainingResults } from './TrainingPage';
import { Rules } from './RulesPage';
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { openRom } from '../../core/romfile';
import { fetchCfb27Latest } from '../../core/cfb27Latest';
import { createDynasty, DYNASTY_FILE, importSave, OLD_DYNASTY, type Dynasty } from '../../core/dynasty/model';
import { createDynasty1994 } from '../../core/dynasty/create1994';
import { editionOf, editionOfRom } from '../../core/dynasty/edition';
import { fetchRosters1994 } from '../../core/dynasty/rosters1994';
import { applyEdits, editLock, playersCsv, readPlayersCsv, type CsvImport } from '../../core/dynasty/edit';
import { seasonView, weekName } from '../../core/dynasty/derive';
import { teamArt } from '../../core/dynasty/art';
import {
  deleteDynasty, dynastyFileName, dynastyFileText, listDynasties, loadArt, loadDynasty, loadRom, readDynastyFile, saveArt, saveDynasty, saveRom,
  type DynastySummary, type TeamArt,
} from '../../core/dynasty/storage';
import { Ctx, href, TeamMark, type DynCtx } from './ui';
import { SharePanel } from './SharePanel';
import { Awards } from './AwardsPage';
import { Records } from './RecordsPage';
import { ScheduleEditor } from './SchedulePage';
import { History, Home, Leaders, Player, Rankings, Scores, Standings, Team, Teams } from './pages';
import { Offseason, type OffseasonActions } from './OffseasonPage';
import { Coach, Coaches } from './CoachPages';
import { fetchCoachData } from '../../core/dynasty/coachData';
import { withCoaches } from '../../core/dynasty/coaches';
import { seasonDone, seasonRom } from '../../core/dynasty/offseason';
import { canReplaceBench, randomBench } from '../../core/dynasty/bench';
import { Button, Check, Field, FileButton, Masthead, Modal, NavBar, Note, Select, Table, ThemeToggle } from '../../ui';
import { navClick } from '../../appNav';
import { benchSource, GetStarted, Renumbered, SeasonGuide, type StartActions } from './GetStarted';
import './dynasty.css';

const THEME_KEY = 'dynasty-theme';

const PAGES = [
  { id: 'home', label: 'Home' },
  { id: 'scores', label: 'Scores' },
  { id: 'standings', label: 'Standings' },
  { id: 'rankings', label: 'Top 25' },
  { id: 'teams', label: 'Teams' },
  { id: 'coaches', label: 'Coaches' },
  { id: 'stats', label: 'Stats' },
  { id: 'history', label: 'History' },
  { id: 'offseason', label: 'Offseason' },
  { id: 'manage', label: 'Manage' },
] as const;

const parseHash = () => {
  const [page, arg] = window.location.hash.replace(/^#/, '').split('/');
  return { page: page || 'home', arg };
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

/** A message on top of the page; `action` is a button after it (after an import: on to Home). */
type Note = { kind: 'error' | 'ok'; text: string; action?: ReactNode } | null;

/**
 * Several of your teams: the masthead's logo is a menu to switch between them (user, 2026-11-16: "the logo at the
 * top right becomes a dropdown to switch between their teams"). Picking one opens its page, and pages that show
 * one of your teams (the offseason steps, the schedule, Walsh Reports) start on it.
 */
function TeamMenu({ focus, onPick }: { focus?: number; onPick: (t: number) => void }) {
  const { d } = useContext(Ctx)!;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', key); };
  }, [open]);
  const cur = focus !== undefined && d.userTeams.includes(focus) ? focus : d.userTeams[0];
  return (
    <div className="dy-teammenu" ref={ref}>
      <button type="button" className="dy-teammenu-btn" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen(!open)} aria-label={`Your teams: ${d.teams[cur].school}`}>
        <TeamMark team={cur} size={48} exact />
        <span className="dy-teammenu-name">{d.teams[cur].school}</span>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 5l5 5 5-5" stroke="currentColor" strokeWidth="2" fill="none" /></svg>
      </button>
      {open && (
        <ul className="dy-teammenu-list" aria-label="Your teams">
          {d.userTeams.map((t) => {
            const coach = d.coaches?.find((c) => c.team === t);
            return (
              <li key={t}>
                <a href={href(`team/${t}`)} aria-current={t === cur ? 'true' : undefined} onClick={() => { onPick(t); setOpen(false); }}>
                  <TeamMark team={t} size={32} />
                  <span>{d.teams[t].school}{coach && <><br /><span className="dy-small dy-dim">Coach: {coach.name}{coach.manageXp ? ' (you manage his XP)' : ''}</span></>}</span>
                </a>
              </li>
            );
          })}
          <li><a href={href('manage')} onClick={() => setOpen(false)} className="dy-small">Change your teams in Manage</a></li>
        </ul>
      )}
    </div>
  );
}

/** The dynasty with its coaches: the real coaches of its edition, added once (a new dynasty, or one made before coaches). */
async function addCoaches(dyn: Dynasty): Promise<Dynasty> {
  if (dyn.coaches) return dyn;
  return withCoaches(dyn, await fetchCoachData(editionOf(dyn).id));
}

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
    // A dynasty made before coaches gets them now (the coaches file is fetched once; if it can't be, next time).
    if (!dyn.coaches) {
      try {
        const next = await addCoaches(dyn);
        await saveDynasty(next);
        setD((cur) => (cur?.id === next.id ? next : cur));
      } catch { /* offline: the Coaches page says they're on their way */ }
    }
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
          else if (parseHash().page !== 'manage') window.location.hash = href('start');
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
  const backupRef = useRef<(dyn: Dynasty) => Promise<void>>(async () => {});
  const v = useMemo(() => (d ? seasonView(d, d.seasons[d.seasons.length - 1]) : null), [d]);
  // Light or dark: the reader's choice, kept in this browser (it's a preference, not part of a dynasty).
  const [dark, setDarkState] = useState(() => { try { return localStorage.getItem(THEME_KEY) === 'dark'; } catch { return false; } });
  const setDark = (on: boolean) => { setDarkState(on); try { localStorage.setItem(THEME_KEY, on ? 'dark' : 'light'); } catch { /* private mode: the choice lasts for this visit */ } };
  // The team picked in the masthead's team menu (with several of your teams), kept in this browser per dynasty.
  const [focus, setFocusState] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!d) return;
    try { const x = localStorage.getItem(`dynasty.focus.${d.id}`); setFocusState(x === null ? undefined : Number(x)); } catch { setFocusState(undefined); }
  }, [d?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const setFocus = (t: number) => { setFocusState(t); try { if (d) localStorage.setItem(`dynasty.focus.${d.id}`, String(t)); } catch { /* private mode */ } };
  const ctx: DynCtx | null = useMemo(
    () => (d && v ? { d, v, art, go: (p: string) => (window.location.hash = href(p)), commit, downloadRom: (y: number) => dlRef.current(y), dark, focus, backup: () => void backupRef.current(d) } : null),
    [d, v, art, commit, dark, focus],
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
        // User, 2026-11-17: "After importing a save, there should be a big CTA to continue to the Home/news headlines".
        action: <Button href={href('home')}>{seasonDone(r.dynasty) ? 'Continue to Home' : 'See the headlines'}</Button>,
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
    exportFile: () => { if (d) void backupRef.current(d); },
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
        else window.location.hash = href('start');
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

  // The dynasty file, with the time of this download in it (the home page's backup line compares it with the last import).
  backupRef.current = async (dyn: Dynasty) => {
    const next = { ...dyn, backedUp: new Date().toISOString() };
    download(dynastyFileName(next), dynastyFileText(next));
    if (d?.id === next.id) await commit(next);
    else await saveDynasty(next);
  };

  const startActions: StartActions = {
    prepare: async (file) => {
      const rom = (await openRom(file.name, await readFile(file))).data;
      let renumbered: { player: number; from: number; to: number }[] = [];
      // The 1994 Season Edition: rosters from the ROM, backups from the built-in 1994 lists; 2026: the built-in CFB 27 file.
      const made = editionOfRom(rom)?.id === '1994'
        ? createDynasty1994(rom, await fetchRosters1994(), { name: '' })
        : createDynasty(rom, new TextDecoder().decode(await fetchCfb27Latest()), { name: '', onNumbers: (list) => { renumbered = list; } });
      const named = renumbered.map((n) => {
        const p = made.players[n.player - 1];
        return { pos: p.pos, name: `${p.first} ${p.last}`.trim(), school: made.teams[p.team!].school, from: n.from, to: n.to };
      });
      const dyn = await addCoaches(named.length ? { ...made, renumbered: named } : made).catch(() => made);
      return { dyn, rom, pics: teamArt(rom), fileName: file.name };
    },
    finish: async (p, o) => {
      let dyn: Dynasty = { ...p.dyn, name: o.name.trim() || p.dyn.name, userTeams: o.teams, ...(o.coachSim ? { coachSim: true } : {}) };
      if (o.generated) dyn = randomBench(dyn);
      await saveDynasty(dyn);
      await saveArt(dyn.id, p.pics as TeamArt[]);
      await saveRom(dyn.id, p.rom);
      setD(dyn);
      setArt(p.pics as TeamArt[]);
      setCurrent(dyn.id);
      await refresh();
      return dyn;
    },
    exportFile: (dyn) => void backupRef.current(dyn),
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
        text: `Downloaded the ${year} ROM. Start a New Season with it in the game: Season mode plays the dynasty's rosters, Exhibition keeps the ROM's own.`,
      });
    }),
  };
  dlRef.current = offActions.downloadRom;

  const { page, arg } = route;
  const num = arg !== undefined && /^\d+$/.test(arg) ? Number(arg) : undefined;
  const body = (() => {
    if (page === 'start') return <GetStarted actions={startActions} busy={!!busy} />;
    if (page === 'manage' || !ctx) return <Manage d={d} art={art} list={list} busy={busy} note={note} actions={actions} focus={focus} ctx={ctx} />;
    switch (page) {
      case 'scores': return <Scores week={num} />;
      case 'standings': return <Standings />;
      case 'rankings': return <Rankings />;
      case 'teams': return <Teams />;
      case 'coaches': return <Coaches />;
      case 'coach': return num !== undefined ? <Coach id={num} /> : <Coaches />;
      case 'team': return num !== undefined ? <Team team={num} /> : <Teams />;
      case 'player': return num !== undefined ? <Player id={num} /> : <Home />;
      case 'stats': return <Leaders />;
      case 'history': return <History />;
      case 'awards': return <Awards arg={arg} />;
      case 'records': return <Records arg={arg} />;
      case 'schedule': return <ScheduleEditor arg={arg} />;
      case 'offseason': return <Offseason actions={offActions} busy={busy} arg={arg} />;
      case 'rules': return <Rules actions={offActions} busy={busy} />;
      case 'training': return <TrainingResults arg={arg} />;
      case 'guide': return <Guide />;
      default: return <Home />;
    }
  })();
  const navPage = page === 'team' || page === 'player' || page === 'schedule' ? (page === 'player' ? 'stats' : 'teams') : page === 'rules' || page === 'guide' || page === 'start' ? 'manage' : page === 'training' ? 'offseason' : page === 'awards' || page === 'records' ? 'history' : page;
  const week = d?.offseason ? 'Offseason' : v && v.save ? (v.currentWeek < v.weeks ? weekName(v, v.currentWeek) : 'Season complete') : d && d.seasons.length > 1 ? 'Preseason' : null;

  return (
    <div className="dy" data-brand="dynasty" data-theme={dark ? 'dark' : 'light'}>
      <Masthead
        title={d?.name ?? 'Dynasty'} href={href('home')}
        sub={d ? `${d.offseason ? d.offseason.year : d.seasons[d.seasons.length - 1].year}${week ? `, ${week}` : ''}` : undefined}
        left={<><a href="/">BW95 Elevated</a><a href={toolkitHref} onClick={navClick(toolkitHref)}>Mod Toolkit</a><ThemeToggle dark={dark} onChange={setDark} /></>}
        right={ctx && (d!.userTeams.length > 1
          ? <Ctx.Provider value={ctx}><TeamMenu focus={focus} onPick={setFocus} /></Ctx.Provider>
          : d!.userTeams.map((t) => (
            <Ctx.Provider key={t} value={ctx}><a href={href(`team/${t}`)} aria-label={d!.teams[t].school}><TeamMark team={t} size={64} exact /></a></Ctx.Provider>
          )))}
      >
        <NavBar label="Dynasty" items={PAGES.map((p) => ({ label: p.label, href: href(p.id), current: navPage === p.id, off: !ctx && p.id !== 'manage' }))} />
      </Masthead>
      <main className="dy-main">
        {note && page !== 'manage' && <Note kind={note.kind}>{note.text}</Note>}
        <Ctx.Provider value={ctx}>{body}</Ctx.Provider>
        {d && !d.offseason && d.seasons.length > 1 && (() => {
          // The new season's ROM (user, 2026-11-12: the download "needs to be VERY obvious, like a modal window"):
          // asks until it's downloaded or the season's first save is imported; "Later" hides it until the next visit.
          const s = d.seasons[d.seasons.length - 1];
          // Not on the offseason's own pages: its last step is the download (user, 2026-11-13).
          if (s.romDownloaded || s.imports.length || romLater === s.year || page === 'offseason' || page === 'schedule') return null;
          return (
            <Modal
              title={`Download the ${s.year} ROM`}
              actions={<>
                <Button disabled={!!busy} onClick={() => offActions.downloadRom(s.year)}>Download the {s.year} ROM</Button>
                <Button variant="quiet" onClick={() => { location.hash = href('offseason/players'); }}>Players, depth chart and schedule first</Button>
                <Button variant="quiet" onClick={() => setRomLater(s.year)}>Later</Button>
              </>}
            >
                <p>The {s.year} season is set up. Download its ROM and start a <b>New Season</b> in the game with it: it has the new rosters{s.schedule ? ' and schedule' : ''}, and the app can only import saves of seasons started with it.</p>
                <p className="dy-small dy-dim">The offseason's last steps are your depth chart{s.schedule ? ', your schedule' : ''} and this download. If you change either after downloading, download the ROM again.</p>
            </Modal>
          );
        })()}
      </main>
    </div>
  );
}

// ---- Manage

interface ManageActions {
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

function BenchChoice({ onRandom, busy, source }: { onRandom: () => void; busy: boolean; /** Where the backups came from. */ source: string }) {
  const [sure, setSure] = useState(false);
  return (
    <>
      <h3>Backups</h3>
      <p>
        Every team has a backup for each of the 32 players on its Active Roster, who moves up when a spot opens. The backups start as{' '}
        {source}. In the first season you can replace them with generated players instead; the Active Rosters stay the same.
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


/** How a season works, on its own page (from Manage and the home page's What's next). */
function Guide() {
  const { d, backup } = useContext(Ctx)!;
  const s = d.seasons[d.seasons.length - 1];
  return (
    <div className="dy-start">
      <h1>How a season works</h1>
      <SeasonGuide
        year={d.offseason ? d.offseason.year + 1 : s.year}
        first={d.seasons.length === 1 && !d.offseason}
        backup={backup && <Button variant="quiet" onClick={backup}>Download dynasty file</Button>}
      />
    </div>
  );
}

/** Manage's sections, for its jump menu (buttons: the page's own address is the hash route). */
const MANAGE_SECTIONS = [
  { id: 'dy-m-season', label: 'This season' },
  { id: 'dy-m-teams', label: 'Your teams' },
  { id: 'dy-m-players', label: 'Players' },
  { id: 'dy-m-files', label: 'Backup and files' },
  { id: 'dy-m-share', label: 'Share' },
  { id: 'dy-m-help', label: 'Rules and help' },
  { id: 'dy-m-others', label: 'Other dynasties' },
];

function Manage({ d, art, list, busy, note, actions, focus, ctx }: {
  /** The masthead's active team (Share follows it). */
  focus?: number;
  ctx: DynCtx | null;
  d: Dynasty | null;
  art: TeamArt[] | null;
  list: DynastySummary[] | null;
  busy: string | null;
  note: Note;
  actions: ManageActions;
}) {
  const [rename, setRename] = useState<string | null>(null);
  const [older, setOlder] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [addTeam, setAddTeam] = useState('');
  const season = d?.seasons[d.seasons.length - 1];
  const others = (list ?? []).filter((x) => x.id !== d?.id);
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const when = (iso: string) => new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="dy-manage">
      {busy && <Note>{busy}</Note>}
      {note && (note.action
        ? <Note kind={note.kind} block><p>{note.text}</p><div className="dy-row dy-note-action">{note.action}</div></Note>
        : <Note kind={note.kind}>{note.text}</Note>)}

      {d && season && (
        <>
          <div className="dy-manage-head">
            <h1>{d.name}</h1>
            <p className="dy-dim">Started {new Date(d.created).toLocaleDateString('en-US', { dateStyle: 'medium' })} with the {d.startYear} rosters.</p>
          </div>
          <nav className="dy-manage-jump" aria-label="On this page">
            <ul>{(others.length ? MANAGE_SECTIONS : MANAGE_SECTIONS.map((x) => (x.id === 'dy-m-others' ? { ...x, label: 'Start a new dynasty' } : x))).map((x) => (
              <li key={x.id}><button type="button" onClick={() => jump(x.id)}>{x.label}</button></li>
            ))}</ul>
          </nav>

          <section className="dy-panel" id="dy-m-season">
            <h2>This season</h2>
            <h3>Import your save</h3>
            <p>
              After you play, load the game's battery save (the <code>.srm</code> file from RetroArch's Genesis Plus GX core). The
              app reads the results, rankings and season stats, and keeps every season.
            </p>
            <div className="dy-row">
              <FileButton label="Import save" accept=".srm,.sav,.bin" disabled={!!busy} onFile={(f) => actions.importSave(f, older)} />
              <Check checked={older} onChange={setOlder}>Allow a save with fewer results than the last one</Check>
            </div>
            {season.imports.length > 0 && (
              <Table figures>
                <caption>{season.year} imports</caption>
                <thead><tr><th className="ui-left">Imported</th><th>Games played</th><th>Weeks complete</th></tr></thead>
                <tbody>
                  {season.imports.slice().reverse().map((i) => (
                    <tr key={i.at}>
                      <td className="ui-left">{when(i.at)}</td>
                      <td>{i.played}</td>
                      <td>{i.weeksDone}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <Renumbered d={d} />
            <h3>Season ROM</h3>
            {!d.offseason && d.seasons.length > 1 ? (
              <>
                <p>
                  The {season.year} rosters and team OVRs in your ROM's dynasty area: Season mode plays them, Exhibition keeps the ROM's own
                  rosters, and New Season marks the save with the dynasty and season, so the app knows it. Start the {season.year} season in the
                  game with this ROM; saves of seasons started with another ROM can't be imported.
                </p>
                <Button disabled={!!busy} onClick={() => actions.downloadRom(season.year)}>Download the {season.year} ROM</Button>
              </>
            ) : (
              <p>
                {d.offseason
                  ? `The offseason's last step gives you the ${d.offseason.year + 1} ROM; after that you can download it again here.`
                  : 'The first season needs no download: play it on your ROM as it is. From the second season on, the offseason gives you the season\'s ROM, and you can download it again here.'}
              </p>
            )}
          </section>

          <section className="dy-panel" id="dy-m-teams">
            <h2>Your teams</h2>
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
              <Select
                label="Team to add" hideLabel value={addTeam}
                options={[
                  { value: '', label: 'Choose a team' },
                  ...d.teams.filter((t) => !d.userTeams.includes(t.index)).sort((a, b) => a.school.localeCompare(b.school)).map((t) => ({ value: t.index, label: t.school })),
                ]}
                onChange={setAddTeam}
              />
              <Button disabled={addTeam === ''} onClick={() => { actions.setUserTeams([...d.userTeams, Number(addTeam)]); setAddTeam(''); }}>Add team</Button>
            </div>
          </section>

          <section className="dy-panel" id="dy-m-players">
            <h2>Players</h2>
            {canReplaceBench(d) && <BenchChoice onRandom={actions.randomBench} busy={!!busy} source={benchSource(editionOf(d).id)} />}
            <PlayersCsv d={d} actions={actions} />
          </section>

          <section className="dy-panel" id="dy-m-files">
            <h2>Backup and files</h2>
            <h3>Dynasty file</h3>
            <p>Your dynasty is saved in this browser, so you don't need to open a file each time. Download it after each import: the file brings the dynasty back if the browser's data is cleared, and opens it in another browser or on another computer.</p>
            <div className="dy-row">
              <Button onClick={actions.exportFile}>Download dynasty file</Button>
              <span className="dy-small dy-dim">{d.backedUp ? `Last download: ${when(d.backedUp)}` : 'Not downloaded yet.'}</span>
            </div>
            <h3>Team logos</h3>
            {art ? (
              <p>Team logos come from your ROM and stay in this browser. They aren't in the dynasty file.</p>
            ) : (
              <>
                <p>This browser doesn't have the team logos yet (a dynasty file doesn't carry them). Load your ROM to add them.</p>
                <FileButton label="Load ROM for logos" accept=".md,.bin,.gen,.zip" disabled={!!busy} onFile={actions.addArt} />
              </>
            )}
            <h3>Name and delete</h3>
            <div className="dy-row">
              {rename === null ? (
                <Button variant="quiet" onClick={() => setRename(d.name)}>Rename</Button>
              ) : (
                <form className="dy-row" onSubmit={(e) => { e.preventDefault(); actions.rename(rename); setRename(null); }}>
                  <Field label="Dynasty name" hideLabel value={rename} onChange={setRename} maxLength={40} />
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

          <SharePanel d={d} art={art} focus={focus} commit={actions.commit} ctx={ctx} />

          <section className="dy-panel" id="dy-m-help">
            <h2>Rules and help</h2>
            <p>Offseason rules: every number the computer's offseason uses (departures, development, transfers, recruiting, walk-ons, prestige) and the sim settings, to change for this dynasty or move to another one. Spoilers.</p>
            <div className="dy-row">
              <Button variant="quiet" href={href('rules')}>Offseason rules</Button>
              <Button variant="quiet" href={href('guide')}>How a season works</Button>
            </div>
          </section>
        </>
      )}

      <section className="dy-panel" id="dy-m-others">
        {others.length > 0 && (
          <>
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
          </>
        )}
        {!others.length && <h2>{d ? 'Start a new dynasty' : 'Dynasty'}</h2>}
        <p>A new dynasty starts from your ROM, step by step. A dynasty file you downloaded opens here too.</p>
        <div className="dy-row">
          <Button href={href('start')}>Start a new dynasty</Button>
          <FileButton label="Open dynasty file" variant="quiet" accept=".json" disabled={!!busy} onFile={actions.importFile} />
        </div>
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
        Every player with his attribute ratings as the game shows them (0-100), to edit in a spreadsheet. Import the file again:
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
          {pending.problems.length === 0 && pending.warnings.length > 0 && (
            <>
              <p><strong>{pending.warnings.length} {pending.warnings.length === 1 ? 'number was' : 'numbers were'} replaced</strong>:</p>
              <ul className="dy-small">{pending.warnings.slice(0, 50).map((m) => <li key={m}>{m}</li>)}</ul>
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
