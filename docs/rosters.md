# Rosters: technical reference

Developer notes for the Rosters tool. The user-facing docs are in the [README](../README.md#rosters).

## Code

| File | What |
|---|---|
| `src/core/rosterLayouts.ts` | Games, slot layouts, rating order per position group, scales |
| `src/core/rosterRom.ts` | Open a ROM (game by header, teams from the team table), read/write players, checksums |
| `src/core/rosterSheet.ts` | CSV reader (comma, semicolon, tab; UTF-8 or Windows-1252) and XLSX reader (first sheet; own zip + XML parsing), CSV writer |
| `src/core/rosterImport.ts` | Spreadsheet → rosters (ranked mode and Slot mode), import report |
| `src/core/rosterExport.ts` | Rosters → CSV |
| `src/core/rosterNames.ts` | The team names CFB-Walsh.exe used, so sheets made for it still match |
| `src/tools/rosters/RosterTool.tsx`, `rosters.css` | The tab: ROM card, team grid, import report, help, dock |
| `cli/rostertest.ts`, `cli/fixtures/` | Engine tests (`npm run test:rosters -- BW95 CF96 CF97`; paths may be zips). The fixtures are made-up players. |

`App.tsx` only adds the tabs, routes dropped files to the active tab, and passes the Team Swap build to the Rosters tool (`TeamSwapSource`: count + `build()`).

## Games

| | BW95 | CF96 | CF97 |
|---|---|---|---|
| First 16 bytes | `00FFFFF6 00000200 0007A31A 0007A31A` | `… 0006209E 0006209E` | `… 00069D7A 00069D7A` |
| Team table | `0x0028DC`, 36 teams | `0x002CEA`, 108 | `0x002CEA`, 111 (+ a placeholder) |
| Names (header word) | [2]: school, city, nickname | [1]: school, stadium, nickname | same as CF96 |
| Roster | block + header word [0], 32 × 4 bytes | record + header word [0], 45 × 5 bytes | same as CF96 |

The game is identified by its first 16 bytes, not by SHA-1, so modified ROMs work (Rebalanced, Team Swap output, earlier roster edits, ROMs saved by CFB-Walsh.exe). Rebalanced has the same header as the original.

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

- Columns are matched ignoring case, spaces and punctuation. Team and Position (or Slot) are required; everything else is optional, and a missing column or empty cell keeps the current value.
- Teams: the ROM's "school nickname", the school alone, CFB-Walsh.exe's name for the slot (only while the slot still holds that school, so a swapped slot doesn't match the old team's name) and that name minus the nickname ("Pittsburgh"). Case, periods and apostrophes are ignored; "St" = "State". Names that would match two teams are dropped.
- Positions: QB HB FB LT LG C RG RT WR TE K P LE DT RE LOLB MLB ROLB CB SS FS, plus RB → HB and ILB → MLB. Others are reported and skipped.
- Ranked mode (CFB-Walsh.exe's rules): per team, primary slots in editor order each take the best unused player of their position by Overall Rating (ties and blanks keep sheet order); then the leftover slots take the best unused player of several positions: BW95 PLB ← LOLB/ROLB; CF96/97 T2 ← LT/RT, G2 ← LG/RG, DE2 ← LE/RE, LB2 ← MLB. The exe filled leftovers with the first unused player in its sort order instead.
- Field mapping: Hands ← Catching; QB Range ← Throw Power; K/P Range ← Kick Power, Accuracy ← Kick Accuracy; Weight in lb; the rest by name. Values go to the step at or below (`ratingToNibble`, `weightToNibble`, the exe's buckets).
- Slot mode: when a team's rows have a Slot value, each row goes to that slot. Labels accepted: the editor's (both BW95 defenses) and the game's (LE, DLT, DRT, KICK, PUNT, FS1).

## Export

Team, Slot, Position, Jersey Number, Weight, Speed, Quickness, Awareness, Power, Catching, Blocking, Tackling, Throw Power, Kick Power, Kick Accuracy. Only the slot's six fields are filled, with the values the game shows. Exporting and re-importing every team leaves all three ROMs byte-identical. The CSV has no `app`/`tool`/`version` fields on purpose: it's a plain spreadsheet in the same shape as the sheets CFB-Walsh.exe reads.

## Compared with CFB-Walsh.exe

The exe ("Genesis College Football Editor v2.0", Python 3.7 + PyQt5 + pandas, packed with PyInstaller) hardcodes team offsets and reads Excel files with `pandas.read_excel`. Its bugs, fixed here:

1. It turns EA's boot check off instead of fixing the checksum.
2. Its 3-4 list has `196596` instead of Washington's `196956`, so Washington shows as 4-3.
3. CF97 Virginia Tech's offset is 235270; the roster is at 235370.
4. CF96/97: it loads slot 26 as DT2 and 27 as RDT but saves them the other way round, so every save swaps two players.

## Testing

- `npm run build`, then `npm run test:rosters -- BW95 CF96 CF97` (13 tests: buckets, round trips of every team, team matching, a ranked import including a 3-4 team, unknown teams and positions, the exe's checksum patch undone, CSV dialects, XLSX = CSV).
- In the browser: every download should be byte-identical to the same edits made with the core functions in Node. Checked for BW95, CF96, CF97, a Team Swap result with roster edits (differs from the plain swap only in the edited players and the checksums) and a ROM with the exe's checksum patch (comes back byte-identical to the original).
- In an emulator (Genesis Plus GX, e.g. through stable-retro): BW95 title after ~1300 frames → START (Game Setup) → START (controller select) → RIGHT → START → ~1000 frames to the pregame menu → DOWN ×3 → C opens Team Rosters for the home team; RIGHT switches to the visitor, DOWN scrolls. Default teams: Florida State (home, 4-3) and Notre Dame (visitor, 3-4). CF96/97: title after ~1600 frames, START → Game Setup.

## Not verified yet

- The CF96/97 roster screens (display scale, labels).
- A full game or season with imported rosters, and real hardware.
- Real spreadsheets from current games: only made-up sheets were tested. Newer EA position names (EDGE, SAM, MIKE, WILL …) aren't mapped.
