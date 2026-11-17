import { lazy, StrictMode, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800-italic.css';
import '@fontsource/barlow-condensed/900.css';
import '@fontsource/handjet/500.css';
import '@fontsource/micro-5/400.css';
import './styles.css';
import App from './App';
import { isDynastyPath, legacyAppUrl, NAV_EVENT } from './appNav';
import { snapshotIdFromPath } from './core/dynasty/snapshotId';

// An old address (/#rosters, /#dynasty/…, /app.html) goes to the same place under /toolkit or /dynasty.
const fixed = legacyAppUrl(window.location.pathname.replace(/\/$/, '') || '/', window.location.hash);
if (fixed) window.history.replaceState(null, '', fixed);

// Dynasty (/dynasty) is its own site; the tools stay mounted underneath so their ROMs and edits are
// still there on the way back.
const DynastyApp = lazy(() => import('./tools/dynasty/DynastyApp'));
const SnapshotApp = lazy(() => import('./tools/dynasty/SnapshotApp'));
const toolkitUrl = () => `/toolkit${window.location.hash || ''}`;

function Root() {
  const [dynasty, setDynasty] = useState(isDynastyPath);
  const [back, setBack] = useState(isDynastyPath() ? '/toolkit' : toolkitUrl());
  useEffect(() => {
    const on = () => {
      const now = isDynastyPath();
      setDynasty(now);
      if (!now) setBack(toolkitUrl());
    };
    for (const ev of ['hashchange', 'popstate', NAV_EVENT]) window.addEventListener(ev, on);
    return () => {
      for (const ev of ['hashchange', 'popstate', NAV_EVENT]) window.removeEventListener(ev, on);
    };
  }, []);
  return (
    <>
      <div hidden={dynasty}>
        <App />
      </div>
      {dynasty && (
        <Suspense fallback={null}>
          {snapshotIdFromPath(window.location.pathname)
            ? <SnapshotApp id={snapshotIdFromPath(window.location.pathname)!} toolkitHref={back} />
            : <DynastyApp toolkitHref={back} />}
        </Suspense>
      )}
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
