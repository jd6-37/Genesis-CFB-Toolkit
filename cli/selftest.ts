// Prints a digest of every decoded CF97 team so it can be compared with the Python reference.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseCf97 } from '../src/core/cf97';
const d = new Uint8Array(readFileSync(process.argv[2]));
const t0 = Date.now();
const teams = parseCf97(d);
const h = createHash('sha1');
for (const t of teams) h.update(t.tiles);
console.log(teams.length, 'teams', h.digest('hex'), `${Date.now() - t0} ms`);
