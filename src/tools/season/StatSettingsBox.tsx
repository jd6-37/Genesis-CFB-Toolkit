// The sim stat multipliers (src/core/simStats.ts, H-021) as a small form: the Toolkit's Season tab and the Dynasty
// app's offseason rules use it, under the season sim settings.

import { useEffect, useState } from 'react';
import { Button, Field, SubHead } from '../../ui';
import { STATS_DEFAULTS, STAT_KEYS, STAT_LABELS, STAT_LIMITS, STAT_SCALES, STAT_STEP, sameStats, statsProblems, type SimStats, type StatKey } from '../../core/simStats';

export function StatSettingsBox({ value, loaded, onChange, disabled, intro }: {
  value: SimStats;
  /** What the ROM or dynasty had (the "changed" marks). */
  loaded: SimStats;
  /** Called with valid settings only: a number when its field is left. */
  onChange: (s: SimStats) => void;
  disabled?: boolean;
  intro?: string;
}) {
  // Typed text, so a half-typed number doesn't snap back.
  const [typed, setTyped] = useState<Record<StatKey, string>>(() => Object.fromEntries(STAT_KEYS.map((k) => [k, String(value[k])])) as Record<StatKey, string>);
  useEffect(() => { setTyped(Object.fromEntries(STAT_KEYS.map((k) => [k, String(value[k])])) as Record<StatKey, string>); }, [value]);

  const asStats: SimStats = { ...value, ...Object.fromEntries(STAT_KEYS.map((k) => [k, Number(typed[k])])) };
  const bad = statsProblems(asStats);
  const take = (s: SimStats) => { if (!statsProblems(s).length) onChange(s); };
  const [lo, hi] = STAT_LIMITS;
  const badKey = (k: StatKey) => { const n = Number(typed[k]); return !Number.isInteger(n) || n < lo || n > hi || n % STAT_STEP !== 0; };

  return (
    <section className="sim-box" aria-labelledby="stat-box-head">
      <SubHead id="stat-box-head">Sim stats</SubHead>
      <p className="sim-box-intro">
        {intro ?? 'Scales the players\' stats in the games you don\'t play (CPU vs CPU). 100% is the game\'s own numbers. Longer Game Length settings already give simulated games more plays, so if you play long games you may want to raise them all. Touchdowns are never scaled.'}
      </p>
      <div className="sim-box-fields">
        {STAT_KEYS.map((k) => (
          <Field
            key={k} label={`${STAT_LABELS[k]} %`} type="number" min={lo} max={hi} step={STAT_STEP} value={typed[k]} disabled={disabled}
            changed={asStats[k] !== loaded[k]} invalid={badKey(k)}
            onChange={(v) => setTyped({ ...typed, [k]: v })}
            onBlur={() => { if (asStats[k] !== value[k]) take(asStats); }}
            note={`Scales ${STAT_SCALES[k]}. ${lo}-${hi}, default ${STATS_DEFAULTS[k]}.`}
          />
        ))}
      </div>
      {bad.length > 0 && <p className="sim-box-bad" role="alert">{bad[0]}</p>}
      {!sameStats(value, STATS_DEFAULTS) && (
        <Button variant="link" disabled={disabled} onClick={() => onChange(STATS_DEFAULTS)}>Reset to the defaults</Button>
      )}
    </section>
  );
}
