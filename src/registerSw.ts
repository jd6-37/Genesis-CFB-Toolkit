// Registers the site's service worker (public/sw.js) in production builds, after the page has loaded.
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* the site works without it */ });
  });
}
