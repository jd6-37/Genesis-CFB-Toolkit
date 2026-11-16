// The offseason's first step, the coaching carousel (carousel.ts; mockups: "Offseason step 1" and "Job offers" on
// the coaches canvas): retirements and firings, the job offers to the coaches the user manages (a school's
// situation in a window), the user's own changes, then the computer's hiring.
import { useMemo, useState } from 'react';
import type { Dynasty, OffseasonEvent } from '../../core/dynasty/model';
import { coachOvr } from '../../core/dynasty/coaches';
import { finishCarousel, fireCoach, goalsFor, openings, placeCoach } from '../../core/dynasty/carousel';
import { academicGrade } from '../../core/dynasty/academics';
import { prestigeStars } from '../../core/dynasty/offseason';
import { seasonView, playerName } from '../../core/dynasty/derive';
import { MAX_PRESTIGE } from '../../core/dynasty/prestige';
import { Button, Check, Modal, Select, SubHead, Table } from '../../ui';
import { CoachLink, CoachStars } from './CoachPages';
import { TeamLink, TeamMark, href, useDyn } from './ui';
import type { OffseasonActions } from './OffseasonPage';

const schoolStars = (n: number) => (
  <span className="dy-prestige" role="img" aria-label={`Prestige: ${n} of ${MAX_PRESTIGE} stars`}>{'★'.repeat(n)}<span>{'★'.repeat(MAX_PRESTIGE - n)}</span></span>
);

/** A school's situation for a coach weighing its offer (user, mockup comment): prestige, academics, results, players, classes, draft picks. */
function SchoolSheet({ team, onClose, onPick, picked }: { team: number; onClose: () => void; onPick: () => void; picked: boolean }) {
  const { d } = useDyn();
  const [open, setOpen] = useState<number | null>(null);
  const si = d.seasons.length - 1;
  const v = useMemo(() => seasonView(d, d.seasons[si]), [d, si]);
  const s = d.seasons[si];
  const rec = v.records[team];
  const ovr = s.teamOvr?.[team];
  const roster = d.players.filter((p) => p.team === team && p.status === 'active');
  const top = roster.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 5);
  const returning = (s.slots[team] ?? []).filter((id) => id !== null && d.players[id - 1]?.status === 'active' && d.players[id - 1]?.team === team).length;
  // The last three signing classes (each season's offseason events), and players who left for the pros.
  // Each season's events are its offseason's (the class signed before it, the players who left for the pros).
  const classes = d.seasons.slice(-3).reverse().map((x) => {
    const ev = x.events ?? [];
    const cls = ev.find((e) => e.kind === 'class' && e.team === team) as Extract<OffseasonEvent, { kind: 'class' }> | undefined;
    const signed = ev.filter((e) => e.kind === 'signed' && e.team === team) as Extract<OffseasonEvent, { kind: 'signed' }>[];
    const pros = ev.filter((e) => e.kind === 'pro' && e.team === team).length;
    return { year: x.year, rank: cls?.rank ?? null, signed: signed.sort((a, b) => b.stars - a.stars || b.ovr - a.ovr), pros };
  });
  // Players who left for the pros: in the offseason in progress, and in the offseasons before the last seasons.
  const nowPros = (d.offseason?.events ?? []).filter((e) => e.kind === 'pro' && e.team === team).length;
  const drafted = nowPros + classes.reduce((a, c) => a + c.pros, 0);
  const draftYears = classes.length + (d.offseason ? 1 : 0);
  const goals = goalsFor(d, si, team);
  return (
    <Modal
      title={d.teams[team].school}
      media={<TeamMark team={team} size={48} />}
      sub={<>{schoolStars(prestigeStars(d, team))} · Academics {academicGrade(d.teams[team].school)}</>}
      onClose={onClose}
      actions={<><Button onClick={onPick}>{picked ? 'Picked' : 'Pick this offer'}</Button><Button variant="quiet" onClick={onClose}>Close</Button></>}
    >
      <Table words>
        <tbody>
          <tr><th>{s.year}</th><td>{v.save ? `${rec.w}-${rec.l}${v.rank[team] <= 25 ? `, final rank ${v.rank[team]}` : ''}` : 'No results imported'}</td></tr>
          {ovr && <tr><th>OFF / DEF</th><td>{ovr.off} / {ovr.def}</td></tr>}
          <tr><th>Returning starters</th><td>{returning} of 32</td></tr>
          <tr><th>Players drafted</th><td>{drafted} in the last {draftYears} {draftYears === 1 ? 'offseason' : 'offseasons'}{nowPros ? ` (${nowPros} this one)` : ''}</td></tr>
          <tr><th>Goals at hire</th><td>{goals.map((g) => g.text).join('; ')}</td></tr>
        </tbody>
      </Table>
      <SubHead>Top players</SubHead>
      <Table>
        <thead><tr><th className="ui-left">Pos</th><th className="ui-left">Player</th><th className="ui-left">Class</th><th>OVR</th></tr></thead>
        <tbody>{top.map((p) => <tr key={p.id}><td className="ui-left">{p.pos}</td><td className="ui-left"><a href={href(`player/${p.id}`)}>{playerName(p)}</a></td><td className="ui-left">{p.cls}</td><td className="ui-num">{p.ovr}</td></tr>)}</tbody>
      </Table>
      <SubHead>Signing classes</SubHead>
      {classes.some((c) => c.rank !== null) ? classes.map((c) => (
        <div key={c.year}>
          <button type="button" className="dy-classrow" aria-expanded={open === c.year} onClick={() => setOpen(open === c.year ? null : c.year)} disabled={c.rank === null}>
            <span>{c.year} class</span><span>{c.rank !== null ? <>No. <span className="ui-num">{c.rank}</span> · {c.signed.length} signed</> : 'Not in the dynasty'}</span>
          </button>
          {open === c.year && (
            <ul className="dy-classlist">
              {c.signed.slice(0, 12).map((e) => { const p = d.players[e.player - 1]; return <li key={e.player}>{e.stars ? '★'.repeat(e.stars) : 'Walk-on'} {p.pos} <a href={href(`player/${p.id}`)}>{playerName(p)}</a> <span className="dy-dim">OVR {e.ovr}</span></li>; })}
            </ul>
          )}
        </div>
      )) : <p className="dy-dim">No signing classes in the dynasty yet.</p>}
    </Modal>
  );
}

export function CarouselStep({ actions, busy }: { actions: OffseasonActions; busy: string | null }) {
  const { d } = useDyn();
  const st = d.offseason!.carousel!;
  const year = d.offseason!.year;
  const c = (id: number) => d.coaches![id];
  const [picks, setPicks] = useState<Record<number, number>>({});
  const [keep, setKeep] = useState<Record<number, { add: boolean; keep: boolean }>>({});
  const [sheet, setSheet] = useState<{ coach: number; team: number } | null>(null);
  const [placeTeam, setPlaceTeam] = useState<string>(String(d.userTeams[0] ?? 0));
  const [placeCoachId, setPlaceCoachId] = useState<string>('');
  const open = openings(d);
  const pool = d.coaches!.filter((x) => x.status === 'pool').sort((a, b) => coachOvr(b.ratings) - coachOvr(a.ratings));
  const offerCoaches = Object.keys(st.offers).map(Number);
  const commit = (next: Dynasty, done?: string) => actions.run('Saving…', () => actions.commit(next, done));
  return (
    <>
      <p>The {year} season is over: head coaches earned their XP, some retired and some were fired. Answer your coaches' job offers and make your own changes, then the schools hire for every opening, from the most prestigious down.</p>

      <SubHead>Retirements</SubHead>
      {st.retired.length ? (
        <Table>
          <thead><tr><th className="ui-left">Coach</th><th>Age</th><th className="ui-left">Last job</th></tr></thead>
          <tbody>{st.retired.map((x) => <tr key={x.coach}><td className="ui-left"><CoachLink coach={c(x.coach)} /></td><td className="ui-num">{x.age}</td><td className="ui-left">{x.team !== null ? <TeamLink team={x.team} rank={false} /> : c(x.coach).poolNote ?? 'Not coaching'}</td></tr>)}</tbody>
        </Table>
      ) : <p className="dy-dim">Nobody retired.</p>}

      <SubHead>Fired</SubHead>
      {st.fired.length ? (
        <Table>
          <thead><tr><th className="ui-left">Coach</th><th className="ui-left">School</th><th>Hot seat</th></tr></thead>
          <tbody>{st.fired.map((x) => <tr key={x.coach}><td className="ui-left"><CoachLink coach={c(x.coach)} /></td><td className="ui-left"><TeamLink team={x.team} rank={false} /></td><td className="ui-num">{x.heat}</td></tr>)}</tbody>
        </Table>
      ) : <p className="dy-dim">Nobody was fired.</p>}

      <SubHead>Your coaches' job offers</SubHead>
      {offerCoaches.length ? offerCoaches.map((cid) => {
        const coach = c(cid);
        const mineTeam = coach.team !== null && d.userTeams.includes(coach.team);
        const pick = picks[cid];
        return (
          <div key={cid} className="dy-offers">
            <p><CoachLink coach={coach} /> {coach.team !== null ? <>({d.teams[coach.team].school})</> : '(in the pool)'}: {st.offers[cid].length} {st.offers[cid].length === 1 ? 'offer' : 'offers'}. Pick one to see the school.</p>
            <ul className="dy-offerlist">
              {st.offers[cid].map((t) => (
                <li key={t}>
                  <button type="button" className="dy-offer" aria-pressed={pick === t} onClick={() => setSheet({ coach: cid, team: t })}>
                    <TeamMark team={t} size={32} /><span><strong>{d.teams[t].school}</strong><br /><span className="dy-small dy-dim">{'★'.repeat(prestigeStars(d, t))} · Academics {academicGrade(d.teams[t].school)}</span></span>
                  </button>
                </li>
              ))}
              <li>
                <button type="button" className="dy-offer" aria-pressed={pick === undefined} onClick={() => setPicks((p) => { const n = { ...p }; delete n[cid]; return n; })}>
                  <span><strong>{coach.team !== null ? `Stay at ${d.teams[coach.team].school}` : 'Stay in the pool'}</strong><br /><span className="dy-small dy-dim">Decline every offer this year</span></span>
                </button>
              </li>
            </ul>
            {pick !== undefined && mineTeam && (
              <div className="dy-offerteams">
                <Check checked={keep[cid]?.add ?? true} onChange={(on) => setKeep((k) => ({ ...k, [cid]: { add: on, keep: k[cid]?.keep ?? true } }))}>Add {d.teams[pick].school} to your teams</Check>
                <Check checked={keep[cid]?.keep ?? true} onChange={(on) => setKeep((k) => ({ ...k, [cid]: { add: k[cid]?.add ?? true, keep: on } }))}>Keep {d.teams[coach.team!].school} in your teams</Check>
              </div>
            )}
          </div>
        );
      }) : <p className="dy-dim">{d.coaches!.some((x) => x.manageXp) ? 'No offers this year.' : 'Offers go to the coaches you manage (Manage XP on a coach page).'}</p>}

      <SubHead>Your changes</SubHead>
      <p className="dy-small dy-dim">Put any coach from the pool on any team (the team's coach goes to the pool), or fire a team's coach. Coaches change teams only now, before the season ROM is made.</p>
      <div className="dy-row dy-carousel-edit">
        <Select label="Team" value={placeTeam} onChange={setPlaceTeam} options={d.teams.map((t) => ({ value: String(t.index), label: `${t.school}${d.coaches!.some((x) => x.team === t.index) ? '' : ' (open)'}` }))} />
        <Select label="Coach" value={placeCoachId} onChange={setPlaceCoachId} placeholder="A coach from the pool" options={pool.map((x) => ({ value: String(x.id), label: `${x.name}, OVR ${coachOvr(x.ratings)} (${x.poolNote ?? 'pool'})` }))} />
        <Button disabled={!!busy || placeCoachId === ''} onClick={() => commit(placeCoach(d, Number(placeCoachId), Number(placeTeam)))}>Put on team</Button>
        <Button variant="quiet" disabled={!!busy || !d.coaches!.some((x) => x.team === Number(placeTeam))} onClick={() => commit(fireCoach(d, Number(placeTeam)))}>Fire {d.teams[Number(placeTeam)].school}'s coach</Button>
      </div>
      {st.moves.filter((m) => m.kind === 'yours').length > 0 && (
        <ul className="dy-small">{st.moves.filter((m) => m.kind === 'yours').map((m, i) => <li key={i}><CoachLink coach={c(m.coach)} /> to {d.teams[m.to].school}</li>)}</ul>
      )}

      <SubHead>Openings</SubHead>
      <p>{open.length ? `${open.map((t) => d.teams[t].school).join(', ')}. The schools fill them next; a head coach who moves up opens his old job.` : 'None yet.'}</p>
      <div className="dy-row dy-next">
        <Button disabled={!!busy} onClick={() => actions.run('Hiring…', () => actions.commit(finishCarousel(d, picks, keep), 'The coaching carousel is done. Next: your projected depth chart.'))}>
          {Object.keys(picks).length ? 'Accept the offers you picked and hire' : 'Hire for every opening'}
        </Button>
      </div>

      {sheet && (
        <SchoolSheet
          team={sheet.team}
          picked={picks[sheet.coach] === sheet.team}
          onClose={() => setSheet(null)}
          onPick={() => { setPicks((p) => ({ ...p, [sheet.coach]: sheet.team })); setSheet(null); }}
        />
      )}
    </>
  );
}

/** The carousel's results, on the steps after it: who moved where. */
export function CarouselSummary() {
  const { d } = useDyn();
  const st = d.offseason?.carousel;
  if (!st?.done) return null;
  const c = (id: number) => d.coaches![id];
  const hires = st.moves;
  return (
    <details className="dy-carousel-sum">
      <summary>Coaching carousel: {st.retired.length} retired, {st.fired.length} fired, {hires.length} hired</summary>
      <Table>
        <thead><tr><th className="ui-left">School</th><th className="ui-left">New coach</th><th className="ui-left">From</th></tr></thead>
        <tbody>
          {hires.map((m, i) => (
            <tr key={i}>
              <td className="ui-left"><TeamLink team={m.to} rank={false} /></td>
              <td className="ui-left"><CoachLink coach={c(m.coach)} /> <CoachStars stars={c(m.coach).prestige} /></td>
              <td className="ui-left">{m.from !== null ? `Head coach, ${d.teams[m.from].school}` : 'The pool'}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </details>
  );
}
