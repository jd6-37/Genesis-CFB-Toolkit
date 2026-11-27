// Trophies (user, 2026-11-27; mockups approved: "Looks good … Build it"): the award watches (Stats → Award watch),
// the user's trophy room, a team's rivalry trophies (Team → Rivalries) and Manage → Trophy art, where the user's own
// pictures replace the app's pixel art.
import { useMemo, useRef, useState } from 'react';
import { Button, Modal, PageHead, SubHead, Table } from '../../ui';
import { COACH_AWARDS, HEISMAN, POSITION_AWARDS, awardWatch, awardsIn, candidates, coachWatch, type Candidate } from '../../core/dynasty/awards';
import { heismanWatch } from '../../core/dynasty/outlook';
import { kickoffRanks } from '../../core/dynasty/kickoffRanks';
import { playerName } from '../../core/dynasty/derive';
import { REAL_THROUGH, TROPHIES, trophiesOf, type RivalryTrophy } from '../../core/dynasty/trophies';
import { trophyRoom, type TrophyItem } from '../../core/dynasty/trophyRoom';
import { meetings } from '../../core/dynasty/series';
import type { Dynasty } from '../../core/dynasty/model';
import { Empty, TeamLink, TeamMark, href, playerOf, useDyn } from './ui';

/** A trophy's picture: the user's, else the app's pixel art (32×40, scaled by whole steps so it stays sharp). */
export function Trophy({ art, size = 2, label = '' }: { art: string; size?: number; label?: string }) {
  const { d } = useDyn();
  const own = d.trophyArt?.[art];
  return <img className="dy-trophy" src={own ?? `/media/trophies/${art}.png`} width={32 * size} height={40 * size} alt={label} />;
}

// ---- Stats → Award watch

/** Each award's top five so far; your players highlighted. Winners are named once the season is over. */
export function AwardWatch() {
  const { d, v } = useDyn();
  const all = useMemo(() => candidates(v), [v]);
  const pre = useMemo(() => kickoffRanks(d, v.season)[0] ?? null, [d, v]);
  const byP = new Map(all.map((c) => [c.player, c]));
  const heis = heismanWatch(v, 5).map((h) => byP.get(h.player)).filter((c): c is Candidate => !!c);
  const year = v.season.year;
  const cards: { key: string; name: string; what: string; art: string; list: Candidate[] }[] = [
    ...(HEISMAN.since <= year ? [{ ...HEISMAN, list: heis }] : []),
    ...awardsIn(year).map((a) => ({ key: a.key, name: a.name, what: a.what, art: a.art, list: awardWatch(v, a, all, 5) })),
  ];
  const mine = (t: number) => d.userTeams.includes(t);
  return (
    <>
      <p className="dy-small dy-dim">The players in the running for each award, from the stats so far and the players' OVR. The winners are named once the season is over.</p>
      <div className="dy-watch">
        {cards.map((c) => (
          <article key={c.key} className="dy-watch-card">
            <header><Trophy art={c.art} size={2} /><div><h3>{c.name}</h3><p className="dy-small dy-dim">{c.what}</p></div></header>
            {c.list.length ? (
              <ol className="dy-watch-list">
                {c.list.map((x, i) => {
                  const p = playerOf(d, x.player);
                  return (
                    <li key={x.player} className={mine(x.team) ? 'dy-watch-mine' : undefined}>
                      <span className="dy-watch-n">{i + 1}</span><TeamMark team={x.team} size={20} />
                      <span>{p ? <a href={href(`player/${p.id}`)}>{playerName(p)}</a> : 'Unknown player'} <span className="dy-small dy-dim">{d.teams[x.team].school}</span><span className="dy-small dy-dim dy-watch-line">{x.line}</span></span>
                    </li>
                  );
                })}
              </ol>
            ) : <p className="dy-small dy-dim">Nobody yet: the watch starts with the first stats.</p>}
          </article>
        ))}
        {COACH_AWARDS.filter((a) => a.since <= year).map((a) => (
          <article key={a.key} className="dy-watch-card">
            <header><Trophy art={a.art} size={2} /><div><h3>{a.name}</h3><p className="dy-small dy-dim">{a.what}: the most wins beyond what the team was expected to win</p></div></header>
            <ol className="dy-watch-list">
              {coachWatch(v, a.key, pre, 5).map((x, i) => {
                const c = x.coach !== null ? d.coaches?.find((k) => k.id === x.coach) : undefined;
                return (
                  <li key={x.team} className={mine(x.team) ? 'dy-watch-mine' : undefined}>
                    <span className="dy-watch-n">{i + 1}</span><TeamMark team={x.team} size={20} />
                    <span>{c ? <a href={href(`coach/${c.id}`)}>{c.name}</a> : 'Head coach'} <span className="dy-small dy-dim">{d.teams[x.team].school}</span><span className="dy-small dy-dim dy-watch-line">{x.line}</span></span>
                  </li>
                );
              })}
            </ol>
          </article>
        ))}
      </div>
    </>
  );
}

// ---- the trophy room

const SHELVES: { kind: TrophyItem['kind'][]; title: string }[] = [
  { kind: ['national', 'conference'], title: 'Titles' },
  { kind: ['postseason'], title: 'Bowls and the playoff' },
  { kind: ['rivalry'], title: 'Rivalry trophies' },
  { kind: ['player'], title: "Your players' awards" },
  { kind: ['coach'], title: 'Coach awards' },
];

export function TrophyRoomPage() {
  const { d } = useDyn();
  const room = useMemo(() => trophyRoom(d), [d]);
  const count = (k: TrophyItem['kind']) => room.items.filter((i) => i.kind === k).length;
  if (!room.stints.length) return <Empty><p>Your trophy room fills up with what your teams win. Pick your teams in Manage.</p></Empty>;
  const totals: [number, string, string][] = [
    [count('national'), 'national title', 'national titles'], [count('conference'), 'conference title', 'conference titles'],
    [count('postseason'), 'bowl or playoff win', 'bowl and playoff wins'], [count('rivalry'), 'rivalry trophy', 'rivalry trophies'],
    [count('player'), 'player award', 'player awards'], [count('coach'), 'coach award', 'coach awards'],
  ];
  return (
    <section>
      <PageHead title="Your trophy room">Everything your teams won while you ran them, and your coaches' awards, across the whole dynasty. Teams you no longer control stay here.</PageHead>
      <div className="dy-room-totals">{totals.map(([n, one, many]) => <p key={many}><strong>{n}</strong> {n === 1 ? one : many}</p>)}</div>
      <SubHead>Your teams</SubHead>
      <div className="dy-room-stints">
        {room.stints.map((s) => (
          <div key={`${s.team}-${s.from}`} className="dy-room-stint">
            <TeamMark team={s.team} size={32} />
            <div>
              <p className="dy-room-stint-name"><TeamLink team={s.team} rank={false} mark={false} /> <span className="dy-dim">{s.from === s.to ? s.from : `${s.from}-${s.to}`}</span></p>
              <p className="dy-small">{s.w}-{s.l}{s.national ? `, ${s.national} national title${s.national > 1 ? 's' : ''}` : ''}{s.conference ? `, ${s.conference} conference title${s.conference > 1 ? 's' : ''}` : ''}</p>
            </div>
          </div>
        ))}
      </div>
      {SHELVES.map((sh) => {
        const xs = room.items.filter((i) => sh.kind.includes(i.kind)).slice().sort((a, b) => sh.kind.indexOf(a.kind) - sh.kind.indexOf(b.kind) || a.year - b.year);
        if (!xs.length) return null;
        return (
          <div key={sh.title}>
            <SubHead>{sh.title}</SubHead>
            <ul className="dy-room-shelf">
              {xs.map((it, i) => {
                const p = it.player ? playerOf(d, it.player) : undefined;
                const coach = it.coach != null ? d.coaches?.find((c) => c.id === it.coach) : undefined;
                const note = p ? `${p.pos} ${playerName(p)}` : coach ? `${coach.name}, ${it.note}` : it.note;
                return (
                  <li key={`${it.kind}-${it.year}-${it.title}-${i}`}>
                    <Trophy art={it.art} size={3} label={it.title} />
                    <p className="dy-room-cap"><strong>{it.year}</strong> {it.title}</p>
                    <p className="dy-room-cap dy-dim"><TeamMark team={it.team} size={14} /> {p ? <a href={href(`player/${p.id}`)}>{note}</a> : note}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <p className="dy-small dy-dim">The trophies are the app's pixel art. To use your own pictures: Manage, Trophy art.</p>
    </section>
  );
}

// ---- Team → Rivalries

/** The holder of a trophy now: the winner of the dynasty's last meeting, else the real holder (2026 edition). */
function dynastyHistory(d: Dynasty, t: RivalryTrophy) {
  const ia = d.teams.findIndex((x) => x.school === t.a), ib = d.teams.findIndex((x) => x.school === t.b);
  if (ia < 0 || ib < 0) return null;
  const last = d.seasons[d.seasons.length - 1];
  const all = meetings(d, ia, ib, { year: last.year, week: 99 }).filter((m) => t.since === null || m.year >= t.since);
  const w = (x: number) => all.filter((m) => m.winner === x).length;
  const ties = all.filter((m) => m.winner === null).length;
  return { ia, ib, all, wa: w(ia), wb: w(ib), ties };
}

export function TeamRivalries({ team }: { team: number }) {
  const { d } = useDyn();
  const school = d.teams[team].school;
  const list = trophiesOf(school).filter((t) => d.teams.some((x) => x.school === (t.a === school ? t.b : t.a)));
  const real = d.startYear > REAL_THROUGH;
  if (!list.length) return <p className="dy-dim">{school} plays for no rivalry trophy the app knows.</p>;
  return (
    <div className="dy-rivals">
      {list.map((t) => {
        const h = dynastyHistory(d, t);
        if (!h) return null;
        const opp = t.a === school ? t.b : t.a;
        const oi = d.teams.findIndex((x) => x.school === opp);
        const mineW = team === h.ia ? h.wa : h.wb, theirW = team === h.ia ? h.wb : h.wa;
        const lastM = h.all[h.all.length - 1];
        const holder = lastM ? (lastM.winner === null ? null : d.teams[lastM.winner].school) : real ? t.real.holder : null;
        const dynRec = h.all.length ? (mineW === theirW ? `Tied ${mineW}-${theirW}` : `${mineW > theirW ? school : opp} leads ${Math.max(mineW, theirW)}-${Math.min(mineW, theirW)}`) + (h.ties ? `-${h.ties}` : '') : 'Not played yet';
        const notYet = t.since !== null && d.seasons[d.seasons.length - 1].year < t.since;
        return (
          <article key={t.trophy + opp} className="dy-rival">
            <Trophy art={t.art} size={3} label={t.trophy} />
            <div className="dy-rival-body">
              <h3>{t.trophy}</h3>
              <p className="dy-small dy-dim">{t.game.includes(t.trophy) ? '' : `${t.game} `}vs. <TeamLink team={oi} rank={false} size={16} />, first played {t.first}{t.since ? `; for the trophy since ${t.since}` : ''}</p>
              {notYet && <p className="dy-small">The trophy comes in {t.since}: games before then count for the series, not for it.</p>}
              <div className="dy-scroll-x">
                <Table className="dy-rival-table">
                  <thead><tr><th className="ui-left" /><th className="ui-left">Series</th><th className="ui-left">The trophy</th></tr></thead>
                  <tbody>
                    {real && (
                      <tr>
                        <td className="ui-left dy-dim">Real, to {REAL_THROUGH}</td>
                        <td className="ui-left">{t.real.lead ? `${t.real.lead} leads ${t.real.rec}` : `Tied ${t.real.rec}`}</td>
                        <td className="ui-left">{t.real.holder ? `${t.real.holder} holds it` : ''}{t.real.last ? ` (last met ${t.real.last})` : ''}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="ui-left dy-dim">This dynasty</td>
                      <td className="ui-left">{dynRec}</td>
                      <td className="ui-left">{holder ? `${holder} holds it` : notYet ? '' : '—'}</td>
                    </tr>
                  </tbody>
                </Table>
              </div>
              {h.all.length > 0 && (
                <p className="dy-small">Meetings: {h.all.slice(-6).reverse().map((m) => `${m.year} ${m.winner === null ? `tie ${m.vs}-${m.hs}` : `${d.teams[m.winner].school} ${Math.max(m.vs, m.hs)}-${Math.min(m.vs, m.hs)}`}`).join('; ')}</p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

// ---- Manage → Trophy art

const BIG = 500 * 1024;
const MAX_H = 256;

/** Scales a picture down to at most 256 px tall, by whole steps for pixel art (sharp), as a PNG data URL. */
async function scaleDown(url: string): Promise<string> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const step = Math.max(1, Math.ceil(img.naturalHeight / MAX_H));
  const w = Math.max(1, Math.round(img.naturalWidth / step)), h = Math.max(1, Math.round(img.naturalHeight / step));
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const cx = cv.getContext('2d')!;
  cx.imageSmoothingEnabled = false;
  cx.drawImage(img, 0, 0, w, h);
  return cv.toDataURL('image/png');
}

const readUrl = (f: File) => new Promise<string>((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => bad(r.error); r.readAsDataURL(f); });
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

/** Every trophy the app draws, by art key, with what uses it. */
export function trophyArtList(): { art: string; label: string }[] {
  const out = new Map<string, string[]>();
  const add = (art: string, label: string) => out.set(art, [...(out.get(art) ?? []), label]);
  add('national', 'National title'); add('conference', 'Conference title'); add('bowl', 'Bowl win'); add('playoff', 'Playoff win');
  add(HEISMAN.art, HEISMAN.name);
  for (const a of POSITION_AWARDS) add(a.art, a.name);
  for (const a of COACH_AWARDS) add(a.art, a.name);
  for (const t of TROPHIES) add(t.art, t.trophy);
  return [...out].map(([art, labels]) => ({ art, label: [...new Set(labels)].join(', ') }));
}

export function TrophyArtPanel({ d, onSave }: { d: Dynasty; onSave: (next: Dynasty) => Promise<void> }) {
  const input = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [big, setBig] = useState<{ art: string; url: string; size: number } | null>(null);
  const list = useMemo(() => trophyArtList(), []);
  const put = async (art: string, url: string | null) => {
    const next = { ...(d.trophyArt ?? {}) };
    if (url) next[art] = url; else delete next[art];
    await onSave({ ...d, trophyArt: Object.keys(next).length ? next : undefined });
  };
  const pick = async (f: File) => {
    if (!target) return;
    const url = await readUrl(f);
    if (f.size > BIG) setBig({ art: target, url, size: f.size });
    else await put(target, url);
  };
  return (
    <section>
      <SubHead>Trophy art</SubHead>
      <p className="dy-small">Use your own picture for any trophy (PNG, JPEG or GIF; pixel art stays sharp). It's kept in the dynasty file, so it goes with it to another browser. Several share a picture where the app uses one for them.</p>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void pick(f); }} />
      <ul className="dy-artlist">
        {list.map((x) => {
          const own = d.trophyArt?.[x.art];
          return (
            <li key={x.art}>
              <img className="dy-trophy" src={own ?? `/media/trophies/${x.art}.png`} width={48} height={60} alt="" />
              <span className="dy-artlist-name">{x.label}<span className="dy-small dy-dim">{own ? 'Your picture' : "The app's art"}</span></span>
              <span className="dy-artlist-actions">
                <Button variant="quiet" onClick={() => { setTarget(x.art); input.current?.click(); }}>Upload</Button>
                {own && <Button variant="quiet" onClick={() => void put(x.art, null)}>Use the app's</Button>}
              </span>
            </li>
          );
        })}
      </ul>
      {big && (
        <Modal title="A big picture" onClose={() => setBig(null)}
          actions={<>
            <Button onClick={async () => { const url = await scaleDown(big.url); await put(big.art, url); setBig(null); }}>Scale down</Button>
            <Button variant="quiet" onClick={async () => { await put(big.art, big.url); setBig(null); }}>Keep full size</Button>
            <Button variant="quiet" onClick={() => setBig(null)}>Cancel</Button>
          </>}>
          <p>This picture is {kb(big.size)}, and it's saved in your dynasty file, so the file grows by about that much. Scale it down to at most {MAX_H} pixels tall? For pixel art it shrinks by whole steps, so the pixels stay sharp.</p>
        </Modal>
      )}
    </section>
  );
}
