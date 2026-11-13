// Design-system check (docs/design-system.md): colors and font sizes come from the tokens.
// Fails on a raw color or a font size in px in any stylesheet under src (tokens.css is where they are defined),
// and on a raw color in the shared components' code (src/ui, stories aside).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const RGB = /\brgba?\(/g;
const FONT_PX = /font(?:-size)?:[^;]*\b\d+px/g;
const cssFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? cssFiles(join(dir, e.name)) : e.name.endsWith('.css') ? [join(dir, e.name)] : []));
const files = [
  ...cssFiles('src').filter((f) => f !== join('src', 'ui', 'tokens.css')),
  ...readdirSync('src/ui').filter((f) => f.endsWith('.tsx') && !f.endsWith('.stories.tsx')).map((f) => join('src/ui', f)),
];
let bad = 0;
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  text.split('\n').forEach((line, i) => {
    const hits = [...(line.match(HEX) ?? []), ...(line.match(RGB) ?? []), ...(f.endsWith('.css') ? line.match(FONT_PX) ?? [] : [])];
    if (hits.length) { bad++; console.error(`${f}:${i + 1}: use a token instead of ${hits.join(', ')}`); }
  });
}
if (bad) { console.error(`${bad} lines don't use tokens.`); process.exit(1); }
console.log(`${files.length} files use only tokens.`);
