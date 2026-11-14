// The manual: a printed booklet (the Dynasty brand's paper, ink and black bars), one chapter per page.
// Chapters are src/site/manual/NN-slug.mdx. The edition switch shows the 1994 or 2026 text where they differ.
import { useEffect, useState } from 'react';
import { chapters, type Chapter } from './content';
import { mdxComponents, type EditionId } from './mdx';

const EDITION_KEY = 'manual-edition';

function useEdition(): [EditionId, (e: EditionId) => void] {
  const [ed, setEd] = useState<EditionId>('2026');
  useEffect(() => {
    try {
      const saved = localStorage.getItem(EDITION_KEY);
      if (saved === '1994' || saved === '2026') setEd(saved);
    } catch { /* storage off: 2026 */ }
  }, []);
  const set = (e: EditionId) => {
    setEd(e);
    try { localStorage.setItem(EDITION_KEY, e); } catch { /* storage off */ }
  };
  return [ed, set];
}

function ManualHead({ edition, setEdition }: { edition?: EditionId; setEdition?: (e: EditionId) => void }) {
  return (
    <div className="manual-head">
      <div className="manual-head-inner">
        <h1 className="manual-title"><a href="/manual">The Manual</a></h1>
        <p>
          Everything from the original instruction booklet, rewritten for the Elevated editions, plus every new control and mode. What the mod added is
          marked <span className="ui-tag ui-tag-accent">Elevated</span>.
        </p>
        {edition && setEdition && (
          <div className="manual-switch" role="group" aria-label="Show the text for">
            <span>Edition:</span>
            {(['1994', '2026'] as const).map((e) => (
              <button key={e} type="button" aria-pressed={edition === e} onClick={() => setEdition(e)}>{e} Season</button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Contents({ current }: { current?: number }) {
  return (
    <nav className="manual-contents" aria-label="Chapters">
      <p className="ui-sub">Contents</p>
      <ol>
        {chapters.map((c) => (
          <li key={c.slug}>
            <a href={`/manual/${c.slug}`} aria-current={c.n === current ? 'page' : undefined}>
              <span className="manual-n">{c.n}</span>
              {c.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function ManualIndex() {
  return (
    <div className="manual" data-brand="dynasty" data-theme="light">
      <ManualHead />
      <div className="manual-body manual-body-index">
        <ol className="manual-index">
          {chapters.map((c) => (
            <li key={c.slug}>
              <a href={`/manual/${c.slug}`}>
                <span className="manual-n manual-n-big">{c.n}</span>
                <span>
                  <strong>{c.title}</strong>
                  <span className="manual-summary">{c.summary}</span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function ChapterPage({ chapter }: { chapter: Chapter }) {
  const [edition, setEdition] = useEdition();
  const i = chapters.indexOf(chapter);
  const prev = chapters[i - 1];
  const next = chapters[i + 1];
  const Body = chapter.Body;
  return (
    <div className="manual" data-brand="dynasty" data-theme="light" data-edition={edition}>
      <ManualHead edition={edition} setEdition={setEdition} />
      <div className="manual-body">
        <Contents current={chapter.n} />
        <article className="manual-chapter">
          <header className="manual-chapter-head">
            <span className="manual-n manual-n-box">{chapter.n}</span>
            <h1>{chapter.title}</h1>
          </header>
          <div className="manual-text">
            <Body components={mdxComponents} />
          </div>
          <nav className="manual-pager" aria-label="Chapters">
            {prev ? <a href={`/manual/${prev.slug}`} rel="prev">◄ {prev.n} {prev.title}</a> : <span />}
            {next ? <a href={`/manual/${next.slug}`} rel="next">{next.n} {next.title} ►</a> : <span />}
          </nav>
        </article>
      </div>
    </div>
  );
}
