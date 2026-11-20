// The offseason's Impact players step (H-028; user, 2026-11-18: "Add a step to the offseason where the user can, if
// they choose, change the auto-selected impact players for their user-controlled teams. Max 2 per side of the
// ball."): the app picks three for every team the way the game does; here the user may pick his own teams' three
// from the Active Roster's starters (QB, HB1, FB, SE, FL, WR3, TE1, the starting defenders; H-047). The season ROM carries every team's three.
import { useEffect, useMemo, useState } from 'react';
import { Button, Note, Select, SubHead } from '../../ui';
import {
  gameImpact, IMPACT_SIDE_MAX, impactChoices, impactLock, impactPicksProblem, ownImpact, setImpactPicks, teamImpact,
} from '../../core/dynasty/impact';
import type { Dynasty } from '../../core/dynasty/model';
import { playerName } from '../../core/dynasty/derive';
import { firstTeam, href, ImpactDot, useDyn } from './ui';

export function ImpactStep({ commit, busy, setup }: { commit: (d: Dynasty, done?: string) => Promise<void>; busy: boolean; /** In setup: no link to the next offseason step. */ setup?: boolean }) {
  const { d, focus } = useDyn();
  const season = d.seasons[d.seasons.length - 1];
  const [team, setTeam] = useState<number | undefined>(firstTeam(d, focus));
  const current = useMemo(() => (team === undefined ? [] : teamImpact(d, season, team)), [d, season, team]);
  const [picks, setPicks] = useState<number[]>(current);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setPicks(current); setError(null); }, [current]);
  const lock = impactLock(d);
  const next = setup ? null : <div className="dy-row dy-next"><Button href={href('offseason/conferences')}>Next: the conferences</Button></div>;

  const intro = (
    <p>
      Three players a team are impact players: the game marks them with an X on the field and a yellow dot on Team
      Rosters, and a hot streak puts them in the zone. The app picks them for every team the way the game does. You can
      pick your own teams' three instead, at most {IMPACT_SIDE_MAX} on offense or on defense. The other teams keep the
      game's pick.
    </p>
  );
  if (team === undefined) {
    return <><SubHead>{season.year} impact players</SubHead>{intro}<Note>You have no teams of your own, so every team gets the game's pick.</Note>{next}</>;
  }

  const school = d.teams[team].school;
  const choices = impactChoices(season, team);
  const name = (id: number) => playerName(d.players[id - 1]);
  const label = (id: number) => {
    const c = choices.find((x) => x.id === id);
    return `${c ? `${c.label} ` : ''}${name(id)}, OVR ${d.players[id - 1].ovr}`;
  };
  const options = choices.map((c) => ({ value: c.id, label: label(c.id), group: c.defense ? 'Defense' : 'Offense' }));
  const problem = impactPicksProblem(season, team, picks);
  const game = gameImpact(d, season, team);
  const own = ownImpact(season, team);
  const changed = [...picks].sort().join() !== [...current].sort().join();
  const run = async (ids: number[] | null, done: string) => {
    setError(null);
    try { await commit(setImpactPicks(d, team, ids), done); } catch (e) { setError((e as Error).message); }
  };

  return (
    <section className="dy-impactstep">
      <SubHead>{season.year} impact players</SubHead>
      {intro}
      {lock && <Note>{lock}</Note>}
      {error && <Note kind="error">{error}</Note>}
      {d.userTeams.length > 1 && (
        <Select label="Team" value={team} options={d.userTeams.map((t) => ({ value: t, label: d.teams[t].school }))} onChange={(x) => setTeam(Number(x))} />
      )}
      <p className="dy-small">
        <ImpactDot />{' '}
        {own ? `${school}'s three are your pick. ` : `${school}'s three are the game's pick. `}
        The game's pick: {game.map(label).join('; ')}.
      </p>
      <div className="dy-impactstep-picks">
        {[0, 1, 2].map((k) => (
          <Select
            key={k}
            label={`Impact player ${k + 1}`}
            value={picks[k] ?? ''}
            disabled={!!lock || busy}
            options={options}
            onChange={(x) => setPicks(picks.map((id, j) => (j === k ? Number(x) : id)))}
          />
        ))}
      </div>
      {changed && problem && <Note kind="error">{problem}</Note>}
      <div className="dy-row">
        <Button disabled={!!lock || busy || !changed || !!problem} onClick={() => run(picks, `${school}'s impact players are saved.`)}>Save {school}'s impact players</Button>
        {changed && <Button variant="quiet" disabled={busy} onClick={() => setPicks(current)}>Undo changes</Button>}
        {own && <Button variant="quiet" disabled={!!lock || busy} onClick={() => run(null, `${school} has the game's pick again.`)}>Use the game's pick</Button>}
      </div>
      {next}
    </section>
  );
}
