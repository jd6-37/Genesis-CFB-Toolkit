// Design-system check (docs/design-system.md): the shared components may only use tokens.
// Fails on a raw color in src/ui (outside tokens.css) or a raw font size in ui.css.
// The older stylesheets (src/styles.css, src/tools/dynasty/dynasty.css) are listed with their counts until
// they have moved onto the tokens; they don't fail the check yet.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const RGB = /\brgba?\(/g;
const FONT_PX = /font(?:-size)?:[^;]*\b\d+px/g;
let bad = 0;
for (const f of readdirSync('src/ui')) {
  if (f === 'tokens.css' || f.endsWith('.stories.tsx')) continue;
  const text = readFileSync(join('src/ui', f), 'utf8');
  text.split('\n').forEach((line, i) => {
    const hits = [...(line.match(HEX) ?? []), ...(line.match(RGB) ?? []), ...(f.endsWith('.css') ? line.match(FONT_PX) ?? [] : [])];
    if (hits.length) { bad++; console.error(`src/ui/${f}:${i + 1}: use a token instead of ${hits.join(', ')}`); }
  });
}
for (const f of ['src/styles.css', 'src/tools/dynasty/dynasty.css']) {
  const text = readFileSync(f, 'utf8');
  console.log(`${f}: ${new Set(text.match(HEX) ?? []).size} raw colors, ${new Set(text.match(/font-size: \d+px/g) ?? []).size} font sizes (not on the tokens yet)`);
}
if (bad) { console.error(`${bad} lines in src/ui don't use tokens.`); process.exit(1); }
console.log('src/ui uses only tokens.');
