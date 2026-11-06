// Node CLI: build a swapped ROM from ROM files and a swap file, or with --default pairs.
//   tsx cli/build.ts --bw BW95.md --cf CF97.zip --out out.md (--swaps swaps.json | --pair 25=Tulane ...)
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { parseBw95 } from '../src/core/bw95';
import { parseCf97 } from '../src/core/cf97';
import { buildRom, defaultSlot, isSwapFile, SlotConfig, swapFile } from '../src/core/build';
import { openRom } from '../src/core/romfile';
import { crc32, sha1Hex } from '../src/core/bytes';

const args = process.argv.slice(2);
const opt = (k: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const pairs = args.flatMap((a, i) => (args[i - 1] === '--pair' ? [a] : []));

async function main() {
  const bwFile = await openRom(basename(opt('--bw')!), new Uint8Array(readFileSync(opt('--bw')!)));
  const cfFile = await openRom(basename(opt('--cf')!), new Uint8Array(readFileSync(opt('--cf')!)));
  if (bwFile.known?.kind !== 'bw95') throw new Error('--bw is not a supported BW95 ROM');
  if (cfFile.known?.kind !== 'cf97') throw new Error('--cf is not CF97');
  const bw = parseBw95(bwFile.data);
  const cf = parseCf97(cfFile.data);
  let swaps: SlotConfig[] = [];
  if (opt('--swaps')) {
    const sf: unknown = JSON.parse(readFileSync(opt('--swaps')!, 'utf8'));
    if (!isSwapFile(sf)) throw new Error('not a team swap file');
    swaps = sf.swaps;
  }
  for (const p of pairs) {
    const [slot, school] = p.split('=');
    const s = /^\d+$/.test(slot) ? +slot : bw.findIndex((t) => t.school === slot);
    const c = cf.find((t) => t.school === school || String(t.index) === school);
    if (s < 0 || !c) throw new Error(`bad pair ${p}`);
    swaps.push(defaultSlot(bw[s], c));
  }
  const res = buildRom(bwFile.data, bw, cf, swaps);
  writeFileSync(opt('--out')!, res.rom);
  if (opt('--save-swaps')) {
    writeFileSync(opt('--save-swaps')!, JSON.stringify(swapFile(swaps), null, 2));
  }
  console.log(
    JSON.stringify({
      out: opt('--out'),
      sha1: await sha1Hex(res.rom),
      crc32: crc32(res.rom).toString(16).toUpperCase().padStart(8, '0'),
      base: bwFile.known.label,
      walsh: res.walsh,
      order: res.order.map((i) => (swaps.find((s) => s.slot === i)?.school ?? bw[i].school)),
      blocks: Object.fromEntries(
        Object.entries(res.blocks).map(([k, v]) => [`${bw[+k].school} <- ${swaps.find((s) => s.slot === +k)!.cf97School}`, v]),
      ),
    }),
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
