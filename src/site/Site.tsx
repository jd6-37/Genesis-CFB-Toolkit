// The site's frame: header, the page, footer. The same tree renders at build time (cli/prerender.ts) and
// in the browser (main.tsx), so pages must render the same in both: no browser-only values on first render.
import { useState } from 'react';
import { REPO_URL, type Route, type Section } from './routes';

const NAV: { label: string; href: string; section?: Section }[] = [
  { label: 'Features', href: '/#features' },
  { label: 'Editions', href: '/#editions' },
  { label: 'Manual', href: '/manual', section: 'manual' },
  { label: 'Rosters', href: '/rosters', section: 'rosters' },
  { label: 'Insights', href: '/insights', section: 'insights' },
];

export function Wordmark() {
  return (
    <span className="site-wordmark">
      Bill Walsh '95 <span className="site-elevated">ELEVATED</span>
    </span>
  );
}

export function SiteHeader({ section }: { section: Section }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a className="site-home" href="/" aria-label="Bill Walsh '95 Elevated, home">
          <Wordmark />
        </a>
        <button type="button" className="site-menu-button" aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen(!open)}>
          {open ? 'Close' : 'Menu'}
        </button>
        <div id="site-menu" className="site-menu" data-open={open || undefined}>
          <nav className="site-nav" aria-label="Site">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} aria-current={n.section === section ? 'page' : undefined}>
                {n.label}
              </a>
            ))}
          </nav>
          <nav className="site-apps" aria-label="Apps">
            <a href="/toolkit">Mod Toolkit</a>
            <a href="/dynasty">Dynasty</a>
          </nav>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-about">
          <p className="site-footer-mark"><Wordmark /></p>
          <p>
            A free fan mod of Bill Walsh College Football '95 for the Sega Genesis, by JD637. Not affiliated with or endorsed by Electronic Arts,
            the NCAA, or any school or player. No ROM or game files are hosted on this site: you need your own copy of the game.
          </p>
        </div>
        <nav aria-label="The mod">
          <h2>The mod</h2>
          <a href="/#features">Features</a>
          <a href="/#editions">Editions</a>
          <a href="/manual">Manual</a>
          <a href="/rosters">Rosters</a>
          <a href="/insights">Insights</a>
        </nav>
        <nav aria-label="Apps">
          <h2>Apps</h2>
          <a href="/toolkit">Mod Toolkit</a>
          <a href="/dynasty">Dynasty</a>
        </nav>
        <nav aria-label="Source">
          <h2>Source</h2>
          <a href={REPO_URL}>Patches on GitHub</a>
          <a href={`${REPO_URL}/releases`}>Releases</a>
        </nav>
      </div>
    </footer>
  );
}

export function Site({ route }: { route: Route }) {
  return (
    <div className="site" data-brand="toolkit">
      <a className="site-skip" href="#main">Skip to the content</a>
      <SiteHeader section={route.section} />
      <main id="main">{route.render()}</main>
      <SiteFooter />
    </div>
  );
}
