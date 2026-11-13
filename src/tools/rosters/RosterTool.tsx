// Rosters tool: edit the players of BW95, CF96 or CF97 team by team, or import them from a
// spreadsheet (CSV or XLSX), export them as CSV, and download the ROM with fixed checksums.
import { Button, Note, PageHead, SubHead } from '../../ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GAMES, GROUP_COLUMNS, GROUP_ORDER, GROUP_TITLES, nibbleToRating, nibbleToWeight, ratingRangeLabel, weightRangeLabel,
  type Attr, type SlotDef,
} from '../../core/rosterLayouts';
import {
  getRating, jerseyByte, jerseyNumber, openRosterRom, readPlayer, refreshThreeFour, setRating, teamLayout, teamName, writePlayer,
  type Player, type RosterRom,
} from '../../core/rosterRom';
import { detectImport, importSheet, type ImportReport } from '../../core/rosterImport';
import { applyCfb27, convertCfb27, type Cfb27Plan } from '../../core/rosterCfb27';
import { hasOlPatch, installOlPatch, olPatchState, restoreOlPatch, shownWeightOffset } from '../../core/rosterOlPatch';
import { exportRostersCsv } from '../../core/rosterExport';
import { readSheet, type Sheet } from '../../core/rosterSheet';
import { readStyle, styleInfo, styleProblems, writeStyle } from '../../core/styles';
import { WorkRomCard, type TeamSwapSource, type WorkApi } from '../shared/WorkRom';
import { StylePicks } from '../styles/StylePicks';
import { CFB27_LATEST, fetchCfb27Latest } from '../../core/cfb27Latest';
import { ratingProblems, writeRating } from '../../core/teamRatings';
import { fetchWalsh2026, reportsForSlots, type WalshData } from '../../core/walsh2026';
import { writeReports } from '../../core/walshReports';
import './rosters.css';

export type { TeamSwapSource };

type Msg = { kind: 'error' | 'ok'; text: string } | null;

interface Loaded {
  /** The shared working ROM's bytes, edited in place (the Season tab edits the same bytes). */
  rom: RosterRom;
  /** Bytes as loaded: change marks and "revert" compare against these. */
  baseline: Uint8Array;
  /** File name the ROM came from (the ROM inside a zip). */
  name: string;
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

export function RosterTool({ api, teamSwap }: { api: WorkApi; teamSwap: TeamSwapSource | null }) {
  const { work, rev } = api;
  const [note, setNote] = useState<Msg>(null);

  const loaded = useMemo<Loaded | null>(
    () => (work ? { rom: openRosterRom(work.data, true), baseline: work.base, name: work.name } : null),
    [work],
  );
  useEffect(() => setNote(null), [work]);

  const changed = useMemo(() => {
    if (!loaded) return [];
    const { rom, baseline } = loaded;
    const len = rom.info.players * rom.info.stride;
    return rom.teams.filter((t) => {
      for (let k = t.rosterOffset; k < t.rosterOffset + len; k++) if (rom.data[k] !== baseline[k]) return true;
      return false;
    }).map((t) => t.index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, rev]);

  return (
    <>
      <PageHead title="Rosters">
          Edit the players of Bill Walsh College Football '95, College Football USA 96 or 97: jersey numbers and
          ratings, team by team, or many teams at once from a spreadsheet (CSV or Excel).
        </PageHead>

      <WorkRomCard
        api={api}
        teamSwap={teamSwap}
        hint="Bill Walsh College Football '95, College Football USA 96 or 97. Original or modified (Elevated, formerly Rebalanced; Team Swap; an earlier edit). .md, .bin, .gen or .zip."
      />

      {loaded ? (
        <RosterEditor key={work!.id} loaded={loaded} changed={changed} onChange={api.edited} />
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
            {api.edits.season && <small className="dock-also">+ season changes</small>}
            {api.edits.teams && <small className="dock-also">+ team changes</small>}
          </p>
          {note && (
            <Note kind={note.kind}>
              {note.text}
            </Note>
          )}
          <div className="dock-actions">
            <Button onClick={() => setNote(api.save())} disabled={!api.edits.any && !work?.checkOff}>
              Download ROM
            </Button>
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
  const [report, setReport] = useState<(ImportReport & { file: string; olOffer: boolean }) | null>(null);
  // A plan from the built-in CFB 27 rosters comes with the built-in 2026 Walsh Reports (or why they didn't load).
  const [plan, setPlan] = useState<{ plan: Cfb27Plan; file: string; walsh: { data: WalshData | null; error: string | null } | null } | null>(null);
  const [converted, setConverted] = useState<ConvertedReport | null>(null);
  const [error, setError] = useState<string | string[] | null>(null);
  const sheetRef = useRef<HTMLInputElement>(null);
  const bump = () => {
    setRev((r) => r + 1);
    onChange();
  };

  // Team styles (BW95): the defense also sets the 3-4 roster layout on the original layout, and the
  // Teams tab can change it too, so the layouts are re-read from the bytes on every render.
  const sinfo = useMemo(() => (rom.game === 'bw95' && !styleProblems(rom.data).length ? styleInfo(rom.data) : null), [rom]);
  refreshThreeFour(rom);
  const t = rom.teams[team];
  const layout = useMemo(() => teamLayout(rom, team), [rom, team, t.threeFour]);
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
    // Back to the loaded rosters everywhere: take the OL weight tweak out again if this session added it.
    const anyLeft = rom.teams.some((x) => {
      for (let k = x.rosterOffset; k < x.rosterOffset + recLen; k++) if (rom.data[k] !== baseline[k]) return true;
      return false;
    });
    if (!anyLeft && rom.game === 'bw95' && olPatchState(baseline) !== 'installed') restoreOlPatch(rom.data, baseline);
    setReport(null);
    setConverted(null);
    bump();
  };

  const clearPanels = () => {
    setError(null);
    setReport(null);
    setPlan(null);
    setConverted(null);
  };

  const [fetching, setFetching] = useState(false);
  const builtInName = `CFB 27 rosters, ${CFB27_LATEST.season} Week ${CFB27_LATEST.week} (built in)`;
  const loadBuiltIn = async () => {
    clearPanels();
    setFetching(true);
    try {
      const [bytes, walsh] = await Promise.all([
        fetchCfb27Latest(),
        fetchWalsh2026().then(
          (data) => ({ data, error: null }),
          (e: Error) => ({ data: null, error: e.message }),
        ),
      ]);
      await onImportBytes(builtInName, bytes, walsh);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFetching(false);
    }
  };

  const onImport = async (f: File) => onImportBytes(f.name, new Uint8Array(await f.arrayBuffer()));
  const onImportBytes = async (name: string, bytes: Uint8Array, walsh: { data: WalshData | null; error: string | null } | null = null) => {
    const f = { name };
    clearPanels();
    let sheet: Sheet;
    try {
      sheet = await readSheet(f.name, bytes);
    } catch (e) {
      return setError(`${f.name}: ${(e as Error).message}`);
    }
    const kind = detectImport(rom, sheet);
    if (kind.path === 'refused') return setError([`${f.name} doesn't fit this ROM:`, ...kind.problems]);
    if (kind.path === 'cfb27') {
      try {
        // The 138-team edition already has these reports (they were written for it), so they aren't offered there.
        setPlan({ plan: convertCfb27(rom, sheet), file: f.name, walsh: rom.game === 'bw95' && !rom.wide ? walsh : null });
      } catch (e) {
        setError(`${f.name}: ${(e as Error).message}`);
      }
      return;
    }
    try {
      const rep = importSheet(rom, sheet);
      // A CSV converted from CFB 27 elsewhere (it carries EA player IDs) goes in slot by slot; offer the OL tweak.
      const olOffer = kind.path === 'slots' && rom.game === 'bw95' && !hasOlPatch(rom) && rep.teams.length > 0 &&
        sheet.headers.some((h) => h.toLowerCase().replace(/[^a-z]/g, '') === 'eaplayerid');
      setReport({ ...rep, file: f.name, olOffer });
      if (rep.teams.length && !rep.teams.some((x) => x.team === team)) setTeam(rep.teams[0].team);
      bump();
    } catch (e) {
      setError(`${f.name}: ${(e as Error).message}`);
    }
  };

  const applyPlan = (teams: number[], tweak: boolean, ratings: boolean, walsh: boolean) => {
    if (!plan) return;
    const slots = applyCfb27(rom, plan.plan, teams);
    const rated = ratings ? plan.plan.teams.filter((t) => teams.includes(t.team)) : [];
    for (const t of rated) writeRating(rom.data, t.team, t.ovr);
    let reports = { teams: 0, trimmed: 0, error: null as string | null };
    if (walsh && plan.walsh?.data) {
      const picked = reportsForSlots(plan.walsh.data, plan.plan.teams.filter((t) => teams.includes(t.team)));
      try {
        reports = { teams: picked.size, trimmed: writeReports(rom.data, picked).length, error: null };
      } catch (e) {
        reports = { teams: 0, trimmed: 0, error: `The Walsh Reports weren't written: ${(e as Error).message}` };
      }
    }
    let tweakNote: string | null = null;
    if (tweak && rom.game === 'bw95') {
      try {
        tweakNote = installOlPatch(rom.data) === 'installed' ? 'installed' : 'already';
      } catch (e) {
        tweakNote = (e as Error).message;
      }
    }
    setConverted({ plan: plan.plan, file: plan.file, teams, slots, tweak: tweakNote, ratings: rated.length, reports });
    setPlan(null);
    if (teams.length && !teams.includes(team)) setTeam(teams[0]);
    bump();
  };

  const addTweak = () => {
    try {
      installOlPatch(rom.data);
      setReport((r) => (r ? { ...r, olOffer: false } : r));
      bump();
    } catch (e) {
      setError((e as Error).message);
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
        {sinfo ? (
          <StylePicks
            mode="bar"
            team={t.school}
            value={readStyle(rom.data, team)}
            info={sinfo}
            onChange={(st) => {
              writeStyle(rom.data, team, st);
              refreshThreeFour(rom);
              bump();
            }}
          />
        ) : (
          rom.game === 'bw95' && !rom.elevated && <span className="ros-chip">{t.threeFour ? '3-4 defense' : '4-3 defense'}</span>
        )}
        {hasOlPatch(rom) && (
          <span className="ros-chip" title="The roster screen shows offensive linemen 25 lb heavier (display only). Weights here match the screen.">
            OL weights +25 lb
          </span>
        )}
        <div className="ros-actions">
          {rom.game === 'bw95' && (
            <Button variant="quiet" onClick={() => void loadBuiltIn()} disabled={fetching} title={CFB27_LATEST.label}>
              {fetching ? 'Loading CFB 27 rosters…' : `CFB 27 rosters (${CFB27_LATEST.season}, Week ${CFB27_LATEST.week})`}
            </Button>
          )}
          <Button variant="quiet" onClick={() => sheetRef.current?.click()}>
            Import spreadsheet
          </Button>
          <Button variant="quiet" onClick={() => download(`${safeName(teamName(t))} roster.csv`, exportRostersCsv(rom, [team]), 'text/csv')}>
            Export team CSV
          </Button>
          <Button variant="quiet" onClick={() => download(exportName, exportRostersCsv(rom), 'text/csv')}>
            Export all teams CSV
          </Button>
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
        <Note kind="error" block>
          {Array.isArray(error) ? (
            <>
              <p>{error[0]}</p>
              <ul>
                {error.slice(1).map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>{error}</p>
          )}
        </Note>
      )}
      {plan && <Cfb27Preview rom={rom} plan={plan.plan} file={plan.file} walsh={plan.walsh} onApply={applyPlan} onCancel={() => setPlan(null)} />}
      {converted && <Cfb27Summary rom={rom} report={converted} onPick={setTeam} onClose={() => setConverted(null)} />}
      {report && <ImportSummary report={report} onPick={setTeam} onClose={() => setReport(null)} onTweak={addTweak} />}

      <div className="ros-grid" key={`${team}-${rev}`}>
        {GROUP_ORDER.map((g) => {
          const slots = layout.filter((d) => d.group === g);
          return (
            slots.length > 0 && (
              <section key={g} className="ros-sec">
                <SubHead>{GROUP_TITLES[g]}</SubHead>
                <div className="ros-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Pos</th>
                        <th>No.</th>
                        {GROUP_COLUMNS[g].map((a) =>
                          g === 'KP' && a === 'Quickness' ? (
                            <th key={a} title="QUICK on the game's roster screen. The game's kicks use it as kick distance.">
                              Quick <span className="ros-th-note">kick distance</span>
                            </th>
                          ) : (
                            <th key={a}>{ATTR_SHORT[a]}</th>
                          ),
                        )}
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
        16 lb steps (140 … 380{hasOlPatch(rom) ? '; offensive linemen 165 … 405, see "OL weights +25 lb"' : ''}). A
        spreadsheet value goes to the step at or below it (88 → 86, 245 lb → 236). Players have no names in these
        games, only numbers.
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
        const plus = weight ? shownWeightOffset(rom, def) : 0;
        return (
          <td key={a} className={v !== getRating(base, def, a) ? 'chg' : ''}>
            <select
              value={v}
              aria-label={`${def.label} ${a}`}
              data-step={weight ? undefined : v}
              title={weight ? `Import ${weightRangeLabel(v, plus)} lb` : `Import ${ratingRangeLabel(v)}`}
              onChange={(e) => save((pl) => setRating(pl, def, a, Number(e.target.value)))}
            >
              {STEPS.map((s) => (
                <option key={s} value={s}>
                  {weight ? nibbleToWeight(s) + plus : nibbleToRating(s)}
                </option>
              ))}
            </select>
          </td>
        );
      })}
    </tr>
  );
}

function ImportSummary({
  report, onPick, onClose, onTweak,
}: {
  report: ImportReport & { file: string; olOffer: boolean };
  onPick: (t: number) => void;
  onClose: () => void;
  onTweak: () => void;
}) {
  const placed = report.teams.reduce((n, t) => n + t.filled.length, 0);
  const list = (items: string[]) => items.join(', ');
  const bySlot = report.teams.some((t) => t.mode === 'slots');
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
      <p className="ros-dim ros-path">
        {bySlot
          ? 'Imported slot by slot (the sheet has a Slot column that fits this ROM).'
          : 'Imported by position: the best players by Overall Rating filled each position\'s slots.'}
      </p>
      {report.olOffer && (
        <p className="ros-offer">
          This looks like CFB 27 rosters. The roster screen can show offensive linemen 25 lb heavier, closer to today's
          weights (display only).{' '}
          <Button variant="quiet" onClick={onTweak}>
            Show OL weights +25 lb
          </Button>
        </p>
      )}
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

interface ConvertedReport {
  plan: Cfb27Plan;
  file: string;
  /** Teams written (indexes). */
  teams: number[];
  slots: number;
  /** 'installed', 'already', an error message, or null when not asked for. */
  tweak: string | null;
  /** Teams whose OFF/DEF were set from their CFB 27 starters. */
  ratings: number;
  /** 2026 Walsh Reports written, other long reports trimmed, or why they weren't written. */
  reports: { teams: number; trimmed: number; error: string | null };
}

/** CFB 27 data was found: shows what the conversion would do and which teams to write. */
function Cfb27Preview({
  rom, plan, file, walsh, onApply, onCancel,
}: {
  rom: RosterRom;
  plan: Cfb27Plan;
  file: string;
  /** The built-in 2026 Walsh Reports, offered with the built-in rosters only (their jersey numbers match). */
  walsh: { data: WalshData | null; error: string | null } | null;
  onApply: (teams: number[], tweak: boolean, ratings: boolean, walsh: boolean) => void;
  onCancel: () => void;
}) {
  const [useWalsh, setUseWalsh] = useState(!!walsh?.data);
  const [pick, setPick] = useState<Set<number>>(() => new Set(plan.teams.map((t) => t.team)));
  const [tweak, setTweak] = useState(rom.game === 'bw95' && olPatchState(rom.data) !== 'unknown');
  const canRate = rom.game === 'bw95' && !ratingProblems(rom.data).length;
  const [ratings, setRatings] = useState(canRate);
  const toggle = (i: number) => setPick((s) => {
    const n = new Set(s);
    if (n.has(i)) n.delete(i); else n.add(i);
    return n;
  });
  const n = plan.teams.length;
  return (
    <div className="ros-report ros-convert" role="region" aria-label="CFB 27 conversion">
      <div className="ros-report-head">
        <strong>{file}</strong>
        <span>
          CFB 27 ratings: {n === 0 ? 'no school in the file matches a team in this ROM.' : `${n} of this ROM's ${rom.teams.length} teams found.`}
        </span>
        <button className="ros-link" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {n > 0 && (
        <>
          <p className="ros-dim ros-path">
            Each team gets its own CFB 27 players. Ratings are ranked among the players in this file and keep the original
            game's spread for each position, so the game plays the same. Teams you leave out keep their rosters.
          </p>
          <fieldset className="ros-pick">
            <legend>
              Teams to write{' '}
              <button type="button" className="ros-link" onClick={() => setPick(new Set(plan.teams.map((t) => t.team)))}>
                all
              </button>{' '}
              <button type="button" className="ros-link" onClick={() => setPick(new Set())}>
                none
              </button>
            </legend>
            {[...plan.teams].sort((a, b) => rom.teams[a.team].school.localeCompare(rom.teams[b.team].school)).map((t) => (
              <label key={t.team}>
                <input type="checkbox" checked={pick.has(t.team)} onChange={() => toggle(t.team)} />
                {rom.teams[t.team].school}
                {t.unfilled.length > 0 && <span className="ros-dim"> ({t.fills.length} of {t.fills.length + t.unfilled.length})</span>}
                {canRate && <span className="ros-dim ros-ovr"> {t.ovr.off}/{t.ovr.def}</span>}
              </label>
            ))}
          </fieldset>
          {rom.game === 'bw95' && (
            <label className="ros-tweak">
              <input type="checkbox" checked={tweak} disabled={olPatchState(rom.data) === 'unknown'} onChange={(e) => setTweak(e.target.checked)} />
              Show offensive linemen 25 lb heavier on the roster screen (display only). Today's linemen are heavier than
              the original game's, and the conversion keeps the original weights so the line play stays the same.
            </label>
          )}
          {canRate && (
            <label className="ros-tweak">
              <input type="checkbox" checked={ratings} onChange={(e) => setRatings(e.target.checked)} />
              Set each team's OFF and DEF (shown after its name) from its CFB 27 starters: the best player at each starting
              position, offense and defense, on an OVR scale of 0-99. Simulated games and the preseason poll use them; they
              can be changed in the Teams tab.
            </label>
          )}
          {walsh && (
            <label className="ros-tweak">
              <input type="checkbox" checked={useWalsh} disabled={!walsh.data} onChange={(e) => setUseWalsh(e.target.checked)} />
              Use the {CFB27_LATEST.season} Walsh Reports for these teams. They name players by their jersey numbers in
              these rosters. Longer reports of teams you leave out are trimmed to 650 characters; edit any report in the
              Teams tab.
              {walsh.error && <span className="ros-warn"> {walsh.error}</span>}
            </label>
          )}
          <div className="ros-convert-actions">
            <Button disabled={pick.size === 0} onClick={() => onApply([...pick].sort((a, b) => a - b), tweak, ratings, useWalsh && !!walsh?.data)}>
              Convert {pick.size} team{pick.size === 1 ? '' : 's'}
            </Button>
          </div>
        </>
      )}
      {plan.unknownPositions.length > 0 && (
        <p className="ros-warn">
          Positions the conversion doesn't know, skipped: {plan.unknownPositions.map((u) => `${u.position} (${u.rows})`).join(', ')}
        </p>
      )}
    </div>
  );
}

/** What the conversion wrote. */
function Cfb27Summary({ rom, report, onPick, onClose }: { rom: RosterRom; report: ConvertedReport; onPick: (t: number) => void; onClose: () => void }) {
  const { plan } = report;
  const done = plan.teams.filter((t) => report.teams.includes(t.team));
  const skipped = plan.teams.filter((t) => !report.teams.includes(t.team));
  const fallbacks = done.flatMap((t) => t.fills.filter((f) => f.how === 'fallback').map((f) => ({ t, f })));
  const partial = done.filter((t) => t.unfilled.length);
  const names = (ids: number[]) => ids.map((i) => rom.teams[i].school).join(', ');
  return (
    <div className="ros-report" role="status">
      <div className="ros-report-head">
        <strong>{report.file}</strong>
        <span>
          Converted from CFB 27: {done.length} team{done.length === 1 ? '' : 's'}, {report.slots} players.
        </span>
        <button className="ros-link" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="ros-dim ros-path">
        Ratings follow the original game's spread for each position (ranked among the {plan.teams.length} team
        {plan.teams.length === 1 ? '' : 's'} in the file). Jersey numbers are the real ones.
        {report.tweak === 'installed' && ' The roster screen now shows offensive linemen 25 lb heavier.'}
        {report.tweak === 'already' && ' The roster screen already showed offensive linemen 25 lb heavier.'}
        {report.ratings > 0 && ` OFF and DEF set from the CFB 27 starters for ${report.ratings} team${report.ratings === 1 ? '' : 's'} (see the Teams tab).`}
        {report.reports.teams > 0 &&
          ` New Walsh Reports for ${report.reports.teams} team${report.reports.teams === 1 ? '' : 's'} (see the Teams tab)` +
            (report.reports.trimmed > 0
              ? `; ${report.reports.trimmed} other report${report.reports.trimmed === 1 ? ' was' : 's were'} trimmed to 650 characters.`
              : '.')}
      </p>
      {report.reports.error && <p className="ros-warn">{report.reports.error}</p>}
      {report.tweak && report.tweak !== 'installed' && report.tweak !== 'already' && <p className="ros-warn">{report.tweak}</p>}
      {plan.unmatchedRomTeams.length > 0 && (
        <p className="ros-dim">Not in the file, rosters kept: {names(plan.unmatchedRomTeams)}</p>
      )}
      {skipped.length > 0 && <p className="ros-dim">Left out by you, rosters kept: {names(skipped.map((t) => t.team))}</p>}
      {partial.length > 0 && (
        <p className="ros-dim">
          Slots with no CFB 27 player, kept as they were: {partial.map((t) => `${rom.teams[t.team].school} ${t.unfilled.join(' ')}`).join('; ')}
        </p>
      )}
      {plan.blankCells > 0 && <p className="ros-warn">{plan.blankCells} empty or non-numeric rating cells counted as 0.</p>}
      {fallbacks.length > 0 && (
        <details>
          <summary>
            Filled from another position: {fallbacks.length} slot{fallbacks.length === 1 ? '' : 's'}
          </summary>
          <div className="ros-fills ros-fallbacks">
            {fallbacks.map(({ t, f }) => (
              <span key={`${t.team}-${f.slot}`}>
                {rom.teams[t.team].school} <b>{f.label}</b> ← {f.player.pos} {f.player.name}
              </span>
            ))}
          </div>
        </details>
      )}
      <details>
        <summary>Who went where</summary>
        <ul className="ros-teams">
          {done.map((t) => (
            <li key={t.team}>
              <button className="ros-link" onClick={() => onPick(t.team)}>
                {t.teamName}
              </button>
              {normalize(t.sheetTeam) !== normalize(rom.teams[t.team].school) && <span className="ros-dim"> (file: {t.sheetTeam})</span>}
              <div className="ros-fills">
                {t.fills.map((f) => (
                  <span key={f.slot}>
                    <b>{f.label}</b> #{f.player.jersey} {f.player.name}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function SheetHelp() {
  return (
    <aside className="limits ros-help">
      <SubHead>Spreadsheet import</SubHead>
      <p>The tool looks at the file and picks one of three ways to read it. The report after the import says which.</p>
      <ul>
        <li>
          <b>A CSV exported here</b> (it has a <b>Slot</b> column): every row goes to the exact slot it names. Edit an
          export and import it again. The slots have to fit this ROM's defense (4-3, 3-4 or Elevated); a file made for a
          different one is refused, with the teams it doesn't fit. Teams the ROM doesn't have are skipped.
        </li>
        <li>
          <b>CFB 27 ratings</b> (one row per player, with the column names of EA's ratings site: Team, Name, Position,
          Overall, Jersey Number, Weight, EA Player ID, Speed, Acceleration, Agility, Strength, Awareness, …): converted
          for Bill Walsh '95. Each team gets its own players and real jersey numbers, and every rating keeps the original
          game's spread for its position, so the game plays the same. Any number of schools works; teams that aren't in
          the file keep their rosters. You choose which teams to write before anything changes.
        </li>
        <li>
          <b>Any other sheet</b>: one row per player, columns <b>Team</b>, <b>Position</b>, <b>Overall Rating</b>,
          Jersey Number, Weight (lb), Speed, Quickness, Awareness, Power, Catching, Blocking, Tackling, Throw Power, Kick
          Power, Kick Accuracy, ratings 0-99. Positions: QB, HB, FB, LT, LG, C, RG, RT, WR, TE, K, P, LE, DT, RE, LOLB,
          MLB, ROLB, CB, SS, FS. The best players by Overall Rating fill each position's slots (four WRs for SE, FL, WR1,
          WR2; the best DT is the NT on 3-4 teams). Slots nobody fills keep their player. Hands comes from Catching; QB
          Range from Throw Power; kicker Range and Accuracy from Kick Power and Kick Accuracy. A Name (or First Name and
          Last Name) column shows up in the report.
        </li>
        <li>Team names can be the school ("Texas") or school and nickname.</li>
      </ul>
    </aside>
  );
}
