// 16-bit style headshots for the player pages (user, 2026-11-12: shaded, no outline, "a little more
// detailed", plain darker gray background, the team's recorded colors). Drawn by code on a 40 × 40 grid from
// the player alone, so a player always looks the same: skin tone (DPlayer.skin), build by position (wide
// necks and shoulders for linemen, medium for HB, FB, TE and LB, slim for the rest), and from his ID a hair
// style and color, facial hair, expression and eye black. The jersey is the team's main color with the
// collar in its second color. Pure function: an RGBA image.

import { rng, type DPlayer } from './model';

export const HEAD_SIZE = 40;
type RGB = [number, number, number];

const SKIN: [RGB, RGB, RGB, RGB][] = [ // base, shade, highlight, deep (SKIN_TONES in appearance.ts: Light, Tan, Brown, Dark)
  [[241, 198, 162], [214, 163, 128], [252, 222, 196], [190, 140, 108]],
  [[207, 152, 112], [178, 122, 86], [228, 180, 142], [152, 100, 68]],
  [[146, 100, 72], [116, 76, 54], [172, 126, 96], [94, 60, 42]],
  [[92, 64, 46], [68, 46, 34], [118, 86, 64], [52, 36, 26]],
];
const HAIR: RGB[] = [[30, 24, 20], [74, 48, 30], [126, 84, 46], [208, 172, 104], [18, 18, 24]];
/** The styles a player's ID picks from. Never add to or reorder this list: every generated look would change. */
const GENERATED_STYLES = ['short', 'buzz', 'fade', 'curls', 'locs', 'flow', 'bald', 'twists', 'afro', 'mohawk'] as const;
/** Every style, in the editor's order. 'locs' is the long version (it keeps its name for saved looks). */
export const HAIR_STYLES = ['short', 'buzz', 'fade', 'curls', 'locs', 'locsShort', 'flow', 'bald', 'twists', 'afro', 'mohawk'] as const;
const BEARDS = ['none', 'none', 'stubble', 'none', 'goatee', 'beard', 'stubble'] as const;
export const MOUTHS = ['neutral', 'smile', 'smirk', 'serious', 'grin'] as const;

/** Choices for the appearance editor (user, 2026-11-12: editable any time; nothing of it goes into the ROM). */
export const HAIR_STYLE_LABELS: Record<(typeof HAIR_STYLES)[number], string> = {
  short: 'Short', buzz: 'Buzz cut', fade: 'Fade', curls: 'Curls', locs: 'Locs long', locsShort: 'Locs short', flow: 'Flow', bald: 'Bald', twists: 'Twists', afro: 'Afro', mohawk: 'Mohawk',
};
export const HAIR_COLOR_LABELS = ['Dark brown', 'Brown', 'Light brown', 'Blond', 'Black'] as const;
export const BEARD_STYLES = ['none', 'stubble', 'goatee', 'beard'] as const;
export const BEARD_LABELS: Record<(typeof BEARD_STYLES)[number], string> = { none: 'None', stubble: 'Stubble', goatee: 'Goatee', beard: 'Beard' };
export const MOUTH_LABELS: Record<(typeof MOUTHS)[number], string> = { neutral: 'Neutral', smile: 'Smile', smirk: 'Smirk', serious: 'Serious', grin: 'Grin' };

/** A player's stored changes to his generated look (`DPlayer.look`); anything left out stays generated. */
export interface LookEdit {
  hair?: (typeof HAIR_STYLES)[number];
  /** Index into HAIR_COLOR_LABELS. */
  hairColor?: number;
  beard?: (typeof BEARD_STYLES)[number];
  mouth?: (typeof MOUTHS)[number];
  eyeBlack?: boolean;
}

/** Head half-width, neck half-width, shoulder half-width (grid cells). */
const BUILD = { slim: [7.0, 3, 13], medium: [7.6, 4.5, 16], wide: [8.4, 6.2, 19.5] } as const;
export const buildOf = (pos: string): keyof typeof BUILD =>
  ['LT', 'LG', 'C', 'RG', 'RT', 'LE', 'RE', 'DT'].includes(pos) ? 'wide' : ['HB', 'FB', 'TE', 'LOLB', 'MLB', 'ROLB'].includes(pos) ? 'medium' : 'slim';

const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const sh = (c: RGB, k: number): RGB => c.map((v) => Math.max(0, Math.min(255, Math.round(v * k)))) as RGB;
const mix = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t)) as RGB;
const WHITE: RGB = [255, 255, 255];

export interface HeadshotLook {
  skin: number; build: keyof typeof BUILD; hair: (typeof HAIR_STYLES)[number]; hairColor: RGB;
  beard: (typeof BEARDS)[number]; mouth: (typeof MOUTHS)[number]; eyeBlack: boolean;
}

/** A player's look: skin and build from the player, the rest from his ID (the same every time). */
export function lookOf(p: Pick<DPlayer, 'id' | 'skin' | 'pos' | 'cls' | 'look'>): HeadshotLook {
  const r = rng((Math.imul(p.id, 0x9e3779b1) ^ 0x5bd1e995) >>> 0);
  const skin = Math.max(0, Math.min(3, p.skin));
  const hairColor = skin < 2 ? HAIR[Math.floor(r() * HAIR.length)] : [HAIR[0], HAIR[0], HAIR[1], HAIR[4]][Math.floor(r() * 4)];
  let hair: (typeof HAIR_STYLES)[number] = GENERATED_STYLES[Math.floor(r() * GENERATED_STYLES.length)];
  // Locs come long or short (user, 2026-11-13), half each, from a draw of its own so nothing else about a look moves.
  if (hair === 'locs' && rng((Math.imul(p.id, 0x85ebca6b) ^ 0x10c5) >>> 0)() < 0.5) hair = 'locsShort';
  // Younger players have less facial hair.
  let beard = BEARDS[Math.floor(r() * BEARDS.length)];
  if ((p.cls === 'FR' || p.cls === 'SO') && beard === 'beard' && r() < 0.6) beard = 'stubble';
  const gen: HeadshotLook = { skin, build: buildOf(p.pos), hair, hairColor, beard, mouth: MOUTHS[Math.floor(r() * MOUTHS.length)], eyeBlack: r() < 0.3 };
  const e = p.look;
  if (!e) return gen;
  return {
    ...gen,
    ...(e.hair && { hair: e.hair }),
    ...(e.hairColor !== undefined && HAIR[e.hairColor] && { hairColor: HAIR[e.hairColor] }),
    ...(e.beard && { beard: e.beard }),
    ...(e.mouth && { mouth: e.mouth }),
    ...(e.eyeBlack !== undefined && { eyeBlack: e.eyeBlack }),
  };
}

/** The generated look's choices as editor values (what the menus show before any change). */
export function lookChoices(p: Pick<DPlayer, 'id' | 'skin' | 'pos' | 'cls' | 'look'>): Required<LookEdit> {
  const l = lookOf(p);
  const color = HAIR.findIndex((c) => c === l.hairColor);
  return { hair: l.hair, hairColor: Math.max(0, color), beard: l.beard, mouth: l.mouth, eyeBlack: l.eyeBlack };
}

/** The headshot as RGBA (HEAD_SIZE × HEAD_SIZE): team colors as CSS hex (#rrggbb). */
export function drawHeadshot(look: HeadshotLook, jersey: string, trim: string): Uint8ClampedArray<ArrayBuffer> {
  const S = HEAD_SIZE;
  const px = new Map<number, RGB>();
  const put = (x: number, y: number, c: RGB) => { if (x >= 0 && x < S && y >= 0 && y < S) px.set(y * S + x, c); };
  const get = (x: number, y: number) => px.get(y * S + x);
  const [base, shade, hi, deep] = SKIN[look.skin];
  const hair = look.hairColor, hdark = sh(hair, 0.7), hhi = mix(hair, WHITE, 0.28);
  const jc = hex(jersey), tc = hex(trim);
  const [hw, nw, sw] = BUILD[look.build];
  const cx = 19.5;

  // Shoulders and jersey: lit pad tops, the right side in shade.
  const top = 30;
  for (let y = top; y < S; y++) {
    const k = y - top;
    const half = k < 3 ? Math.min(sw, sw - 6 + k * 2.2) : sw + Math.min(2, (k - 3) * 0.5);
    for (let x = 0; x < S; x++) {
      const d = Math.abs(x + 0.5 - cx);
      if (d > half) continue;
      let c = jc;
      if (x + 0.5 > cx + half - 3) c = sh(jc, 0.8);
      else if (x + 0.5 < cx - half + 2) c = mix(jc, WHITE, 0.1);
      if (k === 0 || (k === 1 && d > half - 2)) c = mix(jc, WHITE, 0.2);
      if (k >= 2 && d > half - 1) c = sh(c, 0.85); // pad edge
      put(x, y, c);
    }
  }
  // Collar: a V neck in the trim color.
  for (let i = 0; i < 5; i++) {
    for (const side of [-1, 1]) {
      const x = Math.floor(cx + side * (nw + 1 - i * 0.8));
      put(x, top + i, tc);
      put(x + (side < 0 ? 1 : -1), top + i, sh(tc, 0.85));
    }
  }
  // Long hair falls behind the head onto the shoulders (user: "go down behind the head too, not just on
  // the sides"): drawn before the neck and head, which then cover its middle.
  if (look.hair === 'flow' || look.hair === 'locs') {
    for (let y = 8; y < 33; y++) {
      const w = y <= 21 ? hw + 1.6 : hw + 1.6 + (y - 21) * 0.3;
      for (let x = 0; x < S; x++) {
        const d = Math.abs(x + 0.5 - cx);
        if (d > w || y > 29 + ((x * 5) % 4)) continue; // a ragged bottom edge
        let c: RGB;
        if (look.hair === 'locs') c = x % 2 ? hdark : (y + x) % 5 === 0 ? hhi : hair;
        else c = x + 0.5 > cx + w - 2.5 ? hdark : x + 0.5 < cx - w + 1.5 && y % 4 === 1 ? hhi : hair;
        put(x, y, c);
      }
    }
  }
  // Neck.
  for (let y = 24; y < top + 4; y++) {
    const lim = y < top ? nw : nw - (y - top);
    for (let x = 0; x < S; x++) {
      if (Math.abs(x + 0.5 - cx) > lim) continue;
      let c = y < 27 ? shade : base;
      if (x + 0.5 > cx + lim - 1.5) c = y < 27 ? deep : shade;
      put(x, y, c);
    }
  }
  // Head: a profile of half-widths by row.
  const prof = new Map<number, number>();
  for (let y = 6; y < 28; y++) {
    const t = y - 6;
    const w = t < 4 ? hw - (4 - t) * 1.1 + (t === 3 ? 0.4 : 0) : y <= 21 ? hw : hw - (y - 21) * (look.build === 'wide' ? 0.75 : 0.95);
    prof.set(y, w);
    for (let x = 0; x < S; x++) {
      const d = Math.abs(x + 0.5 - cx);
      if (d > w) continue;
      let c = base;
      if (x + 0.5 > cx + w - 1.6) c = shade;
      if (x + 0.5 < cx - w + 1.2 && y > 9 && y < 21) c = hi;
      if (y >= 25) c = d > w - 2 ? shade : base;
      put(x, y, c);
    }
  }
  // Ears right against the head's widest columns (the user saw a detached ear in the mockup).
  const headL = Math.ceil(cx - hw - 0.5), headR = Math.floor(cx + hw - 0.5);
  const L = headL - 1, R = headR + 1;
  for (let y = 15; y < 21; y++) { put(L, y, y === 15 || y === 20 ? shade : y === 17 || y === 18 ? shade : base); put(R, y, shade); }
  put(L, 17, deep); put(R, 17, deep);
  for (const x of [15, 16, 17]) put(x, 10, hi);
  put(16, 9, hi);
  // Eyes looking straight ahead: white, pupil, white, mirrored about the face's center line (x 19.5).
  const EY = 17;
  for (const ex of [15, 22]) {
    put(ex, EY, [248, 248, 248]); put(ex + 1, EY, [26, 22, 26]); put(ex + 2, EY, [248, 248, 248]);
    for (let x = ex; x < ex + 3; x++) { put(x, EY - 1, deep); put(x, EY + 1, shade); }
  }
  const brow = look.hair === 'bald' ? deep : hdark;
  if (look.mouth === 'serious') for (const [x, y] of [[14, 14], [15, 15], [16, 15], [17, 15], [25, 14], [24, 15], [23, 15], [22, 15]]) put(x, y, brow);
  else { for (const x of [14, 15, 16, 17, 22, 23, 24, 25]) put(x, 14, brow); put(17, 15, brow); put(22, 15, brow); }
  // Nose.
  put(20, 18, shade); put(20, 19, shade); put(19, 19, hi); put(18, 20, deep); put(21, 20, deep); put(19, 21, shade); put(20, 21, shade);
  if (look.eyeBlack) for (const x of [14, 15, 16, 17, 22, 23, 24, 25]) put(x, 19, [22, 22, 26]);
  // Mouth.
  const lip = mix(deep, [150, 60, 60], 0.25), lip2 = mix(shade, [170, 90, 90], 0.2), teeth: RGB = [246, 244, 236];
  const MY = 23;
  const mouthPx = new Set<number>();
  const m = (x: number, y: number, c: RGB) => { put(x, y, c); mouthPx.add(y * S + x); };
  if (look.mouth === 'smile') { for (const [x, y] of [[16, MY - 1], [17, MY], [18, MY], [19, MY], [20, MY], [21, MY], [22, MY], [23, MY - 1]]) m(x, y, lip); for (let x = 18; x < 22; x++) m(x, MY + 1, lip2); }
  else if (look.mouth === 'grin') { m(16, MY - 1, lip); m(23, MY - 1, lip); for (let x = 17; x < 23; x++) { m(x, MY - 1, teeth); m(x, MY, lip); } for (let x = 18; x < 22; x++) m(x, MY + 1, lip2); }
  else if (look.mouth === 'smirk') { for (const [x, y] of [[17, MY], [18, MY], [19, MY], [20, MY], [21, MY], [22, MY - 1]]) m(x, y, lip); for (let x = 18; x < 21; x++) m(x, MY + 1, lip2); }
  else { for (let x = 17; x < 23; x++) m(x, MY, lip); for (let x = 18; x < 22; x++) m(x, MY + 1, lip2); }
  // Facial hair.
  if (look.beard === 'stubble') {
    for (let y = 20; y < 27; y++) {
      const w = prof.get(y) ?? 0;
      for (let x = 0; x < S; x++) {
        const d = Math.abs(x + 0.5 - cx), c = get(x, y);
        if (c && d <= w && (x + y) % 2 === 0 && (y >= 24 || d > w - 2.5) && !mouthPx.has(y * S + x)) put(x, y, mix(c, hair, 0.45));
      }
    }
  } else if (look.beard === 'goatee') {
    for (const [x, y] of [[18, 25], [19, 25], [20, 25], [21, 25], [19, 26], [20, 26], [17, 22], [18, 22], [21, 22], [22, 22]]) put(x, y, hair);
  } else if (look.beard === 'beard') {
    for (let y = 18; y < 28; y++) {
      const w = prof.get(y) ?? 0;
      for (let x = 0; x < S; x++) {
        const d = Math.abs(x + 0.5 - cx);
        if (d <= w && (y >= 24 || d > w - 2) && !mouthPx.has(y * S + x)) put(x, y, x + 0.5 > cx + w - 1.5 ? hdark : hair);
      }
    }
    for (let x = 17; x < 23; x++) put(x, MY, lip);
  }
  // Hair: a cap over the head's top (rounded above the head too), then each style's own shape.
  const widthAt = (y: number) => prof.get(y) ?? Math.max(1, hw - 1.2 - (6 - y) * 1.0);
  const cap = (y0: number, y1: number, grow: number) => {
    for (let y = y0; y < y1; y++) {
      const w = (y < 9 ? Math.max(widthAt(y), hw - 1.5 - Math.max(0, 6 - y) * 1.1) : widthAt(y)) + grow;
      for (let x = 0; x < S; x++) {
        if (Math.abs(x + 0.5 - cx) > w) continue;
        let c = hair;
        if (x + 0.5 > cx + w - 2) c = hdark;
        if (y === y0 + 1 && x + 0.5 > cx - w + 2 && x + 0.5 < cx - 1) c = hhi;
        put(x, y, c);
      }
    }
  };
  switch (look.hair) {
    case 'short':
      cap(4, 11, 0.6);
      for (const y of [11, 12]) { put(headL, y, hair); put(headR, y, hdark); }
      for (const [x, y] of [[15, 5], [15, 6], [16, 7]]) put(x, y, hhi); // a side part
      break;
    case 'buzz':
      for (let y = 6; y < 11; y++) {
        const w = widthAt(y);
        for (let x = 0; x < S; x++) if (Math.abs(x + 0.5 - cx) <= w) put(x, y, mix(base, hair, (x + y) % 2 ? 0.75 : 0.55));
      }
      break;
    case 'fade':
      cap(4, 9, 0.3);
      for (let y = 9; y < 14; y++) { put(headL, y, mix(base, hair, 0.5)); put(headR, y, mix(shade, hair, 0.5)); }
      break;
    case 'curls': case 'afro': {
      const [rx, ry, cy] = look.hair === 'curls' ? [10.5, 7.5, 9] : [12.5, 9.5, 9.5];
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < S; x++) {
          if (((x + 0.5 - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1 || (y >= 11 && Math.abs(x + 0.5 - cx) < hw - 0.5)) continue;
          // Clumps of curls: 2 × 2 cells, each with a lit corner, darker toward the right.
          const clump = ((x >> 1) + (y >> 1) * 3) % 3;
          const lit = x % 2 === 0 && y % 2 === 0;
          put(x, y, x + 0.5 > cx + rx - 3 ? hdark : lit && clump !== 2 ? hhi : clump === 2 ? hdark : hair);
        }
      }
      break;
    }
    case 'locs': case 'locsShort': // the same strands beside the face; the long version also falls behind the head (above)
      cap(4, 10, 1.0);
      for (const x of [headL - 1, headL, headR, headR + 1]) for (let y = 10; y < 24 + (x % 2) * 2; y++) put(x, y, y % 3 ? hair : hhi);
      break;
    case 'flow':
      cap(4, 11, 1.2);
      for (let y = 11; y < 28; y++) {
        put(headL - 1, y, hair); put(headR + 1, y, hdark);
        if (y < 15) { put(headL, y, hair); put(headR, y, hdark); }
      }
      break;
    case 'twists':
      cap(5, 10, 0.6);
      // Short twists: two-pixel clumps standing up across the top, lit on the left.
      for (let x = headL; x <= headR; x += 2) {
        const h = 3 + ((x * 7) % 3);
        for (let y = 6 - h; y < 7; y++) { put(x, y, y === 6 - h ? hhi : hair); put(x + 1, y, hdark); }
      }
      break;
    case 'mohawk':
      for (let y = 1; y < 10; y++) for (const x of [18, 19, 20, 21]) put(x, y, x === 18 ? hhi : x === 21 ? hdark : hair);
      for (const y of [7, 8, 9]) { const w = widthAt(y); for (let x = 0; x < S; x++) if (Math.abs(x + 0.5 - cx) <= w && (x < 18 || x > 21)) put(x, y, mix(base, hair, 0.3)); }
      break;
    case 'bald':
      break;
  }

  // Background: a darker gray, a touch lighter at the top.
  const out = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++) {
    const bg = mix([164, 167, 173], [138, 141, 148], y / S);
    for (let x = 0; x < S; x++) {
      const c = px.get(y * S + x) ?? bg;
      out.set([c[0], c[1], c[2], 255], (y * S + x) * 4);
    }
  }
  return out;
}
