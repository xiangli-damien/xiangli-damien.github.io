/**
 * Queries and small formatters shared by the pages.
 */
import { getCollection, type CollectionEntry } from 'astro:content';

export type Note = CollectionEntry<'notes'>;
export type LifeEntry = CollectionEntry<'life'>;
export type Publication = CollectionEntry<'publications'>;
export type Project = CollectionEntry<'projects'>;
export type NewsItem = CollectionEntry<'news'>;
export type Channel = CollectionEntry<'board'>;

/** Drafts are visible while writing (`npm run dev`) and never published. */
const published = ({ data }: { data: { draft?: boolean } }) => import.meta.env.DEV || !data.draft;

const newestFirst = <T extends { data: { date: Date } }>(a: T, b: T) => b.data.date.getTime() - a.data.date.getTime();

export async function getNotes(): Promise<Note[]> {
  return (await getCollection('notes', published)).sort(newestFirst);
}

export async function getLife(): Promise<LifeEntry[]> {
  return (await getCollection('life', published)).sort(newestFirst);
}

export async function getPublications(): Promise<Publication[]> {
  return (await getCollection('publications')).sort(
    (a, b) => b.data.year - a.data.year || a.data.title.localeCompare(b.data.title),
  );
}

export async function getProjects(): Promise<Project[]> {
  return (await getCollection('projects')).sort(
    (a, b) => a.data.order - b.data.order || b.data.year - a.data.year || a.data.title.localeCompare(b.data.title),
  );
}

export async function getNews(): Promise<NewsItem[]> {
  return (await getCollection('news')).sort((a, b) => b.data.date.localeCompare(a.data.date));
}

export async function getChannels(): Promise<Channel[]> {
  return (await getCollection('board')).sort((a, b) => a.data.order - b.data.order);
}

/* ---------- notebook categories ---------- */

export const CATEGORIES = {
  course: { label: 'Course notes', zh: '课程笔记', code: 'CRS', blurb: 'Lecture by lecture, what each class taught.' },
  reading: { label: 'Reading notes', zh: '读书笔记', code: 'RDG', blurb: 'Books and reading lists, annotated.' },
  paper: { label: 'Paper notes', zh: '论文笔记', code: 'PPR', blurb: 'Papers read closely, one at a time.' },
  field: { label: 'Field notes', zh: '平时笔记', code: 'FLD', blurb: 'Working notes, experiments and loose thoughts.' },
} as const;

export type CategoryKey = keyof typeof CATEGORIES;
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as CategoryKey[];

export const LIFE_KINDS = {
  essay: { label: 'Essay', zh: '杂文' },
  photo: { label: 'Photographs', zh: '照片' },
  film: { label: 'Film', zh: '电影' },
  log: { label: 'Log', zh: '日志' },
} as const;

/* ---------- formatting ---------- */

const pad = (n: number) => String(n).padStart(2, '0');

/** 2025-03-09. Dates in front matter are calendar dates, so they are read in UTC. */
export const isoDate = (date: Date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

/** 2025/03/09, the form used on stamps and ledgers. */
export const stampDate = (date: Date) => isoDate(date).replace(/-/g, '/');

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** 09 MAR 2025 */
export const longDate = (date: Date) => `${pad(date.getUTCDate())} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;

/** News dates are written YYYY-MM or YYYY-MM-DD and shown as 2025/12. */
export const newsDate = (value: string) => value.replace(/-/g, '/');

/** Reading time in minutes: about 220 English words or 400 Chinese characters per minute. */
export function readingMinutes(body: string | undefined, declared?: number): number {
  if (declared) return declared;
  if (!body) return 1;
  const text = body.replace(/```[\s\S]*?```/g, ' ').replace(/[#>*_`~\[\]()!|-]/g, ' ');
  const cjk = (text.match(/[一-鿿]/g) || []).length;
  const words = (text.replace(/[一-鿿]/g, ' ').match(/\S+/g) || []).length;
  return Math.max(1, Math.round(words / 220 + cjk / 400));
}

/** Number of words (Latin) plus characters (Chinese), for status bars. */
export function wordCount(body: string | undefined): number {
  if (!body) return 0;
  const cjk = (body.match(/[一-鿿]/g) || []).length;
  const words = (body.replace(/[一-鿿]/g, ' ').match(/[A-Za-z0-9][\w'-]*/g) || []).length;
  return words + cjk;
}

/** A link that is empty or only points at a site's front page is treated as not set. */
export function realLink(href: string | undefined | null): href is string {
  if (!href) return false;
  const value = href.trim().replace(/\/+$/, '');
  if (!value) return false;
  return !/^https?:\/\/(www\.)?(github\.com|linkedin\.com|twitter\.com|x\.com|scholar\.google\.com)$/i.test(value);
}

/**
 * The halls of the archive. The entrance is where a visitor arrives; every other page is
 * a gate further down the corridor. `depth` is the distance of the gate from the entrance,
 * in metres; the order here is the order in which the gates stand. Depths are multiples of
 * six metres, the length of one bay, so that every gate stands on a rib of the hall.
 *
 * Gates stand at least twelve metres apart. In a hall the viewer stands ten and a half
 * metres before its gate (`standing` in src/scripts/archive/plan.ts); with the gates that
 * far apart the one before is already behind the viewer, and the cabinets of the hall are
 * seen on both sides instead of the blank piers of a gate. The gaps grow with the depth, so
 * that from the entrance each name can still be read through the gates in front of it.
 */
export const HALLS = {
  home: { no: '00', title: 'Entrance', href: '/', depth: 0 },
  pubs: { no: '01', title: 'Publications', href: '/pubs/', depth: 18 },
  blog: { no: '02', title: 'Notes', href: '/blog/', depth: 30 },
  projects: { no: '03', title: 'Projects', href: '/projects/', depth: 42 },
  life: { no: '04', title: 'Life', href: '/life/', depth: 60 },
  cv: { no: '05', title: 'CV', href: '/cv/', depth: 84 },
} as const;

export type HallKey = keyof typeof HALLS;

/** The gates, nearest first (everything except the entrance). */
export const GATES = (Object.keys(HALLS) as HallKey[]).filter((key) => key !== 'home').map((key) => ({ key, ...HALLS[key] }));

/** 09 MAR, for a row that stands under the heading of its year. */
export const dayMonth = (date: Date) => `${pad(date.getUTCDate())} ${MONTHS[date.getUTCMonth()]}`;

/* ---------- hall 04, life ---------- */

/** The languages an entry of hall 04 can be written in, each under its own name. */
export const LIFE_LANGUAGES = { en: 'English', zh: '中文' } as const;

/** An entry that is not finished says so: a draft, or a template standing in for a text to come. */
export const lifeFlag = ({ data }: LifeEntry): 'Draft' | 'Template' | '' =>
  data.draft ? 'Draft' : data.tags.includes('template') ? 'Template' : '';
