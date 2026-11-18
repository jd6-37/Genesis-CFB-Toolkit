// Players' headshots: the look a player has, drawn by portrait.ts (the 16-bit style; user, 2026-11-18). Skin tone
// (DPlayer.skin) and build by position come from the player; from his ID a hair style and color, facial hair,
// expression and eye black (the draws the earlier portraits used, so existing players keep their hair), and from a
// second draw of their own the newer parts: jaw and neck by position, eye color, earrings and a chain, and for
// players made since the new styles (DPlayer.lookV 2) a hair style from the full list. The user can change any
// part (DPlayer.look). The jersey is the team's main color with the collar in its second color.

import { rng, type DPlayer } from './model';
import { BEARD_STYLES, drawPortrait, HAIR_STYLES, hexRgb, jawNeckFor, MOUTHS, pickW, PORTRAIT_SIZE, type Age, type Beard, type Build, type HairStyle, type Jaw, type Mouth, type Neck, type PortraitLook } from './portrait';

export { BEARD_STYLES, HAIR_STYLES, MOUTHS };
export const HEAD_SIZE = PORTRAIT_SIZE;
export type HeadshotLook = PortraitLook;
export const drawHeadshot = drawPortrait;

/** Hair colors by index (saved looks store the index: never reorder, only add). */
const HAIR = ['#2b1d16', '#553522', '#86592f', '#c99c55', '#141218', '#7e3418', '#8e8a86'];
export const HAIR_COLOR_LABELS = ['Dark brown', 'Brown', 'Light brown', 'Blond', 'Black', 'Red', 'Gray'] as const;
/** Eye colors by index. */
const EYES = ['#3a2418', '#28180f', '#6e542c', '#4a6842', '#466c96', '#68768a'];
export const EYE_COLOR_LABELS = ['Brown', 'Dark brown', 'Hazel', 'Green', 'Blue', 'Gray'] as const;
/** The styles a player's ID picks from for players made before the new styles. Never add to or reorder this list. */
const GENERATED_STYLES = ['short', 'buzz', 'fade', 'curls', 'locs', 'flow', 'bald', 'twists', 'afro', 'mohawk'] as const;
/** Players made since (lookV 2): the full list, weighted by skin tone; mullet and man bun rare. */
const STYLES_LIGHT: [HairStyle, number][] = [['short', 16], ['buzz', 11], ['fade', 10], ['sidepart', 13], ['flow', 10], ['curls', 8], ['flattop', 4], ['mohawk', 2], ['bald', 3], ['mullet', 2], ['manbun', 2]];
const STYLES_DARK: [HairStyle, number][] = [['short', 7], ['buzz', 8], ['fade', 14], ['hightop', 5], ['flattop', 5], ['curls', 6], ['twists', 10], ['afro', 5], ['locs', 8], ['locsShort', 8], ['cornrows', 8], ['braids', 5], ['bald', 4], ['mohawk', 2], ['sidepart', 1]];
const BEARDS = ['none', 'none', 'stubble', 'none', 'goatee', 'beard', 'stubble'] as const;

export const HAIR_STYLE_LABELS: Record<HairStyle, string> = {
  short: 'Short', buzz: 'Buzz cut', fade: 'Fade', sidepart: 'Side part', flattop: 'Flat-top', hightop: 'High-top', curls: 'Curls', twists: 'Twists', afro: 'Afro',
  locs: 'Locs long', locsShort: 'Locs short', cornrows: 'Cornrows', braids: 'Braids', flow: 'Flow', mullet: 'Mullet', manbun: 'Man bun', mohawk: 'Mohawk', bald: 'Bald',
};
export const BEARD_LABELS: Record<Beard, string> = { none: 'None', stubble: 'Stubble', mustache: 'Mustache', goatee: 'Goatee', beard: 'Beard' };
export const MOUTH_LABELS: Record<Mouth, string> = { neutral: 'Neutral', smile: 'Smile', smirk: 'Smirk', serious: 'Serious', grin: 'Grin' };
export const AGES = ['young', 'middle', 'older'] as const;
export const AGE_LABELS: Record<Age, string> = { young: 'Young', middle: 'Middle-aged', older: 'Older' };
export const JAWS = ['narrow', 'medium', 'wide'] as const;
export const NECKS = ['thin', 'medium', 'thick'] as const;
export const SIZE_LABELS: Record<Jaw | Neck, string> = { narrow: 'Narrow', medium: 'Medium', wide: 'Wide', thin: 'Thin', thick: 'Thick' };

/** A player's stored changes to his generated look (`DPlayer.look`); anything left out stays generated. */
export interface LookEdit {
  hair?: HairStyle;
  /** Index into HAIR_COLOR_LABELS. */
  hairColor?: number;
  beard?: Beard;
  mouth?: Mouth;
  eyeBlack?: boolean;
  age?: Age;
  jaw?: Jaw;
  neck?: Neck;
  /** Index into EYE_COLOR_LABELS. */
  eyeColor?: number;
  earring?: boolean;
  chain?: boolean;
}

export const buildOf = (pos: string): Build =>
  ['LT', 'LG', 'C', 'RG', 'RT', 'LE', 'RE', 'DT'].includes(pos) ? 'wide' : ['HB', 'FB', 'TE', 'LOLB', 'MLB', 'ROLB'].includes(pos) ? 'medium' : 'slim';

/** An eye color for a skin tone from a 0-1 draw: blue, green and hazel mostly on the lighter tones, brown on all. */
export function eyeColorFor(skin: number, r: number): number {
  if (skin === 0) return pickW(r, [[0, 40], [2, 15], [3, 10], [4, 30], [5, 5]]);
  if (skin === 1) return pickW(r, [[0, 60], [1, 10], [2, 15], [3, 5], [4, 7], [5, 3]]);
  return pickW(r, [[0, 45], [1, 50], [2, 5]]);
}

/** The generated choices (what the editor shows before any change), with the player's changes on top. */
export function lookChoices(p: Pick<DPlayer, 'id' | 'skin' | 'pos' | 'cls' | 'look' | 'lookV'>): Required<LookEdit> {
  const r = rng((Math.imul(p.id, 0x9e3779b1) ^ 0x5bd1e995) >>> 0);
  const skin = Math.max(0, Math.min(3, p.skin));
  let hairColor = skin < 2 ? Math.floor(r() * 5) : [0, 0, 1, 4][Math.floor(r() * 4)];
  let hair: HairStyle = GENERATED_STYLES[Math.floor(r() * GENERATED_STYLES.length)];
  // Locs come long or short (user, 2026-11-13), half each, from a draw of its own so nothing else about a look moves.
  if (hair === 'locs' && rng((Math.imul(p.id, 0x85ebca6b) ^ 0x10c5) >>> 0)() < 0.5) hair = 'locsShort';
  // Younger players have less facial hair.
  let beard: Beard = BEARDS[Math.floor(r() * BEARDS.length)];
  if ((p.cls === 'FR' || p.cls === 'SO') && beard === 'beard' && r() < 0.6) beard = 'stubble';
  const mouth = MOUTHS[Math.floor(r() * MOUTHS.length)];
  const eyeBlack = r() < 0.05; // user, 2026-11-18: "eye black on 30% is way too much. Make it like 5%"
  // The newer parts, from a draw of their own (always the same number of draws, so each part stays put).
  const r2 = rng((Math.imul(p.id + 7, 0x27d4eb2f) ^ 0x165667b1) >>> 0);
  const d = Array.from({ length: 8 }, () => r2());
  const { jaw, neck } = jawNeckFor(p.pos, d[0], d[1]);
  if (p.lookV === 2) {
    hair = pickW(d[5], skin < 2 ? STYLES_LIGHT : STYLES_DARK);
    if (skin === 0 && d[6] < 0.05) hairColor = 5;
    if (beard === 'none' && d[7] < 0.06) beard = 'mustache';
  }
  const gen: Required<LookEdit> = {
    hair, hairColor, beard, mouth, eyeBlack, age: 'young', jaw, neck,
    eyeColor: eyeColorFor(skin, d[2]), earring: d[3] < 0.15, chain: d[4] < 0.08,
  };
  return { ...gen, ...(p.look ?? {}) };
}

/** A player's look for drawHeadshot. */
export function lookOf(p: Pick<DPlayer, 'id' | 'skin' | 'pos' | 'cls' | 'look' | 'lookV'>): HeadshotLook {
  const c = lookChoices(p);
  let hairColor = hexRgb(HAIR[c.hairColor] ?? HAIR[0]);
  if (c.age === 'older' && c.hairColor !== 6) hairColor = hairColor.map((v, i) => Math.round(v * 0.4 + hexRgb(HAIR[6])[i] * 0.6));
  return {
    skin: Math.max(0, Math.min(3, p.skin)), build: buildOf(p.pos), jaw: c.jaw, neck: c.neck, age: c.age,
    hair: c.hair, hairColor, beard: c.beard, mouth: c.mouth, eyeColor: hexRgb(EYES[c.eyeColor] ?? EYES[0]),
    acc: { eyeBlack: c.eyeBlack, earring: c.earring, chain: c.chain },
  };
}

/** Eye colors as RGB for coachLook.ts. */
export const eyeRgb = (i: number) => hexRgb(EYES[i] ?? EYES[0]);
