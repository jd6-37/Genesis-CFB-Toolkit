// The Teams tab's College Football 27 reference: every CFB 27 team's offense style and defensive
// playbook, and the Bill Walsh '95 styles recommended for it (src/core/cfb27Styles.ts).
import { Check, Field, SubHead, Table } from '../../ui';
import { useMemo, useState } from 'react';
import { CFB27, OFFENSE_FOR } from '../../core/cfb27Styles';
import { DEFENSE, OFFENSE } from '../../core/styles';

export function Cfb27Reference({ onRom }: { onRom: Set<string> | null }) {
  const [query, setQuery] = useState('');
  const [onlyRom, setOnlyRom] = useState(false);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CFB27.filter(
      (t) =>
        (!q || t.school.toLowerCase().includes(q) || t.conference.toLowerCase().includes(q)) &&
        (!onlyRom || !onRom || onRom.has(t.school)),
    );
  }, [query, onlyRom, onRom]);
  const byOffense = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const [cfb, bw] of Object.entries(OFFENSE_FOR)) m.set(bw, [...(m.get(bw) ?? []), cfb]);
    return m;
  }, []);

  return (
    <section className="cfb-ref" aria-labelledby="cfb-ref-title">
      <SubHead id="cfb-ref-title">College Football 27 teams</SubHead>
      <p className="cfb-ref-lede">
        Each team's offense style and defensive playbook in College Football 27 (as of November 2026), and the Bill
        Walsh '95 styles recommended for it. <b>Apply recommended styles</b> above sets them for the teams on your ROM.
      </p>
      <div className="cfb-rules">
        <div>
          <h4>Offense</h4>
          <ul>
            {OFFENSE.map((bw) => (
              <li key={bw}>
                {(byOffense.get(bw) ?? []).join(', ')} → <b>{bw}</b>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Defense, by down linemen</h4>
          <ul>
            <li>
              3-4, 3-3-5 and 3-2-6 playbooks → <b>{DEFENSE[0]}</b>
            </li>
            <li>
              4-3 and 4-2-5 → <b>{DEFENSE[1]}</b>
            </li>
            <li>
              Multiple → <b>{DEFENSE[2]}</b>
            </li>
          </ul>
        </div>
      </div>
      <div className="cfb-tools">
        <div className="cfb-search">
          <Field label="Find a team or conference" type="search" value={query} onChange={setQuery} placeholder="e.g. Tulane or SEC" />
        </div>
        {onRom && (
          <Check checked={onlyRom} onChange={setOnlyRom}>Only teams on this ROM ({onRom.size})</Check>
        )}
        <span className="cfb-count" aria-live="polite">
          {rows.length} of {CFB27.length} teams{onRom ? ' · ● on this ROM' : ''}
        </span>
      </div>
      <div className="cfb-scroll">
        <Table words className="cfb-table">
          <thead>
            <tr>
              <th scope="col">School</th>
              <th scope="col">Conference</th>
              <th scope="col">CFB 27 offense</th>
              <th scope="col">CFB 27 defense</th>
              <th scope="col" className="cfb-bw">
                BW95 offense
              </th>
              <th scope="col" className="cfb-bw">
                BW95 defense
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.school} className={onRom?.has(t.school) ? 'cfb-on-rom' : undefined}>
                <th scope="row">{t.school}</th>
                <td>{t.conference}</td>
                <td>{t.offense}</td>
                <td>{t.defense}</td>
                <td className="cfb-bw">{OFFENSE[t.recommended.offense]}</td>
                <td className="cfb-bw">{DEFENSE[t.recommended.defense]}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </section>
  );
}
