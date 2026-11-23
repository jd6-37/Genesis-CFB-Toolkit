// Game controllers for the Dynasty app (user, 2026-11-22: "touch friendly and … game controller friendly. Eg. Change
// tabs with L1/R1, circle button (b on Xbox) backs up"; many users play on handhelds such as the Odin 2 Portal).
//
// The browser's Gamepad API gives each controller as buttons (pressed, value) and axes (-1..1). A binding names one
// of them: "b3" is button 3, "a1-" / "a1+" is axis 1 pushed past the dead zone either way. Each action has one or
// more bindings; the user can change them in Manage (a non-standard controller). This file is pure (no DOM): the
// defaults, reading a controller's state into actions, key repeat, and saving the mapping.

/** What a button does. */
export type PadAction =
  | 'up' | 'down' | 'left' | 'right'
  | 'confirm' | 'back' | 'primary' | 'secondary'
  | 'prevTab' | 'nextTab' | 'prevItem' | 'nextItem'
  | 'scrollUp' | 'scrollDown' | 'menu' | 'hints';

export const PAD_ACTIONS: { action: PadAction; label: string }[] = [
  { action: 'up', label: 'Move up' },
  { action: 'down', label: 'Move down' },
  { action: 'left', label: 'Move left, lower a value' },
  { action: 'right', label: 'Move right, raise a value' },
  { action: 'confirm', label: 'Choose, open' },
  { action: 'back', label: 'Back, close a window' },
  { action: 'primary', label: 'The page’s main action' },
  { action: 'secondary', label: 'Its second action' },
  { action: 'prevTab', label: 'Previous tab' },
  { action: 'nextTab', label: 'Next tab' },
  { action: 'prevItem', label: 'Previous item (player, week)' },
  { action: 'nextItem', label: 'Next item' },
  { action: 'scrollUp', label: 'Scroll up' },
  { action: 'scrollDown', label: 'Scroll down' },
  { action: 'menu', label: 'App menu' },
  { action: 'hints', label: 'Show or hide the button hints' },
];

export type PadMap = Record<PadAction, string[]>;

/** The browser's "standard" layout: 0-3 face buttons (bottom, right, left, top), 4/5 L1/R1, 6/7 L2/R2,
    8 Select, 9 Start, 12-15 the D-pad; axes 0/1 the left stick, 2/3 the right stick. */
export const DEFAULT_MAP: PadMap = {
  up: ['b12', 'a1-'],
  down: ['b13', 'a1+'],
  left: ['b14', 'a0-'],
  right: ['b15', 'a0+'],
  confirm: ['b0'],
  back: ['b1'],
  primary: ['b2'],
  secondary: ['b3'],
  prevTab: ['b4'],
  nextTab: ['b5'],
  prevItem: ['b6'],
  nextItem: ['b7'],
  scrollUp: ['a3-'],
  scrollDown: ['a3+'],
  menu: ['b9'],
  hints: ['b8'],
};

/** How the face buttons are labeled on the user's controller (the hints draw them so). */
export type PadLabels = 'xbox' | 'playstation' | 'nintendo';
export const PAD_LABELS: { value: PadLabels; label: string }[] = [
  { value: 'xbox', label: 'A B X Y (Xbox, most Android handhelds)' },
  { value: 'playstation', label: '✕ ○ □ △ (PlayStation)' },
  { value: 'nintendo', label: 'B A Y X (Nintendo)' },
];

/** Names of the standard buttons, for the hints and the mapping table. */
const FACE: Record<PadLabels, string[]> = {
  xbox: ['A', 'B', 'X', 'Y'],
  playstation: ['✕', '○', '□', '△'],
  nintendo: ['B', 'A', 'Y', 'X'],
};
const OTHER = ['L1', 'R1', 'L2', 'R2', 'Select', 'Start', 'L3', 'R3', 'D-pad up', 'D-pad down', 'D-pad left', 'D-pad right', 'Home'];
const AXIS = ['Left stick', 'Left stick', 'Right stick', 'Right stick'];
const AXIS_DIR: Record<string, [string, string]> = { 0: ['left', 'right'], 1: ['up', 'down'], 2: ['left', 'right'], 3: ['up', 'down'] };

/** "A", "L1", "Right stick down", "Button 17", "Axis 6 +". */
export function bindingName(b: string, labels: PadLabels = 'xbox', names?: Record<string, string>): string {
  if (names?.[b]) return names[b];
  const m = /^b(\d+)$/.exec(b);
  if (m) {
    const i = +m[1];
    return i < 4 ? FACE[labels][i] : OTHER[i - 4] ?? `Button ${i}`;
  }
  const a = /^a(\d+)([+-])$/.exec(b);
  if (a) {
    const i = +a[1];
    return AXIS[i] ? `${AXIS[i]} ${AXIS_DIR[i][a[2] === '-' ? 0 : 1]}` : `Axis ${i} ${a[2]}`;
  }
  return b;
}

/** A short glyph for the hints: "A", "L1", "◀ ▶". */
export function bindingGlyph(b: string, labels: PadLabels = 'xbox', names?: Record<string, string>): string {
  if (names?.[b]) return names[b];
  const m = /^b(\d+)$/.exec(b);
  if (m) {
    const i = +m[1];
    if (i < 4) return FACE[labels][i];
    return ['L1', 'R1', 'L2', 'R2', 'SEL', 'START', 'L3', 'R3', '▲', '▼', '◀', '▶', 'HOME'][i - 4] ?? `B${i}`;
  }
  const a = /^a(\d+)([+-])$/.exec(b);
  if (a) return `${+a[1] < 2 ? 'LS' : +a[1] < 4 ? 'RS' : `A${a[1]}`}${{ 0: a[2] === '-' ? '◀' : '▶', 1: a[2] === '-' ? '▲' : '▼' }[+a[1] % 2]}`;
  return b;
}

/** Past this an axis counts as pushed; a trigger's value past this counts as pressed. */
export const DEAD_ZONE = 0.5;

/** The bindings active now on a controller (its buttons and axes as the Gamepad API gives them). */
export function activeBindings(buttons: readonly { pressed: boolean; value: number }[], axes: readonly number[]): Set<string> {
  const on = new Set<string>();
  buttons.forEach((b, i) => { if (b.pressed || b.value > DEAD_ZONE) on.add(`b${i}`); });
  axes.forEach((v, i) => {
    if (v < -DEAD_ZONE) on.add(`a${i}-`);
    if (v > DEAD_ZONE) on.add(`a${i}+`);
  });
  return on;
}

/** The actions held now. */
export function heldActions(on: Set<string>, map: PadMap): Set<PadAction> {
  const held = new Set<PadAction>();
  for (const { action } of PAD_ACTIONS) if (map[action].some((b) => on.has(b))) held.add(action);
  return held;
}

/** Actions that repeat while held (moving and scrolling), after `REPEAT_DELAY` ms, every `REPEAT_EVERY` ms. */
export const REPEATS: ReadonlySet<PadAction> = new Set(['up', 'down', 'left', 'right', 'scrollUp', 'scrollDown']);
export const REPEAT_DELAY = 380;
export const REPEAT_EVERY = 90;

/**
 * Turns held actions into presses: an action fires when it goes down, and a repeating one fires again while held.
 * `step(held, now)` returns the actions to run this frame.
 */
export class PadRepeater {
  private since = new Map<PadAction, number>();
  private last = new Map<PadAction, number>();
  step(held: Set<PadAction>, now: number): PadAction[] {
    const out: PadAction[] = [];
    for (const a of held) {
      const t0 = this.since.get(a);
      if (t0 === undefined) {
        this.since.set(a, now);
        this.last.set(a, now);
        out.push(a);
      } else if (REPEATS.has(a) && now - t0 >= REPEAT_DELAY && now - (this.last.get(a) ?? 0) >= REPEAT_EVERY) {
        this.last.set(a, now);
        out.push(a);
      }
    }
    for (const a of [...this.since.keys()]) if (!held.has(a)) { this.since.delete(a); this.last.delete(a); }
    return out;
  }
  reset() { this.since.clear(); this.last.clear(); }
}

/** What's saved: the mapping (changed actions only), the button labels, and whether the hints show. */
export interface PadSettings {
  app: 'bw95-dynasty';
  tool: 'pad';
  version: 1;
  labels: PadLabels;
  hints: boolean;
  /** Actions whose bindings differ from the defaults. */
  map: Partial<PadMap>;
  /**
   * The user's own names for buttons, by binding (user, 2026-11-22: a Genesis 6-button pad on a USB adapter may send Z
   * as L1, so the hints should say "Z"). Up to `NAME_MAX` characters; absent = the label set's name.
   */
  names?: Record<string, string>;
}

/** The longest own button name (it has to fit the hint's small box). */
export const NAME_MAX = 6;

export const PAD_KEY = 'dynasty.pad';

export const defaultSettings = (): PadSettings => ({ app: 'bw95-dynasty', tool: 'pad', version: 1, labels: 'xbox', hints: true, map: {} });

const BINDING = /^(b\d{1,2}|a\d{1,2}[+-])$/;

/** Reads saved settings (anything unreadable falls back to the defaults). */
export function parseSettings(text: string | null): PadSettings {
  const s = defaultSettings();
  if (!text) return s;
  try {
    const o = JSON.parse(text) as Partial<PadSettings>;
    if (o.labels && PAD_LABELS.some((x) => x.value === o.labels)) s.labels = o.labels;
    if (typeof o.hints === 'boolean') s.hints = o.hints;
    if (o.names && typeof o.names === 'object') {
      const names = Object.fromEntries(Object.entries(o.names).filter(([b, n]) => BINDING.test(b) && typeof n === 'string' && n.trim() && n.length <= NAME_MAX).map(([b, n]) => [b, n.trim()]));
      if (Object.keys(names).length) s.names = names;
    }
    for (const { action } of PAD_ACTIONS) {
      const b = o.map?.[action];
      if (Array.isArray(b) && b.every((x) => typeof x === 'string' && BINDING.test(x))) s.map[action] = b;
    }
  } catch { /* defaults */ }
  return s;
}

/** The full mapping: the defaults with the user's changes. */
export const mapOf = (s: PadSettings): PadMap => ({ ...DEFAULT_MAP, ...s.map });

/** Sets an action's bindings; an action that matches the default again is dropped from the saved changes. */
export function withBinding(s: PadSettings, action: PadAction, bindings: string[]): PadSettings {
  const map = { ...s.map };
  if (bindings.join() === DEFAULT_MAP[action].join()) delete map[action];
  else map[action] = bindings;
  return { ...s, map };
}

/** Sets (or, with an empty name, clears) the user's own name for a button. */
export function withName(s: PadSettings, binding: string, name: string): PadSettings {
  const names = { ...(s.names ?? {}) };
  const n = name.trim().slice(0, NAME_MAX);
  if (n) names[binding] = n; else delete names[binding];
  const { names: _old, ...rest } = s;
  return Object.keys(names).length ? { ...rest, names } : rest;
}

/** Other actions that use the same binding (shown as a warning; both still work). */
export function clashes(map: PadMap, action: PadAction): PadAction[] {
  const mine = new Set(map[action]);
  return PAD_ACTIONS.map((x) => x.action).filter((a) => a !== action && map[a].some((b) => mine.has(b)));
}
