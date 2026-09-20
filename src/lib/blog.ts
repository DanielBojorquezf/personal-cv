import { getCollection, type CollectionEntry } from 'astro:content';
import type { Locale } from '../i18n/utils';
import { translations } from '../i18n/translations';

export const BLOG_CATEGORIES = [
  { slug: 'aws', label: 'AWS' },
  { slug: 'devops', label: 'DevOps' },
  { slug: 'backend', label: 'Backend' },
  { slug: 'frontend', label: 'Frontend' },
  { slug: 'security', label: 'Security' },
] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number]['slug'];
export type BlogPost = CollectionEntry<'blog'>;

export async function getPublishedPosts(lang?: Locale) {
  const posts = await getCollection('blog', ({ data }) => {
    const published = import.meta.env.DEV || !data.draft;
    return published && (!lang || data.lang === lang);
  });

  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export function formatPostDate(date: Date, lang: Locale = 'en') {
  return date.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function getCategoryLabel(slug: string, lang: Locale = 'en') {
  const categories = translations[lang].blog.categories;
  return categories[slug as keyof typeof categories] ?? slug;
}

export function getPostUrlSlug(post: BlogPost) {
  return post.data.translationKey;
}
