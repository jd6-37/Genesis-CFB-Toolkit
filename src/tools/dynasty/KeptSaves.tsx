// Manage, This season: the imports, each with its kept save file (user, 2026-11-27: "save the last few (10 maybe?)
// save files the user uploads. Add a download save button next to each row in the imports list. Along with a delete
// button"). Saves from earlier seasons that are still kept are listed after this season's.
import { useState } from 'react';
import { Button, Modal, Note, Table } from '../../ui';
import type { Dynasty, DSeason, SaveImport } from '../../core/dynasty/model';
import { deleteKept, KEEP_SAVES, keptBytes, keptName } from '../../core/dynasty/keptSaves';

const when = (iso: string) => new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
const short = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function saveAs(name: string, bytes: Uint8Array) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ImportsTable({ d, commit, busy }: { d: Dynasty; commit: (next: Dynasty) => Promise<void>; busy: boolean }) {
  const season = d.seasons[d.seasons.length - 1];
  const [ask, setAsk] = useState<{ s: DSeason; i: SaveImport } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const earlier = d.seasons.slice(0, -1).flatMap((s) => s.imports.filter((i) => i.file).map((i) => ({ s, i }))).reverse();
  const rows = [...season.imports.slice().reverse().map((i) => ({ s: season, i })), ...earlier];
  if (!rows.length) return null;
  const get = (s: DSeason, i: SaveImport) => {
    setErr(null);
    keptBytes(i).then((b) => saveAs(keptName(d, s, i), b)).catch((e: Error) => setErr(e.message));
  };
  return (
    <>
      <Table figures className="dy-imports">
        <caption>Imports</caption>
        <thead><tr><th className="ui-left">Imported</th><th>Games</th><th className="dy-imports-weeks">Weeks complete</th><th className="ui-left">Save file</th></tr></thead>
        <tbody>
          {rows.map(({ s, i }) => (
            <tr key={`${s.year}-${i.at}`}>
              <td className="ui-left">{s !== season && <>{s.year}: </>}{short(i.at)}</td>
              <td>{i.played}</td>
              <td className="dy-imports-weeks">{i.weeksDone}</td>
              <td className="ui-left">
                {i.file
                  ? <span className="dy-save-acts">
                      <Button variant="quiet" disabled={busy} onClick={() => get(s, i)} aria-label={`Download the save imported ${when(i.at)}`}>Download</Button>
                      <Button variant="quiet" disabled={busy} onClick={() => setAsk({ s, i })} aria-label={`Delete the save imported ${when(i.at)}`}>Delete</Button>
                    </span>
                  : <span className="dy-dim">Not kept</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {err && <Note kind="error">{err}</Note>}
      <p className="dy-small dy-dim">
        The last {KEEP_SAVES} save files you import are kept in the dynasty file. Download one to go back to it: it's named for its season's ROM, so the game finds it next to that ROM.
      </p>
      {ask && (
        <Modal
          title="Delete this save file?"
          onClose={() => setAsk(null)}
          actions={<>
            <Button onClick={() => { void commit(deleteKept(d, ask.s.year, ask.i.at)); setAsk(null); }}>Delete the file</Button>
            <Button variant="quiet" onClick={() => setAsk(null)}>Cancel</Button>
          </>}
        >
          <p>The save you imported {when(ask.i.at)} ({ask.i.played} games played) is removed from the dynasty file. Its results and stats stay in your dynasty.</p>
        </Modal>
      )}
    </>
  );
}

/** The ROM's file name, big, at a download step (user, 2026-11-27): the game finds the save by it. */
export function RomName({ name }: { name: string }) {
  return (
    <div className="dy-romname">
      <p className="dy-romname-label">Its file name must be</p>
      <p className="dy-romname-name"><code>{name}</code></p>
      <p className="dy-small">If your browser saves it as "… (1).zip", rename it to exactly this, or the game won't find your save.</p>
    </div>
  );
}
