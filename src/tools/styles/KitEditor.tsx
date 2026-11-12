// Teams tab, 2026 Season Edition only: each team's alternate uniforms for the picker on the controller screen
// (src/core/kits.ts; project handoff H-004). A team's own home and away uniforms are always its first choices;
// this edits the extras and whether the team wears white at home.
import { useEffect, useMemo, useState } from 'react';
import { Swatch, UniformChip } from '../../components';
import {
  KIT_LIMITS, helmetOf, kitIssues, ownUniforms, readKits, shadesOf, withPiece, writeKits, type KitPart, type TeamKit,
} from '../../core/kits';
import { Button, Note, Row, Select, SubHead } from '../../ui';
import type { WorkApi } from '../shared/WorkRom';
import './kits.css';

const PARTS: { part: KitPart; title: string; one: string; colors: string[]; main: number }[] = [
  { part: 'helmets', title: 'Helmets', one: 'helmet', colors: ['Shell', 'Shadow', 'Stripe'], main: 0 },
  { part: 'dark', title: 'Dark jerseys', one: 'dark jersey', colors: ['Numbers and trim', 'Light', 'Jersey', 'Dark'], main: 2 },
  { part: 'white', title: 'White jerseys', one: 'white jersey', colors: ['Numbers and trim', 'Light', 'Jersey', 'Dark'], main: 2 },
  { part: 'pants', title: 'Pants', one: 'pants', colors: ['Side stripe', 'Light', 'Pants', 'Dark'], main: 2 },
];
const same = (a: TeamKit, b: TeamKit) => JSON.stringify(a) === JSON.stringify(b);

export function KitEditor({ api, names }: { api: WorkApi; names: string[] }) {
  const { work, rev } = api;
  const order = useMemo(() => names.map((_, t) => t).sort((a, b) => names[a].localeCompare(names[b], 'en')), [names]);
  const [team, setTeam] = useState(order[0] ?? 0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setError(null), [work, team]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const kits = useMemo(() => (work ? readKits(work.data) : []), [work, rev]);
  const loaded = useMemo(() => (work ? readKits(work.base) : []), [work]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const own = useMemo(() => (work ? ownUniforms(work.data, team) : null), [work, rev, team]);
  if (!work || !own || !kits[team]) return null;
  const kit = kits[team];
  const changed = kits.flatMap((k, t) => (same(k, loaded[t]) ? [] : [t]));

  const save = (next: TeamKit[]) => {
    const issues = kitIssues(next, names);
    if (issues.length) return setError(issues[0]);
    try {
      writeKits(work.data, next);
      setError(null);
      api.edited();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const put = (k: TeamKit) => save(kits.map((x, t) => (t === team ? k : x)));
  const base = (part: KitPart) => (part === 'white' ? own.away : own.home);
  const add = (part: KitPart) => {
    // A new piece starts as a copy of the team's own, so one color pick makes it different.
    const from = base(part);
    const colors = part === 'helmets' ? [from[5], from[6], from[7]] : part === 'pants' ? [from[3], from[13], from[14], from[15]] : [from[9], from[10], from[11], from[12]];
    put({ ...kit, [part]: [...kit[part], colors] });
  };
  const pick = (part: KitPart, i: number, place: number, c: number, main: number) => {
    const now = kit[part][i];
    // The main color brings its two shades along; every other color is set on its own.
    const colors = place !== main ? now.map((x, k) => (k === place ? c : x)) : part === 'helmets' ? helmetOf(c, now[2]) : shadesOf(c, now[0]);
    put({ ...kit, [part]: kit[part].map((x, k) => (k === i ? colors : x)) });
  };
  const full = (part: KitPart) =>
    part === 'helmets' ? kit.helmets.length >= KIT_LIMITS.helmets
      : part === 'pants' ? kit.pants.length >= KIT_LIMITS.pants
        : kit.dark.length + kit.white.length >= KIT_LIMITS.jerseys;

  return (
    <section className="kit" aria-label="Alternate uniforms">
      <SubHead>Alternate uniforms</SubHead>
      <p className="kit-lead">
        Extra helmets, jerseys and pants a team can pick on the controller screen (Y on a 6-button pad). A team's own
        home and away uniforms are always its first choices and are not listed here.
      </p>
      <Row>
        <Select label="Team" value={team} options={order.map((t) => ({ value: t, label: changed.includes(t) ? `${names[t]} (changed)` : names[t] }))} onChange={(v) => setTeam(Number(v))} />
        <Select
          label="Home jersey"
          value={kit.whiteHome ? 'white' : 'dark'}
          options={[{ value: 'dark', label: 'Dark at home' }, { value: 'white', label: 'White at home' }]}
          onChange={(v) => put({ ...kit, whiteHome: v === 'white' })}
        />
      </Row>
      {error && <Note kind="error">{error}</Note>}

      {PARTS.map(({ part, title, one, colors, main }) => (
        <div className="kit-part" key={part}>
          <h4>{title}</h4>
          {kit[part].length === 0 && <p className="kit-none">No extra {part === 'pants' ? 'pants' : `${one}s`}.</p>}
          <ul>
            {kit[part].map((c, i) => (
              <li key={i}>
                <UniformChip u={withPiece(base(part), part, c)} label={`${names[team]}: extra ${one} ${i + 1}`} />
                <dl>
                  {colors.map((label, place) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd><Swatch color={c[place]} label={`${title} ${i + 1}, ${label.toLowerCase()}`} onPick={(x) => pick(part, i, place, x, main)} /></dd>
                    </div>
                  ))}
                </dl>
                <Button variant="quiet" onClick={() => put({ ...kit, [part]: kit[part].filter((_, k) => k !== i) })}>Remove</Button>
              </li>
            ))}
          </ul>
          <Button variant="quiet" onClick={() => add(part)} disabled={full(part)}>Add {part === 'pants' ? 'pants' : `a ${one}`}</Button>
        </div>
      ))}
      <p className="kit-lead">
        Picking a {`helmet's shell, a jersey's or the pants'`} main color also sets its lighter and darker shades; change those after it if you
        want. At most {KIT_LIMITS.helmets} extra helmets, {KIT_LIMITS.pants} extra pants and {KIT_LIMITS.jerseys} extra jerseys (dark and white together) per team.
      </p>
      <Row>
        <Button variant="quiet" onClick={() => put(loaded[team])} disabled={same(kit, loaded[team])}>Undo {names[team]}</Button>
        <Button variant="quiet" onClick={() => save(loaded)} disabled={!changed.length}>Undo all uniform changes</Button>
      </Row>
    </section>
  );
}
