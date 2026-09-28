import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import { createCssVariablesTheme } from 'shiki';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkMedia from './src/lib/markdown/remark-media.mjs';
import rehypeFigure from './src/lib/markdown/rehype-figure.mjs';
import { mediaFiles } from './src/lib/markdown/media-files.mjs';
import { pruneImages } from './src/lib/prune-images.mjs';

// Code is coloured with the site's own inks (see --code-* in src/styles/tokens.css)
// instead of a ready-made editor theme.
const inkTheme = createCssVariablesTheme({
  name: 'ink',
  variablePrefix: '--code-',
  variableDefaults: {},
  fontStyle: true,
});

export default defineConfig({
  site: 'https://xiangli-damien.github.io',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  integrations: [
    mediaFiles(),
    mdx(),
    sitemap({ filter: (page) => !page.includes('/lab/') && !page.endsWith('/404/') }),
    pruneImages(),
  ],
  markdown: {
    shikiConfig: { theme: inkTheme, wrap: false },
    processor: unified({
      remarkPlugins: [remarkMath, remarkMedia],
      rehypePlugins: [rehypeKatex, rehypeFigure],
    }),
  },
});
