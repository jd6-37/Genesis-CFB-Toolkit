// Teams tab, 2026 and 1994 Season Editions (H-012): each team's uniforms (src/core/kits.ts; project handoff H-004): its
// own home and away pieces (locked behind a warning: the game also colors the end zones and the crowd from them) and
// the extras for the picker on the controller screen, and whether it wears white at home.
import { useEffect, useMemo, useState } from 'react';
import { kitIssues, ownChanges, ownUniforms, readKits, readKitSprite, writeKits, writeOwnUniforms, type OwnUniforms, type TeamKit } from '../../core/kits';
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
  const sprite = useMemo(() => (work ? readKitSprite(work.data) : null), [work]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ownChanged = useMemo(() => (work ? ownChanges(work.base, work.data) : []), [work, rev]);
  if (!work || !own || !kits[team]) return null;
  const kit = kits[team];
  const changed = [...new Set([...kits.flatMap((k, t) => (same(k, loaded[t]) ? [] : [t])), ...ownChanged])];

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
  const putOwn = (o: OwnUniforms, t = team) => {
    try {
      writeOwnUniforms(work.data, t, o);
      setError(null);
      api.edited();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const undoTeam = (t: number) => { putOwn(ownUniforms(work.base, t), t); put(loaded[t]); };
  return (
    <section className="kit" aria-label="Uniforms">
      <SubHead>Uniforms</SubHead>
      <p className="kit-lead">
        Each team's own home and away uniforms, and extra helmets, jerseys and pants it can pick on the controller screen
        (Y on a 6-button pad).
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

      <KitParts kit={kit} own={own} sprite={sprite} name={names[team]} put={put} putOwn={putOwn} />
      <Row>
        <Button variant="quiet" onClick={() => undoTeam(team)} disabled={!changed.includes(team)}>Undo {names[team]}</Button>
        <Button variant="quiet" onClick={() => { for (const t of ownChanged) writeOwnUniforms(work.data, t, ownUniforms(work.base, t)); save(loaded); }} disabled={!changed.length}>Undo all uniform changes</Button>
      </Row>
    </section>
  );
}
