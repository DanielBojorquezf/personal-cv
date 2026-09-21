import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'cv');
const photoPath = join(root, 'public', 'assets', 'img', 'profile-img.jpg');

const browsers = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

const english = {
  lang: 'en',
  file: 'daniel-bojorquez.pdf',
  title: 'Resume',
  name: 'Daniel Bojorquez',
  role: 'Full-stack engineer',
  contacts: [
    { label: 'Hermosillo, Mexico' },
    { label: '+52 (662) 297-1219', href: 'tel:+526622971219' },
    { label: 'danielbojorquezf@gmail.com', href: 'mailto:danielbojorquezf@gmail.com' },
    { label: 'github.com/DanielBojorquezf', href: 'https://github.com/DanielBojorquezf' },
    { label: 'linkedin.com/in/daniel-bojorquez', href: 'https://www.linkedin.com/in/daniel-bojorquez' },
  ],
  summary: [
    'Nine years shipping web products and the path around them: apps, APIs, Docker, and AWS. What I enjoy most is problem solving: starting something from zero, then staying for the troubleshooting when it breaks.',
    'I am glad to work alone, with a small crew, or inside a larger team. I really like implementing AI — in the daily workflow and in the product — and I keep learning how to include more of it without skipping regulation or security.',
  ],
  education: {
    title: 'Education',
    items: [
      {
        title: 'Computer Systems Engineer',
        school: 'ITH, Hermosillo · 2015 — 2019',
        body: 'The degree that turned weekend code into systems work. Java, PHP, and C#.',
      },
      {
        title: 'Programming Technician',
        school: 'CBTIS 11, Hermosillo · 2012 — 2015',
        body: 'Where I started: C, PHP, Java, and my first Android apps.',
      },
      {
        title: 'Languages',
        school: 'English and Spanish',
        body: 'I work with teams in both. Writing, calls, and handoff notes.',
      },
    ],
  },
  experience: {
    title: 'Experience',
    items: [
      {
        title: 'Full-stack engineer',
        date: '2022 — Present',
        company: 'Seagage',
        items: [
          'Product UIs in Svelte and Angular, plus React / Next.js when it fits.',
          'Laravel and Express APIs on MySQL, shipped in Docker.',
          'AWS in production and CI with GitHub Actions and Jenkins.',
          'AI in the daily workflow and in the product, with an eye on security.',
        ],
      },
      {
        title: 'Full-stack web developer',
        date: '2019 — 2022',
        company: 'Powdevs, Hermosillo',
        items: [
          'Client apps in Angular, Svelte, Laravel, and Express, including the first AWS deploys.',
          'Scrapers, PostgreSQL, and cron jobs for data collection.',
        ],
      },
      {
        title: 'Full-stack developer',
        date: '2017 — 2019',
        company: 'Rivka Development, Hermosillo',
        items: [
          'AngularJS and Laravel apps, plus an Ionic client on the same API.',
          'Scrapers and scheduled jobs for data nobody wanted to type in.',
        ],
      },
    ],
  },
  tools: {
    title: 'Tools',
    items: [
      'Svelte',
      'Angular',
      'React',
      'Next.js',
      'TypeScript',
      'Laravel',
      'Express',
      'MySQL',
      'PostgreSQL',
      'AWS',
      'Docker',
      'GitHub Actions',
      'Groq',
      'Claude',
      'Ollama',
    ],
  },
};

const spanish = {
  lang: 'es',
  file: 'daniel-bojorquez-es.pdf',
  title: 'Currículum',
  name: 'Daniel Bojorquez',
  role: 'Ingeniero full stack',
  contacts: [
    { label: 'Hermosillo, México' },
    { label: '+52 (662) 297-1219', href: 'tel:+526622971219' },
    { label: 'danielbojorquezf@gmail.com', href: 'mailto:danielbojorquezf@gmail.com' },
    { label: 'github.com/DanielBojorquezf', href: 'https://github.com/DanielBojorquezf' },
    { label: 'linkedin.com/in/daniel-bojorquez', href: 'https://www.linkedin.com/in/daniel-bojorquez' },
  ],
  summary: [
    'Nueve años sacando productos web y el camino alrededor: apps, APIs, Docker y AWS. Lo que más me gusta es resolver problemas: armar algo desde cero y quedarme en el troubleshooting cuando se rompe.',
    'Me late trabajar solo, con un equipo chico o dentro de uno grande. Me gusta mucho meter IA — en el flujo diario y en el producto — y sigo aprendiendo cómo usarla más sin saltarme la regulación ni la seguridad.',
  ],
  education: {
    title: 'Educación',
    items: [
      {
        title: 'Ingeniero en Sistemas Computacionales',
        school: 'ITH, Hermosillo · 2015 — 2019',
        body: 'El título que pasó el código de hobby a sistemas. Java, PHP y C#.',
      },
      {
        title: 'Técnico en Programación',
        school: 'CBTIS 11, Hermosillo · 2012 — 2015',
        body: 'Ahí empecé: C, PHP, Java y las primeras apps en Android.',
      },
      {
        title: 'Idiomas',
        school: 'Inglés y español',
        body: 'Trabajo con equipos en los dos. Texto, llamadas y notas de entrega.',
      },
    ],
  },
  experience: {
    title: 'Experiencia',
    items: [
      {
        title: 'Ingeniero full stack',
        date: '2022 — Actualidad',
        company: 'Seagage',
        items: [
          'UIs de producto en Svelte y Angular, y React / Next.js cuando encaja.',
          'APIs en Laravel y Express sobre MySQL, sacadas en Docker.',
          'AWS en producción y CI con GitHub Actions y Jenkins.',
          'IA en el flujo diario y en el producto, con un ojo en la seguridad.',
        ],
      },
      {
        title: 'Desarrollador web full stack',
        date: '2019 — 2022',
        company: 'Powdevs, Hermosillo',
        items: [
          'Apps para clientes en Angular, Svelte, Laravel y Express, incluidos los primeros deploys en AWS.',
          'Scrapers, PostgreSQL y cron jobs para juntar datos.',
        ],
      },
      {
        title: 'Desarrollador full stack',
        date: '2017 — 2019',
        company: 'Rivka Development, Hermosillo',
        items: [
          'Apps en AngularJS y Laravel, y un cliente Ionic sobre el mismo API.',
          'Scrapers y jobs programados para datos que nadie quería capturar a mano.',
        ],
      },
    ],
  },
  tools: {
    title: 'Herramientas',
    items: [
      'Svelte',
      'Angular',
      'React',
      'Next.js',
      'TypeScript',
      'Laravel',
      'Express',
      'MySQL',
      'PostgreSQL',
      'AWS',
      'Docker',
      'GitHub Actions',
      'Groq',
      'Claude',
      'Ollama',
    ],
  },
};

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function linkOrText(item) {
  const label = escapeHtml(item.label);
  return item.href ? `<a href="${escapeHtml(item.href)}">${label}</a>` : label;
}

function resumeItem({ title, date, school, company, body, items }) {
  return `
    <article class="resume-item">
      <div class="item-head">
        ${title ? `<h4>${escapeHtml(title)}</h4>` : ''}
        ${date ? `<p class="date">${escapeHtml(date)}</p>` : ''}
      </div>
      ${school || company ? `<p class="place">${escapeHtml(school || company)}</p>` : ''}
      ${body ? `<p class="note">${escapeHtml(body)}</p>` : ''}
      ${
        items?.length
          ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
          : ''
      }
    </article>`;
}

function buildHtml(doc, photoSrc) {
  return `<!DOCTYPE html>
<html lang="${doc.lang}">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(doc.name)} — ${escapeHtml(doc.title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,400;0,600;0,700;1,400&family=Poppins:wght@600;700&family=Raleway:wght@600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #272829;
      font-family: "Open Sans", sans-serif;
      font-size: 10pt;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    a { color: #149ddd; text-decoration: none; }
    h1, h2, h3, h4, p { margin: 0; }
    .sheet {
      max-width: 186mm;
      margin: 0 auto;
    }
    .identity {
      display: grid;
      grid-template-columns: 18mm 1fr;
      gap: 14px;
      align-items: center;
      padding-bottom: 14px;
      margin-bottom: 14px;
      border-bottom: 2px solid #173b6c;
    }
    .photo {
      width: 18mm;
      height: 18mm;
      object-fit: cover;
      object-position: center 28%;
      border-radius: 50%;
      border: 3px solid #2c2f3f;
    }
    .identity h1 {
      font-family: "Poppins", sans-serif;
      font-size: 20pt;
      font-weight: 600;
      color: #050d18;
      line-height: 1.1;
    }
    .role {
      margin: 3px 0 7px;
      color: #173b6c;
      font-size: 11pt;
      font-weight: 600;
    }
    .contacts {
      display: flex;
      flex-wrap: wrap;
      gap: 3px 12px;
      margin: 0;
      padding: 0;
      list-style: none;
      color: #3a3b3f;
      font-size: 8.6pt;
    }
    .lead {
      margin: 0 0 18px;
      color: #272829;
      font-size: 10.2pt;
    }
    .lead p + p { margin-top: 9px; }
    .columns {
      display: grid;
      grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.18fr);
      gap: 0 26px;
      align-items: start;
    }
    .resume-title {
      font-family: "Raleway", sans-serif;
      font-size: 12.5pt;
      font-weight: 700;
      color: #173b6c;
      margin: 0 0 10px;
      padding-bottom: 5px;
      border-bottom: 2px solid #149ddd;
    }
    .resume-item {
      position: relative;
      padding: 0 0 12px 16px;
      border-left: 2px solid #1f5297;
    }
    .resume-item:last-child { padding-bottom: 2px; }
    .resume-item::before {
      content: "";
      position: absolute;
      left: -6px;
      top: 3px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #fff;
      border: 2px solid #1f5297;
    }
    .item-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 10px;
      margin-bottom: 3px;
    }
    .resume-item h4 {
      font-family: "Poppins", sans-serif;
      font-size: 10pt;
      font-weight: 600;
      line-height: 1.3;
      color: #050d18;
    }
    .date {
      flex: 0 0 auto;
      padding: 1px 8px;
      background: #e4edf9;
      color: #122f57;
      font-size: 8.4pt;
      font-weight: 600;
      white-space: nowrap;
    }
    .place {
      margin-bottom: 4px;
      color: #4b5563;
      font-size: 9.2pt;
    }
    .note {
      color: #272829;
      font-size: 9.4pt;
    }
    .resume-item ul {
      margin: 4px 0 0;
      padding: 0 0 0 16px;
    }
    .resume-item ul li { padding-bottom: 3px; }
    .resume-item ul li:last-child { padding-bottom: 0; }
    .tools {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #d6e0ee;
    }
    .tools .resume-title {
      margin-bottom: 8px;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .chips li {
      padding: 3px 9px;
      border: 1px solid #d6e0ee;
      background: #f5f8fd;
      color: #122f57;
      font-size: 8.4pt;
    }
  </style>
</head>
<body>
  <main class="sheet">
    <header class="identity">
      <img class="photo" src="${photoSrc}" alt="${escapeHtml(doc.name)}">
      <div>
        <h1>${escapeHtml(doc.name)}</h1>
        <p class="role">${escapeHtml(doc.role)}</p>
        <ul class="contacts">${doc.contacts.map((item) => `<li>${linkOrText(item)}</li>`).join('')}</ul>
      </div>
    </header>

    <div class="lead">${doc.summary.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}</div>

    <div class="columns">
      <section>
        <h2 class="resume-title">${escapeHtml(doc.education.title)}</h2>
        ${doc.education.items.map((item) => resumeItem(item)).join('')}
      </section>
      <section>
        <h2 class="resume-title">${escapeHtml(doc.experience.title)}</h2>
        ${doc.experience.items.map((item) => resumeItem(item)).join('')}
      </section>
    </div>

    <section class="tools">
      <h2 class="resume-title">${escapeHtml(doc.tools.title)}</h2>
      <ul class="chips">${doc.tools.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    </section>
  </main>
</body>
</html>`;
}

async function firstExisting(paths) {
  const { access } = await import('node:fs/promises');
  for (const path of paths) {
    try {
      await access(path);
      return path;
    } catch {
      // keep looking
    }
  }
  throw new Error('Chrome or Edge is required to render the CV PDF.');
}

function toFileUrl(filePath) {
  return `file:///${filePath.replaceAll('\\', '/')}`;
}

async function printPdf(browser, htmlPath, pdfPath) {
  const userDataDir = await mkdtemp(join(tmpdir(), 'cv-chrome-'));
  try {
    await execFileAsync(
      browser,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--hide-scrollbars',
        '--no-pdf-header-footer',
        `--user-data-dir=${userDataDir}`,
        `--print-to-pdf=${pdfPath}`,
        '--virtual-time-budget=12000',
        toFileUrl(htmlPath),
      ],
      { windowsHide: true }
    );
  } finally {
    await rm(userDataDir, { recursive: true, force: true });
  }
}

const photo = await readFile(photoPath);
const photoSrc = `data:image/jpeg;base64,${photo.toString('base64')}`;
const browser = await firstExisting(browsers);

await mkdir(outDir, { recursive: true });

for (const doc of [english, spanish]) {
  const htmlPath = join(outDir, doc.file.replace('.pdf', '.html'));
  const pdfPath = join(outDir, doc.file);
  await writeFile(htmlPath, buildHtml(doc, photoSrc));
  await printPdf(browser, htmlPath, pdfPath);
}

console.log(`Wrote ${join(outDir, english.file)} and ${join(outDir, spanish.file)}`);
