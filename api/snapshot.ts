// Dynasty snapshots in the Vercel Blob store (public, "dynasty-snapshots"; set up 2026-11-17). The browser uploads a
// snapshot straight to the store with a one-time token from here, so big dynasties don't hit the 4.5 MB limit on a
// function's request. No accounts: a snapshot's id is made from its secret key (src/core/dynasty/snapshotId.ts), so
// a token is only given for the path that matches the key, and only the key deletes it.
//
//   POST   /api/snapshot             the Blob client's token request (clientPayload = the key)
//   GET    /api/snapshot?id=<id>     { url } of the snapshot's file, or 404
//   GET    /api/snapshot?status=1    { storage: "connected", uploads: "ready" } or what's missing (for checking a deployment)
//   DELETE /api/snapshot             body { key }: deletes that key's snapshot
//   PATCH  /api/snapshot             body { key }: extends that key's snapshot to SNAPSHOT_DAYS from now (re-saves the
//                                    file, which resets its upload time); { expires }
//   GET    /api/snapshot?cleanup=1   the daily cron (vercel.json; Authorization: Bearer CRON_SECRET): deletes the
//                                    snapshots older than SNAPSHOT_DAYS. A link stops answering at 90 days either way.
import { BlobNotFoundError, copy, del, head, list } from '@vercel/blob';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { isSnapshotId, isSnapshotKey, snapshotExpired, snapshotExpires, snapshotIdOf, snapshotPath, SNAPSHOT_MAX_BYTES, SNAPSHOT_TYPE } from '../src/core/dynasty/snapshotId.js'; // .js: Node runs the function as ESM and needs the extension

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });

export async function GET(request: Request): Promise<Response> {
  const q = new URL(request.url).searchParams;
  if (q.has('status')) {
    try {
      // Sharing needs the store's read-write token too: it signs the browser's upload (reading works without it).
      const uploads = process.env.BLOB_READ_WRITE_TOKEN ? 'ready' : 'missing BLOB_READ_WRITE_TOKEN';
      // The daily deletion of expired snapshots runs only with CRON_SECRET set (links stop at 90 days either way).
      const expiry = process.env.CRON_SECRET ? 'ready' : 'missing CRON_SECRET';
      try {
        await head('s/status-check.json.gz');
      } catch (e) {
        if (!(e instanceof BlobNotFoundError)) throw e;
      }
      return json({ storage: 'connected', uploads, expiry }, uploads === 'ready' ? 200 : 500);
    } catch (e) {
      return json({ storage: 'error', message: (e as Error).message }, 500);
    }
  }
  if (q.has('cleanup')) return cleanup(request);
  const id = q.get('id');
  if (!isSnapshotId(id)) return json({ error: 'Not a snapshot id.' }, 400);
  try {
    const blob = await head(snapshotPath(id));
    if (snapshotExpired(blob.uploadedAt)) return json({ error: 'This snapshot has expired.', expired: true }, 404, { 'cache-control': 'public, s-maxage=3600' });
    // The file never changes; a deleted one stops answering within the hour (the store's cache time).
    return json({ url: blob.url, expires: snapshotExpires(blob.uploadedAt).toISOString() }, 200, { 'cache-control': 'public, max-age=300, s-maxage=3600' });
  } catch (e) {
    if (e instanceof BlobNotFoundError) return json({ error: 'This snapshot is gone.' }, 404, { 'cache-control': 'public, s-maxage=60' });
    return json({ error: 'The snapshot storage is not available right now.' }, 503);
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, payload) => {
        if (!isSnapshotKey(payload) || pathname !== snapshotPath(await snapshotIdOf(payload))) throw new Error('Not a snapshot upload.');
        return {
          allowedContentTypes: [SNAPSHOT_TYPE],
          maximumSizeInBytes: SNAPSHOT_MAX_BYTES,
          addRandomSuffix: false,
          allowOverwrite: false,
          cacheControlMaxAge: 3600,
        };
      },
    });
    return json(result);
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  let key: unknown;
  try {
    key = ((await request.json()) as { key?: unknown }).key;
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  if (!isSnapshotKey(key)) return json({ error: 'Not a snapshot key.' }, 400);
  try {
    await del(snapshotPath(await snapshotIdOf(key)));
    return json({ deleted: true });
  } catch {
    return json({ error: 'The snapshot storage is not available right now.' }, 503);
  }
}

/**
 * Extends a snapshot (user, 2026-11-28: "Extend expiration … to 90 days from now"). Expiry runs from the file's upload
 * time, so the file is copied to a temporary name and back over itself, which gives it a new upload time; the link
 * and the file's content stay the same. Only the key extends, and only a snapshot that hasn't expired.
 */
export async function PATCH(request: Request): Promise<Response> {
  let key: unknown;
  try {
    key = ((await request.json()) as { key?: unknown }).key;
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  if (!isSnapshotKey(key)) return json({ error: 'Not a snapshot key.' }, 400);
  const path = snapshotPath(await snapshotIdOf(key));
  const opts = { access: 'public' as const, addRandomSuffix: false, contentType: SNAPSHOT_TYPE, cacheControlMaxAge: 3600 };
  try {
    const blob = await head(path);
    if (snapshotExpired(blob.uploadedAt)) return json({ error: 'This snapshot has expired.', expired: true }, 410);
    const tmp = `${path}.renew-${Date.now()}`;
    const copied = await copy(blob.url, tmp, opts);
    const back = await copy(copied.url, path, { ...opts, allowOverwrite: true });
    await del(copied.url);
    const now = await head(back.url).catch(() => null);
    return json({ expires: snapshotExpires(now?.uploadedAt ?? new Date()).toISOString() });
  } catch (e) {
    if (e instanceof BlobNotFoundError) return json({ error: 'This snapshot is gone.' }, 404);
    return json({ error: 'The snapshot storage is not available right now.' }, 503);
  }
}

/** The daily cron: deletes every snapshot older than SNAPSHOT_DAYS. Only Vercel's cron (with CRON_SECRET) may run it. */
async function cleanup(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return json({ error: 'CRON_SECRET is not set.' }, 500);
  if (request.headers.get('authorization') !== `Bearer ${secret}`) return json({ error: 'Not allowed.' }, 401);
  let cursor: string | undefined;
  let checked = 0;
  const old: string[] = [];
  do {
    const page = await list({ prefix: 's/', cursor, limit: 1000 });
    for (const b of page.blobs) {
      checked++;
      if (snapshotExpired(b.uploadedAt)) old.push(b.url);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  for (let i = 0; i < old.length; i += 100) await del(old.slice(i, i + 100));
  return json({ checked, deleted: old.length });
}
