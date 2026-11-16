// The season sim's three settings (src/core/simSettings.ts), as a small form: the Toolkit's Season tab and the
// Dynasty app's offseason rules use it.

import { useEffect, useState } from 'react';
import { Button, Field, Select, SubHead } from '../../ui';
import { SIM_CHANCES, SIM_DEFAULTS, SIM_LIMITS, sameSim, simProblems, type SimSettings } from '../../core/simSettings';

export function SimSettingsBox({ value, loaded, onChange, disabled, intro }: {
  value: SimSettings;
  /** What the ROM or dynasty had (the "changed" marks). */
  loaded: SimSettings;
  /** Called with valid settings only: a number when its field is left, a choice at once. */
  onChange: (s: SimSettings) => void;
  disabled?: boolean;
  intro?: string;
}) {
  // Typed text, so a half-typed number doesn't snap back.
  const [weight, setWeight] = useState(String(value.weight));
  const [roll, setRoll] = useState(String(value.roll));
  useEffect(() => { setWeight(String(value.weight)); setRoll(String(value.roll)); }, [value.weight, value.roll]);

  const typed: SimSettings = { weight: Number(weight), chances: value.chances, roll: Number(roll) };
  const bad = simProblems(typed);
  const take = (s: SimSettings) => { if (!simProblems(s).length) onChange(s); };
  const [k0, k1] = SIM_LIMITS.weight;
  const [r0, r1] = SIM_LIMITS.roll;

  return (
    <section className="sim-box" aria-labelledby="sim-box-head">
      <SubHead id="sim-box-head">Season sim</SubHead>
      <p className="sim-box-intro">
        {intro ?? 'How the game decides the games you don\'t play in a season (CPU vs CPU). Each setting changes scoring and upsets together.'}
      </p>
      <div className="sim-box-fields">
        <Field
          label="Rating weight" type="number" min={k0} max={k1} step={1} value={weight} disabled={disabled}
          changed={typed.weight !== loaded.weight} invalid={!Number.isInteger(typed.weight) || typed.weight < k0 || typed.weight > k1}
          onChange={setWeight} onBlur={() => { if (typed.weight !== value.weight) take(typed); }}
          note={`How much the better team's ratings count. Higher: favorites win more often. ${k0}-${k1}, default ${SIM_DEFAULTS.weight}.`}
        />
        <Select
          label="Scoring chances" value={value.chances} disabled={disabled} changed={value.chances !== loaded.chances}
          options={SIM_CHANCES.map((n) => ({ value: n, label: `${n} a quarter` }))}
          onChange={(v) => take({ ...typed, chances: Number(v) as SimSettings['chances'] })}
          note={`Chances each team gets to score. More: more points and fewer upsets. Default ${SIM_DEFAULTS.chances}.`}
        />
        <Field
          label="Roll range" type="number" min={r0} max={r1} step={10} value={roll} disabled={disabled}
          changed={typed.roll !== loaded.roll} invalid={!Number.isInteger(typed.roll) || typed.roll < r0 || typed.roll > r1}
          onChange={setRoll} onBlur={() => { if (typed.roll !== value.roll) take(typed); }}
          note={`Lower: each chance scores more often, so more points. ${r0}-${r1}, default ${SIM_DEFAULTS.roll}.`}
        />
      </div>
      {bad.length > 0 && <p className="sim-box-bad" role="alert">{bad[0]}</p>}
      {!sameSim(value, SIM_DEFAULTS) && (
        <Button variant="link" disabled={disabled} onClick={() => onChange(SIM_DEFAULTS)}>Reset to the defaults</Button>
      )}
    </section>
  );
}
