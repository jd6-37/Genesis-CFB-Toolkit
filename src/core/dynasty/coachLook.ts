// Coaches' headshots (spec: "new headshot options: visors, caps, glasses, gray hair"; mockups: "Coach headshot
// options"): the players' 16-bit portrait (headshot.ts) with a coach's headwear in his team's colors, glasses, an
// older face's lines, and hair that grays, whitens and thins with age. Generated from the coach's id and age (the
// same every time); the user can change any part (DCoach.look).
import { rng } from './model';
import type { DCoach } from './coaches';
import { eyeColorFor, eyeRgb, type HeadshotLook } from './headshot';
import { hexRgb, jawNeckFor } from './portrait';

export const COACH_HATS = ['none', 'visor', 'cap'] as const;
export const COACH_HAT_LABELS: Record<(typeof COACH_HATS)[number], string> = { none: 'None', visor: 'Visor', cap: 'Cap' };
export const COACH_GLASSES = ['none', 'square', 'round'] as const;
export const COACH_GLASSES_LABELS: Record<(typeof COACH_GLASSES)[number], string> = { none: 'None', square: 'Square', round: 'Round' };
export const COACH_HAIR = ['short', 'buzz', 'fade', 'thinning', 'bald', 'curls', 'sidepart', 'flattop'] as const;
export const COACH_HAIR_LABELS: Record<(typeof COACH_HAIR)[number], string> = { short: 'Short', buzz: 'Buzz', fade: 'Fade', thinning: 'Thinning', bald: 'Bald', curls: 'Curls', sidepart: 'Side part', flattop: 'Flat-top' };
/** Dark, brown, salt and pepper, gray, white. */
const COACH_HAIR_COLORS = ['#241a15', '#553522', '#6a6662', '#8e8a86', '#c4c2be'];
export const COACH_HAIR_COLOR_LABELS = ['Dark', 'Brown', 'Salt and pepper', 'Gray', 'White'] as const;
export const SKIN_LABELS = ['Light', 'Tan', 'Brown', 'Dark'] as const;

/** A coach's stored changes to his generated look. */
export interface CoachLookEdit {
  hat?: (typeof COACH_HATS)[number];
  glasses?: (typeof COACH_GLASSES)[number];
  hair?: (typeof COACH_HAIR)[number];
  hairColor?: number;
  skin?: number;
  beard?: 'none' | 'stubble' | 'mustache' | 'goatee' | 'beard';
  /** Young (under 45), middle-aged (45-59) or older (60 and up) by his age; the user can change it. */
  age?: 'young' | 'middle' | 'older';
}
export const COACH_AGES = ['young', 'middle', 'older'] as const;
export const COACH_BEARDS = ['none', 'stubble', 'mustache', 'goatee', 'beard'] as const;

/** The generated choices: from his id, and his age for the hair color, thinning and lines. */
export function coachLookChoices(c: Pick<DCoach, 'id' | 'born' | 'look'>, year: number): Required<CoachLookEdit> {
  const r = rng((Math.imul(c.id + 1, 0x2c1b3c6d) ^ 0x7f4a7c15) >>> 0);
  const age = year - c.born;
  const skin = [0, 0, 0, 1, 1, 1, 2, 3][Math.floor(r() * 8)];
  const hat = COACH_HATS[Math.floor(r() * 3)];
  const glasses = r() < 0.15 + Math.max(0, age - 45) * 0.012 ? (r() < 0.6 ? 'square' : 'round') : 'none';
  // Hair color by age: dark or brown when young, salt and pepper in the 50s, gray, then white from about 65.
  const t = (age - 42) / 8 + (r() - 0.5);
  const hairColor = t < 0 ? (r() < 0.5 ? 0 : 1) : t < 1.2 ? 2 : t < 2.6 ? 3 : 4;
  const thin = r() < Math.max(0, (age - 40) * 0.025);
  const hair: (typeof COACH_HAIR)[number] = r() < 0.08 ? 'bald' : thin ? 'thinning' : (['short', 'short', 'buzz', 'fade', 'curls'] as const)[Math.floor(r() * 5)];
  let beard: Required<CoachLookEdit>['beard'] = r() < 0.12 ? 'stubble' : r() < 0.06 ? 'goatee' : 'none';
  if (beard === 'none' && rng((Math.imul(c.id + 3, 0x165667b1) ^ 0x27d4eb2f) >>> 0)() < 0.08) beard = 'mustache';
  const ageLook = age < 45 ? 'young' : age < 60 ? 'middle' : 'older'; // user, 2026-11-18
  const gen: Required<CoachLookEdit> = { hat, glasses, hair, hairColor, skin, beard, age: ageLook };
  return { ...gen, ...(c.look ?? {}) };
}

/** The headshot look for drawHeadshot (headshot.ts); hat colors are the team's (or gray without a team). */
export function coachLook(c: Pick<DCoach, 'id' | 'born' | 'look'>, year: number, colors: [string, string] | null): HeadshotLook {
  const ch = coachLookChoices(c, year);
  const age = year - c.born;
  const r = rng((Math.imul(c.id + 11, 0x7feb352d) ^ 0x846ca68b) >>> 0);
  const { jaw, neck } = jawNeckFor('QB', r(), r());
  return {
    skin: ch.skin, build: 'medium', jaw, neck, age: ch.age,
    hair: ch.hair === 'thinning' ? 'short' : ch.hair, thinning: ch.hair === 'thinning',
    hairColor: hexRgb(COACH_HAIR_COLORS[ch.hairColor] ?? COACH_HAIR_COLORS[0]),
    beard: ch.beard, mouth: age >= 60 ? 'serious' : (['neutral', 'smile', 'serious'] as const)[c.id % 3], eyeColor: eyeRgb(eyeColorFor(ch.skin, r())),
    hat: ch.hat, hatColors: colors ?? ['#3a3d44', '#c8cacf'], glasses: ch.glasses,
  };
}
