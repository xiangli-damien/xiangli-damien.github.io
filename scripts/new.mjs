#!/usr/bin/env node
/**
 * Create a new piece of content with the front matter already filled in.
 *
 *   npm run new note "Attention is all you need" -- --category paper --tags transformers,attention
 *   npm run new note "随手记" -- --category field --lang zh
 *   npm run new life "A weekend in Hyde Park" -- --kind photo
 *   npm run new pub  "Title of the paper"
 *   npm run new project "Name of the project"
 *   npm run new news "**Paper accepted** at ACL 2026" -- --tag PAPER
 *
 * Add --folder to create `<slug>/index.md` so pictures and videos can sit next to the text.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [kind, title, ...rest] = process.argv.slice(2);

const flags = {};
for (let i = 0; i < rest.length; i += 1) {
  if (!rest[i].startsWith('--')) continue;
  const name = rest[i].slice(2);
  const next = rest[i + 1];
  if (next === undefined || next.startsWith('--')) flags[name] = true;
  else {
    flags[name] = next;
    i += 1;
  }
}

const NOTE_CATEGORIES = ['course', 'reading', 'paper', 'field'];
const LIFE_KINDS = ['essay', 'photo', 'film', 'log'];

function usage(message) {
  if (message) console.error(`\n  ${message}`);
  console.error(`
  Usage: npm run new <note|life|pub|project|news> "Title" -- [options]

    note     --category ${NOTE_CATEGORIES.join('|')}   --tags a,b   --lang en|zh   --folder
    life     --kind ${LIFE_KINDS.join('|')}            --lang en|zh   --folder
    pub      --year 2026   --venue ACL
    project  --year 2026   --tags a,b
    news     --tag PAPER   --date 2026-01   --url https://…
`);
  process.exit(1);
}

if (!kind || !title) usage();

const today = new Date();
const pad = (n) => String(n).padStart(2, '0');
const isoDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
const isoMonth = isoDate.slice(0, 7);

function slugify(text) {
  const ascii = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  // Titles without Latin letters (for example Chinese) fall back to the date.
  return ascii || `${isoDate}-${Math.random().toString(36).slice(2, 6)}`;
}

const quote = (text) => JSON.stringify(String(text));
// Every item is quoted, so that tags such as 2024, yes or c++ stay text.
const list = (value) =>
  value && value !== true
    ? `[${String(value)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => JSON.stringify(item))
        .join(', ')}]`
    : '[]';

/** Every Markdown file under a folder, as paths relative to it. */
function filed(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return filed(path).map((inner) => `${name}/${inner}`);
    return /\.mdx?$/i.test(name) ? [name] : [];
  });
}

/** The address a file gets on the site (see src/content.config.ts). */
function addressOf(entry) {
  const parts = entry.replace(/\.mdx?$/i, '').split('/');
  const last = parts.pop();
  return last === 'index' && parts.length ? parts.pop() : last;
}

/** Addresses are shared by the whole collection, whatever folder a file is in. */
function refuseClash(collectionDir, slug) {
  const other = filed(collectionDir).find((entry) => addressOf(entry) === slug);
  if (other) usage(`The address "${slug}" is already taken by ${relative(root, join(collectionDir, other))}. Pass --slug another-name.`);
}

function write(path, content) {
  if (existsSync(path)) usage(`${relative(root, path)} already exists. Pick another title or pass --slug.`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  console.log(`\n  created  ${relative(root, path)}\n`);
}

const slug = typeof flags.slug === 'string' ? flags.slug : slugify(title);
const file = (dir) => (flags.folder ? join(dir, slug, 'index.md') : join(dir, `${slug}.md`));
const lang = flags.lang === 'zh' || /[一-鿿]/.test(title) ? 'zh' : 'en';

switch (kind) {
  case 'note': {
    const category = flags.category || 'field';
    if (!NOTE_CATEGORIES.includes(category)) usage(`Unknown category "${category}".`);
    refuseClash(join(root, 'src/content/notes'), slug);
    write(
      file(join(root, 'src/content/notes', category)),
      `---
title: ${quote(title)}
summary: ""
date: ${isoDate}
category: ${category}
tags: ${list(flags.tags)}
lang: ${lang}
draft: true
---

Write here. Remove \`draft: true\` when the note is ready to be published.
`,
    );
    break;
  }
  case 'life': {
    const lifeKind = flags.kind || 'essay';
    if (!LIFE_KINDS.includes(lifeKind)) usage(`Unknown kind "${lifeKind}".`);
    refuseClash(join(root, 'src/content/life'), slug);
    write(
      file(join(root, 'src/content/life')),
      `---
title: ${quote(title)}
summary: ""
date: ${isoDate}
kind: ${lifeKind}
lang: ${lang}
tags: ${list(flags.tags)}
draft: true
---

Write here. Remove \`draft: true\` when it is ready to be published.
`,
    );
    break;
  }
  case 'pub': {
    const year = Number(flags.year) || today.getFullYear();
    refuseClash(join(root, 'src/content/publications'), `${slug}-${year}`);
    write(
      join(root, 'src/content/publications', `${slug}-${year}.md`),
      `---
title: ${quote(title)}
authors:
  - Xiang Li
venue: ${quote(flags.venue === true || !flags.venue ? '' : flags.venue)}
year: ${year}
type: conference   # conference | journal | workshop | preprint | thesis
links:
  url: ""
  pdf: ""
  doi: ""
  code: ""
# figure: ../../assets/figures/your-figure.png
# figureAlt: ""
abstract: ""
bibtex: |
  @inproceedings{key${year},
    title={${title}},
    author={Li, Xiang},
    year={${year}}
  }
---
`,
    );
    break;
  }
  case 'project': {
    const year = Number(flags.year) || today.getFullYear();
    refuseClash(join(root, 'src/content/projects'), slug);
    write(
      join(root, 'src/content/projects', `${slug}.md`),
      `---
title: ${quote(title)}
year: ${year}
featured: false
order: 99
tags: ${list(flags.tags)}
# figure: ../../assets/figures/your-figure.png
# figureAlt: ""
links:
  code: ""
  paper: ""
  demo: ""
---

Describe the project here.
`,
    );
    break;
  }
  case 'news': {
    const path = join(root, 'src/data/news.yaml');
    const date = typeof flags.date === 'string' ? flags.date : isoMonth;
    const lines = [`- date: ${date}`];
    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(date)) usage(`Write the date as YYYY-MM or YYYY-MM-DD, not "${date}".`);
    if (typeof flags.tag === 'string') lines.push(`  tag: ${quote(flags.tag.toUpperCase())}`);
    lines.push(`  text: ${quote(title)}`);
    if (typeof flags.url === 'string') lines.push(`  url: ${quote(flags.url)}`);
    const current = readFileSync(path, 'utf8');
    const firstItem = current.search(/^- /m);
    const next =
      firstItem === -1
        ? `${current.trimEnd()}\n\n${lines.join('\n')}\n`
        : `${current.slice(0, firstItem)}${lines.join('\n')}\n\n${current.slice(firstItem)}`;
    writeFileSync(path, next);
    console.log(`\n  added to src/data/news.yaml\n\n${lines.map((l) => `    ${l}`).join('\n')}\n`);
    break;
  }
  default:
    usage(`Unknown kind "${kind}".`);
}
