// The shared component library of the Mod Toolkit and the Dynasty app (docs/design-system.md).
// Every component is themed by the tokens of the brand and theme around it (tokens.css): the same Button is
// yellow on indigo in the toolkit and black on white in Dynasty. New UI is built from these; a new kind of
// element becomes a component here, with a story (src/ui/*.stories.tsx), before a page uses it.
import { Fragment, useEffect, useId, useRef, type ReactNode } from 'react';
import './tokens.css';
import './ui.css';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/** `link`: an action that reads as underlined text (undo, close, a name in a list), in a sentence or a table cell. */
export type ButtonVariant = 'primary' | 'quiet' | 'danger' | 'link';
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
}
/** A labeled dropdown. */
export function Select({ label, hideLabel, value, options, onChange, disabled, compact, title, placeholder, note }: SelectProps) {
  // Runs of options with the same group become one <optgroup>.
  const runs: { group?: string; items: Option[] }[] = [];
  for (const o of options) {
    const last = runs[runs.length - 1];
    if (last && last.group === o.group) last.items.push(o);
    else runs.push({ group: o.group, items: [o] });
  }
  const item = (o: Option) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>;
  return (
    <label className={`ui-field${compact ? ' ui-field-compact' : ''}`}>
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
  /** Called when the reader leaves the field. */
  onBlur?: () => void;
}
/** A labeled one-line text, number or search field. */
export function Field({ label, hideLabel, value, onChange, type = 'text', placeholder, min, max, step, maxLength, disabled, note, invalid, onBlur }: FieldProps) {
  return (
    <label className="ui-field">
      <span className={hideLabel ? 'sr-only' : undefined}>{label}</span>
      <input
        type={type} inputMode={type === 'number' ? 'decimal' : undefined} value={value} placeholder={placeholder}
        min={min} max={max} step={step} maxLength={maxLength} disabled={disabled} aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)} onBlur={onBlur}
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
export function Table({ children, figures, className }: {
  children: ReactNode;
  /** Every cell that isn't `ui-left` or `ui-text` is a figure, shown in the pixel numerals. */
  figures?: boolean;
  /** A layout hook only (column widths); the look comes from the component. */
  className?: string;
}) {
  return (
    <div className="ui-table-wrap">
      <table className={['ui-table', figures ? 'ui-figures' : '', className ?? ''].filter(Boolean).join(' ')}>{children}</table>
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
