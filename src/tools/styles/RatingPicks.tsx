// Team OVR (offense, defense) and home weather fields, shared by the Team Swap edit screen and the
// Teams tab. Engine: src/core/teamRatings.ts.
import { useEffect, useState } from 'react';
import { WEATHER, weatherChances, type TeamRating, type Weather } from '../../core/teamRatings';
import './teamstyles.css';

/** A number input that accepts what's typed and reports whole numbers within [min, max]. */
function NumberField({
  value,
  min,
  max,
  label,
  onChange,
  className,
}: {
  value: number;
  min: number;
  max: number;
  label: string;
  onChange: (v: number) => void;
  className?: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <input
      className={className}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      step={1}
      aria-label={label}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const v = Number(e.target.value);
        if (e.target.value.trim() !== '' && Number.isInteger(v) && v >= min && v <= max) onChange(v);
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
  const off = (
    <NumberField className="rat-num" value={rating.off} min={0} max={99} label={`${team} offense OVR`} onChange={(v) => onRating({ ...rating, off: v })} />
  );
  const def = (
    <NumberField className="rat-num" value={rating.def} min={0} max={99} label={`${team} defense OVR`} onChange={(v) => onRating({ ...rating, def: v })} />
  );
  const wx = (
    <span className="rat-wx" title={chanceText(weather)}>
      {WEATHER.map((n, i) => (
        <label key={n}>
          <span>{n}</span>
          <NumberField
            className="rat-num rat-wnum"
            value={weather[i]}
            min={0}
            max={15}
            label={`${team} home weather, ${n} weight`}
            onChange={(v) => onWeather(weather.map((x, k) => (k === i ? v : x)) as Weather)}
          />
        </label>
      ))}
    </span>
  );
  if (mode === 'table') {
    const tip = chanceText(weather);
    return (
      <>
        <td className="sty-cell rat-cell">{off}</td>
        <td className="sty-cell rat-cell">{def}</td>
        {WEATHER.map((n, i) => (
          <td key={n} className={`sty-cell rat-cell${i === 0 ? ' rat-wx-first' : ''}`} title={tip}>
            <NumberField
              className="rat-num rat-wnum"
              value={weather[i]}
              min={0}
              max={15}
              label={`${team} home weather, ${n} weight`}
              onChange={(v) => onWeather(weather.map((x, k) => (k === i ? v : x)) as Weather)}
            />
          </td>
        ))}
      </>
    );
  }
  return (
    <div className="rat-picks">
      <div className="rat-field">
        <span className="rat-head">Team OVR</span>
        <span className="rat-pair">
          <label>
            <span>OFF</span>
            {off}
          </label>
          <label>
            <span>DEF</span>
            {def}
          </label>
        </span>
        <small>
          {source ? `From ${source}. ` : ''}
          {was ? `${was.name} had ${was.rating.off}/${was.rating.def}. ` : ''}
          Simulated games and the preseason poll use these.
        </small>
      </div>
      <div className="rat-field">
        <span className="rat-head">Home weather</span>
        {wx}
        <small>
          Chances in home games: {chanceText(weather)}.{was ? ` ${was.name}: ${chanceText(was.weather)}.` : ''}
        </small>
      </div>
    </div>
  );
}
