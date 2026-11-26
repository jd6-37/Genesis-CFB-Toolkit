// A game's player lines for its headline window (user, 2026-11-26). The save keeps season totals, so a game's player
// lines exist only when one import ends right after that week and another right before it.
import { fromBase64, type DSeason, type Dynasty } from './model';
import { readDynastySave, type DynastySave } from './save';
import { playerName } from './derive';

type Totals = Map<string, Record<string, number>>;
function totals(save: DynastySave): Totals {
  const out: Totals = new Map();
  save.stats.forEach((ts, team) => {
    for (const cat of ['passing', 'rushing', 'receiving', 'defense'] as const) {
      for (const e of ts[cat]) out.set(`${team}/${cat}/${e.slot}`, e.s as unknown as Record<string, number>);
    }
  });
  return out;
}

export interface GameLeader { cat: string; player: number; name: string; line: string }

/** Each team's best passer, rusher, receiver and defender in that week's game, or null when no two imports frame it. */
export function gameLeaders(d: Dynasty, season: DSeason, week: number, teams: number[]): Map<number, GameLeader[]> | null {
  const imps = season.imports;
  const after = imps.find((i) => i.weeksDone === week + 1);
  const before = week === 0 ? null : imps.find((i) => i.weeksDone === week);
  if (!after || (week > 0 && !before)) return null;
  const now = totals(readDynastySave(fromBase64(after.data)));
  const then: Totals = before ? totals(readDynastySave(fromBase64(before.data))) : new Map();
  const diff = (k: string, f: string) => (now.get(k)?.[f] ?? 0) - (then.get(k)?.[f] ?? 0);
  const out = new Map<number, GameLeader[]>();
  for (const team of teams) {
    const keys = [...now.keys()].filter((k) => Number(k.split('/')[0]) === team);
    const who = (k: string) => season.slots[team]?.[Number(k.split('/')[2])] ?? null;
    const best = (cat: string, score: (k: string) => number) =>
      keys.filter((k) => k.split('/')[1] === cat && who(k) && score(k) > 0).sort((a, b) => score(b) - score(a))[0];
    const list: GameLeader[] = [];
    const add = (cat: string, k: string | undefined, line: (k: string) => string) => {
      if (!k) return;
      const id = who(k)!;
      list.push({ cat, player: id, name: playerName(d.players[id - 1]), line: line(k) });
    };
    const td = (k: string) => (diff(k, 'td') ? `, ${diff(k, 'td')} TD` : '');
    add('Passing', best('passing', (k) => diff(k, 'yds')), (k) => `${diff(k, 'comp')}-${diff(k, 'att')}, ${diff(k, 'yds')} yds${td(k)}${diff(k, 'int') ? `, ${diff(k, 'int')} INT` : ''}`);
    add('Rushing', best('rushing', (k) => diff(k, 'yds')), (k) => `${diff(k, 'att')} car, ${diff(k, 'yds')} yds${td(k)}`);
    add('Receiving', best('receiving', (k) => diff(k, 'yds')), (k) => `${diff(k, 'rec')} rec, ${diff(k, 'yds')} yds${td(k)}`);
    add('Defense', best('defense', (k) => diff(k, 'tkl') + 3 * diff(k, 'sacks') + 4 * diff(k, 'int')),
      (k) => [`${diff(k, 'tkl')} tkl`, diff(k, 'sacks') ? `${diff(k, 'sacks')} sack${diff(k, 'sacks') > 1 ? 's' : ''}` : '', diff(k, 'int') ? `${diff(k, 'int')} INT` : ''].filter(Boolean).join(', '));
    out.set(team, list);
  }
  return out;
}
