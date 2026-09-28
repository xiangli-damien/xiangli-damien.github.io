#!/usr/bin/env node
/**
 * Check the built site (dist/) for links that lead nowhere.
 *
 *   npm run build && npm run check:links
 *
 * Every internal href and src must point at a file that exists, and every #fragment at an
 * id that exists on the page it names. Addresses on other sites are counted, not fetched.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

if (!existsSync(dist)) {
  console.error('\n  dist/ does not exist. Run `npm run build` first.\n');
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const pages = walk(dist).filter((file) => file.endsWith('.html'));
const ids = new Map();

function idsOf(file) {
  if (!ids.has(file)) {
    const html = readFileSync(file, 'utf8');
    ids.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1])));
  }
  return ids.get(file);
}

/** The file a site path is served from, or null. */
function fileFor(path) {
  const clean = decodeURIComponent(path);
  const target = resolve(dist, `.${clean}`);
  if (!target.startsWith(dist)) return null;
  if (existsSync(target) && statSync(target).isFile()) return target;
  const index = join(target, 'index.html');
  if (existsSync(index)) return index;
  if (existsSync(`${target}.html`)) return `${target}.html`;
  return null;
}

const OWN = /^https?:\/\/xiangli-damien\.github\.io(?=[/?#]|$)/i;

/** The page without the parts whose text only looks like markup: listings, code, scripts. */
const markup = (html) =>
  html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<pre\b[\s\S]*?<\/pre>/gi, '')
    .replace(/<code\b[\s\S]*?<\/code>/gi, '');

const broken = [];
const external = new Set();
let checked = 0;

for (const page of pages) {
  const html = markup(readFileSync(page, 'utf8'));
  const here = `/${relative(dist, page)}`.replace(/index\.html$/, '');
  // Only attributes of a tag count, not text that happens to read href="...".
  const links = [...html.matchAll(/<[a-zA-Z][^<>]*?\s(?:href|src)="([^"]*)"/g)].map((match) =>
    match[1].replace(/&amp;/g, '&'),
  );
  // srcset holds several addresses, each followed by a width
  for (const match of html.matchAll(/<[a-zA-Z][^<>]*?\ssrcset="([^"]*)"/g)) {
    links.push(...match[1].split(',').map((part) => part.trim().split(/\s+/)[0]));
  }

  for (const raw of links) {
    // An absolute address on this site is checked like any other internal link.
    const link = OWN.test(raw) ? raw.replace(OWN, '') || '/' : raw;
    if (!link || /^(mailto:|tel:|data:|javascript:|blob:)/i.test(link)) continue;
    if (/^(https?:)?\/\//i.test(link)) {
      external.add(link);
      continue;
    }
    checked += 1;
    const url = new URL(link, `https://site.invalid${here}`);
    // Addresses served by the development image service do not exist in a build.
    if (url.pathname.startsWith('/_image')) continue;
    const file = fileFor(url.pathname);
    if (!file) {
      broken.push({ page: here, link, why: 'no such file' });
      continue;
    }
    const fragment = decodeURIComponent(url.hash.slice(1));
    // Fragments such as #work=raft are read by a script, not looked up as an id.
    if (fragment && !fragment.includes('=') && file.endsWith('.html') && !idsOf(file).has(fragment)) {
      broken.push({ page: here, link, why: `no element with id "${fragment}"` });
    }
  }
}

console.log(`\n  ${pages.length} pages, ${checked} internal links, ${external.size} external addresses`);
if (broken.length) {
  console.log(`\n  ${broken.length} broken:\n`);
  for (const item of broken) console.log(`    ${item.page}\n      ${item.link}  (${item.why})`);
  console.log('');
  process.exit(1);
}
console.log('  every internal link leads somewhere.\n');
