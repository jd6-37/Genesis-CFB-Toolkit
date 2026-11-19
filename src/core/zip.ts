// Writing a ROM into a .zip (user, 2026-11-19: "Can we deliver our patched roms as zip file (with an md file inside)
// instead of md file?"). One entry, deflated with the browser's CompressionStream; a 4 MB ROM shrinks to about a third.
// openRom (romfile.ts) reads these back, as it reads any zip with one ROM.
import { crc32 } from './bytes';

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** The zip's file name for a ROM file name: "X.md" → "X.zip". */
export const zipName = (romName: string) => `${romName.replace(/\.(md|bin|gen)$/i, '')}.zip`;

/** A zip holding one file, `name`, with `data` (deflated, or stored when that is smaller). */
export async function zipOne(name: string, data: Uint8Array, date = new Date()): Promise<Uint8Array> {
  const packed = await deflateRaw(data);
  const deflated = packed.length < data.length;
  const body = deflated ? packed : data;
  const fname = new TextEncoder().encode(name);
  const crc = crc32(data);
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const out = new Uint8Array(30 + fname.length + body.length + 46 + fname.length + 22);
  const v = new DataView(out.buffer);
  const common = (p: number) => {
    v.setUint16(p, 20, true); // version needed
    v.setUint16(p + 2, 0x0800, true); // UTF-8 name
    v.setUint16(p + 4, deflated ? 8 : 0, true);
    v.setUint16(p + 6, time, true);
    v.setUint16(p + 8, day, true);
    v.setUint32(p + 10, crc, true);
    v.setUint32(p + 14, body.length, true);
    v.setUint32(p + 18, data.length, true);
    v.setUint16(p + 22, fname.length, true);
  };
  v.setUint32(0, 0x04034b50, true);
  common(4);
  out.set(fname, 30);
  out.set(body, 30 + fname.length);
  const cd = 30 + fname.length + body.length;
  v.setUint32(cd, 0x02014b50, true);
  v.setUint16(cd + 4, 20, true); // version made by
  common(cd + 6);
  // extra, comment, disk, attributes: 0; local header at 0
  out.set(fname, cd + 46);
  const end = cd + 46 + fname.length;
  v.setUint32(end, 0x06054b50, true);
  v.setUint16(end + 8, 1, true);
  v.setUint16(end + 10, 1, true);
  v.setUint32(end + 12, 46 + fname.length, true);
  v.setUint32(end + 16, cd, true);
  return out;
}
