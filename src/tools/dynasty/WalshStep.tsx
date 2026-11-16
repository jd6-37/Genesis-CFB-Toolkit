// The offseason's Walsh Reports step (user, 2026-11-16: "auto-generated Walsh reports … all teams every offseason. And
// the user should have the chance to edit them"): every team's report as the app wrote it (walshGen.ts), read one team
// at a time; Edit opens the Toolkit's Walsh Report editor, "Write it again" picks other wording, and an edited report
// can go back to the app's. Every report goes into the season ROM.
import { Button, Note, Select, SubHead } from '../../ui';
import { useMemo, useState } from 'react';
import { editedCount, rewriteWalshReport, setWalshReport, teamReport, walshLock } from '../../core/dynasty/walshStore';
import { preseasonPoll } from '../../core/dynasty/poll';
import { reportLength, REPORT_LIMIT } from '../../core/walshReports';
import type { Dynasty } from '../../core/dynasty/model';
import { WalshEditor } from '../walsh/WalshEditor';
import { firstTeam, href, useDyn } from './ui';

export function WalshStep({ commit, busy }: { commit: (d: Dynasty, done?: string) => Promise<void>; busy: boolean }) {
  const { d, focus } = useDyn();
  const season = d.seasons[d.seasons.length - 1];
  const [team, setTeam] = useState<number>(firstTeam(d, focus) ?? 0);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = walshLock(d);
  const r = useMemo(() => teamReport(d, season, team), [d, season, team]);
  const poll = useMemo(() => preseasonPoll(d, season), [d, season]);
  const rank = new Map((poll ?? []).map((p) => [p.team, p.rank]));

  // Your teams first, then the Top 25, then everyone else by name.
  const order = d.teams.map((t) => t.index).sort((a, b) => {
    const ua = d.userTeams.includes(a) ? 0 : 1, ub = d.userTeams.includes(b) ? 0 : 1;
    const ra = (rank.get(a) ?? 999) <= 25 ? rank.get(a)! : 999, rb = (rank.get(b) ?? 999) <= 25 ? rank.get(b)! : 999;
    return ua - ub || ra - rb || d.teams[a].school.localeCompare(d.teams[b].school);
  });
  const k = order.indexOf(team);
  const label = (t: number) => `${(rank.get(t) ?? 99) <= 25 ? `No. ${rank.get(t)} ` : ''}${d.teams[t].school}${d.userTeams.includes(t) ? ' (yours)' : ''}`;
  const run = async (next: () => Dynasty, done: string) => {
    setError(null);
    try { await commit(next(), done); } catch (e) { setError((e as Error).message); }
  };

  if (!r) return <Note>{lock ?? 'No Walsh Reports for this season.'}</Note>;
  const school = d.teams[team].school;
  const n = reportLength(r.report);
  return (
    <section className="dy-walsh">
      <SubHead>{season.year} Walsh Reports</SubHead>
      <p>
        Bill Walsh's scouting report on every team, written from last season, this offseason's comings and goings, the
        players' ratings and the preseason poll. The game shows it before a team's games. Read any team's, change it, or
        have it written again; all {d.teams.length} go into the {season.year} ROM.
        {editedCount(season) > 0 && ` You changed ${editedCount(season)} by hand.`}
      </p>
      {lock && <Note>{lock}</Note>}
      {error && <Note kind="error">{error}</Note>}
      <div className="dy-walsh-pick">
        <Select label="Team" value={team} options={order.map((t) => ({ value: t, label: label(t) }))} onChange={(v) => setTeam(Number(v))} />
        <div className="dy-row">
          <Button variant="quiet" disabled={k <= 0} onClick={() => setTeam(order[k - 1])}>Previous team</Button>
          <Button variant="quiet" disabled={k >= order.length - 1} onClick={() => setTeam(order[k + 1])}>Next team</Button>
        </div>
      </div>
      <article className="dy-walsh-report" aria-label={`${school} Walsh Report`}>
        <h3>{school}{r.edited && <span className="dy-walsh-tag">Edited</span>}</h3>
        <p><b>Offense.</b> {r.report.offense}</p>
        <p><b>Defense.</b> {r.report.defense}</p>
        <p className="dy-small dy-dim">{n} of {REPORT_LIMIT} characters</p>
      </article>
      <div className="dy-row">
        <Button disabled={!!lock || busy} onClick={() => setEditing(true)}>Edit</Button>
        <Button variant="quiet" disabled={!!lock || busy} onClick={() => run(() => rewriteWalshReport(d, team), `${school}'s report is written again.`)}>Write it again</Button>
        {r.edited && (
          <Button variant="quiet" disabled={!!lock || busy} onClick={() => run(() => setWalshReport(d, team, null), `${school}'s report is the app's again.`)}>Use the app's report</Button>
        )}
      </div>
      <div className="dy-row dy-next"><Button href={href('offseason/rom')}>Next: download the ROM</Button></div>
      {editing && (
        <WalshEditor
          team={school}
          value={r.report}
          original={r.generated}
          originalLabel="Back to the app's report"
          trims={[]}
          onSave={(x) => {
            const same = x.offense === r.generated.offense && x.defense === r.generated.defense;
            void run(() => setWalshReport(d, team, same ? null : x), `${school}'s report is saved.`);
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </section>
  );
}
