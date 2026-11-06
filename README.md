# Genesis CFB Toolkit

Browser-based modding tools for EA's college football games on the Sega Genesis: Bill Walsh College Football '95, College Football USA 96 and College Football USA 97.

Everything runs in your browser. Your ROMs are opened on your own computer and are never uploaded anywhere. The app contains no ROM data or artwork; you bring your own ROMs.

## Tools

- **[Team Swap](#team-swap):** swap College Football USA 97 teams into Bill Walsh College Football '95.
- **[Rosters](#rosters):** edit the players of Bill Walsh '95, CF96 or CF97, team by team or from a spreadsheet (CSV or Excel).

Each tool has its own tab. `#rosters` at the end of the address opens the Rosters tab directly.

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
- Rosters (edit them in the [Rosters](#rosters) tab, which can open the swapped ROM directly).
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

## Rosters

Load a Bill Walsh College Football '95, College Football USA 96 or College Football USA 97 ROM, pick a team, and change its players' jersey numbers and ratings, or import a spreadsheet for many teams at once. Then download the ROM. Original and modified ROMs both work (Rebalanced, Team Swap output, an earlier roster edit, a ROM saved by CFB-Walsh.exe). **Use the Team Swap result** opens the ROM you set up in the Team Swap tab, so swaps and roster edits end up in one file.

Players in these games have no names, only numbers. Each rating is a step from 0 to 15, which the game's roster screen shows as 0, 6, 13 … 93, 100; weight goes in 16 lb steps from 140 to 380. The editor shows the same numbers as the game.

### Spreadsheet import

One row per player, all teams in one sheet, as `.csv` (comma, semicolon or tab) or `.xlsx` (first worksheet).

| Column | Used for |
|---|---|
| Team | School ("Texas"), school and nickname ("Texas Longhorns"), or the names CFB-Walsh.exe used |
| Position | QB, HB, FB, LT, LG, C, RG, RT, WR, TE, K, P, LE, DT, RE, LOLB, MLB, ROLB, CB, SS, FS (RB and ILB also work) |
| Overall Rating | Who starts: the best players of a position fill its slots first |
| Jersey Number | 0-99 |
| Weight | In lb |
| Speed, Quickness, Awareness, Power, Blocking, Tackling | 0-99 |
| Catching | Hands |
| Throw Power | QB range |
| Kick Power, Kick Accuracy | Kicker and punter range and accuracy |
| Name, or First Name and Last Name | Optional, shown in the import report |

- A 0-99 value goes to the step at or below it (88 → 86, the step the game shows as 86). Weights the same way (245 lb → 236).
- Slots: BW95 has 32 players per team (QB, HB1-2, FB, five linemen, SE, FL, WR1-2, TE1-2, K, P, 4-3 or 3-4 front, PLB, four CBs, SS, FS, FS2). The four best WRs fill SE, FL, WR1 and WR2. On 3-4 teams the best DT is the NT and the MLBs fill LILB and RILB. The PLB is the best outside linebacker left over. CF96/97 have 45 players per team (two QBs, three HBs, backups at most positions).
- Slots nobody fills keep their current player, and empty cells keep the current value.
- The report lists teams, positions and columns it didn't use, and who went to which slot.

### CSV export

**Export team CSV** and **Export all teams CSV** write the same columns plus **Slot** (QB, HB1, LDE …), with the values the game shows. Edit the file and import it again: rows with a Slot go to that exact slot, so an unchanged export imports back without changing a byte.

### How it works

- **Rosters:** each team's roster is in its team block (BW95 table `0x0028DC`, CF96/97 table `0x002CEA`): 32 players × 4 bytes in BW95, 45 × 5 bytes in CF96/97. Byte 0 is the jersey number (BCD), then six 4-bit ratings; the order depends on the position (for example QB: weight, quickness, speed, awareness, range, power). The fifth CF byte is kept as it is.
- **3-4 teams (BW95):** a bitfield at `0x061068` (bit clear = 3-4) picks the roster screen's labels. The editor and the import read it from the ROM.
- **Checksums:** all three games check a sum of the ROM at boot against a stored value (BW95 `0x1E6430`, CF96 `0x1B5F00`, CF97 `0x1EF580`); with a wrong value, CF97 stays on a black screen. The download recomputes it and the Genesis header checksum. ROMs where that check was turned off (as CFB-Walsh.exe does) get it turned back on.

### Compared with CFB-Walsh.exe

The import follows the rules of CFB-Walsh.exe ("Genesis College Football Editor v2.0"), with these fixes:

- Checksums are recomputed instead of the boot check being turned off.
- Washington (BW95) is a 3-4 team in the game; the exe treated it as 4-3.
- CF97 Virginia Tech's roster is read from the right place (the exe's address for it was 100 bytes off).
- CF96/97 RDT and DT2 stay where they are (the exe swapped them every time it saved).
- Teams are found through the game's team table, so swapped teams work.
- The leftover slots (PLB; CF96/97 T2, G2, DE2, LB2) get the best remaining player by Overall Rating.

### Testing

- Export → import of every team leaves all three ROMs byte-identical.
- Imports checked on BW95's roster screen in an emulator: numbers, ratings and weights show as expected, on a 4-3 team, a 3-4 team (NT, LILB, RILB) and a team-swapped Tulane. Unfilled slots keep their players.
- Edited CF96 and CF97 ROMs boot (with a wrong checksum CF97 stays on a black screen).
- ROMs downloaded from the app are byte-identical to the same edits made with the code in Node; a Team Swap result with roster edits differs from the plain swap only in the edited players and the checksums.

## Development

```sh
npm install
npm run dev      # local dev server
npm run build    # type-check and build to dist/
```

The app is a static site (Vite + React + TypeScript), so it deploys to Vercel as-is: import the repo and keep the detected Vite settings (build `npm run build`, output `dist`).

Roster engine tests need your own ROMs (`.md`, `.bin`, `.gen` or `.zip`):

```sh
npm run test:rosters -- BW95.md CF96.md CF97.md
```

The 68000 helpers are in `asm/`; `asm/build.sh` reassembles them into `src/core/helpers68k.ts` (needs `binutils-m68k-linux-gnu`).

A Node CLI builds ROMs with the same code, which is how builds were tested in an emulator:

```sh
npx tsx cli/build.ts --bw "Bill Walsh College Football 95 (USA).md" --cf "College Football USA 97 (USA).zip" \
  --pair Pitt=Tulane --out swapped.md --save-swaps swaps.json
npx tsx cli/build.ts --bw ... --cf ... --swaps swaps.json --out swapped.md
```

## Credits

Created by JD637.
