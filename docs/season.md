# Season tool: technical reference

How the Season tab reads and writes Bill Walsh College Football '95's conferences and season schedules. User-facing docs are in the [README](../README.md#season). All addresses are for the original USA ROM; Elevated (v1.0 to v1.1.0-beta.11) and Team Swap leave every one of them unchanged.

## Code

| File | What |
|---|---|
| `src/core/season.ts` | Reading, the edit operations, writing, checks, the season file |
| `src/tools/season/SeasonTool.tsx`, `season.css` | The tab |
| `src/tools/shared/WorkRom.tsx`, `src/core/workRom.ts` | The working ROM shared with the Rosters tab (below) |
| `cli/season.ts` | Applies a JSON spec to a ROM; prints the locked teams' schedules (used for the emulator checks) |
| `cli/seasontest.ts` | Tests (`npm run test:season -- BW95 CF97 [more BW95 ROMs]`) |

## How the game builds a season

- **Conferences.** Each team's conference (0-3) is the word at +6 of its 4-word ratings group: team block (pointer table `0x0028DC`) + header word [3], then +6. Stock sizes 10, 10, 8, 8:
  - 0 Southern: Alabama, Auburn, Clemson, Florida, Florida State, Georgia, LSU, Miami, North Carolina, Tennessee
  - 1 Mid Western: Colorado, Kansas State, Louisville, Michigan, Nebraska, Ohio State, Oklahoma, Texas, Texas A&M, Wisconsin
  - 2 Far Western: Air Force, Arizona, BYU, California, Stanford, USC, Washington, Washington State
  - 3 Eastern: Army, Boston College, Navy, Notre Dame, Penn State, Pitt, Virginia, West Virginia
- **Names.** A list of length-prefixed strings at `0x0DF6D0` (read by `lea $DF6D0` at `0x06A310`): "All Conferences", then the four names, each a length word `0x0018` and 22 characters, centered with spaces (length words at `0x0DF6E8`, `0x0DF700`, `0x0DF718`, `0x0DF730`).
- **Template.** `0x0E0004`-`0x0E0243`: 16 weeks × 36 bytes. Each week is 18 games as pairs of places (slots) 0-35, **visitor first, home second** (`0x06A178` copies the first team of a pair into the visitor word of the game list at `$E3AE` and the second into the home word). Every place appears once a week, so every team plays every week. Weeks 1-12 have 10-13 in-conference games each, weeks 13-16 none.
- **Deal** (`0x071808`, called from `0x0717EA` whenever a season is set up or loaded):
  - The season's random seed is loaded from SRAM `0x20038F` into `$DCF8` (random routine `0x0704E2`: returns 0…n−1 for d0 = n; 0 for n = 1), so a saved season always gets the same deal again. After the deal the seed is reset from the video counter.
  - `$C436` (36 places) is filled with `$FF`, then for each team 35…0 (`dbra d2` at `0x071852`): conference c → {first, count} from the word table at `0x0718DC` = {0,10}, {10,10}, {20,8}, {28,8}; a random place `first + random(count)` is tried until an empty one turns up, and the team is stored there.
  - A conference with more teams than places would loop forever; one with fewer would leave a place empty.
- **Season games** (`0x071856`): (1 + SRAM `0x200399`) weeks × 36 are copied from the template to `$CCAE` as `00, team` per place. SRAM `0x200399` = Weeks − 1 (Game Setup's Weeks row, `$E5D7`, 0-15, default 11). 16 more entries follow from SRAM `0x20036F` (postseason).
- **Who reads the conference word:** the deal (`0x071830`), the rankings screen filter (`0x06A342`, `$C3FC` = selected conference, −1 = all; the list scrolls, so any size shows), and the bowl picker (`0x07166A`).
- **Bowls** (`0x071600`, Bowl Games mode, after the last regular week): teams are sorted by ranking; for each conference 3…0 the best-ranked team, skipping the #2 team overall, gets a bowl; if it is #1, its opponent is #2; the other bowls get the best remaining teams. A conference without a team other than #2 would make the search run past the end of the list, so **every conference needs at least 2 teams**. Playoffs mode uses the rankings only.

## What the tool writes

| Area | What | When |
|---|---|---|
| `0x0DF6EA`-`0x0DF747` | the four names (text only; length words kept) | always (unchanged names write the same bytes) |
| team blocks, ratings group +6 | each team's conference | always |
| `0x0E0004`-`0x0E0243` | the template, relabeled (below) | always |
| `0x0718DC`-`0x0718EB` | {first, count} of each conference's random places | always |
| `0x07182A`-`0x071851` | deal loop body: stock, or the lock version (below) | lock version only with locked teams; the stock bytes are put back when none are left |
| `0x1EFF40`-`0x1EFF87` | per-team {first place, count} bytes | only with locked teams; filled with `$FF` again when none are left |
| Walsh Report text | the one mention of a conference ("Southern Conference", Air Force's offense paragraph), renamed if the new name fits in that paragraph (padding spaces before its CR) | when a name changes |
| `0x18E`, `0x1E6430` | checksums | always |

An unchanged setup writes back byte-identical.

### Relabeling

The editor keeps the template's own place numbers. On writing, places are renumbered so that conference 0's random places come first, then 1, 2 and 3, then the locked places; the {first, count} table then describes each conference's random places as one range. With no locked teams and the stock sizes this is the identity.

### The lock loop

Replaces the 40 bytes between `moveq #$23,d2 ; lea $296C.w,a0` and the stock `dbra d2,$07182A`:

```
07182A  3202            move.w  d2,d1              ; team
07182C  D241            add.w   d1,d1
07182E  43F9 001E FF40  lea     $1EFF40.l,a1       ; per-team {first, count}
071834  7000            moveq   #0,d0
071836  1031 1001       move.b  1(a1,d1.w),d0      ; count
07183A  6100 ECA6       bsr.w   $0704E2            ; random 0..count-1
07183E  D031 1000       add.b   (a1,d1.w),d0       ; + first
071842  4A32 0000       tst.b   (a2,d0.w)          ; place taken?
071846  6AEC            bpl.s   $071834
071848  1582 0000       move.b  d2,(a2,d0.w)
07184C  4E71 4E71 4E71  nop × 3
```

A locked team's entry is {its place, 1}; every other team gets its conference's {first, count}. Locked places lie outside every conference range, so a random team never takes one, and `random(1)` is always 0. The conference table at `0x0718DC` isn't read in this mode; it still holds the random ranges, which is how reading tells a conference's only random team ({place, 1} inside its range) from a locked team.

### Reading

`readSeason` refuses a ROM whose deal loop is neither the stock nor the lock version, whose names don't have the `0x0018` length words, whose template weeks aren't each a full set of 36 places, or whose tables don't add up. `seasonWriteProblems` also refuses to lock teams if `0x1EFF40`-`0x1EFF87` holds anything but `$FF` and isn't the tool's own table.

## The edit model

`Season` = names, each team's conference, the locked team (or none) of each place, the conference of each random place, and the 16 template weeks. The editor works in place space; the UI shows each locked team's games in team space (`teamGames`).

- **Lock a team:** it takes one of its conference's random places, the one the fewest locked teams play (each such game would become a game against this team).
- **Unlock:** its place becomes a random place of its conference.
- **Set a game** (team X, week w, opponent Y): Y gets locked if it isn't (preferring the place X already plays that week). Then X's place and Y's place are paired in week w: X keeps its side (home or away), Y takes the side of X's old opponent, and the two old opponents play each other. **Any team from conference C** pairs X with a random place of C (preferring one whose opponent that week is also random). Every locked team's game that changes besides the edit itself is listed to the user.
- **Home/away:** swaps the pair's order.
- **Move a team:** a locked team keeps its place; a random team moves one random place from its old conference to the new one. Each conference keeps at least 2 teams.
- Every operation keeps each week a full set of games and each conference's random places equal to its random teams.

## The shared working ROM

Season, Teams and Rosters edit one buffer in place (`useWorkRom` in `src/tools/shared/WorkRom.tsx`). The Season tab writes its whole setup into it after every valid edit (`writeSeason` is cheap); Teams writes the team set table and the 3-4 roster flags ([docs/styles.md](styles.md)) and each team's ratings, home weather and Elevated's OVR table ([docs/teams.md](teams.md)); Rosters writes roster records and the OL tweak. They never touch the same bytes. Each tab's Download fixes the checksums on a copy and names the file after the ROM, with `[Season]`, `[Teams]` and/or `[Rosters]` for whatever changed since loading (`editsSince`, `workFileName` in `src/core/workRom.ts`). While a conference has no name, the Season tab blocks downloads from every tab.

When another ROM comes in (a file or the Team Swap result) and the working ROM has changes, the card asks. **Keep my edits** runs `carryEdits(old, new, oldBase)`: every team's roster record by slot, the OL tweak if the old ROM had it, `writeSeason(new, readSeason(old))`, and the style of every team whose style changed since the old ROM was loaded (Team Swap can set styles itself, so unchanged ones keep the new ROM's). Team Swap keeps rosters and conferences per slot, so this matches what the swap does with the original's data. Only offered for the same game.

## Season file

```json
{ "app": "genesis-cfb-toolkit", "tool": "season", "version": 1, "teams": ["Air Force", …], "season": { "names": […], "conf": […], "slotTeam": […], "slotConf": […], "weeks": [[…], …] } }
```

`teams` (the ROM's team names when saved) is only for the record; teams are stored by slot. `seasonFromFile` checks the app, tool and version, the shape of every array, that each week is a full set of places, and that the setup holds together.

## Tests

`npm run test:season -- BW95 CF97 [more BW95 ROMs]` (10 tests): the stock setup; unchanged writes byte-identical (also on extra ROMs); set games, home/away and "any team" with a round trip; moving teams, renaming, the 2-team minimum, name rules and the Walsh mention; lock all and unlock all (code and table restored); 4,000 random edits with write/read round trips; season files; refusing foreign code or data; Team Swap before or after and the Rosters OL hook next to the table; the working ROM (edits per tool, download names, carrying edits to a new Team Swap result by slot).

Emulator checks (stable-retro, Genesis Plus GX; `cli/season.ts` writes the expected schedule): New Season with Weeks 16, then the game list at `$CCAE` was compared with the app's schedule. The place → team deal was recovered from the template and checked against each team's range in the ROM. Four ROMs passed: four locked teams, all 36 locked, all but one locked, and random with moved conferences. The same checks passed on Elevated v1.1.0-beta.11 and on a beta.11 Team Swap result. The rankings screen showed the new names.

Not verified: playing through an edited season (the emulator has no battery save, so a season stops at "Saving Season Games"), bowls with other conference sizes (from the code only), real hardware.

## The 138-team 2026 Season Edition

Elevated v2.0.0's 2026 Season Edition (4 MB, 138 teams) runs its own season engine (12 regular weeks, Random or Real 2026 schedules, conference title games, a 4-, 12- or 24-team playoff or none). Its Season tab is `src/tools/season/SeasonWide.tsx` on `src/core/seasonWide.ts`; the 36-team code above isn't used on it.

What the engine takes from the ROM, and what the tab edits:

| What | Where | Read |
|---|---|---|
| Each team's conference | ratings group word +6: 0-9 the ten conferences, 10 Independents (values over 10 count as 10) | New Season (`CONFTAB`), standings, title games |
| Conference names | 12 strings of 22 characters, centered, each with its length word (`0x0018`): "Top 25", then the 11 conferences | the Rankings screen's titles; found through `lea CONFNAMES(pc),a1` at `0x211D40` |
| First conference week (0-based) | 11 bytes (the Independents' entry is 99) | New Season, random schedule; `lea CWS(pc),a0` at `0x211576` |
| Conference games | 11 bytes (Independents 0) | the same; `lea CWN(pc),a0` at `0x2115B2` |

- **Random schedule:** each conference's teams are shuffled, then in week `start + k` (for k below the conference games) round k of a circle-method round robin is played; a conference of n teams has n - 1 rounds (n rounded up to even, so an odd conference has a bye team each round). Every team without a conference game that week is paired at random, another conference first, then someone it hasn't played, then anyone. The engine keeps at most 24 teams a conference (`W_CM`, 24 bytes each). Independents never play conference games.
- **Title games and playoff:** after week 12 the top two of each of the ten conferences by conference record meet (`TITLESET`), so each needs at least 2 teams. The first four title games' winners are the Power 4 champions (automatic bids); the best-ranked of the other six winners gets the Group of 6 bid. Notre Dame's CFP 12 rule goes by team, not conference.
- **Real 2026 schedule:** a fixed game table; the conferences only decide which games count as conference games, the standings and the title games.
- **Checks before writing** (`wideSeasonProblems`): the layout of `src/core/wide.ts`, the three `lea`s and what they point at (12 length words of 24, "Top 25" first, the Independents' 99 and 0, start below 12 and games at most 24), every team's conference 0-10. **Settings** (`wideSeasonIssues`): names 1-22 characters of `A-Z a-z 0-9 space - . & '`, each of the ten conferences 2-24 teams, first week 1-12 and the games within week 12. The app shows the games the engine will actually play (`playedGames`: at most one round robin).
- **Writing:** names centered in 22 (as the release has them), the group words, the two week tables, all in place; writing the loaded settings back gives the same bytes. `wideSeasonRanges` lists the bytes for `editsSince` (a Season edit) and Undo; `carryEdits` carries the settings to another 138-team ROM.
- **Tests:** `npm run test:season -- BW95 CF97 [more BW95]` with the 138-team ROM among the extra ROMs: the release's names, sizes (16, 18, 17, 16, 14, 14, 13, 10, 10, 8, 2) and weeks; an unchanged write gives the same bytes; renames (centered), moves and week changes read back, change only those bytes, are a Season edit, carry and undo byte for byte; too few or too many teams, weeks past 12, long or unsupported names and empty names are refused with nothing written.
- **Emulator** (Genesis Plus GX, from boot): Tulane moved to a renamed SEC (6 games from week 2), Notre Dame to the Big Ten (11 games from week 1), the PAC 12 renamed "Old Pac & Co.": a Random New Season gives Tulane SEC games from week 2 and Notre Dame Big Ten games in weeks 1-11, the Rankings screen shows every new name, and the season plays through week 12, the title games and the CFP to the championship.

