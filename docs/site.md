# The site

The Bill Walsh '95 Elevated website: the homepage (`/`), the manual (`/manual`) and Insights (`/insights`). The Mod Toolkit and Dynasty are at `/toolkit` and `/dynasty` (`app.html`; `vercel.json` rewrites both to `/app`, not `/app.html`: with `cleanUrls` on, a rewrite to `/app.html` answers 404).

## How it's built

| What | Where |
|---|---|
| Every address, with its title and description | `src/site/routes.tsx` |
| The frame (header, footer) | `src/site/Site.tsx` |
| Homepage | `src/site/Home.tsx` |
| Manual pages | `src/site/Manual.tsx`; chapters `src/site/manual/NN-slug.mdx` |
| Insights pages | `src/site/Insights.tsx`; posts `src/site/insights/slug.mdx` |
| What MDX files can use, and how their Markdown is drawn | `src/site/mdx.tsx` |
| Styles | `src/site/site.css` (tokens only: `npm run lint:design`) |
| Screenshots and clips | `public/media/` (`public/media/manual/` for the manual) |
| Prerendering | `src/site/server.tsx`, `cli/prerender.ts` |
| Addresses on the live site | `vercel.json`; the dev server does the same (`vite.config.ts`) |

`npm run build` builds the browser files, then renders every address to its own HTML file (with its content, title, description and share picture), so pages load with their text and share well. In the browser the same React tree takes over (`src/site/main.tsx`). A page must render the same on both: no browser-only values (the window size, storage) on the first render; read them in an effect.

Old addresses keep working: `/#rosters` and the other tab hashes go to `/toolkit#…`, `/#dynasty/…` to `/dynasty#…` (the script in `index.html`, and `legacyAppUrl` in `src/appNav.ts` for `app.html`).

## Keeping it up to date

The site describes the mod's latest features: the homepage, the manual and any Insights post they touch. After the launch, update it when a public GitHub release comes out. Until the site is announced, it follows the latest mainline test ROMs (owner, 2026-11-16). The unreleased changelog in the project notes lists what each test added.

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
- Captures came from the emulator (stable-retro, Genesis Plus GX): a recorded CPU-vs-CPU game cut into clips, and scripted button presses for screens like the play-call tiles (the project notes, `claude/bw95-website-notes.md`, have the scripts).
