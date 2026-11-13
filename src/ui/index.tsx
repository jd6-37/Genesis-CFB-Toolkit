// The shared component library of the Mod Toolkit and the Dynasty app (docs/design-system.md).
// Every component is themed by the tokens of the brand and theme around it (tokens.css): the same Button is
// yellow on indigo in the toolkit and black on white in Dynasty. New UI is built from these; a new kind of
// element becomes a component here, with a story (src/ui/*.stories.tsx), before a page uses it.
import { useEffect, useId, type ReactNode } from 'react';
import './tokens.css';
import './ui.css';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export type ButtonVariant = 'primary' | 'quiet' | 'danger';
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
}
/** An action. One primary button per view; the rest quiet. */
export function Button({ children, variant = 'primary', href, onClick, disabled, type = 'button', title, label }: ButtonProps) {
  const cls = cx('ui-button', variant !== 'primary' && `ui-button-${variant}`);
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

/** Buttons or controls side by side, wrapping on phones. */
export const Row = ({ children }: { children: ReactNode }) => <div className="ui-row">{children}</div>;

/** A message about what just happened or what to do next. */
export function Note({ children, kind = 'info' }: { children: ReactNode; kind?: 'info' | 'ok' | 'error' }) {
  return <p className={cx('ui-note', kind !== 'info' && `ui-note-${kind}`)} role={kind === 'error' ? 'alert' : 'status'}>{children}</p>;
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
export function SubHead({ children, level = 3 }: { children: ReactNode; level?: 2 | 3 }) {
  const H = level === 2 ? 'h2' : 'h3';
  return <H className="ui-sub">{children}</H>;
}

export interface Option { value: string | number; label: string; disabled?: boolean }
interface SelectProps {
  label: string;
  /** Hide the label visually (it still names the control for screen readers). */
  hideLabel?: boolean;
  value: string | number;
  options: Option[];
  onChange: (value: string) => void;
}
/** A labeled dropdown. */
export function Select({ label, hideLabel, value, options, onChange }: SelectProps) {
  return (
    <label className="ui-field">
      <span className={hideLabel ? 'sr-only' : undefined}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
      </select>
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
export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <div className="ui-stat">
      <div className="ui-stat-label">{label}</div>
      <div className="ui-stat-value">{value}</div>
      {note && <div className="ui-stat-note">{note}</div>}
    </div>
  );
}

/** What a page shows when it has nothing yet: say what to do next. */
export const Empty = ({ children }: { children: ReactNode }) => <div className="ui-empty">{children}</div>;

/** A window over the page for one decision. Escape or a click outside closes it when onClose is given. */
export function Modal({ title, children, actions, onClose }: { title: string; children: ReactNode; actions: ReactNode; onClose?: () => void }) {
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
        <h2 id={id}>{title}</h2>
        {children}
        <div className="ui-row ui-modal-actions">{actions}</div>
      </div>
    </div>
  );
}
