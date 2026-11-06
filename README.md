# Genesis CFB Toolkit

Browser-based modding tools for EA's college football games on the Sega Genesis: Bill Walsh College Football '95, College Football USA 96 and College Football USA 97.

Everything runs in your browser. Your ROMs are opened on your own computer and are never uploaded anywhere. The app contains no ROM data or artwork; you bring your own ROMs.

## Tools

- **[Team Swap](#team-swap):** swap College Football USA 97 teams into Bill Walsh College Football '95.
- **Roster editor:** planned, for Bill Walsh '95, CF96 and CF97.

## Team Swap

Pick any of BW95's 36 teams, choose a CF97 team to replace it with, adjust the names and uniform colors, and download the new ROM. The new teams' art comes from your CF97 ROM.

### What a swap changes

- Logo (setup screen, pregame and play-call screens), helmet and wordmark (stadium banner, play-call screen), taken from your CF97 ROM.
- School name, city and nickname. CF97 stores each team's stadium rather than its city, so the city Bill Walsh welcomes you to is filled in for you.
- Home and away uniform colors, mapped from CF97's uniforms and editable with a Genesis color picker.
- End zone color for the team's home games.
- The end-of-season celebration: swapped teams get a "GO TEAM!" card stunt in their own colors (cards, skirts and pom-poms, tops; editable, with a preview).
- The team menus stay alphabetical with the new names.
- The Walsh Report uses the new names.

### What stays the same

- Schedules, rankings, conferences and battery saves: the new team plays in the old team's slot.
- Rosters (a CSV roster editor is planned).
- The Walsh Report keeps the original team's scouting text, with the names changed.
- Teams you don't swap keep their own celebrations.

### Supported ROMs

| ROM | SHA-1 |
|---|---|
| Bill Walsh College Football 95 (USA) | `2ae000f45474b3cdedd08eeca7f5e195959ba689` |
| Bill Walsh College Football '95 Rebalanced v1.0, Fixed Fatigue | `9e8f79f431c47cd52008f6315a3cb9e1bdd6a37e` |
| Bill Walsh College Football '95 Rebalanced v1.0, No Fatigue | `c012fbd0fb0db59648f2d9bff78acc29d9f63ea0` |
| College Football USA 97 (USA) | `9b93035ecdc2b6f0815281764ef647f2de039e7b` |

Files can be `.md`, `.bin` or `.gen`, or a `.zip` containing one. The Rebalanced ROMs come from the [Bill Walsh College Football '95 Rebalanced](https://github.com/jd6-37/Bill-Walsh-College-Football-95-Rebalanced) patches; the swap keeps all of their changes.

### Swap files

**Save swap file** writes your choices (teams, names, colors) as a small JSON file with no ROM data in it. Load it later, or share it, to rebuild the same ROM from the same source ROMs.

### How it works

- **CF97 teams:** a pointer table at `0x002CEA` lists 112 team records (111 teams and a placeholder). Each record holds the names, a 3-line palette (logo, home uniform, away uniform), a sprite map (logo, wordmark, helmet) and the tiles, compressed with an LZ scheme that `src/core/cfdecomp.ts` decodes. The decoder was checked byte for byte against the game's own routine (`0x0581AC`) for every team, and against video memory in the running game.
- **BW95 teams:** a pointer table at `0x0028DC` lists 36 team blocks. A swap rebuilds the block in place: ratings group, uniforms, logo container, helmet container and names. The roster stays at the same offset at the end of the block.
- **Helpers** (68000 assembly in `asm/`, placed in unused ROM space):
  - `0x1F0000` menu order: the four team steppers (setup home and visitor, `0x06ACB2`, season Team Rosters) step through teams alphabetically by their new names.
  - `0x1F0280` end zone color per home team (the game normally darkens the home jersey's darkest shade).
  - `0x1F0300` helmet tile base on the setup screen, so helmets of up to 36 tiles fit (the stock layout leaves 32).
  - `0x1F0320` celebration colors: when the generic card stunt plays, palette entries 9, 10 and 13 are replaced with the winning team's colors.
- **Walsh Report:** the swapped teams' paragraphs get the new names, and the text block stays where it is: if it gets longer, some two-space sentence gaps become one space; if it gets shorter, the leftover bytes after the last paragraph are filled with spaces. Only if very long names still don't fit is the block moved to `0x1F8000` (its only reference is the pointer at `0x078FC0`).
- **ROM space:** the swap uses about 4.4 KB of unused ROM (`0x1EEF00`-`0x1EFF17` and `0x1F0000`-`0x1F043B`), and checks that it's unused before writing.
- **Celebration:** one "GO TEAM!" card stunt at `0x1EEF00`, built from your BW95 ROM: Pitt's "GO PITT!" card stunt with four cards re-lettered, using letters copied from Pitt's and Texas A&M's cards. Swapped teams' entries in the celebration table (`0x034A68`) point to it.
- **Checksums:** EA's boot check (the sum at `0x1E6430`) and the Genesis header checksum are recomputed.

### Testing

- Pitt → Tulane on the original ROM and on Rebalanced v1.0 (Fixed Fatigue): boot, title, setup screen, Bill Walsh's welcome, Walsh Report, coin toss, pregame, kickoff with the new uniforms and end zones. On the Rebalanced ROM, nothing outside the swap's own changes differs from the input.
- All 36 teams swapped, with the largest CF97 art placed in the smallest BW95 slots: every team checked as home and visitor on the setup screen (art compared with video memory), plus pregame and in-game screens, including 36-tile helmets and 16-character names.
- The menu, end zone, helmet and celebration helpers were run on their own in a 68000 emulator (every team; for the celebration: home win, visitor win and an unswapped team).
- Celebration: test ROMs that play it at the title screen show "GO TEAM!" in Tulane's and Idaho's colors, Penn State's own "PENN STATE #1" unchanged, and the same on a Rebalanced ROM.
- ROMs downloaded from the app are byte-identical to the CLI builds above.

Not tested in a real game: a full season through the bowls with swapped teams (the celebration was only forced at the title screen), and real hardware.

## Development

```sh
npm install
npm run dev      # local dev server
npm run build    # type-check and build to dist/
```

The app is a static site (Vite + React + TypeScript), so it deploys to Vercel as-is: import the repo and keep the detected Vite settings (build `npm run build`, output `dist`).

The 68000 helpers are in `asm/`; `asm/build.sh` reassembles them into `src/core/helpers68k.ts` (needs `binutils-m68k-linux-gnu`).

A Node CLI builds ROMs with the same code, which is how builds were tested in an emulator:

```sh
npx tsx cli/build.ts --bw "Bill Walsh College Football 95 (USA).md" --cf "College Football USA 97 (USA).zip" \
  --pair Pitt=Tulane --out swapped.md --save-swaps swaps.json
npx tsx cli/build.ts --bw ... --cf ... --swaps swaps.json --out swapped.md
```

## Credits

Created by JD637.
