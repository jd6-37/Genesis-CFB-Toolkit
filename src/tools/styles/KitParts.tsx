// One team's extra helmets, jerseys and pants (src/core/kits.ts), shared by the Toolkit's Teams tab (KitEditor) and the
// Dynasty app's team page: a chip of each piece on the team's own uniform, its colors, Remove, and Add buttons.
import { Swatch, UniformChip } from '../../components';
import { KIT_LIMITS, helmetOf, shadesOf, withPiece, type KitPart, type TeamKit } from '../../core/kits';
import { Button } from '../../ui';
import './kits.css';

const PARTS: { part: KitPart; title: string; one: string; colors: string[]; main: number }[] = [
  { part: 'helmets', title: 'Helmets', one: 'helmet', colors: ['Shell', 'Shadow', 'Stripe'], main: 0 },
  { part: 'dark', title: 'Dark jerseys', one: 'dark jersey', colors: ['Numbers and trim', 'Light', 'Jersey', 'Dark'], main: 2 },
  { part: 'white', title: 'White jerseys', one: 'white jersey', colors: ['Numbers and trim', 'Light', 'Jersey', 'Dark'], main: 2 },
  { part: 'pants', title: 'Pants', one: 'pants', colors: ['Side stripe', 'Light', 'Pants', 'Dark'], main: 2 },
];

export function KitParts({ kit, own, name, put }: { kit: TeamKit; own: { home: number[]; away: number[] }; name: string; put: (k: TeamKit) => void }) {
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
    <>
      {PARTS.map(({ part, title, one, colors, main }) => (
        <div className="kit-part" key={part}>
          <h4>{title}</h4>
          {kit[part].length === 0 && <p className="kit-none">No extra {part === 'pants' ? 'pants' : `${one}s`}.</p>}
          <ul>
            {kit[part].map((c, i) => (
              <li key={i}>
                <UniformChip u={withPiece(base(part), part, c)} label={`${name}: extra ${one} ${i + 1}`} />
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
    </>
  );
}
