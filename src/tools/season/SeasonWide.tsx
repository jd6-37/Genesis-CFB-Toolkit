// Season tab for the 138-team 2026 Season Edition and the 107-team 1994 Season Edition: conference names and members, when
// each conference plays its conference games in a random season, and (2026 test31 / 1994 test33 on) its title game switches
// (src/core/seasonWide.ts). The Dynasty app's Conferences step uses it too, for both editions (rules, tags, hint and footer
// from the dynasty's edition).
import { Check, Field, Note, Select, SubHead } from '../../ui';
import { useMemo, useState, type ReactNode } from 'react';
import {
  CONFS, INDEPENDENT, MAX_CONF_TEAMS, NAME_CHARS, NAME_LEN, POWER4, RULES_2026, SEC_EAST_1994, TG_ON, TG_SEC94, confSizes, playedGames,
  roundRobin, wideSeasonIssues, type ConfRules, type WideSeason,
} from '../../core/seasonWide';
import { EDITIONS } from '../../core/dynasty/edition';
import { BOWL_TIES_1994 } from '../../core/dynasty/conferences';
import './season.css';

/** The 2026 edition's tag of each conference card. */
const TAG_2026 = (c: number) => (c < POWER4 ? 'Power 4' : c < INDEPENDENT ? 'Group of 6' : 'Independents');

/** The 1994 edition's: the bowl its champion goes to. */
export const TAG_1994 = (c: number) => (c < INDEPENDENT ? `Champion: ${BOWL_TIES_1994[c]}` : 'Independents');

/** The 1994 edition's hint: the bowls follow the list's order. */
export const HINT_1994 = (
  <>
    The bowls take each conference's champion by its place in this list, whatever its name: the first goes to the Sugar
    Bowl, the second and sixth to the Rose Bowl, and so on (under each name). Independents play no conference games.
  </>
);

/** The defaults of each edition (the Toolkit's Season tab; the Dynasty step passes its own). */
const EDITION_PROPS = {
  '2026': { rules: RULES_2026, tag: TAG_2026, hint: undefined, footer: undefined },
  '1994': {
    rules: EDITIONS['1994'].confRules,
    tag: TAG_1994,
    hint: HINT_1994,
    footer: (
      <>
        Conference games and weeks apply to Random schedules (Game Setup, New Season). The Real 1994 schedule keeps its
        games; there the conferences decide the standings, the title games and the bowls. Changes take effect in a new season.
        Once a team changes conference, Game Setup's Schedule starts on Random and the real schedule is listed as "Real old" (v2.1.1 on).
      </>
    ),
  },
} as const;

export function SeasonWide({
  teams,
  season,
  loaded,
  onChange,
  edition = '2026',
  rules = EDITION_PROPS[edition].rules,
  tag = EDITION_PROPS[edition].tag,
  hint = EDITION_PROPS[edition].hint,
  footer = EDITION_PROPS[edition].footer,
  disabled = false,
}: {
  teams: string[];
  season: WideSeason;
  loaded: WideSeason;
  onChange: (s: WideSeason) => void;
  /** Which edition's rules, tags, hint and footer are the defaults. */
  edition?: '2026' | '1994';
  /** The engine's weeks and title games (default: the 2026 edition's). */
  rules?: ConfRules;
  /** The tag under conference c's name. */
  tag?: (c: number) => string;
  hint?: ReactNode;
  footer?: ReactNode;
  disabled?: boolean;
}) {
  const REG_WEEKS = rules.weeks;
  const [moved, setMoved] = useState<string | null>(null);
  const sizes = confSizes(season);
  const byConf = useMemo(
    () =>
      Array.from({ length: CONFS }, (_, c) =>
        teams.map((n, t) => ({ n, t })).filter(({ t }) => season.conf[t] === c).sort((a, b) => a.n.localeCompare(b.n, 'en')),
      ),
    [teams, season.conf],
  );
  const label = (c: number) => season.names[c].trim() || `Conference ${c + 1}`;
  const issues = wideSeasonIssues(season, rules);
  const edit = (f: (s: WideSeason) => void) => {
    const s: WideSeason = { ...season, names: [...season.names], conf: [...season.conf], start: [...season.start], games: [...season.games], ...(season.titleGames ? { titleGames: [...season.titleGames] } : {}) };
    f(s);
    onChange(s);
  };
  const move = (t: number, c: number) => {
    edit((s) => (s.conf[t] = c));
    setMoved(`${teams[t]} moved to ${label(c)}.`);
  };

  return (
    <section className="sea-sec" aria-labelledby="sea-confs-h">
      <div className="sea-head">
        <SubHead id="sea-confs-h">Conferences</SubHead>
        <p className="hint">
          {hint ?? (
            season.titleGames ? (
              <>
                The first {POWER4} conferences are the Power 4 (their champions get automatic playoff bids), the next six the
                Group of 6. Each conference takes up to {MAX_CONF_TEAMS} teams. Independents play no conference games.
              </>
            ) : (
              <>
                The first {POWER4} conferences are the Power 4 (their champions get automatic playoff bids), the next six the
                Group of 6. Each of the ten plays a title game between its top two, so it needs 2 to {MAX_CONF_TEAMS} teams.
                Independents play no conference games.
              </>
            )
          )}{' '}
          {season.titleGames && (
            <>
              A conference with a <b>Title game</b> plays one the week after the regular season, its leader at home against the
              next team, and needs at least 2 teams; without one, its standings leader is the champion. With <b>1994 SEC
              divisions</b> the leader plays the best team of the other division (East: {SEC_EAST_1994.join(', ')}; West: the
              conference's other teams).{' '}
            </>
          )}
          Names can have up to {NAME_LEN} characters: {NAME_CHARS}.
        </p>
      </div>
      {moved && (
        <Note kind="ok">
          {moved}
        </Note>
      )}
      {issues.length > 0 && (
        <Note kind="error" block>
          {issues.map((i) => (
            <p key={i}>{i}</p>
          ))}
        </Note>
      )}
      <div className="sea-confs">
        {byConf.map((list, c) => {
          const changed =
            season.names[c] !== loaded.names[c] ||
            season.conf.some((x, t) => (x === c) !== (loaded.conf[t] === c)) ||
            (c < INDEPENDENT && (season.start[c] !== loaded.start[c] || season.games[c] !== loaded.games[c])) ||
            (!!season.titleGames && season.titleGames[c] !== loaded.titleGames?.[c]);
          const max = c < INDEPENDENT ? Math.min(roundRobin(sizes[c]), MAX_CONF_TEAMS, REG_WEEKS - season.start[c]) : 0;
          return (
            <div className={`sea-conf${changed ? ' sea-conf-changed' : ''}`} key={c}>
              <div className="sea-name">
                <Field
                  label={`Name of conference ${c + 1}`} hideLabel value={season.names[c]} maxLength={NAME_LEN} invalid={!season.names[c].trim()}
                  disabled={disabled} onChange={(v) => edit((s) => (s.names[c] = v))}
                  note={<>{tag(c)} · {sizes[c]} team{sizes[c] === 1 ? '' : 's'} · {season.names[c].length}/{NAME_LEN}</>}
                />
              </div>
              {c < INDEPENDENT && season.titleGames && (
                <div className="sea-tgames">
                  <Check
                    checked={(season.titleGames[c] & TG_ON) !== 0} disabled={disabled}
                    onChange={(on) => edit((s) => (s.titleGames![c] = on ? s.titleGames![c] | TG_ON : 0))}
                  >
                    Title game
                  </Check>
                  <Check
                    checked={(season.titleGames[c] & TG_SEC94) !== 0} disabled={disabled || (season.titleGames[c] & TG_ON) === 0}
                    onChange={(on) => edit((s) => (s.titleGames![c] = on ? s.titleGames![c] | TG_SEC94 : s.titleGames![c] & ~TG_SEC94))}
                  >
                    1994 SEC divisions
                  </Check>
                </div>
              )}
              {c < INDEPENDENT && (
                <div className="sea-cweeks">
                  <Select
                    label="Conference games" compact disabled={disabled} value={season.games[c]} onChange={(v) => edit((s) => (s.games[c] = +v))}
                    options={Array.from({ length: Math.max(max, season.games[c]) + 1 }, (_, n) => ({ value: n, label: String(n) }))}
                  />
                  <Select
                    label="From week" compact disabled={disabled} value={season.start[c]} onChange={(v) => edit((s) => (s.start[c] = +v))}
                    options={Array.from({ length: REG_WEEKS }, (_, w) => ({ value: w, label: String(w + 1) }))}
                  />
                  {playedGames(season, c, REG_WEEKS) < season.games[c] && (
                    <small>
                      {sizes[c]} teams play at most {playedGames(season, c, REG_WEEKS)}.
                    </small>
                  )}
                </div>
              )}
              <ul>
                {list.map(({ n, t }) => (
                  <li key={t}>
                    <span className={`sea-team-name${loaded.conf[t] !== c ? ' on' : ''}`}>{n}</span>
                    <Select
                      label={`Move ${n} to another conference`} hideLabel compact disabled={disabled} value="" placeholder="Move"
                      options={season.names.map((_, k) => ({ value: k, label: label(k) })).filter((o) => o.value !== c)}
                      onChange={(v) => move(t, +v)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="sea-random">
        {footer ?? (
          <>
            Conference games and weeks apply to Random schedules (Game Setup, New Season). The Real 2026 schedule keeps its
            games; there the conferences decide the standings and the title games. Changes take effect in a new season.
            Once a team changes conference, Game Setup's Schedule starts on Random and the real schedule is listed as "Real old" (v2.1.1 on).
          </>
        )}
      </p>
    </section>
  );
}
