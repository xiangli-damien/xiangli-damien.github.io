/**
 * Zoom rectangles: a few outlined boxes that travel from one rectangle to another,
 * the way early desktops showed a window opening out of its icon.
 */
interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

const STEPS = 5;
const DURATION = 260;

export function zoomRects(from: RectLike, to: RectLike): Promise<void> {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
  const layer = document.createElement('div');
  layer.className = 'zoomrects';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);

  const frames: HTMLElement[] = [];
  for (let i = 0; i < STEPS; i += 1) {
    const frame = document.createElement('i');
    layer.append(frame);
    frames.push(frame);
  }

  const ease = (t: number) => 1 - Math.pow(1 - t, 3);
  const start = performance.now();

  return new Promise((resolve) => {
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / DURATION);
      frames.forEach((frame, index) => {
        // Each rectangle trails the one before it.
        const local = Math.max(0, Math.min(1, progress * 1.5 - index * 0.11));
        const t = ease(local);
        const left = from.left + (to.left - from.left) * t;
        const topPx = from.top + (to.top - from.top) * t;
        const width = from.width + (to.width - from.width) * t;
        const height = from.height + (to.height - from.height) * t;
        frame.style.transform = `translate(${Math.round(left)}px, ${Math.round(topPx)}px)`;
        frame.style.width = `${Math.max(2, Math.round(width))}px`;
        frame.style.height = `${Math.max(2, Math.round(height))}px`;
        frame.style.opacity = local <= 0 || local >= 1 ? '0' : '1';
      });
      if (progress < 1) requestAnimationFrame(tick);
      else {
        layer.remove();
        resolve();
      }
    }
    requestAnimationFrame(tick);
  });
}
