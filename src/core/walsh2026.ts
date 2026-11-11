// The 2026 Walsh Reports built into the app (public/data/), one per College Football 27 team. They name
// players by the jersey numbers of the built-in CFB 27 rosters (src/core/cfb27Latest.ts), so the Rosters
// tab offers them only with that import. Made by cli/walshdata.ts from the 138-team 2026 Season Edition.

import { reportProblems, showReport, type Report } from './walshReports';

export const WALSH_DATA = {
  /** Served from public/data/, so the app fetches it only when it's used. */
  file: 'data/walsh-reports-2026-week9.json',
} as const;

export interface WalshData {
  app: 'genesis-cfb-toolkit';
  tool: 'walsh-reports';
  version: 1;
  season: number;
  week: number;
  /** Where the text comes from (the ROM release). */
  source: string;
  /** Offense and defense paragraphs by the CFB 27 CSV's team name. */
  reports: Record<string, Report>;
}

/** Why `v` isn't a usable report file; empty if it is. */
export function walshDataProblems(v: unknown): string[] {
  const d = v as Partial<WalshData> | null;
  if (!d || typeof d !== 'object' || d.app !== 'genesis-cfb-toolkit' || d.tool !== 'walsh-reports') return ['not a Walsh Report file'];
  if (d.version !== 1) return [`version ${String(d.version)} isn't supported`];
  if (!d.reports || typeof d.reports !== 'object') return ['no reports'];
  const out: string[] = [];
  for (const [team, r] of Object.entries(d.reports)) {
    if (typeof r?.offense !== 'string' || typeof r?.defense !== 'string') out.push(`${team}: no text`);
    else out.push(...reportProblems(showReport(r)).map((p) => `${team}: ${p}`));
  }
  return out;
}

/** Fetches and checks the built-in reports. */
export async function fetchWalsh2026(base = '/'): Promise<WalshData> {
  let res: Response;
  try {
    res = await fetch(base + WALSH_DATA.file);
  } catch {
    throw new Error("Couldn't load the built-in Walsh Reports. Check your connection and try again.");
  }
  if (!res.ok) throw new Error(`Couldn't load the built-in Walsh Reports (${res.status}).`);
  const data = (await res.json()) as unknown;
  const p = walshDataProblems(data);
  if (p.length) throw new Error(`The built-in Walsh Reports can't be used: ${p.slice(0, 3).join('; ')}.`);
  return data as WalshData;
}

/** The reports for converted teams: ROM slot → report, for each slot whose CFB 27 team has one. */
export function reportsForSlots(data: WalshData, teams: { team: number; sheetTeam: string }[]): Map<number, Report> {
  const out = new Map<number, Report>();
  for (const t of teams) {
    const r = data.reports[t.sheetTeam];
    if (r) out.set(t.team, r);
  }
  return out;
}
