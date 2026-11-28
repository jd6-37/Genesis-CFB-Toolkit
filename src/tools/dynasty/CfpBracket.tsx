// The playoff bracket under Scores (user, 2026-11-28: "a 'CFP Bracket' link in-line next to the Scores headline
// text ... a bracket page child of Scores"), in the CFP's black and gold, and the CFP's headline art.
// Every format the game plays: CFP 12 and 24 (first round, then the bye teams' round), CFP 4 and BCS 2.

import { type CSSProperties, type ReactNode, useMemo } from 'react';
import { bracketOf, cfpLabel, type Bracket, type BracketGame, type BracketSlot } from '../../core/dynasty/bracket';
import { weekName } from '../../core/dynasty/derive';
import type { Story } from '../../core/dynasty/news';
import { PageHead } from '../../ui';
import { href, mainColor, recordText, TeamMark, teamCss, useDyn } from './ui';

/** The CFP's gold football mark (from the CFP's 2026 brand; collegefootballplayoff.com/news/2026/4/14/brand). */
export const CFP_MARK = '/media/cfp/cfp_mark.png';

const style = (vars: Record<string, string | number>) => vars as CSSProperties;

/** The season's bracket, worked out once per season view. */
function useBracket(): Bracket | null {
  const { d, v } = useDyn();
  return useMemo(() => bracketOf(d, v), [d, v]);
}

/** The "CFP Bracket" button next to the Scores title (only in seasons with a playoff). */
export function CfpLink() {
  const b = useBracket();
  if (!b) return null;
  return (
    <a className="cfp-link" href={href('scores/bracket')}>
      <img src={CFP_MARK} alt="" />{b.size === 2 ? 'BCS Bracket' : 'CFP Bracket'}
    </a>
  );
}

export function CfpBracket() {
  const { d, v } = useDyn();
  const b = useBracket();
  if (!b) {
    return (
      <section>
        <a className="cfp-back" href={href('scores')}>‹ Scores</a>
        <PageHead title="Playoff bracket">This season has no playoff.</PageHead>
      </section>
    );
  }
  const played = v.games.filter((g) => g.vs !== null).map((g) => g.week);
  const after = played.length ? weekName(v, Math.max(...played)) : null;
  const bcs = b.size === 2;
  return (
    <section className={`cfp${b.final ? '' : ' cfp-projected'} cfp-size-${b.size}`}>
      <a className="cfp-back" href={href('scores')}>‹ Scores</a>
      <header className="cfp-head">
        <img src={CFP_MARK} alt="" className="cfp-head-mark" />
        <div>
          <p className="cfp-head-kicker">{bcs ? 'BCS National Championship' : `College Football Playoff${b.size !== 12 ? `, ${b.size} teams` : ''}`}</p>
          <h2 className="cfp-head-title">{v.season.year} Bracket</h2>
        </div>
      </header>
      {!b.final && (
        <p className="cfp-proj">
          <strong>Projected</strong> {after ? `If the season ended after ${after}.` : 'If the season started today.'} The real field is set after the conference championships.
        </p>
      )}
      <div className="cfp-scroll">
        <BracketGrid b={b} />
      </div>
      {!b.final && b.picture.out.length > 0 && (
        <p className="cfp-out"><strong>First four out:</strong> {b.picture.out.map((t) => d.teams[t].school).join(', ')}</p>
      )}
    </section>
  );
}

/**
 * The bracket as a grid: a column per round, the title game in its own panel on the right. The first round and the
 * bye round share rows (a pod); each later game spans the rows of the two it comes from. On a phone the grid is a
 * single column in bracket order (each pod, then the game it feeds), so the same markup scrolls down the page.
 */
function BracketGrid({ b }: { b: Bracket }) {
  const base = b.pods; // the first round of the tree (the bye round, or the first round without byes)
  const rows = b.games[base].length;
  const last = b.games.length - 1;
  const cell = (r: number, j: number) => {
    const k = r - base;
    const span = k > 0 ? 2 ** k : 1;
    const from = (r < base ? j : j * span) + 1;
    const cls = ['cfp-cell', r < base ? 'cfp-c-pod' : '', r === base && base ? 'cfp-c-bye' : '', k > 0 ? 'cfp-c-join' : ''].filter(Boolean).join(' ');
    return (
      <div key={`${r}-${j}`} className={cls} style={style({ '--col': r + 1, '--row': `${from} / ${from + span}` })}>
        <Card b={b} g={b.games[r][j]} />
      </div>
    );
  };
  // Bracket order for the phone: each game after the games it comes from.
  const out: ReactNode[] = [];
  const walk = (r: number, j: number) => {
    if (r > base) { walk(r - 1, 2 * j); walk(r - 1, 2 * j + 1); }
    if (r === base && base) out.push(<div key={`pod-${j}`} className="cfp-pod">{cell(0, j)}{cell(1, j)}</div>);
    else out.push(cell(r, j));
  };
  if (last > 0) { walk(last - 1, 0); walk(last - 1, 1); }
  return (
    <div className="cfp-grid" style={style({ '--cols': b.games.length, '--rows': rows })}>
      {out}
      <div className={`cfp-cell cfp-c-final${last > 0 ? ' cfp-c-join' : ''}`} style={style({ '--col': last + 1, '--row': `1 / ${rows + 1}` })}>
        <Final b={b} />
      </div>
    </div>
  );
}

function Final({ b }: { b: Bracket }) {
  const { d, v } = useDyn();
  const champ = b.champion;
  return (
    <div className="cfp-final">
      <img src={CFP_MARK} alt="" className="cfp-final-mark" />
      <Card b={b} g={b.games[b.games.length - 1][0]} big />
      {champ !== null && (
        <div className="cfp-champ">
          <TeamMark team={champ} size={64} />
          <div><span>{v.season.year} National Champion</span><strong>{d.teams[champ].school}</strong></div>
        </div>
      )}
    </div>
  );
}

function Card({ b, g, big = false }: { b: Bracket; g: BracketGame; big?: boolean }) {
  const round = b.rounds[g.round];
  return (
    <div className={`cfp-match${big ? ' cfp-match-big' : ''}`}>
      <div className="cfp-match-label">{g.bowl ? `${g.bowl} · ${round}` : round}{g.a.pts !== null ? ' · Final' : ''}</div>
      <Row s={g.a} />
      <Row s={g.b} />
    </div>
  );
}

function Row({ s }: { s: BracketSlot }) {
  const { d, v } = useDyn();
  if (s.team === null) {
    return <div className="cfp-row cfp-row-tbd"><span className="cfp-seed" /><span className="cfp-name">Winner of {s.from}</span></div>;
  }
  const t = s.team;
  return (
    <a className={`cfp-row${s.won ? ' cfp-won' : ''}${s.lost ? ' cfp-lost' : ''}${d.userTeams.includes(t) ? ' cfp-mine' : ''}`}
      href={href(`team/${t}`)} style={style({ '--tc': teamCss(mainColor(d, t)) })}>
      <span className="cfp-seed">{s.seed}</span>
      <TeamMark team={t} size={28} />
      <span className="cfp-name">{d.teams[t].school}</span>
      <span className="cfp-pts">{s.pts ?? recordText(v.records[t])}</span>
    </a>
  );
}

/**
 * Headline art for playoff stories (user, 2026-11-28, option A of the mockups): black, a gold seam, the CFP mark in
 * the corner, the first team's logo and the second's helmet, and the round on a gold tab.
 */
export function CfpArt({ teams, label, big = false }: { teams: number[]; label: string; big?: boolean }) {
  const h = big ? 168 : 84;
  return (
    <div className={`cfp-art${big ? ' cfp-art-big' : ''}`} aria-hidden>
      <img src={CFP_MARK} alt="" className="cfp-art-mark" />
      {teams.length > 2 ? (
        <div className="cfp-art-row">{teams.slice(0, 4).map((t) => <TeamMark key={t} team={t} size={h / 2} />)}</div>
      ) : (
        <>
          <div className="cfp-art-main"><TeamMark team={teams[0]} size={h} /></div>
          {teams[1] !== undefined && <div className="cfp-art-side"><TeamMark team={teams[1]} size={big ? h * 0.58 : h / 2} kind="helmet" /></div>}
        </>
      )}
      <div className="cfp-art-label">{label}</div>
    </div>
  );
}

/** Story art for a headline: the CFP's art for playoff stories, the team art otherwise. */
export function useCfpLabel(story: Pick<Story, 'kind' | 'game'>): string | null {
  const b = useBracket();
  return cfpLabel(story, b && b.final ? b : null);
}
