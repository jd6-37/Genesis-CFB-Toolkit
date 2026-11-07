// BW95 OL weight display tweak (display only, no gameplay change).
//
// The Team Rosters screen shows a player's weight as 140 + 16 × step (row routine 0x06AFB2,
// weight at 0x06B038-0x06B043). CFB 27 rosters converted by distribution matching keep the stock
// weights, which leave today's offensive linemen about 25 lb light on that screen. This patch shows
// OL rows (slots 4-8: LT, LG, C, RG, RT) 25 lb heavier. The collision physics has its own 140 at
// 0x075858/0x07586E, so play is unchanged. Installed only together with a CFB 27 conversion: on a
// stock roster it would show the stock linemen 25 lb too heavy.
//
//   0x06B03C  andi.w #$f0,d0 ; addi.w #$8c,d0  ->  jsr $1EFF20.l ; nop
//   0x1EFF20  andi.w #$f0,d0 ; addi.w #$8c,d0      stock weight
//             move.w d1,-(a7)                     d1 = print width, must survive
//             move.w 8(a7),d1                     the row's slot (d0 saved by the row routine's movem)
//             subq.w #4,d1 ; cmpi.w #4,d1 ; bhi.s +4
//             addi.w #25,d0                       OL rows only
//             move.w (a7)+,d1 ; rts
import type { RosterRom } from './rosterRom';
import type { SlotDef } from './rosterLayouts';

const hex = (s: string) => new Uint8Array(s.match(/../g)!.map((b) => parseInt(b, 16)));

export const OL_PATCH = {
  site: 0x06b03c,
  siteStock: hex('024000f00640008c'),
  sitePatched: hex('4eb9001eff20' + '4e71'),
  hook: 0x1eff20,
  hookCode: hex('024000f0' + '0640008c' + '3f01' + '322f0008' + '5941' + '0c410004' + '6204' + '06400019' + '321f' + '4e75'),
  /** Pounds added to OL rows on the roster screen. */
  pounds: 25,
};

const same = (d: Uint8Array, at: number, b: Uint8Array) => b.every((x, i) => d[at + i] === x);

export type OlPatchState = 'installed' | 'absent' | 'unknown';

/** Whether a BW95 ROM has the OL display tweak ('unknown': the site holds something else). */
export function olPatchState(data: Uint8Array): OlPatchState {
  const { site, siteStock, sitePatched, hook, hookCode } = OL_PATCH;
  if (same(data, site, sitePatched) && same(data, hook, hookCode)) return 'installed';
  if (same(data, site, siteStock)) return 'absent';
  return 'unknown';
}

export const hasOlPatch = (rom: RosterRom) => rom.game === 'bw95' && olPatchState(rom.data) === 'installed';

/**
 * Installs the tweak (BW95). Does nothing if it's already there. Throws if the patch site isn't
 * the stock code or the hook area isn't free (0xFF), so nothing else gets overwritten.
 */
export function installOlPatch(data: Uint8Array): 'installed' | 'already' {
  const { site, sitePatched, hook, hookCode } = OL_PATCH;
  const state = olPatchState(data);
  if (state === 'installed') return 'already';
  if (state !== 'absent') throw new Error('The roster screen code at 0x06B03C is not the original, so the OL weight tweak was not installed.');
  for (let a = hook; a < hook + hookCode.length; a++) {
    if (data[a] !== 0xff) {
      throw new Error(`This ROM already uses 0x${hook.toString(16).toUpperCase()}-0x${(hook + hookCode.length - 1).toString(16).toUpperCase()}, which the OL weight tweak needs.`);
    }
  }
  data.set(sitePatched, site);
  data.set(hookCode, hook);
  return 'installed';
}

/** Restores the stock bytes from a copy of the ROM taken before the tweak was installed. */
export function restoreOlPatch(data: Uint8Array, baseline: Uint8Array): void {
  const { site, siteStock, hook, hookCode } = OL_PATCH;
  data.set(baseline.subarray(site, site + siteStock.length), site);
  data.set(baseline.subarray(hook, hook + hookCode.length), hook);
}

/** Pounds the roster screen adds to this slot's weight (BW95 OL slots 4-8 with the tweak). */
export const shownWeightOffset = (rom: RosterRom, def: SlotDef) =>
  def.group === 'OL' && hasOlPatch(rom) ? OL_PATCH.pounds : 0;
