import type { Locale } from '../i18n/utils';

export const works = [
  {
    slug: 'html-css-builder',
    image: '/assets/img/work/html-css-builder.svg',
    stack: ['Svelte', 'Laravel', 'MySQL', 'HTML / CSS'],
    en: {
      title: 'Visual HTML / CSS builder',
      summary: 'A drag-and-drop editor for landing pages and emails. Blocks become real markup, not a screenshot.',
      role: 'Full-stack',
      year: '2022 — present',
    },
    es: {
      title: 'Constructor visual HTML / CSS',
      summary: 'Un editor de landing pages y correos. Los bloques salen como markup de verdad, no como una captura.',
      role: 'Full stack',
      year: '2022 — actualidad',
    },
  },
  {
    slug: 'aws-path',
    image: '/assets/img/work/aws-path.svg',
    stack: ['AWS', 'Docker', 'ECS', 'CloudFront', 'GitHub Actions'],
    en: {
      title: 'AWS path to production',
      summary: 'DNS, CDN, containers, and CI so a release is a pipeline — not a weekend on one box.',
      role: 'Cloud / delivery',
      year: '2022 — present',
    },
    es: {
      title: 'Camino AWS a producción',
      summary: 'DNS, CDN, contenedores y CI para que un release sea un pipeline, no un fin de semana en una caja.',
      role: 'Nube / entrega',
      year: '2022 — actualidad',
    },
  },
  {
    slug: 'data-pipelines',
    image: '/assets/img/work/data-pipelines.svg',
    stack: ['PHP', 'PostgreSQL', 'cron', 'Docker'],
    en: {
      title: 'Data collection pipelines',
      summary: 'Scrapers and scheduled jobs that pull data, clean it, and drop it where the product can use it.',
      role: 'Backend',
      year: '2017 — 2022',
    },
    es: {
      title: 'Pipelines de datos',
      summary: 'Scrapers y jobs programados que traen datos, los limpian y los dejan donde el producto sí los usa.',
      role: 'Backend',
      year: '2017 — 2022',
    },
  },
  {
    slug: 'integrations',
    image: '/assets/img/work/integrations.svg',
    stack: ['Express', 'Laravel', 'Webhooks', 'SQS'],
    en: {
      title: 'Payments and messaging',
      summary: 'WhatsApp bots, payment callbacks, and the unglamorous jobs that move an event between systems.',
      role: 'Integrations',
      year: '2019 — present',
    },
    es: {
      title: 'Pagos y mensajería',
      summary: 'Bots de WhatsApp, callbacks de pago y los jobs que mueven un evento de un sistema a otro.',
      role: 'Integraciones',
      year: '2019 — actualidad',
    },
  },
] as const;

export type WorkSlug = (typeof works)[number]['slug'];
export type WorkItem = (typeof works)[number];

export function getWorks() {
  return works;
}

export function getWork(slug: string) {
  return works.find((item) => item.slug === slug);
}

export function getWorkCopy(item: WorkItem, lang: Locale) {
  return item[lang];
}
