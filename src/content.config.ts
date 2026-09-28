import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';
import { parse as parseYaml } from 'yaml';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The address of an entry is its file name, without folders or extension:
 *   reading/reading-list.md        -> reading-list
 *   paper/attention/index.md       -> attention   (a folder that keeps its media beside the text)
 *
 * Two files that would get the same address stop the build: otherwise one of them would
 * silently vanish from the site.
 */
function addresses(collection: string) {
  const taken = new Map<string, string>();
  return ({ entry, base }: { entry: string; base: URL }) => {
    const parts = entry.replace(/\.(md|mdx)$/i, '').split('/');
    const last = parts.pop()!;
    const id = last === 'index' && parts.length ? parts.pop()! : last;
    const before = taken.get(id);
    if (before && before !== entry && existsSync(fileURLToPath(new URL(before, base)))) {
      throw new Error(
        `Two entries of "${collection}" share the address "${id}": ${before} and ${entry}. Rename one of the files.`,
      );
    }
    taken.set(id, entry);
    return id;
  };
}

/**
 * A calendar date, written YYYY-MM-DD. Anything else is refused: an empty value would
 * otherwise become 1 January 1970, and other spellings are read in the local time zone,
 * which can move the date by a day between the owner's machine and the build server.
 */
const calendarDate = z
  .union([z.date(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Write the date as YYYY-MM-DD')])
  .pipe(z.coerce.date());

const optionalUrl = z.string().optional().default('');

/** Categories of the public notebook. The folder name under src/content/notes/ should match. */
export const NOTE_CATEGORIES = ['course', 'reading', 'paper', 'field'] as const;

const notes = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/notes', generateId: addresses('notes') }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      summary: z.string().optional().default(''),
      date: calendarDate,
      updated: calendarDate.optional(),
      category: z.enum(NOTE_CATEGORIES).default('field'),
      tags: z.array(z.string()).default([]),
      lang: z.enum(['en', 'zh']).default('en'),
      cover: image().optional(),
      coverAlt: z.string().optional().default(''),
      readingMinutes: z.number().optional(),
      draft: z.boolean().default(false),
    }),
});

const life = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/life', generateId: addresses('life') }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      listTitle: z.string().optional(),
      summary: z.string().optional().default(''),
      date: calendarDate,
      kind: z.enum(['essay', 'photo', 'film', 'log']).default('essay'),
      lang: z.enum(['en', 'zh']).default('en'),
      tags: z.array(z.string()).default([]),
      cover: image().optional(),
      coverAlt: z.string().optional().default(''),
      note: z.string().optional(),
      draft: z.boolean().default(false),
    }),
});

const publications = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/publications', generateId: addresses('publications') }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      authors: z.array(z.string()),
      venue: z.string(),
      year: z.number(),
      type: z.enum(['conference', 'journal', 'workshop', 'preprint', 'thesis']).default('conference'),
      status: z.string().optional(),
      links: z
        .object({ url: optionalUrl, pdf: optionalUrl, doi: optionalUrl, code: optionalUrl })
        .default({ url: '', pdf: '', doi: '', code: '' }),
      figure: image().optional(),
      figureAlt: z.string().optional().default(''),
      abstract: z.string().optional().default(''),
      bibtex: z.string().optional().default(''),
    }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects', generateId: addresses('projects') }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      year: z.number(),
      featured: z.boolean().default(false),
      order: z.number().default(99),
      tags: z.array(z.string()).default([]),
      figure: image().optional(),
      figureAlt: z.string().optional().default(''),
      links: z
        .object({ code: optionalUrl, paper: optionalUrl, demo: optionalUrl })
        .default({ code: '', paper: '', demo: '' }),
    }),
});

const news = defineCollection({
  loader: file('src/data/news.yaml', {
    parser: (text) =>
      (parseYaml(text) as Record<string, unknown>[]).map((item, index) => ({
        id: `${String(item.date)}-${index}`,
        ...item,
        date: String(item.date),
      })),
  }),
  schema: z.object({
    date: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, 'Use YYYY-MM or YYYY-MM-DD'),
    text: z.string(),
    url: z.string().optional(),
    tag: z.string().optional(),
  }),
});

const board = defineCollection({
  loader: file('src/data/board.yaml', {
    parser: (text) =>
      (parseYaml(text) as Record<string, unknown>[]).map((item, index) => ({ ...item, order: index })),
  }),
  schema: z.object({
    id: z.string(),
    order: z.number(),
    kind: z.enum(['research', 'project', 'publication']),
    title: z.string(),
    short: z.string(),
    year: z.string(),
    question: z.string().optional(),
    blurb: z.string(),
    program: z.string(),
    href: z.string().optional(),
    links: z.array(z.object({ label: z.string(), href: z.string() })).default([]),
  }),
});

export const collections = { notes, life, publications, projects, news, board };
