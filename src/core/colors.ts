// Genesis colors are 0BGR words with 3-bit channels stored in even nibbles (0, 2, ... E).

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export const LEVELS = [0, 36, 73, 109, 146, 182, 219, 255];

export const toLevels = (c: number): [number, number, number] => [(c >> 1) & 7, (c >> 5) & 7, (c >> 9) & 7];
export const fromLevels = (r: number, g: number, b: number): number => (r << 1) | (g << 5) | (b << 9);
export const toRgb = (c: number): Rgb => {
  const [r, g, b] = toLevels(c);
  return { r: LEVELS[r], g: LEVELS[g], b: LEVELS[b] };
};
export const toCss = (c: number): string => {
  const { r, g, b } = toRgb(c);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};
/** Nearest Genesis color for a CSS #rrggbb value. */
export const fromCss = (css: string): number => {
  const v = parseInt(css.slice(1), 16);
  const q = (x: number) => Math.round((x / 255) * 7);
  return fromLevels(q((v >> 16) & 255), q((v >> 8) & 255), q(v & 255));
};
export const avg = (a: number, b: number): number => {
  const x = toLevels(a), y = toLevels(b);
  return fromLevels(...(x.map((v, i) => (v + y[i] + 1) >> 1) as [number, number, number]));
};
/** BW95's own end zone darkening (0x0704B0): each nonzero channel one step darker. */
export const darken = (c: number): number => {
  const [r, g, b] = toLevels(c);
  return fromLevels(r ? r - 1 : 0, g ? g - 1 : 0, b ? b - 1 : 0);
};

// BW95 uniform set (16 words):
//   [0] [1] [2] [4] [8] constants per team (kept from the original team)
//   [3] team color  [5] [6] helmet  [7] trim  [9] numbers  [10-12] jersey light -> dark  [13-15] pants
// CF96/97 uniform set: [10] team color, [5] [6] helmet, [3] trim, [7] numbers, [11] [12] jersey,
//   [13-15] pants. (Derived by comparing the 36 schools that are in both games.)
export const UNIFORM_FIELDS = [
  { key: 'jersey', label: 'Jersey', idx: [10, 11, 12] },
  { key: 'pants', label: 'Pants', idx: [13, 14, 15] },
  { key: 'helmet', label: 'Helmet', idx: [5, 6] },
  { key: 'numbers', label: 'Numbers', idx: [9] },
  { key: 'trim', label: 'Trim', idx: [7] },
  { key: 'team', label: 'Team color', idx: [3] },
] as const;

export function mapUniform(cf: number[], bwOriginal: number[]): number[] {
  const u = bwOriginal.slice();
  u[3] = cf[10];
  u[5] = cf[5];
  u[6] = cf[6];
  u[7] = cf[3];
  u[9] = cf[7];
  u[10] = cf[11];
  u[11] = avg(cf[11], cf[12]);
  u[12] = cf[12];
  u[13] = cf[13];
  u[14] = cf[14];
  u[15] = cf[15];
  return u;
}

const nearBlack = (c: number) => Math.max(...toLevels(c)) < 2;

/** Default end zone: what the game would compute (the darkest jersey shade, one step darker),
 *  unless that comes out black; then the lightest jersey shade, or the helmet color if the
 *  jersey itself is near black. */
export function defaultEndZone(home: number[]): number {
  const z = darken(home[12]);
  if (z !== 0) return z;
  return [home[10], home[11], home[5], home[3]].find((c) => !nearBlack(c)) ?? home[10];
}

export const toHex4 = (c: number): string => c.toString(16).toUpperCase().padStart(4, '0');
