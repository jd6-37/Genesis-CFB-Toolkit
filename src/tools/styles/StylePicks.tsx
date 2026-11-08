// Offense and defense style selects, shared by the Team Swap edit screen, the Styles tab and the
// Rosters tab.
import { DEFENSE, OFFENSE, defensePlan, offenseFormations, type StyleInfo, type TeamStyle } from '../../core/styles';
import './teamstyles.css';

export function StylePicks({
  value,
  info,
  onChange,
  team,
  was,
  wasName,
  mode = 'full',
}: {
  value: TeamStyle;
  info: StyleInfo;
  onChange: (st: TeamStyle) => void;
  /** Team name for the selects' accessible labels. */
  team: string;
  /** The style to mark in the lists (e.g. the slot's original team's). */
  was?: TeamStyle;
  wasName?: string;
  /** full: labels and what the style calls; bar: inline labels; table: selects only. The
   *  shorter modes show what the style calls as a tooltip. */
  mode?: 'full' | 'bar' | 'table';
}) {
  const mark = (k: 'offense' | 'defense', i: number) => (was && wasName && was[k] === i ? ` (${wasName})` : '');
  const tip = mode !== 'full';
  const off = (
    <select
      aria-label={`${team} offense style`}
      title={tip ? offenseFormations(value.offense, info) : undefined}
      value={value.offense}
      onChange={(e) => onChange({ ...value, offense: Number(e.target.value) })}
    >
      {OFFENSE.map((n, i) => (
        <option key={n} value={i}>
          {n}
          {mark('offense', i)}
        </option>
      ))}
    </select>
  );
  const def = (
    <select
      aria-label={`${team} defense style`}
      title={tip ? defensePlan(value.defense, info) : undefined}
      value={value.defense}
      onChange={(e) => onChange({ ...value, defense: Number(e.target.value) })}
    >
      {DEFENSE.map((n, i) => (
        <option key={n} value={i}>
          {n}
          {mark('defense', i)}
        </option>
      ))}
    </select>
  );
  if (mode === 'table') {
    return (
      <>
        <td className="sty-cell">{off}</td>
        <td className="sty-cell">{def}</td>
      </>
    );
  }
  if (mode === 'bar') {
    return (
      <span className="sty-picks sty-bar">
        <label>
          <span>Offense</span>
          {off}
        </label>
        <label>
          <span>Defense</span>
          {def}
        </label>
      </span>
    );
  }
  return (
    <div className="sty-picks">
      <label className="sty-field">
        <span>Offense</span>
        {off}
        <small>{offenseFormations(value.offense, info)}</small>
      </label>
      <label className="sty-field">
        <span>Defense</span>
        {def}
        <small>{defensePlan(value.defense, info)}</small>
      </label>
    </div>
  );
}
