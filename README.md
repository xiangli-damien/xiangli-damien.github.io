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
├── data/*.json             # Content: projects, pubs, posts (build.py); news (edit directly)
├── content/                # Content sources (YAML)
│   ├── profile.md          # About section
│   ├── projects.yaml       # Projects (short structured entries)
│   ├── publications.yaml   # Publications (abstract, bibtex)
│   ├── cv.yaml
│   └── demos.yaml
├── build.py                # Generates data/*.json from page folders
└── _config.yml             # Disable Jekyll
```

## Local Development

```bash
python -m http.server 8000
# Then visit http://localhost:8000
```

Or: `npx serve`

## Updating Content

**Option A — Edit JSON directly**: Modify files in `data/` and push. For news (short date+text+url items), edit `data/news.json` directly; no build needed.

**Option B — Use build system**: Edit `content/projects.yaml`, `content/publications.yaml`, or `blog/posts/*.md`, then:

```bash
pip install pyyaml
python build.py
```

Use `python build.py --watch` for auto-rebuild (requires `watchdog`).

## Deployment

Push to `xiangli-damien.github.io` on `main`. GitHub Pages serves it automatically.

## License

© Xiang Li. All rights reserved. 95% designed by Xiang Li, with reference to [nanjiang](https://www.nanjiangwill.com/).
