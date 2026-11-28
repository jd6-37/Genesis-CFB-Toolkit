// The Heisman ceremony (user, 2026-11-28: "The Heisman trophy presentation needs to be a big deal. It should be modal
// with an animation and reveal, and if the winner is from a user controlled team, celebration animation such as
// confetti"; "a small replay icon button"; four finalists; simulated votes; mockup approved: "Build it").
// Steps, A (or the button) for the next: the finalists, the envelope, the winner, the vote and the other awards.
// It opens by itself once after the import that hands the awards out, and from the season awards any time.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HEISMAN_VOTERS, POSITION_AWARDS, type SeasonAwards } from '../../core/dynasty/awards';
import { playerName } from '../../core/dynasty/derive';
import type { DSeason } from '../../core/dynasty/model';
import { Button } from '../../ui';
import { Trophy } from './TrophyPages';
import { Headshot, href, mainColor, playerOf, recordText, TeamMark, useDyn } from './ui';

const STEPS = ['The finalists', 'The finalists', 'And the winner is…', 'The vote'];

export function HeismanCeremony({ season, awards, onClose }: { season: DSeason; awards: SeasonAwards; onClose: () => void }) {
  const { d, v } = useDyn();
  const votes = awards.votes ?? [];
  const finalists = votes.slice(0, 4);
  const winner = finalists[0];
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  const mine = winner ? d.userTeams.includes(winner.team) : false;
  const quiet = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // The finalists come in one by one, then the envelope after a beat.
  useEffect(() => {
    if (step !== 0) return;
    const t = setTimeout(() => setStep(1), quiet ? 0 : 2200);
    return () => clearTimeout(t);
  }, [step, quiet]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const btns = dialog.current?.querySelectorAll<HTMLElement>('.hz-foot .ui-button');
    btns?.[btns.length - 1]?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, step]);
  if (!winner) return null;
  const same = v.season.index === season.index;
  const rank = (t: number) => { const r = same ? v.rank[t] : 0; return r >= 1 && r <= 25 ? `#${r} ` : ''; };
  const rec = (t: number) => (same ? ` (${recordText(v.records[t])})` : '');
  const wp = playerOf(d, winner.player);
  const replay = () => { setStep(2); setRun((x) => x + 1); };
  const next = () => setStep((s) => Math.min(3, s < 2 ? 2 : s + 1));
  const root = document.querySelector<HTMLElement>('.dy[data-brand="dynasty"]') ?? document.body;
  return createPortal(
    <div className="hz-back" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`hz hz-step-${step}`} role="dialog" aria-modal="true" aria-label={`${awards.year} Heisman Trophy`} ref={dialog}>
        <header className="hz-head">
          <Trophy art="heisman" size={2} />
          <div>
            <p className="hz-kicker">The {awards.year} Heisman Memorial Trophy</p>
            <h2>{STEPS[step]}</h2>
          </div>
          {step >= 2 && <button type="button" className="hz-replay" onClick={replay} aria-label="Replay the reveal" title="Replay the reveal">↻</button>}
        </header>

        {step <= 1 && (
          <ol className="hz-finalists">
            {finalists.map((f, i) => {
              const p = playerOf(d, f.player);
              return (
                <li key={f.player} className="hz-card" style={{ ['--i' as string]: i, ['--tc' as string]: mainColor(d, f.team) }}>
                  {p && <Headshot p={p} size={72} />}
                  <div>
                    <strong>{p ? playerName(p) : 'Unknown player'}</strong>
                    <span className="hz-meta">{p?.pos}, {rank(f.team)}{d.teams[f.team].school}{rec(f.team)}</span>
                    <span className="hz-line">{f.line}</span>
                  </div>
                  <TeamMark team={f.team} size={36} />
                </li>
              );
            })}
          </ol>
        )}
        {step === 1 && <p className="hz-drum">The envelope, please…</p>}

        {step === 2 && (
          <div className="hz-reveal" key={run} style={{ ['--tc' as string]: mainColor(d, winner.team) }}>
            {mine && !quiet && <Confetti colors={[mainColor(d, winner.team), '#f4dc8a', '#ffffff']} />}
            <div className="hz-win">
              <Trophy art="heisman" size={4} />
              <div className="hz-win-card">
                {wp && <Headshot p={wp} size={120} />}
                <div>
                  <p className="hz-kicker">{mine ? 'Your player wins the Heisman' : `${awards.year} Heisman Trophy winner`}</p>
                  <h3>{wp ? <a href={href(`player/${wp.id}`)} onClick={onClose}>{playerName(wp)}</a> : 'Unknown player'}</h3>
                  <p className="hz-meta">{wp?.pos}, {rank(winner.team)}{d.teams[winner.team].school}{winner.line ? `: ${winner.line}` : ''}</p>
                  <p className="hz-meta">{winner.first.toLocaleString('en-US')} first-place votes, {winner.points.toLocaleString('en-US')} points</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="hz-results">
            <div className="hz-scroll">
              <table className="hz-votes">
                <thead><tr><th>#</th><th className="hz-left">Player</th><th>1st</th><th>2nd</th><th>3rd</th><th>Points</th></tr></thead>
                <tbody>
                  {votes.slice(0, 10).map((x, i) => {
                    const p = playerOf(d, x.player);
                    return (
                      <tr key={x.player} className={i === 0 ? 'hz-top' : d.userTeams.includes(x.team) ? 'hz-mine' : undefined}>
                        <td>{i + 1}</td>
                        <td className="hz-left">{p ? <a href={href(`player/${p.id}`)} onClick={onClose}>{playerName(p)}</a> : 'Unknown'} <span className="hz-meta">{p?.pos}, {d.teams[x.team].school}</span></td>
                        <td>{x.first}</td><td>{x.second}</td><td>{x.third}</td><td><strong>{x.points.toLocaleString('en-US')}</strong></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="hz-note">{HEISMAN_VOTERS} voters, three places each: 3 points for first, 2 for second, 1 for third.</p>
            <h3 className="hz-sub">The other awards</h3>
            <ul className="hz-others">
              {awards.position.filter((a) => a.winner).map((a) => {
                const p = playerOf(d, a.winner!.player);
                return (
                  <li key={a.key}>
                    <Trophy art={POSITION_AWARDS.find((x) => x.key === a.key)?.art ?? 'qb'} size={1} />
                    <span><strong>{a.label}</strong><span className="hz-meta">{p ? playerName(p) : 'Unknown'}, {p?.pos}, {rank(a.winner!.team)}{d.teams[a.winner!.team].school}</span></span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <footer className="hz-foot">
          {step === 3 && <Button href={href('stats/awards')} onClick={onClose}>Award watch: the full lists</Button>}
          {step === 3 && <Button href={href(`awards/${awards.year}`)} onClick={onClose} variant="quiet">Season awards</Button>}
          <span className="hz-spacer" />
          {step < 3 && <Button variant="quiet" onClick={onClose}>Skip</Button>}
          {step < 3 ? <Button onClick={next}>{step < 2 ? 'Reveal the winner' : 'See the vote'}</Button> : <Button onClick={onClose}>Close</Button>}
        </footer>
      </div>
    </div>,
    root,
  );
}

/** Confetti in the winner's colors (a user team's winner; not with reduced motion). */
function Confetti({ colors }: { colors: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const W = (c.width = c.offsetWidth), H = (c.height = c.offsetHeight);
    let seed = 7;
    const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const ps = Array.from({ length: 170 }, () => ({ x: r() * W, y: -r() * H * 0.7, vx: (r() - 0.5) * 2, vy: 1.4 + r() * 3, s: 4 + r() * 6, a: r() * 6, c: colors[Math.floor(r() * colors.length)] }));
    let f = 0, id = 0;
    const step = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of ps) {
        p.x += p.vx; p.y += p.vy; p.a += 0.15;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore();
      }
      if (++f < 420) id = requestAnimationFrame(step); else ctx.clearRect(0, 0, W, H);
    };
    step();
    return () => cancelAnimationFrame(id);
  }, [colors]);
  return <canvas ref={ref} className="hz-confetti" aria-hidden />;
}
