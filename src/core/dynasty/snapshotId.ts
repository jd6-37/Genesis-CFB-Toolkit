// Dynasty snapshots (user, 2026-11-17: "a link that can be shared publicly so other people can browse your
// dynasty"): the parts the browser and the upload function (api/snapshot.ts) share. No accounts: whoever holds a
// snapshot's key can delete it. The snapshot's id is made from its key, so the server never stores the key, and
// nobody can work the key out from the id in the link.

/** Where a snapshot is kept in the Blob store. */
export const snapshotPath = (id: string) => `s/${id}.json.gz`;
export const SNAPSHOT_TYPE = 'application/gzip';
/** The largest snapshot the store takes (compressed). A one-season dynasty is about 0.6 MB. */
export const SNAPSHOT_MAX_BYTES = 12 * 1024 * 1024;
/** Snapshots per dynasty (user, 2026-11-17). */
export const SNAPSHOT_LIMIT = 5;
/** Days a snapshot's link works (user, 2026-11-18: "we should probably set an expiration date for snapshots so we
 * don't accumulate garbage. 90 days?"). After that its link answers "gone", and a daily job deletes the file. */
export const SNAPSHOT_DAYS = 90;
/** When a snapshot shared at this time stops working. */
export const snapshotExpires = (sharedAt: string | number | Date) => new Date(new Date(sharedAt).getTime() + SNAPSHOT_DAYS * 86_400_000);
export const snapshotExpired = (sharedAt: string | number | Date, now = Date.now()) => snapshotExpires(sharedAt).getTime() <= now;

const ID = /^[A-Za-z0-9_-]{12}$/;
const KEY = /^[A-Za-z0-9_-]{32}$/;
export const isSnapshotId = (s: unknown): s is string => typeof s === 'string' && ID.test(s);
export const isSnapshotKey = (s: unknown): s is string => typeof s === 'string' && KEY.test(s);

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** A new secret key: 24 random bytes. */
export function newSnapshotKey(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(24)));
}

/** The snapshot's id: the first 12 characters of the key's SHA-256. */
export async function snapshotIdOf(key: string): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)));
  return b64url(hash).slice(0, 12);
}

/** The address of a snapshot on the site. */
export const snapshotUrl = (origin: string, id: string) => `${origin}/dynasty/s/${id}`;
/**
 * The sample dynasty (user, 2026-11-19: "copy the snapshot to sample to hold it forever"): one shared snapshot kept
 * in the repo (public/data/sample-dynasty.snap, the gzip file as the Blob store had it), shown at /dynasty/sample with
 * the snapshot pages. It never expires. Get started links to it.
 */
export const SAMPLE_ID = 'sample';
export const SAMPLE_PATH = '/dynasty/sample';
export const SAMPLE_FILE = '/data/sample-dynasty.snap';

/** The id in a snapshot address (/dynasty/s/<id>, or the sample's /dynasty/sample), if it is one. */
export function snapshotIdFromPath(pathname: string): string | null {
  if (/^\/dynasty\/sample\/?$/.test(pathname)) return SAMPLE_ID;
  const m = /^\/dynasty\/s\/([A-Za-z0-9_-]{12})\/?$/.exec(pathname);
  return m ? m[1] : null;
}
