# Genesis CFB Toolkit

Browser-based modding tools for EA's college football games on the Sega Genesis: Bill Walsh College Football '95, College Football USA 96 and College Football USA 97.

Everything runs in your browser. Your ROMs are opened on your own computer and are never uploaded anywhere. The app contains no ROM data or artwork; you bring your own ROMs. It does come with two tables for the College Football 27 roster conversion: how many players the original games have at each rating step, and EA's College Football 27 player ratings (2026 season, Week 9) for the built-in rosters. It also has the Elevated mod's 2026 Walsh Reports for every FBS team, which go with those rosters.

## Tools

- **[Patch](#patch):** start here. Load your Bill Walsh College Football '95 ROM and, if it's the original game, add the latest release of the Elevated mod's patches.
- **[Team Swap](#team-swap):** swap College Football USA 97 teams into Bill Walsh College Football '95.
- **[Season](#season):** rename the four conferences, choose which teams play in each, and lock in schedules in Bill Walsh '95.
- **[Teams](#teams):** for each Bill Walsh '95 team, choose the offense and defense the computer runs, the team's OFF and DEF ratings and the weather in its home games, and write its Walsh Report.
- **[Rosters](#rosters):** edit the players of Bill Walsh '95, CF96 or CF97, team by team or from a spreadsheet (CSV or Excel), or bring in real College Football 27 rosters (built in: 2026 season, Week 9).
- **[Dynasty](#dynasty):** a sports news site for your season of the 138-team 2026 Season Edition: import your battery save and read the scores, standings, Top 25, stats and stories, season after season. Open it with **Dynasty** at the top of the page, or `#dynasty`.

Each tool has its own tab. The app opens on Patch; `#swap`, `#season`, `#teams` or `#rosters` at the end of the address opens that tab directly (`#styles`, the Teams tab's old address, still works).

**Season, Teams and Rosters edit the same ROM.** They open the Patch tab's ROM on their own; you can also load a ROM in any of them, or take the Team Swap result, then switch between them as often as you like. **Download ROM** in any of the three saves everything, named after the ROM with `[Season]`, `[Teams]` and/or `[Rosters]` added. Team Swap builds on the Patch tab's ROM, not on the one these tabs edit; if you change the swap and take its result again while you have changes, the app asks: **Keep my edits** puts every team's roster, the conferences and schedules, and the styles, ratings and weather you changed into the new ROM, by slot (a swapped team gets the edits made for its slot), or **Start fresh**. The same question comes up when you open another ROM file of the same game.

## Patch

Start here. Load your Bill Walsh College Football '95 ROM (`.md`, `.bin`, `.gen` or `.zip`):

- **The original game:** pick a patch and choose **Apply patch**. The app downloads the patch from the [Elevated](https://github.com/jd6-37/Bill-Walsh-CFB-95-Elevated) mod's GitHub page, applies it in your browser and checks the result, so it always offers the latest release. **Download patched ROM** saves the patched ROM, and **Back to the original game** undoes the patch. **Use a .bps file** applies a patch you downloaded yourself, for example if GitHub can't be reached.
- **A ROM with a released patch:** the app says which release it has, and whether a newer one is out. Patches go onto the original game only, so to update, load the original ROM and patch it here.
- **Any other modded or edited ROM:** used as it is.
- **The 2026 Season Edition of Elevated v2.0.0 and later** (a 4 MB ROM with all 138 FBS teams): the Patch tab makes it and recognizes it, and the Season, Teams and Rosters tabs edit it: its conferences and their schedule weeks, and all 138 teams' styles, OFF and DEF, home weather, Walsh Reports and players (**Edit season, teams and rosters** under Next). Team Swap doesn't take it (it already has every FBS team), so that tab is grayed out. To bring in CF97 teams, start from the original game or the Elevated edition with the original 36 teams.

The other tabs then use that ROM, patched or not: Team Swap builds on it, and Season, Teams and Rosters open it (if they already have changes in another ROM, they ask first). **Swap teams** and **Edit season, teams and rosters** under Next go to those tabs. A ROM whose teams Team Swap already swapped, such as the 36-team 2026 Season Edition of Elevated v1.1.0, can have them swapped again (see [Swapping a swapped ROM](#swapping-a-swapped-rom)). Team Swap always uses the Patch tab's ROM: a Bill Walsh ROM you load in the Team Swap tab shows up in the Patch tab too.

### How it works

The mod's GitHub repo has a patch list, `patches.json`: the latest release's patches, with each patch file's size and SHA-256 and the SHA-1 of the ROM it makes, plus older releases so their ROMs are still recognized. The app reads the list when the page opens and downloads only the patch you pick. The patches are BPS files; the app checks the three checksums every BPS file carries (the original ROM, the patch, the result) and then the result's SHA-1 against the list. Format and release steps: [docs/patches.md](docs/patches.md).

### Testing

- `npm run test:patch` (see [Development](#development)): the BPS code with patches that use every BPS command, damaged patches and patches for another ROM; the repo's patch list and broken ones; each listed patch applied to the original ROM gives the SHA-1 in the list, and the patched ROM takes a team swap, except the 138-team 2026 Season Edition, which is recognized and kept out of the 36-team tools.
- In the browser: both v1.0 patches downloaded from GitHub and applied (SHA-1s as in the list), the patched ROM taken to Team Swap (Pitt → Tulane, identical to the CLI build) and to Season, Teams and Rosters; v1.0, Elevated beta and already swapped ROMs loaded directly; the patch list unreachable (a `.bps` file still works); a damaged `.bps` file; phone layout.

## Team Swap

Pick any of BW95's 36 teams, choose a CF97 team to replace it with, adjust the names and uniform colors, and download the new ROM. The new teams' art comes from your CF97 ROM.

### What a swap changes

- Logo (setup screen, pregame and play-call screens), helmet and wordmark (stadium banner, play-call screen), taken from your CF97 ROM.
- School name, city and nickname. CF97 stores each team's stadium rather than its city, so the city Bill Walsh welcomes you to is filled in for you.
- Home and away uniform colors, mapped from CF97's uniforms and editable with a Genesis color picker.
- End zone color for the team's home games.
- The computer's offense and defense style for the team (optional; see [Teams](#styles)). By default the new team keeps the old team's styles.
- The team's OFF and DEF ratings and its home weather (see [Teams](#off-and-def)): by default the CF97 team's own (its 1996 ratings, and its weather, e.g. Tulane OFF 74 DEF 75, fair 90% of home games), editable in the team's edit screen. Simulated games, the preseason poll and Elevated's Game Setup use them. Converting the rosters to College Football 27 sets OFF and DEF from the new players. A swap file saved before this keeps the old team's.
- The end-of-season celebration: swapped teams get a "GO TEAM!" card stunt in their own colors (cards, skirts and pom-poms, tops; editable, with a preview).
- The team menus stay alphabetical with the new names.
- The Walsh Report uses the new names, or a report you write in the team's edit screen (see [Walsh Report](#walsh-report)).

### What stays the same

- Schedules, rankings, conferences and battery saves: the new team plays in the old team's slot (change conferences and schedules in the [Season](#season) tab).
- Rosters (edit them in the [Rosters](#rosters) tab, which can open the swapped ROM directly; its **CFB 27 rosters (2026, Week 9)** button gives every team its current players).
- Unless you write a new one, the Walsh Report keeps the original team's scouting text, with the names changed.
- Teams you don't swap keep their own celebrations.

### Supported ROMs

| ROM | SHA-1 |
|---|---|
| Bill Walsh College Football 95 (USA) | `2ae000f45474b3cdedd08eeca7f5e195959ba689` |
| Bill Walsh College Football '95 Rebalanced v1.0, Fixed Fatigue | `9e8f79f431c47cd52008f6315a3cb9e1bdd6a37e` |
| Bill Walsh College Football '95 Rebalanced v1.0, No Fatigue | `c012fbd0fb0db59648f2d9bff78acc29d9f63ea0` |
| College Football USA 97 (USA) | `9b93035ecdc2b6f0815281764ef647f2de039e7b` |

Files can be `.md`, `.bin` or `.gen`, or a `.zip` containing one. The Rebalanced ROMs are the Elevated mod's v1.0 release (released as Rebalanced; the [Patch](#patch) tab makes them from the original ROM); the swap keeps all of their changes.

Other Bill Walsh '95 ROMs with a mod work too, such as Elevated v1.1.0 and v2.0.0 (the editions with the original 36 teams): when you load one, the app checks that the code the swap patches is unchanged and the ROM space it uses is empty, and says what's in the way if not. The swap keeps all of the mod's changes, and the downloaded ROM is named after your file with `[Team Swap]` added. The 138-team 2026 Season Edition (Elevated v2.0.0 and later) already has every FBS team, so Team Swap doesn't take it.

### Swapping a swapped ROM

A ROM that Team Swap swapped before, such as the 36-team Elevated 2026 Season Edition of v1.1.0, can be swapped again. The Team Swap tab lists its teams as they are now and says which ones were swapped in. Pick a CF97 team for any slot, one swapped in before too; every other team stays exactly as it is (names, art, colors, end zone, card stunt colors, menu place, roster). Putting back one of the original 1994 teams isn't possible this way: start from the original ROM for that. A ROM swapped with another tool can't be swapped again; start from the ROM before that swap.

### Swap files

**Save swap file** writes your choices (teams, names, colors, styles, ratings, weather, Walsh Reports) as a small JSON file with no ROM data in it. Load it later, or share it, to rebuild the same ROM from the same source ROMs.

### How it works

- **CF97 teams:** a pointer table at `0x002CEA` lists 112 team records (111 teams and a placeholder). Each record holds the names, a 3-line palette (logo, home uniform, away uniform), a sprite map (logo, wordmark, helmet) and the tiles, compressed with an LZ scheme that `src/core/cfdecomp.ts` decodes. The decoder was checked byte for byte against the game's own routine (`0x0581AC`) for every team, and against video memory in the running game.
- **BW95 teams:** a pointer table at `0x0028DC` lists 36 team blocks. A swap rebuilds the block in place: ratings group, uniforms, logo container, helmet container and names. The roster stays at the same offset at the end of the block.
- **Helpers** (68000 assembly in `asm/`, placed in unused ROM space):
  - `0x1F0000` menu order: the four team steppers (setup home and visitor, `0x06ACB2`, season Team Rosters) step through teams alphabetically by their new names.
  - `0x1F0280` end zone color per home team (the game normally darkens the home jersey's darkest shade).
  - `0x1F0300` helmet tile base on the setup screen, so helmets of up to 36 tiles fit (the stock layout leaves 32).
  - `0x1F0320` celebration colors: when the generic card stunt plays, palette entries 9, 10 and 13 are replaced with the winning team's colors.
- **Walsh Report:** the swapped teams' paragraphs get the new names (or the report written in the edit screen), and the text block always stays in its own space: if it gets longer, some two-space sentence gaps become one space; if it gets shorter, the leftover bytes after the last paragraph are filled with spaces. Only very long made-up names that still don't fit make the longest reports drop their last sentences. (Versions before the Walsh Report editor moved such a text to `0x1F8000`; the app reads it from there and puts it back.)
- **ROM space:** the swap uses about 4.4 KB of unused ROM (`0x1EEF00`-`0x1EFF17` and `0x1F0000`-`0x1F043B`), and checks that it's unused before writing. The Rosters tool's OL weight tweak uses `0x1EFF20`-`0x1EFF3D` (see [Rosters](#how-it-works-3)) and the Season tool's locked-team table `0x1EFF40`-`0x1EFF87` (see [Season](#how-it-works-1)).
- **Celebration:** one "GO TEAM!" card stunt at `0x1EEF00`, built from your BW95 ROM: Pitt's "GO PITT!" card stunt with four cards re-lettered, using letters copied from Pitt's and Texas A&M's cards. Swapped teams' entries in the celebration table (`0x034A68`) point to it.
- **Swapping again:** the app recognizes its own swap: the jumps at the patch sites and its helpers, apart from their tables. It keeps the tables' entries for the teams it doesn't change, keeps the card stunt already in the ROM, and reads the Walsh Report text from where the last swap left it (spaces left by shorter names are used first; a text an older version moved to `0x1F8000` goes back in place and its copy there is freed).
- **Checksums:** EA's boot check (the sum at `0x1E6430`) and the Genesis header checksum are recomputed.

### Testing

- Pitt → Tulane on the original ROM and on Rebalanced v1.0 (Fixed Fatigue): boot, title, setup screen, Bill Walsh's welcome, Walsh Report, coin toss, pregame, kickoff with the new uniforms and end zones. On the Rebalanced ROM, nothing outside the swap's own changes differs from the input.
- All 36 teams swapped, with the largest CF97 art placed in the smallest BW95 slots: every team checked as home and visitor on the setup screen (art compared with video memory), plus pregame and in-game screens, including 36-tile helmets and 16-character names.
- The menu, end zone, helmet and celebration helpers were run on their own in a 68000 emulator (every team; for the celebration: home win, visitor win and an unswapped team).
- Celebration: test ROMs that play it at the title screen show "GO TEAM!" in Tulane's and Idaho's colors, Penn State's own "PENN STATE #1" unchanged, and the same on a Rebalanced ROM.
- ROMs downloaded from the app are byte-identical to the CLI builds above.
- Elevated v1.1.0-beta.11 (Fixed and No Fatigue): Pitt → Tulane and Wisconsin → Idaho, and all 36 teams swapped. Nothing outside the swap's own changes differs from the input, and every roster is kept. In the emulator: the Elevated title screen, Tulane on the setup screen and the pregame menu. The Tulane builds of beta.11 are refused because another tool swapped them.
- Swapping again, 6 Node tests (`npm run test:swap`): fresh swaps give the same bytes as before; a ROM Team Swap swapped takes another swap and one swapped by another tool is refused; adding teams to a swapped ROM, or giving a swapped slot another team, gives the same ROM as doing it in one go (apart from the Walsh Report's sentence gaps); the Walsh text moved and moved back; on the Elevated 2026 Season Edition, Iowa → Arizona State and Navy → Baylor change only those two teams and the menu, end zone and card stunt tables. In the emulator, that ROM shows the 2026 title screen and both new teams on the setup screen with their OFF and DEF.

Not tested in a real game: a full season through the bowls with swapped teams (the celebration was only forced at the title screen), and real hardware.

## Season

Rename Bill Walsh '95's four conferences, choose which teams play in each, and set schedules. It works on the original ROM, Elevated, a Team Swap result or a ROM it saved earlier, and edits the same ROM as the Rosters tab. **Use the Team Swap result** opens the ROM you set up in the Team Swap tab.

### The 138-team 2026 Season Edition

That edition has a season mode of its own (12 weeks, Random or Real 2026 schedules, conference title games and a playoff), so its Season tab is different:

- **Conferences:** rename each of the ten conferences and the Independents (up to 22 characters: letters, digits, spaces and `- . & '`; the game shows O as 0, as in all its text) and **Move** teams between them. The first four are the Power 4, whose champions get automatic playoff bids; the next six the Group of 6. Each of the ten plays a title game between its top two, so it needs 2 to 24 teams. Independents play no conference games.
- **Conference games and weeks:** how many conference games each conference plays in a Random season and from which week. A conference plays at most one round robin (a 9-team conference at most 8 games), and the games have to end by week 12.
- The Real 2026 schedule keeps its games; there the conferences decide the standings and the title games. Changes take effect in a new season. **Undo season changes** puts everything back as loaded. There's no season file for this edition.
- How it works: each team's conference is its ratings group's word +6 (0-9, 10 = Independents), the names are 22-character strings in the season engine's table (the Rankings screen's titles), and the weeks are two 11-byte tables (first week, games) the engine reads at New Season; the app finds all three through the engine's own code and checks them before writing. Details: [docs/season.md](docs/season.md#the-138-team-2026-season-edition).
- Checked: the same edits made in the app and with `cli/season138.ts` give the same ROM; in an emulator a Random season on an edited ROM gives the moved teams their new conference's games in the set weeks, shows the new names on the Rankings screen, and plays through the title games and the playoff to the championship.

### How the game schedules a season

Bill Walsh '95 has no fixed schedules. When you start a New Season, it deals each team into a random place in its conference, and a built-in 16-week schedule says which places play each other, so opponents change from season to season. Every team plays every week (there are no bye weeks), and Game Setup's **Weeks** row (1-16, 12 by default) picks how many weeks are played. After the regular season, each conference's best-ranked team goes to one of the four bowls (**Bowl Games**), or the top 16 teams play the EA Cup (**Playoffs**).

### Conferences

- Names can be up to 22 characters (letters, digits, spaces and `. , & ' -`). The rankings screen shows the new names, and so does the Walsh Report's one mention of a conference ("Southern Conference", in Air Force's report) if the new name fits there.
- **Move** puts a team in another conference. Any sizes work as long as every conference keeps at least 2 teams (each one sends a team to a bowl). With sizes other than 10, 10, 8 and 8, the built-in schedule's conference games come out uneven; lock teams to set theirs.

### Schedules

- Teams are random by default, as in the original game. **Lock this team's schedule** gives a team a fixed place: then pick its opponent and Home or Away for each of the 16 weeks. **Any SEC team** (with your conference names) leaves that week to one of the conference's random teams.
- Picking a team for a week locks that team too (●), and the two teams' old opponents play each other that week. If that changes another locked team's game, the app lists it.
- **Lock every team** makes the whole schedule fixed; **Make every team random** goes back to the game's own dealing.
- Start a New Season with the new ROM. A season already in progress rebuilds its schedule from the ROM, so its games would change.

### Season files

**Save season file** writes the conferences and schedules as a small JSON file with no ROM data in it. Load it into another copy of the ROM, for example after redoing a Team Swap. Teams are stored by slot, so a swapped team takes the place of the team it replaced.

### How it works

- **Conferences:** each team's conference is the last word of its ratings group (team block + header word [3], + 6). The names are four 22-character strings at `0x0DF6E8`-`0x0DF747`.
- **Schedule:** 16 weeks × 18 games of (visitor, home) places at `0x0E0004` (576 bytes). The deal at `0x071824` puts each team into a random empty place of its conference's range ({first, count} per conference at `0x0718DC`), using the season's saved random seed.
- **Locked teams:** the deal loop's body at `0x07182A` (40 bytes, rewritten in place) reads a per-team {first place, count} table at `0x1EFF40`-`0x1EFF87` instead: a locked team gets {its place, 1}, the others their conference's range. The app relabels the places so each conference's random places form one range and the locked ones come after them.
- **ROM space:** everything is rewritten in place except the 72-byte locked-team table, which is only written when a team is locked (and freed again when none is). Before writing, the app checks that the code it changes is the original (or its own) and that the table's space is free.
- **Checksums:** EA's boot check and the Genesis header checksum are recomputed.

### Testing

- In an emulator (Genesis Plus GX), a New Season with Weeks set to 16 for four test ROMs: four locked teams, all 36 locked, all but one locked, and random schedules with moved conferences (9, 10, 6 and 11 teams). The game's list of games matched the app's schedule for every locked team in every week, every "any team" week got a random team of that conference, and every random team was dealt into its own conference's places. The rankings screen shows the new conference names. The same checks passed on Elevated v1.1.0-beta.11 and on a Team Swap result.
- 10 Node tests: an unchanged setup writes back byte-identical (original, Rebalanced v1.0 and Elevated beta.11), 4,000 random edits stay valid and survive writing and reading back, unlocking every team restores the original code and frees the table, Team Swap works before or after, the Rosters OL hook sits next to the table, and edits carried to a new Team Swap result land by slot.
- ROMs downloaded from the app are byte-identical to the same edits made with the code in Node, and a saved season file loaded into a fresh ROM gives the same download. A Team Swap result with locked schedules (Season tab) and a CFB 27 conversion (Rosters tab), downloaded from either tab, equals the swap → season → conversion done with the command-line tools; after changing the swap and keeping the edits, the download equals the new swap with the edits carried over.

Not tested: playing through a season with an edited schedule (the emulator used has no battery save, so a season can't get past "Saving Season Games"), bowls with other conference sizes (checked in the code only), and real hardware.

## Teams

The Teams tab lists every team of a Bill Walsh '95 ROM (36, or 138 in the 2026 Season Edition of Elevated v2.0.0 and later) with the settings that belong to a team rather than its players: the offense and defense the computer runs, the team's OFF and DEF ratings, its home weather and its Walsh Report. Undo puts a team back as the ROM was loaded.

<a id="styles"></a>
### Styles

In Bill Walsh '95 the computer calls plays by its team's **style**: one of five offenses and one of three defenses. The style decides which formations it uses on each down; it belongs to the team's slot, so a team swapped in plays the old team's style until you change it. You can also set them in a swapped team's edit screen in Team Swap, and for the team on screen in the Rosters tab.

| Offense | Formations the computer calls | Original teams |
|---|---|---|
| Option | Wishbone, Flexbone, Goal Line (and Veer on Elevated) | Air Force, Army |
| Pro Style | I-Form, Pro Form, Near, Far, Goal Line | 21 teams, e.g. Alabama, Florida State, Nebraska |
| Multiple | Trap, I-Form, Pro Form, Shotgun, Near, Far, Goal Line | BYU, California, Colorado, Louisville, Michigan, Washington, Washington State |
| Shotgun | I-Form, Pro Form, Shotgun, Near, Far, Goal Line | Florida, LSU, Miami, Pitt, Stanford |
| Power | Trap, I-Form, Tee, Pro Form, Near, Far (and Veer on Elevated) | Notre Dame |

| Defense | Elevated (v1.1.0-beta.7 and later) | Original game | Original teams |
|---|---|---|---|
| 3-4 | 3-4 with some 4-4 against the run, Nickel on 3rd down, Dime on 3rd and long | 3-4 on early downs, Nickel on 3rd down | 13 teams, e.g. Michigan, Notre Dame, Texas |
| 4-3 | 4-3 with some 4-4 against the run, Nickel on 3rd down, Dime on 3rd and long | 4-3 on early downs, Nickel on 3rd down | 20 teams, e.g. Florida State, Ohio State, Penn State |
| Multiple | 3-4 and 4-3 half and half, 4-4 on 3rd and 4th and 3 | 3-4 on early downs, 4-4 on 3rd down | Arizona, Florida, Navy |

Every style uses Goal Line defense near the goal and short yardage, Dime on 4th and long and its special teams for kicks. Each style's lists also change with the situation (short yardage, passing downs, hurry-up, running out the clock); the tables list everything the style calls.

- **Rosters:** Elevated v1.1.0-beta.7 and later use one roster layout for every team (LE, DT1, DT2, RE, LOLB, MLB1, MLB2, ROLB), so a new defense needs no roster changes.
  - Older ROMs (the original game, and Elevated up to beta.6) still have the original game's two layouts: slot 21 is a tackle (RDT) on 4-3 teams and an inside linebacker (RILB) on 3-4 teams. On those, switching a team between 3-4 and 4-3 switches its layout too (the Rosters tab and its imports follow), but the player in slot 21 is still the one picked for the old defense, so re-import the team's roster.
- A style change doesn't change the Walsh Report's scouting text, which describes some teams' offenses; edit it in the [Walsh Report](#walsh-report) editor.

### OFF and DEF

Every team has an offense and a defense rating. The season's simulated games (computer against computer) and the preseason poll use them; the original game's are EA's own numbers, not worked out from the rosters. **Elevated v1.1.0** shows them under each team on Game Setup as team OVRs ("OFF 80 DEF 75"), and fixes the original game's simulation, which read each team's ratings the wrong way round.

The app shows and edits them as OVRs, 0-99. The game itself keeps a 0-100 rating that follows the OVR on a fixed line (OVR 62 = 0, OVR 98 = 100, about the original game's spread); Elevated v1.1.0 keeps the OVRs too, in its own table. On other ROMs only OVRs from 62 to 98 are stored exactly.

- **Team Swap:** a swapped team gets its College Football USA 97 ratings by default.
- **College Football 27 rosters:** the conversion sets each converted team's OVRs from its starters, the way the Elevated 2026 Season Edition was made: the best player by Overall at QB, HB, 3 WR, TE and the five line spots (OFF) and at LE, RE, 2 DT, the three linebackers, 2 CB, FS and SS (DEF); OVR = 65 + 3 × (their average Overall − 77).

### Home weather

Each team has four weights, 0-15, for how often a season home game is Fair, Windy, Rainy or Snowy (the original teams' add up to 10, e.g. Washington 1-2-7-0, Wisconsin 1-1-1-7, Texas 9-1-0-0). The tab shows the chances as percentages. Exhibition games use the weather picked on Game Setup. A swapped team gets its College Football USA 97 weather by default.

### Walsh Report

Before a game, Bill Walsh reads a scouting report on each team: a paragraph on its offense and one on its defense. **Edit** in the Teams tab (or **Edit Walsh Report** in Team Swap's edit screen) opens both paragraphs with a preview of the report box as the game shows it.

- A report can have up to 650 characters for the offense and the defense together. All 36 reports share one block of text in the ROM, and 650 per team keeps every report in that space, with room left for longer names from a team swap.
- 15 of EA's reports are longer (Ohio State's is 1,010 characters). The first report you save trims them to 650 by dropping their last sentences; the editor names them before you save. After that every report fits, so it doesn't happen again on that ROM. **Back to the loaded report** and Undo bring back a report as it was loaded, trimmed the same way.
- The 138-team 2026 Season Edition keeps its reports in a bigger space of their own, so every team can have 650 characters there and nothing is trimmed.
- The game shows 20 characters to a line and scrolls the box, so a word can be at most 20 characters. Its font draws letters, digits, spaces and `. , ! ? ' " - & ( ) / : ; % + = #`; other characters would show a symbol or a blank, so the editor doesn't take them. Curly quotes and dashes are turned into plain ones.
- In Team Swap, a swapped team's report is the original team's with the new names until you edit it; the edited report goes into the swap file.
- The app also has the Elevated mod's 2026 reports for every FBS team (written with the 2026 Season Edition, facts through Oct. 31, 2026). They name players by the jersey numbers of the built-in CFB 27 rosters, so they come with that import in the Rosters tab (see [CFB 27 rosters](#cfb-27-rosters)).

### College Football 27 reference

Below the teams, a searchable table lists every FBS team in College Football 27 (as of November 2026) with its offense style, its defensive playbook and the Bill Walsh '95 styles recommended for it. **Apply recommended styles** sets them for every team on the ROM that's in College Football 27 (matched by school name, including College Football USA 97's spellings such as USMA for Army); Undo puts back the styles the ROM was loaded with. The recommendations follow these rules:

| College Football 27 | Bill Walsh '95 |
|---|---|
| Offense: Option (Air Force, Army, Navy) | Option |
| Offense: Pro Style, Multiple | Pro Style |
| Offense: Power Spread, Spread Option | Multiple (Pro Style plus Shotgun and Trap) |
| Offense: Spread, Air Raid, Run & Shoot, Veer & Shoot | Shotgun |
| Offense: Pistol | Power |
| Defense: 3-4, 3-3-5, 3-2-6 playbooks (three down linemen) | 3-4 |
| Defense: 4-3, 4-2-5 playbooks (four down linemen) | 4-3 |
| Defense: Multiple | Multiple |

### How it works

- **Ratings and weather:** each team block has a 4-word group (header word 3): home weather (one nibble per kind, Fair to Snow), offense, defense, conference (the Season tab's). Team Swap keeps the group with the slot. Elevated v1.1.0's OVR table is at `0x10DFB0` ("OVR1", then OFF and DEF bytes for the 36 slots); the app writes it only when it's there.
- **Team sets:** the computer's play-calling rules test a team's membership in 8 sets, kept as a bit table at `0x062D87` (8 bytes per set, team t = bit t & 7 of byte t >> 3; its offset is the 8th word of the rule table at `0x06106E`). Offense: sets 0-3 = Option, Pro Style, Multiple, Shotgun; a team in none of them runs Power. Defense: sets 5-7 = 3-4, 4-3, Multiple. Set 4 is tested by no rule and left alone.
- **A style change** puts the team in exactly one offense set (none for Power) and exactly one defense set. On ROMs with the two original roster layouts (not Elevated beta.7+) it also sets the team's bit in the 3-4 roster flags (`0x061068`, clear = 3-4). Nothing else changes, and no free space is used. The app checks that the table is where the original game has it and that its unused bits are clear before writing.
- **Walsh Report:** one CR-separated block at `0x05B2E0`-`0x061066` (23,943 bytes): six intro lines, then each team's offense and defense paragraph. The printer at `0x078FA4` finds a paragraph by counting CRs from the pointer at `0x078FC0` and prints it word by word in a box 20 characters wide and 6 lines high, scrolling as it goes. The app rewrites the block in place and fills what's left with spaces. Details: [docs/walsh.md](docs/walsh.md).
- **The 138-team 2026 Season Edition** keeps these in its own tables above 2 MB: the team sets at `0x218200` (32 bytes per set; the game's set lookup at `0x079A82` reads them there), the OVR table at `0x218000`, and the Walsh Report paragraphs through a table of addresses at `0x218800` (text from `0x219000`, room up to the team blocks at `0x230000`). The app checks that layout and that lookup before writing, packs the report text again on each save and puts `0xFF` back in bytes the text no longer uses. The team groups (ratings and weather) are in each team block, as in the 36-team game.
- **Veer:** Elevated v1.1.0-beta.6 and later give the Option and Power styles the Veer plays; the app recognizes them by their play-list jump at `0x079AAE`.
- **Checksums:** EA's boot check and the Genesis header checksum are recomputed.

### Testing

- 10 Node tests: the original ROM reads as the game's documented teams and styles; every style on every team on the original ROM, Rebalanced v1.0, Elevated beta.11 and its Tulane build reads back, changes only the style table (and the 3-4 flags on the original layout), and undoes exactly; damaged tables are refused; Team Swap builds without styles are unchanged, with styles only the style bytes change; style edits are tracked, named and carried to a new Team Swap result; the College Football 27 table gives the agreed totals, and every original team and every College Football USA 97 team but Idaho (not in College Football 27) finds its match.
- In an emulator (Genesis Plus GX), the title screen's demo games (computer against computer, about 275 play calls per ROM, three matchups each) on test ROMs where every team has one style. Original ROM, every team Option and 4-3: only Wishbone, Flexbone and Goal Line plays, and only 4-3, Nickel, Dime and Goal Line defenses (Notre Dame and Oklahoma included, normally 3-4). Every team Shotgun and 3-4: only I-Form, Pro Form, Shotgun (39 calls), Near, Far and Goal Line plays, and only 3-4, Nickel, Dime and Goal Line defenses. Elevated beta.11, every team Option and Multiple: Veer 71 times besides Wishbone, Flexbone and Goal Line, and 4-3 (77) and 3-4 (69) fronts about half and half with a few 4-4 calls.
- ROMs downloaded from the app are byte-identical to the same changes made with the command-line tools: a Team Swap with styles, style changes in the Teams and Rosters tabs on a Team Swap result, those changes kept after changing the swap, and Apply recommended styles on the original ROM and on a Team Swap result.
- Ratings and weather, 8 Node tests (`npm run test:teams`): the original ROM's words and weather read as documented; OVRs 62-98 round-trip on ROMs without the OVR table, and only the team's group changes; on Elevated v1.1.0 a change writes the OVR table and the words and nothing else; on the Elevated 2026 Season Edition, the built-in Week 9 data gives all 36 teams' OVRs and words exactly as the ROM has them; Team Swap gives Tulane 74/75 and 9-1-0-0 by default, keeps edits, and builds swap files saved before this exactly as before; the CFB 27 conversion sets OFF and DEF and the change is tracked and kept by slot; bad values are refused. (The 2026 Season Edition in these tests is v1.1.0's, with 36 teams.) With the 138-team edition as an optional 5th ROM: every team reads, matches its College Football 27 team and has its recommended styles; a style, OFF/DEF, weather and a Walsh Report edit change only that edition's tables, are tracked, carried and undone byte for byte; the text written back unchanged gives the same bytes; 650 characters for every team fits.
- Walsh Report, 9 Node tests (`npm run test:walsh`): EA's reports and the 15 long ones; trims end at a sentence and keep 450-650 characters; the editor's character, word and length checks; saving a report trims the other long ones once, keeps the text in its space and changes nothing else; undo of one report and of all of them (every byte back); a report in a Team Swap swap file, and the same ROM as writing it in the Teams tab; reports carried by slot to a new Team Swap result, skipped when the slot holds another team; a renamed conference isn't a report edit; the Elevated 2026 Season Edition of v1.1.0; the built-in 2026 reports: one per team of the built-in CFB 27 rosters, all within the editor's rules, and all 36 written with a conversion of the original ROM (or some, with the long others trimmed). In the emulator, Elevated v2.0.0 with the built-in rosters and reports shows Florida State's 2026 report before a game.
- In an emulator: test reports of 650 and 1,000 characters scroll through to their last word, every character was checked on the report screen, and a Team Swap download with an edited report shows it before the game.
- In the browser: a report saved in the Teams tab on the original ROM and an edited report in a Team Swap swap file give ROMs byte-identical to `cli/walsh.ts` and `cli/build.ts`; phone layout.
- In the browser, on Elevated v1.1.0: Pitt → Tulane with OFF 80 and Rain 3 in the edit screen, then Navy's DEF and weather in the Teams tab, then the built-in Week 9 rosters for all 36 teams: each download is byte-identical to `cli/build.ts`, `cli/teams.ts` and `cli/cfb27.ts`. In an emulator, that ROM's Game Setup shows "OFF 80 DEF 75" under Tulane.

Not tested: real hardware.

## Rosters

Load a Bill Walsh College Football '95, College Football USA 96 or College Football USA 97 ROM, pick a team, and change its players' jersey numbers and ratings, or import a spreadsheet for many teams at once. Then download the ROM. Original and modified ROMs both work (Bill Walsh '95 Elevated, formerly Rebalanced, including the 138-team 2026 Season Edition; Team Swap output; an earlier roster edit; a ROM saved by CFB-Walsh.exe). **Use the Team Swap result** opens the ROM you set up in the Team Swap tab, so swaps, season and roster edits end up in one file (the Season tab edits the same ROM).

For a Bill Walsh '95 team, the bar above the roster also has the team's offense and defense [styles](#styles).

Players in these games have no names, only numbers. Each rating is a step from 0 to 15, which the game's roster screen shows as 0, 6, 13 … 93, 100; weight goes in 16 lb steps from 140 to 380. The editor shows the same numbers as the game. A kicker's or punter's Quick is his kick distance in the game, so the editor labels it that way.

### Importing a file

**Import spreadsheet** takes a `.csv` (comma, semicolon or tab) or `.xlsx` (first worksheet) and works out what kind of file it is. The report afterwards says which way it was read.

| File | How it's read |
|---|---|
| A CSV exported here (it has a **Slot** column) | Every row goes to the slot it names. The slots have to fit the ROM's defense (4-3, 3-4 or Elevated); a file made for a different one is refused, with the teams it doesn't fit. |
| CFB 27 ratings | Converted (see [CFB 27 rosters](#cfb-27-rosters)). Bill Walsh '95 for now. |
| Any other sheet | By position and Overall Rating, as below. |

### CFB 27 rosters

Bring in real rosters from EA Sports College Football 27. **CFB 27 rosters (2026, Week 9)** uses the ratings built into the app: EA's as of Week 9 of the 2026 season, the newest when this version was made. **Import spreadsheet** also takes another export: a CSV with one row per player and the column names of EA's ratings site (ea.com/games/ea-sports-college-football/ratings): Team, Name, Position, Overall, Jersey Number, Weight, EA Player ID, Speed, Acceleration, Agility, Strength, Awareness, Play Recognition, Catching, Carrying, Throw Power, Throw Accuracy Short, Mid and Deep, Break Tackle, Trucking, Run Block, Pass Block, Run Block Power, Pass Block Power, Power Moves, Block Shedding, Tackle, Hit Power, Pursuit, Kick Power, Kick Accuracy, Lead Block. Other columns are fine and ignored.

- **Each team gets its own players.** The best CFB 27 players at each position fill the team's slots, with their real jersey numbers. If a school has nobody for a slot, a player from a nearby position fills it (most schools have no fullback, so the best blocking back or tight end plays FB; Air Force's punter also kicks).
- **The game plays the same.** CFB 27 decides who is better than whom; the original game decides how many players get each rating. For every position and rating, the players are ranked and given the original game's own ratings in that order, so a team of elite linebackers gets elite linebackers, while the league as a whole keeps the original spread (as many 100-speed corners as before, and so on).
- **Any number of schools.** The file can have one school or all of them; teams that aren't in it keep their rosters, and you pick which of the found teams to write before anything changes. Ratings are ranked among the players in the file. School names: the ROM's, plus CFB 27's Cal and Pittsburgh. A team-swapped slot takes its new school.
- **Linemen's weight.** Today's offensive linemen are about 25 lb heavier than the original game's, but weight matters in line play, so the conversion keeps the original weights. By default it also makes the roster screen show offensive linemen 25 lb heavier (display only; the game plays the same). The editor and the CSV export show the same numbers as the screen.
- **Team ratings.** By default the conversion also sets each converted team's [OFF and DEF](#off-and-def) from its new starters (the list of teams shows them first).
- **Walsh Reports.** With the built-in rosters (not with another file), the conversion also gives each converted team the Elevated mod's 2026 [Walsh Report](#walsh-report), on by default. The reports name players by their jersey numbers in those rosters. If you leave teams out, their reports stay, and any of theirs longer than 650 characters are trimmed. Edit any report afterwards in the Teams tab.
- Works with the original ROM, Elevated (its DT1/DT2, MLB1/MLB2 defense), Team Swap results and the 138-team 2026 Season Edition (all 138 teams; the built-in rosters rebuild its own rosters exactly, so you can start over from them after your edits). CF96 and CF97 are planned.

### Spreadsheets by position

For sheets without a Slot column that aren't CFB 27 data: one row per player, all teams in one sheet.

| Column | Used for |
|---|---|
| Team | School ("Texas") or school and nickname ("Texas Longhorns") |
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
- Slots: BW95 has 32 players per team (QB, HB1-2, FB, five linemen, SE, FL, WR1-2, TE1-2, K, P, 4-3 or 3-4 front, PLB, four CBs, SS, FS, FS2). The four best WRs fill SE, FL, WR1 and WR2. On 3-4 teams the best DT is the NT and the MLBs fill LILB and RILB. The PLB is the best outside linebacker left over. On Elevated ROMs every team has DT1, DT2, MLB1 and MLB2, filled by the best DTs and MLBs. CF96/97 have 45 players per team (two QBs, three HBs, backups at most positions).
- Slots nobody fills keep their current player, and empty cells keep the current value.
- The report lists teams, positions and columns it didn't use, and who went to which slot.

### CSV export

**Export team CSV** and **Export all teams CSV** write the same columns plus **Slot** (QB, HB1, LDE …), with the values the game shows. Edit the file and import it again: rows with a Slot go to that exact slot, so an unchanged export imports back without changing a byte. Teams the ROM doesn't have are skipped.

### How it works

- **Rosters:** each team's roster is in its team block (BW95 table `0x0028DC`, CF96/97 table `0x002CEA`): 32 players × 4 bytes in BW95, 45 × 5 bytes in CF96/97. Byte 0 is the jersey number (BCD), then six 4-bit ratings; the order depends on the position (for example QB: weight, quickness, speed, awareness, range, power). The fifth CF byte is kept as it is.
- **3-4 teams (BW95):** a bitfield at `0x061068` (bit clear = 3-4) picks the roster screen's labels. The editor and the import read it from the ROM; changing a team's defense style sets it. Elevated ROMs are recognized by their relabeled 4-3 list (`0x62E6E`: DT1 instead of DLT) and use one layout for every team.
- **CFB 27 conversion:** a table of the original games' rating distributions (per position and rating, how many players have each step; `src/core/rosterStockDists.json`) is built in. Each converted rating is the original game's step at the player's rank within his position. Details and the reasons behind each mapping: [docs/rosters.md](docs/rosters.md#cfb-27-conversion).
- **OL weight tweak (BW95):** `0x06B03C` jumps to 30 bytes at `0x1EFF20`-`0x1EFF3D` that add 25 lb to the shown weight of rows LT-RT on the Team Rosters screen. The space is checked to be unused first.
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

- Export → import of every team leaves all three ROMs byte-identical, also with the OL weight tweak.
- CFB 27: EA's Week 9 ratings converted into the original ROM, Elevated beta.7 and its Tulane build give exactly the original game's spread for every position and rating, and the same bytes as the reference conversion the method was worked out with. In the emulator, Florida State's roster screen shows the real jersey numbers and, with the tweak, OL weights of 309-357 lb. Files made for another defense are refused; a file with a missing column says which.
- Imports checked on BW95's roster screen in an emulator: numbers, ratings and weights show as expected, on a 4-3 team, a 3-4 team (NT, LILB, RILB) and a team-swapped Tulane. Unfilled slots keep their players.
- Edited CF96 and CF97 ROMs boot (with a wrong checksum CF97 stays on a black screen).
- ROMs downloaded from the app are byte-identical to the same edits made with the code in Node; a Team Swap result with roster edits differs from the plain swap only in the edited players and the checksums.

## Dynasty

A companion site for playing seasons of the 138-team 2026 Season Edition with dynasty support (Bill Walsh '95 Elevated v2.0.1-test9 or later; older ROMs and saves aren't supported before the dynasty's first public release). The app owns the players; the game plays the games. Every team is 64 players: its Active Roster (the 32 in the game) and a backup for each of them. It keeps every season's record, runs the offseason (graduation, progression, the transfer portal, random signing classes, cuts) and writes the next season's rosters into your ROM.

1. **Start a dynasty** on the Manage page: name it and choose your ROM. Each team's Active Roster is the ROM's converted players (built-in CFB 27 ratings, 2026 season, Week 9; the only use of CFB 27 data); its backups are the next-best real player for each spot, or, if you prefer, generated backups (Manage, first season only). A redshirted player starts one class up (RS FR is a SO, RS SR a SR+). The team logos are read from your ROM and stay in your browser.
2. **Play** the season in the game (New Season, any schedule). The first season needs no download: play it on your ROM as it is (the app's rosters for 2026 are the ROM's own). From the second season on, the app gives you each season's ROM at the end of the offseason (a window asks until you download it; Manage has it too): its dynasty area holds the dynasty's rosters and team OVRs (Season mode plays them, Exhibition keeps the real 2026 rosters), and New Season marks the save with the dynasty and season. From the second season the app only imports saves with that mark, of the dynasty's current season.
3. **Import your save** after you play: the `.srm` battery save from RetroArch's Genesis Plus GX core. The app reads every result, the game's Top 25, the playoff field and each team's season stats, and marks the teams you play as. Import again as often as you like; a save with fewer results than the last import is refused (it's older, or another season), unless you tick the box.
4. **Run the offseason** on the Offseason page, download the new season's ROM, and start a New Season with it. Repeat.

The pages:

- **Home:** a score ticker for the latest week and the stories of the week, written from the results (upsets, including by team rating, Top 25 games, routs, your games, a new No. 1, unbeaten teams and streaks, milestones, the playoff field, the national leaders, champions; import your save every week to also get the players of the week, since the game keeps season totals only; a player of the week's headline opens his game's stats, and stories about a player link to his page), with headlines and your teams beside them. Below the stories, the Top 25 (on wider screens the top four as cards, the rest in columns). The side column also has next week's big games (both teams ranked; a ranked team against a team with a power rating within 15% of its own; two teams at the top of their conference) and a Heisman watch; across the page below come the playoff picture (if the season ended today: conference leaders take the automatic bids, the rest by the Top 25), the national leaders and your conference's standings. In the offseason the side column shows your commitments and the recruiting and class rankings.
- **Scores** by week, **Standings** by conference, the **Top 25** with movement.
- **Teams:** each team's prestige (1-6 stars), offense and defense OVR (the ROM's), schedule and results, history, season stats, its Active Roster (the 32 players in Bill Walsh '95, in the game's roster order) and its backups (QB2, HB3, HB4 …), with an OVR for each worked out from his game ratings (formulas in [docs/dynasty.md](docs/dynasty.md)). Each **player** has a page with his stats and his Bill Walsh '95 ratings: the numbers the game shows, a meter of the game's 15 steps, his rank among everyone at his position on every team (HB1 and HB2 together, all five linemen, all four receivers and so on), and a shape of his ratings against their average.
- **Stats:** the national leaders. **History:** national champions, single-season records and your teams by season.
- **Prestige:** every school has 1-6 stars. The start comes from College Football 27's own prestige; after each season a school moves one star at most toward the tier of its final poll place (top 10: 6 stars, top 20: 5, top 35: 4, top 70: 3, top 100: 2, the rest: 1). Prestige drives recruiting and the transfer portal.
- **New players' names and looks:** signing classes and walk-ons get names from the CFB 27 players' first and last names (short ones only: first names up to 10 characters, last names up to 12, in the game's font; never a real player's full name), paired so they fit together, with a skin tone (four: light, tan, brown, dark) for the app's portraits. The share of Black and White players follows the position (for example CB 98%, HB 95%, QB 45%, K 4%); the starting CFB 27 players get their tones the same way, guided by their names. Details: [docs/dynasty.md](docs/dynasty.md).
- **Ratings:** after the first season's conversion from CFB 27, every player keeps his own Bill Walsh '95 ratings as the numbers the game shows (0-100); the ROM gets the step each number has reached (86 is step 13, 93 step 14, 100 step 15). Players develop between the steps (Awareness fastest, then technique, Power, Range, Quickness, and Speed slowest; a Training focus on the Offseason page shifts this a little for your teams), and the player page shows how far each rating is toward the next one. Depth charts put the best OVR at each spot.
- **Experience:** next to a player's class, the letters he has earned at his school (1L, 2L …), TR with the school he came from, or HS for a first-year player.
- **Careers:** player pages show every season's stats with the school he played for, and any transfers. The app keeps every player's ratings for each season, for a career view later.
- **Recruiting stars:** every player signed in the dynasty keeps his stars (or Walk-on) and his class year on his player page. A few walk-ons are diamonds in the rough with a top recruit's potential.
- **Headshots:** every player page has a 16-bit style portrait in his team's jersey, made from his skin tone, his position's build and his ID (hair, facial hair, expression, eye black), the same every time. **Edit appearance** on the player page changes skin tone, hair, hair color, facial hair, expression and eye black any time (only the app's portrait; nothing goes into the ROM).
- **Editing:** in the offseason and before a season's first import, any player of any team: name, position, class, number, size, hometown, potential, team, and his ratings (0-100), from his player page; add players from a team page; release them. Or download every player as a CSV (Manage), edit it in a spreadsheet and import it again, with a preview of every change.
- **Lineups:** on your teams' pages, a menu in the Pos column moves a player to another spot, on the Active Roster or in the backups; the player there takes his place (★ marks the Active Roster spots). A player can play any spot of his own position, and change position once a season: HB and FB, FB and TE, DE and OLB, OLB and MLB, K and P (no CB to S, no DE to DT). Lineups can change until the season's first results are imported (the game's stats belong to the spot); download the season's ROM again afterwards. Each offseason sets the depth charts again.
- **Offseason rules:** Manage → Offseason rules (spoilers): every number the offseason uses (departures, development, transfers, recruiting points and scouting costs, pitches, walk-ons, roster minimums, prestige), changeable per dynasty, with export and import to reuse them in another dynasty.
- **Recruiting pitches:** playing time, program prestige, being close to home, academics (College Football 27's grades) and championship contender (last season and the roster as it stands). What a prospect cares about is hidden: pitch him each week and see his reaction (+ his interest and your school is strong there, ~ in between, − his interest but your school is weak there, ✗ not interested); a good pitch makes your points count more, a bad one less. Points go further with in-state prospects and pipeline states (4+ players from a state on your roster). Filter prospects by state and sort by stars, OVR or any rating you've scouted.
- **Offseason steps:** a projected depth chart for your teams (a player you make a starter is less likely to transfer), players leaving (graduates, early entries, transfers), the transfer portal or recruiting (every prospect has five top schools and what he cares about most; a needs table by position; your own transfers start on your board and you can win them back), signing day and cuts, then the final depth chart and the ROM. Backups and depth players who don't get the ball look for a starting job elsewhere; players who got playing time stay.
- **Offseason:** after the national championship (import the save with the last game first), step by step: departures (SR+ graduate; seniors go pro, come back as SR+ or graduate; juniors may go pro), the transfer portal (only backups who have waited two seasons) and signing day (quick random classes by need and prestige, or five weeks of recruiting in which you spend points and make offers on high-school players and portal transfers, and scout high-school players: 10 points shows a prospect's OVR, 20 more all his ratings), cuts to 64 when needed (you choose for your teams, with a suggestion: next season's Active Roster stays, seniors and backups with the least future go first; every team keeps at least 2 QBs, 4 HBs and FBs, 5 WRs, 3 TEs, 7 offensive linemen, 5 defensive linemen, 5 linebackers, 5 CBs, 4 safeties and 2 kickers and punters), or sim any of it: a recruiting week, the rest of recruiting, the cuts, or the whole offseason, walk-ons, offseason training (returning players develop, shaped by your Training focus; new signees don't yet; a Training results page lists any team's players by most improved, with each rating's change), and the next season's depth charts. Then **Download the ROM** for the new season: every team's 32 players and the team OVRs written into your ROM (its dynasty area). Start a New Season in the game with it.
- **Manage:** import saves, choose your teams, download the dynasty file (a backup, or to move it to another computer; it has no game art, so load your ROM again there for the logos), and open, rename or delete dynasties.

Dynasties are kept in your browser (IndexedDB), with your ROM for the offseason and the season ROMs (the ROM is never in the dynasty file). Clearing the site's data deletes them, so download the dynasty file now and then.

### How it works

The save's season block and stats tables, the dynasty file and the plan for the next phases: [docs/dynasty.md](docs/dynasty.md).

- **ROM areas:** the season ROM is written into the dynasty area of Elevated's 2026 Season Edition (v2.0.1-test9 on), `0x3E0000`-`0x3FFFFF`: a header with the ID block (dynasty, season, roster version), the season rosters (138 × 32 × 4 bytes at `0x3E0100`), an OVR table (`0x3E4600`), the sim words (`0x3E4800`) and the names set for Team Rosters' names view (`0x3E5000`, "NAM1": class, first and last name per slot, in the game's font). The app writes it (and creates dynasties) only when the ROM has the dynasty hooks (the mark `BW95DYN` at `0x2B0000`) and Team Rosters' names (v2.0.1-test9 on) and the area is free (all `0xFF`) or already holds a dynasty header. Checksums are recomputed; nothing else changes.

### Testing

`npm run test:dynasty -- ELEVATED_2026_138_DYNASTY SAVE.srm` (a ROM with the dynasty support, v2.0.1-test9 or later; the save of any season of the 138-team edition, which the test marks for its dynasty) reads a real save in both layouts (the emulator's and the data bytes alone), checks that the stats add up and the ranks follow the game's order, creates a dynasty (twice, the same), imports the save (the same save replaces its import; an older one and one without a season are refused), checks records, standings, leaders and stories, round-trips the dynasty file and reads the art. The pages were checked in a browser with a save after Week 2 (Texas State, 100 games played).

## Development

```sh
npm install
npm run dev      # local dev server
npm run build    # type-check and build to dist/
```

The app is a static site (Vite + React + TypeScript), so it deploys to Vercel as-is: import the repo and keep the detected Vite settings (build `npm run build`, output `dist`).

How the Rosters tool reads and writes the games (formats, checksums, import rules, tests): [docs/rosters.md](docs/rosters.md).

Roster engine tests need your own ROMs (`.md`, `.bin`, `.gen` or `.zip`):

```sh
npm run test:rosters -- BW95.md CF96.md CF97.md [Elevated-2026-v2.0.0.md]
```

How the Patch tab works, the patch list format and the steps for a new release: [docs/patches.md](docs/patches.md). Its tests take the original BW95 ROM, a local copy of the [Elevated repo](https://github.com/jd6-37/Bill-Walsh-CFB-95-Elevated) and optionally CF97 (to check that each patched ROM takes a team swap):

```sh
npm run test:patch -- BW95.md path/to/Bill-Walsh-CFB-95-Elevated [CF97.md]
```

How the Season tool works: [docs/season.md](docs/season.md). Its tests take the original BW95 ROM, CF97 (for the Team Swap checks) and optionally more BW95 ROMs such as Elevated builds (a 138-team 2026 Season Edition among them gets its own test); `cli/season.ts` applies a season setup from a JSON spec, and `cli/season138.ts` lists or changes the 138-team edition's conferences:

```sh
npm run test:season -- BW95.md CF97.md [Elevated.md …] [Elevated-2026-138-teams.md]
npx tsx cli/season.ts BW95.md out.md spec.json
npx tsx cli/season138.ts Elevated-2026-138-teams.md out.md spec.json   # {"names": {"SEC": "Southeastern"}, "conf": {"Tulane": "SEC"}, "weeks": {"SEC": {"start": 2, "games": 6}}}
```

How the Teams tab works: styles in [docs/styles.md](docs/styles.md), ratings and weather in [docs/teams.md](docs/teams.md). The style tests take the same ROMs as the Season tests; the ratings tests take the original ROM, CF97 and the two Elevated v1.1.0 editions, and optionally the 138-team 2026 Season Edition. `cli/styles.ts` lists or changes a ROM's styles, `cli/teams.ts` its styles, OVRs and weather, and `cli/build.ts --style Pitt=Option,3-4` sets a swapped team's styles:

```sh
npm run test:styles -- BW95.md CF97.md [Elevated.md …]
npm run test:teams -- BW95.md CF97.md Elevated.md Elevated-2026.md [Elevated-2026-138-teams.md]
npx tsx cli/styles.ts BW95.md out.md "Florida State=Option,3-4" "Navy=,Multiple"
npx tsx cli/teams.ts BW95.md out.md --ovr "Navy=75,85" --weather "Navy=5,2,2,1" --style "Navy=Option,3-4"
```

How the Walsh Report editor works: [docs/walsh.md](docs/walsh.md). Its tests take the original ROM, CF97 and optionally the Elevated 2026 Season Edition v1.1.0 (the 36-team one); `cli/walsh.ts` lists a ROM's reports or sets one:

```sh
npm run test:walsh -- BW95.md CF97.md [Elevated-2026.md]
npx tsx cli/walsh.ts BW95.md
npx tsx cli/walsh.ts BW95.md out.md --team Pitt --offense "…" --defense "…"
```

The CFB 27 conversion also runs from the command line, and the stock rating table can be rebuilt from the three original ROMs:

```sh
npx tsx cli/cfb27.ts "Bill Walsh College Football 95 (USA).md" public/data/ea-cfb27-ratings-2026-week9.csv rosters.md [--no-ol-tweak] [--no-ratings] [--teams "Texas,Ohio State"] [--walsh public/data/walsh-reports-2026-week9.json]
npx tsx cli/stockdists.ts src/core/rosterStockDists.json BW95.md CF96.md CF97.md
```

The built-in 2026 Walsh Reports (`public/data/walsh-reports-2026-week9.json`) are read from the 138-team 2026 Season Edition, which holds the final text for every team, and keyed by the built-in CSV's team names. To rebuild them after a new release:

```sh
npx tsx cli/walshdata.ts --rom "Elevated 2026 Season v2.0.0.md" [--source "release name"]
```

The 68000 helpers are in `asm/`; `asm/build.sh` reassembles them into `src/core/helpers68k.ts` (needs `binutils-m68k-linux-gnu`).

A Node CLI builds ROMs with the same code, which is how builds were tested in an emulator. The Team Swap tests take the original BW95 ROM, CF97 and optionally the Elevated 2026 Season Edition v1.1.0 (the 36-team one):

```sh
npx tsx cli/build.ts --bw "Bill Walsh College Football 95 (USA).md" --cf "College Football USA 97 (USA).zip" \
  --pair Pitt=Tulane --out swapped.md --save-swaps swaps.json
npx tsx cli/build.ts --bw ... --cf ... --swaps swaps.json --out swapped.md
npm run test:swap -- BW95.md CF97.md [Elevated-2026.md]
```

## Credits

Created by JD637.
