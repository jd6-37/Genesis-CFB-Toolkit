# Teams tab: ratings and home weather

How the Teams tab (and the matching fields in Team Swap and the Rosters CFB 27 conversion) reads and changes each Bill Walsh College Football '95 team's OFF and DEF ratings and home weather. The tab's style selects are in [docs/styles.md](styles.md). User-facing description: [README, Teams](../README.md#teams).

## Files

| File | What |
|---|---|
| `src/core/teamRatings.ts` | Reading and writing the ratings group and Elevated's OVR table, the OVR ↔ sim-word line, weather words, the CFB 27 starter OVR. Pure functions. |
| `src/tools/styles/TeamsTool.tsx`, `teamstyles.css` | The Teams tab: 36 teams with styles, OFF, DEF and four weather weights; legend; undo; dock. |
| `src/tools/styles/RatingPicks.tsx` | The OVR and weather fields: Team Swap edit screen (`full`) and Teams tab (`table`). |
| `src/core/build.ts` | `SlotConfig.ovr` / `weather`; `defaultSlot` fills them from the CF97 team; `buildRom` writes them. |
| `src/core/cf97.ts` | `CfTeam.weather`, `offense`, `defense`: CF97's record group (header word 2). |
| `src/core/rosterCfb27.ts` | `Cfb27Team.ovr`: the starter OVR of each converted team. |
| `src/core/cfb27Latest.ts`, `public/data/ea-cfb27-ratings-2026-week9.csv` | The built-in College Football 27 ratings (Rosters tab button). |
| `src/core/workRom.ts` | `editsSince` (`teams`: styles, ratings, weather), `workFileName` (`[Teams]`), `carryEdits` (changed ones by slot). |
| `cli/teams.ts`, `cli/teamstest.ts` | CLI and tests. |

## In the ROM

Each team block (pointer table `0x0028DC`) has a 4-word group at the block + header word 3. Team Swap keeps it with the slot.

| Offset | What | Read by |
|---|---|---|
| +0 | Home weather: one nibble per kind, high to low Fair, Windy, Rain, Snow (weights) | `0x067C6C`, season games: the home team's word → the weather (`0x0711D4` picks by weight; a sum of 0 is Fair) |
| +2 | Offense rating, 0-100 | the season sim (`0x06F0F2`) and the preseason poll (`0x06A66C`) |
| +4 | Defense rating, 0-100 | the same |
| +6 | Conference | the Season tool |

- **Sim:** per scoring chance d3 = 150 − (opponent's word) + (own word); the original game reads them crosswise (own defense against the opponent's offense), Elevated v1.1.0 the right way (offense against defense). **Poll:** (random(25) + offense + defense) × 4.
- **Elevated v1.1.0's OVR table** at `0x10DFB0`: "OVR1", then 36 × {OFF, DEF} bytes by slot. Its Game Setup code shows those bytes under each team (without the table, the words). The app writes the table only when the magic is there; it never adds one (on other ROMs that space isn't free).
- **The line between them:** word = round((OVR − 62) × 100 / 36), clamped to 0-100; OVR = round(62 + word × 36 / 100). OVR 62 → 0, 98 → 100, about the original game's spread, so a sim with OVRs that sit close together stays as lopsided as the original. Without the table the app shows the OVR the word stands for, so only 62-98 round-trip.
- **CF97** has the same group (record + header word 2): +0 weather, +2 offense, +4 defense (its 1996 ratings, same 0-100 scale), +6 its own conference numbering. Team Swap's default for a swapped team: OVR = the line applied to CF97's words; weather = CF97's word.

## College Football 27 starters → OVR

The method the Elevated 2026 Season Edition used (`claude/tools/teamratings.mts` in the mod's notes; the test checks that the app gives that ROM's numbers for all 36 teams): per team, the best Overall at each starting position, OFF = QB, HB, 3 WR, TE, LT, LG, C, RG, RT and DEF = LE, RE, 2 DT, LOLB, MLB, ROLB, 2 CB, FS, SS (fewer if the team has fewer), OVR = clamp(round(65 + 3 × (mean − 77)), 0, 99). The CFB 27 conversion computes it for every converted team from the same players (`starterOvr`), and writes it when **Set each team's OFF and DEF** is ticked (default; `--no-ratings` in `cli/cfb27.ts` turns it off).

## Built-in College Football 27 ratings

`public/data/ea-cfb27-ratings-2026-week9.csv` is EA's ratings export as of Week 9 of the 2026 season (SHA-1 1d6ba079…, the file the Elevated 2026 Season Edition was built with). Vite copies it to the site as a static file, and the Rosters tab fetches it only when its button is used. To update: add the newer file, point `CFB27_LATEST` at it, and change the README's "2026 season, Week 9" mentions.

## The 138-team 2026 Season Edition

Elevated v2.0.0's 2026 Season Edition (4 MB, 138 teams; layout checked by `src/core/wide.ts`) keeps the same group in every team block, so ratings and weather are read and written the same way for all 138. Its OVR table is at `0x218000` ("OVR1", then 138 × {OFF, DEF}); `teamRatings.ts` writes that one. The ROM still has a stale 36-entry "OVR1" table at `0x10DFB0` from the 36-team edition, which nothing reads and the app leaves alone. Styles: [docs/styles.md](styles.md#the-138-team-2026-season-edition). Walsh Reports: [docs/walsh.md](walsh.md#the-138-team-2026-season-edition).

## Undo, tracking, carrying

- Undo puts back the group's first 6 bytes and the team's table bytes from the ROM as loaded (`restoreTeam`), along with its styles.
- `editsSince` counts a change in any team's first 6 group bytes or in the table as a Teams edit (`[Teams]` in the file name; files named `[Styles]` by earlier versions are recognized).
- `carryEdits(from, to, fromBase)` writes the teams whose ratings or weather changed since loading into the new ROM by slot (`readRating` → `writeRating`, `readWeather` → `writeWeather`), so a new Team Swap result keeps edits made for other slots and its own defaults for the swapped ones. A 138-team ROM's edits carry only into another 138-team ROM.

## Tests

`npm run test:teams -- BW95 CF97 ELEVATED ELEVATED_2026 [ELEVATED_2026_138]` (8 tests; the two Elevated v1.1.0 ROMs are the original game with the release's `elevated` and `elevated-2026` patches):

- The original ROM: EA's offense and defense words (the 36 sorted values), BYU 55/0 = OVR 82/62, Washington 1-2-7-0, Wisconsin 1-1-1-7, Texas 9-1-0-0; no table.
- Writing without a table: OVR 62-98 round-trips, 50 and 99 clamp to words 0 and 100; only the group's bytes change (the conference word stays); undo; weather words and chances.
- Elevated v1.1.0: Florida State 96/98 and BYU 82/62 from the table; a change writes the table and the words only.
- The 2026 Season Edition: for all 36 teams, the built-in data's starter OVRs equal the ROM's table and its words equal the line.
- Team Swap: Tulane gets 74/75 and 9-1-0-0 by default; a swap file without `ovr` / `weather` builds the same ROM as before (the reference swap `--pair Pitt=Tulane --pair Wisconsin=Idaho --pair 0=Oregon` saved and stripped: a6965f72, the SHA-1 from before this change; with the new defaults it's 35f8e48e, which differs only in the three groups and the checksums); edited values are kept; on Elevated the table gets the exact OVR.
- The CFB 27 conversion's OVRs are written and tracked as a Teams edit, and `carryEdits` with the base keeps them by slot.
- Values outside 0-100 refused.

Browser (Playwright on `vite preview`): Team Swap on Elevated v1.1.0, Pitt → Tulane with OFF 80 and Rain 3 = `cli/build.ts --swaps` with the saved swap file; then Navy's DEF 85 and Snow 4 in the Teams tab = `cli/teams.ts`; then the built-in Week 9 rosters for all 36 teams = `cli/cfb27.ts` with the built-in file. Emulator: that ROM's Game Setup shows "OFF 80 DEF 75" under Tulane.
- With the optional 138-team 2026 Season Edition: all 138 teams read; each matches a College Football 27 team and has the styles recommended for it (the release set them that way); a style, OFF/DEF, weather and Walsh Report edit change only the style table, the groups, the OVR table at `0x218000` and the Walsh text and its table (the old table at `0x10DFB0` untouched); the edit is a Teams edit, carries into a fresh copy byte for byte and Undo puts every byte back; the unchanged text written back gives the same bytes; 650 characters for every one of the 138 teams fits.
