// The homepage: what the mod is, both editions, what it changes, the apps, how to get it.
// Media are files in public/media (screenshots and clips from the test ROMs; the CLAUDE.md exception).
// Copy rule (owner): direct and literal. Headings name the feature; sentences say what it does. No slogans or wordplay.
import { useState, type ReactNode } from 'react';
import { Button, Keys, Screen, SetupList, SubHead, Tag, type KeyStep } from '../ui';
import { posts } from './content';
import { REPO_URL } from './routes';

const M = (f: string) => `/media/${f}`;

type Edition = '1994' | '2026';
const HERO: Record<Edition, { src: string; video: string; alt: string }> = {
  '2026': { src: M('hero-2026.png'), video: M('hero-2026.mp4'), alt: 'A 2026 Season Edition game: Notre Dame at Florida State' },
  '1994': { src: M('hero-1994.png'), video: M('hero-1994.mp4'), alt: 'A 1994 Season Edition game' },
};

function Hero() {
  const [ed, setEd] = useState<Edition>('2026');
  return (
    <section className="home-hero" aria-labelledby="home-title">
      <div className="home-hero-text">
        <h1 id="home-title" className="home-title">
          <span>Bill Walsh College Football '95</span>
          <span className="home-title-elevated" aria-label="Elevated">E L E V A T E D</span>
        </h1>
        <p className="home-lede">
          A free mod for the Sega Genesis game Bill Walsh College Football '95. It fixes the fatigue bug and adds new formations and plays, harder
          CPU difficulty levels, and full seasons with bowls or a playoff. There are two editions: the 107 Division I-A teams of 1994, or the 138 FBS
          teams of 2026.
        </p>
        <div className="home-actions">
          <Button variant="chrome" href="/toolkit#patch">Patch your ROM</Button>
          <Button variant="quiet" href="#features">See the features</Button>
        </div>
        <p className="home-fine">The game is not included. You patch your own copy.</p>
      </div>
      <div className="home-hero-screen">
        <Screen key={ed} src={HERO[ed].src} video={HERO[ed].video} alt={HERO[ed].alt} />
        <div className="home-switch" role="group" aria-label="Show a game from">
          {(['1994', '2026'] as const).map((e) => (
            <button key={e} type="button" aria-pressed={ed === e} onClick={() => setEd(e)}>
              {e} Season
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function Notice() {
  return (
    <section className="home-notice" aria-label="Before you start">
      <div>
        <h2>100% Free</h2>
        <p>The patches and both apps are 100% free, forever. Never pay for this mod.</p>
      </div>
      <div>
        <h2>Fan-made</h2>
        <p>Made by a fan. Not affiliated with or endorsed by EA, the NCAA, or any school or player.</p>
      </div>
      <div>
        <h2>Game not included</h2>
        <p>You need your own copy of Bill Walsh College Football '95 (USA) to patch.</p>
      </div>
    </section>
  );
}

const EDITIONS: { id: Edition; name: string; title: string; rows: [string, string][] }[] = [
  {
    id: '1994', name: '1994 Season Edition', title: M('title-1994.png'),
    rows: [
      ['Teams', '107: every Division I-A team of 1994'],
      ['Conferences', 'The 11 conferences of 1994'],
      ['Schedule', 'Random, or the real 1994 schedule'],
      ['Season', '11 weeks (the real schedule: Weeks 0 to 13), the SEC Championship Game, then a bowl week'],
      ['Postseason', 'The SEC Championship Game, then the 19 bowl games of the 1994 season'],
      ['Poll', 'Starts from the real 1994 preseason AP poll'],
      ['Rosters', 'Real 1994 names for 2,962 of 3,424 players. Every player has a number and ratings'],
    ],
  },
  {
    id: '2026', name: '2026 Season Edition', title: M('title-2026.png'),
    rows: [
      ['Teams', '138: every FBS team of 2026 (28 with newly made art)'],
      ['Conferences', 'The 2026 conferences'],
      ['Schedule', 'Random, or the real 2026 schedule'],
      ['Postseason', 'Conference title games, then a 12-team playoff. Or a 24- or 4-team playoff, a BCS title game, or none'],
      ['Rosters', '2026 rosters with player names, rated from College Football 27'],
      ['Rules', "Today's clock rules (the clock keeps running after first downs until the last 2:00 of a half) and today's overtime (no ties; two-point tries from the 3rd overtime)"],
    ],
  },
];

function Editions() {
  return (
    <section id="editions" className="home-section home-band">
      <SubHead level={2}>Two editions</SubHead>
      <p className="home-intro">Both editions have the same features. They have different teams, rosters and postseasons.</p>
      <div className="home-editions">
        {EDITIONS.map((e) => (
          <article key={e.id} className="home-edition">
            <Screen src={e.title} alt={`The ${e.name} title screen`} />
            <h3>{e.name}</h3>
            <SetupList label={e.name} rows={e.rows} />
          </article>
        ))}
      </div>
    </section>
  );
}

function Fatigue() {
  return (
    <section className="home-section home-raised home-split" aria-labelledby="fatigue">
      <div className="home-split-text">
        <h2 id="fatigue" className="home-h2">The fatigue fix</h2>
        <p>
          In the original game, a running back loses about 27% of his energy on a short carry and gets back about 4% before the next snap. After
          two or three carries in a row he plays well below his ratings until the next timeout. This mod started as a fix for that.
        </p>
        <p>
          In Elevated, every player loses energy for what he does during a play: how far he runs, how long he is in a block, and the hits he takes.
          At every snap, each player recovers a quarter of the energy he has lost.
        </p>
        <div className="home-compare" role="table" aria-label="Fatigue in the original game and in Elevated">
          <div role="row" className="home-compare-head"><span role="columnheader" /><span role="columnheader">Original</span><span role="columnheader">Elevated</span></div>
          <div role="row"><span role="rowheader">Who gets tired</span><span role="cell">Mostly ball carriers</span><span role="cell">Every player, by what he does</span></div>
          <div role="row"><span role="rowheader">Recovery at each snap</span><span role="cell">About 4% energy</span><span role="cell">A quarter of what he lost</span></div>
          <div role="row"><span role="rowheader">After a timeout or halftime</span><span role="cell">Full energy</span><span role="cell">Full energy</span></div>
        </div>
      </div>
      <Screen src={M('energy.png')} alt="Z held before the snap: an energy bar over every player" caption="Hold Z before the snap to see every player's energy (6-button pad)." />
    </section>
  );
}

const FEATURES: { title: string; body: ReactNode; controls?: [KeyStep[], string][]; media: { src: string; video?: string; alt: string; caption?: string } }[] = [
  {
    title: 'Motion, flips and shifts before the snap',
    body: 'On offense, you can send a back or receiver in motion, and flip the play to the other side at the line. On defense, you can shift the line, the linebackers or the safeties a step left or right. Man-to-man defenders follow a player in motion, and the CPU defense usually realigns when you flip the play.',
    controls: [[['up', '/', 'down'], 'Pick the player to send in motion'], [['left', '/', 'right'], 'Send him in motion'], [['A', ',', 'X'], 'Flip the play at the line'], [['X', '/', 'Z', '/', 'Y'], 'On defense: pick the line, linebackers or safeties to shift']],
    media: { src: M('motion.png'), video: M('motion.mp4'), alt: 'A slot receiver goes in motion across the formation and his defender follows' },
  },
  {
    title: 'Throw to five receivers',
    body: "With a 6-button pad, X throws to the 4th receiver and Y to the 5th. Hold X before the snap to see the play's diagram and which button throws to each receiver. With a 3-button pad, passing works as in the original game.",
    controls: [[['C'], 'Bring up the receiver icons'], [['X', '/', 'Y'], 'Throw to receiver 4 or 5'], [['X'], "Hold before the snap: the play's diagram and each receiver's button"]],
    media: { src: M('xy-passing.png'), alt: 'A pass play with the A, B, C, X and Y receiver icons' },
  },
  {
    title: 'Hot routes and the speed option',
    body: "Before the snap, press Y, then a receiver's button, then a direction to change his route: streak, out, slant or curl, or Y for a drag and C to block. Backs get a wheel, swing, angle, check-release or screen. Hold X to see every receiver's route above his head. New option plays (a speed option in five formations, and the Near and Far sweeps) let you keep the ball or pitch it with C. Backs in motion run out to the slot, and you can send several players in motion, one after another.",
    controls: [[['Y'], 'Open the hot route menu'], [['A', '/', 'B', '/', 'C'], "Then the receiver's button (or X, Y)"], [['dpad'], 'Then his route'], [['Z'], 'Cancel'], [['X'], 'Hold: every route']],
    media: { src: M('manual/presnap-offense.png'), alt: "X held before the snap: the play art top right, each receiver's button and number at his feet and his route above his head" },
  },
  {
    title: 'New formations and plays',
    body: 'Eight new formations: Singleback, SB 3WR, SB 4WR, Pistol, 4 WR, Empty, Trips and Shotgun 2RB, with 100 plays adapted from Madden NFL 97. Also new: 67 plays from College Football USA 97, an RPO and an HB Swing. The CPU calls all of them, and Flip Play works on every play.',
    controls: [[['X'], 'Flip the play on the play-call screen'], [['Y'], 'Go back to the formations']],
    media: { src: M('playcall.png'), alt: 'The play-call screen: the Singleback, SB 3WR, SB 4WR, Pistol, 4 WR, Empty, Trips and Shotgun 2RB formations' },
  },
  {
    title: 'Substitute players, a first in the game',
    body: 'For the first time in Bill Walsh \'95, you can take a tired starter out. On the play-call screen, SWAP HBS puts your second halfback in for the first. On defense, SWAP MLBS does the same for the middle linebackers. The backup plays with his own ratings, energy and stats until you swap back or the half ends. CPU teams swap when their starter gets tired.',
    controls: [[['Z'], 'Swap on the play-call screen']],
    media: { src: M('swap.png'), video: M('swap.mp4'), alt: 'The play-call screen: SWAP HBS turns yellow when the second halfback is in' },
  },
  {
    title: 'Difficulty levels, new to the game',
    body: 'The original game has no difficulty setting: the CPU always plays one way. Elevated adds four levels: Normal (the original game\'s CPU), Smart, Elite and Champion. From Smart up, the CPU calls audibles against your formation, calls more plays to stop what has worked for you, goes for it on 4th and short, and realigns its defense when you flip a play.',
    media: { src: M('flip-defense.png'), video: M('flip-defense.mp4'), alt: 'The offense flips at the line and the CPU defense realigns to match' },
  },
  {
    title: 'Impact players',
    body: 'Every team has three impact players: its best players by position group, picked from the ratings. A white X under each one marks him all game, and Team Rosters shows a yellow dot next to his position. A hot streak puts an impact player in the zone: the X turns into a flame X, and his key ratings and awareness go up. A quarterback gets there with 4 completions in a row or a touchdown pass, a back with 3 runs of 4 yards or more in a row or a 15-yard run, a receiver with 3 catches on a drive or a 20-yard catch, a defender with a sack, a tackle for loss or an interception. A sack, an interception, a tackle for loss, a drop or a touchdown allowed knocks him out, and the zone lasts about 8 plays. CPU teams have impact players too. Both editions.',
    media: { src: M('manual/rosters-ratings.png'), alt: 'Team Rosters: the impact players have a yellow dot and a yellow position' },
  },
  {
    title: 'Alternate uniforms',
    body: 'Press Y under a team on the controller screen to pick its helmet, jersey and pants before kickoff. The player beside the menu changes as you go. Most teams have their real alternates: in the 2026 edition an extra helmet and pants, often a second colored jersey, and blackouts for the teams that wear them; in the 1994 edition mostly a second pair of pants. The CPU picks for its own teams, and the Mod Toolkit edits every team\'s choices. Both editions.',
    controls: [[['Y'], 'Open or close the uniform menu'], [['dpad'], 'Up and down: helmet, jersey or pants. Left and right: change it']],
    media: { src: M('uniforms.png'), video: M('uniforms.mp4'), alt: 'The controller screen with the uniform menu open for Utah: helmet, jersey and pants change on the player beside it' },
  },
  {
    title: 'Dynasty: as many seasons as you like',
    body: (
      <>
        Our companion <Button variant="link" href="/dynasty">Dynasty app</Button> turns the game's single season into a dynasty. Import your
        save as you play: it keeps every score, standing, poll and stat, and writes the news. After the last game it runs the offseason step
        by step: the coaching carousel with real head coaches, seniors leaving, recruiting, training, conferences and the schedule, and a new
        Walsh Report for every team. Then it writes the next season into your ROM, rosters and all. It runs in your browser and works with
        both editions.
      </>
    ),
    media: { src: M('app-dynasty.png'), alt: 'The Dynasty app: the news front page of a dynasty' },
  },
  {
    title: 'Play recaps and milestones',
    body: 'After each play, a recap names the players involved, with their jersey numbers. Banners appear for game milestones, such as a catch of 75 yards or more. Ranked teams show their Top 25 rank in the score box.',
    media: { src: M('recap.png'), video: M('recap.mp4'), alt: 'A 75-yard touchdown pass, then the recap "Pass to #1 Derrick Mayes for 75 yards" and a "75+ Yard Catch" milestone banner' },
  },
  {
    title: 'Real rosters for both seasons',
    body: (
      <>
        The original game has 36 teams and no player names. Both editions have every team of their season, with real players.
        The 2026 rosters were the easy part, thanks to the hard work of the EA Sports team on College Football 27: all 138 FBS teams,
        every player named, with ratings converted from CFB 27's (Week 9 update) to this game's scale. The 1994 rosters took our own
        research: all 107 Division I-A teams, and 2,962 of 3,424 players with their real 1994 names, matched by team, jersey number
        and position from 9,872 rows of 1994 rosters. Their ratings start from a ranked list of 2,857 of 1994's best players built
        from 10,731 facts; each new team's players were rated to fit its 1994 record and conference, and every team's OFF and DEF
        ratings come from its players' 20,544 ratings.{' '}
        <Button variant="link" href="/insights/1994-rosters">How we built the 1994 rosters</Button>
      </>
    ),
    media: { src: M('rosters-1994.png'), alt: 'Team Rosters, names view, for Kansas: each player\'s number, position, class and name' },
  },
  {
    title: 'Full seasons with bowls or a playoff',
    body: (
      <>
        1994 edition: an 11-week season in the 1994 conferences or the real 1994 schedule, starting from the real 1994 preseason AP poll, then the SEC Championship Game and the 19 bowl games of that year. 2026 edition: a random schedule or the real 2026 schedule, conference title games, then a 12-team playoff. You can also pick a 24- or 4-team playoff, a BCS title game, or no postseason. In both editions, simulated games score and end close to real seasons, and home teams win more often.{' '}
        Multi-year dynasties are now possible too: our companion <Button variant="link" href="/dynasty">Dynasty app</Button> carries
        each season into the next one, for as many seasons as you like, with recruiting, player progression and coaches.
      </>
    ),
    media: { src: M('cfp-bracket.png'), alt: 'The CFP bracket screen: 12 teams, seeds 1 to 4 with a bye' },
  },
];

function Features() {
  return (
    <section id="features" className="home-section home-features">
      <SubHead level={2}>New features</SubHead>
      {FEATURES.map((f, i) => (
        <article key={f.title} className={`home-feature${i % 2 ? ' home-feature-flip' : ''}`}>
          <Screen src={f.media.src} video={f.media.video} alt={f.media.alt} caption={f.media.caption} />
          <div className="home-feature-text">
            <h3 className="home-h3">{f.title}</h3>
            <p>{f.body}</p>
            {f.controls && (
              <ul className="home-controls" aria-label="Controls">
                {f.controls.map(([keys, what]) => (
                  <li key={what}>
                    <Keys keys={keys} />
                    {what}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}

const MORE: [string, string][] = [
  ['More explosive plays', 'Ball carriers keep more of their speed on long runs and after a catch, so big gains happen more often.'],
  ['Pitch fix', 'Pitches to fast backs no longer land behind them.'],
  ['Bug fixes', 'After a fumble on a 2-point try, the right team kicks off. The season sim no longer mixes up offense and defense ratings.'],
  ['Faster deep passes', 'Long, high passes spend less time in the air.'],
  ['Onside kicks', 'The kicking team recovers them less often.'],
  ['Faster kickoff setup', 'About 5 seconds from a score to the kickoff instead of 13.'],
  ['Rosters on Game Setup', "Press Z on Game Setup to see any team's roster, with player names."],
  ['Menu music off', 'Press X on a menu to turn the music off. The game remembers the setting.'],
];

function More() {
  return (
    <section className="home-section home-deep" aria-labelledby="more">
      <h2 id="more" className="home-h2">Other changes</h2>
      <ul className="home-more">
        {MORE.map(([h, b]) => (
          <li key={h}><h3>{h}</h3><p>{b}</p></li>
        ))}
      </ul>
      <p className="home-more-link"><Button variant="link" href="/manual">Read the manual for every control and screen</Button></p>
    </section>
  );
}

function Apps() {
  return (
    <section className="home-section home-band" aria-labelledby="apps">
      <SubHead level={2} id="apps">Two free web apps</SubHead>
      <div className="home-apps">
        <article className="home-app">
          <Screen wide src={M('app-toolkit.png')} alt="The Mod Toolkit" />
          <h3 className="home-h3">Mod Toolkit</h3>
          <p>
            Patches your ROM in the browser. It also edits rosters, imports College Football 27 ratings, swaps teams, sets each team's offense and
            defense style, edits Walsh Reports and alternate uniforms, moves teams between conferences, and sets how simulated games score and how big their stats are.
          </p>
          <Button variant="quiet" href="/toolkit">Open the Mod Toolkit</Button>
        </article>
        <article className="home-app">
          <Screen wide src={M('app-dynasty.png')} alt="The Dynasty app" />
          <h3 className="home-h3">Dynasty</h3>
          <p>
            Runs a dynasty over many seasons: recruiting, player progression, real head coaches and a coaching carousel, schedules, a preseason Top 25, a new Walsh Report for every team each season, awards and records. After each season it writes the next
            season into your ROM. Both editions. Get started walks you through your first season step by step.
          </p>
          <Button variant="quiet" href="/dynasty">Open Dynasty</Button>
        </article>
      </div>
    </section>
  );
}

function GetIt() {
  return (
    <section id="get-it" className="home-section home-raised" aria-labelledby="get">
      <SubHead level={2} id="get">How to get it</SubHead>
      <ol className="home-steps">
        <li>
          <h3>Get the game</h3>
          <p>You need the original USA release of Bill Walsh College Football '95. This site does not host the game or send it.</p>
        </li>
        <li>
          <h3>Patch it</h3>
          <p>
            Open the Mod Toolkit, load your ROM and pick an edition. The Toolkit checks the ROM and builds the patched file in your browser; your file
            is not uploaded. You can also use the BPS patches with any BPS patcher.
          </p>
        </li>
        <li>
          <h3>Play it</h3>
          <p>
            Play in RetroArch with the Genesis Plus GX core, or on a flash cart such as the Mega EverDrive Pro. The new controls need a 6-button pad.
            For a dynasty over many seasons, start one in the <Button variant="link" href="/dynasty">Dynasty app</Button> and import your save as you play.
          </p>
        </li>
      </ol>
      <div className="home-actions">
        <Button variant="chrome" href="/toolkit#patch">Patch your ROM</Button>
        <Button variant="link" href={`${REPO_URL}/releases/latest`}>Download the BPS patches</Button>
      </div>
    </section>
  );
}

function Insights() {
  return (
    <section className="home-section home-band" aria-labelledby="insights">
      <SubHead level={2} id="insights">Insights</SubHead>
      <p className="home-intro">Articles on how the game's code works and what the mod changes: what each rating does, how simulated games are decided, how fatigue works.</p>
      <ul className="home-posts">
        {posts.slice(0, 3).map((p) => (
          <li key={p.slug}>
            <a href={`/insights/${p.slug}`}>
              <Tag>{p.tag}</Tag>
              <h3>{p.title}</h3>
              <p>{p.dek}</p>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Home() {
  return (
    <>
      <Hero />
      <Notice />
      <Editions />
      <Fatigue />
      <Features />
      <More />
      <Apps />
      <GetIt />
      <Insights />
    </>
  );
}
