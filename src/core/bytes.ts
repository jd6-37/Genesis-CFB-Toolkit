// Big-endian helpers for 68000 ROM data.

export const rw = (d: Uint8Array, a: number): number => (d[a] << 8) | d[a + 1];
export const rl = (d: Uint8Array, a: number): number =>
  ((d[a] << 24) | (d[a + 1] << 16) | (d[a + 2] << 8) | d[a + 3]) >>> 0;
export const s16 = (v: number): number => ((v & 0xffff) ^ 0x8000) - 0x8000;

export function ww(d: Uint8Array, a: number, v: number): void {
  d[a] = (v >> 8) & 0xff;
  d[a + 1] = v & 0xff;
}

export function wl(d: Uint8Array, a: number, v: number): void {
  d[a] = (v >>> 24) & 0xff;
  d[a + 1] = (v >>> 16) & 0xff;
  d[a + 2] = (v >>> 8) & 0xff;
  d[a + 3] = v & 0xff;
}

export async function sha1Hex(d: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest('SHA-1', d as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(d: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < d.length; i++) c = CRC_TABLE[(c ^ d[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export const hex = (v: number, n = 4): string => v.toString(16).toUpperCase().padStart(n, '0');
