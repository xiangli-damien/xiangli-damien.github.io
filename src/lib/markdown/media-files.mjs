/**
 * Films, sound and animated pictures that sit next to a note.
 *
 * Astro prepares still pictures itself. It does not touch .mp4, .gif and the like, so
 * these are copied into public/media/_auto/, from where they are served as they are.
 * The copy is named after the place of the file in src/content, not after what is in it:
 * replacing a film by a newer take keeps its address and is picked up at once.
 *
 * Used by two parties: the Markdown plugin (remark-media.mjs), which needs the address,
 * and the integration below, which keeps the copies up to date.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';

export const VIDEO_EXT = new Set(['.mp4', '.webm', '.mov', '.m4v', '.ogv']);
export const AUDIO_EXT = new Set(['.mp3', '.wav', '.ogg', '.m4a']);
export const COPY_EXT = new Set([...VIDEO_EXT, ...AUDIO_EXT, '.gif']);

const CONTENT = resolve('src/content');
const PUBLIC = resolve('public');
const AUTO = 'media/_auto';

/** The name of the copy: the path inside src/content, with the folders folded into it. */
function nameOf(file) {
  const inside = relative(CONTENT, file);
  const path = inside.startsWith('..') ? relative(resolve('.'), file) : inside;
  return path.split(sep).join('__').replace(/\.\.__/g, '');
}

/** The address a file is served from. */
export function addressOf(file) {
  return `/${AUTO}/${encodeURIComponent(nameOf(file))}`;
}

/** Copy one file if the copy is missing or older. Returns its address, or null if there is no such file. */
export function publish(file) {
  if (!existsSync(file) || !statSync(file).isFile()) return null;
  const target = join(PUBLIC, AUTO, nameOf(file));
  const source = statSync(file);
  const copy = existsSync(target) ? statSync(target) : null;
  if (!copy || copy.size !== source.size || copy.mtimeMs < source.mtimeMs) {
    mkdirSync(join(PUBLIC, AUTO), { recursive: true });
    copyFileSync(file, target);
  }
  return addressOf(file);
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const wanted = (file) => COPY_EXT.has(extname(file).toLowerCase());

/** Bring public/media/_auto/ in line with src/content: copy what is new, drop what is gone. */
export function publishAll() {
  const sources = walk(CONTENT).filter(wanted);
  const names = new Set(sources.map(nameOf));
  const dir = join(PUBLIC, AUTO);
  if (existsSync(dir)) {
    for (const name of readdirSync(dir)) if (!names.has(name)) rmSync(join(dir, name), { force: true });
  }
  sources.forEach(publish);
  return sources.length;
}

/** Astro integration: keeps the copies current while writing and before every build. */
export function mediaFiles() {
  return {
    name: 'media-files',
    hooks: {
      'astro:config:setup': () => {
        publishAll();
      },
      'astro:server:setup': ({ server }) => {
        const onChange = (file) => {
          if (file.startsWith(CONTENT + sep) && wanted(file)) publish(file);
        };
        server.watcher.on('add', onChange);
        server.watcher.on('change', onChange);
      },
    },
  };
}
