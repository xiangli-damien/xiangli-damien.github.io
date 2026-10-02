# Xiang Li — Personal Website

Personal academic website with a Linux-inspired window manager home page and clean academic content pages.

## Features

- **Home**: Draggable windows with interactive Lens visualization, profile, and news
- **Publications**: Filterable academic list with abstract toggle and BibTeX copy
- **Projects**: Card grid with search, tag, and year filters
- **Blog**: Markdown-authored posts with clean reading layout
- **CV & More**: Structured CV with education, experience, honors, and skills
- **Fireworks**: Optional canvas particle background (toggle in Display → Windows)
- **Dark/Light Theme**: Toggle via dock
- **CRT Mode**: Green terminal aesthetic (FX button in dock)
- **Responsive**: Works on desktop and mobile

## Structure

```
/
├── index.html              # Home (window manager)
├── 404.html                # 404 page
├── blog/                   # Blog (one md per post)
│   ├── index.html
│   ├── post.html
│   └── posts/*.md          # Blog post sources (frontmatter + body)
├── pubs/index.html         # Publications page
├── projects/index.html     # Projects page
├── misc/index.html         # CV & More
├── assets/
│   ├── css/system.css      # All styles
│   └── js/                 # Modules (ES6)
│       ├── site.js         # Entry (dock, theme, fireworks)
│       ├── home.js         # Home page
│       ├── blog.js         # Blog
│       ├── pubs.js         # Publications
│       ├── projects.js     # Projects
│       ├── misc.js         # CV & More
│       ├── lens.js         # Interactive canvas visualization
│       ├── fireworks.js    # Particle background
│       ├── wm.js           # Window manager
│       ├── md.js           # Markdown parser
│       └── util.js         # Shared utilities
├── data/*.json             # Content: cv, news, posts, profile, projects, publications
├── serverless/             # Optional Cloudflare Worker (see serverless/README.md)
├── robots.txt
├── sitemap.xml
└── _config.yml             # Disable Jekyll
```

## Local Development

```bash
python -m http.server 8000
# Then visit http://localhost:8000
```

Or: `npx serve`

## Updating Content

Edit the JSON files in `data/` and push. Blog posts are Markdown files in `blog/posts/`, listed in `data/posts.json`.

## Deployment

Push to `xiangli-damien.github.io` on `main`. GitHub Pages serves it automatically.

## Redesign in progress

A redesign of the site is being worked on in the branch
[`redesign/archive`](https://github.com/xiangli-damien/xiangli-damien.github.io/tree/redesign/archive).
It is not published: the site online is still built from `main`.

## License

© Xiang Li. All rights reserved. 95% designed by Xiang Li, with reference to [nanjiang](https://www.nanjiangwill.com/).
