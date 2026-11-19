# The site

The Bill Walsh '95 Elevated website, at https://bw95mod.com (owner, 2026-11-19: Cloudflare DNS, records not proxied, pointing at Vercel; `SITE_URL` in `src/site/routes.tsx` is the address in every page's canonical, `og:url` and `og:image`; the project's vercel.app address still serves the same deployment): the homepage (`/`), the manual (`/manual`), Rosters (`/rosters`) and Insights (`/insights`). The Mod Toolkit and Dynasty are at `/toolkit` and `/dynasty` (`app.html`; `vercel.json` rewrites both to `/app`, not `/app.html`: with `cleanUrls` on, a rewrite to `/app.html` answers 404).

## How it's built

| What | Where |
|---|---|
| Every address, with its title and description | `src/site/routes.tsx` |
| The frame (header, footer) | `src/site/Site.tsx` |
| Homepage | `src/site/Home.tsx` |
| Manual pages | `src/site/Manual.tsx`; chapters `src/site/manual/NN-slug.mdx` |
| Insights pages | `src/site/Insights.tsx`; posts `src/site/insights/slug.mdx` |
| Rosters pages | `src/site/rosters/` (addresses and page data `pages.ts`, the card `Card.tsx`, the pages `Rosters.tsx`); data `public/data/rosters/`, logos `public/media/rosters/` |
| What MDX files can use, and how their Markdown is drawn | `src/site/mdx.tsx` |
| Styles | `src/site/site.css` (tokens only: `npm run lint:design`) |
| Screenshots and clips | `public/media/` (`public/media/manual/` for the manual) |
| Prerendering | `src/site/server.tsx`, `cli/prerender.ts` |
| Addresses on the live site | `vercel.json`; the dev server does the same (`vite.config.ts`) |

`npm run build` builds the browser files, then renders every address to its own HTML file (with its content, title, description and share picture), so pages load with their text and share well. In the browser the same React tree takes over (`src/site/main.tsx`). A page must render the same on both: no browser-only values (the window size, storage) on the first render; read them in an effect.

Old addresses keep working: `/#rosters` and the other tab hashes go to `/toolkit#…`, `/#dynasty/…` to `/dynasty#…` (the script in `index.html`, and `legacyAppUrl` in `src/appNav.ts` for `app.html`).

## Search, agents and the installable site

- Every page's `<head>` (`src/site/server.tsx`) has its title, description, canonical address, Open Graph and Twitter tags, and schema.org JSON-LD from `src/site/seo.ts`: `WebSite` on every page; the mod (`SoftwareApplication`, free, based on the original game) and the two web apps on the homepage; `TechArticle` for manual chapters, `BlogPosting` for Insights posts, `SportsTeam` with its players for roster pages, and a `BreadcrumbList` below the homepage. `/404` is `noindex`.
- The build also writes `dist/sitemap.xml` (every page, the Insights posts with their dates) and `dist/llms.txt` (what the site is and a link to every chapter, post and roster section, for language models and agents). Both come from the routes, so a new chapter or post appears in them on its own.
- `public/robots.txt` allows everything but `/api/` and the shared dynasty snapshots (`/dynasty/s/`), and points to the sitemap.
- The site installs as an app (PWA): `public/manifest.webmanifest`, the icons in `public/icons/` and a service worker, `public/sw.js`, registered in production builds by `src/registerSw.ts` (site and `/toolkit`, `/dynasty`). Pages are fetched from the network first and kept for offline use; the hashed build files are cached; pictures and roster data are served from the cache and refreshed in the background; `/api/` and videos are never cached. When `sw.js` changes in a way that should drop old caches, bump its `VERSION`. `vercel.json` serves `sw.js` with `no-cache` so a new one is picked up at once.

## Keeping it up to date

The site describes the mod's latest features: the homepage, the manual and any Insights post they touch. The site went public with the v2.1.0 release (2026-11-19): from now on, update it when a public GitHub release comes out, not for test ROMs (owner, 2026-11-16). The Rosters section's data comes from the release ROMs too (`npm run site:rosters` with the release's two editions).

## Rosters

User, 2026-11-19: a Rosters page for every team of the game (2026, 1994, the original game's 36, the 32 historic teams), as cards and as one table of every player, with a team search; the 1993 game's roster cards rebuilt in HTML. Approved on the design canvas "Rosters section mockups".

- **Addresses:** `/rosters` (the 2026 cards), `/rosters/<edition>` (`2026`, `1994`, `original`, `historic`), `/rosters/<edition>/table`, `/rosters/<edition>/<team>` (the team's id: its name in lower case, `alabama-78` for a historic team). The build writes every one (322 pages).
- **Data:** `npm run site:rosters -- ELEVATED_2026 ELEVATED_1994 BW95` reads the ROMs (the historic teams from the 2026 ROM: in the mainline since 2026 test72) (`cli/siterosters.ts`): each team's 32 in slot order, with the labels, jersey numbers, names and classes (the names table the game reads; none in the original game), the numbers Team Rosters shows (0-99 from the fine values on v8 ROMs; the original's 16 steps as 0-100), weight in pounds (+25 on the line where the ROM has the OL weight patch), OVR (the Dynasty app's formulas), the team's OFF / DEF and conference, its color, the stripe color and the logo. Run it on each new mainline: the site follows the latest test ROMs for now, later only public releases (owner, 2026-11-19). The data and logos are an exception to "no ROM data in the repo" (owner, 2026-11-19: "yes, exception"; logos: "Yes, another exception").
- **Impact players** (user, 2026-11-19): a yellow dot after the name on the cards. `site:rosters` stores each team's `impact` (indexes into its players): the game's own pick (`impactSlots`, the H-044 formula, with the team's 4-3 / 3-4 bit) for the 2026 and 1994 teams, and the historic teams' hand-picked slots from the ROM's table HIM (found through the pick hook's `lea`), else the formula. None for the original game.
- **Previous / next in place** (user, 2026-11-19: the page jumped to the top every time): the buttons switch the card in the browser (`RostersPage` `nav`: the edition's file fetched once, `pageData`, `history.pushState`, the title), so the scroll position stays; Back / Forward work (`popstate`); a click with a modifier key, or no script, follows the plain link.
- **Names:** "R. Bush" on phones and tablets; from 1024 px the first name too (user, 2026-11-19), on the cards where the whole name fits its cell (`useFullNames` measures each cell; about 6 in 100 stay short), in the table always.
- **Card header line:** "Offense 75 Defense 73 • C-USA": labels regular, numbers bold, the conference italic, larger from 640 px. The Bill Walsh seal sits over the top right corner of the box, centered on its right border.
- **Conference filters on the grid and the team pages** (user, 2026-11-19): the same Conference select and Power / Non-power checkboxes (`useConfFilter`, shared with the table). On a team page they pick which teams previous / next step through (A-Z, wrapping; the team shown may be outside the filter). The filter lives in the address (`?conf=SEC&show=power|nonpower|none`), and the grid's tiles, previous / next and "All … teams" carry it. Not on the historic and original pages (no conferences).
- **Table filters** (user, 2026-11-19, to find e.g. "the fastest HB in the SEC" or "the best QB on a non-P4 team"): name, conference, team, positions (one compact row of checkboxes QB HB FB WR TE OLINE DE DT OLB MLB CB S K P, with All / None; each roster label maps to one position, `positionOf`), and Power conf. / Non-power conf. Power: 2026 SEC, Big Ten, ACC, Big 12; 1994 the seven major conferences (SEC, ACC, Big East, Big Eight, Southwest, Big Ten, Pac-10); independents are non-power.
- **Page data:** each built page carries what it shows in `<script type="application/json" id="page-data">` (`Route.data`; `src/site/server.tsx`), and the browser takes it over from there (`main.tsx`), so the pages render the same on both. The team list of an edition comes with every page (the search); the table's players load in the browser from `/data/rosters/<edition>.json`. On the dev server (no built pages) a Rosters page fetches its edition's file.
- **The card:** title "SCHOOL 'YY" in the team color (the home uniform's team color; a light one gives way to the helmet's or a dark gray), the logo (from the ROM's mascot art, 1.5× and 2× on wide cards), the Bill Walsh seal top right, a stripe in the secondary color (the first uniform color clearly unlike the jersey that isn't white; light gray when only white is left; user: "The color bars should be the shool's secondary color", "if the school's secondary color is white, make it a light gray"), the EA Sports logo bottom right, "Offense / Defense / conference" in place of the original's "Bill's pick" (user: "yeah that's fine"). The groups' columns use Team Rosters' labels (SPEED, QUICK, INTEL, HANDS, POWER or PWR on the line, RANGE, TACKLE, BLOCK, WT. on the line; short labels on a phone). Names read "R. Bush", the full name on hover (user). The Elevated editions' cards have each player's OVR after his name, in bold on a gray cell (user, 2026-11-19: "Can we show the player OVR rating in the elevated rosters?", "maybe make the OVR numbers bold"); the original game's cards don't. The kickers' QUICK column reads "QUICK (KPOW)" ("KPOW" on phones; user, 2026-11-19), with wider columns in that group. A team's page has previous and next team buttons above and below the card (A-Z, around the end; user, 2026-11-19: "NEXT / PREV buttons to the card view page so the user can cycle through the roster cards"). The card is the Dynasty brand's paper on the indigo page; its layout follows the room it has (container queries).

## Writing the copy

All of the site's text is direct and literal (owner, 2026-11-14). A heading names the feature or screen ("Swap in your backup halfback or middle linebacker", not "Fresh legs in the backfield"); a sentence says what happens and who does it. No slogans, wordplay, puns or figures of speech, and no vague words where a button or number can be named. Say what a control does in the game's own terms (the button, the screen, the label on it).

## Adding a manual chapter

Make `src/site/manual/NN-slug.mdx`:

```mdx
export const meta = { n: 13, slug: 'slug', title: 'The title', summary: 'One sentence for the contents page.' }

The chapter's text in Markdown. ## starts a section (a black bar).
```

The contents, the previous / next links and the prerendered page follow from the file. Parts you can use without importing them:

- `<Btn k="C" />`: a controller button (`A` `B` `C` `X` `Y` `Z` `START` `MODE` `dpad` `up` `down` `left` `right`).
- `<New />` marks what the mod added; `<Six />` what needs a 6-button pad.
- `<Controls rows={[[['A', 'X'], 'What it does', 'new six'], …]} />`: a controls list; the third item is `new`, `six`, `new six` or nothing.
- `<Tip>…</Tip>` (`title` to rename it), `<Fixed>…</Fixed>` (posts).
- `<Shot src="/media/manual/x.png" alt="…" points={[[x %, y %, 'what it is'], …]} />`: a screenshot (or `video`) with numbered callouts.
- `<Edition only="1994">…</Edition>`: text for one edition; the manual's switch shows one or the other (both are in the page).

Write what the player sees and does, in the order he meets it. Mark everything the mod added with `<New />`. Convey the original manual's information in our own words: no copied text, no EA artwork or logos.

## Adding an Insights post

Make `src/site/insights/slug.mdx`:

```mdx
export const meta = { slug: 'slug', title: 'The title', dek: 'One or two sentences under it.', date: '2026-11-14', tag: 'Season sim', minutes: 6 }
```

Newest first on `/insights` and the homepage (the homepage shows three). `##` headings make the "In this post" list. Facts about the game's code come from the project's notes, with the addresses where they help; say what was measured and what wasn't.

## Screenshots and clips

The one exception to "no game art in the repo" (CLAUDE.md): pictures and short clips of the mod, captured from its test ROMs, under `public/media`. Never a ROM, a save or ROM data.

- Screenshots: the game's own 320 × 224, PNG; the page scales them up with hard pixels.
- Clips: H.264 MP4, no sound, the game's picture doubled with nearest-neighbor scaling (`ffmpeg … -vf "scale=iw*2:ih*2:flags=neighbor" -c:v libx264 -crf 26-28 -pix_fmt yuv420p -movflags +faststart`), a few seconds that loop, about 1 MB or less. Each clip has a PNG of its first frame as its poster.
- Long clips (the hero): encode with `-preset veryslow -tune animation -crf 20` (half the size of a fast preset at the same quality) and add an AV1 copy, `name.av1.mp4` (`-c:v libsvtav1 -preset 4 -crf 38`), passed to `Screen` as `av1`; browsers that can play AV1 take it, the rest the H.264 file. Don't encode at the game's own 320x224 and let the browser scale it: the codec keeps color at half resolution, so colors smear.
- From a screen recording (not a whole multiple of 320x224): sample each frame at the centers of the game's own pixel grid, then double it. Scaling the recording down with a smoothing filter blurs it.
- Loading (`Screen` in `src/ui`): a clip loads when its screen nears the viewport and pauses off screen; with reduced motion or Save-Data only the picture shows; the hero's picture loads first (`priority`).
- Captures came from the emulator (stable-retro, Genesis Plus GX): a recorded CPU-vs-CPU game cut into clips, and scripted button presses for screens like the play-call tiles (the project notes, `claude/bw95-website-notes.md`, have the scripts).
