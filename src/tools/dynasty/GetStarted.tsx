// Starting a dynasty step by step (Get started), the guide to a season (How a season works) and the home page's
// What's next card. User, 2026-11-17: the creation note was "too much information in one alert banner"; "a better
// step by step process for first time dynasty creation … When done then cta to link to the dynasty home page".
// Mockups: the canvas "Dynasty Get started mockups" (approved: "build it").
import { useContext, useState, type ReactNode } from 'react';
import type { Dynasty } from '../../core/dynasty/model';
import { EDITIONS, editionOf, type EditionId } from '../../core/dynasty/edition';
import { weekName } from '../../core/dynasty/derive';
import { seasonDone } from '../../core/dynasty/offseason';
import { Button, Check, Field, FileButton, Note, Select, Steps, SubHead, Table } from '../../ui';
import { Ctx, href } from './ui';
import { SAMPLE_PATH } from '../../core/dynasty/snapshotId';

/** A dynasty made from the user's ROM but not saved yet (Get started's step 1), with what goes into the browser with it. */
export interface Prepared {
  dyn: Dynasty;
  rom: Uint8Array;
  pics: unknown;
  /** The ROM file's name (the version shows in it). */
  fileName: string;
}

export interface StartActions {
  /** Reads the ROM and makes the dynasty from it (throws with the reason when the ROM can't hold one). */
  prepare: (rom: File) => Promise<Prepared>;
  /** Applies the choices, saves the dynasty and opens it. */
  finish: (p: Prepared, o: { name: string; teams: number[]; generated: boolean; coachSim: boolean; year: number }) => Promise<Dynasty>;
  /** Downloads the dynasty file (and remembers when). */
  exportFile: (d: Dynasty) => void;
}

const STEPS = ['ROM', 'Dynasty', 'Options', 'Play'];

/** Where the backups start, by edition (also on Manage). */
export const benchSource = (id: EditionId) =>
  id === '1994' ? 'real players from the 1994 rosters (their ratings are generated)' : 'the next-best real players (CFB 27)';

/** "v2.0.1-test50" from a ROM file's name, if it has one. */
const versionOf = (fileName: string) => fileName.match(/v\d+\.\d+\.\d+(?:-test\d+)?/)?.[0];

export function GetStarted({ actions, busy }: { actions: StartActions; busy: boolean }) {
  const [step, setStep] = useState(0);
  const [prep, setPrep] = useState<Prepared | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [teams, setTeams] = useState<number[]>([]);
  const [addTeam, setAddTeam] = useState('');
  const [generated, setGenerated] = useState(false);
  const [coachSim, setCoachSim] = useState(false);
  const [year, setYear] = useState('');
  const yearN = Number(year);
  const yearOk = /^\d{4}$/.test(year) && yearN >= 1950 && yearN <= 2099;
  const [made, setMade] = useState<Dynasty | null>(null);

  const go = (n: number) => { setStep(n); window.scrollTo(0, 0); };
  const work = async (what: string, fn: () => Promise<void>) => {
    setWorking(what);
    setError(null);
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setWorking(null); }
  };
  const dyn = prep?.dyn;
  const edition = dyn ? editionOf(dyn) : null;
  const off = busy || !!working;

  return (
    <div className="dy-start-wrap">
    <div className="dy-start">
      <Steps label="Start a dynasty" steps={STEPS.map((label) => ({ label }))} current={step} />
      {working && <Note>{working}</Note>}
      {error && <Note kind="error">{error}</Note>}

      {step === 0 && (
        <section>
          <h1>Load your ROM</h1>
          <p>
            A dynasty needs Bill Walsh '95 Elevated v2.1.0 or later: the {EDITIONS['2026'].name} or the {EDITIONS['1994'].name}. The ROM stays in this
            browser. Nothing is uploaded.
          </p>
          {!dyn ? (
            <div className="dy-start-drop">
              <FileButton label="Choose ROM" accept=".md,.bin,.gen,.zip" disabled={off} onFile={(f) => work('Reading the ROM…', async () => { const p = await actions.prepare(f); setPrep(p); setYear(String(p.dyn.startYear)); })} />
              <p className="dy-small dy-dim">.md, .bin, .gen or .zip</p>
            </div>
          ) : null}
          {!dyn && (
            <p className="dy-small dy-start-alt">
              Already have a dynasty in another browser or on another computer? <Button variant="link" href={href('manage')}>Open its dynasty file in Manage</Button>.
            </p>
          )}
          {!dyn ? null : (
            <>
              <div className="dy-start-found">
                <p><strong>{edition!.name}{versionOf(prep!.fileName) ? `, ${versionOf(prep!.fileName)}` : ''}</strong></p>
                <p className="dy-small dy-dim">{prep!.fileName}</p>
                <p className="dy-small">
                  {dyn.teams.length} teams, {dyn.players.length.toLocaleString('en-US')} players.{' '}
                  {edition!.id === '1994'
                    ? 'Players start from the ROM\'s rosters; each team\'s backups are real 1994 players.'
                    : 'Players start from the built-in CFB 27 rosters; redshirted players start one class up.'}
                </p>
              </div>
              <div className="dy-row">
                <Button onClick={() => go(1)}>Next: name it</Button>
                <Button variant="quiet" onClick={() => { setPrep(null); setTeams([]); setYear(''); }}>Choose another ROM</Button>
              </div>
            </>
          )}
        </section>
      )}

      {step === 1 && dyn && (
        <section>
          <h1>Name, starting year and teams</h1>
          <Field label="Dynasty name" value={name} onChange={setName} placeholder="My Dynasty" maxLength={40} />
          <Field
            label="Starting year" value={year} onChange={(x) => setYear(x.replace(/\D/g, '').slice(0, 4))} digits maxLength={4}
            invalid={!yearOk} note={yearOk ? `The first season's year. ${dyn.startYear} for this ROM; a later year if your ROM has that year's rosters.` : 'A year from 1950 to 2099.'}
          />
          <h2>Your teams</h2>
          <p className="dy-small dy-dim">The teams you play as. The game's save marks them too, so you can skip this and add teams later on Manage.</p>
          {teams.length > 0 && (
            <ul className="dy-chips">
              {teams.map((t) => (
                <li key={t}>
                  {dyn.teams[t].school}
                  <button type="button" aria-label={`Remove ${dyn.teams[t].school}`} onClick={() => setTeams(teams.filter((x) => x !== t))}>Remove</button>
                </li>
              ))}
            </ul>
          )}
          <div className="dy-row">
            <Select
              label="Team to add" hideLabel value={addTeam}
              options={[
                { value: '', label: 'Choose a team' },
                ...dyn.teams.filter((t) => !teams.includes(t.index)).sort((a, b) => a.school.localeCompare(b.school)).map((t) => ({ value: t.index, label: t.school })),
              ]}
              onChange={setAddTeam}
            />
            <Button variant="quiet" disabled={addTeam === ''} onClick={() => { setTeams([...teams, Number(addTeam)]); setAddTeam(''); }}>Add team</Button>
          </div>
          <div className="dy-row dy-start-nav">
            <Button variant="quiet" onClick={() => go(0)}>Back</Button>
            <Button disabled={!yearOk} onClick={() => go(2)}>Next: options</Button>
          </div>
        </section>
      )}

      {step === 2 && dyn && (
        <section>
          <h1>Options</h1>
          <p className="dy-dim">All of these can be changed later on Manage.</p>
          <fieldset className="dy-start-choice">
            <legend>Backups</legend>
            <p className="dy-small dy-dim">Every team has a backup for each of the 32 players on its Active Roster. A backup moves up when a spot opens.</p>
            <label><input type="radio" name="dy-bench" checked={!generated} onChange={() => setGenerated(false)} /> <span><strong>Real players</strong><br /><span className="dy-small dy-dim">{benchSource(edition!.id).replace(/^./, (c) => c.toUpperCase())}.</span></span></label>
            <label><input type="radio" name="dy-bench" checked={generated} onChange={() => setGenerated(true)} /> <span><strong>Generated players</strong><br /><span className="dy-small dy-dim">Made-up players instead of real ones.</span></span></label>
          </fieldset>
          <Check checked={coachSim} onChange={setCoachSim}><strong>Coaches affect the sim</strong></Check>
          <p className="dy-small dy-dim dy-start-hint">In simulated games, a head coach better than the average adds 1 to his team's offense or defense OVR, a worse one takes 1 off. Off by default.</p>
          <Note>More settings, for later: Offseason rules (spoilers) and the sim settings, both on Manage.</Note>
          <div className="dy-row dy-start-nav">
            <Button variant="quiet" onClick={() => go(1)}>Back</Button>
            <Button disabled={off} onClick={() => work('Creating the dynasty…', async () => {
              setMade(await actions.finish(prep!, { name, teams, generated, coachSim, year: yearN }));
              go(3);
            })}>Create dynasty</Button>
          </div>
        </section>
      )}

      {step === 3 && made && (
        <section>
          <Note kind="ok"><strong>{made.name} is ready:</strong> {made.players.length.toLocaleString('en-US')} players on {made.teams.length} teams.</Note>
          <Renumbered d={made} />
          <h1>How a season works</h1>
          <SeasonGuide year={made.seasons[0].year} first backup={<Button variant="quiet" onClick={() => actions.exportFile(made)}>Download dynasty file</Button>} />
          <div className="dy-start-go">
            <Button href={href('home')} strong>Go to {made.name}</Button>
            <p className="dy-small dy-dim">This guide stays on Manage, under "How a season works".</p>
          </div>
        </section>
      )}
    </div>
    {step === 0 && <SamplePeek />}
    </div>
  );
}

/**
 * A look at a loaded dynasty beside the first step (user, 2026-11-19: "add something to the /dynasty#start page that
 * teases what a loaded dynasty could look like"; mockup option A picked): the sample dynasty's Home page as a picture,
 * with a link to browse it. Beside the steps on wide screens, under them on a phone.
 */
function SamplePeek() {
  return (
    <aside className="dy-peek" aria-labelledby="dy-peek-h">
      <p className="dy-peek-bar">Sample dynasty: Tulane, 2026, Week 4</p>
      <a href={SAMPLE_PATH} className="dy-peek-shot">
        <img src="/media/dynasty-sample.jpg" width={720} height={397} alt="The sample dynasty's Home page: the week's scores, the lead story and the headlines" />
      </a>
      <div className="dy-peek-body">
        <h2 id="dy-peek-h">What your dynasty will look like</h2>
        <p>Import your save after a week and you get scores, headlines, the Top 25, standings, stats and every roster, season after season.</p>
        <Button href={SAMPLE_PATH}>Browse a sample dynasty</Button>
      </div>
    </aside>
  );
}

/**
 * The players renumbered at creation, closed until asked for (first season only). Their real number isn't allowed at
 * their position; the ROM already wears the same new numbers (H-007; checked on 2026 test54: the 15 on its rosters
 * match, the other 14 are backups the ROM doesn't carry).
 */
export function Renumbered({ d }: { d: Dynasty }) {
  const [show, setShow] = useState(false);
  const list = d.renumbered;
  if (!list?.length || d.seasons.length > 1 || d.offseason) return null;
  const n = list.length;
  return (
    <div className="dy-renum">
      <p>
        <strong>{n} {n === 1 ? 'player wears' : 'players wear'} a different number than in real life.</strong> {n === 1 ? 'His' : 'Their'} real number isn't allowed
        at {n === 1 ? 'his' : 'their'} position in the game (a tight end in the 50s, say). The ROM uses the same new numbers, so nothing changes in the game.
      </p>
      <Button variant="quiet" onClick={() => setShow(!show)}>{show ? 'Hide the list' : n === 1 ? 'Show the player' : `Show the ${n} players`}</Button>
      {show && (
        <Table>
          <thead><tr><th className="ui-left">Player</th><th className="ui-left">Team</th><th>Old</th><th>New</th></tr></thead>
          <tbody>
            {list.map((r, i) => (
              <tr key={i}><td className="ui-left">{r.pos} {r.name}</td><td className="ui-left">{r.school}</td><td className="ui-num">{r.from}</td><td className="ui-num"><strong>{r.to}</strong></td></tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}

/** How a season works, in five steps (Get started's last step and its own page from Manage). */
export function SeasonGuide({ year, first, backup }: { year: number; /** The dynasty's first season (played on the user's own ROM). */ first?: boolean; backup?: ReactNode }) {
  return (
    <ol className="dy-guide">
      <li>
        <h2>Play the {year} season{first ? ' on your ROM' : ` on the ${year} ROM`}</h2>
        <p>
          {first ? 'Play it as it is: the first season needs no download. ' : `The offseason gave you the ${year} ROM. `}
          Use RetroArch's Genesis Plus GX core, start a new season in Season mode and choose your teams.
        </p>
      </li>
      <li>
        <h2>Import your save</h2>
        <p>
          After just one week, played or simmed, you can import your save to start the headlines on the Home tab and the stats. You don't have
          to import every week. <strong>The one save you need is the final one</strong>, after the last game of the postseason: import it before you
          start a new season in the game.
        </p>
        <details className="dy-guide-more">
          <summary>Where's the save?</summary>
          <p>
            It's the <code>.srm</code> file named like your ROM, in RetroArch's saves folder. To find the folder: RetroArch, Settings, Directory, Save Files.
            The game writes it when you leave the game or close RetroArch.
          </p>
        </details>
      </li>
      <li>
        <h2>Run the offseason</h2>
        <p>The Offseason tab, one step at a time. The heart of it is recruiting: weeks of scouting prospects, spending points, pitching your school and making offers, then signing day. Around it come the coaching carousel, players leaving, training, the depth chart, the schedule and the Walsh Reports.</p>
      </li>
      <li>
        <h2>Download the {year + 1} ROM and play it</h2>
        <p>The offseason's last step, Download the ROM, gives you the new season's ROM. Download it, load it in RetroArch and start a new season in Season mode. Play on this ROM from now on: a save from a season started on another ROM can't be imported.</p>
      </li>
      <li>
        <h2>Keep a backup</h2>
        <p>
          Your dynasty is saved in this browser. Come back in the same browser and it's here: there's no file to open, unless the
          browser's site data gets cleared.
        </p>
        <p>
          Still, download the dynasty file often, after every import is best. If the browser's data is cleared, the file brings the dynasty back.
          It also opens the dynasty in another browser or on another computer (Manage, Open dynasty file).
        </p>
        {backup && <div className="dy-row">{backup}</div>}
      </li>
    </ol>
  );
}

/**
 * A shared snapshot's box at the bottom of Home, in place of What's next (user, 2026-11-17: explain the mod and the
 * Dynasty app, "sell" it, with a link to try the mod and start a dynasty).
 */
function WhatsThis() {
  return (
    <section className="dy-next" aria-labelledby="dy-this-h">
      <SubHead level={2} id="dy-this-h">What's this?</SubHead>
      <div className="dy-next-body">
        <h3>A dynasty played in Bill Walsh College Football '95 Elevated</h3>
        <p>
          Elevated is a free fan mod of the 1994 Sega Genesis classic: real rosters from the 2026 and 1994 seasons for over 100 teams, the
          fatigue glitch fixed, hot routes, impact players, alternate uniforms and much more.
        </p>
        <p>
          Its companion Dynasty app turns the game's single season into a dynasty that runs as many seasons as you like: recruiting, player
          progression, real head coaches and a coaching carousel, and headlines like these every week.
        </p>
        <p><strong>The mod and both apps are 100% free.</strong></p>
        <div className="dy-row">
          <Button href="/#get-it">Get the mod</Button>
          <Button variant="quiet" href="/dynasty">Start a dynasty</Button>
        </div>
      </div>
    </section>
  );
}

/** The last import of the dynasty's latest season (ISO time), if any. */
const lastImport = (d: Dynasty) => d.seasons[d.seasons.length - 1].imports.slice(-1)[0]?.at;

/** The home page's card: what to do next, from where the dynasty is (user, 2026-11-17: "What else?" → approved mockup). */
export function WhatsNext() {
  const { d, v, downloadRom, backup, readOnly } = useContext(Ctx)!;
  if (readOnly) return <WhatsThis />;
  const s = d.seasons[d.seasons.length - 1];
  const guide = <a href={href('guide')} className="dy-small">How a season works</a>;
  let label: string;
  let title: string;
  let text: string;
  let action: ReactNode;
  // The one import a season needs (user, 2026-11-17): the final save, before a new season is started in the game.
  const lastGame = editionOf(d).id === '1994' ? 'the bowl games' : 'the championship game';
  const finalSave = (
    <>
      You don't have to import every week. <strong>The one save you need is the final one</strong>, after {lastGame}: import it before you start a
      new season in the game. Then run the offseason here and download the {s.year + 1} ROM for next season.
    </>
  );
  let more: ReactNode = null;
  if (d.offseason) {
    label = `${d.offseason.year} offseason`;
    title = 'Finish the offseason';
    text = `Go on where you left off. The offseason ends with the ${d.offseason.year + 1} ROM.`;
    action = <Button href={href('offseason')}>Continue the offseason</Button>;
  } else if (seasonDone(d)) {
    label = `${s.year} season, over`;
    title = 'Run the offseason';
    text = `Every game is in. The offseason goes one step at a time, with recruiting at its heart, and ends with the ${s.year + 1} ROM.`;
    action = <Button href={href('offseason')}>Start the offseason</Button>;
  } else if (d.seasons.length > 1 && !s.romDownloaded && !s.imports.length) {
    label = `${s.year} season, ready to start`;
    title = `Download the ${s.year} ROM`;
    text = 'Load it in RetroArch and start a new season in Season mode. A save from a season started on another ROM can\'t be imported.';
    action = <Button onClick={() => downloadRom(s.year)}>Download the {s.year} ROM</Button>;
  } else if (!s.imports.length) {
    label = `${s.year} season`;
    title = `Play the ${s.year} season`;
    text = `${d.seasons.length === 1 ? 'Play it on your ROM as it is.' : `Play it on the ${s.year} ROM.`} After just one week, played or simmed, you can import your save to start the headlines here and the stats.`;
    more = finalSave;
    action = <Button href={href('manage')}>Import save</Button>;
  } else {
    label = `${s.year} season, ${weekName(v, v.currentWeek)} next`;
    title = 'Play on, then import your save';
    text = `Import after any week, played or simmed, to update the headlines here, the scores, standings and stats.`;
    more = finalSave;
    action = <Button href={href('manage')}>Import save</Button>;
  }
  const at = lastImport(d);
  const needsBackup = !!at && (!d.backedUp || d.backedUp < at);
  return (
    <section className="dy-next" aria-labelledby="dy-next-h">
      <SubHead level={2} id="dy-next-h">What's next</SubHead>
      <div className="dy-next-body">
        <p className="dy-next-label">{label}</p>
        <h3>{title}</h3>
        <p>{text}</p>
        {more && <p>{more}</p>}
        <div className="dy-row">{action}{guide}</div>
        {needsBackup && backup && (
          <div className="dy-next-backup">
            <p className="dy-small"><strong>No backup since the last import.</strong> Your dynasty is saved in this browser; the dynasty file brings it back if the browser's data is cleared.</p>
            <Button variant="quiet" onClick={backup}>Download dynasty file</Button>
          </div>
        )}
      </div>
    </section>
  );
}
