// Season awards (awards.ts; user, 2026-11-12): the Heisman, position awards, the All-American teams and each
// conference's first team, for any finished season. Mobile first: one column of tables on phones.
import { PageHead, Select, SubHead } from '../../ui';
import { useMemo, useState } from 'react';
import { AWARD_SPOTS, seasonAwards, type Candidate } from '../../core/dynasty/awards';
import { playerName } from '../../core/dynasty/derive';
import { Empty, TeamLink, href, playerOf, useDyn } from './ui';

function spotOf(c: Candidate) {
  return AWARD_SPOTS.find((s) => s.roles.includes(c.role))?.label ?? c.role;
}

function TeamTable({ list }: { list: Candidate[] }) {
  const { d } = useDyn();
  return (
    <div className="dy-scroll-x">
      <table className="dy-table dy-awards-table">
        <tbody>
          {list.map((c) => {
            const p = playerOf(d, c.player);
            return (
              <tr key={c.player}>
                <td className="dy-left dy-dim">{AWARD_SPOTS.some((x) => x.roles.includes(c.role)) ? spotOf(c) : c.role}</td>
                <td className="dy-left">{p ? <a href={href(`player/${p.id}`)}>{playerName(p)}</a> : 'Unknown player'}<div className="dy-small dy-dim">{c.line}</div></td>
                <td className="dy-left"><TeamLink team={c.team} rank={false} size={16} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Awards({ arg }: { arg?: string }) {
  const { d } = useDyn();
  const all = useMemo(() => d.seasons.map((s) => ({ s, a: seasonAwards(d, s) })).filter((x) => x.a), [d]);
  const asked = Number(arg);
  const pick = all.find((x) => x.s.year === asked) ?? all[all.length - 1];
  const confs = pick ? Object.keys(pick.a!.allConference).map(Number) : [];
  const [conf, setConf] = useState<number | null>(null);
  if (!pick) return <Empty><p>Awards are handed out once a season is over: import the save after the national championship game.</p></Empty>;
  const a = pick.a!;
  const c = conf !== null && confs.includes(conf) ? conf : (confs.find((x) => d.userTeams.some((u) => pick.s.conf[u] === x)) ?? confs[0]);
  const winner = a.heisman[0];
  const wp = winner ? playerOf(d, winner.player) : undefined;
  return (
    <section className="dy-awards">
      <PageHead
        title={`${a.year} awards`}
        actions={all.length > 1 ? <Select label="Season" hideLabel value={a.year} options={all.slice().reverse().map((x) => ({ value: x.s.year, label: `${x.s.year}` }))} onChange={(x) => { location.hash = href(`awards/${x}`); }} /> : undefined}
      />
      <p className="dy-dim dy-small">Worked out from the season's stats and the players' OVR: the leaders by stats are considered, then the better players win out (offensive linemen, who have no stats, by OVR and team wins).</p>
      {wp && winner && (
        <div className="dy-heisman">
          <p className="dy-heisman-title">Heisman Trophy</p>
          <p className="dy-heisman-name"><a href={href(`player/${wp.id}`)}>{playerName(wp)}</a></p>
          <p className="dy-heisman-team"><TeamLink team={winner.team} rank={false} /><span className="dy-dim">{wp.pos}</span></p>
          {a.heisman.length > 1 && (
            <p className="dy-small dy-dim">Finalists: {a.heisman.slice(1).map((h, i) => { const p = playerOf(d, h.player); return <span key={h.player}>{i ? ', ' : ''}{p ? <a href={href(`player/${p.id}`)}>{playerName(p)}</a> : ''} ({d.teams[h.team].school})</span>; })}</p>
          )}
        </div>
      )}
      <SubHead>Position awards</SubHead>
      <TeamTable list={a.position.flatMap((x) => (x.winner ? [{ ...x.winner, role: x.label }] : []))} />
      <div className="dy-team-cols">
        <div>
          <SubHead>All-American first team</SubHead>
          <TeamTable list={a.allAmerican[0]} />
        </div>
        <div>
          <SubHead>All-American second team</SubHead>
          <TeamTable list={a.allAmerican[1]} />
        </div>
      </div>
      <SubHead>All-Conference first teams</SubHead>
      <select aria-label="Conference" value={c} onChange={(e) => setConf(Number(e.target.value))}>
        {confs.map((x) => <option key={x} value={x}>{pick.s.confNames[x]}</option>)}
      </select>
      <TeamTable list={a.allConference[c] ?? []} />
    </section>
  );
}
