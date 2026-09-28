import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { profile } from '../lib/data';

export async function GET(context: APIContext) {
  const notes = (await getCollection('notes', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.date.getTime() - a.data.date.getTime(),
  );
  return rss({
    title: `${profile.name} - Notes`,
    description: 'Course notes, reading notes, paper notes and field notes.',
    site: context.site!,
    items: notes.map((note) => ({
      title: note.data.title,
      description: note.data.summary,
      pubDate: note.data.date,
      categories: [note.data.category, ...note.data.tags],
      link: `/blog/${note.id}/`,
    })),
  });
}
