// The button tester (user, 2026-11-23: "a modal that opens with a controller and highlights the buttons as they are
// pressed … the buttons won't select or backup or anything … holding start for three seconds to close the modal
// (touch or mouse closes it too)"). The drawing, PadDiagram, is the browser's standard layout; buttons it doesn't
// have (a 6-button pad's extras on some adapters) are listed under it.
import { useEffect, useRef, useState } from 'react';
import { Button, Modal } from './index';
import { PadKey, usePad } from './pad';
import { actionsOf, bindingName, type PadLabels, type PadMap } from '../core/pad';

/** How long Start is held to close the tester, and any button as the fallback (Start mapped wrong or broken). */
export const CLOSE_START_MS = 3000;
export const CLOSE_ANY_MS = 5000;

type Part = { b: string; d: string } | { b: string; cx: number; cy: number; r: number; text?: string };

// A plain controller outline, 320 × 200. Face buttons: 0 bottom, 1 right, 2 left, 3 top.
const BODY = 'M70 46h180c34 0 52 22 60 60l8 44c5 28-12 46-34 46-16 0-26-9-34-24l-12-22H82l-12 22c-8 15-18 24-34 24-22 0-39-18-34-46l8-44c8-38 26-60 60-60z';
const PARTS: Part[] = [
  { b: 'b6', d: 'M58 8h58a8 8 0 0 1 8 8v10H50V16a8 8 0 0 1 8-8z' },
  { b: 'b7', d: 'M204 8h58a8 8 0 0 1 8 8v10h-74V16a8 8 0 0 1 8-8z' },
  { b: 'b4', d: 'M48 30h78v12H44z' },
  { b: 'b5', d: 'M194 30h78l4 12h-82z' },
  { b: 'b12', d: 'M78 70h14v18H78z' },
  { b: 'b13', d: 'M78 102h14v18H78z' },
  { b: 'b14', d: 'M58 88h20v14H58z' },
  { b: 'b15', d: 'M92 88h20v14H92z' },
  { b: 'b3', cx: 240, cy: 72, r: 11 },
  { b: 'b2', cx: 218, cy: 95, r: 11 },
  { b: 'b1', cx: 262, cy: 95, r: 11 },
  { b: 'b0', cx: 240, cy: 118, r: 11 },
  { b: 'b8', d: 'M134 78h20v10h-20z' },
  { b: 'b9', d: 'M166 78h20v10h-20z' },
  { b: 'b16', cx: 160, cy: 104, r: 7 },
  { b: 'b10', cx: 116, cy: 140, r: 16 },
  { b: 'b11', cx: 204, cy: 140, r: 16 },
];
const KNOWN = new Set(PARTS.map((p) => p.b));
const STICK: Record<string, [number, number, number, number]> = { a0: [116, 140, 1, 0], a1: [116, 140, 0, 1], a2: [204, 140, 1, 0], a3: [204, 140, 0, 1] };

/** The controller with the held buttons lit; a stick's dot moves the way it's pushed. */
export function PadDiagram({ on, labels = 'xbox', names }: { on: ReadonlySet<string>; labels?: PadLabels; names?: Record<string, string> }) {
  const stick = (n: 0 | 2) => {
    const [x0, y0] = STICK[`a${n}`];
    const dx = on.has(`a${n}+`) ? 7 : on.has(`a${n}-`) ? -7 : 0;
    const dy = on.has(`a${n + 1}+`) ? 7 : on.has(`a${n + 1}-`) ? -7 : 0;
    return <circle className={dx || dy ? 'ui-padd-on' : 'ui-padd-dot'} cx={x0 + dx} cy={y0 + dy} r={6} />;
  };
  return (
    <svg className="ui-padd" viewBox="0 0 320 200" role="img" aria-label={on.size ? `Held: ${[...on].map((b) => bindingName(b, labels, names)).join(', ')}` : 'Controller, nothing held'}>
      <path className="ui-padd-body" d={BODY} />
      {PARTS.map((p) => {
        const cls = on.has(p.b) ? 'ui-padd-on' : 'ui-padd-part';
        return 'd' in p
          ? <path key={p.b} className={cls} d={p.d} />
          : (
            <g key={p.b}>
              <circle className={cls} cx={p.cx} cy={p.cy} r={p.r} />
              {+p.b.slice(1) < 4 && <text className="ui-padd-label" x={p.cx} y={p.cy + 4}>{bindingName(p.b, labels, names).slice(0, 3)}</text>}
            </g>
          );
      })}
      {stick(0)}
      {stick(2)}
    </svg>
  );
}

/** The tester's body without the window: the drawing, the held buttons and the close bar (for Storybook). */
export function PadTestView({ on, labels, names, map, closing, closeBy }: {
  on: ReadonlySet<string>; labels: PadLabels; names?: Record<string, string>; map: PadMap;
  /** 0-1: how far the hold to close has got. */
  closing: number;
  /** The name of the button that closes it (the one mapped to Start's action). */
  closeBy: string;
}) {
  const held = [...on].sort();
  const extra = held.filter((b) => /^b\d+$/.test(b) && !KNOWN.has(b));
  return (
    <div className="ui-padtest">
      <PadDiagram on={on} labels={labels} names={names} />
      {extra.length > 0 && <p className="ui-padtest-extra">Not on the drawing: {extra.map((b) => <PadKey key={b} binding={b} labels={labels} names={names} />)}</p>}
      <div className="ui-padtest-now" aria-live="polite">
        {held.length ? held.map((b) => {
          const mine = names?.[b];
          const does = actionsOf(b, map);
          return (
            <p key={b}>
              <PadKey binding={b} labels={labels} names={names} />{' '}
              <strong>{bindingName(b, labels)}</strong>
              {mine && <> · you call it <strong>{mine}</strong></>}
              {' · '}{does || <span className="ui-padtest-none">does nothing in the app</span>}
            </p>
          );
        }) : <p className="ui-padtest-none">Press any button. Nothing happens in the app while this is open.</p>}
      </div>
      <div className="ui-padtest-close">
        <span>Hold <strong>{closeBy}</strong> for 3 seconds to close (or any button for 5)</span>
        <span className="ui-padtest-bar" aria-hidden="true"><span style={{ width: `${Math.round(closing * 100)}%` }} /></span>
      </div>
    </div>
  );
}

/** The tester window: the controller does nothing else while it's open. */
export function PadTester({ onClose }: { onClose: () => void }) {
  const pad = usePad();
  const [on, setOn] = useState<Set<string>>(new Set());
  const [closing, setClosing] = useState(0);
  const since = useRef(new Map<string, number>());
  const done = useRef(onClose);
  done.current = onClose;

  useEffect(() => {
    if (!pad) return;
    pad.mute(true);
    let last = '', lastPct = -1;
    const off = pad.watch((now) => {
      const t = performance.now();
      for (const b of now) if (!since.current.has(b)) since.current.set(b, t);
      for (const b of [...since.current.keys()]) if (!now.has(b)) since.current.delete(b);
      const key = [...now].sort().join();
      if (key !== last) { last = key; setOn(new Set(now)); }
      const startKeys = pad.map.menu;
      let pct = 0;
      for (const [b, at] of since.current) {
        const need = startKeys.includes(b) ? CLOSE_START_MS : CLOSE_ANY_MS;
        pct = Math.max(pct, (t - at) / need);
      }
      if (pct >= 1) { done.current(); return; }
      const p = Math.round(pct * 50) / 50;
      if (p !== lastPct) { lastPct = p; setClosing(p); }
    });
    return () => { off(); pad.mute(false); };
  }, [pad]);

  if (!pad) return null;
  const { settings, map } = pad;
  const closeBy = map.menu.length ? bindingName(map.menu[0], settings.labels, settings.names) : 'Start';
  return (
    <Modal title="Test your buttons" onClose={onClose} actions={<Button variant="quiet" onClick={onClose}>Close</Button>}
      sub={pad.pads.length ? pad.pads.map((p) => p.replace(/\s*\(.*\)\s*$/, '')).join(', ') : 'No controller yet: press any button on it.'}>
      <PadTestView on={on} labels={settings.labels} names={settings.names} map={map} closing={closing} closeBy={closeBy} />
    </Modal>
  );
}
