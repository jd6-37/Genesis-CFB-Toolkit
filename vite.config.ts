import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import mdx from '@mdx-js/rollup';
import remarkGfm from 'remark-gfm';

// Two pages:
// - index.html: the site (homepage, manual, Insights). `npm run build` also renders every site address to
//   its own HTML file (cli/prerender.ts).
// - app.html: the Mod Toolkit and Dynasty, served at /toolkit and /dynasty (vercel.json does the same on
//   the live site).
const APP_PATHS = /^\/(toolkit|dynasty)\/?(\?.*)?$/;

/** The dev server's version of vercel.json's rewrites. */
function devRoutes(): Plugin {
  return {
    name: 'dev-routes',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url ?? '/';
        if (APP_PATHS.test(url)) req.url = '/app.html';
        else if (/^\/(manual|insights)(\/[\w-]*)*\/?(\?.*)?$/.test(url)) req.url = '/index.html';
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [{ enforce: 'pre', ...mdx({ remarkPlugins: [remarkGfm] }) }, react({ include: /\.(mdx|tsx?)$/ }), devRoutes()],
  build: {
    target: 'es2022',
    rollupOptions: { input: { site: 'index.html', app: 'app.html' } },
  },
});
