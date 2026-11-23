// Manage › Controller (user, 2026-11-22: "a controller mapping section in Manage where the user can modify what
// buttons do what in case they have a non-standard controller"). The mapping itself: src/core/pad.ts; the layer
// that runs it: src/ui/pad.tsx.
import { useEffect, useState } from 'react';
import { Button, Check, Field, Note, Select, Table } from '../../ui';
import { PadKey, usePad } from '../../ui/pad';
import { PadTester } from '../../ui/padTester';
import { actionsOf, bindingGlyph, bindingName, clashes, defaultSettings, DEFAULT_MAP, NAME_MAX, PAD_ACTIONS, PAD_LABELS, withBinding, withName, type PadAction, type PadLabels } from '../../core/pad';

/** How long "Press a button" waits. */
const WAIT_MS = 10000;

export function ControllerPanel() {
  const pad = usePad();
  const [waiting, setWaiting] = useState<{ action: PadAction; add: boolean } | null>(null);
  const [testing, setTesting] = useState(false);
  // Buttons past the standard 17 that were pressed this visit (a 6-button pad's extras on some adapters).
  const [seen, setSeen] = useState<string[]>([]);
  useEffect(() => {
    if (!pad) return;
    return pad.watch((on) => {
      const extra = [...on].filter((b) => /^b\d+$/.test(b) && +b.slice(1) > 16);
      if (extra.length) setSeen((was) => (extra.every((b) => was.includes(b)) ? was : [...new Set([...was, ...extra])]));
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
  // Every button: the standard 17, and any other the mapping uses, has a name for, or was pressed this visit.
  const buttons = [...new Set([
    ...Array.from({ length: 17 }, (_, i) => `b${i}`),
    ...PAD_ACTIONS.flatMap(({ action }) => map[action]), ...Object.keys(settings.names ?? {}), ...seen,
  ])].filter((b) => /^b\d+$/.test(b)).sort((a, b) => +a.slice(1) - +b.slice(1));
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
      <div className="dy-row">
        <Button onClick={() => setTesting(true)}>Test your buttons</Button>
        <span className="dy-small dy-dim">See which button is which, and what it does here.</span>
      </div>
      {testing && <PadTester onClose={() => setTesting(false)} />}

      <div className="dy-pad-grid">
      <div>
      <h3>Actions</h3>
      <p>What each button does in the app. To change one, choose Change and press the button you want. Add keeps the old one too (a D-pad and a stick, say).</p>
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
      </div>

      <div>
      <h3>Buttons</h3>
      <p>
        Every button the app knows, and what it does now. If your controller's buttons say something else (a Genesis pad
        on a USB adapter, say, whose Z reaches the app as L1), type what yours says: the hints and this page use it.
      </p>
      <Table edit className="dy-pad-table dy-pad-buttons">
        <thead><tr><th className="ui-left">Button</th><th className="ui-left">Your name</th><th className="ui-left">Does now</th></tr></thead>
        <tbody>
          {buttons.map((b) => {
            const does = actionsOf(b, map);
            return (
              <tr key={b} className={settings.names?.[b] ? 'ui-row-mine' : undefined}>
                <td className="ui-left"><span className="dy-pad-key"><PadKey binding={b} labels={settings.labels} /> {bindingName(b, settings.labels)}</span></td>
                <td className="ui-left">
                  <Field
                    label={`Your name for ${bindingName(b, settings.labels)}`} hideLabel compact maxLength={NAME_MAX}
                    placeholder={bindingGlyph(b, settings.labels)} value={settings.names?.[b] ?? ''}
                    onChange={(v) => setSettings(withName(settings, b, v))} changed={!!settings.names?.[b]}
                  />
                </td>
                <td className="ui-left">{does || <span className="dy-dim">Nothing</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      </div>
      </div>

      {changed && (
        <div className="dy-row">
          <Button variant="quiet" onClick={() => setSettings({ ...defaultSettings(), labels: settings.labels, hints: settings.hints, names: settings.names })}>Reset every button</Button>
        </div>
      )}
    </section>
  );
}
