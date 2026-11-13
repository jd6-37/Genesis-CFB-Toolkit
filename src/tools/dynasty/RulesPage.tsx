// Offseason rules (user, 2026-11-12): every number the computer's offseason uses, behind a spoiler warning,
// with each section's reset, a reset for everything, and rules files to move them between dynasties.
import { Button, Modal, Note, PageHead, SubHead } from '../../ui';
import { useRef, useState } from 'react';
import {
  DEFAULT_RULES, RULE_SECTIONS, changedRules, readRulesFile, ruleProblems, rulesFileText, rulesOf, setRules,
  type OffseasonRules, type RuleField,
} from '../../core/dynasty/rules';
import { href, useDyn } from './ui';
import type { OffseasonActions } from './OffseasonPage';

const SEEN_KEY = 'dy-rules-spoilers-ok';

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A number as the field shows it: percentages as 0-100. */
const toShown = (f: RuleField, v: number) => (f.kind === 'pct' ? Math.round(v * 1000) / 10 : v);
const fromShown = (f: RuleField, v: number) => (f.kind === 'pct' ? v / 100 : f.kind === 'int' ? Math.round(v) : v);
const showDefault = (f: RuleField, v: number | number[]) =>
  (Array.isArray(v) ? v : [v]).map((x) => (f.kind === 'pct' ? `${toShown(f, x)}%` : `${x}`)).join(', ');

export function Rules({ actions, busy }: { actions: OffseasonActions; busy: string | null }) {
  const { d } = useDyn();
  const [ok, setOk] = useState(() => { try { return sessionStorage.getItem(SEEN_KEY) === '1'; } catch { return false; } });
  const [draft, setDraft] = useState<OffseasonRules>(() => rulesOf(d));
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const saved = rulesOf(d);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const changedCount = Object.keys(changedRules(saved)).length;

  if (!ok) {
    return (
      <section className="dy-rules">
        <Modal
          title="Spoiler warning"
          actions={<>
            <Button onClick={() => { try { sessionStorage.setItem(SEEN_KEY, '1'); } catch { /* private mode */ } setOk(true); }}>Show me the rules</Button>
            <Button variant="quiet" href={href('manage')}>Go back</Button>
          </>}
        >
            <p>
              This page shows exactly how the computer runs the offseason: who goes pro, who transfers, how recruits decide, how players develop.
              Knowing the numbers can take some of the challenge out of your dynasty.
            </p>
            <p>You can change any of them for this dynasty.</p>
        </Modal>
      </section>
    );
  }

  const set = (key: keyof OffseasonRules, v: number | number[]) => { setMsg(null); setDraft((x) => ({ ...x, [key]: v })); };
  const save = (rules: Partial<OffseasonRules>, text: string) => {
    const bad = ruleProblems(changedRules(rules));
    if (bad.length) return setMsg({ kind: 'error', text: bad.join(' ') });
    void actions.run('Saving the rules…', async () => {
      await actions.commit(setRules(d, rules));
      setMsg({ kind: 'ok', text });
    });
  };

  return (
    <section className="dy-rules">
      <PageHead title="Offseason rules" />
      <p>
        Every number the offseason uses, for this dynasty. Changes apply from the next offseason step; nothing already decided is redone.
        {changedCount ? ` ${changedCount} ${changedCount === 1 ? 'rule differs' : 'rules differ'} from the defaults.` : ' All rules are the defaults.'}
      </p>
      <div className="dy-row">
        <Button disabled={!dirty || !!busy} onClick={() => save(draft, 'The rules are saved.')}>Save changes</Button>
        <Button variant="quiet" disabled={!dirty} onClick={() => { setDraft(saved); setMsg(null); }}>Undo changes</Button>
        <Button variant="quiet" disabled={!!busy} onClick={() => { setDraft(DEFAULT_RULES); save(DEFAULT_RULES, 'Every rule is back to its default.'); }}>Reset everything</Button>
      </div>
      <div className="dy-row">
        <Button variant="quiet" onClick={() => download(`${d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'dynasty'}-offseason-rules.json`, rulesFileText(d))}>Export rules</Button>
        <Button variant="quiet" disabled={!!busy} onClick={() => fileRef.current?.click()}>Import rules</Button>
        <input ref={fileRef} type="file" accept=".json" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            const rules = readRulesFile(await f.text());
            const all = { ...DEFAULT_RULES, ...rules };
            setDraft(all);
            save(all, `Imported ${Object.keys(rules).length} changed ${Object.keys(rules).length === 1 ? 'rule' : 'rules'} from ${f.name}.`);
          } catch (err) {
            setMsg({ kind: 'error', text: (err as Error).message });
          }
        }} />
      </div>
      {msg && <Note kind={msg.kind}>{msg.text}</Note>}

      {RULE_SECTIONS.map((sec) => {
        const secChanged = sec.fields.some((f) => JSON.stringify(draft[f.key]) !== JSON.stringify(DEFAULT_RULES[f.key]));
        return (
          <section key={sec.title} className="dy-rule-sec">
            <SubHead>{sec.title}</SubHead>
            <p className="dy-small dy-dim">{sec.intro}</p>
            {sec.fields.map((f) => {
              const v = draft[f.key] as number | number[];
              const def = DEFAULT_RULES[f.key] as number | number[];
              const changed = JSON.stringify(v) !== JSON.stringify(def);
              const input = (x: number, i?: number, label?: string) => (
                <label key={i ?? 0} className="dy-rule-in">
                  {label && <span className="dy-small dy-dim">{label}</span>}
                  <input
                    type="number" inputMode="decimal" step={f.kind === 'int' ? 1 : 'any'}
                    min={toShown(f, f.min)} max={toShown(f, f.max)} value={toShown(f, x)}
                    aria-label={label ? `${f.label}, ${label}` : f.label}
                    onChange={(e) => {
                      const n = fromShown(f, Number(e.target.value));
                      if (!Number.isFinite(n)) return;
                      if (Array.isArray(v)) { const arr = v.slice(); arr[i!] = n; set(f.key, arr); } else set(f.key, n);
                    }}
                  />
                  {f.kind === 'pct' && <span className="dy-small">%</span>}
                </label>
              );
              return (
                <div key={f.key} className={`dy-rule${changed ? ' dy-rule-changed' : ''}`}>
                  <div className="dy-rule-label">
                    <span>{f.label}</span>
                    {changed && <span className="dy-rule-flag">changed</span>}
                    <span className="dy-small dy-dim">{f.help ? `${f.help} ` : ''}Default {showDefault(f, def)}.</span>
                  </div>
                  <div className="dy-rule-inputs">{Array.isArray(v) ? v.map((x, i) => input(x, i, f.items?.[i])) : input(v)}</div>
                </div>
              );
            })}
            {secChanged && (
              <button type="button" className="dy-linkbutton dy-small" onClick={() => { setMsg(null); setDraft((x) => ({ ...x, ...Object.fromEntries(sec.fields.map((f) => [f.key, DEFAULT_RULES[f.key]])) })); }}>
                Reset {sec.title.toLowerCase()} to the defaults
              </button>
            )}
          </section>
        );
      })}
      <div className="dy-row dy-next">
        <Button disabled={!dirty || !!busy} onClick={() => save(draft, 'The rules are saved.')}>Save changes</Button>
      </div>
    </section>
  );
}
