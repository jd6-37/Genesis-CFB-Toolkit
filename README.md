# Genesis CFB Toolkit

This repo is the website of the Bill Walsh '95 Elevated mod and its two apps, at https://bw95mod.com:

- **The site** (`/`): the mod's homepage, the [manual](#the-site) (`/manual`), **Rosters** (`/rosters`: every team's roster card and a table of every player, for the 2026 and 1994 editions, the original game and the historic teams) and **Insights** (`/insights`), long reads on the mod and the game's code.
- **The Mod Toolkit** (`/toolkit`) and **Dynasty** (`/dynasty`), described below.

The site can be installed as an app from the browser (Add to Home Screen), and pages you have opened still load offline. Search engines and AI agents get a sitemap (`/sitemap.xml`), `/llms.txt` and structured data on every page (`docs/site.md`).

Browser-based modding tools for EA's college football games on the Sega Genesis: Bill Walsh College Football '95, College Football USA 96 and College Football USA 97.

Everything runs in your browser. Your ROMs are opened on your own computer and are never uploaded anywhere. The apps contain no ROM data or artwork (the site's screenshots and clips of the mod, and its Rosters section's rosters and logos, aside); you bring your own ROMs. It does come with two tables for the College Football 27 roster conversion: how many players the original games have at each rating step, and EA's College Football 27 player ratings (2026 season, Week 9) for the built-in rosters (with 35 jersey numbers changed to ones the game allows at the player's position, the same the ROM uses). It also has the Elevated mod's 2026 Walsh Reports for every FBS team, which go with those rosters.

## Tools

- **[Patch](#patch):** start here. Load your Bill Walsh College Football '95 ROM and, if it's the original game, add the latest release of the Elevated mod's patches.
- **[Team Swap](#team-swap):** swap College Football USA 97 teams into Bill Walsh College Football '95.
- **[Season](#season):** rename the four conferences, choose which teams play in each, and lock in schedules in Bill Walsh '95.
- **[Teams](#teams):** for each Bill Walsh '95 team, choose the offense and defense the computer runs, the team's OFF and DEF ratings and the weather in its home games, and write its Walsh Report.
- **[Rosters](#rosters):** edit the players of Bill Walsh '95, CF96 or CF97, team by team or from a spreadsheet (CSV or Excel), or bring in real College Football 27 rosters (built in: 2026 season, Week 9).
- **[Dynasty](#dynasty):** a sports news site for your season of the 138-team 2026 Season Edition or the 107-team 1994 Season Edition: import your battery save and read the scores, standings, Top 25, stats and stories, season after season. Open it with **Dynasty** at the top of the page, or at `/dynasty`.

Each tool has its own tab. The Toolkit (`/toolkit`) opens on Patch; `#swap`, `#season`, `#teams` or `#rosters` at the end of the address opens that tab directly (`/toolkit#rosters`; `#styles`, the Teams tab's old address, still works). Addresses from before the site (`/#rosters`, `/#dynasty/…`) still lead to the same place. Moving between the Toolkit and Dynasty with the links at the top keeps the page loaded, so ROMs open in the Toolkit are still there when you come back.

**Season, Teams and Rosters edit the same ROM.** They open the Patch tab's ROM on their own; you can also load a ROM in any of them, or take the Team Swap result, then switch between them as often as you like. **Download ROM** in any of the three saves everything, named after the ROM with `[Season]`, `[Teams]` and/or `[Rosters]` added. Team Swap builds on the Patch tab's ROM, not on the one these tabs edit; if you change the swap and take its result again while you have changes, the app asks: **Keep my edits** puts every team's roster, the conferences and schedules, and the styles, ratings and weather you changed into the new ROM, by slot (a swapped team gets the edits made for its slot), or **Start fresh**. The same question comes up when you open another ROM file of the same game.

## Patch

**ROM downloads:** every ROM the Toolkit and the Dynasty app hand out (patched, Team Swap, edited, season ROMs) comes as a `.zip` with the `.md` inside, a third of the size. RetroArch and most emulators load the zip as it is (RetroArch's file browser doesn't list `.md` files by default). Only a flash cartridge needs it unzipped.

Start here. Load your Bill Walsh College Football '95 ROM (`.md`, `.bin`, `.gen` or `.zip`):

- **The original game:** pick a patch and choose **Apply patch**. The app downloads the patch from the [Elevated](https://github.com/jd6-37/Bill-Walsh-CFB-95-Elevated) mod's GitHub page, applies it in your browser and checks the result, so it always offers the latest release. **Download patched ROM** saves the patched ROM, and **Back to the original game** undoes the patch. **Use a .bps file** applies a patch you downloaded yourself, for example if GitHub can't be reached.
- **A ROM with a released patch:** the app says which release it has, and whether a newer one is out. Patches go onto the original game only, so to update, load the original ROM and patch it here.
- **Any other modded or edited ROM:** used as it is.
- **The 2026 Season Edition of Elevated v2.0.0 and later** (a 4 MB ROM with all 138 FBS teams; v2.1.0's 1994 Season Edition with 107 teams works the same way): the Patch tab makes it and recognizes it, and the Season, Teams and Rosters tabs edit it: its conferences and their schedule weeks, and all 138 teams' styles, OFF and DEF, home weather, Walsh Reports and players (**Edit season, teams and rosters** under Next). Team Swap doesn't take it (it already has every FBS team), so that tab is grayed out. To bring in CF97 teams, start from the original game or the Elevated edition with the original 36 teams.
- **The 1994 Season Edition** (a 4 MB ROM with 107 teams, on the 2026 edition's layout): the same, with all 107 teams. Its Season tab has 11 weeks and the bowls (see [The 1994 Season Edition](#the-1994-season-edition)); the Teams tab leaves out the College Football 27 recommended styles and the Rosters tab the built-in CFB 27 rosters (both are 2026's).

**Planning a dynasty?** After the Patch tab patches a Season Edition, it asks first: **I want to play a dynasty: set it up** opens the Dynasty app's Get started at step 2 with this ROM (no download here: the setup's last step gives the ROM to play), and **No dynasty: go on to customize** shows the usual download and Next steps (with a link back to the dynasty setup until you customize). A ROM changed in the Toolkit won't work with the Dynasty app; rosters, coaches, conferences and the schedule are edited in the dynasty's setup instead. A Season Edition loaded as released gets the same link.

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
- **Season sim** (2026 test33 / 1994 test36 on): how the game decides the games nobody plays. **Rating weight** (default 8; the original game's 4): how much the better team's ratings count. **Scoring chances** (3, 5 or 9 a quarter; default 5, the original 3). **Roll range** (default 1100, the original 1350): lower means each chance scores more often; the range it may take depends on the scoring chances (3: 700-1600, 5: 900-1600, 9: 1300-1600), and changing the chances moves it into range. 9 chances or a low roll range give very high scores; from 2026 test37 / 1994 test40 the ROM stops a team's score at 70 in a blowout. **Home edge** (2026 test34 / 1994 test37 on; 0-40, default 16, about 58% home wins; the original game has none). Each changes scoring and upsets together; **Reset to the defaults** puts the ROM's values back. How it works: three words in the ROM lane's sim patch (0x2D6008, 0x06F120, 0x06F124, 0x2D601E; `src/core/simSettings.ts`).
- **Sim stats** (2026 test39 / 1994 test42 on): multipliers for the players' stats in simulated games, one each for **Passing**, **Rushing**, **Interceptions**, **Sacks** and **Tackles** (50-300%, steps of 10; default 100%, the game's own numbers; touchdowns are never scaled). Longer Game Length settings already give simulated games more plays, so long games may want them all raised. The Dynasty app keeps its own on the Offseason rules page and writes them into every season ROM. How it works: the ROM lane's "SST1" table at 0x2D6400 (`src/core/simStats.ts`).
- The Real 2026 schedule keeps its games; there the conferences decide the standings and the title games. Changes take effect in a new season. From v2.1.1, once a team changes conference, Game Setup's Schedule offers Random only, since the real schedule no longer fits the conferences (moving the teams back brings Real 2026 back as the default). The Toolkit doesn't change the power-on difficulty (Smart from v2.1.1). **Undo season changes** puts everything back as loaded. There's no season file for this edition.
- How it works: each team's conference is its ratings group's word +6 (0-9, 10 = Independents), the names are 22-character strings in the season engine's table (the Rankings screen's titles), and the weeks are two 11-byte tables (first week, games) the engine reads at New Season; the app finds all three through the engine's own code and checks them before writing. Details: [docs/season.md](docs/season.md#the-138-team-2026-season-edition).
- Checked: the same edits made in the app and with `cli/season138.ts` give the same ROM; in an emulator a Random season on an edited ROM gives the moved teams their new conference's games in the set weeks, shows the new names on the Rankings screen, and plays through the title games and the playoff to the championship.

### The 1994 Season Edition

The 107-team 1994 Season Edition is on the same season engine with 11 weeks, so its Season tab is the 2026 edition's with these differences: the conference games have to end by week 11; there's no playoff, so each conference card shows the bowl its champion goes to (by its place in the list: the first to the Sugar Bowl, the second and sixth to the Rose Bowl …); the **Title game** switches and the season sim are the same, and the first conference's card (the SEC) has **1994 SEC divisions** (1994 test33 on; as released the SEC plays its title game on them): its teams are listed as East and West, a team that takes another's place (one moves in, one moves out) takes its division, and with another number of teams the divisions are off until the count is back. The Real 1994 schedule keeps its games; there the conferences decide the standings, the title games and the bowls.

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

The Teams tab lists every team of a Bill Walsh '95 ROM (36; 138 in the 2026 Season Edition of Elevated v2.0.0 and later, 107 in the 1994 Season Edition) with the settings that belong to a team rather than its players: the offense and defense the computer runs, the team's OFF and DEF ratings, its home weather and its Walsh Report. Undo puts a team back as the ROM was loaded.

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
- **College Football 27 rosters:** the conversion sets each converted team's OVRs from its starters, the way the Elevated 2026 Season Edition was made: the best player by Overall at QB, HB, 3 WR, TE and the five line spots (OFF) and at LE, RE, 2 DT, the three linebackers, 2 CB, FS and SS (DEF); the scale follows the ROM: 74 + 2 × (their average Overall − 77), and above an average of 85.5 91 + 4 × (average − 85.5), on 2026 test34 and later (test33: the first part only), whose sim is tuned for this narrower spread; 65 + 3 × (average − 77) on older ones.

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

### Alternate uniforms

On the 138-team 2026 Season Edition and the 107-team 1994 Season Edition with the uniform picker (Elevated v2.0.1-test14 and later of either edition), a team can pick other helmets, jerseys and pants on the controller screen (Y on a 6-button pad). **Alternate uniforms** in the Teams tab edits what the picker offers, team by team:

- **Home jersey:** Dark at home (the default) or White at home. The visitor then gets the other one.
- **Extra helmets, dark jerseys, white jerseys and pants.** A team's own home and away uniforms are always its first choices and aren't listed. **Add** starts a new piece as a copy of the team's own; pick its colors with the Genesis color picker. Picking a helmet's shell or a jersey's or the pants' main color also sets the lighter and darker shades, which you can change afterwards.
- At most 7 extra helmets, 7 extra pants and 7 extra jerseys (dark and white together) per team: the picker's menu shows single digits.
- **Undo** puts a team's, or every team's, uniforms back as the ROM was loaded.

The extras are in a table ("KIT1") where the ROM's manifest entry KIT1 says: 8 KB at `0x2DC200`-`0x2DE1FF` from 2026 v2.1.1-test23 on; 4 KB at `0x2B6000`-`0x2B6FFF` in the 1994 edition and 2026 up to test22 (an entry with size 0, or no manifest). The app rewrites only that table, and only when the ROM has it. The table's team count (138 or 107) comes from the ROM. `npm run test:kits -- ELEVATED_2026_138` (or the 1994 ROM) checks reading, writing and the limits; writing unchanged uniforms leaves the table's bytes as they are.

### College Football 27 reference

Below the teams, a searchable table lists every FBS team in College Football 27 (as of November 2026) with its offense style, its defensive playbook and the Bill Walsh '95 styles recommended for it. (Not on the 1994 Season Edition: these are 2026 schemes.) **Apply recommended styles** sets them for every team on the ROM that's in College Football 27 (matched by school name, including College Football USA 97's spellings such as USMA for Army); Undo puts back the styles the ROM was loaded with. The recommendations follow these rules:

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

Players in these games have no names, only numbers. Each rating is a step from 0 to 15, which the game's roster screen shows as 0, 6, 13 … 93, 100; weight goes in 16 lb steps from 140 to 380. The editor shows the same numbers as the game. On the Elevated Season Editions with the new ratings (2026 test60 and 1994 test61 on), ratings are the 0-99 numbers the game's Team Rosters shows, on CFB 27's scale (a number means the same at every position); you type the number in, and spreadsheets are read and written in the same numbers. A kicker's or punter's Quick is his kick distance in the game, so the editor labels it that way.

### Importing a file

**Import spreadsheet** takes a `.csv` (comma, semicolon or tab) or `.xlsx` (first worksheet) and works out what kind of file it is. The report afterwards says which way it was read.

| File | How it's read |
|---|---|
| A CSV exported here (it has a **Slot** column) | Every row goes to the slot it names. The slots have to fit the ROM's defense (4-3, 3-4 or Elevated); a file made for a different one is refused, with the teams it doesn't fit. |
| CFB 27 ratings | Converted (see [CFB 27 rosters](#cfb-27-rosters)). Bill Walsh '95 for now. |
| Any other sheet | By position and Overall Rating, as below. |

### CFB 27 rosters

Bring in real rosters from EA Sports College Football 27. **CFB 27 rosters (2026, Week 9)** uses the ratings built into the app: EA's as of Week 9 of the 2026 season, the newest when this version was made. **Import spreadsheet** also takes another export: a CSV with one row per player and the column names of EA's ratings site (ea.com/games/ea-sports-college-football/ratings): Team, Name, Position, Overall, Jersey Number, Weight, EA Player ID, Speed, Acceleration, Agility, Strength, Awareness, Play Recognition, Catching, Carrying, Throw Power, Throw Accuracy Short, Mid and Deep, Break Tackle, Trucking, Run Block, Pass Block, Run Block Power, Pass Block Power, Power Moves, Block Shedding, Tackle, Hit Power, Pursuit, Kick Power, Kick Accuracy, Lead Block. Other columns are fine and ignored.

- **Each team gets its own players.** The best CFB 27 players at each position fill the team's slots, with their real jersey numbers. A number the game doesn't allow at a position (offensive linemen wear 50-79 and nobody else on offense does; CFB 27 has a few tight ends there) is replaced by a free one the position does wear, and the summary lists those players. The spreadsheet import does the same for a number that is new to a slot. If a school has nobody for a slot, a player from a nearby position fills it (most schools have no fullback, so the best blocking back or tight end plays FB; Air Force's punter also kicks).
- **The game plays the same.** CFB 27 decides who is better than whom; the original game decides how many players get each rating. For every position and rating, the players are ranked and given the original game's own ratings in that order, so a team of elite linebackers gets elite linebackers, while the league as a whole keeps the original spread (as many 100-speed corners as before, and so on).
- **Any number of schools.** The file can have one school or all of them; teams that aren't in it keep their rosters, and you pick which of the found teams to write before anything changes. Ratings are ranked among the players in the file. School names: the ROM's, plus CFB 27's Cal and Pittsburgh. A team-swapped slot takes its new school.
- **Linemen's weight.** Today's offensive linemen are about 25 lb heavier than the original game's, but weight matters in line play, so the conversion keeps the original weights. By default it also makes the roster screen show offensive linemen 25 lb heavier (display only; the game plays the same). The editor and the CSV export show the same numbers as the screen.
- **Team ratings.** By default the conversion also sets each converted team's [OFF and DEF](#off-and-def) from its new starters (the list of teams shows them first).
- **Walsh Reports.** With the built-in rosters (not with another file), the conversion also gives each converted team the Elevated mod's 2026 [Walsh Report](#walsh-report), on by default. The reports name players by their jersey numbers in those rosters. If you leave teams out, their reports stay, and any of theirs longer than 650 characters are trimmed. Edit any report afterwards in the Teams tab.
- Works with the original ROM, Elevated (its DT1/DT2, MLB1/MLB2 defense), Team Swap results, the 107-team 1994 Season Edition (all 107 teams; no built-in rosters, which are 2026's) and the 138-team 2026 Season Edition (all 138 teams; the built-in rosters rebuild its own rosters exactly, so you can start over from them after your edits). CF96 and CF97 are planned.

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
- Slots: BW95 has 32 players per team (QB, HB1-2, FB, five linemen, SE, FL, WR1-2, TE1-2, K, P, 4-3 or 3-4 front, PLB, four CBs, SS, FS, FS2). The four best WRs fill SE, FL, WR1 and WR2. On 3-4 teams the best DT is the NT and the MLBs fill LILB and RILB. The PLB is the best outside linebacker left over. On Elevated ROMs every team has DT1, DT2, MLB1 and MLB2, filled by the best DTs and MLBs. From v2.0.1-test17 (and the 1994 edition's test11) the game calls the third and fourth receivers WR3 and WR4 and the cornerbacks CB1 to CB4 (CB1 and CB2 start); the editor shows what the ROM shows, and a CSV may use either set of labels. CF96/97 have 45 players per team (two QBs, three HBs, backups at most positions).
- Slots nobody fills keep their current player, and empty cells keep the current value.
- The report lists teams, positions and columns it didn't use, and who went to which slot.

### CSV export

**Export team CSV** and **Export all teams CSV** write the same columns plus **Slot** (QB, HB1, LDE …), with the values the game shows. Edit the file and import it again: rows with a Slot go to that exact slot, so an unchanged export imports back without changing a byte. Teams the ROM doesn't have are skipped.

### How it works

- **Rosters:** each team's roster is in its team block (BW95 table `0x0028DC`, CF96/97 table `0x002CEA`): 32 players × 4 bytes in BW95, 45 × 5 bytes in CF96/97. Byte 0 is the jersey number (BCD), then six 4-bit ratings; the order depends on the position (for example QB: weight, quickness, speed, awareness, range, power). The fifth CF byte is kept as it is.
- **3-4 teams (BW95):** a bitfield at `0x061068` (bit clear = 3-4) picks the roster screen's labels. The editor and the import read it from the ROM; changing a team's defense style sets it. Elevated ROMs are recognized by their relabeled 4-3 list (`0x62E6E`: DT1 instead of DLT) and use one layout for every team.
- **CFB 27 conversion v8** (2026 Season Edition test60 and 1994 Season Edition test61 on): every rating comes from one fixed curve per rating, the same in both editions, so a CFB 27 rating means the same at every position, in play and on screen; the rusher speed boost is set for converted rosters. The Dynasty app shows these ROMs' ratings as CFB 27 would (the game's own Team Rosters tables) and fits OVR to them. Details: [docs/rosters.md](docs/rosters.md#cfb-27-conversion).
- **CFB 27 conversion** (older ROMs): a table of the original games' rating distributions (per position and rating, how many players have each step; `src/core/rosterStockDists.json`) is built in. Each converted rating is the original game's step at the player's rank within his position. Details and the reasons behind each mapping: [docs/rosters.md](docs/rosters.md#cfb-27-conversion).
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
- CFB 27: EA's Week 9 ratings converted into the original ROM, Elevated beta.7 and its Tulane build give exactly the original game's spread for every position and rating, and the same bytes as the reference conversion the method was worked out with (but for the jersey numbers replaced since, see above). In the emulator, Florida State's roster screen shows the real jersey numbers and, with the tweak, OL weights of 309-357 lb. Files made for another defense are refused; a file with a missing column says which.
- Imports checked on BW95's roster screen in an emulator: numbers, ratings and weights show as expected, on a 4-3 team, a 3-4 team (NT, LILB, RILB) and a team-swapped Tulane. Unfilled slots keep their players.
- Edited CF96 and CF97 ROMs boot (with a wrong checksum CF97 stays on a black screen).
- ROMs downloaded from the app are byte-identical to the same edits made with the code in Node; a Team Swap result with roster edits differs from the plain swap only in the edited players and the checksums.

## Dynasty

A companion site for playing seasons of the 138-team 2026 Season Edition with dynasty support or the 107-team 1994 Season Edition, from Bill Walsh '95 Elevated v2.1.0, the first public release with dynasty support (test builds from v2.0.1-test9 / test29 on also open, but dynasties and saves from before v2.1.0 aren't promised to keep working). The app tells the editions apart by the ROM's team count and the save's signature. The app owns the players; the game plays the games. Every team is 64 players: its Active Roster (the 32 in the game) and a backup for each of them. It keeps every season's record, runs the offseason (graduation, progression, the transfer portal (2026 edition only), random signing classes, cuts) and writes the next season's rosters into your ROM.

1. **Start a dynasty** with Get started (`/dynasty` opens it when there's no dynasty yet; Manage → Start a new dynasty for another), in seven steps (user, 2026-11-20). **1 ROM:** an Elevated Season Edition (the app names the edition and version, or says why the ROM can't hold a dynasty), or the original game: it shows the two editions and their differences and patches your ROM with the one you pick from the current Elevated release (the app keeps the original game in your browser for later upgrades). A ROM the Toolkit's Patch tab hands over ("I want to play a dynasty") starts at step 2. A ROM that isn't an Elevated release as patched (changed in the Toolkit, or a test build) gets a red warning, but can still be used. **2 Dynasty:** the name, the starting year (the ROM's season, 2026 or 1994, unless you pick another: a ROM with a later year's rosters can start in that year, with the edition's real coaches a year older) and your teams (optional: an all-sim dynasty has none). Then the dynasty is made, and **3 Coaches** (every school's head coach with his OVR; fire, hire from the pool, swap two schools' coaches, create a coach and put him at a school; the Coaches affect the sim switch with a + / − / · per side for each coach), **4 Rosters** (real or generated backups, the players CSV, your teams' impact players), **5 Conferences** (the conference editor; two teams that trade conferences trade schedules, so the real schedule stays; a change in a conference's number of teams is warned about and needs a new schedule), **6 Schedule** (the real schedule from the ROM, or a new one made by the app with your protected rivalries; your teams' games can be changed) and **7 Download:** the first season's ROM, built by the app like every later season's, with a summary of the setup and How a season works. Next keeps a step as it is; "Skip to the download" keeps the changes so far and the defaults for the rest. Coaches stay with their schools when conferences change. The setup can be changed until the first import (download the ROM again). Only saves of a season started on the dynasty's own ROM are imported: another save gets a message with a button to the download. Dynasties made before this play their first season on the user's own ROM, as before. `npm run test:setup -- ELEVATED_2026 [ELEVATED_1994] [PLAIN_SAVE]` checks it. Players the rosters file numbers in a way the game doesn't allow get a new number; the list is on the last step and on Manage, closed until you open it. Each team's Active Roster is the ROM's converted players (built-in CFB 27 ratings, 2026 season, Week 9; the only use of CFB 27 data); its backups are the next-best real player for each spot, or, if you prefer, generated backups (Manage, first season only). A redshirted player starts one class up (RS FR is a SO, RS SR a SR+). In the **1994 Season Edition** there is no CFB 27 data: the Active Rosters are the ROM's own players (its ratings, fine ratings, numbers, names and classes), players the ROM has no name for stay unnamed (shown by position and number, for example "HB #23") and get a class so each team has a typical mix, and each backup is a real player of the school from the built-in 1994 rosters (`public/data/rosters-1994.csv`, magazine previews and StatMuse), with his name, number, class, height and weight and generated ratings. The team logos are read from your ROM and stay in your browser.
2. **Play** the season in the game (New Season, any schedule). The first season needs no download: play it on your ROM as it is (the app's rosters for 2026 are the ROM's own). From the second season on, the app gives you each season's ROM at the end of the offseason (a window asks until you download it; Manage has it too): its dynasty area holds the dynasty's rosters and team OVRs (Season mode plays them, Exhibition keeps the ROM's own rosters), and New Season marks the save with the dynasty and season. From the second season the app only imports saves with that mark, of the dynasty's current season.
3. **Import your save** after you play: the `.srm` battery save from RetroArch's Genesis Plus GX core. The app reads every result, the game's Top 25, the playoff field and each team's season stats, and marks the teams you play as. Import again as often as you like; a save with fewer results than the last import is refused (it's older, or another season), unless you tick the box.
4. **Run the offseason** on the Offseason page, download the new season's ROM, and start a New Season with it. Repeat.

The pages:

- **Home:** a score ticker for the latest week and the stories of the week, written from the results (upsets, including by team rating, Top 25 games, routs, your games, rivalry games, conference races, records broken, recruits' commitments, a new No. 1, unbeaten teams and streaks, milestones, the playoff field, the national leaders, champions; import your save every week to also get the players of the week, since the game keeps season totals only; every headline opens a window: a game's story the score with both teams' ranks and records, each team's leaders in the game when you imported saves right before and right after that week, the poll moves, the series in this dynasty (record, streaks, the biggest win, firsts, the last meetings) and both teams' next games; a player of the week his game's stats; a new No. 1 the top 10; unbeaten teams the list; a stat leader, milestone or record that stat's top five; a conference race the standings; the playoff field or the bowl lineup), with headlines and your teams beside them. Your teams' headlines in the side column are highlighted, with the team's logo. Below the stories, the Top 25 (on wider screens the top four as cards, the rest in columns). The side column also has next week's big games (both teams ranked; a ranked team against a team with a power rating within 15% of its own; two teams at the top of their conference) and a Heisman watch; across the page below come the playoff picture (if the season ended today: conference leaders take the automatic bids, the rest by the Top 25), the national leaders and your conference's standings. In the offseason the side column shows your commitments and the recruiting and class rankings.
- **Preseason Heisman favorites:** before a season's games, Home lists the top five Heisman favorites in the Heisman watch's place: starters scored on their OVR, last season's production and their team's preseason rank, weighted toward the positions that win it (QB, then HB, then WR). Once the first games are in, the Heisman watch replaces it.
- **Week 0 and the opening games:** weeks are numbered from Week 0 everywhere. The schedules the app makes (from the second season, or a new one in setup) have a light Week 0 of 8 non-conference games, mostly outside the power conferences (4 in 1994). 2026 dynasties open with the **Aflac Kickoff Game** in Week 1 (one a season: a top-4 SEC team against a team from the top half of the ACC, now and then of the Big Ten or Big 12); 1994 dynasties with the **Kickoff Classic** in Week 0 (a top-4 team in its conference against a team from the top half of another). As in the real series, now and then neither team is a top-4 one. Their teams give up a non-conference game, so everyone still plays 12 games (11 in 1994). Scores names the game, and the week's lead headline is about it.
- **Scores** by week (each team's rank going into the game; today's in gold for a week no imported save covers), **Standings** by conference, the **Top 25** with movement, then every other team as the game ranks it, in shorter rows (elsewhere in the app only the top 25 show a rank).
- **Preseason Top 25:** from the second season the app ranks every team before the season, like a preseason poll: 62 voters weigh each team's rating (after recruiting and transfers), last season's final poll, its returning starters and its prestige. The front page and the Top 25 page show it until the season's first import, and the season ROM carries it so the game starts its poll from it (2026 Season Edition v2.0.1-test35 and 1994 Season Edition test38 or later; earlier ROMs make their own). In the first season the app shows the real preseason AP poll of that year (2026 or 1994), the poll the game starts from.
- **Teams:** each team's prestige (1-6 stars), offense and defense OVR (the ROM's), schedule and results, history, season stats, its Active Roster (the 32 players in Bill Walsh '95, in the game's roster order) and its backups (QB2, HB3, HB4 …), with an OVR for each worked out from his game ratings (formulas in [docs/dynasty.md](docs/dynasty.md)). Each **player** has a page with his stats and his Bill Walsh '95 ratings: the numbers the game shows, a meter of the game's 15 steps, his rank among everyone at his position on every team (HB1 and HB2 together, all five linemen, all four receivers and so on), and a shape of his ratings against their average; from his second season, a chart of his ratings over his career, his career stats and his honors.
- **Rosters:** every player of the dynasty in one table, 100 a page: name (with or without headshots), number, team, position, class, OVR, the game's nine ratings (as its Team Rosters shows them, 0-99), height and weight. Sort by any column; filter by name, team, conference, position or position group, class, and a minimum and maximum for OVR, each rating and weight; show or hide backups; show only impact players. The filters stay in the address, so a filtered list can be bookmarked or shared. On a phone the filters fold behind a Filters button and the name column stays put while the table scrolls sideways.
- **Impact players** (2026 test55 / 1994 test56 on): the app picks every team's three the way the game does, on the fine ratings (2026 test57 / 1994 test58 on; the best offensive skill player, the best defender, the better of the next two; since 2026 test64 / 1994 test65 linebackers and defensive backs are favored over linemen, never two linemen, and two backs, tight ends or receivers are rare; since v2.1.1-test3 only starters, by position OVR). A gold dot marks them on Rosters and in the team page's Active Roster, and the team page has an Impact players box near the top. In the offseason's **Impact players** step (after the depth chart) you can pick your own teams' three instead: from the Active Roster's starters (QB, HB1, FB, SE, FL, WR3, TE1 and the starting defenders), at most two on offense or on defense. The season ROM carries every team's three, so the game's Team Rosters dots and the X on the field follow your picks in Season mode; Exhibition keeps the game's own pick. The first season is played on your own ROM, so it keeps the game's pick.
- **Coaches:** every dynasty starts with its year's real head coaches on their teams (1994 or 2026) and a pool of coaches without a head coaching job (coordinators and head coaches out of work), from the built-in lists (`public/data/coaches-1994.json`, `coaches-2026.json`, from Wikipedia; real seasons only up to the year before the edition). Each coach has five ratings (Passing, Running, Defense, Recruiting, Development, 0-99), an OVR (Recruiting and Development count a little more) and a prestige of 1-5 stars, all made by the app from his record, titles and the jobs he held (no real source rates coaches). The **Coaches** page lists the head coaches, the pool or everyone, with a search. Each **coach** page has his ratings as a shape against the average head coach and a tile per rating with his rank among the head coaches, and his career: his real seasons (marked IRL, each linked to its Wikipedia page) and the dynasty's. Team pages show the head coach and, in the history, the coach of each season. A dynasty made before coaches gets them the next time it opens.
- **Goals and the hot seat:** every head coach has 2-3 goals each season, from his school's prestige: a win total, beating the school's protected rival, and the conference title (5-6 star schools), a top-N signing class (3-4 stars) or a bowl game / 6 wins (1-2 stars). The team page and his page show them with how they're going, and his hot seat (0-100): each season's heat from his wins against the goal, the other goals and the signing class, carried from season to season at his school with the latest season counting most. The Coaches page has a Hot seat tab.
- **Coaching carousel** (the offseason's first step): head coaches earn XP for the season; coaches 60 and older may retire (likelier each year); coaches are fired: never in their first two seasons, in the third only after a disaster (far below the win goal and a poor signing class), from the fourth by the hot seat (from 55; coaches with a big name last longer). Your teams' coaches can be fired too unless you turn it off (Offseason rules → Coaches). The coaches whose XP you manage get job offers from schools with an opening at their level: tap one for the school's situation (prestige, academics, last season, OFF / DEF, returning starters, players drafted, the goals he'd get, top players and the last three signing classes, each opening its class), pick one or stay; when your team's coach moves, you choose whether to add his new school to your teams and keep the old one. You can put any pool coach on any team or fire a coach. Then the schools hire for every opening from the most prestigious down: the pool, or head coaches moving up from less prestigious schools (whose jobs open in turn). The steps after it show a summary of every move.
- **XP:** every head coach earns XP each season (40 a win, 150 a postseason win, 400 a national title, 200 a conference title, 100 a goal met, 100-200 for a top-25 signing class, 40 for each of his players in the nation's top 10 in passing, rushing or receiving yards, tackles, sacks or interceptions, 100 more for the national leader). **Manage XP** on a coach's page: on, you spend it on his five ratings (a point costs 40 XP below 70, 80 to 79, 150 to 89, 300 from 90) and he gets job offers; off (every coach unless you turn it on), it's spent for him on his best areas. From 65 a coach's ratings slip a little each year. A coach's prestige moves a star at most each season toward his OVR's level (a national title is worth a star).
- **Create a coach** on the Coaches page (name, age, the five ratings); he starts in the pool.
- **What coaches do** (all small): in offseason training a player develops up to about 10% faster (or slower) by his head coach's rating for his position group (Passing: QB, WR, TE; Running: HB, FB, offensive line; Defense: defenders) and half his Development rating, times his prestige; a good recruiter's points go further in recruiting (up to about 10%) and lift random signing classes a little; in the 2026 edition a good coach keeps his players a little more, and when a coach leaves, his former players are likelier to transfer (starters too) and get first pick at his new school if it would start them (the 1994 edition has no such transfers).
- **Former players become coaches:** each offseason a few departing players (more with high Awareness, quarterbacks and linebackers most) join the pool: undrafted ones at once ("Former player"), drafted ones after 2-10 years in the pros ("Former NFL player"). Their coach page ends with their playing career.
- **Coach headshots:** a 16-bit portrait in the team's colors with a visor or cap, glasses, and hair that grays, whitens and thins with age; the face ages with him (young under 45, middle-aged to 59, older from 60). **Edit appearance** on the coach page changes any of it, age included.
- **Coaches affect the sim** (Offseason rules → Coaches; off by default): a head coach clearly better than the season's typical head coach gives his team +1 OFF (from his Passing and Running) and +1 DEF (from his Defense) in the season ROM, a clearly weaker one −1; with +1 on both sides a team wins about 56% of its games against an equal team instead of 50% (`cli/coachsimstudy.ts`). The coach page shows his team's numbers. The app's own OVRs and poll don't change.
- **Coach news:** firings, hirings, retirements and former players starting out; during the season, coaches who can be fired after it (third season or later at the school), whose seat was warm or worse last season and who are two or more wins behind their goal's pace (at most three a week); job offers to the coaches you manage while the carousel is open. Walsh Reports mention a new head coach (and one who came from the school's rival) and a returning coach on a hot seat.
- **Stories:** firings, hirings (and coaches hired away), retirements and former players starting a coaching career make the news; a Walsh Report mentions a team's new head coach.
- **Your teams menu:** with more than one of your teams, the logo at the top right is a menu to switch between them; the offseason steps, schedule and Walsh Reports start on the team you picked.
- **Stats**, in two tabs. **Players:** the national leaders, each list with **View all**: every player of that category (passing, rushing, receiving, defense, kicking, punting) in a sortable table with completion percentage, yards per attempt, passer rating, averages and more, searchable, by team or conference, per game if you like. **Teams:** leaders for points, points allowed, yards and sacks, then every team in a sortable table (Overview, Passing, Rushing, Defense, Kicking), its totals added up from its players and its points from its games (the save keeps no yards allowed, first downs or penalties). **Award watch:** each award's top five so far, with the app's pixel trophy: the Heisman, Maxwell, Walter Camp, Davey O'Brien, Doak Walker, Biletnikoff, John Mackey, Outland (offensive linemen and defensive tackles, about half each), Bronko Nagurski, Chuck Bednarik, Butkus, Jim Thorpe, Lou Groza and Ray Guy, and the Bear Bryant Award and AFCA Coach of the Year; in a 1994 dynasty each award starts the year it was first given (the Mackey and Ray Guy in 2000 …). **History:** national champions and your teams by season, with the **season awards** (those awards, All-American and All-Conference teams, worked out from the stats and the players' OVR once a season is over), the **records book** (single-season, career and team records, the whole league or one school) and **your trophy room**: everything your teams won while you controlled them (titles, bowls and playoff wins, rivalry trophies, your players' and coaches' awards), by stint, even for teams you no longer control; the dynasty file keeps every team you ever controlled and every coach you managed, season by season. **Team → Rivalries:** each trophy game (48 of them: the Old Oaken Bucket, the Little Brown Jug, the Golden Hat …) with its trophy, the real series up to 2025 and who holds the trophy (2026 dynasties), and this dynasty's series and meetings. **Manage → Trophy art:** your own picture for any trophy, kept in the dynasty file (a picture over 500 KB can be scaled down first).
- **Prestige:** every school has 1-6 stars. The start comes from College Football 27's own prestige; after each season a school moves one star at most toward the tier of its final poll place (top 10: 6 stars, top 20: 5, top 35: 4, top 70: 3, top 100: 2, the rest: 1). Prestige drives recruiting and the transfer portal.
- **New players' names and looks:** signing classes and walk-ons get names from the CFB 27 players' first and last names (short ones only: first names up to 10 characters, last names up to 12, in the game's font; never a real player's full name), paired so they fit together, with a skin tone (four: light, tan, brown, dark) for the app's portraits. The share of Black and White players follows the position (for example CB 98%, HB 95%, QB 45%, K 4%); the starting CFB 27 players get their tones the same way, guided by their names. Details: [docs/dynasty.md](docs/dynasty.md).
- **Ratings:** after the first season's conversion from CFB 27, every player keeps his own Bill Walsh '95 ratings, shown as the game's Team Rosters shows them (0-99). The game's fine ratings (v2.0.1-test13 on) are used: every point counts in games, not only the 16 steps, and the first season's numbers are the ROM's own. Players develop point by point (Awareness fastest, then technique, Power, Range, Quickness, and Speed slowest; a Training focus on the Offseason page shifts this a little for your teams), and new recruits get ratings anywhere on the scale. Depth charts put the best OVR at each spot.
- **Experience:** next to a player's class, the letters he has earned at his school (1L, 2L …), TR with the school he came from, or HS for a first-year player.
- **Careers:** player pages show every season's stats with the school he played for, and any transfers. The app keeps every player's ratings for each season, for a career view later.
- **Recruiting stars:** every player signed in the dynasty keeps his stars (or Walk-on) and his class year on his player page. A few walk-ons are diamonds in the rough with a top recruit's potential.
- **Player pages:** the jersey number before the name in the school's second color (as LSU's roster does), the team logo in the header, this season's stats, the attribute ratings, and **career stats** below them once he has a season behind him (a row per season with his school and class, and a career row).
- **Headshots:** every player page has a 16-bit portrait (48 × 48, painterly shading on the gray of real player photos) in his team's jersey, made from his skin tone, his position's build and his ID, the same every time: hair, facial hair, expression, eye color, a jaw and neck that fit his position (linemen thick necks), now and then eye black, earrings or a chain. Players made from now on can get any of 18 hair styles; existing players keep theirs. **Edit appearance** on the player page changes skin tone, hair, hair color, facial hair, expression, eye color, age, jaw, neck, eye black, earrings and chain any time (only the app's portrait; nothing goes into the ROM).
- **Editing:** in the offseason and before a season's first import, any player of any team: name, position, class, number, size, hometown, potential, team, and his ratings (0-100), from his player page; add players from a team page; release them. Or download every player as a CSV (Manage), edit it in a spreadsheet and import it again, with a preview of every change. A new number in the file that the game doesn't allow at the player's position is replaced, and the preview says so.
- **Lineups:** on your teams' pages, a menu in the Pos column moves a player to another spot, on the Active Roster or in the backups; the player there takes his place (★ marks the Active Roster spots). A player can play any spot of his own position, and change position once a season: HB and FB, FB and TE, DE and OLB, OLB and MLB, K and P (no CB to S, no DE to DT). Lineups can change until the season's first results are imported (the game's stats belong to the spot); download the season's ROM again afterwards. Each offseason sets the depth charts again.
- **Offseason rules:** Manage → Offseason rules (spoilers): every number the offseason uses (departures, development, transfers, recruiting points and scouting costs, pitches, walk-ons, roster minimums, prestige), changeable per dynasty, with export and import to reuse them in another dynasty. The same page has the dynasty's **season sim** settings (as on the Toolkit's Season tab), which go into every season ROM downloaded after the change (2026 test33 / 1994 test36 on).
- **Team OVRs** follow the depth chart each offseason: in the 2026 edition from the starters' OVRs (as the Toolkit's College Football 27 import), in the 1994 edition from every slot's ratings against all 107 teams, on last season's scale (as the ROM's own since 1994 test36).
- **Team pages** show the school's academic grade (a cap and the grade) beside its conference. Under the team's header are four tabs, each with its own link (`#team/12`, `#team/12/roster`, `#team/12/stats`, `#team/12/uniforms`):
  - **Overview:** impact players, head coach, goals and hot seat, stat leaders (passing, rushing and receiving yards, tackles, sacks and interceptions, with headshots), schedule, history.
  - **Roster:** the Active Roster with your position menus, backups and Add a player. Click a column header to sort by it (again to reverse; Pos goes back to the game's roster order).
  - **Stats:** the full season stats; each table's **View all** opens that category on the Stats page, filtered to the team.
  - **Uniforms:** the uniforms and their editor.

  A team page always opens on Overview. The depth chart buttons in the offseason go straight to Roster.
- **NIL** (2026 dynasties, off unless turned on in setup or Manage): every school gets a yearly NIL budget, players get one-season deals, and recruits and transfers weigh your offer (an NIL offer on each prospect's card, his ask on the board, the room left in the band). The team page's NIL tab shows the budget, payroll and highest paid players, and can let the CPU set your offers.
- **Recruiting pitches:** playing time, program prestige, conference prestige (the average prestige of your conference's schools against the best conference; an independent pitches its own), being close to home, academics (College Football 27's grades) and championship contender (last season and the roster as it stands). The My school tab lists every conference's prestige. What a prospect cares about is hidden: pitch him each week and see his reaction (+ his interest and your school is strong there, ~ in between, − his interest but your school is weak there, ✗ not interested); a good pitch makes your points count more, a bad one less, and a pitch he doesn't care about a little less. He has a main interest and a minor one: the main one moves your points more, and his reaction says which it is. In-state prospects cost 20% fewer points and prospects from pipeline states (4+ players from a state on your roster) 10% fewer. Filter prospects by state and sort by stars, OVR or any rating you've scouted.
- **Recruiting pages:** a band in your team's color with the points left, the size of your board, your commitments and your offers, and five sections. Board: your prospects with their interest in you, and for the one you pick a card with his headshot, his top schools as bars (a full bar is enough to commit), this week's points and pitch, what his reactions have told you, and scouting. You can have your open spots plus 5 offers out at one time (offers to prospects who have committed don't count), and an offer can be withdrawn while he hasn't committed: without it he can't commit to you or pick you at signing day. Prospects and Transfer portal: open spots by position (pick one to filter), search and filters, and the same card. My school: how strong each pitch is at your school, how your pitches have landed, needs by position, your state and pipeline states, and the week's rules. Top classes: every school's commitments by class points, and for your school the prospects you lead for. On a phone the list and the card take turns.
- **Offseason steps:** a projected depth chart for your teams (a player you make a starter is less likely to transfer), players leaving (graduates, early entries, transfers), the transfer portal or recruiting (every prospect has five top schools and what he cares about most; a needs table by position; your own transfers start on your board and you can win them back), signing day and cuts, training, the training results, then the new season's players, depth chart, impact players, conferences, schedule, Walsh Reports and ROM: fourteen steps on a bar at the top of the page (on a phone it shows the one you are on). Players leaving shows who goes and why, and the starting spots they leave open with the next man up. Signing day shows your class with headshots, the prospects you offered who signed elsewhere, the top classes, and your cuts as a checklist ("Pick the rest for me" fills it). Training focus has its own step after the cuts. **Edit players** comes once the new season is set up: your roster with every jersey number in a box you can change, the new players marked, and each player's editors (name, position, ratings, appearance) one click away. Backups and depth players who don't get the ball look for a starting job elsewhere; players who got playing time stay. **Conferences** works like the Toolkit's Season tab, in both editions: move teams, rename conferences, set each conference's games and first week, and (2026 test31 / 1994 test33 on) whether it plays a title game and, in the 1994 edition, whether the SEC's game uses the 1994 SEC divisions (East and West lists; a team that takes another's place takes its division; every SEC team plays its whole division in the app's schedules). Saving a move or new conference games makes a new schedule; the season's ROM carries the conferences, so the game's standings, title games and playoff (2026) or bowls (1994) follow them. A conference with a title game needs at least 2 teams. In the 1994 edition the bowls take a conference's champion by its place in the list (the first to the Sugar Bowl, the second and sixth to the Rose Bowl …). Earlier seasons keep their conferences. **Walsh Reports:** from the second season the app writes Bill Walsh's scouting report for every team (the game shows it before a team's games), from last season's results, stats and awards, the offseason's departures, transfers and signings, the new starters' ratings against every other team's (fast receivers, a big line, a weak pass rush …), the preseason poll and the schedule. Each team gets a theme (defending champion, contender, rising, rebuilding, rebuilt through the portal …) and sentences picked from pools of wordings, so reports differ from team to team and season to season; players are named with their jersey numbers. On the Walsh Reports step you can read any team's, **Edit** it (the Toolkit's editor, with the game's 650-character limit and a preview of the report box), have it **written again** with other wording, or go back to the app's. All of them go into the season ROM. The Schedule step's **Protected rivalries** list sets which games every new schedule keeps and, if wanted, the week each is played (built-in lists by default; every season gets a new schedule).
- **Offseason:** after the national championship (import the save with the last game first), step by step: departures (SR+ graduate; seniors go pro, come back as SR+ or graduate; juniors may go pro), the transfer portal (only backups who have waited two seasons; the 1994 edition has no transfer portal) and signing day (quick random classes by need and prestige, or five weeks of recruiting in which you spend points and make offers on high-school players and portal transfers, and scout high-school players: 10 points shows a prospect's OVR, 20 more all his ratings), cuts to 64 when needed (you choose for your teams, with a suggestion: next season's Active Roster stays, seniors and backups with the least future go first; every team keeps at least 2 QBs, 4 HBs and FBs, 5 WRs, 3 TEs, 7 offensive linemen, 5 defensive linemen, 5 linebackers, 5 CBs, 4 safeties and 2 kickers and punters), or sim any of it: a recruiting week, the rest of recruiting, the cuts, or the whole offseason, walk-ons, offseason training (returning players develop, shaped by your Training focus; new signees don't yet; a Training results page lists any team's players by most improved, with each rating's change), and the next season's depth charts. Then **Download the ROM** for the new season: every team's 32 players and the team OVRs written into your ROM (its dynasty area). Start a New Season in the game with it.
- **Schedules:** from the second season the app makes each season's schedule, using the game's rules for random schedules and keeping the traditional rivalries every season. The season finales, such as the Iron Bowl and The Game, are in the last week. Before the season starts you can change your teams' games: opponents (conference games too), weeks, and home and away. The schedule goes into the season ROM (it needs a game version that reads it).
- **New Elevated versions** (from v2.1.0): when a newer release is out, Manage offers it after a save import, and the offseason's last step offers it for the new season. Mid-season only when the new version can continue a season started on the old one (else it waits for the offseason). The app builds the season's ROM on the new version; you download it under the same file name and keep playing, and the upgrade is done when you import a save from it (a save still from the old ROM says so). If you started from the original game in Get started, the app keeps it in the browser and patches the new version itself; otherwise you load the new ROM, or the original game, once. Manage also shows the version and has "Upgrade from a file". An upgrade also reads the new version's logos, helmets, team colors and uniforms (your uniform changes stay); Manage → Backup and files → **Update logos and uniforms from a ROM** does the same from your own changed copy of the same version. `npm run test:upgrade -- OLD_ROM NEW_ROM SAVE [ROM_1994]` checks the offer, the timing, the ROM checks and the save that ends an upgrade.
- **Manage**, in sections as tabs (This season, Your teams, Players, Files, Share, Rules, Controller, Dynasties): import saves, choose your teams, download the dynasty file (a backup, or to move it to another computer; it has no game art and not your ROM, so opening it in a browser without them asks for your ROM right away, for the logos and the season ROMs; Manage shows the last download), open How a season works and the Offseason rules, and open, rename or delete dynasties.
- **Screens:** on a desktop (1200 × 700 and up) the masthead and the menu under it; on handhelds (Odin 2 Portal 960 × 540, Retroid Pocket Nova 640 × 480), tablets and phones one slim top row instead: the menu button (Start on a controller opens the app menu, with Dark mode and the links), the pages from 960 px wide (else the open page's name) and your team. Pages split into tabs instead of long scrolls: Scores by week, Standings by conference (your team's first; on a wide, short screen in two halves side by side), Manage's sections; the team page has a slim band with ◀ ▶ to the previous / next team (L2 / R2); the offseason shows one step at a time with the steps before and after (the full list on a desktop), and on a short landscape screen a slim recruiting band. The team's roster has a list of position groups (All, QB, RB … K / P). Teams shows one conference at a time below desktop size; Top 25 sits in two columns, and the Rosters page folds its filters behind a button, on a short landscape screen.
- **Game controllers** (for handhelds such as the Odin 2 Portal, or a controller on a computer): the D-pad or left stick moves between items (a thick yellow frame shows where you are), A chooses, B goes back or closes a window, X and Y press the page's main and second action, L1 / R1 switch tabs (the page's tabs, else the app's menu), L2 / R2 go to the previous / next item, ◀ ▶ change a dropdown or a number, the right stick scrolls, Start jumps to the app's menu and Select shows or hides the button hints. The hints run along the bottom while a controller is in use and go away on a touch or a mouse move. **Manage → Controller** sets the button labels (Xbox, PlayStation, Nintendo), changes any button (press the one you want; Add keeps the old one too, Default puts it back), has a Buttons table with every button, what it does now and a field to rename it to what your controller says (a Genesis pad on a USB adapter whose Z reaches the app as L1 can show "Z" in the hints; up to 6 characters), and **Test your buttons**: a window with a controller drawing that lights up the buttons you hold and names each (the app's name, yours, what it does). The controller does nothing else while it's open; hold Start 3 seconds to close it (any button 5 seconds), or tap, click or press Escape. Saved in the browser. `npm run test:pad` checks the mapping and the focus search.
- **What's next:** a card on the home page (the whole page before there are headlines, then at its bottom) that follows the dynasty: play and import your save, run the offseason when the season is over, finish it, or download the new season's ROM; with a line when the dynasty file hasn't been downloaded since the last import. After an import, Manage's message has a button on to Home ("See the headlines", or "Continue to Home" once the season is over).
- **Sample dynasty** (`/dynasty/sample`): Get started shows a picture of a dynasty's Home page beside its first step, with a link to browse a whole sample dynasty (Tulane, 2026, after Week 4), read-only, in the snapshot pages. It is a snapshot kept in the repo, so it never expires.
- **Share a snapshot** (Manage, Share): a read-only copy of the dynasty as it is at that moment, with a public link (`/dynasty/s/<id>`) anyone can open. It follows your active team (the one picked in the logo menu): its logo heads the masthead and its news comes first, and visitors can browse the whole dynasty. Team logos and helmets are included. Up to 5 snapshots per dynasty; at the limit, sharing offers to delete the oldest. Deleting one breaks its link within the hour. A visitor sees the dynasty's pages without Offseason and Manage; editors are greyed out with a line saying they aren't available in a snapshot, and Home ends with "What's this?" about the mod and the Dynasty app. Snapshots are kept in the site's Vercel Blob store (public); there are no accounts: each snapshot's secret delete key stays in your dynasty (and its file). A snapshot's link works for 90 days; then the snapshot is deleted (a daily job; it needs `CRON_SECRET` in the project's environment variables, and `/api/snapshot?status=1` says whether it's set).

Dynasties are kept in your browser (IndexedDB), with your ROM for the offseason and the season ROMs (the ROM is never in the dynasty file). Clearing the site's data deletes them, so download the dynasty file now and then.

### How it works

The save's season block and stats tables, the dynasty file and the plan for the next phases: [docs/dynasty.md](docs/dynasty.md).

- **Weight:** every player but kickers and punters puts on a little weight each offseason: a random share of his weight up to 2% (up to 6 lb for a 300 lb lineman, 4 lb for a 200 lb back). More Strength program points in the training focus mean more weight (up to half as much again at the most points), fewer mean less. New players arrive at a freshman's weight. Both numbers are in the Offseason rules.
- **Jersey numbers:** returning players keep their numbers. New players pick when the offseason ends, the best first: single digits go quickly, and the rest wear what their position wears in College Football 27 (linemen 50-79, most tight ends in the 80s, backs in the 20s, and so on). A transfer keeps his number if it's free at his new school. Number 0 is used. On computer teams a veteran now and then moves to a single digit that opened up; on your teams a number only changes when you change it (Edit player).
- **Dark mode:** the **Dark mode** switch at the top left turns the pages dark. The choice is kept in the dynasty (and its dynasty file, so it comes back on another device); pages without a dynasty, and a dynasty with no choice yet, use the browser's last choice.
- **Uniforms:** on a ROM with the uniform picker (v2.0.1-test14 on), every team's page has a **Uniforms** section: its home and away uniforms on the game's player sprite, then its alternate helmets, jerseys and pants on their own (on a gray stage in light mode), and **Edit uniforms** (the Toolkit's editor): Dark or White at home, the team's own helmets, jerseys and pants (locked: changing one asks first, since the game also colors the end zones and the crowd from them), and extra helmets, dark and white jerseys and pants to pick on the controller screen. Each piece is shown on the player sprite with the rest grayed out; its main color is the one big choice, and the shades follow it (still editable). The color picker starts with the team's own colors and the game's black (0222: pure black is the players' outline) and white (0CCC for jerseys and pants, 0EEE for helmets); helmet and pants stripes have a **No stripe** choice. Any team, any time, mid-season too: the save keeps no uniform, so the season goes on. A change after downloading the season's ROM (or during the first season, which is played on your own ROM) brings up a window to download the ROM again, with the steps; in the first season the download is your ROM with only the uniforms changed. Changes go into every season ROM after it.
- **Season ROM file names:** the name of the ROM you started the dynasty with, then the dynasty, the year and an ID for the season, for example `Bill Walsh College Football 95 (USA) [Elevated 2026 Season v2.2.0-rc.3] my_dynasty-2026-fxh834.zip` (an upgrade or Manage's "Update logos and uniforms from a ROM" switches to the new ROM's name from the next season's first download). Downloading it again in the same season keeps the name, so the game still finds your save: replace the old file (if your browser saved it as "… (1).zip", rename it). After any change that needs a new ROM, a window says what changed and what to do.
- **ROM areas:** the season ROM is written into the dynasty area of Elevated's 2026 Season Edition (v2.0.1-test9 on), `0x3E0000`-`0x3FFFFF`: a header with the ID block (dynasty, season, roster version), the season rosters (138 × 32 × 4 bytes at `0x3E0100`), an OVR table (`0x3E4600`), the sim words (`0x3E4800`) and the names set for Team Rosters' names view (`0x3E5000`, "NAM1": class, first and last name per slot, in the game's font). The app writes it (and creates dynasties) only when the ROM has the dynasty hooks (the mark `BW95DYN` at `0x2B0000`) and Team Rosters' names (v2.0.1-test9 on) and the area is free (all `0xFF`) or already holds a dynasty header. Checksums are recomputed; nothing else changes.

### Testing

`npm run test:dynasty -- ELEVATED_2026_138_DYNASTY SAVE.srm` (a ROM with the dynasty support, v2.0.1-test9 or later; the save of any season of the 138-team edition, which the test marks for its dynasty) reads a real save in both layouts (the emulator's and the data bytes alone), checks that the stats add up and the ranks follow the game's order, creates a dynasty (twice, the same), imports the save (the same save replaces its import; an older one and one without a season are refused), checks records, standings, leaders and stories, round-trips the dynasty file and reads the art. The pages were checked in a browser with a save after Week 2 (Texas State, 100 games played).

`npm run test:impact -- ELEVATED_2026_138 ELEVATED_1994` (2026 / 1994 v2.1.1-test3 or later: the H-047 pick, starters by position OVR) checks the app's impact pick against the ROM's for every team of both editions, the season ROM's IMP1 table (the game's pick for every team, the user's picks for his own), and the picking rules.

`npm run test:v8 -- ELEVATED_2026_138 ratings26_v8.json` (2026 test60 or later; the Rosters lane's reference file, the Mac folder's `rosters-2026/v8/`) converts the built-in week-9 file with the v8 curves and compares every player with the reference (±1), checks the written steps and offsets read back as the fine values, the boost word, the ROM's display tables against the app's, and that every number from a rating's lowest up can be typed in.

`npm run test:manifest -- ELEVATED_ROM [SAVE.srm …]` (2026 test63 / 1994 test64 or later) reads the ROM's manifest and checks it against the app: every entry the app needs is there and known, the build is in the app's list of known builds, the addresses match; given saves made on that ROM, it reads them with save layout 2 (the build stamp, the last-played ID, the packed defense stats).

`npm run test:dynasty94 -- ELEVATED_1994 SAVE.srm` (the 1994 Season Edition, v2.0.1-test29 or later; a save of any of its seasons, which the test marks for its dynasty) creates a 1994 dynasty and checks its ratings against the ROM's steps and fine offsets, its names and classes, its real backups, the season ROM (format `0x0001006B`, 107 teams), the save (bowls, the champion of the final poll, bowl stories), 11-week schedules with a bye each week and the 1994 rivalries, and an offseason into 1995.

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
npm run test:rosters -- BW95.md CF96.md CF97.md [Elevated-2026-v2.0.0.md] [Elevated-1994.md]
```

How the Patch tab works, the patch list format and the steps for a new release: [docs/patches.md](docs/patches.md). Its tests take the original BW95 ROM, a local copy of the [Elevated repo](https://github.com/jd6-37/Bill-Walsh-CFB-95-Elevated) and optionally CF97 (to check that each patched ROM takes a team swap):

```sh
npm run test:patch -- BW95.md path/to/Bill-Walsh-CFB-95-Elevated [CF97.md]
```

How the Season tool works: [docs/season.md](docs/season.md). Its tests take the original BW95 ROM, CF97 (for the Team Swap checks) and optionally more BW95 ROMs such as Elevated builds (a 138-team 2026 Season Edition or a 107-team 1994 Season Edition among them gets its own test); `cli/season.ts` applies a season setup from a JSON spec, and `cli/season138.ts` lists or changes the 138-team edition's conferences:

```sh
npm run test:season -- BW95.md CF97.md [Elevated.md …] [Elevated-2026-138-teams.md] [Elevated-1994.md]
npx tsx cli/season.ts BW95.md out.md spec.json
npx tsx cli/season138.ts Elevated-2026-138-teams.md out.md spec.json   # {"names": {"SEC": "Southeastern"}, "conf": {"Tulane": "SEC"}, "weeks": {"SEC": {"start": 2, "games": 6}}}
```

How the Teams tab works: styles in [docs/styles.md](docs/styles.md), ratings and weather in [docs/teams.md](docs/teams.md). The style tests take the same ROMs as the Season tests; the ratings tests take the original ROM, CF97 and the two Elevated v1.1.0 editions, and optionally the 138-team 2026 Season Edition and then the 107-team 1994 Season Edition. `cli/styles.ts` lists or changes a ROM's styles, `cli/teams.ts` its styles, OVRs and weather, and `cli/build.ts --style Pitt=Option,3-4` sets a swapped team's styles:

```sh
npm run test:styles -- BW95.md CF97.md [Elevated.md …]
npm run test:teams -- BW95.md CF97.md Elevated.md Elevated-2026.md [Elevated-2026-138-teams.md] [Elevated-1994.md]
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

## The site

The homepage, the manual and Insights (`src/site/`). Pages are React; the manual's chapters and the Insights posts are MDX files (`src/site/manual/NN-slug.mdx`, `src/site/insights/slug.mdx`), each with a `meta` export. `npm run build` writes every address as its own HTML file with its title and share picture (`cli/prerender.ts`), and `vercel.json` serves `/toolkit` and `/dynasty` from `app.html`. How to add a page, and the rules for screenshots and clips: `docs/site.md`.

The site's screenshots, GIFs and clips (`public/media/`) are an exception to "no game art in the repo": they're captured from the mod's test ROMs to show the mod. The Rosters section is the other (owner, 2026-11-19): `public/data/rosters/*.json` (every team's 32 as Team Rosters shows them) and `public/media/rosters/` (each edition's logo sheet, the EA Sports logo and the Bill Walsh seal), made from the ROMs by `npm run site:rosters -- ELEVATED_2026 ELEVATED_1994 BW95` (the historic teams come from the 2026 ROM, 2026 test72 on). Run it again on each new mainline (for now the site follows the test ROMs; later only public releases). No ROMs are in the repo.
