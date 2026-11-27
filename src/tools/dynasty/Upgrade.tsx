// Moving a dynasty to a newer Elevated version (core/dynasty/upgrade.ts; user, 2026-11-20, mockups approved): the
// offer after a save import (Manage), the upgrade window, Manage's Game version rows, the What's next line and the
// offseason's version choice.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Button, Check, FileButton, Modal, Note } from '../../ui';
import { readManifest } from '../../core/manifest';
import { sha1Hex } from '../../core/bytes';
import { openRom } from '../../core/romfile';
import { applyListed, EXPERIMENTAL_LIST, fetchPatchFile, fetchPatchList, offered, patchBase, PATCH_REPO_URL, refFromPage, romFileName, type PatchList } from '../../core/patches';
import { romStem } from '../../core/dynasty/offseason';
import type { Dynasty } from '../../core/dynasty/model';
import { editionOf } from '../../core/dynasty/edition';
import { refreshRomAssets } from '../../core/dynasty/assets';
import { applyUpgrade, findUpgradeAny, offerShown, PATCH_CONTENT, pendingUpgrade, seasonStarted, upgradeRomProblem, upgradeTiming, type UpgradeOffer } from '../../core/dynasty/upgrade';
import { deleteOriginal, loadOriginal, loadRom, saveOriginal, saveRom } from '../../core/dynasty/storage';
import { ORIGINAL_SHA1 } from './GetStarted';

/** What the app knows about versions for the open dynasty. */
export interface UpgradeInfo {
  /** The kept ROM's version (its manifest), when the browser has the ROM. */
  current?: string;
  /** A newer release from the Elevated release list. */
  offer: UpgradeOffer | null;
  timing: ReturnType<typeof upgradeTiming>;
  /** The original game is kept in this browser. */
  original: boolean;
  /** The release lists couldn't be read (the last check). */
  unreachable?: boolean;
}

export interface Upgrader {
  info: UpgradeInfo | null;
  /** Opens the upgrade window (to the offer's version, or with a file the user loads). */
  open: () => void;
  /** "Not now": the offer of this version isn't shown again after imports. */
  later: () => void;
  /** Reads the release lists again now (Manage → Game version, "Check for a new version"). */
  check: () => void;
  /** When the last check that the user asked for finished (null: none yet, 'checking': under way). */
  checked: Date | 'checking' | null;
  removeOriginal: () => void;
  /** The window, while open. */
  modal: ReactNode;
}

// Read once a page load (the check button reads them again).
let listOnce: Promise<PatchList | null> | null = null;
let expOnce: Promise<PatchList | null> | null = null;
const patchList = () => {
  listOnce ??= fetchPatchList(patchBase(refFromPage(window.location.search))).catch(() => { listOnce = null; return null; });
  return listOnce;
};
const experimentalList = () => {
  expOnce ??= fetchPatchList(patchBase(refFromPage(window.location.search)), EXPERIMENTAL_LIST).catch(() => { expOnce = null; return null; });
  return expOnce;
};

const releaseUrl = (version: string) => `${PATCH_REPO_URL}/releases/tag/${version}`;
/** What's new for an offer: its own notes, else the GitHub release (none for a test build without notes). */
const notesUrl = (o: UpgradeOffer): string | null => o.notes ?? (o.experimental ? null : releaseUrl(o.version));
const Notes = ({ o }: { o: UpgradeOffer }) => {
  const url = notesUrl(o);
  return url ? <a href={url} target="_blank" rel="noreferrer">release notes</a> : <>no release notes yet</>;
};

export function useUpgrade(d: Dynasty | null, commit: (next: Dynasty) => Promise<void>, downloadRom: (year: number) => void, refreshArt?: (rom: Uint8Array) => Promise<void>): Upgrader {
  const [info, setInfo] = useState<UpgradeInfo | null>(null);
  const [tick, setTick] = useState(0);
  const [isOpen, setOpen] = useState(false);
  const [stage, setStage] = useState<'get' | 'done'>('get');
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<string | null>(null);
  // The season was running in the game when the upgrade was made (the window's steps differ).
  const [midSeason, setMidSeason] = useState(false);
  const [checked, setChecked] = useState<Date | 'checking' | null>(null);
  const id = d?.id;
  const edition = d ? editionOf(d).id : '2026';
  const exp = !!d?.experimentalBuilds;

  useEffect(() => {
    if (!id) { setInfo(null); return; }
    let live = true;
    (async () => {
      const kept = await loadRom(id).catch(() => null);
      const original = !!(await loadOriginal().catch(() => null));
      const current = kept ? readManifest(kept)?.name : undefined;
      const list = kept ? await patchList() : null;
      const expList = kept && exp ? await experimentalList() : null;
      const offer = kept ? findUpgradeAny(list, expList, { sha1: await sha1Hex(kept), serial: readManifest(kept)?.serial ?? null }, edition) : null;
      if (!live) return;
      setInfo({ current, offer, original, timing: 'free', ...(kept && (!list || (exp && !expList)) ? { unreachable: true } : {}) });
      setChecked((c) => (c === 'checking' ? new Date() : c));
    })();
    return () => { live = false; };
  }, [id, edition, tick, exp]);

  const run = useCallback(async (file?: File) => {
    if (!d) return;
    setError(null);
    try {
      const kept = await loadRom(d.id);
      let next: Uint8Array;
      let nextName = '';
      let original: Uint8Array | null = null;
      if (file) {
        setWorking('Reading the ROM…');
        const rom = await openRom(file.name, new Uint8Array(await file.arrayBuffer()));
        if (rom.sha1 === ORIGINAL_SHA1) original = rom.data;
        else { next = rom.data; nextName = romStem(file.name); }
      } else {
        original = await loadOriginal();
        if (!original) throw new Error('Load the new ROM, or the original game.');
      }
      if (original) {
        setWorking('Patching…');
        const list = await patchList();
        const p = info?.offer?.patch ?? (list ? offered(list).find((x) => x.content === PATCH_CONTENT[edition] && x.fatigue === 'fixed') : undefined);
        if (!list || !p) throw new Error("The list of Elevated releases can't be read right now. Try again in a moment, or load the new Elevated ROM itself.");
        next = (await applyListed(original, p, await fetchPatchFile(patchBase(refFromPage(window.location.search)), p))).data;
        nextName = romStem(romFileName(p.file!));
      }
      setWorking('Building your ROM…');
      const problem = upgradeRomProblem(d, kept, next!);
      if (problem) throw new Error(problem);
      await saveRom(d.id, next!);
      if (original && file) await saveOriginal(original);
      setMidSeason(seasonStarted(d));
      // The new version's logos, helmets, colors and uniforms (assets.ts; the user's uniform changes stay on top).
      // Season ROM names follow the new version from the next season's first download (romFile, offseason.ts).
      await commit({ ...refreshRomAssets(applyUpgrade(d, kept, next!), next!), ...(nextName ? { romFile: nextName } : {}) });
      await refreshArt?.(next!);
      setMade(readManifest(next!)?.name ?? 'the new version');
      setStage('done');
      setTick((t) => t + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(null);
    }
  }, [d, info, edition, commit, refreshArt]);

  const timing = d ? upgradeTiming(d, info?.offer?.build) : 'free';
  const full = info ? { ...info, timing } : null;
  const close = () => { setOpen(false); setStage('get'); setError(null); setMade(null); };

  let modal: ReactNode = null;
  if (isOpen && d && full) {
    const s = d.seasons[d.seasons.length - 1];
    const to = full.offer?.version;
    const auto = !!(full.original && full.offer);
    const title = to ? `Upgrade to ${full.offer!.experimental ? 'test build ' : ''}${to}` : 'Upgrade to a newer version';
    const getStep = (
      <li>
        {auto
          ? <><strong>Patch {to}</strong> from your original Bill Walsh '95, kept in this browser.</>
          : <><strong>Load the new ROM.</strong> The {editionOf(d).name} {to ?? '(a newer version)'}, or the original Bill Walsh College Football '95: the app patches it{full.offer ? '' : ' with the current release'}. From then on the app keeps the original game, so the next upgrade needs no file.</>}
      </li>
    );
    if (stage === 'get') {
      modal = (
        <Modal
          title={title}
          onClose={working ? undefined : close}
          actions={<>
            {auto
              ? <Button disabled={!!working} onClick={() => void run()}>Upgrade to {to}</Button>
              : <FileButton label="Choose a file" accept=".md,.bin,.gen,.zip" disabled={!!working} onFile={(f) => void run(f)} />}
            <Button variant="quiet" disabled={!!working} onClick={close}>Cancel: stay on {full.current ?? 'this version'}</Button>
          </>}
        >
          {working && <Note>{working}</Note>}
          {error && <Note kind="error">{error}</Note>}
          <ol className="dy-steps">
            {getStep}
            <li><strong>Build your {d.offseason ? 'dynasty' : s.year} ROM on it.</strong> Your rosters, schedule, conferences, impact players and uniforms stay as they are.</li>
            {!d.offseason && (seasonStarted(d)
              ? <>
                <li><strong>Download it and replace the old file</strong>, with {s.index === 0 ? 'the file name of the ROM you play on' : 'the same name'}, so the game finds your save.</li>
                <li><strong>Keep playing.</strong> The upgrade is done when you import a save from the new ROM.</li>
              </>
              : <li><strong>Download it and start the New Season with it.</strong></li>)}
          </ol>
        </Modal>
      );
    } else {
      const first = s.index === 0;
      modal = (
        <Modal
          title={`Upgraded to ${made}`}
          onClose={close}
          actions={d.offseason
            ? <Button onClick={close}>OK</Button>
            : <>
              <Button onClick={() => { downloadRom(s.year); close(); }}>Download the {s.year} ROM</Button>
              <Button variant="quiet" onClick={close}>Later</Button>
            </>}
        >
          {d.offseason
            ? <p>Your dynasty now plays on {made}. The offseason's last step builds the {d.offseason.year + 1} ROM on it.</p>
            : !midSeason
              ? <p>Your dynasty now plays on {made}. Download the {s.year} ROM and start a <strong>New Season</strong> with it in the game.</p>
              : <>
              <p>Your dynasty now plays on {made}. Your save, players and stats stay as they are.</p>
              <ol className="dy-steps">
                <li>Download the {s.year} ROM.</li>
                <li>{first
                  ? <>Put it in place of the ROM you play the {s.year} season on and give it <strong>that ROM's file name</strong>, so the game finds your save.</>
                  : <>Put it in place of the one you have, with <strong>the same file name</strong> (if your browser saved it as "… (1).zip", rename it), so the game finds your save.</>}</li>
                <li>Load your save with it and keep playing{s.imports.length || first ? '' : ' (or start the New Season with it)'}. Your next import confirms the upgrade.</li>
              </ol>
            </>}
        </Modal>
      );
    }
  }

  return {
    info: full,
    open: () => { setStage('get'); setError(null); setOpen(true); },
    later: () => { if (d && full?.offer) void commit({ ...d, upgradeLater: full.offer.version }); },
    check: () => { listOnce = null; expOnce = null; setChecked('checking'); setTick((t) => t + 1); },
    checked,
    removeOriginal: () => { void deleteOriginal().then(() => setTick((t) => t + 1)); },
    modal,
  };
}

/** The offer on Manage (mockups 1 and 3): a newer release, not taken, not put off. */
export function UpgradeCard({ d, up }: { d: Dynasty; up: Upgrader }) {
  const i = up.info;
  if (!i?.offer || !offerShown(i.offer, i.timing) || d.upgradeLater === i.offer.version || pendingUpgrade(d)) return null;
  const { version } = i.offer;
  const test = !!i.offer.experimental;
  const s = d.seasons[d.seasons.length - 1];
  const notes = <Notes o={i.offer} />;
  return (
    <section className="dy-upgrade" aria-labelledby="dy-upgrade-h">
      <p className="dy-upgrade-bar"><span>{test ? 'Test build' : 'New version'}</span><span>Elevated {version}</span></p>
      <div className="dy-upgrade-body">
        <h2 id="dy-upgrade-h">Elevated {version} is out</h2>
        {test && <p className="dy-small">A release candidate or test build, offered because experimental build prompts are on (Manage, This season, Game version). Download your dynasty file first, to go back if something's wrong.</p>}
        {i.timing === 'later' ? (
          <>
            <p className="dy-upgrade-safe is-wait"><strong>Not mid-season.</strong> {version} can't continue a season started on {i.current ?? 'your version'}. Finish the {s.year} season: the offseason's last step builds the {s.year + 1} ROM on {version}. What's new: {notes}.</p>
            <div className="dy-row"><Button variant="quiet" onClick={up.later}>OK</Button></div>
          </>
        ) : (
          <>
            <p>Your dynasty plays on {i.current ?? 'an earlier version'}. What's new: {notes}.</p>
            <p className="dy-upgrade-safe">
              {i.timing === 'safe' && <><strong>Safe to switch mid-season.</strong> Your {s.year} season started on {i.current ?? 'an earlier version'}, and {version} can continue it. </>}
              {i.timing === 'free' && <><strong>Safe to switch now:</strong> no season is running in the game. </>}
              {i.timing === 'unknown' && <><strong>The app checks</strong> that {version} can continue your {s.year} season before it builds anything. </>}
              Your save, players and stats stay as they are.
            </p>
            <div className="dy-row">
              <Button onClick={up.open}>Upgrade to {version}</Button>
              <Button variant="quiet" onClick={up.later}>Not now</Button>
            </div>
            <p className="dy-small dy-dim">The app builds your ROM on {version}; you download it and replace the old file.</p>
          </>
        )}
      </div>
    </section>
  );
}

/** Manage, This season: the game version, the kept original game and an upgrade waiting for its save (mockup 5). */
export function VersionRows({ d, up, busy, commit }: { d: Dynasty; up: Upgrader; busy: boolean; commit: (next: Dynasty) => Promise<void> }) {
  const i = up.info;
  const pend = pendingUpgrade(d);
  const s = d.seasons[d.seasons.length - 1];
  return (
    <>
      <h3>Game version</h3>
      <p>
        {i?.current ? <>Your dynasty plays on Elevated <strong>{i.current}</strong>.</> : <>Load your ROM to see its version.</>}
        {i?.offer && !pend && <> {i.offer.experimental ? 'Test build ' : ''}{i.offer.version} is out (<Notes o={i.offer} />).</>}
        {i?.offer && !pend && !offerShown(i.offer, i.timing) && <> It can't continue the {s.year} season you're playing: the offseason's last step offers it.</>}
      </p>
      {pend && <Note>Upgraded from {pend.from.name} to {pend.to.name}. {pend.downloaded ? 'Play on the new ROM' : `Download the ${s.year} ROM below, put it in place of the old file and keep playing`}: the upgrade is done when you import a save from it.</Note>}
      <div className="dy-row">
        {i?.offer && i.timing !== 'later' && offerShown(i.offer, i.timing) && !pend && <Button disabled={busy} onClick={up.open}>Upgrade to {i.offer.version}</Button>}
        <Button variant="quiet" disabled={busy || up.checked === 'checking'} onClick={up.check}>{up.checked === 'checking' ? 'Checking…' : 'Check for a new version'}</Button>
        <Button variant="quiet" disabled={busy} onClick={up.open}>Upgrade from a file</Button>
      </div>
      {up.checked instanceof Date && i && (
        <p className="dy-small" role="status">
          {i.unreachable ? "The list of Elevated versions can't be read right now. Try again in a moment." : i.offer ? `Found ${i.offer.experimental ? 'test build ' : ''}${i.offer.version}.` : `You're on the newest ${d.experimentalBuilds ? 'build' : 'version'}.`}
          {' '}Checked {up.checked.toLocaleTimeString('en-US', { timeStyle: 'short' })}.
        </p>
      )}
      <p className="dy-small dy-dim">
        {i?.original
          ? <>The original game is kept in this browser (about 2 MB), so a new version is patched without a file. <Button variant="link" onClick={up.removeOriginal}>Remove it</Button></>
          : <>An upgrade asks for the new ROM or the original game once; the app then keeps the original game for the next one.</>}
      </p>
      {/* Release candidates and test builds in the upgrade prompts (user, 2026-11-27): last in Game version, beside the
          check it changes; turning it on checks right away. */}
      <div className="dy-setup-switch">
        <Check checked={!!d.experimentalBuilds} disabled={busy} onChange={(on) => { void commit({ ...d, experimentalBuilds: on || undefined }).then(up.check); }}><strong>Enable experimental build upgrade prompts</strong></Check>
        <p className="dy-small">Also offers release candidates and test builds of Elevated (such as v2.2.0-rc.5) when they come out, here, in What's next and at the offseason's last step. Mid-season only when the build can continue the season you're playing. Test builds aren't finished: download your dynasty file before you switch, to go back if something's wrong.</p>
      </div>
    </>
  );
}

/** One line for the What's next card while an upgrade is offered and can be taken now. */
export function upgradeLine(d: Dynasty, i: UpgradeInfo | null): string | null {
  if (!i?.offer || pendingUpgrade(d) || i.timing === 'later' || !offerShown(i.offer, i.timing)) return null;
  const what = `${i.offer.experimental ? 'Test build' : 'Elevated'} ${i.offer.version}`;
  return i.timing === 'safe' ? `${what} is out and safe to switch to mid-season.` : `${what} is out.`;
}

/** The offseason's last step (mockup 4): the newest version (picked) or the one played on. */
export function VersionPick({ d, up, value, onChange }: { d: Dynasty; up: Upgrader; value: 'new' | 'same'; onChange: (v: 'new' | 'same') => void }) {
  const i = up.info;
  if (!i?.offer || pendingUpgrade(d)) return null;
  const v = i.offer.version;
  return (
    <fieldset className="dy-eds">
      <legend>Game version</legend>
      <div className="dy-eds-grid">
        <label className={`dy-ed${value === 'new' ? ' is-on' : ''}`}>
          <span className="dy-ed-top">
            <input type="radio" name="dy-version" checked={value === 'new'} onChange={() => onChange('new')} />
            <strong>Elevated {v}</strong> <span className="dy-upgrade-tag">{i.offer.experimental ? 'Test build' : 'New'}</span>
          </span>
          <p className="dy-ed-text">{i.offer.experimental ? 'A release candidate or test build' : 'The current release'}: <Notes o={i.offer} />. A new season starts on a new ROM anyway, so switching here is always safe.</p>
        </label>
        <label className={`dy-ed${value === 'same' ? ' is-on' : ''}`}>
          <span className="dy-ed-top">
            <input type="radio" name="dy-version" checked={value === 'same'} onChange={() => onChange('same')} />
            <strong>Elevated {i.current ?? 'as now'}</strong>
          </span>
          <p className="dy-ed-text">The version you played {d.seasons[d.seasons.length - 2]?.year ?? 'last season'} on.</p>
        </label>
      </div>
    </fieldset>
  );
}
