// Dynasty snapshots: the file round-trips, the keys stay out, pictures survive packing, ids come from keys.
// npm run test:snapshot -- [path/to/file.dynasty.json]
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeSnapshot, packPicture, readSnapshot, unpackPicture, snapshotLabel } from '../src/core/dynasty/snapshot';
import { isSnapshotId, isSnapshotKey, newSnapshotKey, snapshotIdFromPath, snapshotIdOf, snapshotPath } from '../src/core/dynasty/snapshotId';
import { dynastyFromFile, DYNASTY_FILE, type Dynasty } from '../src/core/dynasty/model';

let n = 0;
const ok = (what: string) => { n++; console.log(`ok ${what}`); };

const key = newSnapshotKey();
assert.ok(isSnapshotKey(key), 'key format');
const id = await snapshotIdOf(key);
assert.ok(isSnapshotId(id) && id === await snapshotIdOf(key) && id !== await snapshotIdOf(newSnapshotKey()));
assert.equal(snapshotPath(id), `s/${id}.json.gz`);
assert.equal(snapshotIdFromPath(`/dynasty/s/${id}`), id);
assert.equal(snapshotIdFromPath('/dynasty'), null);
assert.equal(snapshotIdFromPath('/dynasty/s/../x'), null);
ok('keys and ids');

const pic = { width: 3, height: 2, data: new Uint8ClampedArray([0, 0, 0, 0, 255, 0, 0, 255, 255, 0, 0, 255, 1, 2, 3, 255, 0, 0, 0, 0, 9, 9, 9, 128]) };
const back = unpackPicture(packPicture(pic))!;
assert.deepEqual([back.width, back.height, [...back.data]], [3, 2, [...pic.data]]);
assert.equal(packPicture(null), null);
ok('pictures pack and unpack');

const file = process.argv[2];
const d: Dynasty = file ? JSON.parse(readFileSync(file, 'utf8')) : JSON.parse(JSON.stringify({ ...DYNASTY_FILE, id: 'x', name: 'Test', teams: [{ school: 'A' }], players: [], seasons: [{ year: 2026 }], userTeams: [0] }));
d.version = DYNASTY_FILE.version;
d.snapshots = [{ id, key, team: d.userTeams[0], label: 'x', sharedAt: '2026-11-17T00:00:00Z' }];
const art = d.teams.map(() => ({ logo: pic, helmet: null, word: pic }));
const bytes = await makeSnapshot(d, d.userTeams[0], '2026, after Week 2', art, new Date('2026-11-17T12:00:00Z'));
assert.ok(!new TextDecoder().decode(bytes).includes(key));
const snap = await readSnapshot(bytes);
assert.equal(snap.team, d.userTeams[0]);
assert.equal(snap.label, '2026, after Week 2');
assert.equal(snap.sharedAt, '2026-11-17T12:00:00.000Z');
assert.equal(snap.dynasty.snapshots, undefined, 'no keys in a snapshot');
assert.equal(JSON.stringify(snap.dynasty).includes(key), false);
assert.equal(snap.dynasty.players.length, d.players.length);
assert.equal(snap.art!.length, d.teams.length);
assert.deepEqual([...snap.art![0].logo!.data], [...pic.data]);
assert.equal(snap.art![0].word, null, 'no wordmarks');
if (file) dynastyFromFile(snap.dynasty);
console.log(`  ${(bytes.length / 1024).toFixed(0)} KB compressed`);
ok('a dynasty round-trips without its keys');

await assert.rejects(readSnapshot(new Uint8Array([1, 2, 3])), /can't be read/);
ok('junk is refused');

assert.equal(snapshotLabel(2026, { offseason: false, done: false, week: 'Week 2' }), '2026, after Week 2');
assert.equal(snapshotLabel(2026, { offseason: false, done: false, week: null }), '2026, preseason');
assert.equal(snapshotLabel(2026, { offseason: false, done: true, week: 'Week 14' }), '2026 season, final');
assert.equal(snapshotLabel(2026, { offseason: true, done: true, week: null }), '2026 offseason');
ok('labels');
// The upload function: a token only for the path the key makes (token signing is local; a fake store key does).
process.env.BLOB_READ_WRITE_TOKEN ||= 'vercel_blob_rw_TESTSTORE123_fakesecretfakesecret';
{
  const { POST, GET, DELETE } = await import('../api/snapshot');
  const req = (body: unknown, method = 'POST') => new Request('https://x.test/api/snapshot', { method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
  const tok = (pathname: string, clientPayload: string | null) => ({ type: 'blob.generate-client-token', payload: { pathname, clientPayload, multipart: false } });
  assert.equal((await POST(req(tok(snapshotPath(id), key)))).status, 200, 'token for the key\'s own path');
  for (const body of [tok('s/AAAAAAAAAAAA.json.gz', key), tok(snapshotPath(id), null), tok('x/page.html', key), { nope: 1 }]) assert.equal((await POST(req(body))).status, 400);
  assert.equal((await GET(new Request('https://x.test/api/snapshot?id=../x'))).status, 400);
  assert.equal((await DELETE(req({ key: 'nope' }, 'DELETE'))).status, 400);
  ok('the upload function gives tokens only for a key\'s own snapshot');
}
console.log(`${n} passed`);
