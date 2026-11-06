// Builds a BW95 ROM with CF97 teams swapped in. Pure functions, no DOM: used by the web app
// and by the Node CLI that the emulator tests run.

import { rl, rw, wl, ww } from './bytes';
import { BwTeam, BW_TEAMS, BW_TABLE } from './bw95';
import { CfTeam } from './cf97';
import { defaultEndZone, mapUniform } from './colors';
import { CITY, MAX_LEN, NAME_CHARS, NICKNAME_FIX, UNIFORM_FIX } from './defaults';
import { CELEBRATION, END_ZONE, HELMET_BASE, MENU_ORDER } from './helpers68k';
import { buildGenericCelebration, CELEB_ADDR, CELEB_TABLE, defaultCelebration } from './celebration';
import { bbox, packTiles, Sprite, writeGroups } from './sprites';
import { rewriteWalsh } from './walsh';

export interface SlotConfig {
  slot: number; // BW95 team index 0-35
  cf97: number; // CF97 record index
  cf97School: string; // CF97 school name, to catch a swap file made for a different ROM
  school: string;
  city: string;
  nickname: string;
  home: number[]; // 16 BW95 uniform words
  away: number[];
  endZone: number; // used as-is for this team's home end zones
  celebration?: number[]; // [cards, skirts and pom-poms, tops] for the GO TEAM! card stunt
}

export interface SwapFile {
  app: 'genesis-cfb-toolkit';
  tool: 'team-swap';
  version: 1;
  swaps: SlotConfig[];
}

/** Swap files saved before the rename to Genesis CFB Toolkit say { app: 'bw95-team-swap' }. */
export function isSwapFile(x: unknown): x is SwapFile {
  const f = x as { app?: unknown; tool?: unknown; version?: unknown; swaps?: unknown } | null;
  if (!f || f.version !== 1 || !Array.isArray(f.swaps)) return false;
  return (f.app === 'genesis-cfb-toolkit' && f.tool === 'team-swap') || f.app === 'bw95-team-swap';
}

export function swapFile(swaps: SlotConfig[]): SwapFile {
  return { app: 'genesis-cfb-toolkit', tool: 'team-swap', version: 1, swaps };
}

// BW95 slot boxes (medians over its 36 teams): big mascot centered at (3, -38), small at (3, -21).
const G0_CENTER = { x: 3, y: -38 };
const G1_CENTER = { x: 3, y: -21 };

export function defaultSlot(bw: BwTeam, cf: CfTeam): SlotConfig {
  const home = mapUniform(cf.home, bw.home);
  const away = mapUniform(cf.away, bw.away);
  const fix = UNIFORM_FIX[cf.school];
  if (fix) {
    for (const [k, v] of Object.entries(fix.home)) home[+k] = v;
    for (const [k, v] of Object.entries(fix.away)) away[+k] = v;
  }
  let nickname = NICKNAME_FIX[cf.school] ?? cf.nickname;
  if (nickname.length > MAX_LEN.nickname) nickname = nickname.split(' ').slice(1).join(' ') || nickname;
  return {
    slot: bw.index,
    cf97: cf.index,
    cf97School: cf.school,
    school: cf.school.slice(0, MAX_LEN.school),
    city: (CITY[cf.school] ?? '').slice(0, MAX_LEN.city),
    nickname: nickname.slice(0, MAX_LEN.nickname),
    home,
    away,
    endZone: fix?.endZone ?? defaultEndZone(home),
    celebration: defaultCelebration(home),
  };
}

export function validateSlot(sc: SlotConfig): string[] {
  const errs: string[] = [];
  for (const k of ['school', 'city', 'nickname'] as const) {
    const v = sc[k];
    if (!v.trim()) errs.push(`${k} is empty`);
    if (v.length > MAX_LEN[k]) errs.push(`${k} is longer than ${MAX_LEN[k]} characters`);
    if (!NAME_CHARS.test(v)) errs.push(`${k} has characters the game font may not have`);
  }
  return errs;
}

const shift = (g: Sprite[], dx: number, dy: number): Sprite[] => g.map((s) => ({ ...s, x: s.x + dx, y: s.y + dy }));

function strBytes(s: string): Uint8Array {
  const n = 2 + s.length;
  const out = new Uint8Array(n + (n & 1));
  ww(out, 0, out.length);
  for (let i = 0; i < s.length; i++) out[2 + i] = s.charCodeAt(i);
  return out;
}

export interface BlockInfo {
  mascotTiles: number;
  helmetTiles: number;
  bytesUsed: number;
  bytesFree: number;
}

/** Rebuilds one team block in place. The roster (last 0x80 bytes) and the ratings group stay put. */
export function writeBlock(rom: Uint8Array, bw: BwTeam, cf: CfTeam, sc: SlotConfig): BlockInfo {
  const limit = bw.rosterOff;
  const out = new Uint8Array(limit);
  out.set(rom.subarray(bw.block + 0x0c, bw.block + 0x14), 0x0c);
  sc.home.forEach((c, i) => ww(out, 0x14 + 2 * i, c));
  sc.away.forEach((c, i) => ww(out, 0x34 + 2 * i, c));

  const lb = bbox(cf.logo);
  const cx = (lb.x0 + lb.x1) / 2;
  const cy = (lb.y0 + lb.y1) / 2;
  const g0 = shift(cf.logo, Math.round(G0_CENTER.x - cx), Math.round(G0_CENTER.y - cy));
  const g1 = shift(cf.logo, Math.round(G1_CENTER.x - cx), Math.round(G1_CENTER.y - cy));
  const mascot = packTiles(cf.tiles, [g0, g1, cf.wordmark]);
  const helmet = packTiles(cf.tiles, [cf.helmet]);

  let a = 0x54;
  const mt = mascot.tiles.length / 32;
  const mmap = writeGroups(mascot.groups);
  const need = (n: number) => {
    if (a + n > limit) throw new Error(`${cf.school} does not fit in ${bw.school}'s slot`);
  };
  need(10 + 32 * mt + 32 + mmap.length);
  wl(out, a, 10 + 32 * mt);
  wl(out, a + 4, 10 + 32 * mt + 32);
  ww(out, a + 8, mt);
  out.set(mascot.tiles, a + 10);
  cf.logoPalette.forEach((c, i) => ww(out, a + 10 + 32 * mt + 2 * i, c));
  out.set(mmap, a + 10 + 32 * mt + 32);
  a += 10 + 32 * mt + 32 + mmap.length;

  const helmetOff = a;
  const ht = helmet.tiles.length / 32;
  const hmap = writeGroups(helmet.groups);
  need(10 + 32 * ht + hmap.length);
  wl(out, a, 0xffffffff);
  wl(out, a + 4, 10 + 32 * ht);
  ww(out, a + 8, ht);
  out.set(helmet.tiles, a + 10);
  out.set(hmap, a + 10 + 32 * ht);
  a += 10 + 32 * ht + hmap.length;

  const namesOff = a;
  for (const s of [sc.school, sc.city, sc.nickname]) {
    const b = strBytes(s);
    need(b.length);
    out.set(b, a);
    a += b.length;
  }

  ww(out, 0, bw.rosterOff);
  ww(out, 2, 0x14);
  ww(out, 4, namesOff);
  ww(out, 6, 0x0c);
  ww(out, 8, 0x54);
  ww(out, 10, helmetOff);
  rom.set(out, bw.block);
  return { mascotTiles: mt, helmetTiles: ht, bytesUsed: a, bytesFree: limit - a };
}

const JSR = (addr: number) => [0x4e, 0xb9, (addr >>> 24) & 0xff, (addr >>> 16) & 0xff, (addr >>> 8) & 0xff, addr & 0xff];
const NOP = [0x4e, 0x71];

function patch(rom: Uint8Array, at: number, bytes: number[], expectLen: number): void {
  const fill = bytes.slice();
  while (fill.length < expectLen) fill.push(...NOP);
  if (fill.length !== expectLen) throw new Error(`patch at ${at.toString(16)} has the wrong size`);
  rom.set(fill, at);
}

/** Replaces a team stepper `add ... ; range check ; store` with `jsr helper ; bra.s store`. */
function patchStepper(rom: Uint8Array, at: number, store: number, helper: number): void {
  const bra = at + 6;
  const disp = store - (bra + 2);
  patch(rom, at, [...JSR(helper), 0x60, disp & 0xff], store - at);
}

function installCelebration(rom: Uint8Array, base: Uint8Array, swaps: SlotConfig[]): void {
  const blob = buildGenericCelebration(base);
  if (CELEB_ADDR + blob.bytes.length > 0x1f0000) throw new Error('celebration does not fit');
  rom.set(blob.bytes, CELEB_ADDR);
  const code = CELEBRATION.code.slice();
  for (const sc of swaps) {
    wl(rom, CELEB_TABLE + 4 * sc.slot, CELEB_ADDR);
    const cols = sc.celebration ?? defaultCelebration(sc.home);
    cols.forEach((c, k) => ww(code, CELEBRATION.CT + 6 * sc.slot + 2 * k, c));
  }
  rom.set(code, CELEBRATION.addr);
  patch(rom, 0x079f00, JSR(CELEBRATION.addr), 12); // palette line copy at the start of 0x079EAC's player
}

function installHelpers(rom: Uint8Array, order: number[], endZones: number[]): void {
  const mo = MENU_ORDER.code.slice();
  order.forEach((team, pos) => {
    mo[MENU_ORDER.ORD + pos] = team;
    mo[MENU_ORDER.INV + team] = pos;
  });
  rom.set(mo, MENU_ORDER.addr);
  patchStepper(rom, 0x07832e, 0x078340, MENU_ORDER.addr); // setup screen, home team
  patchStepper(rom, 0x078366, 0x078378, MENU_ORDER.addr); // setup screen, visitor team
  patchStepper(rom, 0x06acb2, 0x06acc6, MENU_ORDER.addr + MENU_ORDER.G3); // $E1B2 stepper
  patchStepper(rom, 0x06b462, 0x06b476, MENU_ORDER.addr + MENU_ORDER.G4); // season Team Rosters

  const ez = END_ZONE.code.slice();
  endZones.forEach((c, i) => ww(ez, END_ZONE.EZT + 2 * i, c));
  rom.set(ez, END_ZONE.addr);
  patch(rom, 0x076f44, JSR(END_ZONE.addr), 8);

  rom.set(HELMET_BASE.code, HELMET_BASE.addr);
  patch(rom, 0x078222, [0x20, 0x78, 0xe1, 0xb4, ...JSR(HELMET_BASE.addr)], 12); // home
  patch(rom, 0x07828a, [0x20, 0x78, 0xe2, 0xea, ...JSR(HELMET_BASE.addr)], 12); // visitor
}

export function fixChecksums(rom: Uint8Array): void {
  // EA's boot check: sum of longs 0x000000-0x1E6413 (skipping 0x18C) == constant at 0x1E6430.
  let s = 0;
  for (let a = 0; a < 0x1e6414; a += 4) if (a !== 0x18c) s = (s + rl(rom, a)) >>> 0;
  wl(rom, 0x1e6430, s);
  // Sega header checksum: sum of words from 0x200 to the end.
  let h = 0;
  for (let a = 0x200; a < rom.length; a += 2) h = (h + rw(rom, a)) & 0xffff;
  ww(rom, 0x18e, h);
}

/** Display order: unswapped teams keep EA's order; each swapped team is inserted where its
 *  name sorts alphabetically. */
export function menuOrder(names: string[], swapped: Set<number>): number[] {
  const cmp = (a: number, b: number) => names[a].localeCompare(names[b], 'en', { sensitivity: 'base' });
  const order = names.map((_, i) => i).filter((i) => !swapped.has(i));
  const ins = [...swapped].sort((a, b) => cmp(a, b) || a - b);
  for (const t of ins) {
    const at = order.findIndex((o) => cmp(o, t) > 0);
    if (at < 0) order.push(t);
    else order.splice(at, 0, t);
  }
  return order;
}

export interface BuildResult {
  rom: Uint8Array;
  blocks: Record<number, BlockInfo>;
  order: number[];
  walsh: 'unchanged' | 'in place' | 'moved';
}

/** The swap writes into unused ROM space; refuse inputs where something else already lives there. */
function assertFree(rom: Uint8Array, start: number, end: number): void {
  for (let a = start; a < end; a++) {
    if (rom[a] !== 0xff) throw new Error(`This ROM already uses 0x${start.toString(16)}-0x${end.toString(16)}, which the swap needs`);
  }
}

export function buildRom(base: Uint8Array, bwTeams: BwTeam[], cfTeams: CfTeam[], swaps: SlotConfig[]): BuildResult {
  const rom = base.slice();
  for (const h of [MENU_ORDER, END_ZONE, HELMET_BASE, CELEBRATION]) assertFree(rom, h.addr, h.addr + h.code.length);
  assertFree(rom, CELEB_ADDR, CELEB_ADDR + 4120);
  const cfByIndex = new Map(cfTeams.map((t) => [t.index, t]));
  const used = new Set<number>();
  const blocks: Record<number, BlockInfo> = {};
  const finalNames = bwTeams.map((t) => t.school);
  const endZones = new Array(BW_TEAMS).fill(0);
  for (const sc of swaps) {
    if (sc.slot < 0 || sc.slot >= BW_TEAMS) throw new Error(`bad slot ${sc.slot}`);
    if (used.has(sc.slot)) throw new Error(`slot ${sc.slot} is swapped twice`);
    used.add(sc.slot);
    const cf = cfByIndex.get(sc.cf97);
    if (!cf || cf.school !== sc.cf97School) throw new Error(`CF97 team ${sc.cf97School} not found`);
    const errs = validateSlot(sc);
    if (errs.length) throw new Error(`${sc.school}: ${errs.join(', ')}`);
    if (rl(rom, BW_TABLE + 4 * sc.slot) !== bwTeams[sc.slot].block) throw new Error('team table mismatch');
    blocks[sc.slot] = writeBlock(rom, bwTeams[sc.slot], cf, sc);
    finalNames[sc.slot] = sc.school;
    endZones[sc.slot] = sc.endZone || 0;
  }
  const order = menuOrder(finalNames, used);
  installHelpers(rom, order, endZones);
  if (swaps.length) installCelebration(rom, base, swaps);
  const walsh = rewriteWalsh(
    rom,
    swaps.map((sc) => ({
      slot: sc.slot,
      oldSchool: bwTeams[sc.slot].school,
      oldNickname: bwTeams[sc.slot].nickname,
      newSchool: sc.school,
      newNickname: sc.nickname,
    })),
  );
  fixChecksums(rom);
  return { rom, blocks, order, walsh };
}
