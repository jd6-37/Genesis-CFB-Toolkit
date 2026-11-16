import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import './fonts';
import './site.css';
import { Site } from './Site';
import { findRoute } from './routes';

const root = document.getElementById('root')!;
const app = (
  <StrictMode>
    <Site route={findRoute(window.location.pathname)} />
  </StrictMode>
);
// Built pages come with their HTML (cli/prerender.ts); the dev server's don't.
if (root.firstElementChild) hydrateRoot(root, app);
else createRoot(root).render(app);
