// Teams tab: for each of Bill Walsh '95's 36 teams, the offense and defense style the CPU uses, the
// team OVRs (offense, defense) and the home weather, on the working ROM that Season and Rosters edit
// too (src/tools/shared/WorkRom.tsx).
import { useEffect, useMemo, useState } from 'react';
import { openRosterRom } from '../../core/rosterRom';
import {
  DEFENSE, OFFENSE, TEAMS, defensePlan, offenseFormations, readStyle, readStyles, restoreStyle, styleInfo, styleProblems, writeStyle,
  type StyleInfo, type TeamStyle,
} from '../../core/styles';
import { WorkRomCard, type TeamSwapSource, type WorkApi } from '../shared/WorkRom';
import { StylePicks } from './StylePicks';
import { RatingPicks } from './RatingPicks';
import {
  WEATHER, hasOvrTable, ratingProblems, readRating, readWeather, restoreTeam, writeRating, writeWeather,
  type TeamRating, type Weather,
} from '../../core/teamRatings';
import { Cfb27Reference } from './Cfb27Reference';
import { findCfb27 } from '../../core/cfb27Styles';
import './teamstyles.css';

type Note = { kind: 'error' | 'ok'; text: string } | null;
type Ctx = { problem: string } | { names: string[]; info: StyleInfo; ovrShown: boolean };

export function TeamsTool({ api, teamSwap }: { api: WorkApi; teamSwap: TeamSwapSource | null }) {
  const { work, rev } = api;
  const [note, setNote] = useState<Note>(null);
  useEffect(() => setNote(null), [work]);

  const ctx = useMemo<Ctx | null>(() => {
    if (!work) return null;
    if (work.game !== 'bw95') {
      return { problem: "The Teams tab works on Bill Walsh College Football '95 ROMs; this one is for the Rosters tab only." };
    }
    const p = [...styleProblems(work.data), ...ratingProblems(work.data)];
    if (p.length) return { problem: `This ROM's team settings can't be changed: ${p.join('; ')}.` };
    try {
      return { names: openRosterRom(work.data).teams.map((t) => t.school), info: styleInfo(work.data), ovrShown: hasOvrTable(work.data) };
    } catch (e) {
      return { problem: (e as Error).message };
    }
  }, [work]);
  const ok = ctx && 'names' in ctx ? ctx : null;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const styles = useMemo(() => (work && ok ? readStyles(work.data) : []), [work, ok, rev]);
  const loadedStyles = useMemo(() => (work && ok ? readStyles(work.base) : []), [work, ok]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ratings = useMemo(() => (work && ok ? Array.from({ length: TEAMS }, (_, t) => readRating(work.data, t)) : []), [work, ok, rev]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const weather = useMemo(() => (work && ok ? Array.from({ length: TEAMS }, (_, t) => readWeather(work.data, t)) : []), [work, ok, rev]);
  const loaded = useMemo(
    () => (work && ok ? Array.from({ length: TEAMS }, (_, t) => ({ r: readRating(work.base, t), w: readWeather(work.base, t) })) : []),
    [work, ok],
  );
  const isChanged = (t: number) =>
    styles[t].offense !== loadedStyles[t].offense ||
    styles[t].defense !== loadedStyles[t].defense ||
    ratings[t].off !== loaded[t].r.off ||
    ratings[t].def !== loaded[t].r.def ||
    weather[t].some((v, k) => v !== loaded[t].w[k]);
  const changed = ok ? Array.from({ length: TEAMS }, (_, t) => t).filter(isChanged) : [];
  const order = useMemo(
    () => (ok ? Array.from({ length: TEAMS }, (_, t) => t).sort((a, b) => ok.names[a].localeCompare(ok.names[b], 'en')) : []),
    [ok],
  );

  // College Football 27 matches for the ROM's teams, by school name.
  const matches = useMemo(() => (ok ? ok.names.map(findCfb27) : []), [ok]);
  const onRom = useMemo(() => (ok ? new Set(matches.flatMap((m) => (m ? [m.school] : []))) : null), [ok, matches]);
  const applyRecommended = () => {
    if (!work || !ok) return;
    let n = 0;
    try {
      matches.forEach((m, t) => {
        if (!m) return;
        const now = readStyle(work.data, t);
        if (now.offense === m.recommended.offense && now.defense === m.recommended.defense) return;
        writeStyle(work.data, t, m.recommended);
        n++;
      });
    } catch (e) {
      setNote({ kind: 'error', text: (e as Error).message });
      return;
    }
    const missing = ok.names.filter((_, t) => !matches[t]);
    setNote({
      kind: 'ok',
      text:
        (n ? `Applied the recommended styles: ${n} team${n === 1 ? '' : 's'} changed.` : 'Every team already has its recommended styles.') +
        (missing.length ? ` Not in College Football 27, so left as they were: ${missing.join(', ')}.` : ''),
    });
    if (n) api.edited();
  };

  const edit = (f: () => void) => {
    if (!work) return;
    try {
      f();
      setNote(null);
      api.edited();
    } catch (e) {
      setNote({ kind: 'error', text: (e as Error).message });
    }
  };
  const set = (t: number, st: TeamStyle) => edit(() => writeStyle(work!.data, t, st));
  const setRating = (t: number, r: TeamRating) => edit(() => writeRating(work!.data, t, r));
  const setWeather = (t: number, w: Weather) => edit(() => writeWeather(work!.data, t, w));
  const undo = (teams: number[]) => {
    if (!work) return;
    for (const t of teams) {
      restoreStyle(work.data, work.base, t);
      restoreTeam(work.data, work.base, t);
    }
    setNote(null);
    api.edited();
  };

  return (
    <>
      <section className="tool-head" aria-label="Teams">
        <h2>Teams</h2>
        <p>
          Set up each of Bill Walsh '95's 36 teams: the offense and defense the computer runs, the team's OFF and DEF
          ratings, and the weather in its home games.
        </p>
      </section>

      <WorkRomCard
        api={api}
        teamSwap={teamSwap}
        hint="Bill Walsh College Football '95: original, Elevated, a Team Swap result or an earlier edit. .md, .bin, .gen or .zip."
      />

      {work && ok ? (
        <div className="sty-layout">
          <section aria-label="Team settings">
            <div className="sty-apply">
              <button className="btn" onClick={applyRecommended} disabled={!onRom?.size}>
                Apply recommended styles
              </button>
              <p className="hint">
                Sets each team's styles from its College Football 27 playbooks ({onRom?.size ?? 0} of {TEAMS} teams on this
                ROM have one; see the table below). Undo puts back the styles the ROM was loaded with.
              </p>
            </div>
            <div className="sty-scroll">
            <table className="sty-table">
              <thead>
                <tr>
                  <th scope="col" rowSpan={2}>Team</th>
                  <th scope="col" rowSpan={2}>Offense</th>
                  <th scope="col" rowSpan={2}>Defense</th>
                  <th scope="col" rowSpan={2} title="Team OVR, offense">OFF</th>
                  <th scope="col" rowSpan={2} title="Team OVR, defense">DEF</th>
                  <th scope="colgroup" colSpan={4} className="rat-wx-head">
                    Home weather
                  </th>
                  <th scope="col" rowSpan={2} className="sty-undo-cell">
                    <span className="sr-only">Undo</span>
                  </th>
                </tr>
                <tr>
                  {WEATHER.map((n, i) => (
                    <th key={n} scope="col" className={`rat-sub${i === 0 ? ' rat-wx-first' : ''}`}>
                      {n}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {order.map((t) => (
                  <tr key={t} className={isChanged(t) ? 'sty-changed' : undefined}>
                    <th scope="row" className="sty-team">
                      {ok.names[t]}
                    </th>
                    <StylePicks mode="table" team={ok.names[t]} value={styles[t]} info={ok.info} onChange={(st) => set(t, st)} />
                    <RatingPicks
                      mode="table"
                      team={ok.names[t]}
                      rating={ratings[t]}
                      weather={weather[t]}
                      onRating={(r) => setRating(t, r)}
                      onWeather={(w) => setWeather(t, w)}
                    />
                    <td className="sty-undo-cell">
                      {isChanged(t) && (
                        <button className="sty-link" onClick={() => undo([t])} aria-label={`Undo the changes to ${ok.names[t]}`}>
                          Undo
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {changed.length > 1 && (
              <div className="sty-table-foot">
                <button className="sty-link" onClick={() => undo(changed)}>
                  Undo all team changes
                </button>
              </div>
            )}
          </section>
          <StyleLegend info={ok.info} ovrShown={ok.ovrShown} />
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

      <Cfb27Reference onRom={work && ok ? onRom : null} />

      {work && ok && (
        <footer className="dock">
          <p className="dock-count" aria-live="polite">
            {changed.length ? `${changed.length} team${changed.length === 1 ? '' : 's'} changed` : 'No team changes yet'}
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

function StyleLegend({ info, ovrShown }: { info: StyleInfo; ovrShown: boolean }) {
  return (
    <aside className="sty-legend" aria-label="What the settings do">
      <div>
      <h3>Offense</h3>
      <dl>
        {OFFENSE.map((n, i) => (
          <div key={n}>
            <dt>{n}</dt>
            <dd>{offenseFormations(i, info)}</dd>
          </div>
        ))}
      </dl>
      </div>
      <div>
      <h3>Defense</h3>
      <dl>
        {DEFENSE.map((n, i) => (
          <div key={n}>
            <dt>{n}</dt>
            <dd>{defensePlan(i, info)}</dd>
          </div>
        ))}
      </dl>
      </div>
      <div>
        <h3>Ratings and weather</h3>
        <p>
          <b>OFF and DEF</b> are team OVRs, 0-99. The season's simulated games (computer against computer) and the
          preseason poll use them.{' '}
          {ovrShown
            ? 'This ROM also shows them under each team on Game Setup.'
            : 'Elevated v1.1.0 and later also show them on Game Setup; this ROM keeps them as the original game does (a 0-100 rating), so only OVRs from 62 to 98 are stored exactly.'}
        </p>
        <p>
          <b>Home weather</b> is how often each kind of weather comes up in the team's home games in a season, as
          weights from 0 to 15 (the original teams' add up to 10). Exhibition games use the weather picked on Game
          Setup.
        </p>
      {info.elevated ? (
        <p className="hint">Every team uses the same roster layout on this ROM, so a new defense needs no roster changes.</p>
      ) : (
        <p className="hint">
          This ROM still has the original game's two roster layouts: slot 21 is a tackle on 4-3 teams and an inside
          linebacker on 3-4 teams. Switching a team between 3-4 and 4-3 switches its layout too, so re-import its roster
          to put the right player in slot 21. Elevated beta.7 and later use one layout for every team.
        </p>
      )}
      </div>
    </aside>
  );
}
