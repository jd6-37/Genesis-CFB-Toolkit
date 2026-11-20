// Manage → Share (user, 2026-11-17): a read-only snapshot of the dynasty with a public link, following the active
// team; at most five per dynasty, newest first; at the limit, sharing offers to delete the oldest first.
import { useState } from 'react';
import { upload } from '@vercel/blob/client';
import { seasonView, weekName } from '../../core/dynasty/derive';
import type { Dynasty } from '../../core/dynasty/model';
import { makeSnapshot, snapshotLabel, type DSnapshot } from '../../core/dynasty/snapshot';
import { newSnapshotKey, snapshotExpired, snapshotExpires, snapshotIdOf, snapshotPath, snapshotUrl, SNAPSHOT_DAYS, SNAPSHOT_LIMIT, SNAPSHOT_TYPE } from '../../core/dynasty/snapshotId';
import type { TeamArt } from '../../core/dynasty/storage';
import { Button, Modal, Note } from '../../ui';
import { Ctx, firstTeam, TeamMark, type DynCtx } from './ui';

const API = '/api/snapshot';

/** The moment the dynasty is at, for a snapshot's name. */
export function momentOf(d: Dynasty): string {
  const s = d.seasons[d.seasons.length - 1];
  const v = seasonView(d, s);
  const played = v.save ? v.currentWeek : 0;
  return snapshotLabel(d.offseason ? d.offseason.year : s.year, {
    offseason: !!d.offseason,
    done: v.done,
    week: played > 0 ? weekName(v, Math.min(played, v.weeks) - 1) : null,
  });
}

async function removeSnapshot(key: string): Promise<void> {
  const r = await fetch(API, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key }) });
  if (!r.ok) throw new Error("The snapshot couldn't be deleted. Try again in a moment.");
}

export function SharePanel({ d, art, focus, commit, ctx }: {
  d: Dynasty;
  art: TeamArt[] | null;
  focus?: number;
  commit: (next: Dynasty) => Promise<void>;
  /** For the team's logo (null before the dynasty is open). */
  ctx: DynCtx | null;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shared, setShared] = useState<DSnapshot | null>(null);
  const [full, setFull] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  // Expired snapshots (SNAPSHOT_DAYS) leave the list and the count; the server deletes their files.
  const list = (d.snapshots ?? []).filter((x) => !snapshotExpired(x.sharedAt));
  const team = firstTeam(d, focus);
  // A dynasty with no team of the user's yet (user, 2026-11-20: Manage was blank): a snapshot follows one, so it waits.
  const school = team === undefined ? undefined : d.teams[team]?.school;
  const oldest = list[list.length - 1];
  const link = (id: string) => snapshotUrl(window.location.origin, id);
  const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium' });

  const work = async (what: string, fn: () => Promise<void>) => {
    setBusy(what);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const share = (dropOldest: boolean) => work('Sharing the snapshot…', async () => {
    setFull(false);
    setShared(null);
    let keep = list;
    if (dropOldest && oldest) {
      await removeSnapshot(oldest.key);
      keep = list.slice(0, -1);
    }
    const label = momentOf(d);
    const bytes = await makeSnapshot(d, team, label, art);
    const key = newSnapshotKey();
    const id = await snapshotIdOf(key);
    try {
      await upload(snapshotPath(id), new Blob([bytes as Uint8Array<ArrayBuffer>], { type: SNAPSHOT_TYPE }), {
        access: 'public',
        handleUploadUrl: API,
        clientPayload: key,
        contentType: SNAPSHOT_TYPE,
      });
    } catch {
      if (dropOldest) await commit({ ...d, snapshots: keep });
      throw new Error("The snapshot couldn't be shared. Check your connection and try again.");
    }
    const snap: DSnapshot = { id, key, team, label, sharedAt: new Date().toISOString() };
    await commit({ ...d, snapshots: [snap, ...keep].slice(0, SNAPSHOT_LIMIT) });
    setShared(snap);
  });

  const remove = (s: DSnapshot) => work('Deleting the snapshot…', async () => {
    await removeSnapshot(s.key);
    if (shared?.id === s.id) setShared(null);
    await commit({ ...d, snapshots: list.filter((x) => x.id !== s.id) });
  });

  const copy = async (id: string) => {
    try {
      await navigator.clipboard.writeText(link(id));
      setCopied(id);
    } catch {
      setError(`Copy this link: ${link(id)}`);
    }
  };

  if (school === undefined) {
    return (
      <section className="dy-panel" id="dy-m-share">
        <h2>Share</h2>
        <p>A snapshot follows one of your teams. Add your team under Your teams (or import a save that marks it), then share it here.</p>
      </section>
    );
  }
  return (
    <section className="dy-panel" id="dy-m-share">
      <h2>Share</h2>
      <p>
        A snapshot is a read-only copy of this dynasty as it is right now, logos and helmets included. Anyone with its link can browse
        it for {SNAPSHOT_DAYS} days. It doesn't change when your dynasty does, and nobody can edit it.
      </p>
      {d.userTeams.length > 1 && (
        <div className="dy-share-team">
          {ctx && <Ctx.Provider value={ctx}><TeamMark team={team} size={44} /></Ctx.Provider>}
          <p className="dy-small">
            The snapshot follows <strong>{school}</strong>, your active team: its logo, its page and its news come first. To share another of
            your teams, pick it in the logo menu at the top first.
          </p>
        </div>
      )}
      <div className="dy-row">
        <Button disabled={!!busy} onClick={() => (list.length >= SNAPSHOT_LIMIT ? setFull(true) : void share(false))}>
          {d.userTeams.length > 1 ? `Share ${school}'s snapshot` : 'Share a snapshot'}
        </Button>
        <span className="dy-small dy-dim">{list.length} of {SNAPSHOT_LIMIT} snapshots</span>
      </div>
      {busy && <Note>{busy}</Note>}
      {error && <Note kind="error">{error}</Note>}
      {shared && (
        <Note kind="ok" block>
          <p><strong>Snapshot shared.</strong> {d.teams[shared.team].school}, {shared.label}. Copy the link and send it to anyone. It works until {when(snapshotExpires(shared.sharedAt).toISOString())}.</p>
          <div className="dy-share-link">
            <label className="ui-sr" htmlFor="dy-share-new">Snapshot link</label>
            <input id="dy-share-new" readOnly value={link(shared.id)} onFocus={(e) => e.currentTarget.select()} />
            <Button onClick={() => void copy(shared.id)}>{copied === shared.id ? 'Copied' : 'Copy link'}</Button>
            <a className="ui-button ui-button-quiet" href={link(shared.id)} target="_blank" rel="noopener">Open</a>
          </div>
        </Note>
      )}
      {list.length > 0 && (
        <>
          <h3>Your snapshots</h3>
          <ul className="dy-share-list">
            {list.map((s) => (
              <li key={s.id}>
                <span><strong>{d.teams[s.team]?.school ?? 'Team'}, {s.label}</strong><br /><span className="dy-small dy-dim">Shared {when(s.sharedAt)}. Works until {when(snapshotExpires(s.sharedAt).toISOString())}.</span></span>
                <span className="dy-row">
                  <Button variant="quiet" onClick={() => void copy(s.id)}>{copied === s.id ? 'Copied' : 'Copy link'}</Button>
                  <a className="ui-button ui-button-quiet" href={link(s.id)} target="_blank" rel="noopener">Open</a>
                  <Button variant="quiet" disabled={!!busy} onClick={() => void remove(s)}>Delete</Button>
                </span>
              </li>
            ))}
          </ul>
          <p className="dy-small dy-dim">
            A snapshot is deleted {SNAPSHOT_DAYS} days after you share it. Deleting one sooner breaks its link within the hour. Only this
            dynasty can delete its snapshots, so keep your dynasty file backed up: it carries them to another browser too.
          </p>
        </>
      )}
      {full && oldest && (
        <Modal
          title={`${SNAPSHOT_LIMIT} of ${SNAPSHOT_LIMIT} snapshots`}
          onClose={() => setFull(false)}
          actions={<>
            <Button onClick={() => void share(true)}>Delete the oldest and share</Button>
            <Button variant="quiet" onClick={() => setFull(false)}>Cancel</Button>
          </>}
        >
          <p>
            A dynasty can have {SNAPSHOT_LIMIT} snapshots. To share a new one, delete the oldest: <strong>{d.teams[oldest.team]?.school}, {oldest.label}, shared {when(oldest.sharedAt)}</strong>. Its link stops working.
          </p>
        </Modal>
      )}
    </section>
  );
}
