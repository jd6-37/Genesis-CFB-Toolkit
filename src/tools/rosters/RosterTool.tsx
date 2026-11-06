// Rosters tool: edit the players of BW95, CF96 or CF97 team by team, or import them from a
// spreadsheet (CSV or XLSX), export them as CSV, and download the ROM with fixed checksums.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GAMES, GROUP_COLUMNS, GROUP_ORDER, GROUP_TITLES, nibbleToRating, nibbleToWeight, ratingRangeLabel, weightRangeLabel,
  type Attr, type SlotDef,
} from '../../core/rosterLayouts';
import {
  findEaChecksum, fixChecksums, getRating, jerseyByte, jerseyNumber, openRosterRom, readPlayer, setRating,
  teamLayout, teamName, writePlayer, type Player, type RosterRom,
} from '../../core/rosterRom';
import { importSheet, type ImportReport } from '../../core/rosterImport';
import { exportRostersCsv } from '../../core/rosterExport';
import { readSheet } from '../../core/rosterSheet';
import { openRom } from '../../core/romfile';
import './rosters.css';

type Note = { kind: 'error' | 'ok'; text: string } | null;

interface Loaded {
  rom: RosterRom;
  /** Bytes as loaded: change marks and "revert" compare against these. */
  baseline: Uint8Array;
  /** File name the ROM came from (the ROM inside a zip). */
  name: string;
  label: string;
  /** CFB-Walsh.exe turned the boot checksum check off in this ROM. */
  checkOff: boolean;
}

export interface TeamSwapSource {
  count: number;
  build: () => { name: string; data: Uint8Array };
}

const STEPS = Array.from({ length: 16 }, (_, i) => i);
const ATTR_SHORT: Record<Attr, string> = {
  Weight: 'Weight', Quickness: 'Quick', Speed: 'Speed', Awareness: 'Aware', Range: 'Range',
  Power: 'Power', Hands: 'Hands', Blocking: 'Block', Accuracy: 'Acc.', Tackling: 'Tackle',
};

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

const stem = (name: string) => name.replace(/\.(md|bin|gen|zip)$/i, '').replace(/\s*\[Rosters\]$/i, '');
const safeName = (s: string) => s.replace(/[^A-Za-z0-9 &'.()[\]-]+/g, ' ').replace(/\s+/g, ' ').trim();

function open(name: string, data: Uint8Array, label?: string): Loaded {
  const rom = openRosterRom(data);
  const c = findEaChecksum(rom.data, rom.game);
  return {
    rom,
    baseline: new Uint8Array(data),
    name,
    label: label ?? GAMES[rom.game].title,
    checkOff: !!c && rom.data[c.bneAt] === 0x4e && rom.data[c.bneAt + 1] === 0x71,
  };
}

export function RosterTool({
  teamSwap,
  registerDrop,
}: {
  teamSwap: TeamSwapSource | null;
  registerDrop: (fn: ((files: FileList | File[]) => void) | null) => void;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [romNote, setRomNote] = useState<Note>(null);
  const [note, setNote] = useState<Note>(null);
  const [rev, setRev] = useState(0);

  const loadFiles = async (files: FileList | File[]) => {
    const f = Array.from(files)[0];
    if (!f) return;
    setRomNote(null);
    setNote(null);
    try {
      const r = await openRom(f.name, new Uint8Array(await f.arrayBuffer()));
      setLoaded(open(r.name, r.data, r.known?.label));
    } catch (e) {
      setRomNote({ kind: 'error', text: `${f.name}: ${(e as Error).message}` });
    }
  };
  const loadRef = useRef(loadFiles);
  loadRef.current = loadFiles;
  useEffect(() => {
    registerDrop((files) => loadRef.current(files));
    return () => registerDrop(null);
  }, [registerDrop]);

  const takeTeamSwap = () => {
    if (!teamSwap) return;
    setRomNote(null);
    setNote(null);
    try {
      const { name, data } = teamSwap.build();
      setLoaded(open(name, data, `Team Swap result (${teamSwap.count} team${teamSwap.count === 1 ? '' : 's'} swapped)`));
    } catch (e) {
      setRomNote({ kind: 'error', text: (e as Error).message });
    }
  };

  const changed = useMemo(() => {
    if (!loaded) return [];
    const { rom, baseline } = loaded;
    const len = rom.info.players * rom.info.stride;
    return rom.teams.filter((t) => {
      for (let k = t.rosterOffset; k < t.rosterOffset + len; k++) if (rom.data[k] !== baseline[k]) return true;
      return false;
    }).map((t) => t.index);
  }, [loaded, rev]);

  const doDownload = () => {
    if (!loaded) return;
    const out = new Uint8Array(loaded.rom.data);
    const res = fixChecksums(out, loaded.rom.game);
    const name = `${safeName(stem(loaded.name))} [Rosters].md`;
    download(name, out as Uint8Array<ArrayBuffer>, 'application/octet-stream');
    setNote({
      kind: 'ok',
      text: `Saved ${name} with ${changed.length} team${changed.length === 1 ? '' : 's'} changed.` +
        (res.restoredCheck ? ' The boot checksum check is back on, with a correct checksum.' : ''),
    });
  };

  return (
    <>
      <section className="tool-head" aria-label="Rosters">
        <h2>Rosters</h2>
        <p>
          Edit the players of Bill Walsh College Football '95, College Football USA 96 or 97: jersey numbers and
          ratings, team by team, or many teams at once from a spreadsheet (CSV or Excel).
        </p>
      </section>

      <section className="roms ros-roms" aria-label="ROM file">
        <label className={`rom${loaded ? ' rom-ok' : ''}`}>
          <span className="rom-title">ROM</span>
          {loaded ? (
            <span className="rom-status">
              {loaded.label}
              <small>{loaded.name} · {loaded.rom.teams.length} teams · choose another file to switch</small>
            </span>
          ) : (
            <span className="rom-status rom-empty">
              <span className="rom-choose">Choose file</span>
              <small>
                Bill Walsh College Football '95, College Football USA 96 or 97. Original or modified (Rebalanced, Team
                Swap, an earlier roster edit). .md, .bin, .gen or .zip.
              </small>
            </span>
          )}
          <input
            type="file"
            accept=".md,.bin,.gen,.zip"
            hidden
            onChange={(e) => {
              if (e.target.files) void loadFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
        {teamSwap && (
          <div className="ros-from-swap">
            <button className="btn btn-quiet" onClick={takeTeamSwap}>
              Use the Team Swap result ({teamSwap.count} team{teamSwap.count === 1 ? '' : 's'} swapped)
            </button>
            <p className="hint">Builds the ROM from the Team Swap tab and opens it here, so swaps and roster edits end up in one file.</p>
          </div>
        )}
        {romNote && (
          <p className={`note ${romNote.kind}`} role="alert">
            {romNote.text}
          </p>
        )}
        {loaded?.checkOff && (
          <p className="note ok">
            This ROM's boot checksum check was turned off (CFB-Walsh.exe does that). The download turns it back on with a
            correct checksum.
          </p>
        )}
      </section>

      {loaded ? (
        <RosterEditor key={`${loaded.name}-${loaded.label}`} loaded={loaded} changed={changed} onChange={() => setRev((r) => r + 1)} />
      ) : (
        <section className="waiting">
          <p>Load a ROM to see its teams. You can drop the file anywhere on this page.</p>
        </section>
      )}

      {!loaded && <SheetHelp />}

      {loaded && (
        <footer className="dock">
          <p className="dock-count" aria-live="polite">
            {changed.length ? `${changed.length} team${changed.length === 1 ? '' : 's'} changed` : 'No roster changes yet'}
          </p>
          {note && (
            <p className={`note ${note.kind}`} role={note.kind === 'error' ? 'alert' : 'status'}>
              {note.text}
            </p>
          )}
          <div className="dock-actions">
            <button className="btn btn-go" onClick={doDownload} disabled={!changed.length && !loaded.checkOff}>
              Download ROM
            </button>
          </div>
        </footer>
      )}
    </>
  );
}

function RosterEditor({ loaded, changed, onChange }: { loaded: Loaded; changed: number[]; onChange: () => void }) {
  const { rom, baseline } = loaded;
  const [team, setTeam] = useState(0);
  const [rev, setRev] = useState(0);
  const [report, setReport] = useState<(ImportReport & { file: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sheetRef = useRef<HTMLInputElement>(null);
  const bump = () => {
    setRev((r) => r + 1);
    onChange();
  };

  const t = rom.teams[team];
  const layout = useMemo(() => teamLayout(rom, team), [rom, team]);
  const recLen = rom.info.players * rom.info.stride;
  const isChanged = (i: number) => changed.includes(i);
  const base = (slot: number): Player => {
    const o = t.rosterOffset + slot * rom.info.stride;
    const b = baseline;
    return { numberByte: b[o], ratings: [b[o + 1] >> 4, b[o + 1] & 15, b[o + 2] >> 4, b[o + 2] & 15, b[o + 3] >> 4, b[o + 3] & 15] };
  };
  const revert = (which: number[]) => {
    for (const i of which) {
      const o = rom.teams[i].rosterOffset;
      rom.data.set(baseline.subarray(o, o + recLen), o);
    }
    setReport(null);
    bump();
  };

  const onImport = async (f: File) => {
    setError(null);
    try {
      const sheet = await readSheet(f.name, new Uint8Array(await f.arrayBuffer()));
      const rep = importSheet(rom, sheet);
      setReport({ ...rep, file: f.name });
      if (rep.teams.length && !rep.teams.some((x) => x.team === team)) setTeam(rep.teams[0].team);
      bump();
    } catch (e) {
      setReport(null);
      setError(`${f.name}: ${(e as Error).message}`);
    }
  };

  const exportName = `${safeName(stem(loaded.name))} rosters.csv`;

  return (
    <section className="ros" aria-label="Roster editor">
      <div className="ros-bar">
        <label className="ros-team">
          <span>Team</span>
          <select value={team} onChange={(e) => setTeam(Number(e.target.value))}>
            {rom.teams.map((x) => (
              <option key={x.index} value={x.index}>
                {isChanged(x.index) ? '● ' : ''}
                {teamName(x)}
              </option>
            ))}
          </select>
        </label>
        {rom.game === 'bw95' && <span className="ros-chip">{t.threeFour ? '3-4 defense' : '4-3 defense'}</span>}
        <div className="ros-actions">
          <button className="btn" onClick={() => sheetRef.current?.click()}>
            Import spreadsheet
          </button>
          <button className="btn" onClick={() => download(`${safeName(teamName(t))} roster.csv`, exportRostersCsv(rom, [team]), 'text/csv')}>
            Export team CSV
          </button>
          <button className="btn" onClick={() => download(exportName, exportRostersCsv(rom), 'text/csv')}>
            Export all teams CSV
          </button>
          <input
            ref={sheetRef}
            type="file"
            accept=".csv,.txt,.xlsx"
            hidden
            aria-label="Spreadsheet file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void onImport(f);
            }}
          />
        </div>
      </div>

      <div className="ros-status">
        {isChanged(team) && (
          <button className="ros-link" onClick={() => revert([team])}>
            Undo changes to {t.school}
          </button>
        )}
        {changed.length > 1 && (
          <button className="ros-link" onClick={() => revert(changed)}>
            Undo all roster changes
          </button>
        )}
      </div>

      {error && (
        <p className="note error" role="alert">
          {error}
        </p>
      )}
      {report && <ImportSummary report={report} onPick={setTeam} onClose={() => setReport(null)} />}

      <div className="ros-grid" key={`${team}-${rev}`}>
        {GROUP_ORDER.map((g) => {
          const slots = layout.filter((d) => d.group === g);
          return (
            slots.length > 0 && (
              <section key={g} className="ros-sec">
                <h3>{GROUP_TITLES[g]}</h3>
                <div className="ros-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Pos</th>
                        <th>No.</th>
                        {GROUP_COLUMNS[g].map((a) => (
                          <th key={a}>{ATTR_SHORT[a]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {slots.map((d) => (
                        <PlayerRow key={d.slot} rom={rom} team={team} def={d} base={base(d.slot)} onEdit={bump} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          );
        })}
      </div>
      <p className="hint ros-scale">
        Values are what the game's roster screen shows: each rating has 16 steps (0, 6, 13 … 93, 100), weight goes in
        16 lb steps (140 … 380). A spreadsheet value goes to the step at or below it (88 → 86, 245 lb → 236). Players
        have no names in these games, only numbers.
      </p>
      <SheetHelp />
    </section>
  );
}

function PlayerRow({ rom, team, def, base, onEdit }: { rom: RosterRom; team: number; def: SlotDef; base: Player; onEdit: () => void }) {
  const p = readPlayer(rom, team, def.slot);
  const num = jerseyNumber(p.numberByte);
  const [text, setText] = useState(num === null ? '' : String(num));
  const save = (fn: (pl: Player) => void) => {
    const pl = readPlayer(rom, team, def.slot);
    fn(pl);
    writePlayer(rom, team, def.slot, pl);
    onEdit();
  };
  return (
    <tr>
      <td className="ros-pos">{def.label}</td>
      <td className={p.numberByte !== base.numberByte ? 'chg' : ''}>
        <input
          className="ros-num"
          inputMode="numeric"
          maxLength={2}
          value={text}
          aria-label={`${def.label} jersey number`}
          onChange={(e) => setText(e.target.value.replace(/\D/g, ''))}
          onBlur={() => {
            if (text === '') return setText(num === null ? '' : String(num));
            const n = Math.min(99, parseInt(text, 10));
            if (jerseyByte(n) !== p.numberByte) save((pl) => (pl.numberByte = jerseyByte(n)));
            setText(String(n));
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </td>
      {GROUP_COLUMNS[def.group].map((a) => {
        const v = getRating(p, def, a)!;
        const weight = a === 'Weight';
        return (
          <td key={a} className={v !== getRating(base, def, a) ? 'chg' : ''}>
            <select
              value={v}
              aria-label={`${def.label} ${a}`}
              data-step={weight ? undefined : v}
              title={weight ? `Import ${weightRangeLabel(v)} lb` : `Import ${ratingRangeLabel(v)}`}
              onChange={(e) => save((pl) => setRating(pl, def, a, Number(e.target.value)))}
            >
              {STEPS.map((s) => (
                <option key={s} value={s}>
                  {weight ? nibbleToWeight(s) : nibbleToRating(s)}
                </option>
              ))}
            </select>
          </td>
        );
      })}
    </tr>
  );
}

function ImportSummary({ report, onPick, onClose }: { report: ImportReport & { file: string }; onPick: (t: number) => void; onClose: () => void }) {
  const placed = report.teams.reduce((n, t) => n + t.filled.length, 0);
  const list = (items: string[]) => items.join(', ');
  return (
    <div className="ros-report" role="status">
      <div className="ros-report-head">
        <strong>{report.file}</strong>
        <span>
          {report.teams.length === 0
            ? 'No team in the sheet matched this ROM.'
            : `${report.teams.length} team${report.teams.length === 1 ? '' : 's'} updated, ${placed} players placed.`}
        </span>
        <button className="ros-link" onClick={onClose}>
          Close
        </button>
      </div>
      {report.unknownTeams.length > 0 && (
        <p className="ros-warn">Teams not in this ROM, skipped: {list(report.unknownTeams.map((u) => `${u.name} (${u.rows})`))}</p>
      )}
      {report.unknownPositions.length > 0 && (
        <p className="ros-warn">Positions the game doesn't use, skipped: {list(report.unknownPositions.map((u) => `${u.position} (${u.rows})`))}</p>
      )}
      {report.unknownSlots.length > 0 && (
        <p className="ros-warn">Unknown slots, skipped: {list(report.unknownSlots.map((u) => `${u.slot} (${u.rows})`))}</p>
      )}
      {report.missingColumns.length > 0 && (
        <p className="ros-warn">Not in the sheet, so those values were kept: {list(report.missingColumns)}</p>
      )}
      {report.teams.length > 0 && (
        <details>
          <summary>Who went where</summary>
          <ul className="ros-teams">
            {report.teams.map((t) => (
              <li key={t.team}>
                <button className="ros-link" onClick={() => onPick(t.team)}>
                  {t.teamName}
                </button>
                {t.sheetTeam !== t.teamName && <span className="ros-dim"> (sheet: {t.sheetTeam})</span>}
                <span className="ros-dim">
                  {' '}
                  · {t.filled.length} placed{t.mode === 'slots' ? ' by slot' : ''}
                  {t.unfilled.length > 0 && ` · kept: ${t.unfilled.join(' ')}`}
                  {t.unusedRows > 0 && ` · ${t.unusedRows} extra row${t.unusedRows === 1 ? '' : 's'}`}
                </span>
                <div className="ros-fills">
                  {t.filled.map((f) => (
                    <span key={f.slot}>
                      <b>{f.label}</b> {f.player}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function SheetHelp() {
  return (
    <aside className="limits ros-help">
      <h3>Spreadsheet import</h3>
      <ul>
        <li>
          One row per player, all teams in one sheet (.csv or .xlsx). Columns: <b>Team</b>, <b>Position</b>,{' '}
          <b>Overall Rating</b>, Jersey Number, Weight (lb), Speed, Quickness, Awareness, Power, Catching, Blocking,
          Tackling, Throw Power, Kick Power, Kick Accuracy. Ratings are 0-99. A Name (or First Name and Last Name)
          column shows up in the import report.
        </li>
        <li>
          Positions: QB, HB, FB, LT, LG, C, RG, RT, WR, TE, K, P, LE, DT, RE, LOLB, MLB, ROLB, CB, SS, FS. The best
          players by Overall Rating fill each position's slots (four WRs for SE, FL, WR1, WR2; the best DT is the NT on
          3-4 teams). Slots nobody fills keep their player.
        </li>
        <li>
          Team names can be the school ("Texas"), school and nickname, or the names CFB-Walsh.exe used. Hands comes
          from Catching; QB Range from Throw Power; kicker Range and Accuracy from Kick Power and Kick Accuracy.
        </li>
        <li>
          The CSV export has the same columns plus <b>Slot</b>. Edit it and import it again: rows with a Slot go to that
          exact slot.
        </li>
      </ul>
    </aside>
  );
}
