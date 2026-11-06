// Port of the CF96/CF97 tile decompressor (CF97 0x0581AC, CF96 0x05177E).
// Byte-oriented LZ with a 256-byte ring buffer. Control byte b; its high nibble selects
// (n = the next byte):
//   0,1  literal: (b&0x1F)+1 bytes follow
//   2    zeros:   (b&0x0F)+1
//   3    repeat the next byte (b&0x0F)+3 times
//   4-7  copy forward:  len (b&7)+2,                    dist ((b>>3)&7)+1
//   8    copy forward:  len (b&0xF)+3,                  dist n (0 = 256)
//   9    copy forward:  len ((b&0xF)<<1 | n>>7)+3,      dist (n&0x7F)+1
//   A    copy forward:  len ((b&0xF)<<2 | n>>6)+3,      dist (n&0x3F)+1
//   B    copy forward:  len ((b&0xF)<<3 | n>>5)+3,      dist (n&0x1F)+1
//   C,D  copy backward: len (b&3)+2,                    dist ((b>>2)&7)+1  (source runs backward)
//   E    copy backward: len (b&0xF)+3,                  dist n; n = 0 ends the stream
//   F    copy backward: len ((b&0xF)<<1 | n>>7)+3,      dist (n&0x7F)+1
// Verified byte for byte against the game's own routine for all 112 CF97 and 108 CF96 teams.

export function decompress(d: Uint8Array, start: number): { data: Uint8Array; used: number } {
  const out: number[] = [];
  let a = start;
  const get = (i: number): number => {
    if (i < 0) throw new Error(`Compressed data at 0x${start.toString(16)} refers back before its start`);
    return out[i];
  };
  const fwd = (n: number, dist: number): void => {
    const dd = dist || 256;
    for (let k = 0; k < n; k++) out.push(get(out.length - dd));
  };
  const back = (n: number, dist: number): void => {
    let src = out.length - (dist || 256);
    for (let k = 0; k < n; k++) {
      out.push(get(src));
      src -= 1;
      if (src < out.length - 256) src += 256; // ring buffer wrap
    }
  };
  for (;;) {
    if (a >= d.length) throw new Error('Compressed data runs past the end of the ROM');
    const b = d[a++];
    const h = b >> 4;
    if (h <= 1) {
      const n = (b & 0x1f) + 1;
      for (let k = 0; k < n; k++) out.push(d[a + k]);
      a += n;
    } else if (h === 2) {
      for (let k = 0; k < (b & 0x0f) + 1; k++) out.push(0);
    } else if (h === 3) {
      const v = d[a++];
      for (let k = 0; k < (b & 0x0f) + 3; k++) out.push(v);
    } else if (h <= 7) {
      fwd((b & 7) + 2, ((b >> 3) & 7) + 1);
    } else if (h === 8) {
      const n = d[a++];
      fwd((b & 0xf) + 3, n);
    } else if (h === 9) {
      const n = d[a++];
      fwd((((b << 1) | (n >> 7)) & 0x1f) + 3, (n & 0x7f) + 1);
    } else if (h === 0xa) {
      const n = d[a++];
      fwd(((((b << 8) | n) >> 6) & 0x3f) + 3, (n & 0x3f) + 1);
    } else if (h === 0xb) {
      const n = d[a++];
      fwd(((((b << 8) | n) >> 5) & 0x7f) + 3, (n & 0x1f) + 1);
    } else if (h <= 0xd) {
      back((b & 3) + 2, ((b >> 2) & 7) + 1);
    } else if (h === 0xe) {
      const n = d[a++];
      if (n === 0) return { data: Uint8Array.from(out), used: a - start };
      back((b & 0xf) + 3, n);
    } else {
      const n = d[a++];
      back((((b << 1) | (n >> 7)) & 0x1f) + 3, (n & 0x7f) + 1);
    }
  }
}
