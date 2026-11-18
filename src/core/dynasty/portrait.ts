// The Dynasty app's headshots (user, 2026-11-18: "These look like simple 8-bit graphics but we should be shooting for
// 16-bit era graphics"; the style reviewed on the "Dynasty headshots: 16-bit direction" page and approved with
// "bingo"). A painterly pixel portrait on a 48 x 48 grid, the face filling the frame: flat planes of color with
// slightly irregular edges (no dithering), hue-shifted ramps (shadows toward red, lights toward yellow; dark hair
// with cool highlights), a darker edge on the shadow side only, the flat gray of real player photos behind.
// Athletes: a strong neck and traps; three jaws and three necks. Pure function: an RGBA image.

type RGB = number[];
export const PORTRAIT_SIZE = 48;
const S = PORTRAIT_SIZE;

export type Build = 'slim' | 'medium' | 'wide';
export type Jaw = 'narrow' | 'medium' | 'wide';
export type Neck = 'thin' | 'medium' | 'thick';
export type Age = 'young' | 'middle' | 'older';
export const HAIR_STYLES = ['short', 'buzz', 'fade', 'sidepart', 'flattop', 'hightop', 'curls', 'twists', 'afro', 'locs', 'locsShort', 'cornrows', 'braids', 'flow', 'mullet', 'manbun', 'mohawk', 'bald'] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];
export const BEARD_STYLES = ['none', 'stubble', 'mustache', 'goatee', 'beard'] as const;
export type Beard = (typeof BEARD_STYLES)[number];
export const MOUTHS = ['neutral', 'smile', 'smirk', 'serious', 'grin'] as const;
export type Mouth = (typeof MOUTHS)[number];

export interface PortraitAcc { eyeBlack?: boolean; earring?: boolean; chain?: boolean }
export interface PortraitLook {
  /** 0-3: Light, Tan, Brown, Dark (SKIN_TONES in appearance.ts). */
  skin: number;
  build: Build; jaw: Jaw; neck: Neck; age: Age;
  hair: HairStyle; hairColor: RGB; beard: Beard; mouth: Mouth; eyeColor: RGB;
  /** A receding hairline; older faces recede unless this is false. */
  thinning?: boolean;
  acc?: PortraitAcc;
  /** Coaches: headwear in the team's colors (or hatColors), glasses. */
  hat?: 'none' | 'visor' | 'cap';
  hatColors?: [string, string];
  glasses?: 'none' | 'square' | 'round';
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const hexRgb = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a: RGB, b: RGB, t: number): RGB => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));
function toHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
  return [h, s, l];
}
function toRgb([h, s, l]: [number, number, number]): RGB {
  h = ((h % 1) + 1) % 1;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => { t = ((t % 1) + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return s === 0 ? [l, l, l].map((v) => Math.round(v * 255)) : [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(clamp(v, 0, 1) * 255));
}
/** n tones from dark to light around a base: darks shift toward red, lights toward yellow (hue shifting). */
function ramp(rgb: RGB, n: number, opt: { dark?: number; light?: number; warm?: number; cool?: number; sat?: number } = {}): RGB[] {
  const [h, s, l] = toHsl(rgb);
  const { dark = 0.3, light = 0.22, warm = 0.03, cool = 0.035, sat = 0.12 } = opt;
  return Array.from({ length: n }, (_, i) => {
    const t = (i / (n - 1)) * 2 - 1; // -1 darkest .. 1 lightest
    const Lx = t < 0 ? l + t * Math.min(dark, l * 0.85) : l + t * Math.min(light, (1 - l) * 0.75);
    const H = t < 0 ? h + t * cool : h + t * warm;
    const Sx = clamp(s + (t < 0 ? -t * sat : -t * sat * 0.8), 0, 1);
    return toRgb([H, Sx, clamp(Lx, 0.03, 0.96)]);
  });
}
const hash = (x: number, y: number, k = 0) => { let h = (x * 374761393 + y * 668265263 + k * 1442695041) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
/** Low-frequency value noise (cells of `c` pixels), -0.5..0.5: makes the plane edges irregular, like hand placement. */
const vnoise = (x: number, y: number, c: number, k: number) => {
  const gx = x / c, gy = y / c, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
  const a = hash(x0, y0, k), b = hash(x0 + 1, y0, k), d = hash(x0, y0 + 1, k), e = hash(x0 + 1, y0 + 1, k);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy - 0.5;
};
const L = (() => { const v = [-0.5, -0.45, 0.74]; const m = Math.hypot(...v); return v.map((x) => x / m); })();
const norm = (v: number[]) => { const m = Math.hypot(...v) || 1; return v.map((x) => x / m); };
const light = (n: number[]) => Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
/** A tone from a 0-1 light value, with irregular plane edges. */
const pick = (r: RGB[], v: number, x: number, y: number, k = 1, wob = 0.16) => r[clamp(Math.round((v + vnoise(x, y, 3, k) * wob) * (r.length - 1)), 0, r.length - 1)];

const SKIN = ['#e9b48e', '#c98a5e', '#9a6040', '#6a412b'].map(hexRgb);
/** Head half-width, jaw, neck half-width and traps by build. */
const BUILDS: Record<Build, { hw: number; jaw: number; nw: number; tr: number }> = { slim: { hw: 12.2, jaw: 11.2, nw: 7.4, tr: 17 }, medium: { hw: 12.8, jaw: 12.2, nw: 9, tr: 19.5 }, wide: { hw: 13.6, jaw: 13.4, nw: 11, tr: 22 } };
/** The cheek runs straight down to the jaw angle (row y), then a curve of shape p into the chin (2 round, 1 straight). */
const JAWS: Record<Jaw, { w: number; chin: number; y: number; p: number }> = { narrow: { w: 0.86, chin: 3.0, y: 27, p: 1.2 }, medium: { w: 0.82, chin: 3.1, y: 30, p: 1.55 }, wide: { w: 0.88, chin: 4.1, y: 32, p: 2 } };

export function drawPortrait(look: PortraitLook, jersey: string, trim: string): Uint8ClampedArray<ArrayBuffer> {
  const px = new Uint8ClampedArray(new ArrayBuffer(S * S * 4));
  const set = (x: number, y: number, c: RGB) => { if (x < 0 || y < 0 || x >= S || y >= S) return; const i = (y * S + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255; };
  const get = (x: number, y: number): RGB => { const i = (y * S + x) * 4; return [px[i], px[i + 1], px[i + 2]]; };
  const mask = new Uint8Array(S * S); // 1 head, 2 neck, 3 body, 4 hair, 5 ear
  const has = (k: keyof PortraitAcc) => !!look.acc?.[k];

  const SK = ramp(SKIN[look.skin], 7, { dark: 0.3, light: 0.17, warm: 0.035, cool: look.skin < 2 ? 0.025 : 0.035, sat: look.skin < 2 ? -0.14 : 0.1 });
  const HC = look.hairColor;
  const dark = toHsl(HC)[2] < 0.15;
  // Dark hair takes cool highlights (blue-gray), lighter hair warm ones.
  const HR: RGB[] = dark ? [mix(HC, [0, 0, 0], 0.4), HC, mix(HC, [40, 52, 74], 0.55), mix(HC, [76, 92, 118], 0.6), mix(HC, [118, 134, 156], 0.55)] : ramp(HC, 5, { dark: 0.22, light: 0.2 });
  const JR = ramp(hexRgb(jersey), 5, { dark: 0.22, light: 0.14 });
  const TR = ramp(hexRgb(trim), 4, { dark: 0.2, light: 0.1 });
  const B = { ...BUILDS[look.build] };
  const cx = 23.5, top = 4, chin = 38;
  // Neck thickness (user, 2026-11-18: "We should make the neck thickness an option too"); by build unless set.
  if (look.neck) B.nw = { thin: 7.2, medium: 8.8, thick: 10.6 }[look.neck];

  // Background: one flat color, a muted version of the team's color.
  const bg = hexRgb('#555555'); // the gray of real player photos (user, 2026-11-18)
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, bg);

  // Head width per row: a broad cranium, wide cheekbones, a strong square jaw.
  const hwAt = (y: number): number => {
    if (y < top) return -1;
    if (y < 15) { const t = (15 - y) / (15 - top); return B.hw * Math.pow(Math.max(0, 1 - Math.pow(t, 2.8)), 1 / 2.8); }
    if (y < 24) return B.hw - (y - 15) * 0.03;
    // Jaw options (user, 2026-11-18: "The jaws are too fat looking though. You can still have an athletic look with
    // a more pointed jaw. The thick neck is mainly what gives that athletic look. Maybe allow for three jaw options:
    // wide, medium, narrow"). The neck stays thick by build.
    // The cheek runs straight down to the jaw angle, then a curve of shape p into the chin: p 2 is round, lower is
    // more pointed, 1 is straight (user, 2026-11-18: narrow "looks like a skeleton. maybe less of a curve in at the
    // cheek and more straight? Medium jaw could be slightly pointier").
    const J = JAWS[look.jaw];
    const jawW = B.hw * J.w, chinW = J.chin, jawY = J.y;
    if (y < jawY) return B.hw - 0.3 - (y - 24) / Math.max(1, jawY - 24) * (B.hw - 0.3 - jawW); // cheek to the jaw angle
    const t = Math.min(1, (y - jawY) / (chin + 0.8 - jawY));
    return chinW + (jawW - chinW) * Math.pow(Math.max(0, 1 - Math.pow(t, J.p)), 1 / J.p);
  };
  /** The lowest row of the face at a column (for the shadow the jaw casts on the neck). */
  const jawBottom = (x: number) => { for (let y = chin; y >= top; y--) if (Math.abs(x + 0.5 - cx) <= hwAt(y)) return y; return -1; };
  const inHead = (x: number, y: number) => y >= top && y <= chin && hwAt(y) > 0.6 && Math.abs(x + 0.5 - cx) <= hwAt(y);

  // Long hair behind.
  const h = look.hair;
  if (['flow', 'locs', 'braids', 'mullet', 'locsShort'].includes(h)) {
    const bottom = h === 'mullet' ? 41 : h === 'locsShort' ? 31 : 44;
    for (let y = 10; y < S; y++) for (let x = 0; x < S; x++) {
      const w = h === 'mullet' ? (y < 28 ? B.hw + 1 : B.nw + 2.5) : B.hw + 2.2 + Math.max(0, y - 26) * 0.25;
      const dx = (x + 0.5 - cx) / w;
      if (Math.abs(dx) > 1 || y > bottom + (hash(Math.floor(x / 2), 5) * 4)) continue;
      let v = 0.42 - dx * 0.25 - (y > 30 ? 0.1 : 0);
      if (h !== 'flow' && (x % 3 === 0)) v -= 0.2;
      set(x, y, pick(HR, clamp(v, 0, 1), x, y, 2));
      mask[y * S + x] = 4;
    }
  }

  // Body: traps sloping from the neck to the shoulders, the jersey with a collar.
  for (let y = 30; y < S; y++) for (let x = 0; x < S; x++) {
    const d = Math.abs(x + 0.5 - cx);
    const trapTop = 40.5 + Math.max(0, d - B.nw) * 0.36; // the traps' slope, below a visible neck
    if (y < trapTop || d > B.tr + (y - 43) * 0.8) continue;
    const nx = clamp((x + 0.5 - cx) / (B.tr + 6), -1, 1);
    const slope = y < trapTop + 3 ? -0.55 : 0;
    let v = light(norm([nx * 0.9, slope, 0.8])) * 0.95 + 0.05;
    set(x, y, pick(JR, clamp(v, 0, 1), x, y, 3, 0.1));
    mask[y * S + x] = 3;
  }
  // Neck: thick, with the jaw's shadow and the neck muscles.
  for (let y = 30; y < 47; y++) for (let x = 0; x < S; x++) {
    const d = Math.abs(x + 0.5 - cx), w = B.nw + Math.max(0, y - 42) * 0.7;
    if (d > w || mask[y * S + x] === 3 && y > 43) continue;
    const nx = (x + 0.5 - cx) / w;
    let v = light(norm([nx, 0.1, 0.9])) * 0.8;
    const jb = jawBottom(x), below = jb < 0 ? 9 : y - jb;
    if (below <= 2) v -= 0.32; else if (below <= 4) v -= 0.18; // the jaw's shadow on the neck
    if (Math.abs(d - w * 0.55) < 0.7 && y > 38) v -= 0.07;   // the neck muscles
    set(x, y, pick(SK, clamp(v, 0, 1), x, y, 4, 0.1));
    mask[y * S + x] = 2;
  }
  // Collar: a crew neck in the trim color, the jersey's inner shadow above it.
  for (let x = 0; x < S; x++) {
    const d = Math.abs(x + 0.5 - cx);
    if (d > B.nw + 2) continue;
    const y = 43 + Math.round((d / (B.nw + 2)) ** 2 * -1.6);
    set(x, y, d < B.nw ? JR[0] : JR[1]);
    set(x, y + 1, TR[x < cx ? 3 : 1]);
    set(x, y + 2, TR[x < cx ? 2 : 0]);
  }
  if (has('chain')) { const G = ramp([210, 165, 60], 4); for (let x = 0; x < S; x++) { const d = Math.abs(x + 0.5 - cx); if (d < B.nw - 1 && x % 2 === 0) set(x, 41 + Math.round((d / B.nw) ** 2 * -2.5) + 1, G[x < cx ? 3 : 1]); } }

  // Ears.
  for (const side of [-1, 1]) {
    const ex = cx + side * (B.hw + 0.3);
    for (let y = 17; y < 27; y++) for (let x = 0; x < S; x++) {
      const dx = (x + 0.5 - ex) / 1.9, dy = (y - 21.5) / 4.4;
      if (dx * dx + dy * dy > 1) continue;
      let v = side < 0 ? 0.55 : 0.25;
      if (dx * dx + dy * dy < 0.35) v -= 0.18;
      set(x, y, pick(SK, v, x, y, 5, 0.1));
      mask[y * S + x] = 5;
    }
    if (has('earring')) set(Math.round(ex - 0.5), 26, [232, 232, 240]);
  }

  // Head: planes. The front of the face catches the light; the side planes turn away; sockets, the nose's
  // shadow side, under the cheekbones and the jaw's underside are darker.
  for (let y = top; y <= chin; y++) for (let x = 0; x < S; x++) {
    if (!inHead(x, y)) continue;
    const w = hwAt(y), fx = x + 0.5 - cx, ax = fx / w;
    // Normal: a box with rounded corners (front plane, side planes), rounder at the top.
    const side = Math.sign(ax) * Math.pow(Math.max(0, Math.abs(ax) - 0.3) / 0.7, 1.15);
    const ny = y < 12 ? -0.7 * (12 - y) / 8 : y > 33 ? 0.35 : 0;
    let v = light(norm([side * 1.4, ny, 1 - Math.abs(side) * 0.55]));
    // Features as planes.
    const r = (cx0: number, cy0: number, rx: number, ry: number) => { const a = (fx - cx0) / rx, b = (y - cy0) / ry; return a * a + b * b; };
    for (const s of [-1, 1]) {
      if (r(s * 5, 21, 3.6, 2.2) < 1) v -= 0.16;          // eye sockets
      if (r(s * 6.8, 27, 3.2, 2.2) < 1) v -= look.jaw === 'narrow' ? 0.04 : 0.08; // under the cheekbone
      if (r(s * 6.5, 24, 2.6, 1.4) < 1 && s < 0) v += 0.07; // the lit cheekbone
    }
    if (r(0, 17.5, 9, 1.4) < 1) v += 0.06;                 // brow ridge catches light
    if (fx > 0.6 && fx < 3 && y >= 20 && y <= 28) v -= 0.17; // the nose's shadow side
    if (fx > -2.2 && fx < -0.4 && y >= 21 && y <= 27) v += 0.06; // the nose's lit side
    if (y >= chin - 1) v -= 0.08; // the chin's underside
    if (y >= 31 && Math.abs(fx) < 2.5 && y <= 33) v -= 0.08; // under the lower lip
    set(x, y, pick(SK, clamp(0.12 + v * 0.74, 0, 1), x, y, 6, 0.14));
    mask[y * S + x] = 1;
  }
  // A darker edge along the shadow side and the jaw (no full outline).
  for (let y = top; y <= chin + 1; y++) for (let x = 1; x < S - 1; x++) {
    const m = mask[y * S + x];
    if (m !== 1) continue;
    const outR = mask[y * S + x + 1] !== 1 && mask[y * S + x + 1] !== 5, outD = y + 1 >= S || mask[(y + 1) * S + x] === 0 || mask[(y + 1) * S + x] === 2;
    if (outR && x > cx && y < 33) set(x, y, SK[1]);
  }

  // Face details.
  const ey = 21, m0 = Math.floor(cx);
  // Eyes, looking at the camera: 4 wide and symmetric: white, iris (2), white; the upper lid a dark line over
  // the whole eye, a catch light in the iris, a soft lower lid. Centers at cx -/+ 5.
  const IR = look.eyeColor;
  for (const s of [-1, 1]) {
    const x0 = Math.round(cx + s * 5 - 2); // the eye's left pixel
    const W1: RGB = s < 0 ? [236, 230, 222] : [214, 206, 198], W2: RGB = s < 0 ? [214, 206, 198] : [196, 188, 180]; // whites, lit side brighter
    for (let i = -1; i <= 4; i++) set(x0 + i, ey - 1, i < 0 || i > 3 ? SK[2] : SK[0]);
    set(x0, ey, W1); set(x0 + 3, ey, W2);
    set(x0 + 1, ey, IR); set(x0 + 2, ey, mix(IR, [10, 6, 6], 0.6));
    set(x0 + 1, ey - 1, mix(IR, [255, 255, 255], 0.15)); // the iris's top under the lid reads darker; a hint of it
    set(x0 + 1, ey - 1, SK[0]);
    set(x0 - 1, ey, SK[2]); set(x0 + 4, ey, SK[2]);
    for (let i = 0; i <= 3; i++) set(x0 + i, ey + 1, mix(get(x0 + i, ey + 1), SK[1], 0.45)); // lower lid
  }
  // Catch lights: one bright pixel in each iris, the same side for both eyes (the light comes from the left).
  for (const s of [-1, 1]) { const x0 = Math.round(cx + s * 5 - 2); set(x0 + 1, ey, mix(IR, [255, 255, 255], 0.55)); }
  // Brows: heavy, dark.
  const BR: RGB[] = h === 'bald' || h === 'buzz' ? [SK[0], mix(SK[0], HR[1], 0.5)] : [HR[0], HR[1]];
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) {
    const x = Math.round(cx + s * (2.6 + i) - 0.5), y = 18 + (look.mouth === 'serious' && i < 2 ? 1 : 0) + (i === 4 ? 1 : 0);
    set(x, y, BR[i % 2 ? 1 : 0]);
    if (i > 0 && i < 4) set(x, y + 1, mix(get(x, y + 1), BR[0], 0.5));
  }
  // Nose: the lit bridge and tip, the shadow side, nostrils, the shadow under the tip.
  const nx0 = Math.floor(cx);
  for (let y = 22; y <= 26; y++) set(nx0 - 1, y, mix(get(nx0 - 1, y), SK[6], 0.35));
  set(nx0 - 1, 27, SK[5]); set(nx0, 27, SK[4]);                 // tip
  set(nx0 - 2, 28, SK[1]); set(nx0 + 2, 28, SK[0]);             // nostrils
  set(nx0 - 1, 28, SK[2]); set(nx0, 28, SK[2]); set(nx0 + 1, 28, SK[1]);
  set(nx0 + 1, 27, SK[2]); set(nx0 + 2, 27, SK[1]);             // the shadow side of the tip
  // Mouth at row 31: corners, a darker upper lip, a lit lower lip with a highlight, the groove above (philtrum)
  // and a shadow under the lower lip.
  const LIP = ramp(mix(SK[3], [168, 82, 78], 0.32), 5, { dark: 0.22, light: 0.12 });
  const my = 31, w2 = look.mouth === 'grin' || look.mouth === 'smile' ? 4 : 3;
  set(m0, 29, mix(get(m0, 29), SK[1], 0.5)); set(m0 + 1, 29, mix(get(m0 + 1, 29), SK[2], 0.4)); // philtrum
  for (let x = m0 - w2; x <= m0 + w2; x++) {
    const edge = Math.abs(x + 0.5 - (m0 + 0.5)) >= w2 - 0.5;
    if (look.mouth === 'grin') {
      set(x, my - 1, edge ? LIP[1] : LIP[2]);                               // upper lip
      set(x, my, edge ? LIP[0] : Math.abs(x - m0) <= 2 ? [238, 232, 220] : [206, 198, 186]); // teeth
      if (!edge) set(x, my + 1, x < m0 ? LIP[4] : LIP[3]);                  // lower lip
    } else {
      if (!edge) set(x, my - 1, x < m0 ? LIP[2] : LIP[1]);                  // upper lip
      set(x, my, edge ? LIP[0] : mix(LIP[0], [30, 14, 14], 0.35));          // the line between the lips
      if (!edge) set(x, my + 1, x === m0 - 1 ? LIP[4] : x < m0 + 1 ? LIP[3] : LIP[2]); // lower lip
    }
  }
  if (look.mouth === 'smile' || look.mouth === 'grin') { set(m0 - w2 - 1, my - 1, LIP[0]); set(m0 + w2 + 1, my - 1, LIP[0]); }
  if (look.mouth === 'smirk') set(m0 + w2 + 1, my - 1, LIP[0]);
  if (look.mouth === 'serious') { set(m0 - w2, my + 1, LIP[1]); set(m0 + w2, my + 1, LIP[1]); }
  for (let x = m0 - 2; x <= m0 + 2; x++) set(x, my + 2, mix(get(x, my + 2), SK[1], 0.45)); // under the lower lip

  // Facial hair: planes in the hair color.
  const FH = HR;
  const face = (x: number, y: number) => mask[y * S + x] === 1;
  const offMouth = (x: number, y: number) => !(y >= 30 && y <= 32 && Math.abs(x - m0) <= 4);
  if (look.beard === 'stubble') {
    for (let y = 24; y <= chin; y++) for (let x = 0; x < S; x++) {
      if (!face(x, y)) continue;
      const d = Math.abs(x + 0.5 - cx), w = hwAt(y);
      const zone = y >= 29 ? true : d > w - 3.2 - (y - 24) * 0.25; // cheeks below the cheekbones, lip, chin
      if (!zone || (y < 29 && d < 3.5) || !offMouth(x, y)) continue;
      if (y === 28 && d < 3.5) continue; // under the nose
      const k = 0.28 + (y >= 33 || (y >= 29 && y <= 30) ? 0.08 : 0) + vnoise(x, y, 2, 13) * 0.1;
      set(x, y, mix(get(x, y), FH[0], k));
    }
  }
  if (['mustache', 'goatee', 'beard'].includes(look.beard)) {
    // Wide and full (user, 2026-11-18: "mustache needs to be wider, looks too much like charlie chaplin"): two rows
    // across the whole upper lip and past the mouth's corners, the ends turning down; the upper lip stays visible.
    for (let x = m0 - 5; x <= m0 + 6; x++) {
      const dx = x + 0.5 - (m0 + 0.5), ad = Math.abs(dx);
      const lit = dx < 0 ? 2 : 1;
      if (ad <= 5.5) set(x, 29, FH[ad > 4.5 ? lit - 1 : lit]);
      if (ad >= 1 && ad <= 5) set(x, 28, mix(get(x, 28), FH[lit], ad > 4 ? 0.55 : 0.8));
      if (ad >= 4.5 && ad <= 5.5) set(x, 30, FH[0]);
    }
  }
  if (look.beard === 'goatee') {
    // A rounded chin beard joined to the mustache at the mouth's corners; hair tones over the skin, lit side lighter.
    for (let y = my; y <= chin + 1; y++) for (let x = m0 - 5; x <= m0 + 5; x++) {
      const dx = x + 0.5 - (m0 + 0.5);
      const half = y <= my + 1 ? 4.6 : y === my + 2 ? 2.2 : 2.6 + (y - my - 2) * 0.35; // corners, then the chin patch
      if (Math.abs(dx) > half || !offMouth(x, y) || !face(x, Math.min(y, chin))) continue;
      if (y <= my + 1 && Math.abs(dx) < 3.6) continue; // only the corners beside the mouth
      const v = (dx < 0 ? 0.62 : 0.38) + vnoise(x, y, 2, 21) * 0.4 - (y >= chin ? 0.15 : 0);
      set(x, y, mix(get(x, y), FH[clamp(Math.round(v * 3), 0, 3)], 0.85));
    }
  }
  if (look.beard === 'beard') {
    // A full beard: from the sideburns down over the jaw and chin, joined to the mustache, the lips left showing.
    // Shaded as a volume (lit side lighter, under the chin darker) with clumps, its top edge on the cheeks softened.
    for (let y = 20; y <= chin + 2; y++) for (let x = 0; x < S; x++) {
      const d = Math.abs(x + 0.5 - cx), yy = Math.min(y, chin), w = hwAt(yy) + (y > 30 ? 0.7 : 0.2);
      if (d > w || !offMouth(x, y)) continue;
      const cheekTop = 28.5 - (d - 4) * 0.42;          // the beard line on the cheeks rises toward the sideburns
      if (y < cheekTop || (y < 29 && d < 4.2)) continue;
      if (y > chin && d > 3.2 + (chin + 2 - y)) continue; // a rounded bottom below the chin
      const ax = (x + 0.5 - cx) / Math.max(w, 1);
      let v = 0.6 - ax * 0.38 - (y >= chin ? 0.2 : 0) + vnoise(x, y, 2, 9) * 0.35;
      const c = FH[clamp(Math.round(v * 4), 0, 4)];
      set(x, y, y < cheekTop + 1.2 ? mix(get(x, y), c, 0.6) : c);
    }
    for (let x = m0 - 2; x <= m0 + 2; x++) set(x, my + 1, mix(get(x, my + 1), [168, 96, 88], 0.5)); // the lower lip shows
  }
  // Age (user, 2026-11-18: "Age needs to be an option"): players are young; a middle-aged face gets forehead
  // and smile lines and graying temples; an older one deeper lines, bags under the eyes, a softer jaw line and
  // more gray.
  const age = look.age;
  if (age !== 'young') {
    for (let x = m0 - 4; x <= m0 + 4; x++) if (x % 3 !== 0) set(x, 15, mix(get(x, 15), SK[1], age === 'older' ? 0.55 : 0.35));
    if (age === 'older') for (let x = m0 - 3; x <= m0 + 3; x++) if (x % 3 !== 1) set(x, 13, mix(get(x, 13), SK[1], 0.4));
    for (const s of [-1, 1]) { const x0 = Math.round(cx + s * 5 - 2); for (let i = 0; i <= 3; i++) set(x0 + i, ey + 2, mix(get(x0 + i, ey + 2), SK[1], age === 'older' ? 0.45 : 0.2)); }
  }
  if (age !== 'young') {
    for (let x = m0 - 4; x <= m0 + 4; x++) if (x % 3 !== 0) set(x, 15, mix(get(x, 15), SK[1], 0.5)); // the forehead lines, darker
    for (let i = 0; i < (age === 'older' ? 4 : 3); i++) { set(m0 - 4 - (i > 1 ? 1 : 0), 28 + i, mix(get(m0 - 4, 28 + i), SK[1], 0.6)); set(m0 + 5 + (i > 1 ? 1 : 0), 28 + i, mix(get(m0 + 5, 28 + i), SK[0], 0.5)); }
  }

  // Hair on top: shapes with planes; dark hair takes the cool highlights on the lit side.
  const hairline = (x: number) => { const d = Math.abs(x + 0.5 - cx); const recede = look.thinning || (age === 'older' && look.thinning !== false) ? 3 + (d > 3 && d < 9 ? 2.5 : 0) : 0; return 13 - recede + (d > 5 ? (d - 5) * 0.35 : 0) - (d > 9 ? (d - 9) * 1.3 : 0); };
  const shell = (thick: number, line: (x: number) => number, tex: (x: number, y: number) => number = () => 0, low = 20) => {
    for (let y = 0; y <= low; y++) for (let x = 0; x < S; x++) {
      const d = Math.abs(x + 0.5 - cx);
      const rx = B.hw + thick * 0.8, ry = 15 - top + thick;
      const w = y < 15 ? rx * Math.pow(Math.max(0, 1 - Math.pow((15 - y) / ry, 2.6)), 1 / 2.6) : hwAt(y) + thick * 0.4;
      if (d > w || w < 2.5) continue;
      if (y > line(x) && !(d > B.hw - 2 && y <= low)) continue;
      const ax = (x + 0.5 - cx) / w;
      let v = 0.55 - ax * 0.45 - (y > 12 ? 0.12 : 0) + (y < 7 ? 0.12 : 0) + tex(x, y);
      set(x, y, pick(HR, clamp(v, 0, 1), x, y, 7, 0.22));
      mask[y * S + x] = 4;
    }
  };
  const curl = (x: number, y: number) => vnoise(x, y, 2, 11) * 0.5;
  if (h === 'short') shell(1.6, (x) => hairline(x));
  else if (h === 'fade') { shell(2.2, (x) => hairline(x), curl, 15); for (let y = 13; y < 22; y++) for (let x = 0; x < S; x++) if (inHead(x, y) && Math.abs(x + 0.5 - cx) > B.hw - 2.5 && hash(x, y, 3) > 0.35 + (y - 13) * 0.07) set(x, y, mix(get(x, y), HR[0], 0.5)); }
  else if (h === 'buzz') { for (let y = top; y < 16; y++) for (let x = 0; x < S; x++) if (inHead(x, y) && y < hairline(x) + 0.5) set(x, y, mix(get(x, y), HR[0], 0.5 + vnoise(x, y, 2, 3) * 0.3)); }
  else if (h === 'curls' || h === 'twists') shell(h === 'twists' ? 3.4 : 3, (x) => hairline(x) - 0.5, curl, 17);
  else if (h === 'afro') {
    const R = B.hw + 5;
    for (let y = 0; y < 19; y++) for (let x = 0; x < S; x++) {
      const dx = (x + 0.5 - cx) / R, dy = (y - 9) / (R - 2), e = dx * dx + dy * dy + vnoise(x, y, 2, 4) * 0.25;
      if (e > 1 || (y > hairline(x) && Math.abs(x + 0.5 - cx) < B.hw - 1.5)) continue;
      set(x, y, pick(HR, clamp(0.55 - dx * 0.4 - dy * 0.15 + curl(x, y), 0, 1), x, y, 4, 0.2));
    }
  } else if (h === 'locs') {
    shell(2.6, (x) => hairline(x) - 0.5, (x) => (x % 3 === 0 ? -0.18 : 0.04), 22);
    for (const sx of [-9, -6, 6, 9]) for (let y = 12; y < 30; y++) { const x = Math.round(cx + sx - 0.5); set(x, y, HR[(y + sx) % 3 ? 2 : 1]); set(x + (sx < 0 ? -1 : 1), y, HR[0]); }
  } else if (h === 'cornrows' || h === 'braids') shell(1.2, (x) => hairline(x) - 0.5, (x) => ((x + 48) % 3 === 0 ? -0.3 : 0.08), 17);
  else if (h === 'flow') shell(2.4, (x) => hairline(x) - 1 + (x > cx + 1 ? 1 : 0), (x, y) => ((x + Math.floor(y / 3)) % 4 === 0 ? -0.15 : 0), 26);
  else if (h === 'hightop') {
    for (let y = 0; y < 16; y++) for (let x = 0; x < S; x++) {
      const d = Math.abs(x + 0.5 - cx);
      if (d > B.hw - 1.2 || (y > 12 && !inHead(x, y))) continue;
      if (y > hairline(x)) continue;
      set(x, y, pick(HR, clamp((y < 2 ? 0.7 : 0.45) - (x + 0.5 - cx) / B.hw * 0.35 + curl(x, y), 0, 1), x, y, 5, 0.15));
    }
  } else if (h === 'flattop') {
    for (let y = 1; y < 16; y++) for (let x = 0; x < S; x++) {
      const d = Math.abs(x + 0.5 - cx);
      if (d > B.hw - 0.6 || (y > 12 && !inHead(x, y)) || y > hairline(x)) continue;
      if (y === 1 && d > B.hw - 2) continue;
      set(x, y, pick(HR, clamp((y <= 2 ? 0.75 : 0.45) - (x + 0.5 - cx) / B.hw * 0.35 + curl(x, y) * 0.6, 0, 1), x, y, 5, 0.15));
      mask[y * S + x] = 4;
    }
  } else if (h === 'mullet') shell(1.8, (x) => hairline(x), (x, y) => ((x + Math.floor(y / 3)) % 4 === 0 ? -0.12 : 0), 24);
  else if (h === 'manbun') {
    shell(1, (x) => hairline(x), (x) => (x % 3 === 0 ? -0.1 : 0.03), 16);
    for (let y = 0; y < 6; y++) for (let x = 0; x < S; x++) {
      const dx = (x + 0.5 - (cx + 1)) / 3.6, dy = (y - 2.8) / 2.8;
      if (dx * dx + dy * dy > 1) continue;
      set(x, y, pick(HR, clamp(0.55 - dx * 0.35 - dy * 0.2, 0, 1), x, y, 3, 0.15));
    }
  } else if (h === 'sidepart') {
    // A classic side part: a thin scalp line on the left, both sides combed away from it. The left side lies close;
    // the right side is fuller and combed up and over in curved strands, with a soft lift at the front.
    const partX = Math.round(cx - 8.5), pAt = (y: number) => partX - Math.round(Math.max(0, 11 - y) / 3); // the part leans left toward the top
    const frontR = (x: number) => 11.6 + (x - partX) * 0.06 + Math.max(0, x - cx - 4) * 0.45 + Math.max(0, x - cx - 7) * 0.6; // the fringe edge, rounding down at the right temple
    for (let y = 0; y <= 19; y++) for (let x = 0; x < S; x++) {
      const right = x > pAt(y), d = Math.abs(x + 0.5 - cx);
      const thick = right ? 3.3 : 1.4;
      const rx = B.hw + thick * 0.8, ry = 15 - top + thick;
      const w = y < 15 ? rx * Math.pow(Math.max(0, 1 - Math.pow((15 - y) / ry, 2.6)), 1 / 2.6) : hwAt(y) + thick * 0.4;
      if (d > w || w < 2.5) continue;
      const front = right ? Math.min(frontR(x), hairline(x) + 0.5) : hairline(x);
      if (y > front && !(d > B.hw - 2 && y <= 19)) continue;
      const ax = (x + 0.5 - cx) / w;
      let v: number;
      if (right) {
        const t = x - pAt(y);
        const crest = 4.6 + t * 0.22 + t * t * 0.012;                  // the lit crest where the hair rises off the part
        const below = y - crest;
        v = 0.5 - ax * 0.25 - Math.max(0, below) * 0.035;
        if (Math.abs(below) < 1.2 && t > 1) v += 0.26;                 // highlight band along the crest
        else if (below < -1.2) v += 0.06;
        const sweep = y - 3 - t * t * 0.03, ph = ((sweep % 4.5) + 4.5) % 4.5;
        if (below > 2 && ph < 0.9) v -= 0.1;                           // a few soft strand lines below the crest
        if (t <= 1) v -= 0.22;                                         // the fuller side's shadowed edge at the part
        if (y >= front - 1 && x < cx + 7) v -= 0.1;                    // under the front lift
      } else {
        v = 0.42 - ax * 0.15 - Math.max(0, y - 9) * 0.03;
      }
      set(x, y, pick(HR, clamp(v, 0, 1), x, y, 7, 0.06));
      mask[y * S + x] = 4;
    }
    for (let y = 5; y <= 11; y++) if (mask[y * S + pAt(y)] === 4) set(pAt(y), y, mix(SK[3], HR[1], y < 8 ? 0.65 : 0.4)); // the part, fading toward the back
  } else if (h === 'locsShort') {
    shell(2.4, (x) => hairline(x) - 0.5, (x) => (x % 3 === 0 ? -0.18 : 0.04), 20);
    for (const sx of [-9, -6, 6, 9]) for (let y = 12; y < 22; y++) { const x = Math.round(cx + sx - 0.5); set(x, y, HR[(y + sx) % 3 ? 2 : 1]); set(x + (sx < 0 ? -1 : 1), y, HR[0]); }
  } else if (h === 'mohawk') {
    for (let y = 0; y < 16; y++) for (let x = 0; x < S; x++) {
      const d = Math.abs(x + 0.5 - cx);
      if (d < 2.6 && y >= Math.abs(x + 0.5 - cx) * 0.5) { set(x, y, pick(HR, clamp(0.6 - (x + 0.5 - cx) * 0.15 + curl(x, y) * 0.5, 0, 1), x, y, 6, 0.15)); mask[y * S + x] = 4; }
      else if (inHead(x, y) && y < hairline(x)) set(x, y, mix(get(x, y), HR[0], 0.3 + vnoise(x, y, 2, 3) * 0.2)); // shaved sides
    }
  }
  if (age === 'middle') for (let y = 12; y < 22; y++) for (let x = 0; x < S; x++) { // graying temples
    if (mask[y * S + x] !== 4 || Math.abs(x + 0.5 - cx) < B.hw - 2.5) continue;
    set(x, y, mix(get(x, y), [168, 164, 160], y > 15 ? 0.6 : 0.4)); // solid, more gray lower down (no speckle)
  }
  if (h === 'bald') { set(m0 - 4, 7, SK[6]); set(m0 - 3, 7, SK[6]); set(m0 - 4, 8, SK[5]); }

  if (has('eyeBlack')) for (const s of [-1, 1]) { const ex = Math.round(cx + s * 5 - 0.5); for (let i = -2; i <= 2; i++) { set(ex + i, 24, [24, 22, 26]); set(ex + i, 25, i < 2 ? [24, 22, 26] : SK[2]); } }
  if (look.glasses && look.glasses !== 'none') {
    const F: RGB[] = [[28, 26, 30], [70, 70, 78]];
    const round = look.glasses === 'round';
    for (const s of [-1, 1]) {
      const x0 = Math.round(cx + s * 5 - 2);
      for (let i = round ? 0 : -1; i <= (round ? 3 : 4); i++) { set(x0 + i, ey - 2, F[0]); set(x0 + i, ey + 2, F[1]); }
      for (let y = ey - 2 + (round ? 1 : 0); y <= ey + 2 - (round ? 1 : 0); y++) { set(x0 - 1, y, F[0]); set(x0 + 4, y, F[0]); }
      set(x0, ey - 1, mix(get(x0, ey - 1), [200, 220, 240], 0.5)); // glare
    }
    set(m0, ey - 1, F[0]); set(m0 + 1, ey - 1, F[0]);
    set(Math.round(cx - B.hw), ey - 1, F[1]); set(Math.round(cx + B.hw) - 1, ey - 1, F[0]);
  }
  if (look.hat === 'visor' || look.hat === 'cap') {
    const [hc, ht] = look.hatColors ?? [jersey, trim];
    const V = ramp(hexRgb(hc), 4, { dark: 0.2, light: 0.12 }), V2 = ramp(hexRgb(ht), 3, { dark: 0.2, light: 0.1 });
    const cap = look.hat === 'cap';
    for (let y = cap ? 1 : 10; y <= 14; y++) for (let x = 0; x < S; x++) {
      const d = Math.abs(x + 0.5 - cx), rx = B.hw + 1.2, ry = 15 - top + 2.2;
      const w = y < 15 ? rx * Math.pow(Math.max(0, 1 - Math.pow((15 - y) / ry, 2.6)), 1 / 2.6) : B.hw + 1;
      if (d > w || w < 3) continue;
      set(x, y, V[clamp(Math.round((0.6 - (x + 0.5 - cx) / w * 0.45 + (y < 5 ? 0.15 : 0)) * 3), 0, 3)]);
    }
    if (cap) { set(Math.floor(cx), 1, V2[2]); set(Math.floor(cx) + 1, 1, V2[1]); for (let y = 3; y < 14; y++) set(Math.floor(cx), y, mix(get(Math.floor(cx), y), V[0], 0.5)); }
    for (let x = 0; x < S; x++) { // the brim, then its shadow on the forehead
      const d = Math.abs(x + 0.5 - cx);
      if (d <= B.hw + 2.5) { set(x, 15, V2[x < cx ? 2 : 1]); if (d <= B.hw + 1.5) set(x, 16, V2[0]); }
      if (d <= B.hw - 0.5 && inHead(x, 17)) set(x, 17, mix(get(x, 17), [0, 0, 0], 0.3));
    }
  }
  return px;
}

/**
 * A generated player's jaw and neck (user, 2026-11-18: "wide jaw + thick neck more common with lineman. Narrow jaw +
 * thin neck never on lineman ... wide jaw + thin neck should probably never be used. Narrow jaw + thick neck looks
 * great though"). r1 and r2 are the player's own draws (0-1).
 */
export function jawNeckFor(pos: string, r1: number, r2: number): { jaw: Jaw; neck: Neck } {
  const line = ['LT', 'LG', 'C', 'RG', 'RT', 'LE', 'RE', 'DT'].includes(pos);
  const mid = ['HB', 'FB', 'TE', 'LOLB', 'MLB', 'ROLB'].includes(pos);
  const neck = line ? pickW<Neck>(r2, [['thick', 0.85], ['medium', 0.15]]) : mid ? pickW<Neck>(r2, [['thick', 0.4], ['medium', 0.5], ['thin', 0.1]]) : pickW<Neck>(r2, [['thin', 0.4], ['medium', 0.5], ['thick', 0.1]]);
  let jaw = line ? pickW<Jaw>(r1, [['wide', 0.55], ['medium', 0.3], ['narrow', 0.15]]) : mid ? pickW<Jaw>(r1, [['medium', 0.5], ['wide', 0.25], ['narrow', 0.25]]) : pickW<Jaw>(r1, [['narrow', 0.4], ['medium', 0.5], ['wide', 0.1]]);
  if (jaw === 'wide' && neck === 'thin') jaw = 'medium';
  return { jaw, neck };
}

/** A weighted pick: the first key whose running weight passes r (0-1). */
export function pickW<T>(r: number, table: [T, number][]): T {
  const total = table.reduce((a, [, w]) => a + w, 0);
  let a = 0;
  for (const [k, w] of table) { a += w / total; if (r < a) return k; }
  return table[table.length - 1][0];
}
