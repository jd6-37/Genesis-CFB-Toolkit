import { lazy, StrictMode, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800-italic.css';
import './styles.css';
import App from './App';

// The Dynasty section (#dynasty…) is its own site; the tools stay mounted underneath so their ROMs
// and edits are still there on the way back.
const DynastyApp = lazy(() => import('./tools/dynasty/DynastyApp'));
const isDynasty = () => /^#dynasty(\/|$)/.test(window.location.hash);

function Root() {
  const [dynasty, setDynasty] = useState(isDynasty);
  const [back, setBack] = useState(isDynasty() ? '#patch' : window.location.hash || '#patch');
  useEffect(() => {
    const on = () => {
      const now = isDynasty();
      setDynasty(now);
      if (!now) setBack(window.location.hash || '#patch');
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return (
    <>
      <div hidden={dynasty}>
        <App />
      </div>
      {dynasty && (
        <Suspense fallback={null}>
          <DynastyApp toolkitHref={back} />
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
