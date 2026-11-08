// The working ROM shared by the Season, Styles and Rosters tabs: one buffer they all edit in place,
// loaded from a file or from the Team Swap tab, downloaded from any of them with all edits in it.
import { useCallback, useMemo, useState } from 'react';
import { openRom } from '../../core/romfile';
import { detectGame, findEaChecksum, fixChecksums } from '../../core/rosterRom';
import { GAMES, type Game } from '../../core/rosterLayouts';
import { canCarry, carryEdits, editsSince, workFileName, type Edits } from '../../core/workRom';
import './workrom.css';

export interface TeamSwapSource {
  count: number;
  build: () => { name: string; data: Uint8Array };
}

export interface WorkRom {
  /** New for every ROM loaded, so the tabs know to start over. */
  id: number;
  /** File name the ROM came from (the ROM inside a zip), or the Team Swap result's name. */
  name: string;
  label: string;
  game: Game;
  /** The bytes Season, Styles and Rosters edit in place. */
  data: Uint8Array;
  /** The bytes as loaded: change marks, undo and the "unsaved changes" check compare against these. */
  base: Uint8Array;
  /** CFB-Walsh.exe turned the boot checksum check off in this ROM (the download turns it back on). */
  checkOff: boolean;
}

type Note = { kind: 'error' | 'ok'; text: string } | null;
interface Incoming {
  name: string;
  label: string;
  data: Uint8Array;
}

let nextId = 1;

function makeWork(inc: Incoming): WorkRom {
  const game = detectGame(inc.data);
  if (!game) throw new Error("Not a Bill Walsh College Football '95, College Football USA '96 or '97 ROM.");
  const c = findEaChecksum(inc.data, game);
  return {
    id: nextId++,
    name: inc.name,
    label: inc.label,
    game,
    data: new Uint8Array(inc.data),
    base: new Uint8Array(inc.data),
    checkOff: !!c && inc.data[c.bneAt] === 0x4e && inc.data[c.bneAt + 1] === 0x71,
  };
}

function download(name: string, data: BlobPart) {
  const url = URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface WorkApi {
  work: WorkRom | null;
  /** Bumps on every edit, so views that read the bytes re-render. */
  rev: number;
  /** Call after changing work.data. */
  edited: () => void;
  edits: Edits;
  /** Set by a tab whose edits can't be saved right now (e.g. a conference without a name). */
  blocker: string | null;
  setBlocker: (b: string | null) => void;
  loadFiles: (files: FileList | File[]) => Promise<void>;
  takeTeamSwap: (src: TeamSwapSource) => void;
  pending: (Incoming & { carry: boolean }) | null;
  resolve: (choice: 'keep' | 'fresh' | 'cancel') => void;
  note: Note;
  /** Saves the working ROM with fixed checksums; returns a line for the dock. */
  save: () => Note;
}

export function useWorkRom(): WorkApi {
  const [work, setWork] = useState<WorkRom | null>(null);
  const [rev, setRev] = useState(0);
  const [pending, setPending] = useState<(Incoming & { carry: boolean }) | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [blocker, setBlocker] = useState<string | null>(null);
  const edited = useCallback(() => setRev((r) => r + 1), []);

  const edits = useMemo(
    () => (work ? editsSince(work.base, work.data, work.game) : { season: false, styles: false, rosters: false, any: false }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [work, rev],
  );

  const take = (inc: Incoming, carryFrom?: WorkRom) => {
    const w = makeWork(inc);
    let msg = '';
    if (carryFrom) {
      const r = carryEdits(carryFrom.data, w.data, carryFrom.base);
      const styles = r.styles && `the style${r.styles === 1 ? '' : 's'} of ${r.styles} team${r.styles === 1 ? '' : 's'}`;
      msg = `Kept your edits: ${[r.season && 'conferences and schedules', styles, 'rosters', r.olTweak && 'the OL weight tweak'].filter(Boolean).join(', ')}.`;
      if (r.skipped.length) msg += ` Not carried: ${r.skipped.join('; ')}.`;
    }
    setWork(w);
    setBlocker(null);
    setPending(null);
    setNote(msg ? { kind: 'ok', text: msg } : null);
    setRev((x) => x + 1);
  };

  const offer = (inc: Incoming) => {
    try {
      if (work && edits.any) {
        makeWork(inc); // check it's a ROM before asking
        setPending({ ...inc, carry: canCarry(work.data, inc.data) });
        setNote(null);
      } else take(inc);
    } catch (e) {
      setNote({ kind: 'error', text: `${inc.name}: ${(e as Error).message}` });
    }
  };

  const loadFiles = async (files: FileList | File[]) => {
    const f = Array.from(files)[0];
    if (!f) return;
    try {
      const r = await openRom(f.name, new Uint8Array(await f.arrayBuffer()));
      const game = detectGame(r.data);
      offer({ name: r.name, data: r.data, label: r.known?.label ?? (game ? GAMES[game].title : r.name) });
    } catch (e) {
      setNote({ kind: 'error', text: `${f.name}: ${(e as Error).message}` });
    }
  };

  const takeTeamSwap = (src: TeamSwapSource) => {
    try {
      const { name, data } = src.build();
      offer({ name, data, label: `Team Swap result (${src.count} team${src.count === 1 ? '' : 's'} swapped)` });
    } catch (e) {
      setNote({ kind: 'error', text: (e as Error).message });
    }
  };

  const resolve = (choice: 'keep' | 'fresh' | 'cancel') => {
    if (!pending) return;
    if (choice === 'cancel') return setPending(null);
    try {
      take(pending, choice === 'keep' && work ? work : undefined);
    } catch (e) {
      setPending(null);
      setNote({ kind: 'error', text: (e as Error).message });
    }
  };

  const save = (): Note => {
    if (!work) return null;
    if (blocker) return { kind: 'error', text: blocker };
    const out = new Uint8Array(work.data);
    const res = fixChecksums(out, work.game);
    const name = workFileName(work.name, edits);
    download(name, out as Uint8Array<ArrayBuffer>);
    const parts = [edits.season && 'season', edits.styles && 'style', edits.rosters && 'roster'].filter(Boolean) as string[];
    const what = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
    return {
      kind: 'ok',
      text:
        `Saved ${name}${what ? ` with your ${what} changes` : ''}.` +
        (res.restoredCheck ? ' The boot checksum check is back on, with a correct checksum.' : ''),
    };
  };

  return { work, rev, edited, edits, blocker, setBlocker, loadFiles, takeTeamSwap, pending, resolve, note, save };
}

/** The ROM card both tabs show: the working ROM, a file chooser, the Team Swap button and the
 *  "unsaved changes" question when another ROM comes in. */
export function WorkRomCard({ api, teamSwap, hint }: { api: WorkApi; teamSwap: TeamSwapSource | null; hint: string }) {
  const { work, pending, note } = api;
  return (
    <section className="roms work-roms" aria-label="ROM file">
      <label className={`rom${work ? ' rom-ok' : ''}`}>
        <span className="rom-title">ROM</span>
        {work ? (
          <span className="rom-status">
            {work.label}
            <small>{work.name} · Season, Styles and Rosters all edit this ROM · choose another file to switch</small>
          </span>
        ) : (
          <span className="rom-status rom-empty">
            <span className="rom-choose">Choose file</span>
            <small>{hint}</small>
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
      {teamSwap && (
        <div className="work-from-swap">
          <button className="btn btn-quiet" onClick={() => api.takeTeamSwap(teamSwap)}>
            Use the Team Swap result ({teamSwap.count} team{teamSwap.count === 1 ? '' : 's'} swapped)
          </button>
          <p className="hint">Builds the ROM from the Team Swap tab and opens it here, for Season, Styles and Rosters.</p>
        </div>
      )}
      {pending && (
        <div className="work-ask" role="alertdialog" aria-labelledby="work-ask-q">
          <p id="work-ask-q">
            The ROM you're editing has season, style or roster changes. Open <b>{pending.label}</b>{' '}
            <span className="work-ask-file">({pending.name})</span>?
          </p>
          <div className="work-ask-actions">
            {pending.carry && (
              <button className="btn btn-go" onClick={() => api.resolve('keep')}>
                Keep my edits
              </button>
            )}
            <button className="btn" onClick={() => api.resolve('fresh')}>
              {pending.carry ? 'Start fresh' : 'Open it and drop my changes'}
            </button>
            <button className="btn btn-quiet" onClick={() => api.resolve('cancel')}>
              Cancel
            </button>
          </div>
          {pending.carry && (
            <p className="hint">
              Keeping them puts every team's roster, the conferences and schedules, and the styles you changed into the
              new ROM, by slot, so a swapped team gets the edits made for its slot.
            </p>
          )}
        </div>
      )}
      {note && (
        <p className={`note ${note.kind}`} role={note.kind === 'error' ? 'alert' : 'status'}>
          {note.text}
        </p>
      )}
      {work?.checkOff && (
        <p className="note ok">
          This ROM's boot checksum check was turned off (CFB-Walsh.exe does that). The download turns it back on with a
          correct checksum.
        </p>
      )}
    </section>
  );
}
