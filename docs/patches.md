# Patch tab

The Patch tab is the toolkit's first step: the user loads a Bill Walsh College Football '95 ROM, adds one of the Elevated mod's released patches if it's the original game, and takes the ROM on to Team Swap, or to Season, Styles and Rosters.

Code: `src/core/bps.ts` (BPS patches), `src/core/patches.ts` (the patch list), `src/tools/patch/PatchTool.tsx` (the tab and the `usePatchRom` hook that `App.tsx` shares with Team Swap). Tests: `cli/patchtest.ts`.

## Where the patches come from

The patches live in the mod's repo, [jd6-37/Bill-Walsh-CFB-95-Elevated](https://github.com/jd6-37/Bill-Walsh-CFB-95-Elevated), not here: this repo holds no ROM data, and the app always offers the mod's latest release without an app update.

- When the page opens, the app fetches `patches.json` from the repo's `main` branch through `https://raw.githubusercontent.com/jd6-37/Bill-Walsh-CFB-95-Elevated/main/`. That host sends `Access-Control-Allow-Origin: *`, so the browser may read it. GitHub release downloads (`github.com/…/releases/download/…`) can't be used: their redirect has no CORS header, so browsers block them. The patch files therefore have to be in the repo tree.
- raw.githubusercontent.com caches files for up to 5 minutes (`cache-control: max-age=300`), so a new release reaches the app within about 5 minutes of the push. The app asks with `cache: 'no-cache'`, but GitHub's own cache still applies.
- The app downloads a patch file only when the user chooses **Apply patch**.
- `?patches=<branch>` in the page address reads the list and the patches from another branch or tag, e.g. `?patches=feature/patch-list`, to try a release in the app before it goes to `main`. The repo is public, so a branch is public too.
- If the list can't be loaded (offline, GitHub down, a broken list), the tab says so, and **Use a .bps file** still applies a patch the user downloaded.

## The patch list (`patches.json`, version 1)

```json
{
  "app": "bill-walsh-cfb-95-elevated",
  "tool": "patches",
  "version": 1,
  "original": { "name": "Bill Walsh College Football 95 (USA)", "sha1": "2ae000f45474b3cdedd08eeca7f5e195959ba689" },
  "contents": [
    { "id": "fixes", "label": "Fatigue fix and gameplay fixes", "about": "The fatigue fix, more explosive plays and the 2-point conversion fix." }
  ],
  "fatigue": [
    { "id": "fixed", "label": "Fixed Fatigue", "about": "Recommended. Half the original drain per play and 4x faster recovery." },
    { "id": "none", "label": "No Fatigue", "about": "Energy never drops." }
  ],
  "releases": [
    {
      "version": "v1.0",
      "name": "Rebalanced v1.0",
      "date": "2026-11-06",
      "patches": [
        {
          "content": "fixes",
          "fatigue": "fixed",
          "name": "Bill Walsh College Football '95 Rebalanced v1.0 (Fixed Fatigue)",
          "file": "Bill_Walsh_College_Football_95_Fixed_Fatigue_Rebalanced_v1_0.bps",
          "size": 1670,
          "sha256": "91e15e0d3cca7b0c8f9319df863106eb788637afcea118724e40763a796e0d22",
          "rom": "9e8f79f431c47cd52008f6315a3cb9e1bdd6a37e"
        }
      ]
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `app`, `tool`, `version` | Identify the file. `tool` must be `"patches"`; the app reads `version` 1 only (a change it can't read gets a new version number). |
| `original` | The ROM every patch applies to: its name and SHA-1. Loading this ROM shows the patch choices. |
| `contents` | The "What to add" choices (`id`, `label`, optional `about`), in the order shown. The app shows the choice only when the current release offers more than one. |
| `fatigue` | The "Fatigue" choices, same fields. The app shows only those the picked content has. |
| `releases` | Newest first. **The first release is the current one**: only its patches with a `file` are offered. |
| `releases[].version`, `name`, `date` | Version (`v1.1.0`), the name shown as "Latest release" and in messages, and the release date. |
| `patches[].content`, `fatigue` | The choice ids the patch belongs to. One patch per combination in the current release. |
| `patches[].name` | The patched ROM's name in the app (ROM cards, Team Swap). |
| `patches[].file` | Path from the repo root. Leave it out (with `size` and `sha256`) for older releases whose files are no longer in the repo: they're listed only so the app recognizes their ROMs. |
| `patches[].size`, `sha256` | Of the patch file. The app checks both after downloading, so a list and a patch file out of step (GitHub's cache during a release) give a clear message instead of a wrong ROM. |
| `patches[].rom` | SHA-1 of the patched ROM. The app checks the result against it and recognizes ROMs patched elsewhere by it. |

`patchListProblems` in `src/core/patches.ts` checks all of this; `npm run test:patch` runs it on the repo's list.

## Publishing a release

1. Build the patches from the original ROM.
2. Put them in the Elevated repo (for example under `patches/`).
3. In `patches.json`, add the release at the top of `releases`, with one entry per patch: `sha256sum` and the size of each `.bps`, and `sha1sum` of the ROM it makes. Add any new `contents` or `fatigue` choices.
4. For the previous release: remove its files from the repo (they stay attached to its GitHub release and in git history) and drop `file`, `size` and `sha256` from its entries.
5. Check it locally: `npm run test:patch -- BW95.md path/to/Bill-Walsh-CFB-95-Elevated CF97.md`. Optionally push a branch and open the app with `?patches=<branch>`.
6. Merge to `main`. The app offers the new release within about 5 minutes.

## Applying a patch

`applyBps` in `src/core/bps.ts` implements the BPS format (byuu's, as written by Flips): the four commands (source read, target read, source copy, target copy) and the three CRC32 checks the format carries: the patch file (before anything else), the source ROM's size and CRC32 (a patch made for another ROM is refused with "This patch wasn't made for the original USA ROM."), and the result. For listed patches the app then compares the result's SHA-1 with `rom`.

The patched ROM is named after the patch file, with `.md` for `.bps` (`Bill_Walsh_College_Football_95_Fixed_Fatigue_Rebalanced_v1_0.md`), the way the releases name ROMs. A `.bps` file that isn't on the list gives a ROM named after that file.

## Which ROM goes where

- The original game (by SHA-1): the patch choices, plus **Use a .bps file**.
- A ROM whose SHA-1 is in the list: "already has the latest release" or, for an older release, which newer release is out and that updating starts from the original ROM.
- Any other BW95 ROM (by its header): used as it is.
- `hasSwappedTeams` (`src/core/build.ts`: the menu-order area at `0x1F0000` is in use) decides the next step: a ROM with swapped teams goes straight to Season, Styles and Rosters, since Team Swap can't run twice. Otherwise `swapProblemText` says whether Team Swap can take it.

Team Swap uses the Patch tab's ROM: `App.tsx` passes every BW95 ROM loaded in the Team Swap tab to the hook (`open`), and builds on whatever ROM the hook holds. The team choices are kept when the new ROM has the same 36 teams (patching doesn't change them). **Edit season, styles and rosters** hands the ROM to the shared working ROM (`takeRom` in `src/tools/shared/WorkRom.tsx`), which asks first if the working ROM has unsaved changes.

## Tests

`npm run test:patch -- BW95.md path/to/Bill-Walsh-CFB-95-Elevated [CF97.md]`:

- BPS: a patch built in the test that uses all four commands (including a target copy that overlaps what it writes and a source copy going backward); the wrong ROM, a damaged patch, a result that fails its checksum, and a file that isn't BPS.
- The repo's patch list is valid; broken lists (unknown version, unknown choice ids, missing `sha256`, bad SHA-1, a path outside the repo, two patches for one combination) are caught; an older release without files is fine.
- Every offered patch, applied to the original ROM, gives the SHA-1 in the list; a changed byte in a patch file fails the list's check. A patched ROM whose teams are already swapped (the 2026 Season Edition) is refused by Team Swap with the "already has swapped teams" message; with CF97, every other patched ROM takes a team swap and the result counts as swapped.
- `?patches=` handling.

Browser checks (Playwright against `vite preview`, with the list and patches served from a local copy of the repo, and once from GitHub itself) are listed in the README.
