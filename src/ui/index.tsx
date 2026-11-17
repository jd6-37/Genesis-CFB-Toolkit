// The shared component library of the Mod Toolkit and the Dynasty app (docs/design-system.md).
// Every component is themed by the tokens of the brand and theme around it (tokens.css): the same Button is
// yellow on indigo in the toolkit and black on white in Dynasty. New UI is built from these; a new kind of
// element becomes a component here, with a story (src/ui/*.stories.tsx), before a page uses it.
import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import './tokens.css';
import './ui.css';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/** `link`: an action that reads as underlined text (undo, close, a name in a list), in a sentence or a table cell.
    `chrome`: the game's selection bar (sky, white, orange) for the one action a page is about, on the site's
    indigo pages only (the Mod Toolkit brand). */
export type ButtonVariant = 'primary' | 'quiet' | 'danger' | 'link' | 'chrome';
interface ButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  /** With href it's a link that looks like a button. */
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  /** A tooltip (why it's disabled, what it costs). */
  title?: string;
  /** The name for screen readers when the text alone doesn't say it ("vs."). */
  label?: string;
  /** `link` only: bold (the open item of a list, a name that leads its row). */
  strong?: boolean;
}
/** An action. One primary button per view; the rest quiet. */
export function Button({ children, variant = 'primary', href, onClick, disabled, type = 'button', title, label, strong }: ButtonProps) {
  const cls = variant === 'link' ? cx('ui-link', strong && 'ui-link-strong') : cx('ui-button', variant !== 'primary' && `ui-button-${variant}`);
  if (href !== undefined) return <a className={cls} href={disabled ? undefined : href} aria-disabled={disabled || undefined} onClick={onClick} title={title} aria-label={label}>{children}</a>;
  return <button type={type} className={cls} onClick={onClick} disabled={disabled} title={title} aria-label={label}>{children}</button>;
}

/** The light/dark switch (Dynasty only; the Mod Toolkit has one look). Sits on a bar. */
export function ThemeToggle({ dark, onChange }: { dark: boolean; onChange: (dark: boolean) => void }) {
  return (
    <button type="button" className="ui-theme" role="switch" aria-checked={dark} onClick={() => onChange(!dark)}>
      <span aria-hidden="true" className="ui-theme-box" />
      Dark mode
    </button>
  );
}

interface MastheadProps {
  title: string;
  /** One line under the title (the season and week). */
  sub?: ReactNode;
  /** Where the title links to (the app's front page). */
  href: string;
  /** Small links and switches at the left (another app, the theme switch). */
  left?: ReactNode;
  /** Marks at the right (the user's teams). */
  right?: ReactNode;
  /** What sits under the title row inside the header: the `NavBar`. */
  children?: ReactNode;
}
/** An app's header: its name in the middle, small controls left and right, the main menu under it. */
export function Masthead({ title, sub, href, left, right, children }: MastheadProps) {
  return (
    <header className="ui-mast">
      <div className="ui-mast-inner">
        <div className="ui-mast-left">{left}</div>
        <a className="ui-mast-title" href={href}>
          <span className="ui-mast-name">{title}</span>
          {sub && <span className="ui-mast-sub">{sub}</span>}
        </a>
        <div className="ui-mast-right">{right}</div>
      </div>
      {children}
    </header>
  );
}

export interface NavItem { label: string; href: string; current?: boolean; off?: boolean }
/** An app's main menu: links to its pages, the open one marked. Scrolls sideways inside itself on phones. */
export function NavBar({ label, items }: { label: string; items: NavItem[] }) {
  return (
    <nav className="ui-nav" aria-label={label}>
      {items.map((x) => (
        <a
          key={x.href} href={x.off ? undefined : x.href} aria-current={x.current ? 'page' : undefined} aria-disabled={x.off || undefined}
          className={`ui-nav-item${x.off ? ' ui-nav-off' : ''}`}
        >
          {x.label}
        </a>
      ))}
    </nav>
  );
}

/** Buttons or controls side by side, wrapping on phones. */
export const Row = ({ children }: { children: ReactNode }) => <div className="ui-row">{children}</div>;

/** A message about what just happened or what to do next. */
export function Note({ children, kind = 'info', block }: {
  children: ReactNode;
  kind?: 'info' | 'ok' | 'error';
  /** The message has paragraphs or a list inside (it's drawn as a box, not one paragraph). */
  block?: boolean;
}) {
  const T = block ? 'div' : 'p';
  return <T className={cx('ui-note', kind !== 'info' && `ui-note-${kind}`)} role={kind === 'error' ? 'alert' : 'status'}>{children}</T>;
}

/** A button that asks for a file (or files) from the reader's computer. */
export function FileButton({ label, accept, onFile, onFiles, multiple, disabled, variant = 'primary' }: {
  label: string;
  /** File types, as the input's accept (".json,application/json"). */
  accept?: string;
  /** Called with the first file chosen. */
  onFile?: (file: File) => void;
  /** Called with every file chosen (with `multiple`). */
  onFiles?: (files: File[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'quiet' | 'danger';
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button variant={variant} disabled={disabled} onClick={() => ref.current?.click()}>{label}</Button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (!files.length) return;
          onFile?.(files[0]);
          onFiles?.(files);
        }}
      />
    </>
  );
}

/** A page's title, an optional line under it and optional controls at the right. */
export function PageHead({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="ui-pagehead">
      <h2>{title}</h2>
      {actions && <div className="ui-pagehead-actions">{actions}</div>}
      {children && <p>{children}</p>}
    </div>
  );
}

/** A section heading inside a page (a reversed bar). `level` 2 for a section that isn't under a page title. */
export function SubHead({ children, level = 3, id }: { children: ReactNode; level?: 2 | 3; id?: string }) {
  const H = level === 2 ? 'h2' : 'h3';
  return <H className="ui-sub" id={id}>{children}</H>;
}

export interface Option {
  value: string | number;
  label: string;
  disabled?: boolean;
  /** Options that follow each other with the same group are listed under that heading. */
  group?: string;
}
interface SelectProps {
  label: string;
  /** Hide the label visually (it still names the control for screen readers). */
  hideLabel?: boolean;
  value: string | number;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
  /** A smaller control for table cells and tight rows. */
  compact?: boolean;
  /** A tooltip (what the choice means). */
  title?: string;
  /** Shown while `value` is '' (a menu that acts at once, like "Move"); it can't be picked. */
  placeholder?: string;
  /** A short line under the dropdown (what the choice means). */
  note?: ReactNode;
  /** The value differs from what was loaded (an edit not yet saved or downloaded). */
  changed?: boolean;
  /** `dim`: a weak or placeholder value; `strong`: a standout one. In a grid of values, so the eye finds the extremes. */
  tone?: 'dim' | 'strong';
}
/** A labeled dropdown. */
export function Select({ label, hideLabel, value, options, onChange, disabled, compact, title, placeholder, note, changed, tone }: SelectProps) {
  // Runs of options with the same group become one <optgroup>.
  const runs: { group?: string; items: Option[] }[] = [];
  for (const o of options) {
    const last = runs[runs.length - 1];
    if (last && last.group === o.group) last.items.push(o);
    else runs.push({ group: o.group, items: [o] });
  }
  const item = (o: Option) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>;
  return (
    <label className={cx('ui-field', compact && 'ui-field-compact', changed && 'ui-field-changed', tone && `ui-field-${tone}`)}>
      <span className={hideLabel ? 'sr-only' : undefined}>{label}</span>
      <select value={value} disabled={disabled} title={title} onChange={(e) => onChange(e.target.value)}>
        {placeholder !== undefined && <option value="" disabled hidden>{placeholder}</option>}
        {runs.map((r, k) => (r.group ? <optgroup key={`${r.group}-${k}`} label={r.group}>{r.items.map(item)}</optgroup> : r.items.map(item)))}
      </select>
      {note && <span className="ui-field-note">{note}</span>}
    </label>
  );
}

interface FieldProps {
  label: string;
  /** Hide the label visually (it still names the control for screen readers). */
  hideLabel?: boolean;
  value: string | number;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'search';
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  disabled?: boolean;
  /** A short line under the field. */
  note?: ReactNode;
  /** The value isn't acceptable as it stands (a red border; say why in `note` or a `Note`). */
  invalid?: boolean;
  /** Called when the reader leaves the field. With it, Enter leaves the field too (the value is taken on leaving). */
  onBlur?: () => void;
  /** A smaller control for table cells and tight rows. */
  compact?: boolean;
  /** The value differs from what was loaded (an edit not yet saved or downloaded). */
  changed?: boolean;
  /** Whole numbers typed as text (a jersey number): a number pad on phones, no spinner. */
  digits?: boolean;
}
/** A checkbox with its label (a short phrase or a sentence or two). */
export function Check({ children, checked, onChange, disabled }: { children: ReactNode; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <label className="ui-check">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

/** A labeled one-line text, number or search field. */
export function Field({ label, hideLabel, value, onChange, type = 'text', placeholder, min, max, step, maxLength, disabled, note, invalid, onBlur, compact, changed, digits }: FieldProps) {
  return (
    <label className={cx('ui-field', compact && 'ui-field-compact', changed && 'ui-field-changed')}>
      <span className={hideLabel ? 'sr-only' : undefined}>{label}</span>
      <input
        type={type} inputMode={digits ? 'numeric' : type === 'number' ? 'decimal' : undefined} value={value} placeholder={placeholder}
        min={min} max={max} step={step} maxLength={maxLength} disabled={disabled} aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)} onBlur={onBlur}
        onKeyDown={onBlur ? (e) => { if (e.key === 'Enter') e.currentTarget.blur(); } : undefined}
      />
      {note && <span className="ui-field-note">{note}</span>}
    </label>
  );
}

export interface Column<T> {
  key: string;
  /** Column heading ('' for none). */
  label: string;
  /** Text columns are left-aligned; numbers stay right-aligned. */
  left?: boolean;
  /** Figures (scores, ratings, totals): shown in the pixel numerals. */
  num?: boolean;
  cell: (row: T, index: number) => ReactNode;
}
interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string | number;
  /** Rows to mark as the user's own. */
  mine?: (row: T) => boolean;
  /** Shown when there are no rows. */
  empty?: string;
  /** No heading row (short lists). */
  bare?: boolean;
}
/**
 * A table written by hand (thead, tbody, a caption), for tables DataTable's columns can't describe: selects
 * in cells, a totals row, columns that come and go. Scrolls sideways inside itself on phones.
 * Cell classes: `ui-left` (text columns), `ui-num` (one figure cell), `ui-text` (a word in a `figures` table);
 * a totals row is `<tr className="ui-total">`.
 */
export function Table({ children, figures, edit, words, className }: {
  children: ReactNode;
  /** Every cell is text (a reference list): left-aligned, with row headings read as text. */
  words?: boolean;
  /** An editor: cells hold dropdowns and fields (`compact`), so they are left-aligned and tighter. */
  edit?: boolean;
  /** Every cell that isn't `ui-left` or `ui-text` is a figure, shown in the pixel numerals. */
  figures?: boolean;
  /** A layout hook only (column widths); the look comes from the component. */
  className?: string;
}) {
  return (
    <div className="ui-table-wrap">
      <table className={['ui-table', figures ? 'ui-figures' : '', edit ? 'ui-table-edit' : '', words || edit ? 'ui-table-words' : '', className ?? ''].filter(Boolean).join(' ')}>{children}</table>
    </div>
  );
}

/** A table of records. Scrolls sideways inside itself on phones; the page never does. */
export function DataTable<T>({ columns, rows, rowKey, mine, empty = 'Nothing yet.', bare }: DataTableProps<T>) {
  if (!rows.length) return <p className="ui-table-empty">{empty}</p>;
  return (
    <div className="ui-table-wrap">
      <table className="ui-table">
        {!bare && <thead><tr>{columns.map((c) => <th key={c.key} className={c.left ? 'ui-left' : undefined}>{c.label}</th>)}</tr></thead>}
        <tbody>
          {rows.map((r, i) => (
            <tr key={rowKey(r, i)} className={mine?.(r) ? 'ui-row-mine' : undefined}>
              {columns.map((c) => <td key={c.key} className={c.left ? 'ui-left' : c.num ? 'ui-num' : undefined}>{c.cell(r, i)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One number with its label (an OVR, a record). */
/**
 * A figure with commas in the thousands (12,356). In the pixel numerals every character is one cell wide, so a
 * comma leaves a gap; this draws the comma tight against the digits. Use it for any figure that can pass 999.
 */
export function Num({ value }: { value: number | string }) {
  const text = typeof value === 'number' ? value.toLocaleString('en-US') : value;
  if (!text.includes(',')) return <>{text}</>;
  const parts = text.split(',');
  return <>{parts.map((x, k) => <Fragment key={k}>{k > 0 && <span className="ui-comma">,</span>}{x}</Fragment>)}</>;
}

export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="ui-stat">
      <div className="ui-stat-label">{label}</div>
      <div className="ui-stat-value">{value}</div>
      {note && <div className="ui-stat-note">{note}</div>}
    </div>
  );
}

/**
 * The sections of one page, one open at a time (a hub: Board, Prospects, Top classes). The page shows the
 * open section's content itself. On phones the row scrolls sideways inside itself.
 */
export function Tabs<T extends string>({ label, tabs, value, onChange }: {
  /** What the sections belong to, for screen readers ("Recruiting sections"). */
  label: string;
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="ui-tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.value} type="button" role="tab" aria-selected={t.value === value} className="ui-tab" onClick={() => onChange(t.value)}>
          {t.label}{t.count !== undefined && <span className="ui-tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/**
 * The steps of a process in order, with the one the user is on (an offseason, a setup). Steps before it
 * are done. A step with `href` is a link (only for steps the user may jump to). On a phone only the
 * current step shows, as "Step 3 of 8: Recruiting".
 */
export function Steps({ label, steps, current }: { label: string; steps: { label: string; href?: string }[]; current: number }) {
  return (
    <ol className="ui-steps" aria-label={label}>
      {steps.map((s, i) => (
        <li key={s.label} className={i < current ? 'ui-step-done' : i === current ? 'ui-step-now' : undefined} aria-current={i === current ? 'step' : undefined}>
          <span className="ui-step-n">{i === current ? `Step ${i + 1} of ${steps.length}` : i + 1}</span>
          {s.href && i !== current ? <a href={s.href}>{s.label}</a> : <span>{s.label}</span>}
          {i < current && <span className="ui-step-check"> (done)</span>}
        </li>
      ))}
    </ol>
  );
}

/**
 * A bar for a share from 0 to 1 (a prospect's interest in a school, how strong a pitch is). `label` says
 * what it measures, for screen readers; put the figure beside it when it matters. `color` is for a team's
 * color only; without it the bar is the text color.
 */
export function Meter({ value, label, color }: { value: number; label: string; color?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <span className="ui-meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <span style={{ width: `${pct}%`, background: color }} />
    </span>
  );
}

/** What a page shows when it has nothing yet: say what to do next. */
export const Empty = ({ children }: { children: ReactNode }) => <div className="ui-empty">{children}</div>;

/** A window over the page for one decision. Escape or a click outside closes it when onClose is given. */
export function Modal({ title, children, actions, onClose, media, sub }: {
  title: string; children: ReactNode; actions: ReactNode; onClose?: () => void;
  /** A picture beside the title (a headshot, a logo). */
  media?: ReactNode;
  /** One line under the title. */
  sub?: ReactNode;
}) {
  const id = useId();
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="ui-modal-back" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="ui-modal" role="dialog" aria-modal="true" aria-labelledby={id}>
        {media || sub ? (
          <div className="ui-modal-head">
            {media}
            <div><h2 id={id}>{title}</h2>{sub && <p className="ui-modal-sub">{sub}</p>}</div>
          </div>
        ) : <h2 id={id}>{title}</h2>}
        {children}
        <div className="ui-row ui-modal-actions">{actions}</div>
      </div>
    </div>
  );
}

/** A controller button as the game draws it on its hints: a white circle with the letter, or START, or the
    D-pad (`dpad`, or one direction: `up`, `down`, `left`, `right`). Put it in a sentence or a controls list. */
export type GlyphKey = 'A' | 'B' | 'C' | 'X' | 'Y' | 'Z' | 'START' | 'MODE' | 'dpad' | 'up' | 'down' | 'left' | 'right';
const PAD_LABEL: Record<string, string> = { dpad: 'D-pad', up: 'D-pad up', down: 'D-pad down', left: 'D-pad left', right: 'D-pad right' };
const PAD_ARM: Record<string, string> = { up: 'M9 2h6v7H9z', down: 'M9 15h6v7H9z', left: 'M2 9h7v6H2z', right: 'M15 9h7v6h-7z' };
export function Glyph({ k }: { k: GlyphKey }) {
  if (k in PAD_LABEL) {
    const arm = PAD_ARM[k];
    return (
      <span className="ui-glyph ui-glyph-pad" role="img" aria-label={PAD_LABEL[k]}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path className="ui-glyph-cross" d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z" />
          {arm && <path className="ui-glyph-dir" d={arm} />}
        </svg>
      </span>
    );
  }
  return <span className={cx('ui-glyph', k.length > 1 && 'ui-glyph-wide')} role="img" aria-label={`${k} button`}>{k}</span>;
}

/** One step in a row of buttons: a button, or what sits between two buttons. */
export type KeyStep = GlyphKey | ',' | '/';

/**
 * Buttons for one control, with what's between them (owner, 2026-11-17): a comma between buttons pressed one after
 * another (A, X: open the audible menu, then flip) and a slash between buttons to choose from (X / Z / Y).
 */
export function Keys({ keys }: { keys: KeyStep[] }) {
  return (
    <span className="ui-keys">
      {keys.map((k, i) =>
        k === ',' ? <span key={i} className="ui-keys-then">,<span className="ui-sr"> then</span></span>
          : k === '/' ? <span key={i} className="ui-keys-or"><span aria-hidden="true">/</span><span className="ui-sr">or</span></span>
            : <Glyph key={i} k={k} />)}
    </span>
  );
}

/** A small label: `accent` marks what the mod adds (Elevated), `ink` a requirement (6-button), `plain` a topic. */
export function Tag({ children, tone = 'plain' }: { children: ReactNode; tone?: 'accent' | 'ink' | 'plain' }) {
  return <span className={cx('ui-tag', `ui-tag-${tone}`)}>{children}</span>;
}

/** A picture or clip of the game's screen, scaled up with hard pixels, in the screen's frame. A clip plays
    muted in a loop; `poster` shows until it does (and for people who asked for less motion, instead of it). */
export function Screen({ src, alt, video, av1, poster, caption, wide, priority }: {
  /** The picture (also the clip's poster when `poster` isn't given). */
  src: string;
  alt: string;
  /** An H.264 .mp4 clip to play over the picture (plays everywhere). */
  video?: string;
  /** The same clip in AV1 (smaller); browsers that can play it take it first. */
  av1?: string;
  poster?: string;
  caption?: ReactNode;
  /** A picture that isn't 4:3 (a collage). */
  wide?: boolean;
  /** Above the fold (the hero): the picture loads right away, with high priority. */
  priority?: boolean;
}) {
  // The clip loads only when the screen comes near the viewport, so a long page doesn't fetch every clip at once.
  // No clip with reduced motion or Save-Data: the picture stays. Off screen, the clip pauses.
  const ref = useRef<HTMLElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [skip, setSkip] = useState(false);
  useEffect(() => {
    const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || c?.saveData) setSkip(true);
  }, []);
  useEffect(() => {
    if (!video || skip || !ref.current || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((es) => {
      const on = es.some((e) => e.isIntersecting);
      if (on) setNear(true);
      const v = vid.current;
      if (v) { if (on) v.play().catch(() => {}); else v.pause(); }
    }, { rootMargin: '300px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [video, skip, near]);
  return (
    <figure ref={ref} className={cx('ui-screen', wide && 'ui-screen-wide')}>
      <div className="ui-screen-glass">
        <img src={poster ?? src} alt={alt} loading={priority ? 'eager' : 'lazy'} decoding="async" {...(priority ? { fetchpriority: 'high' } : {})} />
        {video && near && !skip && (
          <video ref={vid} poster={poster ?? src} autoPlay muted loop playsInline preload="auto" aria-hidden="true">
            {av1 && <source src={av1} type='video/mp4; codecs="av01.0.04M.08"' />}
            <source src={video} type="video/mp4" />
          </video>
        )}
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

/** Labels and values in rows, like the game's Game Setup screen (TEAMS 138 …). */
export function SetupList({ rows, label }: { rows: [ReactNode, ReactNode][]; label?: string }) {
  return (
    <dl className="ui-setup" aria-label={label}>
      {rows.map(([k, v], i) => (
        <div key={i} className="ui-setup-row"><dt>{k}</dt><dd>{v}</dd></div>
      ))}
    </dl>
  );
}
