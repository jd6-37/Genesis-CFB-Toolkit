// Offense and defense style selects, shared by the Team Swap edit screen, the Teams tab and the
// Rosters tab.
import { DEFENSE, OFFENSE, defensePlan, offenseFormations, type StyleInfo, type TeamStyle } from '../../core/styles';
import { Select } from '../../ui';
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
  const pick = (k: 'offense' | 'defense', names: readonly string[], means: string) => (
    <Select
      label={mode === 'table' ? `${team} ${k} style` : k === 'offense' ? 'Offense' : 'Defense'}
      hideLabel={mode === 'table'} compact={mode !== 'full'}
      title={tip ? means : undefined} note={tip ? undefined : means}
      value={value[k]} onChange={(v) => onChange({ ...value, [k]: Number(v) })}
      options={names.map((n, i) => ({ value: i, label: `${n}${mark(k, i)}` }))}
    />
  );
  const off = pick('offense', OFFENSE, offenseFormations(value.offense, info));
  const def = pick('defense', DEFENSE, defensePlan(value.defense, info));
  if (mode === 'table') {
    return (
      <>
        <td className="sty-cell">{off}</td>
        <td className="sty-cell">{def}</td>
      </>
    );
  }
  return <div className={`sty-picks${mode === 'bar' ? ' sty-bar' : ''}`}>{off}{def}</div>;
}
