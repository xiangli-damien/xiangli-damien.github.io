/**
 * rehype-figure
 *
 * A paragraph that holds nothing but an image with a title becomes a captioned figure:
 *
 *   ![Alt text](./plot.png "Figure 1. The caption.")
 */
import { visit } from 'unist-util-visit';

const isBlank = (node) => node.type === 'text' && !node.value.trim();

export default function rehypeFigure() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'p') return;
      const children = node.children.filter((child) => !isBlank(child));
      if (children.length !== 1) return;
      const img = children[0];
      if (img.type !== 'element' || img.tagName !== 'img') return;
      const title = img.properties?.title;
      if (!title) return;
      delete img.properties.title;
      node.tagName = 'figure';
      node.properties = { className: ['media', 'media-image'] };
      node.children = [
        img,
        { type: 'element', tagName: 'figcaption', properties: {}, children: [{ type: 'text', value: String(title) }] },
      ];
    });
  };
}
