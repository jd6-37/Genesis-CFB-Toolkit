// Upgrading a dynasty to a newer Elevated version (src/core/dynasty/upgrade.ts).
// npm run test:upgrade -- OLD_ROM NEW_ROM SAVE
//   OLD_ROM: the 2026 Season Edition a dynasty starts on (v2.1.0 or later); NEW_ROM: a newer 2026 build whose
//   mid-season-from allows OLD_ROM's seasons (e.g. v2.1.1-test3 over v2.1.0); SAVE: a save of a season on OLD_ROM
//   (layout 2, with a user team marked). Optional fourth: a 1994 Season Edition ROM (refused as another edition).
// - The release list: an older listed release gets an offer of the current one (with its known build); the current
//   release and an unlisted build get none.
// - Timing: a running season (the first is played on the user's ROM) is "safe" when the new build continues it,
//   "later" when not; between seasons "free".
// - The ROM checks: another edition, the same version and an older one are refused.
// - applyUpgrade: the season waits for a save from the new ROM; a save still from the old ROM says so and keeps it
//   waiting; a save from the new ROM (its ELVB's last build) ends it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openRom } from '../src/core/romfile';
import { sha1Hex } from '../src/core/bytes';
import { readManifest } from '../src/core/manifest';
import { createDynasty, importSave } from '../src/core/dynasty/model';
import { applyUpgrade, findUpgrade, pendingUpgrade, upgradeRomProblem, upgradeTiming } from '../src/core/dynasty/upgrade';
import type { PatchList } from '../src/core/patches';

let n = 0;
const ok = (what: string) => { n++; console.log(`ok - ${what}`); };
const [oldPath, newPath, savePath, path94] = process.argv.slice(2);
if (!oldPath || !newPath || !savePath) throw new Error('usage: test:upgrade -- OLD_ROM NEW_ROM SAVE [ROM_1994]');
const rom = async (p: string) => (await openRom(p, new Uint8Array(readFileSync(p)))).data;
const oldRom = await rom(oldPath), newRom = await rom(newPath);
const mOld = readManifest(oldRom)!, mNew = readManifest(newRom)!;
assert.ok(mOld && mNew && mNew.serial > mOld.serial, 'NEW_ROM is a newer build');

// The release list.
const sOld = await sha1Hex(oldRom), sNew = await sha1Hex(newRom);
const patch = (rom: string, file?: boolean) => ({ content: 'elevated-2026', fatigue: 'fixed', name: 'x', rom, ...(file ? { file: 'p.bps', size: 1, sha256: '0'.repeat(64) } : {}) });
const list: PatchList = {
  app: 'x', tool: 'patches', version: 1, original: { name: 'o', sha1: '0'.repeat(40) },
  contents: [{ id: 'elevated-2026', label: '2026' }], fatigue: [{ id: 'fixed', label: 'Fixed' }],
  releases: [{ version: mNew.name, name: 'new', patches: [patch(sNew, true)] }, { version: mOld.name, name: 'old', patches: [patch(sOld)] }],
};
const offer = findUpgrade(list, sOld, '2026');
assert.equal(offer?.version, mNew.name);
assert.equal(offer?.build?.serial, mNew.serial, 'the known build of the release');
assert.equal(findUpgrade(list, sNew, '2026'), null, 'the current release: no offer');
assert.equal(findUpgrade(list, '1'.repeat(40), '2026'), null, 'an unlisted build: no offer');
assert.equal(findUpgrade(list, sOld, '1994'), null, 'another edition: no offer');
ok(`release list: ${mOld.name} is offered ${mNew.name}`);

// A dynasty on the old ROM, in its first season (played on the user's ROM: counts as started).
let d = createDynasty(oldRom, readFileSync('public/data/ea-cfb27-ratings-2026-week9.csv', 'utf8'), { name: 'x', seed: 1 });
assert.equal(d.seasons[0].romBuild?.serial, mOld.serial);
assert.equal(upgradeTiming(d, mNew), mOld.serial >= mNew.midSeasonFrom ? 'safe' : 'later');
assert.equal(upgradeTiming(d, { midSeasonFrom: mOld.serial + 1 }), 'later', 'a build that can\'t continue the season');
assert.equal(upgradeTiming(d, undefined), 'unknown');
assert.equal(upgradeTiming({ ...d, offseason: { year: d.seasons[0].year } as never }, { midSeasonFrom: 999 }), 'free', 'between seasons');
ok('timing: safe mid-season by mid-season-from, later when not, free between seasons');

assert.equal(upgradeRomProblem(d, oldRom, newRom), null, 'the newer build is taken');
assert.match(upgradeRomProblem(d, oldRom, oldRom) ?? '', /already plays on/);
assert.match(upgradeRomProblem(d, newRom, oldRom) ?? '', /older than/);
if (path94) assert.match(upgradeRomProblem(d, oldRom, await rom(path94)) ?? '', /isn't the/);
ok('ROM checks: same, older and another edition refused');

// Mid-season: the season waits for a save from the new ROM.
d = applyUpgrade(d, oldRom, newRom);
const pend = pendingUpgrade(d);
assert.equal(pend?.from.serial, mOld.serial);
assert.equal(pend?.to.serial, mNew.serial);
assert.equal(d.seasons[0].romBuild?.serial, mNew.serial);
const save = new Uint8Array(readFileSync(savePath));
const r1 = importSave(d, save);
assert.match(r1.warning ?? '', /still from/, 'a save from the old ROM says so');
assert.ok(pendingUpgrade(r1.dynasty), 'and the upgrade keeps waiting');
// The same save as the new ROM writes it: ELVB's last build = the new one (window format: data on odd bytes).
const data = save.filter((_, i) => i & 1);
const at = Buffer.from(data).indexOf('ELVB');
assert.ok(at >= 0, 'the save has ELVB');
const moved = save.slice();
const put = (k: number, v: number) => { moved[2 * (at + k) + 1] = v; };
[24, 16, 8, 0].forEach((sh, k) => put(0x10 + k, (mNew.serial >>> sh) & 255));
mNew.buildNumber.forEach((b, k) => put(0x14 + k, b));
const r2 = importSave(d, moved, { allowOlder: true });
assert.equal(r2.upgraded, mNew.name, 'a save from the new ROM ends the upgrade');
assert.equal(pendingUpgrade(r2.dynasty), null);
assert.doesNotMatch(r2.warning ?? '', /still from|isn't safe/);
ok(`mid-season upgrade ${mOld.name} → ${mNew.name}: waits, warns on an old-ROM save, done on a new-ROM save`);
console.log(`${n} passed`);
