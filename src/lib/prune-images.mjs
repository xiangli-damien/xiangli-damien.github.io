/**
 * After a build, remove pictures that no page refers to.
 *
 * Every picture in src/assets is copied into dist/_astro at full size, even when the pages
 * only ever show a smaller version made from it. Originals that nothing links to (the
 * portraits are two megabytes each) would be uploaded on every deploy for no one to see.
 */
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PICTURE = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.svg']);
const TEXT = new Set(['.html', '.css', '.js', '.mjs', '.xml', '.json', '.txt']);

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

export function pruneImages() {
  return {
    name: 'prune-images',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const dist = fileURLToPath(dir);
        const assets = join(dist, '_astro');
        if (!existsSync(assets)) return;
        const pages = walk(dist)
          .filter((file) => TEXT.has(extname(file).toLowerCase()))
          .map((file) => readFileSync(file, 'utf8'))
          .join('\n');
        let removed = 0;
        let bytes = 0;
        for (const name of readdirSync(assets)) {
          if (!PICTURE.has(extname(name).toLowerCase())) continue;
          // A file is in use when its name, plain or percent-encoded, appears anywhere in the site.
          if (pages.includes(name) || pages.includes(encodeURIComponent(name))) continue;
          const file = join(assets, name);
          bytes += statSync(file).size;
          rmSync(file);
          removed += 1;
        }
        if (removed) logger.info(`removed ${removed} unused pictures (${(bytes / 1e6).toFixed(1)} MB)`);
      },
    },
  };
}
