// Styles tab: the offense and defense style the CPU uses for each of Bill Walsh '95's 36 teams, on
// the working ROM that Season and Rosters edit too (src/tools/shared/WorkRom.tsx).
import { useEffect, useMemo, useState } from 'react';
import { openRosterRom } from '../../core/rosterRom';
import {
  DEFENSE, OFFENSE, TEAMS, defensePlan, offenseFormations, readStyles, restoreStyle, styleInfo, styleProblems, writeStyle,
  type StyleInfo, type TeamStyle,
} from '../../core/styles';
import { WorkRomCard, type TeamSwapSource, type WorkApi } from '../shared/WorkRom';
import { StylePicks } from './StylePicks';
import './teamstyles.css';

type Note = { kind: 'error' | 'ok'; text: string } | null;
type Ctx = { problem: string } | { names: string[]; info: StyleInfo };

export function StylesTool({ api, teamSwap }: { api: WorkApi; teamSwap: TeamSwapSource | null }) {
  const { work, rev } = api;
  const [note, setNote] = useState<Note>(null);
  useEffect(() => setNote(null), [work]);

  const ctx = useMemo<Ctx | null>(() => {
    if (!work) return null;
    if (work.game !== 'bw95') {
      return { problem: "The Styles tab works on Bill Walsh College Football '95 ROMs; this one is for the Rosters tab only." };
    }
    const p = styleProblems(work.data);
    if (p.length) return { problem: `This ROM's team styles can't be changed: ${p.join('; ')}.` };
    try {
      return { names: openRosterRom(work.data).teams.map((t) => t.school), info: styleInfo(work.data) };
    } catch (e) {
      return { problem: (e as Error).message };
    }
  }, [work]);
  const ok = ctx && 'names' in ctx ? ctx : null;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const styles = useMemo(() => (work && ok ? readStyles(work.data) : []), [work, ok, rev]);
  const loadedStyles = useMemo(() => (work && ok ? readStyles(work.base) : []), [work, ok]);
  const isChanged = (t: number) =>
    styles[t].offense !== loadedStyles[t].offense || styles[t].defense !== loadedStyles[t].defense;
  const changed = ok ? Array.from({ length: TEAMS }, (_, t) => t).filter(isChanged) : [];
  const order = useMemo(
    () => (ok ? Array.from({ length: TEAMS }, (_, t) => t).sort((a, b) => ok.names[a].localeCompare(ok.names[b], 'en')) : []),
    [ok],
  );

  const set = (t: number, st: TeamStyle) => {
    if (!work) return;
    try {
      writeStyle(work.data, t, st);
      setNote(null);
      api.edited();
    } catch (e) {
      setNote({ kind: 'error', text: (e as Error).message });
    }
  };
  const undo = (teams: number[]) => {
    if (!work) return;
    for (const t of teams) restoreStyle(work.data, work.base, t);
    setNote(null);
    api.edited();
  };

  return (
    <>
      <section className="tool-head" aria-label="Styles">
        <h2>Styles</h2>
        <p>
          Choose the offense and defense the computer runs for each of Bill Walsh '95's 36 teams. The style decides
          which formations it calls on each down.
        </p>
      </section>

      <WorkRomCard
        api={api}
        teamSwap={teamSwap}
        hint="Bill Walsh College Football '95: original, Elevated, a Team Swap result or an earlier edit. .md, .bin, .gen or .zip."
      />

      {work && ok ? (
        <div className="sty-layout">
          <section aria-label="Team styles">
            <table className="sty-table">
              <thead>
                <tr>
                  <th scope="col">Team</th>
                  <th scope="col">Offense</th>
                  <th scope="col">Defense</th>
                  <th scope="col" className="sty-undo-cell">
                    <span className="sr-only">Undo</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {order.map((t) => (
                  <tr key={t} className={isChanged(t) ? 'sty-changed' : undefined}>
                    <th scope="row" className="sty-team">
                      {ok.names[t]}
                    </th>
                    <StylePicks mode="table" team={ok.names[t]} value={styles[t]} info={ok.info} onChange={(st) => set(t, st)} />
                    <td className="sty-undo-cell">
                      {isChanged(t) && (
                        <button className="sty-link" onClick={() => undo([t])} aria-label={`Undo the style change for ${ok.names[t]}`}>
                          Undo
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {changed.length > 1 && (
              <div className="sty-table-foot">
                <button className="sty-link" onClick={() => undo(changed)}>
                  Undo all style changes
                </button>
              </div>
            )}
          </section>
          <StyleLegend info={ok.info} />
        </div>
      ) : (
        <section className="waiting">
          <p>
            {ctx && 'problem' in ctx
              ? ctx.problem
              : 'Load a ROM to see its teams. You can drop the file anywhere on this page.'}
          </p>
        </section>
      )}

      {work && ok && (
        <footer className="dock">
          <p className="dock-count" aria-live="polite">
            {changed.length ? `${changed.length} team${changed.length === 1 ? '' : 's'} changed` : 'No style changes yet'}
            {api.edits.season && <small className="dock-also">+ season changes</small>}
            {api.edits.rosters && <small className="dock-also">+ roster changes</small>}
          </p>
          {note && (
            <p className={`note ${note.kind}`} role={note.kind === 'error' ? 'alert' : 'status'}>
              {note.text}
            </p>
          )}
          <div className="dock-actions">
            <button className="btn btn-go" onClick={() => setNote(api.save())} disabled={!api.edits.any && !work.checkOff}>
              Download ROM
            </button>
          </div>
        </footer>
      )}
    </>
  );
}

function StyleLegend({ info }: { info: StyleInfo }) {
  return (
    <aside className="sty-legend" aria-label="What the styles call">
      <h3>Offense</h3>
      <dl>
        {OFFENSE.map((n, i) => (
          <div key={n}>
            <dt>{n}</dt>
            <dd>{offenseFormations(i, info)}</dd>
          </div>
        ))}
      </dl>
      <h3>Defense</h3>
      <dl>
        {DEFENSE.map((n, i) => (
          <div key={n}>
            <dt>{n}</dt>
            <dd>{defensePlan(i, info)}</dd>
          </div>
        ))}
      </dl>
      {info.elevated ? (
        <p className="hint">Every team has the same roster layout on this ROM, so a new defense needs no roster changes.</p>
      ) : (
        <p className="hint">
          On this ROM the defense also sets the team's roster layout. Slot 21 is a tackle in the 4-3 and an inside
          linebacker in the 3-4; the Rosters tab and its imports follow the defense you pick here.
        </p>
      )}
    </aside>
  );
}
