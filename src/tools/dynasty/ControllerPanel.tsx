// Manage › Controller (user, 2026-11-22: "a controller mapping section in Manage where the user can modify what
// buttons do what in case they have a non-standard controller"). The mapping itself: src/core/pad.ts; the layer
// that runs it: src/ui/pad.tsx.
import { useEffect, useState } from 'react';
import { Button, Check, Field, Note, Select, Table } from '../../ui';
import { PadKey, usePad } from '../../ui/pad';
import { bindingGlyph, bindingName, clashes, defaultSettings, DEFAULT_MAP, NAME_MAX, PAD_ACTIONS, PAD_LABELS, withBinding, withName, type PadAction, type PadLabels } from '../../core/pad';

/** How long "Press a button" waits. */
const WAIT_MS = 10000;

export function ControllerPanel() {
  const pad = usePad();
  const [waiting, setWaiting] = useState<{ action: PadAction; add: boolean } | null>(null);
  const [held, setHeld] = useState<string[]>([]);

  // The test line: what's held now.
  useEffect(() => {
    if (!pad) return;
    let last = '';
    return pad.watch((on) => {
      const now = [...on].sort().join();
      if (now !== last) { last = now; setHeld([...on]); }
    });
  }, [pad]);

  // Waiting for a press: the next new button or stick direction becomes the binding.
  useEffect(() => {
    if (!pad || !waiting) return;
    const { action, add } = waiting;
    pad.capture((b) => {
      const was = pad.map[action];
      pad.setSettings(withBinding(pad.settings, action, add ? [...new Set([...was, b])] : [b]));
      setWaiting(null);
    });
    const t = setTimeout(() => { pad.capture(null); setWaiting(null); }, WAIT_MS);
    return () => { clearTimeout(t); pad.capture(null); };
  }, [pad, waiting]);

  if (!pad) return null;
  const { settings, setSettings, map } = pad;
  const name = (b: string) => bindingName(b, settings.labels, settings.names);
  // Every button the mapping uses (sticks are named by direction and keep their names).
  const used = [...new Set(PAD_ACTIONS.flatMap(({ action }) => map[action]))].filter((b) => /^b\d+$/.test(b)).sort((a, b) => +a.slice(1) - +b.slice(1));
  const changed = Object.keys(settings.map).length > 0;

  return (
    <section className="dy-panel" id="dy-m-pad">
      <h2>Controller</h2>
      <p>
        The app works with a game controller, on a handheld such as the Odin 2 Portal or with one plugged into a computer:
        the D-pad moves, A chooses, B goes back, L1 and R1 switch tabs. The button hints show along the bottom while you use it.
      </p>
      {pad.pads.length
        ? <Note kind="ok">Connected: {pad.pads.map((p) => p.replace(/\s*\(.*\)\s*$/, '')).join(', ')}</Note>
        : <Note>No controller yet. Press any button on it: browsers only show a controller once a button is pressed.</Note>}

      <div className="dy-row">
        <Select
          label="Button labels" value={settings.labels}
          options={PAD_LABELS.map((x) => ({ value: x.value, label: x.label }))}
          onChange={(v) => setSettings({ ...settings, labels: v as PadLabels })}
        />
        <Check checked={settings.hints} onChange={(v) => setSettings({ ...settings, hints: v })}>Show the button hints</Check>
      </div>

      <h3>Buttons</h3>
      <p>To change a button, choose Change and press the one you want. Add keeps the old button too (a D-pad and a stick, say).</p>
      <Table edit className="dy-pad-table">
        <thead><tr><th className="ui-left">Action</th><th className="ui-left">Buttons</th><th className="ui-left"><span className="sr-only">Change</span></th></tr></thead>
        <tbody>
          {PAD_ACTIONS.map(({ action, label }) => {
            const wait = waiting?.action === action;
            const same = clashes(map, action);
            const own = settings.map[action] !== undefined;
            return (
              <tr key={action} className={own ? 'ui-row-mine' : undefined}>
                <td className="ui-left">
                  {label}
                  {same.length > 0 && <span className="dy-small dy-dim"><br />Same button as: {same.map((a) => PAD_ACTIONS.find((x) => x.action === a)!.label.toLowerCase()).join(', ')}</span>}
                </td>
                <td className="ui-left">
                  {wait ? <strong>Press a button…</strong> : (
                    <span className="dy-pad-keys">{map[action].map((b) => (
                      <span key={b} className="dy-pad-key"><PadKey binding={b} labels={settings.labels} names={settings.names} /> {name(b)}</span>
                    ))}</span>
                  )}
                </td>
                <td className="ui-left">
                  <div className="dy-row">
                    {wait ? <Button variant="quiet" onClick={() => setWaiting(null)}>Cancel</Button> : (
                      <>
                        <Button variant="quiet" disabled={!pad.pads.length} onClick={() => setWaiting({ action, add: false })}>Change</Button>
                        <Button variant="link" disabled={!pad.pads.length} onClick={() => setWaiting({ action, add: true })}>Add</Button>
                        {own && <Button variant="link" onClick={() => setSettings(withBinding(settings, action, DEFAULT_MAP[action]))}>Default</Button>}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      <h3>Button names</h3>
      <p>
        If your controller's buttons say something other than what the app shows (a Genesis pad on a USB adapter, say, whose Z
        reaches the app as L1), type what yours says. The hints and this page use your names. Empty = the app's name.
      </p>
      <div className="dy-pad-names">
        {used.map((b) => (
          <div key={b} className="dy-pad-name">
            <span className="dy-pad-key"><PadKey binding={b} labels={settings.labels} /> {bindingName(b, settings.labels)}</span>
            <Field
              label={`Your name for ${bindingName(b, settings.labels)}`} hideLabel compact maxLength={NAME_MAX}
              placeholder={bindingGlyph(b, settings.labels)} value={settings.names?.[b] ?? ''}
              onChange={(v) => setSettings(withName(settings, b, v))} changed={!!settings.names?.[b]}
            />
          </div>
        ))}
      </div>

      <h3>Test</h3>
      <p className="dy-pad-test" aria-live="polite">
        {held.length ? held.map((b) => <span key={b} className="dy-pad-key"><PadKey binding={b} labels={settings.labels} names={settings.names} /> {name(b)}</span>) : <span className="dy-dim">Hold a button to see its name here.</span>}
      </p>
      {changed && (
        <div className="dy-row">
          <Button variant="quiet" onClick={() => setSettings({ ...defaultSettings(), labels: settings.labels, hints: settings.hints, names: settings.names })}>Reset every button</Button>
        </div>
      )}
    </section>
  );
}
