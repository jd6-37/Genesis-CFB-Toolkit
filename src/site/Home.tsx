// The homepage: what the mod is, both editions, what it changes, the apps, how to get it.
// Media are files in public/media (screenshots and clips from the test ROMs; the CLAUDE.md exception).
import { useState, type ReactNode } from 'react';
import { Button, Glyph, Screen, SetupList, SubHead, Tag, type GlyphKey } from '../ui';
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
          The Sega Genesis' best-playing football game, with its fatigue bug fixed, a deeper playbook, a smarter CPU and full seasons. Two editions:
          every Division I-A team of 1994, or all 138 FBS teams of 2026.
        </p>
        <div className="home-actions">
          <Button variant="chrome" href="/toolkit#patch">Patch your ROM</Button>
          <Button variant="quiet" href="#features">See what's new</Button>
        </div>
        <p className="home-fine">Free and fan-made. The game is not included: you patch your own copy.</p>
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
        <h2>Free</h2>
        <p>No price, no account, no ads. The patches and both apps are free to use.</p>
      </div>
      <div>
        <h2>Fan-made</h2>
        <p>Made by a fan. Not affiliated with or endorsed by EA, the NCAA, or any school or player.</p>
      </div>
      <div>
        <h2>Bring your own game</h2>
        <p>The game is not included. You need your own copy of Bill Walsh College Football '95 (USA) to patch.</p>
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
      ['Postseason', 'The 19 bowl games of the 1994 season'],
      ['Poll', 'Starts from the real 1994 preseason AP poll'],
      ['Rosters', 'Real 1994 names where they are known'],
      ['Title screen', "Bill Walsh, as in '94"],
    ],
  },
  {
    id: '2026', name: '2026 Season Edition', title: M('title-2026.png'),
    rows: [
      ['Teams', '138: every FBS team of 2026, 28 with new art'],
      ['Conferences', 'The 2026 conferences'],
      ['Postseason', 'Title games, then CFP 12, CFP 24, CFP 4 or BCS 2'],
      ['Schedule', 'Random, or the real 2026 schedule'],
      ['Rosters', '2026, from College Football 27 ratings, with names'],
      ['Extras', 'Dynasty app, alternate uniforms'],
    ],
  },
];

function Editions() {
  return (
    <section id="editions" className="home-section home-band">
      <SubHead level={2}>Pick your edition</SubHead>
      <p className="home-intro">Same game engine, same new features. The editions differ in teams, rosters and postseason.</p>
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
        <h2 id="fatigue" className="home-h2">Fatigue, fixed</h2>
        <p>
          In the original game a running back lost about 27% of his energy on every carry and barely got any of it back during a drive. Two carries,
          and your best back was done until a timeout. Fixing that is why this mod exists.
        </p>
        <p>
          Now every player tires from what he does on the play: the distance he runs, the time he spends in a block, the hits he takes. And everyone
          gets a quarter of it back at every snap.
        </p>
        <div className="home-compare" role="table" aria-label="Fatigue, original and Elevated">
          <div role="row" className="home-compare-head"><span role="columnheader" /><span role="columnheader">Original</span><span role="columnheader">Elevated</span></div>
          <div role="row"><span role="rowheader">Who tires</span><span role="cell">Ball carriers, fast</span><span role="cell">Everyone, by what he does</span></div>
          <div role="row"><span role="rowheader">During a drive</span><span role="cell">Almost no recovery</span><span role="cell">A quarter back at every snap</span></div>
          <div role="row"><span role="rowheader">Timeouts, halftime</span><span role="cell">Back to full</span><span role="cell">Back to full</span></div>
        </div>
      </div>
      <Screen src={M('energy.png')} alt="Hold Z before the snap: an energy bar over every player" caption="Hold Z before the snap for everyone's energy (6-button pad)." />
    </section>
  );
}

const FEATURES: { title: string; body: ReactNode; controls?: [GlyphKey[], string][]; media: { src: string; video?: string; alt: string; caption?: string } }[] = [
  {
    title: 'Run the show before the snap',
    body: 'Send a back or receiver in motion, flip the play at the line, or shift your defensive line, linebackers and safeties a step either way. Man defenders follow the motion, and a CPU defense usually flips with you.',
    controls: [[['dpad'], 'Pick a man and send him in motion'], [['A', 'X'], 'Flip the play at the line'], [['X', 'Z', 'Y'], 'On defense: shift the line, linebackers or safeties']],
    media: { src: M('motion.png'), video: M('motion.mp4'), alt: 'A slot receiver goes in motion across the formation and his defender follows' },
  },
  {
    title: 'Five receivers. Six buttons.',
    body: "With a 6-button pad, X and Y throw to the 4th and 5th receivers. Hold Y before the snap for the play art and each receiver's number. With a 3-button pad the game plays as it always did.",
    controls: [[['C', 'X'], 'Throw to receiver 4 (Y for receiver 5)'], [['Y'], 'Hold before the snap: play art and numbers']],
    media: { src: M('xy-passing.png'), alt: 'A pass play with the A, B, C, X and Y receiver icons' },
  },
  {
    title: 'A deeper playbook',
    body: 'Eight new formations, among them Singleback, Pistol, Trips and Empty, with 100 plays adapted from Madden NFL 97, plus 67 plays from College Football USA 97, an RPO and HB Swing. The CPU calls them all, and Flip Play mirrors any of them.',
    controls: [[['X'], 'Flip the play on the play-call screen'], [['Y'], 'Back to the formations']],
    media: { src: M('playcall.png'), alt: 'The play-call screen: the Singleback, SB 3WR, SB 4WR, Pistol, 4 WR, Empty, Trips and Shotgun 2RB formations' },
  },
  {
    title: 'Fresh legs in the backfield',
    body: 'SWAP HBS on the play-call screen sends your second halfback in; on defense, SWAP MLBS does the same for the middle linebackers. He plays with his own ratings, energy and stats until you swap back, and CPU teams rotate their backs as they tire.',
    controls: [[['Z'], 'Swap on the play-call screen']],
    media: { src: M('swap.png'), video: M('swap.mp4'), alt: 'The play-call screen: SWAP HBS turns yellow when the second halfback is in' },
  },
  {
    title: 'A CPU that adjusts',
    body: 'Four difficulty levels, from Normal (the original game) to Champion. From Smart up the CPU audibles against your formation, leans toward stopping what works for you, goes for it on 4th and short, and mirrors its alignment when you flip a play.',
    media: { src: M('flip-defense.png'), video: M('flip-defense.mp4'), alt: 'The offense flips at the line and the CPU defense realigns to match' },
  },
  {
    title: 'Every play has a name',
    body: 'Play recaps name the receiver, the runner and the tackler. Milestone banners pop up for 100-yard rushers and 50-yard catches, ranked teams carry their Top 25 rank in the score box, and three impact players a team are marked on the field.',
    media: { src: M('recap.png'), video: M('recap.mp4'), alt: 'A play recap: First down, run by number 22, tackle by number 12' },
  },
  {
    title: 'Bowls, polls and a Playoff',
    body: '1994: an 11-week season in the 1994 conferences and the 19 bowl games of that year, from the real preseason AP poll. 2026: random or real schedules, conference title games and a 12-team Playoff, or 24, 4, BCS 2 or none.',
    media: { src: M('cfp-bracket.png'), alt: 'The CFP bracket screen: 12 teams, seeds 1 to 4 with a bye' },
  },
];

function Features() {
  return (
    <section id="features" className="home-section home-features">
      <SubHead level={2}>On the field</SubHead>
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
                    <span className="home-keys">{keys.map((k) => <Glyph key={k} k={k} />)}</span>
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
  ['Explosive plays', 'Ball carriers keep their speed longer on long runs and after the catch.'],
  ['Pitches that connect', 'Pitches to fast backs are aimed again in flight and no longer land behind them.'],
  ['Old bugs, fixed', 'The 2-point try kickoff, and a season sim that read offense and defense backwards.'],
  ['Long balls fly faster', 'The slowest deep throws hang in the air less.'],
  ['Onside kicks', 'Harder to recover, as they should be.'],
  ['Faster kickoffs', 'About 5 seconds from a score to the kick, not 13.'],
  ['Rosters on Game Setup', "Press Z to look over any team's roster, with names."],
  ['Alternate uniforms', 'Press Y on the controller screen to pick a helmet, jersey and pants.'],
  ['Menu music', 'X turns it off on any menu, and the game remembers.'],
];

function More() {
  return (
    <section className="home-section home-deep" aria-labelledby="more">
      <h2 id="more" className="home-h2">And a lot more</h2>
      <ul className="home-more">
        {MORE.map(([h, b]) => (
          <li key={h}><h3>{h}</h3><p>{b}</p></li>
        ))}
      </ul>
      <p className="home-more-link"><Button variant="link" href="/manual">Every control and screen is in the manual</Button></p>
    </section>
  );
}

function Apps() {
  return (
    <section className="home-section home-band" aria-labelledby="apps">
      <SubHead level={2} id="apps">Two free apps to go with it</SubHead>
      <div className="home-apps">
        <article className="home-app">
          <Screen wide src={M('app-toolkit.png')} alt="The Mod Toolkit" />
          <h3 className="home-h3">Mod Toolkit</h3>
          <p>
            Patch the game in your browser, then make it yours: edit rosters, import College Football 27 ratings, swap teams, set each team's offense
            and defense, write Walsh Reports.
          </p>
          <Button variant="quiet" href="/toolkit">Open the Mod Toolkit</Button>
        </article>
        <article className="home-app">
          <Screen wide src={M('app-dynasty.png')} alt="The Dynasty app" />
          <h3 className="home-h3">Dynasty</h3>
          <p>
            Run a program for as many seasons as you like: recruiting, player progression, schedules, awards and records. The app writes each new season
            into your ROM. 2026 Season Edition.
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
      <SubHead level={2} id="get">Get it in three steps</SubHead>
      <ol className="home-steps">
        <li>
          <h3>Your own copy</h3>
          <p>You need the original USA release of Bill Walsh College Football '95. We don't host it and can't send it.</p>
        </li>
        <li>
          <h3>Patch it in your browser</h3>
          <p>The Mod Toolkit checks your ROM and builds the edition you pick; the file never leaves your computer. Any BPS patcher works too.</p>
        </li>
        <li>
          <h3>Play</h3>
          <p>In RetroArch with the Genesis Plus GX core, or on a flash cart like the Mega EverDrive Pro. A 6-button pad unlocks the new controls.</p>
        </li>
      </ol>
      <div className="home-actions">
        <Button variant="chrome" href="/toolkit#patch">Patch your ROM</Button>
        <Button variant="link" href={`${REPO_URL}/releases/latest`}>Or download the BPS patches</Button>
      </div>
    </section>
  );
}

function Insights() {
  return (
    <section className="home-section home-band" aria-labelledby="insights">
      <SubHead level={2} id="insights">Insights</SubHead>
      <p className="home-intro">Deep dives into the mod and into the game's own code: what the ratings do, how a play is decided, how the CPU thinks.</p>
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
