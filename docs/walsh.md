# Walsh Report editor

How the toolkit reads, checks and writes Bill Walsh '95's Walsh Report text: the scouting report Bill Walsh reads before a game. Code: `src/core/walsh.ts` (the text block, renames for Team Swap), `src/core/walshReports.ts` (the editor's rules), `src/tools/walsh/` (the editor modal). Tests: `cli/walshtest.ts`.

## The text in the ROM

- One block at `0x05B2E0`, 78 paragraphs, each ending in a CR (`0x0D`). EA's block ends at `0x061066` (23,943 bytes with the CRs). The block's only reference is `lea $5B2E0.l,a1` at `0x078FBE` (the long at `0x078FC0`).
- Paragraphs 0-5 are intro lines ("Welcome to {c}.", "I'm Bill Walsh for EA Sports.", …). Then each team has two: offense = 6 + 2 × slot, defense = 7 + 2 × slot. The intro lines and all 78 CRs take 195 bytes.
- The printer (`0x078FA4`-`0x0791A0`) finds paragraph n by counting CRs and keeps the next word's offset from the block start in the word `$C408`, so the block must stay under 32 KB. It copies one word at a time (a word runs to the next space, with the spaces after it) into `$DD8E` and prints it with the game's text routine (`0x070D7C`), wrapping by word and scrolling the box when it's full. The box comes from the inline words after `jsr $78F78` at `0x06C50C` and `0x06C5F0`: x 2, y 4, **20 characters wide, 6 lines high**.
- Byte by byte: `D2`/`D3` print as `"`, `D4`/`D5` as `'` (EA's curly quotes), then the byte is masked to 7 bits. `{` at the start of a word runs a code from the table at `0x079126`: `{c}` = the home team's city, `{h}` = the home school, `{v}` = the visitor's school. A comma or a period adds a pause.
- The pregame Walsh Report shows the home team's offense and defense, then the visitor's.

## What the font draws

Checked in an emulator by putting every printable ASCII character into a report:

| Characters | On screen |
|---|---|
| A-Z, a-z, 0-9, space, `! " # % & ' ( ) + , - . / : ; = ? _` | as typed |
| `$` | © |
| `*` | a checkmark |
| `[` `]` `\|` | arrows (←, →, ↓) |
| `<` | a raised bar |
| `>` `@` `\` `^` `}` `~` and the backtick | blank (`@` is the game's blank tile) |

The editor takes letters, digits, spaces and `. , ! ? ' " - & ( ) / : ; % + = #` (`reportProblems`). It turns curly quotes and dashes into plain ones (`cleanText`) and line breaks into spaces.

## Limits

- **Words:** at most 20 characters, the width of the box. A 21-character test word wasn't shown, and the report ended after it.
- **Paragraph length:** none in practice. Test paragraphs of 650 and 1,000 characters scrolled through to their last word.
- **Per team:** at most `REPORT_LIMIT` = 650 characters for the offense and defense together. 36 × 650 + 195 = 23,595 bytes leaves 348 bytes of EA's 23,943 for longer names from a team swap (a 36-team swap with College Football USA 97's default names adds 110). The block also has 217 two-space sentence gaps that can each give a byte. So the text always stays in its own space; nothing is written anywhere else.
- **EA's long reports:** EA's reports are 457-1,010 characters, and 15 are over 650 (Air Force, Arizona, BYU, California, Clemson, Nebraska, North Carolina, Notre Dame, Ohio State, Oklahoma, Penn State, Pitt, Stanford, USC, Washington). Saving the first report (`writeReports`, or a Team Swap build with a report in its swap config) trims every other long report with `trimReport`:
  - It drops last sentences, never a paragraph's first.
  - Each step drops the last sentence of the longer paragraph, unless dropping one from either paragraph already fits; then it takes the drop that keeps the most text.
  - On EA's text the trimmed reports keep 562-642 characters.
  - The editor lists the teams before the first save.

## Writing (`rewriteWalsh`)

1. Team Swap renames swapped teams' paragraphs (`renameInText`: school, nickname, its singular and last word, Cal and FSU). Teams with a report given (the editor, or `SlotConfig.walsh`) get that text instead.
2. If any report was given, every other report over 650 is trimmed.
3. If the block is longer than its space, two-space sentence gaps become one (changed paragraphs first, then the rest, in paragraph order, so the same input always gives the same bytes). If it still doesn't fit, which takes very long made-up names, the longest reports lose their last sentences (the result says `'trimmed'`).
4. The block is written at `0x05B2E0`, and the bytes after the last CR up to `0x061067` are filled with spaces, which are never read. The space counts as the text's own only while those bytes are spaces, so text edited by another tool is left its own length.

Versions of the app before the editor moved a text that didn't fit to `0x1F8000` and pointed `0x078FC0` there. Such a ROM is read from there, written back in place, and the copy at `0x1F8000` is filled with `0xFF` again.

## Edits in the working ROM

- `editedReports(base, data)` lists the teams whose report differs from the loaded one and from the loaded one trimmed. So the automatic trims don't count, and neither does the Season tab's rename of a conference in Air Force's report (it pads the paragraph with spaces; the names are put back before comparing).
- Undo (`restoreReport`) brings back the loaded report. If the ROM's long reports were trimmed, it's trimmed too, so it still fits. Undo of the last edited team restores the whole block as loaded (`restoreAllReports`).
- "Keep my edits" after a new Team Swap result carries edited reports by slot, but only where the slot still holds the same school; otherwise it's listed as skipped, since the report was about another team.
- A report change counts as a Teams tab change (the `[Teams]` file tag).

## Swap files

`SlotConfig.walsh` = `[offense, defense]`, optional. Without it a swapped team gets the original team's text with the new names, as before; swap files saved before the editor build exactly as before. Loading a swap file checks the report with `reportProblems`.

## The 138-team 2026 Season Edition

Elevated v2.0.0's 2026 Season Edition doesn't count CRs: its printer (`0x078FBE` → `jsr $2100DC`, and `0x210108` for the next paragraph) takes a paragraph's address from a table at `0x218800` (6 intro lines, then offense = 6 + 2 × team and defense = 7 + 2 × team, 282 longs) and keeps the word offset in `$C408` from that paragraph's start. The release packs the text from `0x219000` to `0x22D433`; the team blocks start at `0x230000`, and the bytes between are `0xFF`.

`src/core/walshWide.ts` reads the paragraphs through the table and writes them all again, packed from `0x219000`, pointing the table at each one. The text may grow over the `0xFF` bytes after it (checked first) up to `0x230000`, 94,208 bytes in all; bytes it no longer uses go back to `0xFF`. 138 reports of 650 characters plus the intro lines take about 90,200 bytes, so every report can use the editor's limit and nothing is ever trimmed (the release's reports are 444-647 characters). `walshReports.ts` picks this path for a 138-team ROM, so the editor, undo, tracking and carrying work the same; carrying goes by school name.

## Built-in 2026 reports

`public/data/walsh-reports-2026-week9.json` holds the Elevated mod's 2026 reports for all 138 teams of the built-in College Football 27 CSV (`{app: 'genesis-cfb-toolkit', tool: 'walsh-reports', version: 1, season, week, source, reports: {<CSV team>: {offense, defense}}}`). `src/core/walsh2026.ts` fetches and checks it (`walshDataProblems`: every report within the editor's rules) and maps converted teams to slots (`reportsForSlots`, by the CSV team the conversion matched). The Rosters tab offers them only with the built-in rosters, because the reports name players by those rosters' jersey numbers; they go in with `writeReports`, like reports saved in the editor.

`cli/walshdata.ts` makes the file from the 138-team 2026 Season Edition (Elevated v2.0.0 on): it finds the team table (0x28DC, one pointer per team) and the Walsh paragraph table (the pointer to "Welcome to {c}." followed by increasing pointers: 6 intro lines, then offense and defense per team), maps the ROM's school names to the CSV's (App State → Appalachian State, Pitt → Pittsburgh, and 10 more), and refuses to write unless every CSV team has exactly one valid report.

