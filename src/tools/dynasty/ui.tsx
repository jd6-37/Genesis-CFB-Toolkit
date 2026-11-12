// Small pieces the Dynasty pages share: the data they read, team marks and story art.
import { createContext, useContext } from 'react';
import { SpriteCanvas } from '../../components';
import { toLevels, LEVELS } from '../../core/colors';
import type { Dynasty, DPlayer } from '../../core/dynasty/model';
import { SCHOOL_COLORS } from '../../core/dynasty/schoolColors';
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

const css = (c: number) => `#${toLevels(c).map((x) => LEVELS[x].toString(16).padStart(2, '0')).join('')}`;
const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
};
const rgbOf = (hex: string) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const near = (a: string, b: string) => { const x = rgbOf(a), y = rgbOf(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 90; };
/** Colors are CSS hex strings. */
export const teamCss = (c: string) => c;
/** Black or white, whichever reads on the color. */
export const onColor = (c: string) => (lum(c) > 150 ? '#000' : '#fff');
/** The school's primary color: its official one, or the ROM's team color (the jersey when that is near black or white). */
export function mainColor(d: Dynasty, t: number): string {
  const official = SCHOOL_COLORS[d.teams[t].school];
  if (official) return official[0];
  const [team, , jersey] = d.teams[t].colors;
  const l = lum(css(team));
  return css(l < 24 || l > 235 ? jersey : team);
}
/** A school color that shows on white (for marks, meters and charts): primary, else secondary, else gray. */
export function inkColor(d: Dynasty, t: number): string {
  const main = mainColor(d, t);
  if (lum(main) <= 150) return main;
  const second = SCHOOL_COLORS[d.teams[t].school]?.[1];
  return second && lum(second) <= 150 ? second : 'var(--gray)';
}

export const playerOf = (d: Dynasty, id: number | null): DPlayer | undefined => (id ? d.players[id - 1] : undefined);

export const recordText = (r: { w: number; l: number }) => `${r.w}-${r.l}`;
export const rankText = (v: SeasonView, t: number) => (v.save && v.rank[t] <= 25 ? `${v.rank[t]}` : '');

const scaleFor = (pic: Picture, height: number) => Math.max(1, Math.floor(height / pic.height)) || 1;

/** The team's logo from the ROM at an integer scale (or a color chip with initials without art). */
export function TeamMark({ team, size = 24, kind = 'logo', exact = false }: { team: number; size?: number; kind?: 'logo' | 'helmet'; exact?: boolean }) {
  const { d, art } = useDyn();
  const pic = art?.[team]?.[kind] ?? null;
  const t = d.teams[team];
  if (pic) {
    // Whole-number scales keep the pixels even; `exact` fills the size anyway.
    const scale = size >= pic.height && !exact ? scaleFor(pic, size) : size / pic.height;
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
export function TeamLink({ team, mark = true, rank = true, full = false, size = 20 }: { team: number; mark?: boolean; rank?: boolean; full?: boolean; size?: number }) {
  const { d, v } = useDyn();
  const r = rank ? rankText(v, team) : '';
  return (
    <a className="dy-team" href={href(`team/${team}`)}>
      {mark && <TeamMark team={team} size={size} />}
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
  let c2 = teams[1] !== undefined ? mainColor(d, teams[1]) : null;
  // Two similar colors (Louisiana and USC reds) don't show a split: the second team's other color does.
  if (c2 !== null && near(c1, c2)) {
    const alt = SCHOOL_COLORS[d.teams[teams[1]].school]?.[1];
    if (alt && !near(c1, alt)) c2 = alt;
  }
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
          {teams[1] !== undefined && <div className="dy-art-side"><TeamMark team={teams[1]} size={big ? h * 0.58 : h / 2} kind="helmet" /></div>}
        </>
      )}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="dy-empty">{children}</div>;
}

export const heightText = (inches: number) => (inches ? `${Math.floor(inches / 12)}'${inches % 12}"` : '');

/** "Town, State" (CFB 27 writes "Non-US" as the state of players from abroad: just the town then). */
export const hometownText = (p: { hometown: string; state: string }) =>
  [p.hometown, p.state && p.state !== 'Non-US' ? p.state : ''].filter(Boolean).join(', ');
