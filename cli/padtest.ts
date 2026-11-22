// Controller mapping (src/core/pad.ts) and the focus search (src/ui/pad.tsx `nearest`). No ROM needed.
//   npm run test:pad
import { activeBindings, bindingName, clashes, DEFAULT_MAP, heldActions, mapOf, parseSettings, PadRepeater, REPEAT_DELAY, REPEAT_EVERY, withBinding, defaultSettings } from '../src/core/pad';
import { nearest } from '../src/ui/pad';

let pass = 0;
const ok = (c: boolean, m: string) => { if (!c) { console.error(`FAIL - ${m}`); process.exit(1); } pass++; console.log(`ok - ${m}`); };

const btn = (n: number, on: number[]) => Array.from({ length: n }, (_, i) => ({ pressed: on.includes(i), value: on.includes(i) ? 1 : 0 }));
const on = activeBindings(btn(17, [0, 5]), [0, 0.9, -0.2, -0.7]);
ok([...on].sort().join() === 'a1+,a3-,b0,b5', 'buttons and axes past the dead zone become bindings');
const held = heldActions(on, DEFAULT_MAP);
ok(held.has('confirm') && held.has('nextTab') && held.has('down') && held.has('scrollUp') && held.size === 4, 'bindings become actions (A, R1, stick down, right stick up)');
ok(bindingName('b1') === 'B' && bindingName('b1', 'playstation') === '○' && bindingName('b1', 'nintendo') === 'A' && bindingName('b4') === 'L1' && bindingName('a3+') === 'Right stick down' && bindingName('b20') === 'Button 20', 'button names by label set');

const r = new PadRepeater();
ok(r.step(new Set(['down', 'confirm']), 0).join() === 'down,confirm', 'a press fires once');
ok(r.step(new Set(['down', 'confirm']), REPEAT_DELAY - 1).length === 0, 'nothing more before the repeat delay');
ok(r.step(new Set(['down', 'confirm']), REPEAT_DELAY).join() === 'down', 'moving repeats while held, A does not');
ok(r.step(new Set(['down']), REPEAT_DELAY + REPEAT_EVERY - 1).length === 0 && r.step(new Set(['down']), REPEAT_DELAY + REPEAT_EVERY).join() === 'down', 'then every REPEAT_EVERY ms');
ok(r.step(new Set(), 2000).length === 0 && r.step(new Set(['confirm']), 2001).join() === 'confirm', 'a release lets it fire again');

let s = withBinding(defaultSettings(), 'back', ['b2']);
ok(mapOf(s).back.join() === 'b2' && clashes(mapOf(s), 'back').join() === 'primary', 'a changed button, and the clash shown');
s = withBinding(s, 'back', ['b1']);
ok(!('back' in s.map), 'setting the default again drops the change');
const back = parseSettings(JSON.stringify({ ...withBinding(defaultSettings(), 'menu', ['b16']), labels: 'nintendo', hints: false }));
ok(back.map.menu?.join() === 'b16' && back.labels === 'nintendo' && !back.hints, 'settings survive saving');
ok(Object.keys(parseSettings('{"map":{"menu":["rm -rf"]},"labels":"sega"}').map).length === 0 && parseSettings('nope').labels === 'xbox', 'bad saved settings fall back to the defaults');

const rect = (x: number, y: number, w = 100, h = 40) => ({ left: x, top: y, right: x + w, bottom: y + h, width: w, height: h, x, y, toJSON: () => 0 }) as DOMRect;
const el = (name: string) => ({ name }) as unknown as HTMLElement;
const A = el('A'), B = el('B'), C = el('C'), D = el('D');
const items = [{ el: A, r: rect(0, 60) }, { el: B, r: rect(300, 50) }, { el: C, r: rect(120, 0) }, { el: D, r: rect(0, 200) }];
ok(nearest(rect(0, 0), items, 'down') === A, 'down: the item right below');
ok(nearest(rect(0, 0), items, 'right') === C, 'right: the item in the same row first');
ok(nearest(rect(0, 60), items, 'up') === C, 'up: the closer item above, not the one far to the side');
ok(nearest(rect(0, 200), items, 'left') === null, 'nothing to the left: stays');
console.log(`\n${pass} passed`);
