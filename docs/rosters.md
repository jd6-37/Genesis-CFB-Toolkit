# Rosters: technical reference

Developer notes for the Rosters tool. The user-facing docs are in the [README](../README.md#rosters).

## Code

| File | What |
|---|---|
| `src/core/rosterLayouts.ts` | Games, slot layouts, rating order per position group, scales |
| `src/core/rosterRom.ts` | Open a ROM (game by header, teams from the team table), read/write players, checksums |
| `src/core/rosterSheet.ts` | CSV reader (comma, semicolon, tab; UTF-8 or Windows-1252) and XLSX reader (first sheet; own zip + XML parsing), CSV writer |
| `src/core/rosterImport.ts` | Picks the import path (`detectImport`), Slot and ranked imports, import report |
| `src/core/rosterCfb27.ts` | CFB 27 → BW95 conversion (distribution matching) |
| `src/core/rosterStockDists.json` | Stock rating distributions of BW95, CF96 and CF97 (counts per role, rating and step), built by `cli/stockdists.ts` |
| `src/core/rosterOlPatch.ts` | BW95 OL weight display tweak |
| `src/core/rosterExport.ts` | Rosters → CSV |
| `src/core/rosterNames.ts` | The team names CFB-Walsh.exe used, so sheets made for it still match |
| `src/tools/rosters/RosterTool.tsx`, `rosters.css` | The tab: team grid, import report, help, dock. The bar above the grid has the team's offense and defense styles (BW95; `src/tools/styles/StylePicks.tsx`, [docs/styles.md](styles.md)); on the original layout a defense change sets the team's 3-4 flag and the layout is re-read (`refreshThreeFour`). The ROM card and the working ROM it edits are shared with the Season and Teams tabs (`src/tools/shared/WorkRom.tsx`, `src/core/workRom.ts`; see [docs/season.md](season.md#the-shared-working-rom)): `openRosterRom(data, true)` works on those bytes in place, and change marks and undo compare with the bytes as loaded. |
| `cli/rostertest.ts`, `cli/fixtures/` | Engine tests (`npm run test:rosters -- BW95 CF96 CF97`; paths may be zips). The fixtures and the generated CFB 27 sheets are made-up players. |
| `cli/cfb27.ts` | The CFB 27 conversion from the command line (`npx tsx cli/cfb27.ts ROM CFB27.csv OUT.md [--no-ol-tweak] [--teams "A,B"]`) |
| `cli/stockdists.ts` | Rebuilds `rosterStockDists.json` from the three stock ROMs |

`App.tsx` only adds the tabs, routes dropped files to the active tab, and passes the Team Swap build to the Rosters tool (`TeamSwapSource`: count + `build()`).

## Games

| | BW95 | CF96 | CF97 |
|---|---|---|---|
| First 16 bytes | `00FFFFF6 00000200 0007A31A 0007A31A` | `… 0006209E 0006209E` | `… 00069D7A 00069D7A` |
| Team table | `0x0028DC`, 36 teams | `0x002CEA`, 108 | `0x002CEA`, 111 (+ a placeholder) |
| Names (header word) | [2]: school, city, nickname | [1]: school, stadium, nickname | same as CF96 |
| Roster | block + header word [0], 32 × 4 bytes | record + header word [0], 45 × 5 bytes | same as CF96 |

The game is identified by its first 16 bytes, not by SHA-1, so modified ROMs work (Bill Walsh '95 Elevated, formerly Rebalanced; Team Swap output; earlier roster edits; ROMs saved by CFB-Walsh.exe). Elevated has the same header as the original.

## Player record

- Byte 0: jersey number, BCD (`0x42` = 42). Some CF96 players have bytes that aren't valid BCD; the editor shows them blank and leaves the byte alone unless it's edited.
- Bytes 1-3: six 4-bit ratings, high nibble first, in this order:

| Group | Nibble order |
|---|---|
| QB | Weight, Quickness, Speed, Awareness, Range, Power |
| RB, Receivers | Weight, Quickness, Speed, Awareness, Hands, Power |
| OL | Weight, Power, Speed, Awareness, Hands, Blocking |
| K/P | Weight, Quickness, Speed, Awareness, Range, Accuracy |
| DL | Weight, Power, Speed, Awareness, Hands, Tackling |
| LB, DB | Weight, Quickness, Speed, Awareness, Hands, Tackling |

- CF96/97 byte 4: meaning unknown (varies per player). Never written.
- What the BW95 roster screen shows for step n (checked in the game): ratings ⌊n·100/15⌋ = 0, 6, 13, 20, 26, 33, 40, 46, 53, 60, 66, 73, 80, 86, 93, 100; weight 140 + 16n lb. The screen calls Awareness "INTEL". The editor and the CSV export use these values. The CF96/97 roster screens weren't checked; the editor uses the same scale for them.

## Slots

BW95 (the game's own label lists at `0x62DC8` and `0x62E6E` have the same order):

| Slot | Pos | Slot | Pos | Slot | Pos | Slot | Pos |
|---|---|---|---|---|---|---|---|
| 0 | QB | 8 | RT | 16 | LDE | 24 | LCB1 |
| 1 | HB1 | 9 | SE | 17 | LDT / NT | 25 | LCB2 |
| 2 | HB2 | 10 | FL | 18 | RDE | 26 | RCB1 |
| 3 | FB | 11 | WR1 | 19 | LOLB | 27 | RCB2 |
| 4 | LT | 12 | WR2 | 20 | MLB / LILB | 28 | SS |
| 5 | LG | 13 | TE1 | 21 | RDT / RILB | 29 | FS |
| 6 | C | 14 | TE2 | 22 | ROLB | 30 | FS2 |
| 7 | RG | 15 | K | 23 | PLB | 31 | P |

- 4-3 / 3-4: a bitfield at `0x061068`, one bit per team (byte `t >> 3`, bit `t & 7`), **clear = 3-4**. Only the roster screen's label code reads it (`0x06B0FA`), so it changes labels (LDT/MLB/RDT vs NT/LILB/RILB) and which slots the import fills, not how the team plays. Stock 3-4 teams: Air Force, Army, Clemson, Colorado, Michigan, North Carolina, Notre Dame, Oklahoma, Texas, Texas A&M, USC, Washington, Wisconsin. A swapped team keeps its slot's bit.
- **Elevated layout** (Bill Walsh '95 Elevated from v1.1.0-beta.7): one defensive layout for every team, LE, DT1 (17), RE, LOLB, MLB1 (20), DT2 (21), ROLB, MLB2 (23). The game's 4-3 label list (`0x62E6E`-`0x62F15`) reads `DT1 … MLB1 … DT2 … MLB2` instead of `DLT … MLB … DRT … PLB`, and every team's bit is set. `openRosterRom` sets `elevated` when that list contains `DT1`; the editor then shows DT1/DT2/MLB1/MLB2 for every team and no 4-3/3-4 chip. Ranked import: DT1/DT2 ← DT and MLB1/MLB2 ← MLB, best first (no leftover PLB rule).

CF96/97: QB1 0, QB2 1, HB1-3 2-4, FB1-2 5-6, WR1-4 7-10, TE1-3 11-13, LT 14, RT 15, T2 16, LG 17, RG 18, G2 19, C 20, C2 21, LDE 22, RDE 23, DE2 24, LDT 25, RDT 26, DT2 27, LOLB 28, LILB 29, RILB 30, ROLB 31, LB2 32, LCB1 33, RCB1 34, LCB2 35, RCB2 36, SS 37, SS2 38, FS 39, FS2 40, K 41, K2 42, P 43, P2 44. The CF ROMs have no position labels as text; slots 26/27 were placed by their ratings (starters rate higher than backups, as at T2, G2, DE2 and the DBs).

## Checksums

All three games sum the ROM's longwords from 0 to an end address, subtract the long at `0x18C`, and compare with a stored constant at boot. With a wrong constant, CF97 stays on a black screen.

| Game | Summed range | Constant | Compare, then `bne` |
|---|---|---|---|
| BW95 | `0x000000`-`0x1E6413` (count in `move.l #$79905,d1`) | `0x1E6430` (`cmpi.l #imm,d0`) | `0x1E6434` |
| CF96 | `0x000000`-`0x1B5EFB` (long count at `0x1B5EFC`) | `0x1B5F00` (`cmp.l (d16,pc),d0`) | `0x1B5F78` |
| CF97 | `0x000000`-`0x1EF57B` (long count at `0x1EF57C`) | `0x1EF580` | `0x1EF5F8` |

`findEaChecksum` finds the routine by byte pattern; `fixChecksums` recomputes the constant, then the Sega header checksum (`0x18E`). CFB-Walsh.exe turns the check off by writing `nop` (`4E71`) over the `bne` (`6602`); `fixChecksums` puts the `bne` back.

## Import

`detectImport` picks one of three paths; the report says which one was used.

1. **Slot sheet** (a Slot column with values): each row goes to the slot it names. `slotSheetProblems` checks that the sheet has the export's columns and that every label belongs to **that team's layout on this ROM** (stock 4-3, stock 3-4 or Elevated), with no slot twice for a team. Accepted spellings per layout: the editor's labels, the game's (LE, RE, KICK, PUNT, FS1; DLT and DRT on 4-3 and Elevated) and, on Elevated ROMs, the stock 4-3 labels for the same slots (LDT = DT1, MLB = MLB1, RDT = DT2, PLB = MLB2). Teams the ROM doesn't have are skipped and listed. A sheet that fails the check is refused with the reasons (teams grouped by layout, with the labels that don't fit), unless it's CFB 27 data. Example: a CSV made for an Elevated ROM, imported into the stock ROM, is refused for the 13 stock 3-4 teams (LDT, RDT, MLB vs NT, LILB, RILB); before this check it put their second DT into RILB.
2. **CFB 27 ratings** (at least three columns only CFB 27 data has, such as Acceleration or Break Tackle): converted, see below. Missing conversion columns are listed and nothing is written.
3. **Ranked** (any other sheet without a Slot column): CFB-Walsh.exe's rules, below.

- Columns are matched ignoring case, spaces and punctuation. Team and Position (or Slot) are required; everything else is optional, and a missing column or empty cell keeps the current value.
- Teams: the ROM's "school nickname", the school alone, CFB-Walsh.exe's name for the slot (only while the slot still holds that school, so a swapped slot doesn't match the old team's name) and that name minus the nickname ("Pittsburgh"). Case, periods and apostrophes are ignored; "St" = "State". Names that would match two teams are dropped.
- Positions: QB HB FB LT LG C RG RT WR TE K P LE DT RE LOLB MLB ROLB CB SS FS, plus RB → HB and ILB → MLB. Others are reported and skipped.
- Ranked mode (CFB-Walsh.exe's rules): per team, primary slots in editor order each take the best unused player of their position by Overall Rating (ties and blanks keep sheet order); then the leftover slots take the best unused player of several positions: BW95 PLB ← LOLB/ROLB; CF96/97 T2 ← LT/RT, G2 ← LG/RG, DE2 ← LE/RE, LB2 ← MLB. The exe filled leftovers with the first unused player in its sort order instead.
- Field mapping: Hands ← Catching; QB Range ← Throw Power; K/P Range ← Kick Power, Accuracy ← Kick Accuracy; Weight in lb; the rest by name. Values go to the step at or below (`ratingToNibble`, `weightToNibble`, the exe's buckets).
- Weights are what the roster screen shows: with the OL weight tweak installed (below), OL rows lose 25 lb before bucketing, in both Slot and ranked imports.

## CFB 27 conversion

Converts raw CFB 27 ratings (EA's ratings site's columns, one row per player) into BW95 rosters so that every rating keeps the stock game's distribution for its position, and every team still reflects its own CFB 27 roster. BW95 only so far. `convertCfb27` works out the whole league; `applyCfb27` writes the teams the user picks.

**Columns read** (`CFB27_COLUMNS`): Team, Name, Position, Overall, Jersey Number, Weight, EA Player ID, Speed, Acceleration, Agility, Strength, Awareness, Play Recognition, Catching, Carrying, Throw Power, Throw Accuracy Short/Mid/Deep, Break Tackle, Trucking, Run Block, Pass Block, Run Block Power, Pass Block Power, Power Moves, Block Shedding, Tackle, Hit Power, Pursuit, Kick Power, Kick Accuracy, Lead Block. Other columns are ignored. Positions: QB HB FB WR TE LT LG C RG RT LE RE DT LOLB MLB ROLB CB FS SS K P (LEDG/REDG = LE/RE); others are reported. Empty or non-numeric rating cells count as 0 (reported).

**Teams:** `teamMatcher` plus CFB 27's names Cal → California and Pittsburgh → Pitt. A swapped slot matches its current school. Two sheet teams matching one ROM team is an error. Any number of teams works: ROM teams not in the sheet keep their rosters, and slots a team has nobody for keep their player.

**1. Slot picking**, per team, in three passes: (1) primary slots from their own positions, (2) the leftover slot (stock PLB ← best of LOLB/ROLB/MLB), (3) still-empty slots from fallback positions (`FALLBACK`: HB ← FB/WR, WR ← TE/HB, TE ← WR/FB, K ↔ P, OL among themselves, LE/RE ← the other end then DT, DT ← LE/RE, the LB spots among themselves, CB ← FS/SS, safeties ← the other safety/CB). Within a pool: Overall high first, then EA Player ID low first. FB: the best HB/TE by Lead Block + Run Block + Strength + Trucking (30 of 36 BW95 schools have no FB in CFB 27). A team with no second kicker or punter uses the same player for K and P (Air Force has no K). Defense pools: stock 4-3 DT/DT, LOLB, MLB, ROLB, PLB ← LOLB/ROLB/MLB; stock 3-4 NT ← DT, LILB/RILB ← MLB, PLB as 4-3; Elevated DT1/DT2 ← DT, MLB1/MLB2 ← MLB.

**2. Roles** (the stock tables are per role): QB (0), HB (1-2), FB (3), OL (4-8), WR (9-12), TE (13-14), K (15), P (31), DE (16, 18), DT (17; 21 on 4-3 and Elevated), LB (19-23 except DT), CB (24-27), S (28-30). Stock sizes: 36, 72, 36, 180, 144, 72, 36, 36, 72, 59, 157, 144, 108.

**3. Matching**, per role × rating (weight included): sort the role's N players low to high by score, then Overall low first, then EA Player ID high first; player k gets the stock step at index ⌊(k + 0.5) / N × M⌋ of the role's M stock steps sorted low to high. With N = M the stock distribution comes out exactly; with fewer teams it's sampled evenly.

**Scores** (integer sums; only the order matters), from how BW95 uses each nibble (traced in the stock ROM: the snap routine `0x06FAEC` copies the record into the player object):

| BW95 rating | What it does in BW95 | CFB 27 score |
|---|---|---|
| Speed | top speed | Speed |
| Quickness | acceleration | Acceleration + Agility |
| OL / DL Power | acceleration = drive force in line play | OL: Strength + Run Block Power + Pass Block Power; DL: Strength + Power Moves + Block Shedding |
| Awareness | reactions; QB pass accuracy | QB: 3 × Awareness + Throw Accuracy Short + Mid + Deep; DL/LB/DB: Awareness + Play Recognition; others: Awareness |
| Hands | catches, interceptions, fumbles, loose balls, kick blocks | RB/REC: Catching + Carrying; others: Catching |
| QB Range | max pass distance and error-free distance | Throw Power |
| QB / RB / REC Power | break tackles, staying up after hits | Break Tackle + Trucking + Strength |
| OL Blocking | staying up after hits (barely used) | Run Block + Pass Block + Strength |
| DL / LB / DB Tackling | tackle chance | Tackle + Hit Power + Pursuit |
| K/P Quickness | **kick distance** (all three kick routines read it) | Kick Power |
| K/P Range | not used in kicking | Kick Power |
| K/P Accuracy | kick direction error | Kick Accuracy |
| Weight | collision mass | Weight (lb) |

The editor labels K/P Quickness "Quick, kick distance"; the CSV column stays `Quickness`.

**4. Jersey numbers** come straight from CFB 27.

**Stock tables:** `rosterStockDists.json` = for each game (bw95, cf96, cf97), role and rating, how many stock players are at each step, plus the stock ROM's SHA-1. It's built from the stock ROMs by `cli/stockdists.ts` (SHA-1 of the file 0f2f7bdd930db399e1ca2af2b28c40808d237d70; `test:rosters` rebuilds and compares it when given the stock ROMs). Counts only, no player records; the owner approved this exception to the no-ROM-data rule.

**Checked** with EA's Week 9 ratings (10,938 players, 138 schools; not in the repo): stock BW95 → 36 teams, 1,152 slots, 44 fallbacks (30 FB, 12 LOLB: CFB 27 has 150 LOLBs vs 445 ROLBs, Air Force K, Navy LDE ← DT), every role × rating exactly the stock distribution. The result is byte-identical to the reference conversion the method was worked out with, for the stock ROM (with and without the OL tweak) and for Elevated beta.7 Fixed Fatigue and its Tulane build (45 fallbacks; distributions within 0.007 of stock, as Elevated has more DT and fewer LB slots). In the emulator, Florida State's Team Rosters shows the real numbers (QB #14, LT #77 …) and, with the tweak, OL weights 357/325/325/309/309.

CF96/97 later: the stock tables are in the JSON already; still to do are the slot pools and fallbacks for the 45-slot layout, the CF97 ↔ CFB 27 school names, and a check of how the CF engine uses each nibble (the BW95 meanings are assumed until then).

## OL weight display tweak (BW95)

The Team Rosters screen computes the shown weight at `0x06B040` (`andi.w #$f0,d0 ; addi.w #$8c,d0`, 140 + 16 × step); the physics has its own 140 at `0x075858`/`0x07586E`. Converted rosters keep the stock weights, which leave today's offensive linemen about 25 lb light on that screen, so the conversion offers (and by default installs) a display-only tweak:

- `0x06B03C`: `024000f0 0640008c` → `4eb9001eff20 4e71` (`jsr $1EFF20.l ; nop`).
- `0x1EFF20`-`0x1EFF3D` (30 bytes): `024000f0 0640008c 3f01 322f0008 5941 0c410004 6204 06400019 321f 4e75` (stock weight; +25 when the row's slot, saved by the row routine's `movem`, is 4-8; `d1` kept).
- `installOlPatch` refuses when `0x06B03C` isn't the stock code or `0x1EFF20`-`0x1EFF3D` isn't free (0xFF), and does nothing when the tweak is already there. `0x1EFF20` is in the gap after Team Swap's celebration blob (`0x1EEF00`-`0x1EFF17`); free in the stock ROM and Elevated beta.7.
- With the tweak installed, the editor, the export and both imports use the shown OL weight (+25), so export → import stays byte-identical. A Slot import of a CSV with an EA Player ID column (converted elsewhere) offers the tweak afterwards. Undoing every roster change takes it out again if this session added it.
- Only with CFB 27 rosters: on stock rosters it would show the linemen 25 lb too heavy (also unconverted teams in a partly converted ROM).

## Export

Team, Slot, Position, Jersey Number, Weight, Speed, Quickness, Awareness, Power, Catching, Blocking, Tackling, Throw Power, Kick Power, Kick Accuracy. Only the slot's six fields are filled, with the values the game shows (OL weights +25 with the tweak). Exporting and re-importing every team leaves all three ROMs byte-identical. The CSV has no `app`/`tool`/`version` fields on purpose: it's a plain spreadsheet in the same shape as the sheets CFB-Walsh.exe reads.

## Compared with CFB-Walsh.exe

The exe ("Genesis College Football Editor v2.0", Python 3.7 + PyQt5 + pandas, packed with PyInstaller) hardcodes team offsets and reads Excel files with `pandas.read_excel`. Its bugs, fixed here:

1. It turns EA's boot check off instead of fixing the checksum.
2. Its 3-4 list has `196596` instead of Washington's `196956`, so Washington shows as 4-3.
3. CF97 Virginia Tech's offset is 235270; the roster is at 235370.
4. CF96/97: it loads slot 26 as DT2 and 27 as RDT but saves them the other way round, so every save swaps two players.

## Testing

- `npm run build`, then `npm run test:rosters -- BW95 CF96 CF97` (23 tests: buckets, round trips of every team, team matching, a ranked import including a 3-4 team, unknown teams and positions, the exe's checksum patch undone, CSV dialects, XLSX = CSV; the stock table against the stock ROMs; CFB 27 on generated made-up leagues: detection, Cal/Pittsburgh, exact stock distributions, fallbacks, shared K/P, determinism, ties, partial files and picked teams, a missing column; import paths and the Elevated layout (refusals, duplicates, unknown teams, ranked); the OL tweak).
- The CFB 27 acceptance checks above need EA's data and the Elevated ROMs, which aren't in the repo: `npx tsx cli/cfb27.ts ROM ea-cfb27-ratings-week9.csv OUT.md` and compare the SHA-1 with the project notes.
- In the browser: every download should be byte-identical to the same edits made with the core functions in Node. Checked for BW95, CF96, CF97, a Team Swap result with roster edits (differs from the plain swap only in the edited players and the checksums) and a ROM with the exe's checksum patch (comes back byte-identical to the original).
- In an emulator (Genesis Plus GX, e.g. through stable-retro): BW95 title after ~1300 frames → START (Game Setup) → START (controller select) → RIGHT → START → ~1000 frames to the pregame menu → DOWN ×3 → C opens Team Rosters for the home team; RIGHT switches to the visitor, DOWN scrolls. Default teams: Florida State (home, 4-3) and Notre Dame (visitor, 3-4). CF96/97: title after ~1600 frames, START → Game Setup.

## Not verified yet

- The CF96/97 roster screens (display scale, labels).
- A full game or season with imported rosters, and real hardware.
- Ranked imports of real spreadsheets: only made-up sheets were tested. Newer EA position names (EDGE, SAM, MIKE, WILL …) aren't mapped. (EA's CFB 27 ratings go through the conversion, which knows its positions.)

## The 138-team 2026 Season Edition

Elevated v2.0.0's 2026 Season Edition is a 4 MB ROM whose team table at 0x28DC has 138 pointers; its team blocks have the original format, so the roster records are read and written the same way (`src/core/wide.ts` checks the layout: the table, the "OVR1" table at 0x218000 and the Walsh paragraph table at 0x218800). `openRosterRom` reads all 138 teams (`RosterRom.wide`), the CFB 27 conversion matches all 138 (CSV names such as Appalachian State, Miami (Ohio) and USF map to the ROM's App State, Miami of Ohio and South Florida), and OFF/DEF go to its own OVR table (one entry per team) and the teams' rating words. Converting the built-in Week 9 CSV rebuilds the released ROM byte for byte. The Sega header checksum covers the whole 4 MB; EA's boot check covers only the first 0x1E6414 bytes, which roster edits above 2 MB don't touch.

