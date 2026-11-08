# Styles: technical reference

How the Styles tool (and the style selects in Team Swap and Rosters) reads and changes the computer's offense and defense styles in Bill Walsh College Football '95. User-facing description: [README, Styles](../README.md#styles).

## Files

| File | What |
|---|---|
| `src/core/styles.ts` | Read, write and check styles; style names and hints. No DOM. |
| `src/tools/styles/StylesTool.tsx`, `teamstyles.css` | The Styles tab: all 36 teams in a table, what each style calls beside it, undo, dock. |
| `src/tools/styles/StylePicks.tsx` | The two selects, used by the Styles tab, the Team Swap edit screen and the Rosters bar. |
| `src/core/cfb27Styles.ts`, `src/tools/styles/Cfb27Reference.tsx` | The College Football 27 reference table: each team's offense style and defensive playbook, the recommended BW95 styles, name matching, and the table (search, "only teams on this ROM"). |
| `src/core/build.ts` | `SlotConfig.offense` / `defense` (optional style names); `buildRom` writes them. |
| `src/core/workRom.ts` | `editsSince` (`styles`), `workFileName` (`[Styles]`), `carryEdits` (changed styles). |
| `cli/styles.ts` | Lists or changes a ROM's styles. |
| `cli/stylestest.ts` | Tests (`npm run test:styles -- BW95 CF97 [more BW95 ROMs]`). |

## How the game picks a style

The computer's play calls come from rule lists (the rule table at `0x06106E`: 8 word offsets, rule sets and categories). A rule can test whether the offense or defense team is in a **team set**. The team set table is at `0x06106E` + its 8th word (`0x1D19`) = **`0x062D87`**: 8 sets × 8 bytes; team t is in set s when bit (t & 7) of byte `0x062D87 + 8·s + (t >> 3)` is set. Team numbers are the team table's order (`0x0028DC`: 0 Air Force … 35 Wisconsin), so styles belong to slots.

| Set | Tested by | Style |
|---|---|---|
| 0-3 | the offense call (rule set 0) and audible (rule set 2), in blocks of five: set 0, 1, 2, 3, then no team test | Option, Pro Style, Multiple, Shotgun; a team in none of them runs **Power** |
| 4 | nothing (holds Notre Dame) | left alone |
| 5-7 | the defense call (rule set 6) and audible (rule set 8) | 3-4, 4-3, Multiple |

- A team in two offense sets would get the lower one (rule order); the tool always leaves at most one. The defense call tests set 5, then 6; anything else is Multiple. The original game has every team in exactly one of sets 5-7 (the audible also tested set 7 before Elevated beta.7), so the tool always sets exactly one.
- Each offense style has five situation lists (normal downs, short yardage, passing downs, hurry-up, running out the clock); the formations in the README's table are everything those lists call. Since Elevated v1.1.0-beta.6 the Option and Power lists also hold the Veer plays (the tool shows Veer when `0x079AAE` holds a `jmp`, Elevated's jump to its own offense lists; the original code there is `ext.w d0 ; lea $6106E,a0`).
- Elevated beta.7 reworked the defense rules (3-4 and 4-3 with some 4-4 against the run, Multiple as a 3-4/4-3 mix) but still reads the same sets; the tool recognizes beta.7+ by its roster labels (`DT1` in the 4-3 label list at `0x62E6E`).

## What a style change writes

`writeStyle(rom, team, {offense, defense})`:

1. Checks the ROM (`styleProblems`): the rule table's 8th word must still point at `0x062D87`, and every set's bits for team numbers 36-63 must be clear (they're unused in the original game and in every Elevated build up to beta.11). Otherwise nothing is written and the app says why.
2. Sets the team's bit in its offense set and clears it in the other three (all four clear for Power); sets it in its defense set and clears it in the other two. Set 4 isn't touched.
3. On the original roster layout only (not Elevated beta.7+): sets the team's bit in the **3-4 roster flags** (`0x061068`, one bit per team, clear = 3-4) to match the defense, as the original game has it (clear for exactly the set 5 teams). The flag only changes the roster screen's labels and which slots the Rosters import fills: slot 21 is a tackle (RDT) in the 4-3 and an inside linebacker (RILB) in the 3-4. The roster itself isn't changed.

No free space is used. The callers fix the checksums when saving.

`restoreStyle(rom, base, team)` copies a team's bits (all 8 sets and its 3-4 flag) back from the loaded bytes (the tab's Undo).

## Where styles are edited

- **Team Swap:** each swapped team's edit screen has the two selects, defaulting to the slot's own styles (marked with the original team's name). A changed select stores both style names in the slot's `SlotConfig` (`"offense": "Pro Style", "defense": "4-3"`), so they go into swap files. Swap files without them still load, and leave the slot's styles. `buildRom` writes them after the team blocks.
- **Styles tab:** the working ROM's 36 teams in alphabetical order, with Undo per team and for all. Writes straight into the working ROM.
- **Rosters tab:** the selects in the team bar, for the team on screen. On the original layout the 3-4 flags are re-read on every render (`refreshThreeFour`), so a change in either tab relabels the grid.

## College Football 27 reference

`CFB27_TEAMS` holds the 138 FBS teams of College Football 27 as of November 2026: school, conference, offense style and default defensive playbook (collected from community sites; where they disagreed, the more reliable one's playbook was kept). Recommendations:

- **Offense** (`OFFENSE_FOR`): Option → Option (only the service academies); Pro Style and Multiple → Pro Style (CFB 27's Multiple offenses are balanced and often under center); Power Spread and Spread Option → Multiple (BW95's Multiple adds Shotgun and Trap to Pro Style); Spread, Air Raid, Run & Shoot, Veer & Shoot → Shotgun; Pistol → Power. Totals: Shotgun 78, Multiple 31, Pro Style 22, Power 4, Option 3.
- **Defense** (`defenseFor`): by the playbook's down linemen. Three (3-4, 3-3-5, 3-2-6) → 3-4; four (4-3, 4-2-5) → 4-3; Multiple → Multiple. Totals: 4-3 63, 3-4 58, Multiple 17.

`findCfb27(school)` matches a ROM's school name (case, periods and apostrophes ignored) directly or through an alias table for BW95's and CF97's own spellings (Pitt, Miami, USMA, Brigham Young, Central Florida, CMU, EMU, Kent, Miami of Ohio, Mississippi St., New Mexico St., NIU, N.C. State, Northeast LA., USL, Washington St., WMU). Every original BW95 team matches; of CF97's 111, all but Idaho (not in College Football 27). An edited school name that matches nothing simply gets no recommendation.

**Apply recommended styles** writes `writeStyle` for each matched team whose style differs, and reports the teams with no match. It's an ordinary style edit: Undo and the working ROM's carrying treat it like any other.

## Carrying style edits

`carryEdits(old, new, oldBase)` carries the style of every team whose style differs between `oldBase` (the working ROM as loaded) and `old`. Team Swap results can set styles themselves, so a team whose style wasn't edited in the Styles or Rosters tab keeps the new result's. Without `oldBase` (the CLI and tests), every team whose style differs is carried.

## Tests

`npm run test:styles -- BW95 CF97 [more BW95 ROMs]` (10 tests): the original ROM reads as documented (5 offense and 3 defense styles, the 3-4 flags match set 5); on every ROM given, every style on every team reads back with one offense set at most and exactly one defense set, leaves the other teams and set 4 alone, changes only the table (and the flags on the original layout, never on Elevated), and `restoreStyle` gives back the input exactly; damaged and moved tables are refused; style names parse; Rosters labels follow the defense; Team Swap without styles is byte-identical, with styles only the style bytes and checksums change; swap files round-trip; the working ROM tracks, names and carries style edits; the College Football 27 table gives the totals above, only Air Force, Army and Navy are Option, every BW95 name and every CF97 name but Idaho matches (no two CF97 names on one team), and spot checks (USMA = Option + Multiple, Iowa = Pro Style + 4-3, Michigan = Multiple + 4-3, Texas = Shotgun + 3-4).

Emulator check (stable-retro, Genesis Plus GX): the title screen runs demo games, computer against computer, so `cli/styles.ts` made test ROMs where all 36 teams have one style (any matchup then tests it), and `$DC84` (offense play) and `$DC8E` (defense play) were logged each time they changed over 400,000 frames (about 275 calls, three matchups per ROM). Play numbers map to formations as in the play-call pages (offense 0-7 Wishbone, 8-15 Flexbone, 16-23 Trap, 24-31 I-Form, 32-39 Veer, 40-47 Tee, 48-59 Pro Form, 60-67 Shotgun, 68-79 Near, 80-87 Far, 88-95 Goal Line; Elevated's new plays 100-167 by the same formation order; defense 0-7 4-4, 8-19 4-3, 20-31 3-4, 36-43 Nickel, 44-51 Dime, 52-59 Goal Line).

| ROM, every team | Offense calls (scrimmage) | Defense calls |
|---|---|---|
| original, Option + 4-3 | Wishbone 113, Flexbone 89, Goal Line 18 | 4-3 162, Nickel 32, Goal Line 25, Dime 1 |
| original, Shotgun + 3-4 | Near 61, Pro Form 52, Shotgun 39, I-Form 32, Far 27, Goal Line 6 | 3-4 160, Nickel 42, Goal Line 13, Dime 3 |
| Elevated beta.11, Option + Multiple | Veer 71, Wishbone 67, Flexbone 57, Goal Line 11 | 4-3 77, 3-4 69, Nickel 27, Goal Line 19, Dime 7, 4-4 6 |

Matchups included Notre Dame at Florida State, Florida State and Oklahoma, Air Force and Boston College (original), Auburn and Arizona, Georgia and USC, Clemson and BYU, North Carolina and California. No call fell outside its style. In the original game these teams run other styles (for example Notre Dame Power, with Trap and Tee, and a 3-4; Florida State Pro Style and a 4-3).

Browser (Playwright on `vite preview`): Pitt → Tulane with Option and 3-4 in the edit screen downloads the same bytes as `cli/build.ts --pair Pitt=Tulane --style Pitt=Option,3-4`; the swap file holds the styles and loads back; on that result, Oklahoma changed in the Styles tab and Florida State's defense in the Rosters bar (the grid's slot 21 label turns from RDT to RILB) download the same bytes as `cli/styles.ts`; after adding Wisconsin → Idaho and keeping the edits, the download equals the new swap with the two changes; Undo; Elevated beta.11 shows Veer in the Option and Power hints; CF97 gets a message; phone layout; no console errors.

Apply recommended styles in the browser: on the original ROM (28 teams changed) and on a Pitt → Tulane Team Swap result (29), the downloads equal applying `findCfb27` + `writeStyle` in Node; pressing it again reports nothing to change; beta.11 (28); no source names in the page; phone layout (the shared ROM card now drops to one column under 900 px, and long file names wrap).

Not tested: real hardware.
