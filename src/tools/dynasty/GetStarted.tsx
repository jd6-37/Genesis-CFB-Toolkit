// Starting a dynasty step by step (Get started), the guide to a season (How a season works) and the home page's
// What's next card. User, 2026-11-17: the creation note was "too much information in one alert banner"; "a better
// step by step process for first time dynasty creation … When done then cta to link to the dynasty home page".
// Mockups: the canvas "Dynasty Get started mockups" (approved: "build it").
import { useContext, useState, type ReactNode } from 'react';
import type { Dynasty } from '../../core/dynasty/model';
import { EDITIONS, editionOf, type EditionId } from '../../core/dynasty/edition';
import { weekName } from '../../core/dynasty/derive';
import { seasonDone } from '../../core/dynasty/offseason';
import { Button, Field, FileButton, Note, Select, Steps, SubHead, Table } from '../../ui';
import { Ctx, href } from './ui';
import { SAMPLE_PATH } from '../../core/dynasty/snapshotId';
import { KNOWN, openRom, type OpenedRom } from '../../core/romfile';
import { zipName } from '../../core/zip';
import { PATCH_CONTENT } from '../../core/dynasty/upgrade';
import { saveOriginal } from '../../core/dynasty/storage';
import { SETUP_LABELS } from '../../core/dynasty/setup';
import { applyListed, fetchPatchFile, fetchPatchList, offered, patchBase, refFromPage, romFileName, type Patch, type PatchList } from '../../core/patches';

/** A dynasty made from the user's ROM but not saved yet (Get started's step 1), with what goes into the browser with it. */
export interface Prepared {
  dyn: Dynasty;
  rom: Uint8Array;
  pics: unknown;
  /** The ROM file's name (the version shows in it). */
  fileName: string;
}

export interface StartActions {
  /** Makes the dynasty from the ROM (throws with the reason when the ROM can't hold one). */
  prepare: (rom: { name: string; data: Uint8Array }) => Promise<Prepared>;
  /** Downloads a ROM file (the original game, patched here). */
  downloadRom: (name: string, data: Uint8Array) => void;
  /** Applies the choices, saves the dynasty and opens it. */
  finish: (p: Prepared, o: { name: string; teams: number[]; generated: boolean; coachSim: boolean; year: number }) => Promise<Dynasty>;
  /** Downloads the dynasty file (and remembers when). */
  exportFile: (d: Dynasty) => void;
}

// Steps 3-7 are SetupPage's (user, 2026-11-20): the dynasty is made after step 2.
const STEPS = SETUP_LABELS;

/** Where the backups start, by edition (also on Manage). */
export const benchSource = (id: EditionId) =>
  id === '1994' ? 'real players from the 1994 rosters (their ratings are generated)' : 'the next-best real players (CFB 27)';

/** "v2.0.1-test50" from a ROM file's name, if it has one. */
const versionOf = (fileName: string) => {
  const m = fileName.match(/v(\d+)[._](\d+)[._](\d+)(?:-test\d+)?/);
  return m ? m[0].replace(/^v(\d+)[._](\d+)[._](\d+)/, 'v$1.$2.$3') : undefined;
};

export const ORIGINAL_SHA1 = Object.keys(KNOWN).find((k) => KNOWN[k].kind === 'bw95' && !KNOWN[k].rebalanced)!;

export function GetStarted({ actions, busy }: { actions: StartActions; busy: boolean }) {
  const [step, setStep] = useState(0);
  const [prep, setPrep] = useState<Prepared | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [teams, setTeams] = useState<number[]>([]);
  const [addTeam, setAddTeam] = useState('');
  const [year, setYear] = useState('');
  const yearN = Number(year);
  const yearOk = /^\d{4}$/.test(year) && yearN >= 1950 && yearN <= 2099;
  // The original game (user, 2026-11-19: "users should be able to load either an elevated rom or the base BW95 base
  // game. If they upload the base game, they must then choose one of the two elevated patches"; mockups approved).
  const [orig, setOrig] = useState<OpenedRom | null>(null);
  const [list, setList] = useState<PatchList | null>(null);
  const [pick, setPick] = useState<EditionId>('2026');
  const [patched, setPatched] = useState<{ label: string } | null>(null);
  const [patchError, setPatchError] = useState<string | null>(null);
  const base = patchBase(refFromPage(typeof window === 'undefined' ? '' : window.location.search));
  const patchFor = (id: EditionId): Patch | undefined =>
    list ? offered(list).find((p) => p.content === PATCH_CONTENT[id] && p.fatigue === 'fixed') : undefined;
  const release = list?.releases[0].version;
  const reset = () => { setPrep(null); setOrig(null); setPatched(null); setPatchError(null); setTeams([]); setYear(''); };
  const takeRom = async (rom: { name: string; data: Uint8Array }) => {
    const p = await actions.prepare(rom);
    setPrep(p);
    setYear(String(p.dyn.startYear));
  };
  const openFile = async (f: File) => {
    const rom = await openRom(f.name, new Uint8Array(await f.arrayBuffer()));
    if (rom.sha1 !== ORIGINAL_SHA1) return takeRom(rom);
    setOrig(rom);
    setPatchError(null);
    try {
      setList(await fetchPatchList(base));
    } catch (e) {
      setPatchError(`The list of patches can't be read right now (${(e as Error).message}). Try again in a moment, or patch your ROM in the Mod Toolkit.`);
    }
  };
  const patch = async (id: EditionId) => {
    const p = patchFor(id);
    if (!orig || !p) return;
    setPatchError(null);
    try {
      const { data } = await applyListed(orig.data, p, await fetchPatchFile(base, p));
      await takeRom({ name: romFileName(p.file!), data });
      // Kept for later upgrades (upgrade.ts): a newer version is patched from it without asking for a file.
      void saveOriginal(orig.data).catch(() => undefined);
      setPatched({ label: p.name.replace(/^Bill Walsh College Football '95 /, '') });
    } catch (e) {
      setPatchError((e as Error).message);
    }
  };

  const go = (n: number) => { setStep(n); window.scrollTo(0, 0); };
  // Step 2 makes the dynasty (saved in the browser), then setup goes on with it (SetupPage).
  const create = (to: 'coaches' | 'download') => work('Creating the dynasty…', async () => {
    await actions.finish(prep!, { name, teams, generated: false, coachSim: false, year: yearN });
    window.location.hash = href(`setup/${to}`);
    window.scrollTo(0, 0);
  });
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
            Load Bill Walsh '95 Elevated (v2.1.0 or later): the {EDITIONS['2026'].name} or the {EDITIONS['1994'].name}. Or load the original game and
            the app patches it for you. The ROM stays in this browser. Nothing is uploaded.
          </p>
          {!dyn && !orig ? (
            <div className="dy-start-drop">
              <FileButton label="Choose ROM" accept=".md,.bin,.gen,.zip" disabled={off} onFile={(f) => work('Reading the ROM…', () => openFile(f))} />
              <p className="dy-small dy-dim">.md, .bin, .gen or .zip</p>
            </div>
          ) : null}
          {!dyn && !orig && (
            <p className="dy-small dy-start-alt">
              Already have a dynasty in another browser or on another computer? <Button variant="link" href={href('manage')}>Open its dynasty file in Manage</Button>.
            </p>
          )}
          {orig && !dyn && (
            <>
              <div className="dy-start-found">
                <p><strong>Bill Walsh College Football '95, the original game</strong></p>
                <p className="dy-small dy-dim">{orig.name}</p>
                <p className="dy-small">
                  A dynasty needs one of the two Elevated Season Editions. Pick one and the app patches your ROM
                  {release ? ` with the ${release} release` : ''}, in your browser.
                </p>
              </div>
              <EditionPick value={pick} onChange={setPick} />
              {patchError && <Note kind="error">{patchError}</Note>}
              <div className="dy-row dy-start-nav">
                <Button disabled={off || !patchFor(pick)} onClick={() => work('Patching your ROM…', () => patch(pick))}>Patch with the {EDITIONS[pick].name}</Button>
                <Button variant="quiet" onClick={reset}>Choose another ROM</Button>
              </div>
            </>
          )}
          {!dyn ? null : (
            <>
              {patched && (
                <>
                  <Note kind="ok"><strong>Patched:</strong> your ROM is now {patched.label} (checked against the release).</Note>
                  <p className="dy-small">No download yet: the last step gives you your first season's ROM, built on this one.</p>
                </>
              )}
              <div className="dy-start-found">
                <p><strong>{edition!.name}{versionOf(prep!.fileName) ? `, ${versionOf(prep!.fileName)}` : ''}</strong></p>
                {!patched && <p className="dy-small dy-dim">{prep!.fileName}</p>}
                <p className="dy-small">
                  {dyn.teams.length} teams, {dyn.players.length.toLocaleString('en-US')} players.{' '}
                  {edition!.id === '1994'
                    ? 'Players start from the ROM\'s rosters; each team\'s backups are real 1994 players.'
                    : 'Players start from the built-in CFB 27 rosters; redshirted players start one class up.'}
                </p>
              </div>
              <div className="dy-row">
                <Button onClick={() => go(1)}>Next: name it</Button>
                {patched
                  ? <Button variant="quiet" onClick={() => { setPrep(null); setPatched(null); setTeams([]); setYear(''); }}>Back to the editions</Button>
                  : <Button variant="quiet" onClick={reset}>Choose another ROM</Button>}
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
            <span className="dy-setup-gap" />
            <Button variant="link" disabled={!yearOk || off} onClick={() => void create('download')}>Skip to the download</Button>
            <Button disabled={!yearOk || off} onClick={() => void create('coaches')}>Next: coaches</Button>
          </div>
        </section>
      )}

    </div>
    {step === 0 && <SamplePeek />}
    </div>
  );
}

/** One edition's differences, from the release notes (user, 2026-11-19: "point out the differences: no transfer portal in
 * 94 rom, 1994 rosters to start, 107 teams vs 138, 1994 rules"). */
const EDITION_ROWS: Record<EditionId, [string, string][]> = {
  '1994': [
    ['Teams', '107: every Division I-A team of 1994'],
    ['Rosters', '1994 rosters to start, with real names for most players'],
    ['Rules', '1994 rules: the original clock, no overtime (a game can end in a tie), no two-minute timeout'],
    ['Postseason', 'The SEC Championship Game, then the 19 bowl games of 1994'],
    ['Dynasty', 'No transfer portal'],
  ],
  '2026': [
    ['Teams', '138: every FBS team of 2026'],
    ['Rosters', '2026 rosters to start, rated from College Football 27'],
    ['Rules', "Today's rules: the modern clock, the two-minute timeout and overtime"],
    ['Postseason', 'Conference title games, then a 12-team playoff (or 24 or 4 teams, a BCS title game, or none)'],
    ['Dynasty', 'With the transfer portal'],
  ],
};

/** The two editions side by side, to patch the original game with one. */
function EditionPick({ value, onChange }: { value: EditionId; onChange: (id: EditionId) => void }) {
  return (
    <fieldset className="dy-eds">
      <legend>Pick an edition</legend>
      <div className="dy-eds-grid">
        {(['1994', '2026'] as EditionId[]).map((id) => (
          <label key={id} className={`dy-ed${value === id ? ' is-on' : ''}`}>
            <span className="dy-ed-top">
              <input type="radio" name="dy-edition" checked={value === id} onChange={() => onChange(id)} />
              <strong>{EDITIONS[id].name}</strong>
            </span>
            <dl>
              {EDITION_ROWS[id].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
          </label>
        ))}
      </div>
      <p className="dy-small dy-dim">Both have every gameplay feature, the 32 historic teams for Exhibition games and alternate uniforms. You can't switch a dynasty to the other edition later.</p>
    </fieldset>
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
export function SeasonGuide({ year, first, patched, backup, setup }: {
  year: number;
  /** The first season, on the ROM from setup's last step. */
  setup?: boolean;
  /** The dynasty's first season (played on the user's own ROM). */
  first?: boolean;
  /** The file name of the ROM patched in Get started, when the user loaded the original game. */
  patched?: string;
  backup?: ReactNode;
}) {
  return (
    <ol className="dy-guide">
      <li>
        <h2>Play the {year} season{first ? ' on your ROM' : ` on the ${year} ROM`}</h2>
        <p>
          {setup ? `Play it on the ${year} ROM from the setup's last step (Manage, Season ROM, downloads it again). ` : first ? (patched ? `Play it on the patched ROM you downloaded in step 1 (${zipName(patched)}). ` : 'Play it as it is: the first season needs no download. ') : `The offseason gave you the ${year} ROM. `}
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
    <section className="dy-card-next" aria-labelledby="dy-this-h">
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
  const { d, v, downloadRom, backup, readOnly, upgradeLine } = useContext(Ctx)!;
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
  } else if ((d.seasons.length > 1 || d.seasonOneRom) && !s.romDownloaded && !s.imports.length) {
    label = `${s.year} season, ready to start`;
    title = `Download the ${s.year} ROM`;
    text = 'Load it in RetroArch and start a new season in Season mode. A save from a season started on another ROM can\'t be imported.';
    action = d.seasons.length === 1
      ? <><Button href={href('setup/download')}>Download the {s.year} ROM</Button><Button variant="quiet" href={href('setup/coaches')}>Set up the season</Button></>
      : <Button onClick={() => downloadRom(s.year)}>Download the {s.year} ROM</Button>;
  } else if (!s.imports.length) {
    label = `${s.year} season`;
    title = `Play the ${s.year} season`;
    text = `${d.seasons.length === 1 && !d.seasonOneRom ? 'Play it on your ROM as it is.' : `Play it on the ${s.year} ROM.`} After just one week, played or simmed, you can import your save to start the headlines here and the stats.`;
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
    <section className="dy-card-next" aria-labelledby="dy-next-h">
      <SubHead level={2} id="dy-next-h">What's next</SubHead>
      <div className="dy-next-body">
        <p className="dy-next-label">{label}</p>
        <h3>{title}</h3>
        <p>{text}</p>
        {more && <p>{more}</p>}
        <div className="dy-row">{action}{guide}</div>
        {upgradeLine && <p className="dy-small dy-next-upgrade">{upgradeLine} <a href={href('manage')}>Upgrade</a></p>}
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
