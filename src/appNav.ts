// The apps page (app.html) is served at /toolkit and at /dynasty (vercel.json, and the dev server in
// vite.config.ts). Moving between the two keeps the page loaded, so the Toolkit's ROMs and edits are
// still there on the way back: links between them call `go` instead of loading a new page.
import type { MouseEvent } from 'react';

export const NAV_EVENT = 'app-nav';

/** /dynasty, or a shared snapshot at /dynasty/s/<id>. */
export const isDynastyPath = () => /^\/dynasty(\/s\/[A-Za-z0-9_-]{12})?\/?$/.test(window.location.pathname);

/** Change the address without reloading, and tell the apps to look at it. */
export function go(url: string) {
  window.history.pushState(null, '', url);
  window.dispatchEvent(new Event(NAV_EVENT));
}

/** onClick for a link to the other app: an ordinary click stays on the page; a click with a modifier
    (new tab, new window) is left to the browser. */
export const navClick = (url: string) => (e: MouseEvent<HTMLAnchorElement>) => {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  go(url);
};

/** Addresses from before the site moved the apps (/#rosters, /#dynasty/team/12, /app.html#…): the same
    place under /toolkit or /dynasty. Returns null when the address is already right. */
export function legacyAppUrl(pathname: string, hash: string): string | null {
  const dyn = /^#dynasty(?:\/(.*))?$/.exec(hash);
  if (dyn) return dyn[1] ? `/dynasty#${dyn[1]}` : '/dynasty';
  if (pathname === '/toolkit' || pathname === '/dynasty' || /^\/dynasty\/s\/[A-Za-z0-9_-]{12}$/.test(pathname)) return null;
  return `/toolkit${hash}`;
}
