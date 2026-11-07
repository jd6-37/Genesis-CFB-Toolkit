# Genesis CFB Toolkit

Browser-based modding tools for EA's college football games on the Sega Genesis: Bill Walsh College Football '95, College Football USA 96 and College Football USA 97.

Everything runs in your browser. Your ROMs are opened on your own computer and are never uploaded anywhere. The app contains no ROM data or artwork, apart from a table of how many players the original games have at each rating step (used to convert CFB 27 ratings); you bring your own ROMs.

## Tools

- **[Team Swap](#team-swap):** swap College Football USA 97 teams into Bill Walsh College Football '95.
- **[Season](#season):** rename the four conferences, choose which teams play in each, and lock in schedules in Bill Walsh '95.
- **[Styles](#styles):** choose the offense and defense the computer runs for each Bill Walsh '95 team.
- **[Rosters](#rosters):** edit the players of Bill Walsh '95, CF96 or CF97, team by team or from a spreadsheet (CSV or Excel), or bring in real College Football 27 rosters.

Each tool has its own tab. `#season`, `#styles` or `#rosters` at the end of the address opens that tab directly.

**Season, Styles and Rosters edit the same ROM.** Load a ROM in any of them, or take the Team Swap result, then switch between them as often as you like. **Download ROM** in any of the three saves everything, named after the ROM with `[Season]`, `[Styles]` and/or `[Rosters]` added. Team Swap always starts from an unswapped ROM; if you change the swap and take its result again while you have changes, the app asks: **Keep my edits** puts every team's roster, the conferences and schedules, and the styles you changed into the new ROM, by slot (a swapped team gets the edits made for its slot), or **Start fresh**. The same question comes up when you open another ROM file of the same game.

## Team Swap

Pick any of BW95's 36 teams, choose a CF97 team to replace it with, adjust the names and uniform colors, and download the new ROM. The new teams' art comes from your CF97 ROM.

### What a swap changes

- Logo (setup screen, pregame and play-call screens), helmet and wordmark (stadium banner, play-call screen), taken from your CF97 ROM.
- School name, city and nickname. CF97 stores each team's stadium rather than its city, so the city Bill Walsh welcomes you to is filled in for you.
- Home and away uniform colors, mapped from CF97's uniforms and editable with a Genesis color picker.
- End zone color for the team's home games.
- The computer's offense and defense style for the team (optional; see [Styles](#styles)). By default the new team keeps the old team's styles.
- The end-of-season celebration: swapped teams get a "GO TEAM!" card stunt in their own colors (cards, skirts and pom-poms, tops; editable, with a preview).
- The team menus stay alphabetical with the new names.
- The Walsh Report uses the new names.

### What stays the same

- Schedules, rankings, conferences and battery saves: the new team plays in the old team's slot (change conferences and schedules in the [Season](#season) tab).
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

Other Bill Walsh '95 ROMs with a mod work too, such as Elevated v1.1 (checked with v1.1.0-beta.11): when you load one, the app checks that the code the swap patches is unchanged and the ROM space it uses is empty, and says what's in the way if not. The swap keeps all of the mod's changes, and the downloaded ROM is named after your file with `[Team Swap]` added. A ROM that already has swapped teams can't be swapped again; start from the ROM before the swap and load your swap file.

### Swap files

**Save swap file** writes your choices (teams, names, colors, styles) as a small JSON file with no ROM data in it. Load it later, or share it, to rebuild the same ROM from the same source ROMs.

### How it works

- **CF97 teams:** a pointer table at `0x002CEA` lists 112 team records (111 teams and a placeholder). Each record holds the names, a 3-line palette (logo, home uniform, away uniform), a sprite map (logo, wordmark, helmet) and the tiles, compressed with an LZ scheme that `src/core/cfdecomp.ts` decodes. The decoder was checked byte for byte against the game's own routine (`0x0581AC`) for every team, and against video memory in the running game.
- **BW95 teams:** a pointer table at `0x0028DC` lists 36 team blocks. A swap rebuilds the block in place: ratings group, uniforms, logo container, helmet container and names. The roster stays at the same offset at the end of the block.
- **Helpers** (68000 assembly in `asm/`, placed in unused ROM space):
  - `0x1F0000` menu order: the four team steppers (setup home and visitor, `0x06ACB2`, season Team Rosters) step through teams alphabetically by their new names.
  - `0x1F0280` end zone color per home team (the game normally darkens the home jersey's darkest shade).
  - `0x1F0300` helmet tile base on the setup screen, so helmets of up to 36 tiles fit (the stock layout leaves 32).
  - `0x1F0320` celebration colors: when the generic card stunt plays, palette entries 9, 10 and 13 are replaced with the winning team's colors.
- **Walsh Report:** the swapped teams' paragraphs get the new names, and the text block stays where it is: if it gets longer, some two-space sentence gaps become one space; if it gets shorter, the leftover bytes after the last paragraph are filled with spaces. Only if very long names still don't fit is the block moved to `0x1F8000` (its only reference is the pointer at `0x078FC0`).
- **ROM space:** the swap uses about 4.4 KB of unused ROM (`0x1EEF00`-`0x1EFF17` and `0x1F0000`-`0x1F043B`), and checks that it's unused before writing. The Rosters tool's OL weight tweak uses `0x1EFF20`-`0x1EFF3D` (see [Rosters](#how-it-works-2)) and the Season tool's locked-team table `0x1EFF40`-`0x1EFF87` (see [Season](#how-it-works-1)).
- **Celebration:** one "GO TEAM!" card stunt at `0x1EEF00`, built from your BW95 ROM: Pitt's "GO PITT!" card stunt with four cards re-lettered, using letters copied from Pitt's and Texas A&M's cards. Swapped teams' entries in the celebration table (`0x034A68`) point to it.
- **Checksums:** EA's boot check (the sum at `0x1E6430`) and the Genesis header checksum are recomputed.

### Testing

- Pitt → Tulane on the original ROM and on Rebalanced v1.0 (Fixed Fatigue): boot, title, setup screen, Bill Walsh's welcome, Walsh Report, coin toss, pregame, kickoff with the new uniforms and end zones. On the Rebalanced ROM, nothing outside the swap's own changes differs from the input.
- All 36 teams swapped, with the largest CF97 art placed in the smallest BW95 slots: every team checked as home and visitor on the setup screen (art compared with video memory), plus pregame and in-game screens, including 36-tile helmets and 16-character names.
- The menu, end zone, helmet and celebration helpers were run on their own in a 68000 emulator (every team; for the celebration: home win, visitor win and an unswapped team).
- Celebration: test ROMs that play it at the title screen show "GO TEAM!" in Tulane's and Idaho's colors, Penn State's own "PENN STATE #1" unchanged, and the same on a Rebalanced ROM.
- ROMs downloaded from the app are byte-identical to the CLI builds above.
- Elevated v1.1.0-beta.11 (Fixed and No Fatigue): Pitt → Tulane and Wisconsin → Idaho, and all 36 teams swapped. Nothing outside the swap's own changes differs from the input, and every roster is kept. In the emulator: the Elevated title screen, Tulane on the setup screen and the pregame menu. The Tulane builds of beta.11 are refused because they already have a swap.

Not tested in a real game: a full season through the bowls with swapped teams (the celebration was only forced at the title screen), and real hardware.

## Season

Rename Bill Walsh '95's four conferences, choose which teams play in each, and set schedules. It works on the original ROM, Elevated, a Team Swap result or a ROM it saved earlier, and edits the same ROM as the Rosters tab. **Use the Team Swap result** opens the ROM you set up in the Team Swap tab.

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

## Styles

In Bill Walsh '95 the computer calls plays by its team's **style**: one of five offenses and one of three defenses. The style decides which formations it uses on each down; it belongs to the team's slot, so a team swapped in plays the old team's style until you change it. The Styles tab lists all 36 teams with an offense and a defense for each. You can also set them in a swapped team's edit screen in Team Swap, and for the team on screen in the Rosters tab.

| Offense | Formations the computer calls | Original teams |
|---|---|---|
| Option | Wishbone, Flexbone, Goal Line (and Veer on Elevated) | Air Force, Army |
| Pro Style | I-Form, Pro Form, Near, Far, Goal Line | 21 teams, e.g. Alabama, Florida State, Nebraska |
| Multiple | Trap, I-Form, Pro Form, Shotgun, Near, Far, Goal Line | BYU, California, Colorado, Louisville, Michigan, Washington, Washington State |
| Shotgun | I-Form, Pro Form, Shotgun, Near, Far, Goal Line | Florida, LSU, Miami, Pitt, Stanford |
| Power | Trap, I-Form, Tee, Pro Form, Near, Far (and Veer on Elevated) | Notre Dame |

| Defense | Original game | Elevated (v1.1.0-beta.7 and later) | Original teams |
|---|---|---|---|
| 3-4 | 3-4 on early downs, Nickel on 3rd down | 3-4 with some 4-4 against the run, Nickel on 3rd down, Dime on 3rd and long | 13 teams, e.g. Michigan, Notre Dame, Texas |
| 4-3 | 4-3 on early downs, Nickel on 3rd down | 4-3 with some 4-4 against the run, Nickel on 3rd down, Dime on 3rd and long | 20 teams, e.g. Florida State, Ohio State, Penn State |
| Multiple | 3-4 on early downs, 4-4 on 3rd down | 3-4 and 4-3 half and half, 4-4 on 3rd and 4th and 3 | Arizona, Florida, Navy |

Every style uses Goal Line defense near the goal and short yardage, Dime on 4th and long and its special teams for kicks. Each style's lists also change with the situation (short yardage, passing downs, hurry-up, running out the clock); the tables list everything the style calls.

- **Roster layout:** on the original ROM (and Elevated up to beta.6) a team's defense also sets its roster layout: slot 21 is a tackle (RDT) in the 4-3 and an inside linebacker (RILB) in the 3-4, as in the original game. The Rosters tab and its imports follow the defense you pick, but the players already in the slot were chosen for the old one, so import a roster or check slot 21 after switching between 3-4 and 4-3. Elevated beta.7 and later use one layout for every team, so nothing changes there.
- The Walsh Report's scouting text isn't changed (it describes some teams' offenses).

### How it works

- **Team sets:** the computer's play-calling rules test a team's membership in 8 sets, kept as a bit table at `0x062D87` (8 bytes per set, team t = bit t & 7 of byte t >> 3; its offset is the 8th word of the rule table at `0x06106E`). Offense: sets 0-3 = Option, Pro Style, Multiple, Shotgun; a team in none of them runs Power. Defense: sets 5-7 = 3-4, 4-3, Multiple. Set 4 is tested by no rule and left alone.
- **A style change** puts the team in exactly one offense set (none for Power) and exactly one defense set. On ROMs with the original roster layout it also sets the team's bit in the 3-4 roster flags (`0x061068`, clear = 3-4). Nothing else changes, and no free space is used. The app checks that the table is where the original game has it and that its unused bits are clear before writing.
- **Veer:** Elevated v1.1.0-beta.6 and later give the Option and Power styles the Veer plays; the app recognizes them by their play-list jump at `0x079AAE`.
- **Checksums:** EA's boot check and the Genesis header checksum are recomputed.

### Testing

- 9 Node tests: the original ROM reads as the game's documented teams and styles; every style on every team on the original ROM, Rebalanced v1.0, Elevated beta.11 and its Tulane build reads back, changes only the style table (and the 3-4 flags on the original layout), and undoes exactly; damaged tables are refused; Team Swap builds without styles are unchanged, with styles only the style bytes change; style edits are tracked, named and carried to a new Team Swap result.
- In an emulator (Genesis Plus GX), the title screen's demo games (computer against computer, about 275 play calls per ROM, three matchups each) on test ROMs where every team has one style. Original ROM, every team Option and 4-3: only Wishbone, Flexbone and Goal Line plays, and only 4-3, Nickel, Dime and Goal Line defenses (Notre Dame and Oklahoma included, normally 3-4). Every team Shotgun and 3-4: only I-Form, Pro Form, Shotgun (39 calls), Near, Far and Goal Line plays, and only 3-4, Nickel, Dime and Goal Line defenses. Elevated beta.11, every team Option and Multiple: Veer 71 times besides Wishbone, Flexbone and Goal Line, and 4-3 (77) and 3-4 (69) fronts about half and half with a few 4-4 calls.
- ROMs downloaded from the app are byte-identical to the same changes made with the command-line tools: a Team Swap with styles, style changes in the Styles and Rosters tabs on a Team Swap result, and those changes kept after changing the swap.

Not tested: real hardware.

## Rosters

Load a Bill Walsh College Football '95, College Football USA 96 or College Football USA 97 ROM, pick a team, and change its players' jersey numbers and ratings, or import a spreadsheet for many teams at once. Then download the ROM. Original and modified ROMs both work (Bill Walsh '95 Elevated, formerly Rebalanced; Team Swap output; an earlier roster edit; a ROM saved by CFB-Walsh.exe). **Use the Team Swap result** opens the ROM you set up in the Team Swap tab, so swaps, season and roster edits end up in one file (the Season tab edits the same ROM).

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

Bring in real rosters from EA Sports College Football 27: a CSV with one row per player and the column names of EA's ratings site (ea.com/games/ea-sports-college-football/ratings): Team, Name, Position, Overall, Jersey Number, Weight, EA Player ID, Speed, Acceleration, Agility, Strength, Awareness, Play Recognition, Catching, Carrying, Throw Power, Throw Accuracy Short, Mid and Deep, Break Tackle, Trucking, Run Block, Pass Block, Run Block Power, Pass Block Power, Power Moves, Block Shedding, Tackle, Hit Power, Pursuit, Kick Power, Kick Accuracy, Lead Block. Other columns are fine and ignored. The app doesn't come with the data.

- **Each team gets its own players.** The best CFB 27 players at each position fill the team's slots, with their real jersey numbers. If a school has nobody for a slot, a player from a nearby position fills it (most schools have no fullback, so the best blocking back or tight end plays FB; Air Force's punter also kicks).
- **The game plays the same.** CFB 27 decides who is better than whom; the original game decides how many players get each rating. For every position and rating, the players are ranked and given the original game's own ratings in that order, so a team of elite linebackers gets elite linebackers, while the league as a whole keeps the original spread (as many 100-speed corners as before, and so on).
- **Any number of schools.** The file can have one school or all of them; teams that aren't in it keep their rosters, and you pick which of the found teams to write before anything changes. Ratings are ranked among the players in the file. School names: the ROM's, plus CFB 27's Cal and Pittsburgh. A team-swapped slot takes its new school.
- **Linemen's weight.** Today's offensive linemen are about 25 lb heavier than the original game's, but weight matters in line play, so the conversion keeps the original weights. By default it also makes the roster screen show offensive linemen 25 lb heavier (display only; the game plays the same). The editor and the CSV export show the same numbers as the screen.
- Works with the original ROM, Elevated (its DT1/DT2, MLB1/MLB2 defense) and Team Swap results. CF96 and CF97 are planned.

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
npm run test:rosters -- BW95.md CF96.md CF97.md
```

How the Season tool works: [docs/season.md](docs/season.md). Its tests take the original BW95 ROM, CF97 (for the Team Swap checks) and optionally more BW95 ROMs such as Elevated builds; `cli/season.ts` applies a season setup from a JSON spec:

```sh
npm run test:season -- BW95.md CF97.md [Elevated.md …]
npx tsx cli/season.ts BW95.md out.md spec.json
```

How the Styles tool works: [docs/styles.md](docs/styles.md). Its tests take the same ROMs as the Season tests; `cli/styles.ts` lists or changes a ROM's styles, and `cli/build.ts --style Pitt=Option,3-4` sets a swapped team's:

```sh
npm run test:styles -- BW95.md CF97.md [Elevated.md …]
npx tsx cli/styles.ts BW95.md out.md "Florida State=Option,3-4" "Navy=,Multiple"
```

The CFB 27 conversion also runs from the command line, and the stock rating table can be rebuilt from the three original ROMs:

```sh
npx tsx cli/cfb27.ts "Bill Walsh College Football 95 (USA).md" cfb27-ratings.csv rosters.md [--no-ol-tweak] [--teams "Texas,Ohio State"]
npx tsx cli/stockdists.ts src/core/rosterStockDists.json BW95.md CF96.md CF97.md
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
