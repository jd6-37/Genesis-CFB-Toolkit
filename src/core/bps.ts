// BPS patches (byuu's format, as made by Flips and used for the Elevated releases): apply one to a
// ROM, with the three CRC32 checks the format carries (source ROM, result, patch file).

import { crc32 } from './bytes';

export class BpsError extends Error {
  constructor(
    message: string,
    /** 'source' when the ROM isn't the one the patch was made for; 'patch' when the patch file is damaged. */
    readonly reason: 'source' | 'patch' | 'format',
  ) {
    super(message);
  }
}

const le32 = (d: Uint8Array, a: number) => (d[a] | (d[a + 1] << 8) | (d[a + 2] << 16) | (d[a + 3] << 24)) >>> 0;

export interface BpsInfo {
  sourceSize: number;
  targetSize: number;
  sourceCrc: number;
  targetCrc: number;
  metadata: string;
}

function reader(p: Uint8Array) {
  let at = 4;
  const end = p.length - 12;
  const num = (): number => {
    let data = 0;
    let shift = 1;
    for (;;) {
      if (at >= end) throw new BpsError('The patch file is damaged (it ends too early).', 'patch');
      const x = p[at++];
      data += (x & 0x7f) * shift;
      if (x & 0x80) return data;
      shift *= 128;
      data += shift;
      if (shift > 2 ** 40) throw new BpsError('The patch file is damaged.', 'patch');
    }
  };
  return { num, pos: () => at, skip: (n: number) => (at += n), end };
}

/** Reads a BPS header and footer without applying it. Throws BpsError if it isn't a BPS file. */
export function bpsInfo(p: Uint8Array): BpsInfo {
  if (p.length < 19 || String.fromCharCode(p[0], p[1], p[2], p[3]) !== 'BPS1') {
    throw new BpsError('This is not a BPS patch file.', 'format');
  }
  if (crc32(p.subarray(0, p.length - 4)) !== le32(p, p.length - 4)) {
    throw new BpsError('The patch file is damaged (its checksum is wrong).', 'patch');
  }
  const r = reader(p);
  const sourceSize = r.num();
  const targetSize = r.num();
  const metaSize = r.num();
  const metadata = new TextDecoder().decode(p.subarray(r.pos(), r.pos() + metaSize));
  return { sourceSize, targetSize, sourceCrc: le32(p, p.length - 12), targetCrc: le32(p, p.length - 8), metadata };
}

/** Applies a BPS patch to `source` and returns the result. Throws BpsError when the ROM is the wrong
 *  one for the patch, or the patch or the result fails its checksum. */
export function applyBps(source: Uint8Array, p: Uint8Array): Uint8Array {
  const info = bpsInfo(p);
  if (source.length !== info.sourceSize || crc32(source) !== info.sourceCrc) {
    throw new BpsError("This patch was made for a different ROM (the ROM's size or checksum doesn't match).", 'source');
  }
  const r = reader(p);
  r.num();
  r.num();
  r.skip(r.num());
  const out = new Uint8Array(info.targetSize);
  let o = 0;
  let srcRel = 0;
  let tgtRel = 0;
  const room = (n: number) => {
    if (o + n > out.length) throw new BpsError('The patch file is damaged (it writes past the end).', 'patch');
  };
  while (r.pos() < r.end) {
    const data = r.num();
    const cmd = data % 4;
    const len = Math.floor(data / 4) + 1;
    room(len);
    if (cmd === 0) {
      // SourceRead: the same bytes as the source at this offset
      if (o + len > source.length) throw new BpsError('The patch file is damaged (it reads past the ROM).', 'patch');
      out.set(source.subarray(o, o + len), o);
      o += len;
    } else if (cmd === 1) {
      // TargetRead: new bytes from the patch
      const at = r.pos();
      if (at + len > r.end) throw new BpsError('The patch file is damaged (it ends too early).', 'patch');
      out.set(p.subarray(at, at + len), o);
      r.skip(len);
      o += len;
    } else {
      const d = r.num();
      const off = (d % 2 ? -1 : 1) * Math.floor(d / 2);
      if (cmd === 2) {
        // SourceCopy: bytes from elsewhere in the source
        srcRel += off;
        if (srcRel < 0 || srcRel + len > source.length) throw new BpsError('The patch file is damaged.', 'patch');
        out.set(source.subarray(srcRel, srcRel + len), o);
        srcRel += len;
        o += len;
      } else {
        // TargetCopy: bytes already written (may overlap, so one at a time)
        tgtRel += off;
        if (tgtRel < 0 || tgtRel >= o) throw new BpsError('The patch file is damaged.', 'patch');
        for (let k = 0; k < len; k++) out[o++] = out[tgtRel++];
      }
    }
  }
  if (o !== out.length || crc32(out) !== info.targetCrc) {
    throw new BpsError("The patched ROM doesn't match the patch's checksum.", 'patch');
  }
  return out;
}
