// Insights: long reads about the mod and the game's code. Posts are src/site/insights/<slug>.mdx.
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Tag } from '../ui';
import { posts, type Post } from './content';
import { mdxComponents } from './mdx';

const longDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

export function InsightsIndex() {
  return (
    <div className="insights">
      <div className="insights-head">
        <h1 className="home-h2">Insights</h1>
        <p>Articles on how the game's code works and what the mod changes: what each rating does, how simulated games are decided, how fatigue works.</p>
      </div>
      <ul className="insights-list">
        {posts.map((p) => (
          <li key={p.slug}>
            <a href={`/insights/${p.slug}`}>
              <span className="insights-meta"><Tag>{p.tag}</Tag> <time dateTime={p.date}>{longDate(p.date)}</time></span>
              <h2>{p.title}</h2>
              <p>{p.dek}</p>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "In this post": the post's sections, read from its headings once the page is in the browser. */
function InThisPost({ article }: { article: RefObject<HTMLElement> }) {
  const [items, setItems] = useState<{ id: string; text: string }[]>([]);
  useEffect(() => {
    const hs = article.current?.querySelectorAll('h2[id]') ?? [];
    setItems([...hs].map((h) => ({ id: h.id, text: h.textContent ?? '' })));
  }, [article]);
  if (items.length < 2) return null;
  return (
    <nav className="post-rail" aria-label="In this post">
      <p>In this post</p>
      <ol>{items.map((x) => <li key={x.id}><a href={`#${x.id}`}>{x.text}</a></li>)}</ol>
    </nav>
  );
}

export function PostPage({ post }: { post: Post }) {
  const ref = useRef<HTMLElement>(null);
  const Body = post.Body;
  const others = posts.filter((p) => p !== post).slice(0, 3);
  return (
    <div className="post">
      <header className="post-head">
        <div className="post-head-inner">
          <p className="post-meta">
            <Tag tone="accent">{post.tag}</Tag> <time dateTime={post.date}>{longDate(post.date)}</time> <span>{post.minutes} minute read</span>
          </p>
          <h1>{post.title}</h1>
          <p className="post-dek">{post.dek}</p>
          <p className="post-by">By JD637</p>
        </div>
      </header>
      <div className="post-paper" data-brand="dynasty" data-theme="light">
        <div className="post-body">
          <article ref={ref} className="post-text">
            <Body components={mdxComponents} />
          </article>
          <InThisPost article={ref} />
        </div>
        {others.length > 0 && (
          <nav className="post-more" aria-label="More Insights">
            <p className="ui-sub">More Insights</p>
            <ul>{others.map((p) => <li key={p.slug}><a href={`/insights/${p.slug}`}>{p.title}</a></li>)}</ul>
          </nav>
        )}
      </div>
    </div>
  );
}
