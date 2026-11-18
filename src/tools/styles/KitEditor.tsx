// Teams tab, 2026 and 1994 Season Editions (H-012): each team's alternate uniforms for the picker on the controller screen
// (src/core/kits.ts; project handoff H-004). A team's own home and away uniforms are always its first choices;
// this edits the extras and whether the team wears white at home.
import { useEffect, useMemo, useState } from 'react';
import { kitIssues, ownUniforms, readKits, writeKits, type TeamKit } from '../../core/kits';
import { Button, Note, Row, Select, SubHead } from '../../ui';
import { KitParts } from './KitParts';
import type { WorkApi } from '../shared/WorkRom';
import './kits.css';

const same = (a: TeamKit, b: TeamKit) => JSON.stringify(a) === JSON.stringify(b);

export function KitEditor({ api, names }: { api: WorkApi; names: string[] }) {
  const { work, rev } = api;
  const order = useMemo(() => names.map((_, t) => t).sort((a, b) => names[a].localeCompare(names[b], 'en')), [names]);
  const [team, setTeam] = useState(order[0] ?? 0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setError(null), [work, team]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const kits = useMemo(() => (work ? readKits(work.data) : []), [work, rev]);
  const loaded = useMemo(() => (work ? readKits(work.base) : []), [work]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const own = useMemo(() => (work ? ownUniforms(work.data, team) : null), [work, rev, team]);
  if (!work || !own || !kits[team]) return null;
  const kit = kits[team];
  const changed = kits.flatMap((k, t) => (same(k, loaded[t]) ? [] : [t]));

  const save = (next: TeamKit[]) => {
    const issues = kitIssues(next, names);
    if (issues.length) return setError(issues[0]);
    try {
      writeKits(work.data, next);
      setError(null);
      api.edited();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const put = (k: TeamKit) => save(kits.map((x, t) => (t === team ? k : x)));
  return (
    <section className="kit" aria-label="Alternate uniforms">
      <SubHead>Alternate uniforms</SubHead>
      <p className="kit-lead">
        Extra helmets, jerseys and pants a team can pick on the controller screen (Y on a 6-button pad). A team's own
        home and away uniforms are always its first choices and are not listed here.
      </p>
      <Row>
        <Select label="Team" value={team} options={order.map((t) => ({ value: t, label: changed.includes(t) ? `${names[t]} (changed)` : names[t] }))} onChange={(v) => setTeam(Number(v))} />
        <Select
          label="Home jersey"
          value={kit.whiteHome ? 'white' : 'dark'}
          options={[{ value: 'dark', label: 'Dark at home' }, { value: 'white', label: 'White at home' }]}
          onChange={(v) => put({ ...kit, whiteHome: v === 'white' })}
        />
      </Row>
      {error && <Note kind="error">{error}</Note>}

      <KitParts kit={kit} own={own} name={names[team]} put={put} />
      <Row>
        <Button variant="quiet" onClick={() => put(loaded[team])} disabled={same(kit, loaded[team])}>Undo {names[team]}</Button>
        <Button variant="quiet" onClick={() => save(loaded)} disabled={!changed.length}>Undo all uniform changes</Button>
      </Row>
    </section>
  );
}
