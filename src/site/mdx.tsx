// The parts the manual's and the posts' MDX files can use without importing them, and how their Markdown
// is drawn (## is a section bar, tables get the shared look, code is a black game screen).
import { Children, isValidElement, type ReactNode } from 'react';
import type { MDXComponents } from 'mdx/types';
import { Glyph, Screen, SubHead, Tag, type GlyphKey } from '../ui';

/** A heading's text as an address (#calling-a-play). */
export const slugify = (node: ReactNode): string => {
  const text = (n: ReactNode): string =>
    typeof n === 'string' || typeof n === 'number' ? String(n) : Array.isArray(n) ? n.map(text).join('') : isValidElement(n) ? text((n.props as { children?: ReactNode }).children) : '';
  return text(node).toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
};

/** A controller button in a sentence: <Btn k="C" />. */
const Btn = ({ k }: { k: GlyphKey }) => <Glyph k={k} />;
/** Marks what the mod added: <New />. */
const New = () => <Tag tone="accent">Elevated</Tag>;
/** Needs a 6-button pad: <Six />. */
const Six = () => <Tag tone="ink">6-button</Tag>;

type ControlRow = [GlyphKey[], ReactNode, ('new' | 'six' | 'new six')?];
/** A list of controls: buttons, what they do, and whether it's new or needs a 6-button pad. */
function Controls({ rows, title }: { rows: ControlRow[]; title?: string }) {
  return (
    <div className="ui-table-wrap">
      <table className="ui-table mdx-controls">
        {title && <caption>{title}</caption>}
        <tbody>
          {rows.map(([keys, what, flags], i) => (
            <tr key={i}>
              <td className="mdx-keys-cell"><span className="mdx-keys">{keys.map((k, j) => <Glyph key={j} k={k} />)}</span></td>
              <td className="mdx-what">{what}</td>
              <td className="mdx-flags">{flags?.includes('new') && <New />} {flags?.includes('six') && <Six />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tip({ children, title = 'Tip' }: { children: ReactNode; title?: string }) {
  return (
    <aside className="mdx-tip">
      <p className="mdx-tip-head">{title}</p>
      <div className="mdx-tip-body">{children}</div>
    </aside>
  );
}

/** A note that something was fixed or changed by the mod (posts). */
function Fixed({ children, label = 'Fixed' }: { children: ReactNode; label?: string }) {
  return <aside className="mdx-fixed"><Tag tone="accent">{label}</Tag> <span>{children}</span></aside>;
}

/** A screenshot or clip, with numbered callouts listed beside it: points are [x %, y %, text]. */
function Shot({ src, video, alt, caption, points }: { src: string; video?: string; alt: string; caption?: ReactNode; points?: [number, number, ReactNode][] }) {
  if (!points?.length) return <div className="mdx-shot"><Screen src={src} video={video} alt={alt} caption={caption} /></div>;
  return (
    <div className="mdx-shot mdx-shot-points">
      <div className="mdx-shot-pic">
        <Screen src={src} video={video} alt={alt} caption={caption} />
        {points.map(([x, y], i) => (
          <span key={i} className="mdx-point" style={{ left: `${x}%`, top: `${y}%` }} aria-hidden="true">{i + 1}</span>
        ))}
      </div>
      <ol className="mdx-legend">
        {points.map(([, , text], i) => <li key={i}>{text}</li>)}
      </ol>
    </div>
  );
}

export type EditionId = '1994' | '2026';
/** Text for one edition only. The page has both; the manual's edition switch (data-edition on the page)
    shows one or the other. */
function Edition({ only, children }: { only: EditionId; children: ReactNode }) {
  return (
    <div className={`mdx-edition mdx-edition-${only}`}>
      <Tag tone="ink">{only} Season Edition</Tag>
      {children}
    </div>
  );
}

const H2 = ({ children }: { children?: ReactNode }) => <SubHead level={2} id={slugify(children)}>{children}</SubHead>;
const H3 = ({ children }: { children?: ReactNode }) => <h3 className="mdx-h3" id={slugify(children)}>{children}</h3>;
const TableMd = ({ children }: { children?: ReactNode }) => <div className="ui-table-wrap"><table className="ui-table mdx-table">{children}</table></div>;
const Pre = ({ children }: { children?: ReactNode }) => <pre className="mdx-code">{Children.map(children, (c) => c)}</pre>;

export const mdxComponents: MDXComponents = {
  h2: H2, h3: H3, table: TableMd, pre: Pre,
  Btn, New, Six, Controls, Tip, Fixed, Shot, Edition,
} as MDXComponents;
