// Patch tab tests: the BPS applier and the patch list, against the original ROM and a local copy of
// the Elevated repo (bring your own ROM; .md/.bin/.gen or .zip):
//   npx tsx cli/patchtest.ts BW95 path/to/Bill-Walsh-CFB-95-Elevated [CF97]
// With CF97, a Team Swap build of each patched ROM checks that it still takes a swap.
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createHash } from 'node:crypto';
import { strict as assert } from 'node:assert';
import { openRom, KNOWN } from '../src/core/romfile';
import { applyBps, bpsInfo, BpsError } from '../src/core/bps';
import { crc32 } from '../src/core/bytes';
import {
  applyListed, checkPatchFile, findRelease, offered, patchBase, patchListProblems, refFromPage, romFileName,
  type PatchList,
} from '../src/core/patches';
import { buildRom, defaultSlot, hasSwappedTeams, swappedByTeamSwap, swapProblemText } from '../src/core/build';
import { parseBw95 } from '../src/core/bw95';
import { parseCf97 } from '../src/core/cf97';

const [romPath, repo, cfPath] = process.argv.slice(2);
if (!romPath || !repo) {
  console.error('usage: tsx cli/patchtest.ts BW95 path/to/Bill-Walsh-CFB-95-Elevated [CF97]');
  process.exit(2);
}
const read = async (p: string) => (await openRom(basename(p), new Uint8Array(readFileSync(p)))).data;
const bw = await read(romPath);
const cf = cfPath ? await read(cfPath) : null;
const list = JSON.parse(readFileSync(join(repo, 'patches.json'), 'utf8')) as PatchList;
const sha1 = (d: Uint8Array) => createHash('sha1').update(d).digest('hex');
let passed = 0;
const ok = (name: string) => {
  passed++;
  console.log('ok -', name);
};
const reason = (f: () => unknown) => {
  try {
    f();
  } catch (e) {
    assert.ok(e instanceof BpsError, String(e));
    return e.reason;
  }
  assert.fail('no error');
};

// A small BPS writer, to build patches that use all four commands.
const num = (n: number): number[] => {
  const out: number[] = [];
  for (;;) {
    const x = n % 128;
    n = Math.floor(n / 128);
    if (n === 0) return [...out, 0x80 | x];
    out.push(x);
    n--;
  }
};
const le32 = (v: number) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, v >>> 24];
function makeBps(src: Uint8Array, tgt: Uint8Array, body: number[], meta = ''): Uint8Array {
  const m = [...new TextEncoder().encode(meta)];
  const head = [...new TextEncoder().encode('BPS1'), ...num(src.length), ...num(tgt.length), ...num(m.length), ...m];
  const p = [...head, ...body, ...le32(crc32(src)), ...le32(crc32(tgt))];
  return new Uint8Array([...p, ...le32(crc32(new Uint8Array(p)))]);
}
const cmd = (c: number, len: number) => num(((len - 1) << 2) | c);
const rel = (off: number) => num((Math.abs(off) << 1) | (off < 0 ? 1 : 0));

{
  // source 0..63; target = source[0..8) + "NEW!" + "NEW!NEW!" (target copy overlapping what it writes)
  // + source[40..48) + source[12..16) (source copy going back)
  const src = Uint8Array.from({ length: 64 }, (_, i) => i);
  const NEW = [78, 69, 87, 33];
  const want = [...src.subarray(0, 8), ...NEW, ...NEW, ...NEW, ...src.subarray(40, 48), ...src.subarray(12, 16)];
  const tgt = new Uint8Array(want);
  const body = [
    ...cmd(0, 8),
    ...cmd(1, 4), ...NEW,
    ...cmd(3, 8), ...rel(8),
    ...cmd(2, 8), ...rel(40),
    ...cmd(2, 4), ...rel(12 - 48),
  ];
  const p = makeBps(src, tgt, body, 'test');
  assert.deepEqual(Array.from(applyBps(src, p)), want);
  assert.equal(bpsInfo(p).metadata, 'test');
  assert.equal(reason(() => applyBps(src.subarray(1), p)), 'source');
  const other = src.slice();
  other[5] ^= 1;
  assert.equal(reason(() => applyBps(other, p)), 'source');
  const bad = p.slice();
  bad[bad.length - 20] ^= 0xff;
  assert.equal(reason(() => applyBps(src, bad)), 'patch');
  assert.equal(reason(() => applyBps(src, new TextEncoder().encode('UPS1 not a bps patch file'))), 'format');
  // A patch whose result doesn't match its own checksum.
  const wrong = makeBps(src, tgt.map((b, i) => (i === 0 ? b ^ 1 : b)), body);
  assert.equal(reason(() => applyBps(src, wrong)), 'patch');
  ok('BPS: source read, target read, source copy, overlapping target copy; wrong ROM, damaged patch, not a BPS file');
}

{
  assert.deepEqual(patchListProblems(list), []);
  assert.equal(list.original.sha1, sha1(bw), 'the first argument must be the original USA ROM');
  const bad = (edit: (m: PatchList) => void) => {
    const m = structuredClone(list);
    edit(m);
    return patchListProblems(m);
  };
  assert.ok(bad((m) => (m.version = 2 as 1)).some((x) => x.includes('version')));
  assert.ok(bad((m) => (m.tool = 'x' as 'patches')).length);
  assert.ok(bad((m) => (m.releases[0].patches[0].content = 'nope')).some((x) => x.includes('contents')));
  assert.ok(bad((m) => delete m.releases[0].patches[0].sha256).some((x) => x.includes('sha256')));
  assert.ok(bad((m) => (m.releases[0].patches[0].rom = 'ABC')).some((x) => x.includes('SHA-1')));
  assert.ok(bad((m) => (m.releases[0].patches[0].file = '../x.bps')).some((x) => x.includes('path')));
  assert.ok(bad((m) => m.releases[0].patches.push({ ...m.releases[0].patches[0] })).some((x) => x.includes('two patches')));
  assert.deepEqual(bad((m) => {
    // An older release listed without files: recognized, not offered.
    const old = structuredClone(m.releases[0]);
    old.version = 'v0.9';
    for (const p of old.patches) delete p.file, delete p.size, delete p.sha256;
    m.releases.push(old);
  }), []);
  ok('patch list: the repo\'s patches.json is valid; broken lists are caught');
}

for (const p of offered(list)) {
  const file = new Uint8Array(readFileSync(join(repo, p.file!)));
  await checkPatchFile(p, file);
  const out = await applyListed(bw, p, file);
  assert.equal(out.sha1, p.rom);
  assert.equal(sha1(out.data), p.rom);
  const hit = findRelease(list, out.sha1)!;
  assert.ok(hit.current && hit.patch === p);
  if (KNOWN[p.rom]) assert.equal(KNOWN[p.rom].kind, 'bw95'); // v1.0's ROMs are also known by SHA-1
  assert.equal(romFileName(p.file!), basename(p.file!).replace(/\.bps$/, '.md'));
  // A changed byte in the file fails the list's check before anything is applied.
  const changed = file.slice();
  changed[10] ^= 1;
  await assert.rejects(checkPatchFile(p, changed), /doesn't match the patch list/);
  // Every patched ROM takes a team swap, the 2026 Season Edition too: Team Swap swapped its teams, so it
  // can swap them again. With CF97 a swap builds on it (Pitt's slot → Tulane), and the result takes another.
  const swappedAlready = hasSwappedTeams(out.data);
  const problem = swapProblemText(out.data);
  assert.equal(problem, null);
  assert.equal(swappedByTeamSwap(out.data), swappedAlready);
  if (cf) {
    const bwTeams = parseBw95(out.data);
    const cfTeams = parseCf97(cf);
    const tulane = cfTeams.find((t) => t.school === 'Tulane')!;
    const swapped = buildRom(out.data, bwTeams, cfTeams, [defaultSlot(bwTeams[25], tulane)]).rom;
    assert.equal(swappedByTeamSwap(swapped), true);
    assert.equal(swapProblemText(swapped), null);
  }
  ok(`${p.name}: applies to the original ROM, SHA-1 ${p.rom.slice(0, 8)}…${swappedAlready ? ', teams already swapped' : ''}${cf ? ', takes a team swap' : ''}`);
}

{
  assert.equal(findRelease(list, sha1(bw)), null);
  assert.equal(hasSwappedTeams(bw), false);
  assert.equal(refFromPage(''), 'main');
  assert.equal(refFromPage('?patches=feature/patch-list'), 'feature/patch-list');
  assert.equal(refFromPage('?patches=../../evil'), 'main');
  assert.equal(refFromPage('?patches=a b'), 'main');
  assert.equal(patchBase('main'), 'https://raw.githubusercontent.com/jd6-37/Bill-Walsh-CFB-95-Elevated/main/');
  ok('the original ROM isn\'t a release; the ?patches= branch setting');
}

console.log(`${passed} passed`);
