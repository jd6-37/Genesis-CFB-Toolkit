// A shared dynasty snapshot (/dynasty/s/<id>; user, 2026-11-17): the dynasty's pages as they were when it was
// shared, read-only. The active team heads it (its logo in the masthead, its news first) and everything else can
// be browsed; Offseason and Manage aren't here, and editors are disabled with a line that says why (ui.tsx Locked).
import { useEffect, useMemo, useState } from 'react';
import { seasonView, weekName } from '../../core/dynasty/derive';
import { readSnapshot, type Snapshot } from '../../core/dynasty/snapshot';
import { snapshotExpires, SNAPSHOT_DAYS } from '../../core/dynasty/snapshotId';
import { Button, Masthead, NavBar, Note, ThemeToggle } from '../../ui';
import { navClick } from '../../appNav';
import { Ctx, href, TeamMark, type DynCtx } from './ui';
import { Awards } from './AwardsPage';
import { Records } from './RecordsPage';
import { History, Home, Leaders, Player, Rankings, Scores, Standings, Team, teamRoute, Teams } from './pages';
import { Coach, Coaches } from './CoachPages';
import { Rosters } from './RostersPage';
import './dynasty.css';

const THEME_KEY = 'dynasty-theme';
const PAGES = [
  { id: 'home', label: 'Home' },
  { id: 'scores', label: 'Scores' },
  { id: 'standings', label: 'Standings' },
  { id: 'rankings', label: 'Top 25' },
  { id: 'teams', label: 'Teams' },
  { id: 'rosters', label: 'Rosters' },
  { id: 'coaches', label: 'Coaches' },
  { id: 'stats', label: 'Stats' },
  { id: 'history', label: 'History' },
] as const;

const parseHash = () => {
  // The page, then the rest as its argument ("team/12/roster" → team, "12/roster").
  const [page, ...rest] = window.location.hash.replace(/^#/, '').split('/');
  return { page: page || 'home', arg: rest.length ? rest.join('/') : undefined };
};

type Load = { state: 'loading' } | { state: 'gone' } | { state: 'error'; message: string } | { state: 'ok'; snap: Snapshot };

async function fetchSnapshot(id: string): Promise<Snapshot | null> {
  const r = await fetch(`/api/snapshot?id=${encodeURIComponent(id)}`);
  if (r.status === 404 || r.status === 400) return null;
  if (!r.ok) throw new Error("The snapshot can't be loaded right now. Try again in a moment.");
  const { url } = (await r.json()) as { url: string };
  const file = await fetch(url);
  if (file.status === 404) return null;
  if (!file.ok) throw new Error("The snapshot can't be loaded right now. Try again in a moment.");
  return readSnapshot(new Uint8Array(await file.arrayBuffer()));
}

export default function SnapshotApp({ id, toolkitHref }: { id: string; toolkitHref: string }) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [route, setRoute] = useState(parseHash);
  const [dark, setDarkState] = useState(() => { try { return localStorage.getItem(THEME_KEY) === 'dark'; } catch { return false; } });
  const setDark = (on: boolean) => { setDarkState(on); try { localStorage.setItem(THEME_KEY, on ? 'dark' : 'light'); } catch { /* this visit only */ } };

  useEffect(() => {
    let live = true;
    fetchSnapshot(id)
      .then((snap) => live && setLoad(snap ? { state: 'ok', snap } : { state: 'gone' }))
      .catch((e) => live && setLoad({ state: 'error', message: (e as Error).message }));
    return () => { live = false; };
  }, [id]);
  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [route.page, route.arg]);

  const snap = load.state === 'ok' ? load.snap : null;
  const d = snap?.dynasty ?? null;
  const v = useMemo(() => (d ? seasonView(d, d.seasons[d.seasons.length - 1]) : null), [d]);
  const ctx: DynCtx | null = useMemo(
    () => (snap && d && v ? {
      d, v, art: snap.art, dark, focus: snap.team, readOnly: true,
      go: (p: string) => { window.location.hash = href(p); },
      commit: async () => { /* read-only */ },
      downloadRom: () => { /* no ROM in a snapshot */ },
    } : null),
    [snap, d, v, dark],
  );

  useEffect(() => {
    document.title = d ? `${d.name}: a dynasty snapshot` : 'Dynasty snapshot';
  }, [d]);

  const { page, arg } = route;
  const num = arg !== undefined && /^\d+$/.test(arg) ? Number(arg) : undefined;
  const body = (() => {
    if (!ctx) return null;
    switch (page) {
      case 'scores': return <Scores week={num} />;
      case 'standings': return <Standings />;
      case 'rankings': return <Rankings />;
      case 'teams': return <Teams />;
      case 'rosters': return <Rosters key={arg ?? ''} arg={arg} />;
      case 'coaches': return <Coaches />;
      case 'coach': return num !== undefined ? <Coach id={num} /> : <Coaches />;
      case 'team': { const tr = teamRoute(arg); return tr ? <Team team={tr.team} tab={tr.tab} /> : <Teams />; }
      case 'player': return num !== undefined ? <Player id={num} /> : <Home />;
      case 'stats': return <Leaders />;
      case 'history': return <History />;
      case 'awards': return <Awards arg={arg} />;
      case 'records': return <Records arg={arg} />;
      default: return <Home />;
    }
  })();
  const navPage = page === 'team' ? 'teams' : page === 'player' ? 'stats' : page === 'coach' ? 'coaches' : page === 'awards' || page === 'records' ? 'history' : page;
  const week = d?.offseason ? 'Offseason' : v && v.save ? (v.currentWeek < v.weeks ? weekName(v, v.currentWeek) : 'Season complete') : 'Preseason';
  const shared = snap ? new Date(snap.sharedAt).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '';
  const until = snap ? snapshotExpires(snap.sharedAt).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '';

  return (
    <div className="dy" data-brand="dynasty" data-theme={dark ? 'dark' : 'light'}>
      {snap && d && (
        <div className="dy-snapbar">
          <p><span className="dy-snaptag">Snapshot</span>{d.name} with {d.teams[snap.team]?.school}, {snap.label}. Shared {shared}, link works until {until}. Read-only: it doesn't change.</p>
          <a href="/dynasty">Start your own dynasty</a>
        </div>
      )}
      <Masthead
        title={d?.name ?? 'Dynasty'} href={href('home')}
        sub={d ? `${d.offseason ? d.offseason.year : d.seasons[d.seasons.length - 1].year}, ${week}` : undefined}
        left={<><a href="/">BW95 Elevated</a><a href={toolkitHref} onClick={navClick(toolkitHref)}>Mod Toolkit</a><ThemeToggle dark={dark} onChange={setDark} /></>}
        right={ctx && snap && <Ctx.Provider value={ctx}><a href={href(`team/${snap.team}`)} aria-label={d!.teams[snap.team]?.school}><TeamMark team={snap.team} size={64} exact /></a></Ctx.Provider>}
      >
        {ctx && <NavBar label="Dynasty" items={PAGES.map((p) => ({ label: p.label, href: href(p.id), current: navPage === p.id }))} />}
      </Masthead>
      <main className="dy-main">
        {load.state === 'loading' && <Note>Loading the snapshot…</Note>}
        {load.state === 'error' && <Note kind="error">{load.message}</Note>}
        {load.state === 'gone' && (
          <section className="dy-gone">
            <h1>This snapshot is gone</h1>
            <p>Its owner deleted it, it expired (a link works for {SNAPSHOT_DAYS} days), or the link is wrong. A snapshot is a copy of someone's dynasty at one moment: ask them for a new link.</p>
            <div className="dy-row"><Button href="/dynasty">Start your own dynasty</Button><Button variant="quiet" href="/">About the mod</Button></div>
          </section>
        )}
        <Ctx.Provider value={ctx}>{body}</Ctx.Provider>
      </main>
    </div>
  );
}
