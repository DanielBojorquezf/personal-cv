export const locales = ['en', 'es'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export function getLangFromUrl(url: URL): Locale {
  const [, maybeLang] = url.pathname.split('/');
  return maybeLang === 'es' ? 'es' : 'en';
}

export function localizedPath(lang: Locale, path: string) {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (lang === 'es') {
    return clean === '/' ? '/es' : `/es${clean}`;
  }
  return clean;
}

export function getAlternatePath(url: URL, nextLang: Locale) {
  let path = url.pathname.replace(/\/$/, '') || '/';

  if (path === '/es' || path.startsWith('/es/')) {
    path = path.slice(3) || '/';
  }

  if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  return localizedPath(nextLang, path) + url.search;
}
