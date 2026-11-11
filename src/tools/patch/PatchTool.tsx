// The Patch tab, the first step: load a BW95 ROM; if it's the original game, add one of the mod's
// released patches (read from the Elevated repo's patches.json) or a .bps file; then take the ROM on
// to Team Swap, or to Season, Teams and Rosters.
import { useEffect, useMemo, useState } from 'react';
import { applyBps, BpsError } from '../../core/bps';
import { sha1Hex } from '../../core/bytes';
import { hasSwappedTeams, swapProblemText } from '../../core/build';
import {
  applyListed,
  fetchPatchFile,
  fetchPatchList,
  findRelease,
  offered,
  patchBase,
  PATCH_REPO_URL,
  refFromPage,
  romFileName,
  type Patch,
  type PatchList,
} from '../../core/patches';
import { describeUnknown, identifyRom, KNOWN, openRom, WIDE_ROM_TEXT, WIDE_TABS_TEXT, type OpenedRom } from '../../core/romfile';
import './patch.css';

type Note = { kind: 'error' | 'ok'; text: string } | null;
type ListState = { state: 'loading' } | { state: 'ok'; list: PatchList } | { state: 'error'; text: string };

const STOCK_SHA1 = Object.keys(KNOWN).find((k) => KNOWN[k].kind === 'bw95' && !KNOWN[k].rebalanced)!;

function download(name: string, data: Uint8Array) {
  const url = URL.createObjectURL(new Blob([data as Uint8Array<ArrayBuffer>], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The ROM with its label from the patch list, when the list knows it. */
function withLabel(r: OpenedRom, list: PatchList | null): OpenedRom {
  const hit = list && findRelease(list, r.sha1);
  return hit && r.known ? { ...r, known: { ...r.known, label: hit.patch.name } } : r;
}

export interface PatchApi {
  list: ListState;
  /** The original game, when that's what was loaded (patches apply to it). */
  original: OpenedRom | null;
  /** The ROM the next steps use: the one loaded, or the patched one. */
  rom: OpenedRom | null;
  /** What was applied in this tab: a listed patch (its name), or a .bps file not on the list. */
  applied: { name: string; fromFile: boolean } | null;
  busy: boolean;
  note: Note;
  /** A BW95 ROM opened elsewhere (a file dropped on the Team Swap tab). */
  open: (r: OpenedRom) => void;
  loadFiles: (files: FileList | File[]) => Promise<void>;
  apply: (p: Patch) => Promise<void>;
  undo: () => void;
}

export function usePatchRom(): PatchApi {
  const [list, setList] = useState<ListState>({ state: 'loading' });
  const [original, setOriginal] = useState<OpenedRom | null>(null);
  const [loaded, setLoaded] = useState<OpenedRom | null>(null);
  const [applied, setApplied] = useState<PatchApi['applied']>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const base = useMemo(() => patchBase(refFromPage(window.location.search)), []);

  useEffect(() => {
    let live = true;
    fetchPatchList(base).then(
      (l) => live && setList({ state: 'ok', list: l }),
      (e: Error) => live && setList({ state: 'error', text: e.message }),
    );
    return () => {
      live = false;
    };
  }, [base]);

  const okList = list.state === 'ok' ? list.list : null;
  const rom = useMemo(() => loaded && withLabel(loaded, okList), [loaded, okList]);
  const origSha1 = okList?.original.sha1 ?? STOCK_SHA1;

  const open = (r: OpenedRom) => {
    if (r.known?.kind !== 'bw95') {
      setNote({
        kind: 'error',
        text: `${r.name}: ${r.known?.kind === 'cf97' ? "That's College Football USA 97: load it in the Team Swap tab." : describeUnknown(r)}`,
      });
      return;
    }
    setOriginal(r.sha1 === origSha1 ? r : null);
    setLoaded(r);
    setApplied(null);
    setNote(null);
  };

  const applyFile = async (f: File) => {
    if (!original) {
      setNote({ kind: 'error', text: `${f.name}: load the original ROM first. Patches go onto the original game.` });
      return;
    }
    try {
      const data = applyBps(original.data, new Uint8Array(await f.arrayBuffer()));
      const sha1 = await sha1Hex(data);
      const known = identifyRom(data, sha1);
      const hit = okList && findRelease(okList, sha1);
      const label = hit?.patch.name ?? `Patched with ${f.name}`;
      setLoaded({ name: romFileName(f.name), data, sha1, known: known && { ...known, label } });
      setApplied(hit ? { name: hit.patch.name, fromFile: false } : { name: f.name, fromFile: true });
      setNote(null);
    } catch (e) {
      const why = e instanceof BpsError && e.reason === 'source' ? "This patch wasn't made for the original USA ROM." : (e as Error).message;
      setNote({ kind: 'error', text: `${f.name}: ${why}` });
    }
  };

  const loadFiles = async (files: FileList | File[]) => {
    const all = Array.from(files);
    // ROMs first, so a ROM and a .bps dropped together work.
    for (const f of all.filter((x) => !/\.bps$/i.test(x.name))) {
      try {
        open(await openRom(f.name, new Uint8Array(await f.arrayBuffer())));
      } catch (e) {
        setNote({ kind: 'error', text: `${f.name}: ${(e as Error).message}` });
      }
    }
    for (const f of all.filter((x) => /\.bps$/i.test(x.name))) await applyFile(f);
  };

  const apply = async (p: Patch) => {
    if (!original || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const file = await fetchPatchFile(base, p);
      const { data, sha1 } = await applyListed(original.data, p, file);
      const known = identifyRom(data, sha1);
      setLoaded({ name: romFileName(p.file!), data, sha1, known: known && { ...known, label: p.name } });
      setApplied({ name: p.name, fromFile: false });
    } catch (e) {
      setNote({ kind: 'error', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const undo = () => {
    if (!original) return;
    setLoaded(original);
    setApplied(null);
    setNote(null);
  };

  return { list, original, rom, applied, busy, note, open, loadFiles, apply, undo };
}

export function PatchTool({
  api,
  inWork,
  onSwap,
  onEdit,
}: {
  api: PatchApi;
  /** Season, Teams and Rosters have this ROM open (they take it on their own unless they had other changes). */
  inWork: boolean;
  onSwap: () => void;
  onEdit: () => void;
}) {
  const { list, original, rom, applied, busy, note } = api;
  const okList = list.state === 'ok' ? list.list : null;
  const patches = okList ? offered(okList) : [];
  const release = okList?.releases[0];
  const contents = okList?.contents.filter((c) => patches.some((p) => p.content === c.id)) ?? [];
  const [content, setContent] = useState<string | null>(null);
  const [fatigue, setFatigue] = useState<string | null>(null);
  const pickContent = contents.find((c) => c.id === content)?.id ?? contents[0]?.id;
  const fatigues = okList?.fatigue.filter((f) => patches.some((p) => p.content === pickContent && p.fatigue === f.id)) ?? [];
  const pickFatigue = fatigues.find((f) => f.id === fatigue)?.id ?? fatigues[0]?.id;
  const chosen = patches.find((p) => p.content === pickContent && p.fatigue === pickFatigue);
  const isPatched = !!original && !!rom && rom !== original;
  const hit = okList && rom && !original ? findRelease(okList, rom.sha1) : null;

  return (
    <>
      <section className="tool-head" aria-label="Patch">
        <h2>Patch</h2>
        <p>
          Start here. Load your Bill Walsh College Football '95 ROM. If it's the original game, add one of the mod's
          patches below. Then take the ROM on to Team Swap, Season, Teams and Rosters.
        </p>
      </section>

      <section className="roms pat-roms" aria-label="ROM file">
        <label className={`rom${rom ? ' rom-ok' : ''}`}>
          <span className="rom-title">Bill Walsh College Football '95</span>
          {rom ? (
            <span className="rom-status">
              {rom.known?.label}
              <small>{rom.name} · choose another file to switch</small>
            </span>
          ) : (
            <span className="rom-status rom-empty">
              <span className="rom-choose">Choose file</span>
              <small>The original USA ROM, or one you've already patched. .md, .bin, .gen or .zip.</small>
            </span>
          )}
          <input
            type="file"
            accept=".md,.bin,.gen,.zip"
            hidden
            onChange={(e) => {
              if (e.target.files) void api.loadFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
        {note && (
          <p className={`note ${note.kind}`} role={note.kind === 'error' ? 'alert' : 'status'}>
            {note.text}
          </p>
        )}
      </section>

      {!rom && (
        <section className="waiting">
          <p>Load the ROM to see the patches. You can drop the file anywhere on this page.</p>
        </section>
      )}

      {original && (
        <section className="pat-add" aria-labelledby="pat-add-h">
          <div className="pat-head">
            <h3 id="pat-add-h">Add a patch</h3>
            {release && (
              <p>
                Latest release: <b>{release.name}</b>
                {release.date ? ` (${release.date})` : ''} from the{' '}
                <a href={PATCH_REPO_URL} target="_blank" rel="noreferrer">
                  mod's GitHub page
                </a>
              </p>
            )}
          </div>

          {list.state === 'loading' && <p className="hint">Loading the patch list…</p>}
          {list.state === 'error' && (
            <p className="note error" role="alert">
              Couldn't load the patch list from GitHub ({list.text}). You can still add a .bps file you've downloaded
              from the{' '}
              <a href={PATCH_REPO_URL} target="_blank" rel="noreferrer">
                mod's GitHub page
              </a>
              , or use the original game as it is.
            </p>
          )}

          {chosen && (
            <div className="pat-choices">
              {contents.length > 1 && (
                <Choices
                  legend="What to add"
                  name="pat-content"
                  items={contents}
                  value={pickContent}
                  onPick={(id) => setContent(id)}
                />
              )}
              {fatigues.length > 1 && (
                <Choices legend="Fatigue" name="pat-fatigue" items={fatigues} value={pickFatigue} onPick={(id) => setFatigue(id)} />
              )}
            </div>
          )}

          <div className="pat-actions">
            {chosen && (
              <button
                className="btn btn-go"
                onClick={() => void api.apply(chosen)}
                disabled={busy || applied?.name === chosen.name}
              >
                {busy ? 'Patching…' : applied?.name === chosen.name ? 'Patched' : 'Apply patch'}
              </button>
            )}
            <label className="btn btn-quiet">
              Use a .bps file
              <input
                type="file"
                accept=".bps"
                hidden
                onChange={(e) => {
                  if (e.target.files) void api.loadFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          {isPatched && rom && applied && (
            <div className="pat-done" role="status">
              <p>
                {applied.fromFile ? 'Patched with ' : 'Patched: '}
                <b>{applied.name}</b>
              </p>
              <p className="hint">
                {rom.known?.wide
                  ? `It already has all 138 FBS teams with 2026 rosters and Walsh Reports. ${WIDE_TABS_TEXT}`
                  : inWork
                  ? 'The other tabs now use this patched ROM, so you can go straight to any of them.'
                  : 'Team Swap now uses this patched ROM. Season, Teams and Rosters have changes in another ROM, so they ask before opening it.'}
              </p>
              <div className="pat-done-actions">
                <button className="btn" onClick={() => download(rom.name, rom.data)}>
                  Download patched ROM
                </button>
                <button className="btn btn-quiet" onClick={api.undo}>
                  Back to the original game
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {rom && !original && (
        <section className="pat-add" aria-label="About this ROM">
          {hit ? (
            hit.current ? (
              <p>This ROM already has the latest release, {hit.release.name}.</p>
            ) : (
              <p>
                This ROM has {hit.release.name}. A newer release is out: <b>{okList!.releases[0].name}</b>. To update,
                load the original ROM and patch it here.
              </p>
            )
          ) : (
            <p>
              This ROM is already {rom.known?.modded ? 'modded or edited' : 'patched'}, so it's used as it is (patches go
              onto the original game only).
            </p>
          )}
        </section>
      )}

      {rom && <NextSteps rom={rom} inWork={inWork} onSwap={onSwap} onEdit={onEdit} />}
    </>
  );
}

function Choices({
  legend,
  name,
  items,
  value,
  onPick,
}: {
  legend: string;
  name: string;
  items: { id: string; label: string; about?: string }[];
  value: string | undefined;
  onPick: (id: string) => void;
}) {
  return (
    <fieldset className="pat-group">
      <legend>{legend}</legend>
      {items.map((it) => (
        <label key={it.id} className={`pat-opt${it.id === value ? ' pat-on' : ''}`}>
          <input type="radio" name={name} checked={it.id === value} onChange={() => onPick(it.id)} />
          <span className="pat-label">{it.label}</span>
          {it.about && <span className="pat-about">{it.about}</span>}
        </label>
      ))}
    </fieldset>
  );
}

function NextSteps({
  rom,
  inWork,
  onSwap,
  onEdit,
}: {
  rom: OpenedRom;
  inWork: boolean;
  onSwap: () => void;
  onEdit: () => void;
}) {
  if (rom.known?.wide) {
    return (
      <section className="pat-next" aria-labelledby="pat-next-h">
        <h3 id="pat-next-h">Next</h3>
        <ul>
          <li className="pat-step">
            <button className="btn" onClick={onEdit}>
              Edit season, teams and rosters
            </button>
            <p className="hint">{WIDE_TABS_TEXT}</p>
          </li>
          <li className="pat-step">
            <p className="hint">{WIDE_ROM_TEXT}</p>
          </li>
        </ul>
      </section>
    );
  }
  const problem = swapProblemText(rom.data);
  const again = !problem && hasSwappedTeams(rom.data); // swapped by Team Swap before, which can swap it again
  return (
    <section className="pat-next" aria-labelledby="pat-next-h">
      <h3 id="pat-next-h">Next</h3>
      <ul>
        {problem ? (
          <li className="pat-step">
            <p className="hint">{problem}</p>
          </li>
        ) : (
          <li className="pat-step">
            <button className="btn" onClick={onSwap}>
              Swap teams
            </button>
            <p className="hint">
              {again
                ? "Some of this ROM's teams are already swapped in. Replace any team, those too, with one from College Football USA 97. You'll load that ROM in the Team Swap tab."
                : "Replace teams with ones from College Football USA 97. You'll load that ROM in the Team Swap tab."}
            </p>
          </li>
        )}
        <li className="pat-step">
          <button className="btn" onClick={onEdit}>
            Edit season, teams and rosters
          </button>
          <p className="hint">
            {inWork ? 'This ROM is already open in the Season, Teams and Rosters tabs.' : 'Opens this ROM in the Season, Teams and Rosters tabs.'}
            {!problem && ' If you also swap teams, do that first: those tabs can take the Team Swap result.'}
          </p>
        </li>
      </ul>
    </section>
  );
}
