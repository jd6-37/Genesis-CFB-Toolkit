// Every ROM the apps hand out goes out as a .zip with the .md inside (user, 2026-11-19), from here.
import { zipName, zipOne } from '../../core/zip';

/** Downloads `data` as `<name without .md>.zip` holding `name`. */
export async function downloadRom(name: string, data: Uint8Array): Promise<void> {
  const zip = await zipOne(name, data);
  const url = URL.createObjectURL(new Blob([zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = zipName(name);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
