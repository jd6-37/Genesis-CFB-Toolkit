# Working on this repo

Read this before changing anything. More than one person or Claude session may be working on this repo at the same time, and `main` deploys straight to the live site, https://genesis-cfb-toolkit.vercel.app. These rules keep work from colliding and keep the site working.

## One working copy per session

- Two sessions must never share a working copy: when one switches branches, the other's files change underneath it.
- Claude sessions work in their own clone in their own workspace (a cloud session clones the repo into its container) and push their branch to GitHub.
- The owner's clone on his Mac (`Bill-Walsh-95-Modding/Genesis-CFB-Toolkit`) is his. Don't edit, commit or switch branches there unless he asks.
- If a session does need to work on the Mac, it uses its own git worktree next to the owner's clone, never the clone itself:
  ```sh
  git fetch origin
  git worktree add -b feature/rosters-tab ../Genesis-CFB-Toolkit-rosters origin/main
  ```

## Branches and pull requests

- Never commit to `main` directly. Start every feature or fix on its own branch from an up-to-date `main`:
  ```sh
  git switch main && git pull
  git switch -c feature/rosters-tab
  ```
- Branch names: `feature/…`, `fix/…` or `docs/…`, short and lowercase.
- One branch per piece of work, and keep it short-lived. Before pushing, bring it up to date with `main`:
  ```sh
  git fetch origin && git rebase origin/main
  ```
- Push the branch and open a pull request into `main`. Vercel builds a preview URL for every branch, so test there before merging.
- The owner (jd6-37) merges pull requests, or tells a Claude session to. Delete the branch after the merge.
- The owner also edits on GitHub, so always pull before starting.

## Shared files

- Every tool touches `src/App.tsx`, `src/styles.css`, `README.md` and `package.json`. Keep changes to these small, and put a tool's own code in its own files (for example `src/tools/rosters/` and `src/core/rosters*.ts`).
- If two branches change the same lines, resolve the conflict so that both changes survive. Never drop someone else's change to make a merge go through; ask if it's unclear.
- `package-lock.json`: if a rebase conflicts there, take `main`'s version and run `npm install` again instead of editing it by hand.

## Before opening a pull request

- `npm run build` passes (type check and build).
- If the change touches ROM building (`src/core/`), rebuild a known swap with the CLI (see the README) and compare the SHA-1 with the one from before the change. The bytes must only change when the change is meant to change them.
- If the change touches the Rosters tool (`src/core/roster*.ts`, `src/tools/rosters/`), `npm run test:rosters -- BW95 CF96 CF97` passes (paths to the three ROMs; zips work).
- Saved files keep loading: swap files written by earlier versions must still open (see `isSwapFile` in `src/core/build.ts`). Any new file format gets an `app`, `tool` and `version` field from the start.
- ROM space: every area the app writes must be checked as free first, and every piece of code it patches as unchanged (like `swapProblems` in `src/core/build.ts`), because the tools also take modded ROMs. New areas must not overlap the areas the README lists or those used by Bill Walsh College Football '95 Elevated (formerly Rebalanced).
- No ROMs, ROM data or game art in the repo. Everything is read from the user's own ROMs in the browser.
- Update the README when anything a user sees changes.
- US English spelling everywhere: code, UI labels, file names, docs ("color", "catalog").

## Commits

- Small commits with a message that says what changed and why.
- Claude sessions end each commit message with the attribution lines the session gives them.
- Claude sessions also record each step and decision in the project notes of the claude.ai project "Bill Walsh 95 Genesis modding" (`claude/bw95-swap-webapp-notes.md` for the app, `claude/bw95-roster-editor-notes.md` for rosters).
