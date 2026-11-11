# Dynasty

The Dynasty section (`#dynasty`) keeps a multi-season record of the 138-team 2026 Season Edition: the app owns the players, the game plays the games, and the battery save carries each season's results back to the app.

Code: `src/core/dynasty/` (no DOM) and `src/tools/dynasty/` (the pages). Tests: `npm run test:dynasty -- ELEVATED_2026_138 SAVE.srm`.

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

`Dynasty` (`model.ts`) holds the teams (school, nickname, city and uniform colors from the ROM), every player (name, position, class FR/SO/JR/SR/SR+, jersey, height, weight, hometown, OVR, the 54 CFB 27 ratings from Speed on, a skin tone 0-4 for the app's portraits, status) and the seasons. A season has its year, the conferences and their names from the ROM, the 32 roster slots of each team (which dynasty player the ROM has in each slot, so slot stats belong to players), each slot's Bill Walsh '95 ratings (the six 0-15 steps the game uses; at creation they are the Rosters tool's CFB 27 conversion, which for v2.0.0 is exactly what the ROM holds in all 4,416 slots) and the imported saves. Player pages show only these game ratings; a player who isn't in one of his team's 32 slots has none.

- Created from the ROM and the built-in CFB 27 ratings, with the Rosters tool's own CFB 27 conversion choosing each team's 32. A redshirted player starts one class up.
- Each import keeps the save's data bytes (base64). One import per number of completed weeks, the newest kept. An import with fewer results than the last is refused unless allowed; one whose games differ from the last import's is refused as another season. Teams the save marks as the user's are added.
- Everything shown (records, standings, ranks, leaders, records, champions, stories) is derived from the imports (`derive.ts`, `news.ts`), so the same saves always give the same pages.

### Storage and the dynasty file

IndexedDB database `genesis-cfb-dynasty`: store `dynasties` (the dynasty and when it changed) and store `art` (each team's logo, helmet and wordmark drawn from the user's ROM). The dynasty file is the dynasty as JSON with `app: "genesis-cfb-toolkit"`, `tool: "dynasty"`, `version: 1`; it never carries the art. A file from a newer version is refused.

## Next phases

1. ROM interface with the Elevated mod: an ID stamp in the season block (grow it to 0x1340, stamp at +0x1330) so a save names its dynasty and season, and a second roster set so Exhibition keeps the 2026 rosters while Season uses the dynasty's. The 0x3E0000-0x3FFFFF area is free in v2.0.0.
2. Offseason: ratings progression, seniors leave (or return as SR+ under the 5-in-5 rule; every SR+ leaves after that year), juniors may go pro, the transfer portal, random signing classes, roster cuts (automatic for the computer, suggested for the user's teams), depth charts, roster editing and writing the next season's rosters and OFF/DEF into the ROM.
3. Recruiting, coach careers, recolored game sprites and pixel-art portraits on the news pages, a schedule editor, and Everdrive saves.
