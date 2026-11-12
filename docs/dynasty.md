# Dynasty

The Dynasty section (`#dynasty`) keeps a multi-season record of the 138-team 2026 Season Edition: the app owns the players, the game plays the games, and the battery save carries each season's results back to the app.

Code: `src/core/dynasty/` (no DOM) and `src/tools/dynasty/` (the pages). Tests: `npm run test:dynasty -- ELEVATED_2026_138_DYNASTY SAVE.srm` (v2.0.1-test9 or later; the test marks the save for its dynasty).

## The battery save

RetroArch's Genesis Plus GX core writes a 65,456-byte `.srm`: cartridge save RAM from $200000, one data byte per word on the odd addresses, so file offset = address − $200000. A file of the data bytes alone (half the size) is read too.

- $200001: signature 0x6F. $200003: 0 once a season exists.
- Season block at $200E01, 0x1330 data bytes (the game copies it with the routines at 0x05B452 and 0x05B48C):

| Offset | Size | What |
|---|---|---|
| +0 | 1 | 0x5A |
| +1 | 1 | index of the last regular-season week |
| +2 | 1 | number of weeks (regular season and postseason) |
| +3 | 1 | flags: bit 0 postseason, bit 1 Real 2026 schedule, bit 2 CFP 24 |
| +6 | word | number of games |
| +8 | words | first game of each week, and one past the last |
| +$34 | 24 | playoff seeds (team numbers, seed 1 first) |
| +$50 | 138 words | power ratings; the Top 25 is the teams in power order, ties by team number |
| +$164 | 138 | each team's rank at the end of last week |
| +$1EE | 18 | the user's teams, one bit per team |
| +$200 | 4 per game | visitor score, visitor, home score, home. A score of FF = not played, FE = HOLD (a user's game); a team of FF = to be decided |

- Season stats at $203951: 138 records of 0xB8 data bytes, one per team, kept per roster slot (season totals, not per game). Labels from the game's Season Stats screens and its category table at 0x0DFB08:

| Category | Offset | Slots | Fields (w = word, sw = signed word, b = byte) |
|---|---|---|---|
| Passing | 0 | 0 | att w, comp w, yds sw, int b, td b |
| Rushing | 8 | 0-3, 8 bytes each | att w, yds sw, long, short, fum, td |
| Receiving | 40 | 1-3, 9-14 | rec w, yds sw, long, drops, fum, td |
| Kicking | 112 | 15 | FGA, FGM, long, blocked, XPA, XPM |
| Punting | 118 | 31 | punts w, yds sw, long, inside 10 |
| Defense | 124 | 16-30, 4 bytes each | tackles w, sacks, int |

A record still all FF has never been cleared and reads as zeros. Passing and receiving add up across the league but not always per team (the game sometimes credits a catch without a completion).

Week names follow the game: with the Real 2026 schedule the first week is Week 0; after the regular season come the conference championships and then the playoff rounds (1, 2, 4 or 5 rounds for 2, 4, 12 or 24 teams).

## The dynasty

**Rosters: 64 per team** (user, 2026-11-12): the Active Roster (the 32 in the game) and a backup for each slot (`rosters.ts`). The 32 are the Rosters tool's CFB 27 conversion of the built-in ratings (what the ROM holds); the backups are the same conversion run again over the players left over, so each slot's backup plays its position, rated on the 32's scale (`rateAgainst` in `rosterCfb27.ts`: for each rating, the step of the converted player of the same role whose CFB 27 score is closest below his). The dynasty keeps only these players (about 8,500 at the start; K/P backups can be shared). In the first season the user can replace every team's backups with generated players (`bench.ts`, Manage page). Pages show all 64, clearly split into "Active Roster" and "Backups" (user, 2026-11-12); a backup's page shows his ratings if he played, ranked against the Active Roster players.

`Dynasty` (`model.ts`) holds the teams (school, nickname, city and uniform colors from the ROM), every player (name, position, class FR/SO/JR/SR/SR+, jersey, height, weight, hometown, OVR, the 54 CFB 27 ratings from Speed on, a skin tone 0-4 for the app's portraits, status) and the seasons. A season has its year, the conferences and their names from the ROM, the 32 roster slots of each team (which dynasty player the ROM has in each slot, so slot stats belong to players), each slot's Bill Walsh '95 ratings (the six 0-15 steps the game uses; at creation they are the Rosters tool's CFB 27 conversion, which for v2.0.0 is exactly what the ROM holds in all 4,416 slots) and the imported saves. Player pages show only these game ratings; a player who isn't in one of his team's 32 slots has none.

- Created from the ROM and the built-in CFB 27 ratings, with the Rosters tool's own CFB 27 conversion choosing each team's 32. A redshirted player starts one class up.
- Each import keeps the save's data bytes (base64). One import per number of completed weeks, the newest kept. An import with fewer results than the last is refused unless allowed; one whose games differ from the last import's is refused as another season. Teams the save marks as the user's are added.
- Everything shown (records, standings, ranks, leaders, records, champions, stories) is derived from the imports (`derive.ts`, `news.ts`), so the same saves always give the same pages.

### Team and player OVRs

- Team OFF and DEF are the ROM's own (what Game Setup shows), read when the dynasty is created.
- A player's OVR comes from his six Bill Walsh '95 ratings: OVR = base + scale × the weighted average of the ratings as the game shows them (0-100), by roster role, capped at 0-99 (`src/core/dynasty/ovr.ts`). Only ratings the game uses at that position count: Weight is mass, not quality; kickers' and punters' Range isn't used for kicks (their Quick is kick distance). Linemen's Block counts: it keeps them on their feet after hard hits. QB Speed is set to 15% (the QB runs in the game; CFB 27's Overall ignores it). The shares, base and scale were fitted to the CFB 27 Overall of the 4,416 starters of v2.0.0:

| Slots | OVR | Average miss | Within 3 |
|---|---|---|---|
| QB | 57 + 0.42 × (Quickness 25%, Awareness 45%, Range 10%, Power 5%, Speed 15%) | 2.2 | 82% |
| HB1, HB2 | 48 + 0.51 × (Speed 35%, Quickness 30%, Awareness 15%, Hands 5%, Power 15%) | 1.3 | 96% |
| FB | 46 + 0.4 × (Speed 40%, Awareness 20%, Hands 15%, Power 25%) | 2.2 | 80% |
| SE, FL, WR1, WR2 | 52 + 0.5 × (Speed 15%, Quickness 25%, Awareness 25%, Hands 15%, Power 20%) | 1.4 | 95% |
| TE1, TE2 | 55 + 0.51 × (Speed 20%, Quickness 25%, Awareness 20%, Hands 25%, Power 10%) | 1.6 | 89% |
| LT, LG, C, RG, RT | 53 + 0.48 × (Power 30%, Blocking 30%, Speed 25%, Awareness 15%) | 1.2 | 98% |
| LDE, RDE | 48 + 0.52 × (Power 15%, Speed 35%, Awareness 20%, Tackling 30%) | 1.2 | 97% |
| DT1, DT2 | 56 + 0.38 × (Power 60%, Speed 10%, Awareness 15%, Tackling 15%) | 1.0 | 97% |
| LOLB, MLB1, ROLB, MLB2 | 35 + 0.55 × (Speed 10%, Quickness 15%, Awareness 35%, Tackling 40%) | 1.4 | 96% |
| LCB1, RCB1, LCB2, RCB2 | 38 + 0.55 × (Speed 30%, Quickness 25%, Awareness 30%, Hands 5%, Tackling 10%) | 1.5 | 93% |
| SS, FS, FS2 | 43 + 0.51 × (Speed 20%, Quickness 20%, Awareness 40%, Hands 5%, Tackling 15%) | 1.1 | 99% |
| K | 65 + 0.22 × (Quick (kick distance) 50%, Accuracy 50%) | 1.6 | 93% |
| P | 62 + 0.24 × (Quick (kick distance) 55%, Accuracy 45%) | 1.5 | 91% |

- All starters: average miss 1.4 from CFB 27, 94% within 3 (`test:dynasty` checks every role stays under 2.5).

### Team colors

The pages use each school's official primary and secondary colors (`src/core/dynasty/schoolColors.ts`, all 138 schools by the ROM's school name); a school missing there falls back to the ROM's team color (the jersey when that is near black or white). The ROM's colors are tuned for the Genesis palette and the uniforms, so they often read wrong on a page (LSU too blue, Iowa blue, Georgia too dark). Marks, meters and charts on white use the primary, or the secondary when the primary is too light (Iowa's gold → black). A game's split picture uses the second team's secondary when both primaries are close (Louisiana and USC reds).

### Storage and the dynasty file

IndexedDB database `genesis-cfb-dynasty`: store `dynasties` (the dynasty and when it changed) and store `art` (each team's logo, helmet and wordmark drawn from the user's ROM). The dynasty file is the dynasty as JSON with `app: "genesis-cfb-toolkit"`, `tool: "dynasty"`, `version: 1`; it never carries the art. A file from a newer version is refused.

### Lineups

`src/core/dynasty/lineup.ts` (user, 2026-11-12). A team has 64 spots: the 32 slots (the Active Roster) and each slot's backup, named QB2, HB3 and HB4 (behind HB1 and HB2), FB2, SE2, FL2, WR3, WR4, TE3, TE4, LT2 … RT2, LDE2, DT3, DT4, RDE2, LOLB2, MLB3, MLB4, ROLB2, LCB3, LCB4, RCB3, RCB4, SS2, FS3, FS4, K2, P2 (`backupLabel`: the family's size plus the slot's number). On a user team's page the Pos column is a menu, grouped by position with ★ on the Active Roster spots; choosing a spot swaps the player with the one there (who must be able to play the spot left; an Active Roster spot is never left empty).

- **Which spots:** any spot of his position (by `DPlayer.pos`, plus the kind of spot he already holds), and one related position: HB↔FB, FB↔TE, DE↔OLB, OLB↔MLB, K↔P. No CB/S or DE/DT (user: so nobody signs corners to play safety). A change to another position sets his `pos` (LE/RE, LOLB/ROLB by the spot) and his CFB 27-style OVR, and is recorded in `posChange` with the season: once a season, so a TE needs a season at FB before HB. In that season he can still move between the spots of both positions (back to his old one undoes the change).
- **Ratings:** within the same role (the conversion's QB, HB, FB, OL, WR, TE, DE, DT, LB, CB, S, K, P) he keeps his steps. In another role he's rated like the backups: per rating, the step of the Active Roster player of that role (all teams) whose CFB 27 score is closest below his (`scoreOf` in `rosterCfb27.ts`).
- **Team OVRs** move by the change in `starterOvr` of the team's starters (season one's are the ROM's own).
- **When:** user teams only, outside the offseason, before any imported save has a result (stats belong to slots). `DSeason.lineupEdited` shows a reminder to download the season's ROM again (cleared by the download). The next offseason's `depthChart` sets every lineup again from the players' positions.

## The season ROM

`seasonRom` (`offseason.ts`) writes a season's 32 per team (jersey numbers and game ratings, on the 2026 record of each slot) and the team OVRs into a copy of the user's ROM, checksums fixed.

- **Only ROMs with the dynasty support** (Elevated 2026 Season Edition v2.0.1-test8 on: the mark `BW95DYN` + version at `0x2B0000`; `dynastyArea.ts`); older ROMs and saves aren't supported before the first public release (user, 2026-11-12: "things are changing fast and big"). Everything goes into the dynasty area `0x3E0000`-`0x3FFFFF`, which Season mode reads and Exhibition never does. Header: the ID block (`DYN1`, dynasty ID = FNV-1a of the dynasty's app ID, season number = season index + 1, roster version, export time in Unix seconds), format word 1, team count 138, then the addresses of the roster set (`0x3E0100`, 138 × 32 game records), the OVR table (`0x3E4600`, `OVR1` + OFF/DEF bytes), the sim words (`0x3E4800`, `simFromOvr`) and (+0x20) the names set (`0x3E5000`, `NAM1`: team count, a long per team, then per slot class byte 0-4, first name, NUL, last name, NUL; Team Rosters' names view in v2.0.1-test9 on; season one's set equals the ROM's own 2026 names table at `0x2C0000`). The ID block is written last. The area must be all `0xFF` or hold a valid header (`DYN1`, `0x0001008A` at +0x10); the 2026 data stays as it is. Season one's sets equal the ROM's own rosters and OVRs.
- **Roster version:** 1, then one more when the lineup changes after the last download (`DSeason.rosterVersion`, lineup editor).
- **The save stamp:** New Season copies the ID block into the season block's +0x1330. `importSave` only takes stamped saves: another dynasty's or season's are refused (this also refuses last season's save in a new season), and an older roster version than the season's gives a warning (the season was started before the last lineup change).
- The Manage page has a Download button for the current season's ROM (the first season's too, so its save gets the stamp); the Offseason page has one for the next season; the lineup editor reminds the user to download again.

## Names and skin tones

`appearance.ts` (user, 2026-11-12). Players are White or Black in the app; that decides the skin tone and, for generated players, which names fit together. Nothing of it goes into the ROM (the game has one skin tone); the tones are for the app's portraits.

- **Share by position** (`BLACK_SHARE`, the user's numbers): QB 45%, HB 95.5, FB 47, WR 81.1, TE 35.4, LT 48.8, LG 49.5, C 34.3, RG 47.9, RT 48.7, LE 75.9, RE 70, DT 73.5, LOLB 75.1, MLB 69.6, ROLB 73.4, CB 98.2, FS 89.6, SS 89.2, K 3.8, P 4.8.
- **Skin tones** (`SKIN_TONES`, `DPlayer.skin` 0-3): Light and Tan for White players, Brown and Dark for Black players, half and half.
- **Name odds** (`nameOdds.json`, built by `cli/nameodds.ts`): for every first and last name in the CFB 27 file, how likely it's a Black player's: the US Census 2010 surname table (public domain) and Tzioumis (2018) first names (Harvard Dataverse, CC0), as copied in the `surgeo` package on PyPI. Names they don't have (many modern first names, hyphenated and rare surnames) are estimated from the other half of the names and the positions of the CFB 27 players who have them, pulled toward the average when few do.
- **Starting players** (`assignBlack`): per position, the share of the position's players, chosen by how their names point plus random noise (a logistic draw), so names lean the choice without fixing it.
- **Generated players** (`makeRecruit`): White or Black by the position's share, then a first and a last name weighted by how often they appear among CFB 27 players and how well they fit (count × odds, or × 1 − odds); never a real CFB 27 player's full name. Only names the game can show well: first names up to 10 characters, last names up to 12 (`MAX_FIRST`, `MAX_LAST`), in the game's font (A-Z a-z 0-9 ' - . space).
- **In the ROM** (the season ROM's names set): every name goes through `gameText` (accents dropped, other characters out, at most 23 characters, the room Team Rosters has for a last name).

## Prestige

`src/core/dynasty/prestige.ts`. Every school has 1-6 stars per season (`DSeason.prestige`). Scale (user, 2026-11-12): final poll top 10 = 6, top 20 = 5, top 35 = 4, top 70 = 3, top 100 = 2, else 1; when the season ends a school moves at most one star toward the tier it finished in. Start: College Football 27's prestige at launch (0-5 in half stars, `CFB27_PRESTIGE`); schools are ranked by it (ties by team OVR in the ROM) and given the tier of their place, so the first season has 10 six-star, 10 five-star, 15 four-star, 35 three-star, 30 two-star and 38 one-star programs. Recruiting and the portal read prestige as (stars − 1) / 5.

## The offseason

`src/core/dynasty/offseason.ts`, pure steps that each return a new dynasty; seeded, so the same choices give the same offseason. `Dynasty.offseason` holds the step, the seed, the events (for the news and the next season's `events`) and the players as they were at the start (Start the offseason over).

1. **startOffseason** (needs every game played, or "End the season early"): SR+ leave; seniors go pro (chance (OVR − 80) / 14, up to 85%), else come back as SR+ (30%) or graduate; juniors go pro (chance (OVR − 84) / 12, up to 70%). Everyone else moves up a class and develops: gain = (potential − OVR) × rate (FR 0.45, SO 0.40, JR 0.35, SR 0.30) × random 0.5-1.5, +1 for one of the team's 32, ± noise. The gain goes to the ratings that count in his position's CFB 27-style Overall (speed-type ratings at 40%). Potential is hidden: given at the first offseason (OVR + 6-18 for a FR … 0-3 for an SR+) or by stars when signed.
2. **runPortal**: nobody leaves too soon for playing time (user, 2026-11-12: the game can't give a backup a few snaps). Active Roster players never enter; backups only after two seasons as backups: 10%, +10% when the starter ahead of him stays, +10% for a senior (`transferChance`). So the first offseason has no transfers. Teams that need the position take them, best players first, stronger programs first in line for the good ones, at most four per team. Nobody takes him: he leaves the dynasty.
3. **runSigningDay**: each team signs 64 − roster (at most 25). Position: the biggest need against the targets, two per slot in the game (QB 2, HB 4, FB 2, WR 8, TE 4, each OL spot 2, LE 2, RE 2, DT 4, LOLB 2, MLB 4, ROLB 2, CB 8, FS 4, SS 2, K 2, P 2 = 64). Then walk-ons for any position with fewer players than slots (`fillMinimums`). Stars by prestige (last season's rank, record, title, roster strength). A recruit is a CFB 27 freshman of that position from the star's Overall band (5★ top 3%, 4★ next 17%, 3★ 35-80%, 2★ 5-35%, 1★ bottom 5%), every rating ±3, a new name and a US hometown from the built-in file. Class points: 5★ 100, 4★ 60, 3★ 30, 2★ 12, 1★ 4.
4. **applyCuts**: down to 64 when a team has more (rare: walk-ons for position minimums), lowest value first (OVR + half the room to potential + years left), never below one per slot. User teams choose (the suggestion is checked). Then walk-ons up to 64, where the need is biggest.
5. **finishOffseason** (needs the ROM, kept in the browser): unique jersey numbers per team (the best player keeps his), the Active Roster and the backups per team (`buildRosters`, so the best backup moves up into an open slot), their game ratings and team OVRs through the Rosters tool's CFB 27 conversion of all the dynasty's players (team OVRs from the starters' game-rating OVRs, so the scale holds from year to year), and the next season.

**Full recruiting** (`src/core/dynasty/recruiting.ts`; chosen on the Offseason page instead of random classes, each offseason):
- **Who enters the portal** (`portalEntries`): the same rule as the random version (`transferChance`: backups after two seasons). They become prospects; their team can't easily get them back (fit × 0.3).
- **The pool** (`startRecruiting`): about 1.4 prospects per open spot in the country (spots = 64 − roster, at most 25), positions in proportion to the country's needs, stars from a national spread, made like the random classes' recruits; each prospect wants playing time, prestige and being close to home in random proportions (portal players mostly playing time).
- **A week** (`runRecruitingWeek`): every team spends 1,000 points, at most 60 on one prospect, and makes offers. Interest gained = points × (0.5 + fit) × (1.2 with an offer, else 0.6) × reach × noise. Fit = his priorities · (playing time he'd get by depth at his position, the school's prestige, closeness: same state 1, same region 0.6, else 0.25). Reach = 1 − 0.2 × (his stars − (prestige stars − 1)), 0.3-1.15. He commits when the leading school (that offered and has a spot) reaches the threshold for his stars (1★ 60 … 5★ 320; portal players 70% of it) and leads the second by 25%, and not before week 2 (3★), 3 (4★) or 4 (5★). A committed 4-5★ prospect can flip to a school two stars more prestigious that outbids his school by 50%. CPU teams target their needs within their star range (up to 2 + prestige × 4 stars), points to the best targets (score squared).
- **Signing day** (`signingDay`): the uncommitted pick the school that offered with the most interest, a spot left and a need at his position; then teams with spots left take the best unsigned high-school players at positions they need (stronger programs first each round). Portal players nobody takes leave. Walk-ons for positions below one per slot.

**Season ROM** (`seasonRom`): the season's 32 per team (numbers and ratings) and team OVRs written into a copy of the ROM, checksums fixed. For the first season it gives the ROM back byte for byte.

A new season's first import is refused when it's the season before's save (same results).

## Next phases

1. ~~ROM interface~~ Done: see "The season ROM" above (Elevated v2.0.1-test8 on).
2. Offseason: ratings progression, seniors leave (or return as SR+ under the 5-in-5 rule; every SR+ leaves after that year), juniors may go pro, the transfer portal, random signing classes, roster cuts (automatic for the computer, suggested for the user's teams), depth charts, roster editing and writing the next season's rosters and OFF/DEF into the ROM.
3. Recruiting, coach careers, recolored game sprites and pixel-art portraits on the news pages, a schedule editor, and Everdrive saves.
