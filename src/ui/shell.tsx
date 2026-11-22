// The app shell for every screen size (user, 2026-11-22: the Dynasty app on handhelds such as the Odin 2 Portal,
// 960×540, and the Retroid Pocket Nova, 640×480). On a desktop (1200 px wide and 700 px tall or more) the app keeps
// its Masthead with the NavBar. Below that, `AppBar` takes their place: one 40 px row with the menu button, the
// pages (from 960 px wide; below that the open page's name) and the user's marks. `MenuDrawer` is the menu the
// button (or Start on a controller) opens.
import { useEffect, useId, useRef, type ReactNode } from 'react';
import type { NavItem } from './index';

const MenuIcon = () => (
  <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true"><path d="M0 1h20M0 7h20M0 13h20" stroke="currentColor" strokeWidth="2" /></svg>
);

/** The top row on handhelds, tablets and phones: menu button, the pages (or the open page's name), marks. */
export function AppBar({ label, items, page, onMenu, right }: {
  /** The menu's name for screen readers ("Dynasty"). */
  label: string;
  items: NavItem[];
  /** The open page's name, shown where the pages don't fit. */
  page: string;
  onMenu: () => void;
  /** Marks at the right (the user's team). */
  right?: ReactNode;
}) {
  return (
    <header className="ui-appbar">
      <button type="button" className="ui-appbar-menu" aria-label="Menu" data-pad-menu onClick={onMenu}><MenuIcon /></button>
      <span className="ui-appbar-page">{page}</span>
      <nav className="ui-appbar-nav" aria-label={label}>
        {items.map((x) => (
          <a key={x.href} href={x.off ? undefined : x.href} aria-current={x.current ? 'page' : undefined} aria-disabled={x.off || undefined} className={x.off ? 'ui-appbar-off' : undefined}>
            {x.label}
          </a>
        ))}
      </nav>
      <div className="ui-appbar-right">{right}</div>
    </header>
  );
}

/**
 * The app menu, slid in from the left over the page: the app's name, its pages (the open one marked, a line of
 * status beside any), and controls at the bottom. Escape, a click outside, B or Start close it.
 */
export function MenuDrawer({ title, sub, items, footer, onClose }: {
  title: string;
  sub?: ReactNode;
  items: (NavItem & { note?: string })[];
  footer?: ReactNode;
  onClose: () => void;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    // The open page first, so A opens it again and ▼ goes on from there.
    const cur = ref.current?.querySelector<HTMLElement>('[aria-current="page"]') ?? ref.current?.querySelector<HTMLElement>('a[href]');
    cur?.focus({ preventScroll: true });
    return () => document.removeEventListener('keydown', key);
  }, [onClose]);
  return (
    <div className="ui-drawer-back" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ui-drawer" role="dialog" aria-modal="true" aria-labelledby={id} data-menu-drawer ref={ref}>
        <div className="ui-drawer-head">
          <h2 id={id}>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        <nav className="ui-drawer-nav" aria-label="Pages">
          {items.map((x) => (
            <a key={x.href} href={x.off ? undefined : x.href} aria-current={x.current ? 'page' : undefined} aria-disabled={x.off || undefined} onClick={onClose}>
              <span>{x.label}</span>{x.note && <small>{x.note}</small>}
            </a>
          ))}
        </nav>
        {footer && <div className="ui-drawer-foot">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * A process one step at a time (the offseason): the step before and after as links (L2 / R2 on a controller), the
 * open step's name, and a pip per step. On a desktop the full `Steps` list can sit under it.
 */
export function StepNav({ label, steps, current, sub }: {
  label: string;
  steps: { label: string; href?: string }[];
  current: number;
  /** A word after the step's name ("week 1 of 5"). */
  sub?: string;
}) {
  const prev = steps[current - 1], next = steps[current + 1];
  return (
    <nav className="ui-stepnav" aria-label={label}>
      {prev?.href ? <a className="ui-stepnav-side" href={prev.href} data-pad="prev" data-pad-label={prev.label}><span aria-hidden="true">◀</span> {current}. {prev.label}</a> : <span className="ui-stepnav-side" />}
      <div className="ui-stepnav-now">
        <strong>Step {current + 1} of {steps.length}: {steps[current].label}{sub ? `, ${sub}` : ''}</strong>
        <span className="ui-stepnav-pips" aria-hidden="true">
          {steps.map((s, i) => <span key={s.label} className={i < current ? 'ui-pip-done' : i === current ? 'ui-pip-now' : undefined} />)}
        </span>
      </div>
      {next?.href ? <a className="ui-stepnav-side ui-stepnav-next" href={next.href} data-pad="next" data-pad-label={next.label}>{current + 2}. {next.label} <span aria-hidden="true">▶</span></a> : <span className="ui-stepnav-side" />}
    </nav>
  );
}
