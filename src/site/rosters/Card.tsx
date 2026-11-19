// A team's card, rebuilt in HTML from the 1993 game's roster cards (user, 2026-11-19: "The 'cards' as shown in the
// attached examples should be rebuilt in HTML, not static images ... mobile-friendly"): the title in the team color,
// the Bill Walsh seal top right, a stripe in the team's secondary color, the EA Sports logo bottom right; inside the
// box the groups as Team Rosters labels them. Offense, defense and conference take the original's "Bill's pick" line.
import type { CSSProperties } from 'react';
import type { EditionId, GroupId, RatingKey, TeamRoster } from './types';
import { cardTitle, shortName, type RosterPageData } from './pages';

/** The ratings a group's table shows, with the game's labels (weight only for the line, as the original cards). */
const COLS: Record<GroupId, RatingKey[]> = {
  QB: ['spd', 'qck', 'int', 'rng', 'pwr'], RB: ['spd', 'qck', 'int', 'hnd', 'pwr'], REC: ['spd', 'qck', 'int', 'hnd', 'pwr'],
  OL: ['wt', 'spd', 'pwr', 'int', 'blk'], KP: ['spd', 'qck', 'acc'], DL: ['spd', 'pwr', 'int', 'hnd', 'tck'],
  LB: ['spd', 'qck', 'int', 'hnd', 'tck'], DB: ['spd', 'qck', 'int', 'hnd', 'tck'],
};
/** Short labels for phones, where the card's columns are narrow. */
const SHORT: Record<RatingKey, string> = { spd: 'SPD', qck: 'QCK', int: 'INT', hnd: 'HND', pwr: 'PWR', rng: 'RNG', acc: 'ACC', tck: 'TCK', blk: 'BLK', wt: 'WT.' };
export const RATING_LABELS: Record<RatingKey, [string, string]> = {
  spd: ['SPEED', 'Speed'], qck: ['QUICK', 'Quickness'], int: ['INTEL', 'Intelligence'], hnd: ['HANDS', 'Hands'], pwr: ['POWER', 'Power'],
  rng: ['RANGE', 'Range'], acc: ['ACCURACY', 'Accuracy'], tck: ['TACKLE', 'Tackling'], blk: ['BLOCK', 'Blocking'], wt: ['WT.', 'Weight in pounds'],
};
/** Linemen's power is PWR on Team Rosters, the ball carriers' POWER. */
export const ratingLabel = (k: RatingKey, g: GroupId): [string, string] => (k === 'pwr' && (g === 'OL' || g === 'DL') ? ['PWR', 'Power'] : RATING_LABELS[k]);
const TITLES: Record<GroupId, string> = {
  QB: 'Quarterbacks', RB: 'Running backs', REC: 'Receivers', OL: 'Offensive line', KP: 'Special teams',
  DL: 'Defensive line', LB: 'Linebackers', DB: 'Defensive backs',
};
const SIDES: GroupId[][] = [['QB', 'RB', 'REC', 'OL'], ['DL', 'LB', 'DB', 'KP']];

type Vars = CSSProperties & Record<`--${string}`, string>;

export function TeamLogo({ team, edition, sheet }: { team: TeamRoster | RosterPageData['teams'][number]; edition: EditionId; sheet: RosterPageData['sheet'] }) {
  if (!team.logo) return null;
  const style: Vars = {
    '--lx': `${team.logo[0]}px`, '--ly': `${team.logo[1]}px`, '--sw': `${sheet.width}px`, '--sh': `${sheet.height}px`,
    '--cw': `${sheet.cell[0]}px`, '--ch': `${sheet.cell[1]}px`, backgroundImage: `url(/media/rosters/logos-${edition}.png)`,
  };
  return <span className="rc-logo" style={style} role="img" aria-label={`${team.school} logo`} />;
}

export function RosterCard({ team, edition, sheet }: { team: TeamRoster; edition: EditionId; sheet: RosterPageData['sheet'] }) {
  const names = edition !== 'original';
  const groups = new Map<GroupId, TeamRoster['players']>();
  for (const p of team.players) groups.set(p[8], [...(groups.get(p[8]) ?? []), p]);
  const style: Vars = { '--team': team.color, '--stripe': team.stripe };
  return (
    <div className="rc-wrap">
      <article className="rc" data-brand="dynasty" style={style} aria-label={`${team.school} roster card`}>
        <div className="rc-grid">
          <header className="rc-top">
            <TeamLogo team={team} edition={edition} sheet={sheet} />
            <h2 className="rc-title">{cardTitle(team, edition)}</h2>
          </header>
          <div className="rc-stripe" aria-hidden="true" />
          <div className="rc-box">
            <p className="rc-line">
              <span>Offense {team.off}</span><span>Defense {team.def}</span>{team.conf && <span>{team.conf}</span>}
            </p>
            <div className="rc-cols">
              {SIDES.map((side, i) => (
                <div className="rc-col" key={i}>
                  {side.filter((g) => groups.has(g)).map((g) => (
                    <table className={names ? 'rc-group' : 'rc-group rc-nonames'} key={g}>
                      <colgroup>
                        <col className="rc-c-pos" /><col className="rc-c-no" />{names && <col className="rc-c-name" />}
                        {COLS[g].map((k) => <col className="rc-c-r" key={k} />)}
                      </colgroup>
                      <thead>
                        <tr className="rc-bar"><th colSpan={COLS[g].length + (names ? 3 : 2)} scope="colgroup">{TITLES[g]}</th></tr>
                        <tr className="rc-head">
                          <th scope="col"><span className="rc-sr">Position</span></th>
                          <th scope="col">No.</th>
                          {names && <th scope="col" className="rc-left">Name</th>}
                          {COLS[g].map((k) => { const [l, full] = ratingLabel(k, g); return <th scope="col" key={k}><abbr title={full}><span className="rc-long">{l}</span><span className="rc-short" aria-hidden="true">{SHORT[k]}</span></abbr></th>; })}
                        </tr>
                      </thead>
                      <tbody>
                        {groups.get(g)!.map((p) => (
                          <tr key={p[0]}>
                            <th scope="row" className="rc-pos">{p[0]}</th>
                            <td>{p[1] ?? ''}</td>
                            {names && <td className="rc-name" title={`${p[2]} ${p[3]}`.trim() || 'Name not in the game'}>{shortName(p[2], p[3]) || '–'}</td>}
                            {COLS[g].map((k) => <td key={k}>{p[7][k] ?? ''}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="rc-ea"><img src="/media/rosters/ea-sports.png" alt="EA Sports" width={92} height={71} /></div>
        </div>
        <img className="rc-seal" src="/media/rosters/bw-seal.png" alt="Bill Walsh College Football" width={150} height={121} />
      </article>
    </div>
  );
}
