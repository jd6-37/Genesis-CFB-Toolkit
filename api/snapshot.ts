// Dynasty snapshots in the Vercel Blob store (public, "dynasty-snapshots"; set up 2026-11-17). The browser uploads a
// snapshot straight to the store with a one-time token from here, so big dynasties don't hit the 4.5 MB limit on a
// function's request. No accounts: a snapshot's id is made from its secret key (src/core/dynasty/snapshotId.ts), so
// a token is only given for the path that matches the key, and only the key deletes it.
//
//   POST   /api/snapshot             the Blob client's token request (clientPayload = the key)
//   GET    /api/snapshot?id=<id>     { url } of the snapshot's file, or 404
//   GET    /api/snapshot?status=1    { storage: "connected" } or the error (for checking a deployment)
//   DELETE /api/snapshot             body { key }: deletes that key's snapshot
import { BlobNotFoundError, del, head } from '@vercel/blob';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { isSnapshotId, isSnapshotKey, snapshotIdOf, snapshotPath, SNAPSHOT_MAX_BYTES, SNAPSHOT_TYPE } from '../src/core/dynasty/snapshotId';

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });

export async function GET(request: Request): Promise<Response> {
  const q = new URL(request.url).searchParams;
  if (q.has('status')) {
    try {
      await head('s/status-check.json.gz');
      return json({ storage: 'connected' });
    } catch (e) {
      if (e instanceof BlobNotFoundError) return json({ storage: 'connected' });
      return json({ storage: 'error', message: (e as Error).message }, 500);
    }
  }
  const id = q.get('id');
  if (!isSnapshotId(id)) return json({ error: 'Not a snapshot id.' }, 400);
  try {
    const blob = await head(snapshotPath(id));
    // The file never changes; a deleted one stops answering within the hour (the store's cache time).
    return json({ url: blob.url }, 200, { 'cache-control': 'public, max-age=300, s-maxage=3600' });
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
