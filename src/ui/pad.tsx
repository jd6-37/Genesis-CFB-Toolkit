// The controller layer (src/core/pad.ts has the mapping): moves the focus with the D-pad or stick, presses with A,
// goes back with B, switches tabs with L1/R1, and shows the button hints while a controller is in use. Pages need
// nothing special: any link, button or field can be reached. Marks a page can add:
//   data-pad="primary" / "secondary"  the button X / Y presses (without one, X presses the view's only primary button)
//   data-pad="prev" / "next"          what L2 / R2 open (the previous / next player, week)
//   data-pad-label="Offer"            the button's name in the hints (else its text)
//   role="tablist" (the Tabs component) or data-pad-tabs   what L1 / R1 switch; without one, the app's menu
//   data-pad-start                    where the focus starts on a page (else the first item in <main>)
//   data-pad-menu                     the button Start presses (the app menu; Start closes it again)
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  activeBindings, bindingGlyph, defaultSettings, heldActions, mapOf, PAD_KEY, PadRepeater, parseSettings,
  type PadAction, type PadMap, type PadSettings,
} from '../core/pad';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

const visible = (el: Element) => {
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return false;
  const s = getComputedStyle(el);
  return s.visibility !== 'hidden' && s.display !== 'none' && !el.closest('[inert], [aria-hidden="true"]');
};

/** Where the controller works now: the topmost open window, else the page. */
function scope(): HTMLElement {
  const dialogs = [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"], dialog[open]')].filter(visible);
  return dialogs[dialogs.length - 1] ?? document.body;
}

const focusables = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible);

function focusEl(el: HTMLElement) {
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  // Keep it clear of the sticky masthead and the hint bar.
  const r = el.getBoundingClientRect();
  const bar = document.querySelector('.ui-padbar')?.getBoundingClientRect().height ?? 0;
  if (r.bottom > window.innerHeight - bar) window.scrollBy(0, r.bottom - (window.innerHeight - bar) + 8);
}

type Dir = 'up' | 'down' | 'left' | 'right';

/** The nearest item in a direction (the gap along the direction, then how far off to the side, counts double). */
export function nearest(from: DOMRect, items: { el: HTMLElement; r: DOMRect }[], dir: Dir): HTMLElement | null {
  const cx = (r: DOMRect) => r.left + r.width / 2, cy = (r: DOMRect) => r.top + r.height / 2;
  let best: HTMLElement | null = null, bestScore = Infinity;
  for (const { el, r } of items) {
    let gap: number, side: number;
    if (dir === 'down' || dir === 'up') {
      gap = dir === 'down' ? r.top - from.bottom : from.top - r.bottom;
      if ((dir === 'down' ? cy(r) <= cy(from) + 1 : cy(r) >= cy(from) - 1)) continue;
      const overlap = Math.min(r.right, from.right) - Math.max(r.left, from.left);
      side = overlap > 0 ? 0 : Math.abs(cx(r) - cx(from));
    } else {
      gap = dir === 'right' ? r.left - from.right : from.left - r.right;
      if ((dir === 'right' ? cx(r) <= cx(from) + 1 : cx(r) >= cx(from) - 1)) continue;
      const overlap = Math.min(r.bottom, from.bottom) - Math.max(r.top, from.top);
      side = overlap > 0 ? 0 : Math.abs(cy(r) - cy(from));
    }
    const score = Math.max(0, gap) + 2 * side;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  return best;
}

function current(root: HTMLElement): HTMLElement | null {
  const a = document.activeElement as HTMLElement | null;
  return a && a !== document.body && root.contains(a) && a.matches(FOCUSABLE) && visible(a) ? a : null;
}

/** Where the focus starts: a marked item, the open tab, or the first item in the page's main part. */
function start(root: HTMLElement): HTMLElement | null {
  const items = focusables(root);
  const marked = items.find((el) => el.matches('[data-pad-start]'));
  if (marked) return marked;
  const main = root.querySelector('main') ?? root;
  const inView = items.filter((el) => main.contains(el)).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  });
  return inView[0] ?? items.find((el) => main.contains(el)) ?? items[0] ?? null;
}

/** ◀ ▶ on a value: a dropdown takes the previous / next choice, a number or range field steps. */
function adjust(el: HTMLElement, by: 1 | -1): boolean {
  if (el instanceof HTMLSelectElement) {
    const opts = [...el.options].filter((o) => !o.disabled && !o.hidden);
    const i = opts.findIndex((o) => o.value === el.value);
    const next = opts[Math.max(0, Math.min(opts.length - 1, i + by))];
    if (!next || next.value === el.value) return true;
    setValue(el, next.value);
    return true;
  }
  if (el instanceof HTMLInputElement && (el.type === 'number' || el.type === 'range')) {
    if (by > 0) el.stepUp(); else el.stepDown();
    setValue(el, el.value);
    return true;
  }
  return false;
}

/** Sets a field's value so React sees it (its own setter, then the events). */
function setValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** The tab strip L1 / R1 switch: the one holding the focus, else the first on the page, else the app's menu. */
function tabStrip(root: HTMLElement): HTMLElement | null {
  const strips = [...root.querySelectorAll<HTMLElement>('[role="tablist"], [data-pad-tabs]')].filter(visible);
  const a = document.activeElement;
  return strips.find((s) => s.contains(a)) ?? strips[0] ?? (root === document.body ? [...document.querySelectorAll<HTMLElement>('.ui-appbar-nav, .ui-nav')].find(visible) ?? null : null);
}

function switchTab(strip: HTMLElement, by: 1 | -1) {
  const tabs = [...strip.querySelectorAll<HTMLElement>('[role="tab"], a[href], button:not([disabled])')].filter((el) => visible(el) && el.getAttribute('aria-disabled') !== 'true');
  if (!tabs.length) return;
  const i = Math.max(0, tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true' || t.getAttribute('aria-current') === 'page'));
  const next = tabs[(i + by + tabs.length) % tabs.length];
  const hadFocus = strip.contains(document.activeElement);
  next.click();
  if (hadFocus || strip.matches('[role="tablist"]')) requestAnimationFrame(() => next.isConnected && focusEl(next));
}

/** The button X (primary) or Y (secondary) presses. */
function actionButton(root: HTMLElement, which: 'primary' | 'secondary'): HTMLElement | null {
  const marked = [...root.querySelectorAll<HTMLElement>(`[data-pad="${which}"]`)].filter((el) => visible(el) && !(el as HTMLButtonElement).disabled);
  if (marked.length) return marked[0];
  if (which === 'secondary') return null;
  const primary = [...root.querySelectorAll<HTMLElement>('button.ui-button:not(.ui-button-quiet):not(.ui-button-danger):not(.ui-button-link):not([disabled]), a.ui-button[href]:not(.ui-button-quiet):not(.ui-button-danger)')].filter(visible);
  return primary.length === 1 ? primary[0] : null;
}

const marked = (root: HTMLElement, which: 'prev' | 'next') => [...root.querySelectorAll<HTMLElement>(`[data-pad="${which}"]`)].find(visible) ?? null;

function scroller(el: Element | null): HTMLElement | null {
  for (let n = el?.parentElement ?? null; n && n !== document.body; n = n.parentElement) {
    const s = getComputedStyle(n);
    if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1) return n;
  }
  return null;
}

const labelOf = (el: HTMLElement | null) => {
  if (!el) return null;
  const t = (el.dataset.padLabel ?? el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim();
  return t.length > 28 ? `${t.slice(0, 26)}…` : t;
};

/** The hint bar's entries for the page as it is now. */
export interface PadHint { action: PadAction | 'tabs' | 'items' | 'adjust'; text: string }
function hintsNow(): PadHint[] {
  const root = scope();
  const out: PadHint[] = [];
  const cur = current(root);
  if (cur) out.push({ action: 'confirm', text: cur instanceof HTMLSelectElement ? 'Choices' : cur instanceof HTMLInputElement && cur.type !== 'checkbox' && cur.type !== 'radio' ? 'Type' : 'Choose' });
  out.push({ action: 'back', text: root === document.body ? 'Back' : 'Close' });
  const p = labelOf(actionButton(root, 'primary'));
  if (p) out.push({ action: 'primary', text: p });
  const s = labelOf(actionButton(root, 'secondary'));
  if (s) out.push({ action: 'secondary', text: s });
  if (cur && (cur instanceof HTMLSelectElement || (cur instanceof HTMLInputElement && (cur.type === 'number' || cur.type === 'range')))) out.push({ action: 'adjust', text: 'Change' });
  if (marked(root, 'prev') || marked(root, 'next')) out.push({ action: 'items', text: labelOf(marked(root, 'next')) ?? 'Prev / next' });
  if (tabStrip(root)) out.push({ action: 'tabs', text: 'Tabs' });
  return out;
}

interface PadApi {
  settings: PadSettings;
  setSettings: (s: PadSettings) => void;
  map: PadMap;
  /** A controller is in use (the last input came from one). */
  active: boolean;
  /** Names of the connected controllers. */
  pads: string[];
  /** The next binding pressed goes to `cb` (a new button or stick direction; the layer does nothing else meanwhile). */
  capture: (cb: ((binding: string) => void) | null) => void;
  /** Calls `cb` with the bindings held, every frame, while subscribed (the Manage page's test). */
  watch: (cb: (on: Set<string>) => void) => () => void;
}

const PadCtx = createContext<PadApi | null>(null);
export const usePad = () => useContext(PadCtx);

function loadSettings(): PadSettings {
  try { return parseSettings(localStorage.getItem(PAD_KEY)); } catch { return defaultSettings(); }
}

/**
 * The controller layer for an app: wrap the app in it. Polls the controllers while any is connected, runs the
 * actions on the page, marks the document `data-input="pad"` while a controller is in use (the focus frame and the
 * hint bar show then), and back to `pointer` on a touch or a mouse move.
 */
export function PadLayer({ children }: { children: ReactNode }) {
  const [settings, setSettingsState] = useState<PadSettings>(loadSettings);
  const [active, setActive] = useState(false);
  const [pads, setPads] = useState<string[]>([]);
  const [hints, setHints] = useState<PadHint[]>([]);
  const map = useMemo(() => mapOf(settings), [settings]);
  const mapRef = useRef(map);
  mapRef.current = map;
  const captureRef = useRef<((b: string) => void) | null>(null);
  const watchers = useRef(new Set<(on: Set<string>) => void>());
  const inApp = useRef(0);

  const setSettings = useCallback((s: PadSettings) => {
    setSettingsState(s);
    try { localStorage.setItem(PAD_KEY, JSON.stringify(s)); } catch { /* storage off: this visit only */ }
  }, []);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Pointer or touch: the controller look goes away until the next press.
  useEffect(() => {
    const off = () => { if (document.documentElement.dataset.input === 'pad') { document.documentElement.dataset.input = 'pointer'; setActive(false); } };
    let x = -1, y = -1;
    const move = (e: MouseEvent) => {
      if (x >= 0 && Math.abs(e.clientX - x) + Math.abs(e.clientY - y) > 6) off();
      x = e.clientX; y = e.clientY;
    };
    const hash = () => { inApp.current++; };
    window.addEventListener('pointerdown', off, true);
    window.addEventListener('wheel', off, { passive: true });
    window.addEventListener('mousemove', move);
    window.addEventListener('hashchange', hash);
    return () => {
      window.removeEventListener('pointerdown', off, true);
      window.removeEventListener('wheel', off);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('hashchange', hash);
    };
  }, []);

  const run = useCallback((a: PadAction) => {
    const root = scope();
    const cur = current(root);
    const go = (el: HTMLElement | null) => { if (el) focusEl(el); };
    switch (a) {
      case 'up': case 'down': case 'left': case 'right': {
        if (!cur) return go(start(root));
        if ((a === 'left' || a === 'right') && adjust(cur, a === 'right' ? 1 : -1)) return;
        const items = focusables(root).filter((el) => el !== cur && !el.contains(cur) && !cur.contains(el)).map((el) => ({ el, r: el.getBoundingClientRect() }));
        return go(nearest(cur.getBoundingClientRect(), items, a));
      }
      case 'confirm': {
        if (!cur) return go(start(root));
        if (cur instanceof HTMLSelectElement) { try { cur.showPicker(); } catch { /* ◀ ▶ change it */ } return; }
        if (cur instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'file'].includes(cur.type)) { cur.focus(); return; }
        cur.click();
        return;
      }
      case 'back': {
        if (root !== document.body) {
          const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
          document.dispatchEvent(esc);
          return;
        }
        const own = [...root.querySelectorAll<HTMLElement>('[data-pad="back"]')].find(visible);
        if (own) { own.click(); return; }
        if (inApp.current > 0) { inApp.current -= 2; history.back(); }
        return;
      }
      case 'primary': case 'secondary': actionButton(root, a)?.click(); return;
      case 'prevTab': case 'nextTab': { const s = tabStrip(root); if (s) switchTab(s, a === 'nextTab' ? 1 : -1); return; }
      case 'prevItem': case 'nextItem': marked(root, a === 'nextItem' ? 'next' : 'prev')?.click(); return;
      case 'scrollUp': case 'scrollDown': {
        const by = a === 'scrollDown' ? 140 : -140;
        const s = scroller(cur);
        if (s) s.scrollBy({ top: by }); else window.scrollBy({ top: by });
        return;
      }
      case 'menu': {
        // The app menu (shell.tsx): Start opens it, and closes it again.
        if (root.matches('[data-menu-drawer]')) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return; }
        const button = [...document.querySelectorAll<HTMLElement>('[data-pad-menu]')].find(visible);
        if (button) { button.click(); return; }
        const nav = document.querySelector<HTMLElement>('.ui-nav [aria-current="page"]') ?? document.querySelector<HTMLElement>('.ui-nav a[href]');
        if (nav) { window.scrollTo({ top: 0 }); go(nav); }
        return;
      }
      case 'hints': setSettings({ ...settingsRef.current, hints: !settingsRef.current.hints }); return;
    }
  }, [setSettings]);

  // The loop: runs while a controller is connected.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('getGamepads' in navigator)) return;
    let raf = 0, running = false, lastHints = 0;
    const rep = new PadRepeater();
    let prevOn = new Set<string>();
    const frame = (now: number) => {
      const list = [...navigator.getGamepads()].filter((g): g is Gamepad => !!g && g.connected);
      if (!list.length) { running = false; return; }
      const on = new Set<string>();
      for (const g of list) for (const b of activeBindings(g.buttons, g.axes)) on.add(b);
      watchers.current.forEach((w) => w(on));
      const cap = captureRef.current;
      if (cap) {
        const fresh = [...on].find((b) => !prevOn.has(b));
        if (fresh) { captureRef.current = null; rep.reset(); cap(fresh); }
      } else {
        const fired = rep.step(heldActions(on, mapRef.current), now);
        if (fired.length) {
          if (document.documentElement.dataset.input !== 'pad') { document.documentElement.dataset.input = 'pad'; setActive(true); }
          fired.forEach(run);
          lastHints = 0;
        }
        if (document.documentElement.dataset.input === 'pad' && now - lastHints > 250) { lastHints = now; setHints(hintsNow()); }
      }
      prevOn = on;
      raf = requestAnimationFrame(frame);
    };
    const begin = () => {
      setPads([...navigator.getGamepads()].filter((g): g is Gamepad => !!g && g.connected).map((g) => g.id));
      if (!running) { running = true; raf = requestAnimationFrame(frame); }
    };
    const gone = () => setPads([...navigator.getGamepads()].filter((g): g is Gamepad => !!g && g.connected).map((g) => g.id));
    window.addEventListener('gamepadconnected', begin);
    window.addEventListener('gamepaddisconnected', gone);
    if ([...navigator.getGamepads()].some((g) => g?.connected)) begin();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('gamepadconnected', begin);
      window.removeEventListener('gamepaddisconnected', gone);
    };
  }, [run]);

  const api = useMemo<PadApi>(() => ({
    settings, setSettings, map, active, pads,
    capture: (cb) => { captureRef.current = cb; },
    watch: (cb) => { watchers.current.add(cb); return () => watchers.current.delete(cb); },
  }), [settings, setSettings, map, active, pads]);

  return (
    <PadCtx.Provider value={api}>
      {children}
      {active && settings.hints && <PadBar hints={hints} map={map} settings={settings} />}
    </PadCtx.Provider>
  );
}

/** A controller button as a small mark: a circle for a face button, a rounded box for the others. */
export function PadKey({ binding, labels = 'xbox' }: { binding: string; labels?: PadSettings['labels'] }) {
  const g = bindingGlyph(binding, labels);
  const face = /^b[0-3]$/.test(binding);
  return <span className={face ? 'ui-padkey ui-padkey-face' : 'ui-padkey'}>{g}</span>;
}

const PAIRS: Record<string, [PadAction, PadAction]> = { tabs: ['prevTab', 'nextTab'], items: ['prevItem', 'nextItem'], adjust: ['left', 'right'] };

/** The hint bar along the bottom while a controller is in use: what each button does on this page. */
export function PadBar({ hints, map, settings }: { hints: PadHint[]; map: PadMap; settings: PadSettings }) {
  const keys = (h: PadHint) => {
    const pair = PAIRS[h.action];
    const acts = pair ?? [h.action as PadAction];
    // The first button bound to each action (a D-pad direction before a stick).
    return acts.map((a) => map[a][0]).filter(Boolean);
  };
  const right = new Set(['tabs', 'items', 'adjust']);
  const item = (h: PadHint) => (
    <span key={h.action} className="ui-padbar-item">
      {keys(h).map((b) => <PadKey key={b} binding={b} labels={settings.labels} />)}
      <span>{h.text}</span>
    </span>
  );
  return (
    <div className="ui-padbar" aria-hidden="true">
      <div className="ui-padbar-side">{hints.filter((h) => !right.has(h.action)).map(item)}</div>
      <div className="ui-padbar-side">{hints.filter((h) => right.has(h.action)).map(item)}</div>
    </div>
  );
}
