// The College Football 27 ratings built into the app (public/data/), so the Rosters tab can give
// every team its current roster without a download. To update: put EA's newer export in
// public/data/ and change this entry (and the README's "Built-in rosters" line).
export const CFB27_LATEST = {
  season: 2026,
  week: 9,
  /** Served from public/data/, so the app fetches it only when it's used. */
  file: 'data/ea-cfb27-ratings-2026-week9.csv',
  sha1: '1d6ba07950db747bf7c5809348b26f6d81f71414',
  label: 'College Football 27 ratings, 2026 season, Week 9',
} as const;

/** Fetches and returns the built-in CSV's bytes. */
export async function fetchCfb27Latest(base = '/'): Promise<Uint8Array> {
  let res: Response;
  try {
    res = await fetch(base + CFB27_LATEST.file);
  } catch {
    throw new Error("Couldn't load the built-in CFB 27 ratings. Check your connection and try again.");
  }
  if (!res.ok) throw new Error(`Couldn't load the built-in CFB 27 ratings (${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}
