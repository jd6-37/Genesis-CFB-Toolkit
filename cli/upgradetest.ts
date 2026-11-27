// Upgrading a dynasty to a newer Elevated version (src/core/dynasty/upgrade.ts).
// npm run test:upgrade -- OLD_ROM NEW_ROM SAVE
//   OLD_ROM: the 2026 Season Edition a dynasty starts on (v2.1.0 or later); NEW_ROM: a newer 2026 build whose
//   mid-season-from allows OLD_ROM's seasons (e.g. v2.1.1-test3 over v2.1.0); SAVE: a save of a season on OLD_ROM
//   (layout 2, with a user team marked). Optional fourth: a 1994 Season Edition ROM (refused as another edition).
// - The release list: an older listed release gets an offer of the current one (with its known build); the current
//   release and an unlisted build get none.
// - Timing: a running season (the first is played on the user's ROM) is "safe" when the new build continues it,
//   "later" when not; between seasons "free".
// - Experimental builds (Manage → Rules): the experimental list's newest build of the edition when its serial is
//   newer; a release beats an older test build; from a test build, the newer release; shown mid-season only when safe.
// - The ROM checks: another edition, the same version and an older one are refused.
// - applyUpgrade: the season waits for a save from the new ROM; a save still from the old ROM says so and keeps it
//   waiting; a save from the new ROM (its ELVB's last build) ends it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openRom } from '../src/core/romfile';
import { sha1Hex } from '../src/core/bytes';
import { readManifest } from '../src/core/manifest';
import { createDynasty, importSave } from '../src/core/dynasty/model';
import { assetRomProblem, refreshRomAssets, teamColorsOf } from '../src/core/dynasty/assets';
import { CFB27_LATEST } from '../src/core/cfb27Latest';
import { applyUpgrade, findUpgrade, findUpgradeAny, offerShown, pendingUpgrade, upgradeRomProblem, upgradeTiming } from '../src/core/dynasty/upgrade';
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

// The experimental list: release candidates and test builds, with their serial and mid-season-from.
const expPatch = (serial: number, midSeasonFrom: number) => ({ ...patch('2'.repeat(40), true), serial, midSeasonFrom });
const exp: PatchList = { ...list, releases: [{ version: 'rc.9', name: 'rc', notes: 'https://example.com/rc9', patches: [expPatch(mNew.serial + 2, mOld.serial)] }] };
const kOld = { sha1: sOld, serial: mOld.serial };
assert.equal(findUpgradeAny(list, null, kOld, '2026')?.version, mNew.name, 'setting off: the release');
const e1 = findUpgradeAny(list, exp, kOld, '2026');
assert.ok(e1?.experimental && e1.version === 'rc.9' && e1.build?.serial === mNew.serial + 2 && e1.notes, 'a newer test build wins');
const older: PatchList = { ...exp, releases: [{ version: 'rc.0', name: 'rc', patches: [expPatch(mNew.serial - 1, mOld.serial)] }] };
assert.equal(findUpgradeAny(list, older, kOld, '2026')?.version, mNew.name, 'the release beats an older test build');
assert.equal(findUpgradeAny(list, exp, { sha1: sNew, serial: mNew.serial }, '2026')?.version, 'rc.9', 'from the current release: the newer test build');
assert.equal(findUpgradeAny(list, older, { sha1: '3'.repeat(40), serial: mNew.serial - 1 }, '2026')?.version, mNew.name, 'from a test build: the newer release');
assert.equal(findUpgradeAny(list, exp, { sha1: '3'.repeat(40), serial: mNew.serial + 2 }, '2026'), null, 'on the newest build: nothing');
assert.equal(findUpgradeAny(list, exp, kOld, '1994')?.experimental, undefined, 'no test build of another edition');
const noSerial: PatchList = { ...exp, releases: [{ version: 'rc.x', name: 'rc', patches: [patch('4'.repeat(40), true)] }] };
assert.equal(findUpgradeAny(list, noSerial, kOld, '2026')?.version, mNew.name, 'a test build without a serial is not offered');
assert.ok(offerShown(e1, 'free') && offerShown(e1, 'safe') && !offerShown(e1, 'later') && !offerShown(e1, 'unknown'), 'test builds mid-season only when safe');
assert.ok(offerShown(findUpgradeAny(list, null, kOld, '2026'), 'later'), 'a release is still shown (as "not mid-season")');
ok('experimental list: newest build by serial, mid-season only when safe');

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
// Assets (user, 2026-11-20): an upgrade or Manage's update reads the logos' colors and the uniforms again; the user's
// uniform changes stay; another version or team count is refused for Manage's update (that's an upgrade).
{
  const base = createDynasty(oldRom, readFileSync(new URL(`../public/${CFB27_LATEST.file}`, import.meta.url), 'utf8'), { name: 'a', seed: 1, id: 'assets' });
  const same = refreshRomAssets(base, oldRom);
  assert.deepEqual(same.teams.map((t) => t.colors), base.teams.map((t) => t.colors), 'the same ROM: the same colors');
  assert.deepEqual(same.romUniforms, base.romUniforms, 'the same ROM: the same uniforms');
  const blk = teamColorsOf(oldRom)[0];
  const changed = refreshRomAssets({ ...base, ownEdits: { 0: base.romUniforms!.own[0] } }, newRom);
  assert.equal(changed.teams.length, base.teams.length);
  assert.deepEqual(changed.ownEdits?.[0], base.romUniforms!.own[0], "the user's own uniform change stays");
  assert.equal(blk.length, 4, 'four colors a team');
  assert.equal(assetRomProblem(base, oldRom, oldRom), null, 'the same version is fine');
  assert.match(assetRomProblem(base, oldRom, newRom) ?? '', /use Upgrade/, 'another version is an upgrade');
  if (path94) assert.match(assetRomProblem(base, oldRom, await rom(path94)) ?? '', /teams; the dynasty has/, 'another edition: refused');
  ok('assets: an upgrade or update reads colors and uniforms again, keeps the user\'s uniform changes; another version or edition refused for the update');
}
console.log(`${n} passed`);
