// Team OVR (offense, defense) and home weather fields, shared by the Team Swap edit screen and the
// Teams tab. Engine: src/core/teamRatings.ts.
import { useEffect, useState } from 'react';
import { WEATHER, weatherChances, type TeamRating, type Weather } from '../../core/teamRatings';
import { Field } from '../../ui';
import './teamstyles.css';

/** A number field that accepts what's typed and reports whole numbers within [min, max]. */
function NumberField({ value, min, max, label, hideLabel, onChange }: {
  value: number;
  min: number;
  max: number;
  label: string;
  hideLabel?: boolean;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <Field
      label={label} hideLabel={hideLabel} compact type="number" min={min} max={max} step={1} value={text}
      onChange={(t) => {
        setText(t);
        const v = Number(t);
        if (t.trim() !== '' && Number.isInteger(v) && v >= min && v <= max) onChange(v);
      }}
      onBlur={() => setText(String(value))}
    />
  );
}

const chanceText = (w: Weather) => {
  const c = weatherChances(w);
  return WEATHER.map((n, i) => (c[i] ? `${n} ${c[i]}%` : '')).filter(Boolean).join(', ');
};

export function RatingPicks({
  team,
  rating,
  weather,
  onRating,
  onWeather,
  mode = 'full',
  was,
  source,
}: {
  team: string;
  rating: TeamRating;
  weather: Weather;
  onRating: (r: TeamRating) => void;
  onWeather: (w: Weather) => void;
  /** full: labeled fields with hints (Team Swap); table: three table cells (Teams tab). */
  mode?: 'full' | 'table';
  /** The slot's original team and its values, for the hint. */
  was?: { name: string; rating: TeamRating; weather: Weather };
  /** Where the starting values came from, for the hint (e.g. "College Football USA 97"). */
  source?: string;
}) {
  const table = mode === 'table';
  const ovr = (k: 'off' | 'def') => (
    <NumberField
      value={rating[k]} min={0} max={99} hideLabel={table}
      label={table ? `${team} ${k === 'off' ? 'offense' : 'defense'} OVR` : k === 'off' ? 'OFF' : 'DEF'}
      onChange={(v) => onRating({ ...rating, [k]: v })}
    />
  );
  const wx = (i: number) => (
    <NumberField
      value={weather[i]} min={0} max={15} hideLabel={table}
      label={table ? `${team} home weather, ${WEATHER[i]} weight` : WEATHER[i]}
      onChange={(v) => onWeather(weather.map((x, k) => (k === i ? v : x)) as Weather)}
    />
  );
  if (table) {
    const tip = chanceText(weather);
    return (
      <>
        <td className="rat-cell">{ovr('off')}</td>
        <td className="rat-cell">{ovr('def')}</td>
        {WEATHER.map((n, i) => (
          <td key={n} className={`rat-cell rat-wcell${i === 0 ? ' rat-wx-first' : ''}`} title={tip}>{wx(i)}</td>
        ))}
      </>
    );
  }
  return (
    <div className="rat-picks">
      <div className="rat-field">
        <span className="rat-head">Team OVR</span>
        <span className="rat-pair">{ovr('off')}{ovr('def')}</span>
        <small>
          {source ? `From ${source}. ` : ''}
          {was ? `${was.name} had ${was.rating.off}/${was.rating.def}. ` : ''}
          Simulated games and the preseason poll use these.
        </small>
      </div>
      <div className="rat-field">
        <span className="rat-head">Home weather</span>
        <span className="rat-wx" title={chanceText(weather)}>{WEATHER.map((n, i) => <span key={n}>{wx(i)}</span>)}</span>
        <small>
          Chances in home games: {chanceText(weather)}.{was ? ` ${was.name}: ${chanceText(was.weather)}.` : ''}
        </small>
      </div>
    </div>
  );
}
