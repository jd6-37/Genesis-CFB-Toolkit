// Small pieces the Dynasty pages share: the data they read, team marks and story art.
import { createContext, useContext } from 'react';
import { SpriteCanvas } from '../../components';
import { toLevels, LEVELS } from '../../core/colors';
import type { Dynasty, DPlayer } from '../../core/dynasty/model';
import type { SeasonView } from '../../core/dynasty/derive';
import type { TeamArt } from '../../core/dynasty/storage';
import type { Picture } from '../../core/render';

export interface DynCtx {
  d: Dynasty;
  v: SeasonView;
  art: TeamArt[] | null;
  /** Hash path under #dynasty/, e.g. "team/12". */
  go: (path: string) => void;
}
export const Ctx = createContext<DynCtx | null>(null);
export const useDyn = () => useContext(Ctx)!;

export const href = (path: string) => `#dynasty/${path}`;

const rgb = (c: number) => toLevels(c).map((x) => LEVELS[x]);
export const teamCss = (c: number) => `rgb(${rgb(c).join(' ')})`;
/** Black or white, whichever reads on the color. */
export const onColor = (c: number) => {
  const [r, g, b] = rgb(c);
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#000' : '#fff';
};
/** The team's main color: its team color, unless that is near black or white (then the jersey). */
export function mainColor(d: Dynasty, t: number): number {
  const [team, , jersey] = d.teams[t].colors;
  const [r, g, b] = rgb(team);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum < 24 || lum > 235 ? jersey : team;
}

export const playerOf = (d: Dynasty, id: number | null): DPlayer | undefined => (id ? d.players[id - 1] : undefined);

export const recordText = (r: { w: number; l: number }) => `${r.w}-${r.l}`;
export const rankText = (v: SeasonView, t: number) => (v.save && v.rank[t] <= 25 ? `${v.rank[t]}` : '');

const scaleFor = (pic: Picture, height: number) => Math.max(1, Math.floor(height / pic.height)) || 1;

/** The team's logo from the ROM at an integer scale (or a color chip with initials without art). */
export function TeamMark({ team, size = 24, kind = 'logo' }: { team: number; size?: number; kind?: 'logo' | 'helmet' }) {
  const { d, art } = useDyn();
  const pic = art?.[team]?.[kind] ?? null;
  const t = d.teams[team];
  if (pic) {
    const scale = size >= pic.height ? scaleFor(pic, size) : size / pic.height;
    return (
      <span className="dy-mark" style={{ height: size, minWidth: size }}>
        <SpriteCanvas pic={pic} scale={scale} label={`${t.school} ${kind}`} />
      </span>
    );
  }
  const c = mainColor(d, team);
  return (
    <span className="dy-chip" style={{ width: size, height: size, background: teamCss(c), color: onColor(c), fontSize: size * 0.42 }} aria-hidden>
      {t.school.replace(/[^A-Z]/g, '').slice(0, 3) || t.school.slice(0, 2)}
    </span>
  );
}

/** A team name that links to its page, with its logo and rank. */
export function TeamLink({ team, mark = true, rank = true, full = false }: { team: number; mark?: boolean; rank?: boolean; full?: boolean }) {
  const { d, v } = useDyn();
  const r = rank ? rankText(v, team) : '';
  return (
    <a className="dy-team" href={href(`team/${team}`)}>
      {mark && <TeamMark team={team} size={20} />}
      {r && <span className="dy-rank">{r}</span>}
      <span>{full ? `${d.teams[team].school} ${d.teams[team].nickname}` : d.teams[team].school}</span>
    </a>
  );
}

/** Story art: the first team's logo on its color, split with the second team's color for a game. */
export function StoryArt({ teams, big = false }: { teams: number[]; big?: boolean }) {
  const { d } = useDyn();
  if (!teams.length) return null;
  const c1 = mainColor(d, teams[0]);
  const c2 = teams[1] !== undefined ? mainColor(d, teams[1]) : null;
  const bg = c2 === null || teams.length > 2
    ? teamCss(c1)
    : `linear-gradient(112deg, ${teamCss(c1)} 0 62%, ${teamCss(c2)} 62% 100%)`;
  const h = big ? 168 : 84;
  return (
    <div className={`dy-art${big ? ' dy-art-big' : ''}`} style={{ background: bg }} aria-hidden>
      {teams.length > 2 ? (
        <div className="dy-art-row">
          {teams.slice(0, 4).map((t) => <TeamMark key={t} team={t} size={h / 2} />)}
        </div>
      ) : (
        <>
          <div className="dy-art-main"><TeamMark team={teams[0]} size={h} /></div>
          {teams[1] !== undefined && <div className="dy-art-side"><TeamMark team={teams[1]} size={h / 2} kind="helmet" /></div>}
        </>
      )}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="dy-empty">{children}</div>;
}

export const heightText = (inches: number) => (inches ? `${Math.floor(inches / 12)}'${inches % 12}"` : '');
