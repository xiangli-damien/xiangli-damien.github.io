# Xiang Li - Personal Website

Personal academic website showcasing research, publications, projects, and blog posts.

## Features

- **Linux-inspired UI**: Draggable windows with a floating dock navigation
- **Interactive Lens Visualization**: Trajectory and cluster visualizations for model internals research
- **Dark/Light Theme**: Toggle between themes
- **Visual Effects**: Clean and CRT green terminal modes
- **Responsive Design**: Works on desktop and mobile devices

## Structure

- `index.html` - Home page
- `blog/` - Blog posts (Markdown)
- `pubs/` - Publications
- `projects/` - Projects showcase
- `misc/` - CV and other content
- `data/` - JSON data files for content
- `assets/` - CSS, JavaScript, images, and media

## Local Development

Simply open `index.html` in a browser or use a local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve
```

Then visit `http://localhost:8000`

## Deployment

This site is designed to work on GitHub Pages without a build step. Simply push to the repository and enable GitHub Pages in settings.

## License

© Xiang Li. All rights reserved.

95% designed by Xiang Li, with reference to [nanjiang](https://www.nanjiangwill.com/).
