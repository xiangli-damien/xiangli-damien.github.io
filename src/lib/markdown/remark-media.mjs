/**
 * remark-media
 *
 * Lets plain Markdown image syntax embed moving pictures:
 *
 *   ![A caption](./demo.mp4)                      -> <video> (file sits next to the .md file)
 *   ![A caption](/media/demo.webm)                -> <video> (file sits in public/media/)
 *   ![A caption](./loop.gif)                      -> animated GIF, left untouched by the image optimiser
 *   ![A talk](https://www.youtube.com/watch?v=ID) -> privacy-friendly YouTube embed
 *   ![A talk](https://www.bilibili.com/video/BV…) -> Bilibili embed
 *   ![A talk](https://vimeo.com/123456)           -> Vimeo embed
 *
 * A picture alone in its paragraph becomes a <figure> with a caption. A picture in the
 * middle of a sentence stays in the sentence, without a caption.
 *
 * Nodes are emitted as hast (data.hName / hChildren) rather than raw HTML so the same
 * plugin works in both .md and .mdx files.
 */
import { dirname, extname, resolve } from 'node:path';
import { SKIP, visit } from 'unist-util-visit';
import { AUDIO_EXT, COPY_EXT, VIDEO_EXT, publish } from './media-files.mjs';

const isRelative = (url) => !/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(url);
const cleanExt = (url) => extname(url.split(/[?#]/)[0]).toLowerCase();
const el = (tagName, properties = {}, children = []) => ({ type: 'element', tagName, properties, children });
const text = (value) => ({ type: 'text', value });

/** "1h2m3s", "2m", "95" -> seconds */
function seconds(value) {
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Number(value);
  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  return match ? Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0) : 0;
}

/**
 * The player address for a link to a video site, null for any other link.
 * A link to a known video site that cannot be understood is an error, not a broken picture.
 */
function embedUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(parsed.protocol)) return null;
  const host = parsed.hostname.replace(/^(www|m)\./, '');
  const query = parsed.searchParams;

  if (host === 'youtube.com' || host === 'youtu.be' || host === 'youtube-nocookie.com') {
    const id =
      host === 'youtu.be'
        ? parsed.pathname.slice(1).split('/')[0]
        : query.get('v') || (parsed.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]+)/) || [])[1];
    if (!id || !/^[\w-]{6,}$/.test(id)) throw new Error(`Cannot tell which YouTube video this is: ${url}`);
    const start = seconds(query.get('t') || query.get('start'));
    return { provider: 'YouTube', src: `https://www.youtube-nocookie.com/embed/${id}${start ? `?start=${start}` : ''}` };
  }
  if (host === 'bilibili.com') {
    const id = (parsed.pathname.match(/^\/video\/(BV\w+)/i) || [])[1];
    if (!id) throw new Error(`Cannot tell which Bilibili video this is: ${url}`);
    const part = /^\d+$/.test(query.get('p') || '') ? `&p=${query.get('p')}` : '';
    return { provider: 'Bilibili', src: `https://player.bilibili.com/player.html?bvid=${id}${part}&autoplay=0` };
  }
  if (host === 'b23.tv') {
    throw new Error(`Short Bilibili links cannot be embedded. Open ${url} and copy the full address (bilibili.com/video/BV...).`);
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = (parsed.pathname.match(/(\d{5,})/) || [])[1];
    if (!id) throw new Error(`Cannot tell which Vimeo video this is: ${url}`);
    return { provider: 'Vimeo', src: `https://player.vimeo.com/video/${id}` };
  }
  return null;
}

export default function remarkMedia() {
  /** File next to the note -> address of its published copy. */
  function local(sourceFile, url) {
    let clean = url.split(/[?#]/)[0];
    try {
      clean = decodeURIComponent(clean);
    } catch {
      /* a literal % in a file name: use the name as written */
    }
    return publish(resolve(dirname(sourceFile), clean));
  }

  /**
   * Returns a replacement mdast node for a media image, or null to leave the image alone.
   * `inline` media sit inside a sentence: they may only contain what a sentence may contain.
   */
  function convert(node, file, inline) {
    if (!node.url) return null;
    let url = node.url;
    const ext = cleanExt(url);
    const sourceFile = file?.path || file?.history?.[0];

    if (isRelative(url) && COPY_EXT.has(ext)) {
      const published = sourceFile ? local(sourceFile, url) : null;
      if (!published) {
        file?.message?.(`Media file not found: ${url}`, node);
        return null;
      }
      url = published;
    }

    const alt = node.alt || '';
    const caption = node.title || alt;
    let kind = null;
    let body = null;

    let embed = null;
    try {
      embed = embedUrl(url);
    } catch (error) {
      throw new Error(`${sourceFile || 'a note'}: ${error.message}`);
    }
    if (embed) {
      kind = 'embed';
      body = el(inline ? 'span' : 'div', { className: ['media-frame'] }, [
        el('iframe', {
          src: embed.src,
          title: caption || `${embed.provider} video`,
          loading: 'lazy',
          allowFullScreen: true,
          referrerPolicy: 'strict-origin-when-cross-origin',
          allow: 'accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen',
        }),
      ]);
    } else if (VIDEO_EXT.has(ext)) {
      kind = 'video';
      body = el('video', { src: url, controls: true, playsInline: true, preload: 'metadata', ariaLabel: alt || undefined });
    } else if (AUDIO_EXT.has(ext)) {
      kind = 'audio';
      body = el('audio', { src: url, controls: true, preload: 'metadata', ariaLabel: alt || undefined });
    } else if (ext === '.gif') {
      kind = 'gif';
      body = el('img', { src: url, alt, loading: 'lazy', decoding: 'async' });
    }
    if (!kind) return null;

    const children = [body];
    const captionText = kind === 'gif' ? node.title || '' : caption;
    if (!inline && captionText) children.push(el('figcaption', {}, [text(captionText)]));

    return {
      type: 'mediaFigure',
      data: {
        hName: inline ? 'span' : 'figure',
        hProperties: { className: ['media', `media-${kind}`] },
        hChildren: children,
      },
    };
  }

  return (tree, file) => {
    // A paragraph that holds nothing but media becomes one figure per item,
    // so a <figure> is never found inside a <p>.
    visit(tree, 'paragraph', (node, index, parent) => {
      if (!parent || index === undefined) return;
      const meaningful = node.children.filter(
        (child) => child.type !== 'break' && !(child.type === 'text' && !child.value.trim()),
      );
      if (!meaningful.length || !meaningful.every((child) => child.type === 'image')) return;
      const figures = meaningful.map((child) => convert(child, file, false));
      if (figures.some((figure) => !figure)) return;
      parent.children.splice(index, 1, ...figures);
      return [SKIP, index + figures.length];
    });

    // Media mixed into a line of text is swapped in place.
    visit(tree, 'image', (node, index, parent) => {
      if (!parent || index === undefined) return;
      const replacement = convert(node, file, true);
      if (!replacement) return;
      parent.children[index] = replacement;
      return [SKIP, index + 1];
    });
  };
}
