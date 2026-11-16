// Coaches' headshots (spec: "new headshot options: visors, caps, glasses, gray hair"; mockups: "Coach headshot
// options"): the players' 16-bit portrait (headshot.ts) with a coach's headwear in his team's colors, glasses, an
// older face's lines, and hair that grays, whitens and thins with age. Generated from the coach's id and age (the
// same every time); the user can change any part (DCoach.look).
import { rng } from './model';
import type { DCoach } from './coaches';
import type { HeadshotLook } from './headshot';

type RGB = [number, number, number];

export const COACH_HATS = ['none', 'visor', 'cap'] as const;
export const COACH_HAT_LABELS: Record<(typeof COACH_HATS)[number], string> = { none: 'None', visor: 'Visor', cap: 'Cap' };
export const COACH_GLASSES = ['none', 'square', 'round'] as const;
export const COACH_GLASSES_LABELS: Record<(typeof COACH_GLASSES)[number], string> = { none: 'None', square: 'Square', round: 'Round' };
export const COACH_HAIR = ['short', 'buzz', 'fade', 'thinning', 'bald', 'curls'] as const;
export const COACH_HAIR_LABELS: Record<(typeof COACH_HAIR)[number], string> = { short: 'Short', buzz: 'Buzz', fade: 'Fade', thinning: 'Thinning', bald: 'Bald', curls: 'Curls' };
/** Dark, brown, salt and pepper, gray, white. */
const COACH_HAIR_COLORS: RGB[] = [[30, 24, 20], [74, 48, 30], [112, 106, 102], [150, 148, 146], [222, 222, 220]];
export const COACH_HAIR_COLOR_LABELS = ['Dark', 'Brown', 'Salt and pepper', 'Gray', 'White'] as const;
export const SKIN_LABELS = ['Light', 'Tan', 'Brown', 'Dark'] as const;

/** A coach's stored changes to his generated look. */
export interface CoachLookEdit {
  hat?: (typeof COACH_HATS)[number];
  glasses?: (typeof COACH_GLASSES)[number];
  hair?: (typeof COACH_HAIR)[number];
  hairColor?: number;
  skin?: number;
  beard?: 'none' | 'stubble' | 'goatee' | 'beard';
}

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
  const beard = r() < 0.12 ? 'stubble' : r() < 0.06 ? 'goatee' : 'none';
  const gen: Required<CoachLookEdit> = { hat, glasses, hair, hairColor, skin, beard };
  return { ...gen, ...(c.look ?? {}) };
}

/** The headshot look for drawHeadshot (headshot.ts); hat colors are the team's (or gray without a team). */
export function coachLook(c: Pick<DCoach, 'id' | 'born' | 'look'>, year: number, colors: [string, string] | null): HeadshotLook {
  const ch = coachLookChoices(c, year);
  const age = year - c.born;
  return {
    skin: ch.skin, build: 'medium',
    hair: ch.hair === 'thinning' ? 'short' : ch.hair, thinning: ch.hair === 'thinning',
    hairColor: COACH_HAIR_COLORS[ch.hairColor] ?? COACH_HAIR_COLORS[0],
    beard: ch.beard, mouth: age >= 60 ? 'serious' : (['neutral', 'smile', 'serious'] as const)[c.id % 3], eyeBlack: false,
    hat: ch.hat, hatColors: colors ?? ['#3a3d44', '#c8cacf'], glasses: ch.glasses, lines: age >= 55,
  };
}
