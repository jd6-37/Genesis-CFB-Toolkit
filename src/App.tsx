import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BwTeam, parseBw95 } from './core/bw95';
import { CfTeam, parseCf97 } from './core/cf97';
import { buildRom, defaultSlot, isSwapFile, SlotConfig, swapFile, swappedSlots, swapProblemText, validateSlot } from './core/build';
import { MAX_LEN } from './core/defaults';
import { renderSprites } from './core/render';
import { describeUnknown, OpenedRom, openRom } from './core/romfile';
import { CelebBlob, defaultCelebration, genericCelebration, PREVIEW_FRAME } from './core/celebration';
import { SpriteCanvas, Swatch, UniformEditor } from './components';
import { RosterTool } from './tools/rosters/RosterTool';
import { SeasonTool } from './tools/season/SeasonTool';
import { useWorkRom, type TeamSwapSource } from './tools/shared/WorkRom';
import { TeamsTool } from './tools/styles/TeamsTool';
import { RatingPicks } from './tools/styles/RatingPicks';
import { ovrFromSim, ratingProblems, readRating, readWeather, weatherFromWord, type TeamRating, type Weather } from './core/teamRatings';
import { StylePicks } from './tools/styles/StylePicks';
import { PatchTool, usePatchRom } from './tools/patch/PatchTool';
import { DEFENSE, OFFENSE, parseStyle, readStyles, styleInfo, styleProblems, type StyleInfo, type TeamStyle } from './core/styles';
import { renameInText } from './core/walsh';
import { REPORT_LIMIT, readReports, reportLength, reportProblems, showReport, type Report } from './core/walshReports';
import { WalshField } from './tools/walsh/WalshEditor';

interface BwState {
  rom: OpenedRom;
  teams: BwTeam[];
}
interface CfState {
  rom: OpenedRom;
  teams: CfTeam[];
}
type Note = { kind: 'error' | 'ok'; text: string } | null;

const EMPTY: (SlotConfig | null)[] = Array(36).fill(null);

type Tab = 'patch' | 'swap' | 'season' | 'teams' | 'rosters';
const TABS: { id: Tab; label: string }[] = [
  { id: 'patch', label: 'Patch' },
  { id: 'swap', label: 'Team Swap' },
  { id: 'season', label: 'Season' },
  { id: 'teams', label: 'Teams' },
  { id: 'rosters', label: 'Rosters' },
];
// #styles is the Teams tab's address from before it took ratings and weather too.
const tabFromHash = (): Tab =>
  window.location.hash === '#styles' ? 'teams' : (TABS.find((t) => `#${t.id}` === window.location.hash)?.id ?? 'patch');

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function outName(rom: OpenedRom): string {
  if (rom.known?.modded) return `${rom.name.replace(/\.(md|bin|gen)$/i, '').replace(/ \[Team Swap\]/g, '')} [Team Swap].md`;
  const r = rom.known?.rebalanced;
  const base = r
    ? `Bill Walsh College Football 95 Rebalanced v1.0 [${r === 'fixed' ? 'Fixed' : 'No'} Fatigue]`
    : 'Bill Walsh College Football 95 (USA)';
  return `${base} [Team Swap].md`;
}

function sameBytes(a: Uint8Array | undefined, b: Uint8Array): boolean {
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export default function App() {
  const [bw, setBw] = useState<BwState | null>(null);
  const [cf, setCf] = useState<CfState | null>(null);
  const [slots, setSlots] = useState<(SlotConfig | null)[]>(EMPTY);
  const [open, setOpen] = useState<number | null>(null);
  const [romNote, setRomNote] = useState<Note>(null);
  const [note, setNote] = useState<Note>(null);
  const [dragging, setDragging] = useState(false);
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const work = useWorkRom(); // the ROM the Season, Teams and Rosters tabs edit together
  const start = usePatchRom(); // the BW95 ROM from the Patch tab, which Team Swap builds on
  const seasonDrop = useRef<((files: FileList | File[]) => void) | null>(null);
  const registerSeasonDrop = useCallback((fn: ((files: FileList | File[]) => void) | null) => {
    seasonDrop.current = fn;
  }, []);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const pickTab = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, '', t === 'patch' ? window.location.pathname + window.location.search : `#${t}`);
  };

  // Team Swap uses the Patch tab's ROM (loaded there or here, patched or not).
  const startRom = start.rom;
  useEffect(() => {
    if (!startRom) return;
    setRomNote(null);
    const problem = swapProblemText(startRom.data);
    if (problem) {
      setBw(null);
      setRomNote({ kind: 'error', text: `${startRom.name}: ${problem}` });
      return;
    }
    const teams = parseBw95(startRom.data);
    if (!bw || bw.teams.some((t, i) => t.school !== teams[i]?.school)) {
      setSlots(EMPTY);
      setOpen(null);
    }
    setBw({ rom: startRom, teams });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startRom]);

  // Season, Teams and Rosters open the Patch tab's ROM too, as soon as it's loaded or patched. If they
  // already have changes in another ROM, the usual "keep my edits?" question comes up there instead.
  useEffect(() => {
    if (!startRom || sameBytes(work.work?.base, startRom.data)) return;
    work.takeRom({ name: startRom.name, label: startRom.known?.label ?? startRom.name, data: startRom.data });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startRom]);

  const workHasStart = useMemo(() => !!startRom && sameBytes(work.work?.base, startRom.data), [work.work, startRom]);

  const onFiles = async (files: FileList | File[]) => {
    setRomNote(null);
    for (const f of Array.from(files)) {
      try {
        const r = await openRom(f.name, new Uint8Array(await f.arrayBuffer()));
        if (r.known?.kind === 'bw95') {
          start.open(r); // shared with the Patch tab; the effect above takes it from there
        } else if (r.known?.kind === 'cf97') {
          setCf({ rom: r, teams: parseCf97(r.data) });
          setSlots(EMPTY);
          setOpen(null);
        } else {
          setRomNote({ kind: 'error', text: `${f.name}: ${describeUnknown(r)}` });
        }
      } catch (e) {
        setRomNote({ kind: 'error', text: `${f.name}: ${(e as Error).message}` });
      }
    }
  };

  const ready = !!bw && !!cf;
  const celeb = useMemo(() => (bw ? genericCelebration(bw.rom.data) : null), [bw]);
  const swappedBefore = useMemo(() => (bw ? swappedSlots(bw.rom.data) : []), [bw]);
  const teamStyles = useMemo(
    () => (bw && !styleProblems(bw.rom.data).length ? { info: styleInfo(bw.rom.data), styles: readStyles(bw.rom.data) } : null),
    [bw],
  );
  const teamRatings = useMemo(
    () =>
      bw && !ratingProblems(bw.rom.data).length
        ? bw.teams.map((t) => ({ rating: readRating(bw.rom.data, t.index), weather: readWeather(bw.rom.data, t.index) }))
        : null,
    [bw],
  );
  const swapped = slots.filter(Boolean) as SlotConfig[];
  const baseReports = useMemo(() => (bw ? readReports(bw.rom.data) : []), [bw]);
  /** A swapped slot's report with its new names (the build's text when it isn't edited). */
  const renamedReport = (sc: SlotConfig): Report => {
    const t = bw!.teams[sc.slot];
    const ch = { slot: sc.slot, oldSchool: t.school, oldNickname: t.nickname, newSchool: sc.school, newNickname: sc.nickname };
    const r = baseReports[sc.slot];
    return { offense: renameInText(r.offense, ch), defense: renameInText(r.defense, ch) };
  };
  const buildReport = (s: number): Report => {
    const sc = slots[s];
    if (!sc) return baseReports[s];
    return sc.walsh ? { offense: sc.walsh[0], defense: sc.walsh[1] } : renamedReport(sc);
  };
  /** Reports the build will trim when a first report is edited (none once one is). */
  const trimsFor = (slot: number) =>
    !bw || swapped.some((s) => s.walsh)
      ? []
      : bw.teams.flatMap((t) => (t.index !== slot && reportLength(buildReport(t.index)) > REPORT_LIMIT ? [slots[t.index]?.school ?? t.school] : []));
  const problems = useMemo(
    () => swapped.flatMap((s) => validateSlot(s).map((p) => `${bw?.teams[s.slot].school} → ${s.school || '(no name)'}: ${p}`)),
    [swapped, bw],
  );

  const setSlot = (i: number, s: SlotConfig | null) => setSlots((prev) => prev.map((p, k) => (k === i ? s : p)));

  const doBuild = () => {
    if (!bw || !cf) return;
    try {
      const res = buildRom(bw.rom.data, bw.teams, cf.teams, swapped);
      download(outName(bw.rom), res.rom as Uint8Array<ArrayBuffer>, 'application/octet-stream');
      setNote({ kind: 'ok', text: `Built a ROM with ${swapped.length} team${swapped.length === 1 ? '' : 's'} swapped.` });
    } catch (e) {
      setNote({ kind: 'error', text: (e as Error).message });
    }
  };

  const teamSwap: TeamSwapSource | null =
    bw && cf && swapped.length && !problems.length
      ? {
          count: swapped.length,
          build: () => ({ name: outName(bw.rom), data: buildRom(bw.rom.data, bw.teams, cf.teams, swapped).rom }),
        }
      : null;

  const saveSwaps = () => {
    download('bw95-team-swap.json', JSON.stringify(swapFile(swapped), null, 2), 'application/json');
  };

  const loadSwaps = async (f: File) => {
    if (!bw || !cf) return;
    try {
      const sf: unknown = JSON.parse(await f.text());
      if (!isSwapFile(sf)) throw new Error('This is not a team swap file.');
      const next: (SlotConfig | null)[] = Array(36).fill(null);
      for (const s of sf.swaps) {
        const t = cf.teams.find((c) => c.index === s.cf97);
        if (!t || t.school !== s.cf97School) throw new Error(`The swap file uses a CF97 team (${s.cf97School}) this ROM doesn't have.`);
        if (!(s.slot >= 0 && s.slot < 36) || s.home?.length !== 16 || s.away?.length !== 16) throw new Error('The swap file is damaged.');
        if (s.offense !== undefined) parseStyle('offense', s.offense);
        if (s.defense !== undefined) parseStyle('defense', s.defense);
        const inRange = (a: unknown, n: number, max: number) =>
          Array.isArray(a) && a.length === n && a.every((v) => Number.isInteger(v) && v >= 0 && v <= max);
        if ((s.ovr !== undefined && !inRange(s.ovr, 2, 99)) || (s.weather !== undefined && !inRange(s.weather, 4, 15))) {
          throw new Error('The swap file is damaged (team ratings or weather).');
        }
        const w = s.walsh as unknown;
        if (
          w !== undefined &&
          !(Array.isArray(w) && w.length === 2 && w.every((p) => typeof p === 'string') && !reportProblems({ offense: w[0], defense: w[1] }).length)
        ) {
          throw new Error('The swap file is damaged (Walsh Report).');
        }
        next[s.slot] = { ...s, celebration: s.celebration?.length === 3 ? s.celebration : defaultCelebration(s.home) };
      }
      setSlots(next);
      setNote({ kind: 'ok', text: `Loaded ${sf.swaps.length} swap${sf.swaps.length === 1 ? '' : 's'} from ${f.name}.` });
    } catch (e) {
      setNote({ kind: 'error', text: (e as Error).message });
    }
  };

  return (
    <div
      className={`page${dragging ? ' dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (tab === 'patch') void start.loadFiles(e.dataTransfer.files);
        else if (tab === 'rosters' || tab === 'teams') void work.loadFiles(e.dataTransfer.files);
        else if (tab === 'season') seasonDrop.current?.(e.dataTransfer.files);
        else onFiles(e.dataTransfer.files);
      }}
    >
      <header className="masthead">
        <h1>
          <span className="mast-2">
            Bill Walsh '95 <span className="mast-elev">ELEVATED</span>
          </span>
          <span className="mast-3">Mod Toolkit</span>
        </h1>
        <p className="lede">
          Modding tools for EA's college football games on the Sega Genesis. Made for the{' '}
          <a href="https://github.com/jd6-37/Bill-Walsh-CFB-95-Elevated" target="_blank" rel="noreferrer">
            BW95 Elevated mod
          </a>
          , but roster editing/importing in CFB'96 and '97 is also possible.
        </p>
      </header>

      <nav className="tabs" role="tablist" aria-label="Tools">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            className={`tab${tab === t.id ? ' tab-on' : ''}`}
            onClick={() => pickTab(t.id)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
              const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].id;
              pickTab(next);
              document.getElementById(`tab-${next}`)?.focus();
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div id="panel-patch" role="tabpanel" aria-labelledby="tab-patch" hidden={tab !== 'patch'}>
        <PatchTool
          api={start}
          inWork={workHasStart}
          onSwap={() => pickTab('swap')}
          onEdit={() => {
            if (!start.rom) return;
            if (!sameBytes(work.work?.base, start.rom.data)) {
              work.takeRom({ name: start.rom.name, label: start.rom.known?.label ?? start.rom.name, data: start.rom.data });
            }
            pickTab('season');
          }}
        />
      </div>

      <div id="panel-season" role="tabpanel" aria-labelledby="tab-season" hidden={tab !== 'season'}>
        <SeasonTool api={work} teamSwap={teamSwap} registerDrop={registerSeasonDrop} />
      </div>

      <div id="panel-teams" role="tabpanel" aria-labelledby="tab-teams" hidden={tab !== 'teams'}>
        <TeamsTool api={work} teamSwap={teamSwap} />
      </div>

      <div id="panel-rosters" role="tabpanel" aria-labelledby="tab-rosters" hidden={tab !== 'rosters'}>
        <RosterTool api={work} teamSwap={teamSwap} />
      </div>

      <div id="panel-swap" role="tabpanel" aria-labelledby="tab-swap" hidden={tab !== 'swap'}>
      <section className="tool-head" aria-label="Team Swap">
        <h2>Team Swap</h2>
        <p>
          Replace any of Bill Walsh College Football '95's 36 teams with teams from College Football USA 97: logo,
          helmet, wordmark, names, uniform colors and the computer's offense and defense styles. Schedules, rosters and
          saves stay as they are (edit them in the Season and Rosters tabs).
        </p>
      </section>

      <section className="roms" aria-label="ROM files">
        <RomCard
          title="Bill Walsh College Football '95"
          hint="The original USA ROM, or one with a mod such as Elevated. .md, .bin, .gen or .zip."
          rom={bw?.rom}
          onFiles={onFiles}
        />
        <RomCard
          title="College Football USA 97"
          hint="The USA ROM. The new teams' art and colors come from here."
          rom={cf?.rom}
          onFiles={onFiles}
        />
        {romNote && (
          <p className={`note ${romNote.kind}`} role="alert">
            {romNote.text}
          </p>
        )}
        {start.original && start.rom === start.original && (
          <p className="note ok">
            This is the original game. To add the mod's fatigue fix and more first, use the{' '}
            <button className="link-btn" onClick={() => pickTab('patch')}>
              Patch tab
            </button>
            .
          </p>
        )}
        {bw && swappedBefore.length > 0 && (
          <p className="note ok">
            Already swapped in: {swappedBefore.map((s) => bw.teams[s].school).join(', ')}. They stay as they are unless
            you pick another team for their slot.
          </p>
        )}
      </section>

      {ready ? (
        <section className="board" aria-label="Teams">
          <div className="board-head">
            <h2>Teams</h2>
            <p>Pick a CF97 team for each slot you want to change. Open a row to edit its names and colors.</p>
          </div>
          <ol className="rows">
            {bw.teams.map((t) => (
              <TeamRow
                key={t.index}
                bw={t}
                cfTeams={cf.teams}
                celeb={celeb}
                styles={teamStyles && { info: teamStyles.info, was: teamStyles.styles[t.index] }}
                ratings={teamRatings && teamRatings[t.index]}
                walsh={
                  slots[t.index]
                    ? {
                        value: showReport(buildReport(t.index)),
                        original: showReport(renamedReport(slots[t.index]!)),
                        trims: trimsFor(t.index),
                      }
                    : null
                }
                slot={slots[t.index]}
                open={open === t.index}
                onToggle={() => setOpen(open === t.index ? null : t.index)}
                onChange={(s) => setSlot(t.index, s)}
              />
            ))}
          </ol>
          <aside className="limits">
            <h3>What stays the same</h3>
            <ul>
              <li>
                Rosters, schedules, rankings and battery saves keep the original team's slot. To change the players, use
                the Rosters tab (it can open the swapped ROM directly).
              </li>
              <li>
                The computer's offense and defense styles stay the original team's unless you change them in the team's
                edit screen (or later in the Teams tab).
              </li>
              <li>
                The Walsh Report keeps the original team's scouting text with the names changed, unless you write a new
                one in the team's edit screen (or later in the Teams tab).
              </li>
              <li>
                After a season-ending win, a swapped team gets a GO TEAM! card stunt in its colors instead of the original
                team's celebration.
              </li>
            </ul>
          </aside>
        </section>
      ) : (
        <section className="waiting">
          <p>Load both ROMs to see the teams. You can drop the files anywhere on this page.</p>
        </section>
      )}

      {ready && (
        <footer className="dock">
          <p className="dock-count" aria-live="polite">
            {swapped.length ? `${swapped.length} of 36 teams swapped` : 'No teams swapped yet'}
          </p>
          {note && (
            <p className={`note ${note.kind}`} role={note.kind === 'error' ? 'alert' : 'status'}>
              {note.text}
            </p>
          )}
          {problems.length > 0 && (
            <p className="note error" role="alert">
              {problems[0]}
              {problems.length > 1 ? ` (and ${problems.length - 1} more)` : ''}
            </p>
          )}
          <div className="dock-actions">
            <label className="btn">
              Load swap file
              <input
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(e) => e.target.files?.[0] && loadSwaps(e.target.files[0]).then(() => (e.target.value = ''))}
              />
            </label>
            <button className="btn" onClick={saveSwaps} disabled={!swapped.length}>
              Save swap file
            </button>
            <button className="btn btn-go" onClick={doBuild} disabled={!swapped.length || problems.length > 0}>
              Download ROM
            </button>
          </div>
        </footer>
      )}
      </div>
    </div>
  );
}

function RomCard({ title, hint, rom, onFiles }: { title: string; hint: string; rom?: OpenedRom; onFiles: (f: FileList) => void }) {
  return (
    <label className={`rom${rom ? ' rom-ok' : ''}`}>
      <span className="rom-title">{title}</span>
      {rom ? (
        <span className="rom-status">
          {rom.known!.label}
          <small>{rom.name}</small>
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
          if (e.target.files) onFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </label>
  );
}

function TeamRow({
  bw,
  cfTeams,
  celeb,
  styles,
  ratings,
  walsh,
  slot,
  open,
  onToggle,
  onChange,
}: {
  bw: BwTeam;
  cfTeams: CfTeam[];
  celeb: CelebBlob | null;
  /** The ROM's style info and the slot's own styles; null if this ROM's styles can't be changed. */
  styles: { info: StyleInfo; was: TeamStyle } | null;
  /** The slot's own OVRs and home weather; null if this ROM's can't be changed. */
  ratings: { rating: TeamRating; weather: Weather } | null;
  /** The swapped team's Walsh Report (shown form), the renamed original, and the reports a first edit trims. */
  walsh: { value: Report; original: Report; trims: string[] } | null;
  slot: SlotConfig | null;
  open: boolean;
  onToggle: () => void;
  onChange: (s: SlotConfig | null) => void;
}) {
  const cf = slot ? cfTeams.find((c) => c.index === slot.cf97)! : null;
  const pics = useMemo(() => {
    if (cf) {
      return {
        logo: renderSprites(cf.tiles, cf.logoPalette, [cf.logo]),
        helmet: renderSprites(cf.tiles, cf.logoPalette, [cf.helmet]),
        word: renderSprites(cf.tiles, cf.logoPalette, [cf.wordmark]),
      };
    }
    const pal = bw.mascot.palette!;
    return {
      logo: renderSprites(bw.mascot.tiles, pal, [bw.mascot.groups[1]]),
      helmet: renderSprites(bw.helmet.tiles, pal, [bw.helmet.groups[0]]),
      word: renderSprites(bw.mascot.tiles, pal, [bw.mascot.groups[2]]),
    };
  }, [cf, bw]);
  const errs = slot ? validateSlot(slot) : [];
  const cheer = slot?.celebration ?? (slot ? defaultCelebration(slot.home) : null);
  const cheerPic = useMemo(() => {
    if (!celeb || !cheer) return null;
    const pal = celeb.palette.slice();
    [9, 10, 13].forEach((idx, k) => (pal[idx] = cheer[k]));
    const tiles = celeb.bytes.subarray(celeb.tiles, celeb.tiles + 32 * celeb.ntiles);
    return renderSprites(tiles, pal, [celeb.groups[PREVIEW_FRAME]]);
  }, [celeb, cheer?.join()]);
  const setCheer = (k: number, c: number) => {
    const n = (cheer ?? [0, 0, 0]).slice();
    n[k] = c;
    onChange({ ...slot!, celebration: n });
  };
  const id = `slot-${bw.index}`;

  const text = (k: 'school' | 'city' | 'nickname', label: string) => (
    <label className="text-field">
      <span>
        {label} <small>{slot![k].length}/{MAX_LEN[k]}</small>
      </span>
      <input
        value={slot![k]}
        maxLength={MAX_LEN[k]}
        onChange={(e) => onChange({ ...slot!, [k]: e.target.value })}
        aria-invalid={validateSlot(slot!).some((p) => p.startsWith(k))}
      />
    </label>
  );

  return (
    <li className={`row${slot ? ' row-swapped' : ''}${open ? ' row-open' : ''}`}>
      <div className="row-main">
        <span className="row-from">
          <span className="row-orig">{bw.school}</span>
          {slot && <span className="row-was">was {bw.nickname}</span>}
        </span>
        <span className="row-art" aria-hidden={!slot}>
          <SpriteCanvas pic={pics.logo} scale={1} label={`${slot ? slot.school : bw.school} logo`} />
          <SpriteCanvas pic={pics.helmet} scale={1} label={`${slot ? slot.school : bw.school} helmet`} />
          <SpriteCanvas pic={pics.word} scale={1} label={`${slot ? slot.school : bw.school} wordmark`} />
        </span>
        <label className="row-pick">
          <span className="sr-only">Replacement for {bw.school}</span>
          <select
            value={slot ? slot.cf97 : ''}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '') return onChange(null);
              onChange(defaultSlot(bw, cfTeams.find((c) => c.index === +v)!));
            }}
          >
            <option value="">Keep {bw.school}</option>
            {cfTeams.map((c) => (
              <option key={c.index} value={c.index}>
                {c.school} {c.nickname}
              </option>
            ))}
          </select>
        </label>
        {slot ? (
          <button className="row-toggle" onClick={onToggle} aria-expanded={open} aria-controls={id}>
            {open ? 'Close' : errs.length ? 'Fix names' : 'Edit'}
          </button>
        ) : (
          <span className="row-toggle-spacer" />
        )}
      </div>
      {slot && open && (
        <div className="row-edit" id={id}>
          <div className="names">
            {text('school', 'School')}
            {text('city', 'City')}
            {text('nickname', 'Nickname')}
            <p className="hint">The city appears in Bill Walsh's welcome. CF97 stores the stadium ({cf!.stadium}), so the city is filled in for you.</p>
            {styles && (
              <StylePicks
                team={slot.school}
                info={styles.info}
                was={styles.was}
                wasName={bw.school}
                value={{
                  offense: slot.offense === undefined ? styles.was.offense : parseStyle('offense', slot.offense),
                  defense: slot.defense === undefined ? styles.was.defense : parseStyle('defense', slot.defense),
                }}
                onChange={(st) => onChange({ ...slot, offense: OFFENSE[st.offense], defense: DEFENSE[st.defense] })}
              />
            )}
            {ratings && (
              <RatingPicks
                team={slot.school}
                rating={slot.ovr ? { off: slot.ovr[0], def: slot.ovr[1] } : ratings.rating}
                weather={(slot.weather as Weather | undefined) ?? ratings.weather}
                source={
                  slot.ovr && cf && slot.ovr[0] === ovrFromSim(cf.offense) && slot.ovr[1] === ovrFromSim(cf.defense)
                    ? `${cf.school} in College Football USA 97`
                    : undefined
                }
                was={{ name: bw.school, rating: ratings.rating, weather: ratings.weather }}
                onRating={(r) => onChange({ ...slot, ovr: [r.off, r.def] })}
                onWeather={(w) => onChange({ ...slot, weather: [...w] })}
              />
            )}
            {walsh && (
              <WalshField
                team={slot.school}
                value={walsh.value}
                original={walsh.original}
                edited={!!slot.walsh}
                trims={walsh.trims}
                onSave={(r) => {
                  // The renamed original as it is: no edit, so it keeps following the names.
                  const orig = walsh.original;
                  const same = reportLength(orig) <= REPORT_LIMIT && r.offense === orig.offense.trim() && r.defense === orig.defense.trim();
                  onChange({ ...slot, walsh: same ? undefined : [r.offense, r.defense] });
                }}
              />
            )}
          </div>
          <UniformEditor title="Home" u={slot.home} onChange={(home) => onChange({ ...slot, home })} />
          <UniformEditor title="Away" u={slot.away} onChange={(away) => onChange({ ...slot, away })} />
          <div className="extras">
            <div className="field-row">
              <span>End zones</span>
              <Swatch color={slot.endZone} label="End zone color" onPick={(endZone) => onChange({ ...slot, endZone })} />
            </div>
            <p className="hint">Used when this team is at home.</p>
            {cheer && (
              <div className="cheer">
                <span className="cheer-title">Season-end card stunt</span>
                <div className="cheer-stage">
                  <SpriteCanvas pic={cheerPic} scale={1.5} label="GO TEAM! card stunt preview" />
                </div>
                <div className="field-row">
                  <span>Cards</span>
                  <Swatch color={cheer[0]} label="Card stunt cards" onPick={(c) => setCheer(0, c)} />
                </div>
                <div className="field-row">
                  <span>Skirts and pom-poms</span>
                  <Swatch color={cheer[1]} label="Card stunt skirts and pom-poms" onPick={(c) => setCheer(1, c)} />
                </div>
                <div className="field-row">
                  <span>Tops</span>
                  <Swatch color={cheer[2]} label="Card stunt tops" onPick={(c) => setCheer(2, c)} />
                </div>
              </div>
            )}
            <button className="btn btn-quiet" onClick={() => onChange(defaultSlot(bw, cf!))}>
              Reset to CF97 defaults
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
