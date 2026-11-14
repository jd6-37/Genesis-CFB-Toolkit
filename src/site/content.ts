// The site's written content: manual chapters (src/site/manual/*.mdx) and Insights posts
// (src/site/insights/*.mdx). Each file exports `meta` and its text as the default export.
// Adding a page is adding a file: the routes, the contents lists and the prerendered HTML follow from here.
import type { ComponentType } from 'react';
import type { MDXProps } from 'mdx/types';

export interface ChapterMeta {
  /** Its place in the manual (1, 2, 3 …). */
  n: number;
  /** The address: /manual/<slug>. */
  slug: string;
  title: string;
  /** One sentence for the contents page and search results. */
  summary: string;
}
export interface PostMeta {
  slug: string;
  title: string;
  /** One or two sentences under the title. */
  dek: string;
  /** YYYY-MM-DD */
  date: string;
  /** The topic shown on the post's tag (Game logic, Ratings, The mod …). */
  tag: string;
  /** Reading time, in minutes. */
  minutes: number;
}
type Mdx<M> = { meta: M; default: ComponentType<MDXProps> };

const chapterFiles = import.meta.glob<Mdx<ChapterMeta>>('./manual/*.mdx', { eager: true });
const postFiles = import.meta.glob<Mdx<PostMeta>>('./insights/*.mdx', { eager: true });

export const chapters = Object.values(chapterFiles).map((f) => ({ ...f.meta, Body: f.default })).sort((a, b) => a.n - b.n);
/** Newest first. */
export const posts = Object.values(postFiles).map((f) => ({ ...f.meta, Body: f.default })).sort((a, b) => b.date.localeCompare(a.date));

export type Chapter = (typeof chapters)[number];
export type Post = (typeof posts)[number];
