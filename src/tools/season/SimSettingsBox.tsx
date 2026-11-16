// The season sim's three settings (src/core/simSettings.ts), as a small form: the Toolkit's Season tab and the
// Dynasty app's offseason rules use it.

import { useEffect, useState } from 'react';
import { Button, Field, Select, SubHead } from '../../ui';
import { SIM_CHANCES, SIM_DEFAULTS, SIM_LIMITS, fitRoll, rollLimits, sameSim, simProblems, type SimSettings } from '../../core/simSettings';

export function SimSettingsBox({ value, loaded, onChange, disabled, intro, homeNote }: {
  value: SimSettings;
  /** What the ROM or dynasty had (the "changed" marks). */
  loaded: SimSettings;
  /** Called with valid settings only: a number when its field is left, a choice at once. */
  onChange: (s: SimSettings) => void;
  disabled?: boolean;
  intro?: string;
  /** A line added to the home edge's hint (the Dynasty app: which ROMs have it). */
  homeNote?: string;
}) {
  // Typed text, so a half-typed number doesn't snap back.
  const [weight, setWeight] = useState(String(value.weight));
  const [roll, setRoll] = useState(String(value.roll));
  const [home, setHome] = useState(String(value.home ?? ''));
  useEffect(() => { setWeight(String(value.weight)); setRoll(String(value.roll)); setHome(String(value.home ?? '')); }, [value.weight, value.roll, value.home]);

  const typed: SimSettings = { weight: Number(weight), chances: value.chances, roll: Number(roll), ...(value.home !== undefined ? { home: Number(home) } : {}) };
  const bad = simProblems(typed);
  const take = (s: SimSettings) => { if (!simProblems(s).length) onChange(s); };
  const [k0, k1] = SIM_LIMITS.weight;
  const [r0, r1] = rollLimits(value.chances);
  const [h0, h1] = SIM_LIMITS.home;

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
          onChange={(v) => take(fitRoll({ ...typed, roll: Number.isInteger(typed.roll) ? typed.roll : value.roll, chances: Number(v) as SimSettings['chances'] }))}
          note={`Chances each team gets to score. More: more points and fewer upsets; 9 gives very high scores. Changing it can move the roll range into its allowed range. Default ${SIM_DEFAULTS.chances}.`}
        />
        <Field
          label="Roll range" type="number" min={r0} max={r1} step={10} value={roll} disabled={disabled}
          changed={typed.roll !== loaded.roll} invalid={!Number.isInteger(typed.roll) || typed.roll < r0 || typed.roll > r1}
          onChange={setRoll} onBlur={() => { if (typed.roll !== value.roll) take(typed); }}
          note={`Lower: each chance scores more often, so more points; a low roll range gives very high scores. ${r0}-${r1} with ${value.chances} scoring chances (3: 700-1600, 5: 900-1600, 9: 1300-1600), default ${SIM_DEFAULTS.roll}.`}
        />
        {value.home !== undefined && (
          <Field
            label="Home edge" type="number" min={h0} max={h1} step={1} value={home} disabled={disabled}
            changed={typed.home !== (loaded.home ?? SIM_DEFAULTS.home)} invalid={!Number.isInteger(typed.home) || typed.home! < h0 || typed.home! > h1}
            onChange={setHome} onBlur={() => { if (typed.home !== value.home) take(typed); }}
            note={`Extra strength for the home team in regular-season games. ${SIM_DEFAULTS.home}: home teams win about 58%. 0 = none. ${h0}-${h1}, default ${SIM_DEFAULTS.home}${homeNote ? `. ${homeNote}` : ''}.`}
          />
        )}
      </div>
      {bad.length > 0 && <p className="sim-box-bad" role="alert">{bad[0]}</p>}
      {!sameSim(value, SIM_DEFAULTS) && (
        <Button variant="link" disabled={disabled} onClick={() => onChange(SIM_DEFAULTS)}>Reset to the defaults</Button>
      )}
    </section>
  );
}
