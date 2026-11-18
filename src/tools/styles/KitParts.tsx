// One team's uniform pieces (src/core/kits.ts), shared by the Toolkit's Teams tab (KitEditor) and the Dynasty app's
// team page. User, 2026-11-18: "It should show all uniform parts", so the team's own helmets, jerseys and pants come
// first (editable: they are its home and away uniforms), then the extras for the picker on the controller screen.
// Each piece shows the game's player sprite in that piece's colors with the rest grayed out ("can you just show the
// game sprite like we do in the pre-game uniform selection menu? Gray out and fade the other parts"); the main color
// is the one big choice, the shades follow it and stay editable but less prominent ("make it very evident that all i
// have to do is modify the 'jersey' color").
import { useMemo, useState } from 'react';
import { SpriteCanvas, Swatch, UniformChip } from '../../components';
import { KIT_LIMITS, helmetOf, partPalette, shadesOf, withPiece, type KitPart, type KitSprite, type OwnUniforms, type TeamKit } from '../../core/kits';
import { renderSprites } from '../../core/render';
import { toCss } from '../../core/colors';
import { Button, Modal } from '../../ui';
import './kits.css';

interface PartDef {
  part: KitPart; title: string; one: string; main: string;
  /** Places in the piece's colors: the main color, its shades (follow the main color), the accent. */
  mainAt: number; shadeAt: number[]; accentAt: number; accent: string;
}
const PARTS: PartDef[] = [
  { part: 'helmets', title: 'Helmets', one: 'helmet', main: 'Helmet color', mainAt: 0, shadeAt: [1], accentAt: 2, accent: 'Stripe' },
  { part: 'dark', title: 'Dark jerseys', one: 'dark jersey', main: 'Jersey color', mainAt: 2, shadeAt: [1, 3], accentAt: 0, accent: 'Numbers and sleeve stripes' },
  { part: 'white', title: 'White jerseys', one: 'white jersey', main: 'Jersey color', mainAt: 2, shadeAt: [1, 3], accentAt: 0, accent: 'Numbers and sleeve stripes' },
  { part: 'pants', title: 'Pants', one: 'pants', main: 'Pants color', mainAt: 2, shadeAt: [1, 3], accentAt: 0, accent: 'Side and hem stripes' },
];
const PLACES: Record<KitPart, number[]> = { helmets: [5, 6, 7], dark: [9, 10, 11, 12], white: [9, 10, 11, 12], pants: [3, 13, 14, 15] };
const pieceOf = (pal: number[], part: KitPart) => PLACES[part].map((i) => pal[i]);
const same = (a: number[], b: number[]) => a.every((x, i) => x === b[i]);

/**
 * One piece: its sprite, the main color, the accent, the shades. A team's own piece is locked (user, 2026-11-18:
 * "put a lock icon on them. If the user tries to edit them, open a modal warning ... The user must explicitly accept
 * that warning to proceed ... that should pop up anytime they try to edit one of these"): every color pick on it
 * asks first, and the picker opens once it's accepted.
 */
function Piece({ title, def, colors, base, sprite, onChange, onRemove, locked }: {
  title: string; def: PartDef; colors: number[]; base: number[]; sprite: KitSprite | null; onChange: (c: number[]) => void; onRemove?: () => void;
  /** The warning for a team's own piece; absent for extras. */
  locked?: { team: string; side: string };
}) {
  const [ask, setAsk] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const pal = withPiece(base, def.part, colors);
  const pic = useMemo(() => (sprite ? renderSprites(sprite.tiles, partPalette(pal, def.part), [sprite.sprites]) : null), [sprite, pal.join(), def.part]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (place: number, c: number) => {
    setOpen(null);
    // The main color brings its shades along; every other color is set on its own.
    if (place !== def.mainAt) return onChange(colors.map((x, k) => (k === place ? c : x)));
    onChange(def.part === 'helmets' ? helmetOf(c, colors[2]) : shadesOf(c, colors[0]));
  };
  const sw = (place: number, label: string) =>
    locked && open !== place
      ? <button type="button" className="swatch" style={{ background: toCss(colors[place]) }} aria-label={`${label}: locked, the team's own uniform. Change color`} onClick={() => setAsk(place)} />
      : <Swatch key={`${place}${open === place}`} color={colors[place]} label={label} onPick={(c) => pick(place, c)} startOpen={open === place} />;
  return (
    <li className="kit-piece">
      <div className="kit-sprite">{pic ? <SpriteCanvas pic={pic} scale={3} label={title} /> : <UniformChip u={pal} label={title} />}</div>
      <div className="kit-colors">
        <h5>{locked && <LockIcon />}{title}</h5>
        <label className="kit-main">{sw(def.mainAt, `${title}: ${def.main.toLowerCase()}`)}<span>{def.main}</span></label>
        <label className="kit-accent">{sw(def.accentAt, `${title}: ${def.accent.toLowerCase()}`)}<span>{def.accent}</span></label>
        <div className="kit-shades">
          {def.shadeAt.map((at, k) => <span key={at}>{sw(at, `${title}: ${def.shadeAt.length > 1 ? (k === 0 ? 'light shade' : 'dark shade') : 'shade'}`)}</span>)}
          <span>Shading, set from the {def.main.toLowerCase()}</span>
        </div>
        {onRemove && <Button variant="quiet" onClick={onRemove}>Remove</Button>}
      </div>
      {locked && ask !== null && (
        <Modal
          title={`Change ${locked.team}'s ${locked.side} uniform?`}
          onClose={() => setAsk(null)}
          actions={<>
            <Button onClick={() => { setOpen(ask); setAsk(null); }}>Change it anyway</Button>
            <Button variant="quiet" onClick={() => setAsk(null)}>Cancel</Button>
          </>}
        >
          <p>This is {locked.team}'s own {locked.side} uniform, the one the game uses everywhere, not an extra for the uniform picker.</p>
          <p>Changing it also changes what the game colors from it: the <b>end zones</b> and the <b>crowd in the stands</b> take their colors from the home uniform. To give the team a different look without that, add an extra piece instead.</p>
        </Modal>
      )}
    </li>
  );
}

function LockIcon() {
  return (
    <svg className="kit-lock" viewBox="0 0 16 16" width="14" height="14" role="img" aria-label="Locked">
      <path fill="currentColor" d="M4 7V5a4 4 0 0 1 8 0v2h1v8H3V7zm2 0h4V5a2 2 0 0 0-4 0z" />
    </svg>
  );
}

export function KitParts({ kit, own, sprite, name, put, putOwn }: {
  kit: TeamKit; own: OwnUniforms; sprite: KitSprite | null; name: string; put: (k: TeamKit) => void; putOwn: (o: OwnUniforms) => void;
}) {
  const setOwn = (pal: 'home' | 'away' | 'both', part: KitPart, colors: number[]) => {
    const next = { home: own.home.slice(), away: own.away.slice() };
    for (const side of pal === 'both' ? (['home', 'away'] as const) : [pal]) PLACES[part].forEach((p, i) => { next[side][p] = colors[i]; });
    putOwn(next);
  };
  // The team's own pieces: helmets and pants once when home and away share them, else both; jerseys: the home
  // uniform's (dark) and the away uniform's (white).
  const ownPieces = (part: KitPart): { title: string; colors: number[]; base: number[]; side: 'home' | 'away' | 'both' }[] => {
    const h = pieceOf(own.home, part), a = pieceOf(own.away, part);
    if (part === 'dark') return [{ title: `${name}'s home jersey`, colors: h, base: own.home, side: 'home' }];
    if (part === 'white') return [{ title: `${name}'s away jersey`, colors: a, base: own.away, side: 'away' }];
    const what = part === 'helmets' ? 'helmet' : 'pants';
    return same(h, a)
      ? [{ title: `${name}'s ${what}`, colors: h, base: own.home, side: 'both' }]
      : [{ title: `${name}'s home ${what}`, colors: h, base: own.home, side: 'home' }, { title: `${name}'s away ${what}`, colors: a, base: own.away, side: 'away' }];
  };
  const add = (part: KitPart) => {
    // A new piece starts as a copy of the team's own, so one color pick makes it different.
    put({ ...kit, [part]: [...kit[part], pieceOf(part === 'white' ? own.away : own.home, part)] });
  };
  const full = (part: KitPart) =>
    part === 'helmets' ? kit.helmets.length >= KIT_LIMITS.helmets
      : part === 'pants' ? kit.pants.length >= KIT_LIMITS.pants
        : kit.dark.length + kit.white.length >= KIT_LIMITS.jerseys;

  return (
    <>
      {PARTS.map((def) => (
        <div className="kit-part" key={def.part}>
          <h4>{def.title}</h4>
          <ul>
            {ownPieces(def.part).map((o) => (
              <Piece key={o.title} title={o.title} def={def} colors={o.colors} base={o.base} sprite={sprite} onChange={(c) => setOwn(o.side, def.part, c)} locked={{ team: name, side: o.side === 'away' ? 'away' : o.side === 'home' ? 'home' : 'home and away' }} />
            ))}
            {kit[def.part].map((c, i) => (
              <Piece
                key={i} title={`Extra ${def.one} ${i + 1}`} def={def} colors={c} base={def.part === 'white' ? own.away : own.home} sprite={sprite}
                onChange={(x) => put({ ...kit, [def.part]: kit[def.part].map((y, k) => (k === i ? x : y)) })}
                onRemove={() => put({ ...kit, [def.part]: kit[def.part].filter((_, k) => k !== i) })}
              />
            ))}
          </ul>
          <Button variant="quiet" onClick={() => add(def.part)} disabled={full(def.part)}>Add {def.part === 'pants' ? 'pants' : `a ${def.one}`}</Button>
        </div>
      ))}
      <p className="kit-lead">
        Locked pieces are the team's own home and away uniforms: changing one asks first, since the game also takes the end zone
        and crowd colors from them. Extras are picked on the controller screen (Y on a 6-button pad).
        At most {KIT_LIMITS.helmets} extra helmets, {KIT_LIMITS.pants} extra pants and {KIT_LIMITS.jerseys} extra jerseys (dark and white together) per team.
      </p>
    </>
  );
}
