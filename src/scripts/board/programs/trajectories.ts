/**
 * TRAJECTORIES
 * Token x layer plane. Each line is one token's hidden state travelling up through the
 * layers of a language model. Most wander gently; the anomalous ones (drawn in the signal
 * colour) swing wide. The pen draws them one after another, then the sheet is replaced.
 */
import {
  type Bounds,
  type Frame,
  type Point,
  type Program,
  clamp,
  grid,
  label,
  lerp,
  partial,
  pen,
  pixelStroke,
  pointAt,
  polyLengths,
  rand,
  smooth,
  ticks,
} from '../kit';

const TOKENS = 7;
const LAYERS = 28;
const POINTS = 96;
const SPEED = 0.65; // fraction of a line per second
const HOLD = 2.2; // seconds to rest on the finished sheet
const ANOMALOUS = new Set([1, 3]);

interface Path {
  base: Point[];
  anomalous: boolean;
  baseX: number;
}

export default function trajectories(): Program {
  let paths: Path[] = [];
  let bounds: Bounds = { x0: 0, x1: 1, y0: 1, y1: 0 };
  let seed = 1;
  let width = 1;
  let height = 1;
  let index = 0;
  let progress = 0;
  let rest = 0;

  function build() {
    const rng = rand(seed);
    const mx = Math.max(44, width * 0.1);
    const top = Math.max(34, height * 0.13);
    const bottom = Math.max(34, height * 0.13);
    // y0 is layer 0 at the bottom of the sheet, y1 the last layer at the top.
    bounds = { x0: mx, x1: width - mx * 0.72, y0: height - bottom, y1: top };
    const dx = (bounds.x1 - bounds.x0) / (TOKENS - 1);
    paths = [];

    for (let t = 0; t < TOKENS; t += 1) {
      const baseX = bounds.x0 + t * dx;
      const anomalous = ANOMALOUS.has(t);
      const phase = rng() * Math.PI * 2;
      const skew = rng() < 0.5 ? -1 : 1;
      // The generator is advanced exactly as in the original drawing so seeds stay comparable.
      for (let i = 0; i < 7; i += 1) rng();
      const pts: Point[] = [];

      if (anomalous) {
        const phase2 = rng() * Math.PI * 2;
        const phase3 = rng() * Math.PI * 2;
        const amp = 12 + rng() * 18;
        const amp2 = 5 + rng() * 12;
        const amp3 = 3 + rng() * 8;
        const kinkAt1 = 0.35 + rng() * 0.15;
        const kinkAt2 = 0.65 + rng() * 0.15;
        const kinkDir1 = (rng() - 0.5) * 35;
        const kinkDir2 = (rng() - 0.5) * 28;
        for (let i = 0; i < POINTS; i += 1) {
          const u = i / (POINTS - 1);
          const grow = 0.25 + 0.75 * (u * u);
          const w1 = Math.sin(u * 2 * Math.PI * 1.8 + phase) * amp;
          const w2 = Math.cos(u * 2 * Math.PI * 4.2 + phase2 * 0.7) * amp2;
          const w3 = Math.sin(u * 2 * Math.PI * 7.5 + phase3 * 1.3) * amp3;
          const w4 = Math.cos(u * 2 * Math.PI * 11.3 + phase * 0.5) * (amp * 0.4);
          const jitter = (rng() - 0.5) * 4;
          let x = baseX + (w1 + w2 + w3 + w4) * grow * (0.75 + 0.25 * skew) + jitter;
          if (u > kinkAt1) x += kinkDir1 * smooth((u - kinkAt1) / (1 - kinkAt1)) * 0.6;
          if (u > kinkAt2) x += kinkDir2 * smooth((u - kinkAt2) / (1 - kinkAt2)) * 0.8;
          pts.push({ x, y: lerp(bounds.y0, bounds.y1, u) });
        }
      } else {
        const amp = 7 + rng() * 10;
        const amp2 = 2 + rng() * 6;
        // Late-layer signal concentration: a slight bend near the top.
        const kinkAt = 0.72 + rng() * 0.1;
        const kinkDir = (rng() - 0.5) * 18;
        for (let i = 0; i < POINTS; i += 1) {
          const u = i / (POINTS - 1);
          const grow = 0.35 + 0.65 * (u * u);
          const w1 = Math.sin(u * 2 * Math.PI * 1.25 + phase) * amp;
          const w2 = Math.cos(u * 2 * Math.PI * 3.15 + phase * 0.7) * amp2;
          let x = baseX + (w1 + w2) * grow * (0.85 + 0.15 * skew);
          if (u > kinkAt) x += kinkDir * smooth((u - kinkAt) / (1 - kinkAt));
          pts.push({ x, y: lerp(bounds.y0, bounds.y1, u) });
        }
      }
      paths.push({ base: pts, anomalous, baseX });
    }
    index = 0;
    progress = 0;
    rest = 0;
  }

  /** Slow breathing of the sheet plus a push away from the pointer, mostly sideways. */
  function warp(base: Point[], frame: Frame): Point[] {
    const { pointer, t, w, h, still } = frame;
    const sigma = Math.min(w, h) * 0.2;
    const out = new Array<Point>(base.length);
    for (let i = 0; i < base.length; i += 1) {
      const p = base[i];
      const n = still ? 0 : Math.sin(t * 0.001 + i * 0.15) * 0.9 + Math.cos(t * 0.0012 - i * 0.09) * 0.7;
      let x = p.x + n;
      let y = p.y - n * 0.2;
      if (pointer.active) {
        const dx = x - pointer.x;
        const dy = y - pointer.y;
        const d2 = dx * dx + dy * dy;
        const g = Math.exp(-d2 / (sigma * sigma));
        const inv = 1 / (Math.sqrt(d2) + 0.001);
        x += dx * inv * g * 12;
        y += dy * inv * g * 3;
      }
      out[i] = { x: clamp(x, bounds.x0 - 18, bounds.x1 + 18), y: clamp(y, bounds.y1 - 8, bounds.y0 + 8) };
    }
    return out;
  }

  function furniture(frame: Frame) {
    const { ctx, palette } = frame;
    grid(ctx, bounds, TOKENS - 1, 8, palette);
    ticks(ctx, { x: bounds.x0, y: bounds.y0 }, { x: bounds.x0, y: bounds.y1 }, 4, palette, {
      captions: (i) => String(Math.round((LAYERS / 4) * i)).padStart(2, '0'),
    });
    ticks(ctx, { x: bounds.x0, y: bounds.y0 }, { x: bounds.x1, y: bounds.y0 }, TOKENS - 1, palette, {
      captions: (i) => `T${i + 1}`,
    });
    label(ctx, 'LAYER', { x: bounds.x0 - 34, y: (bounds.y0 + bounds.y1) / 2 }, palette, {
      rotate: -Math.PI / 2,
      align: 'center',
      tracking: 2,
    });
    label(ctx, 'TOKEN', { x: (bounds.x0 + bounds.x1) / 2, y: bounds.y0 + 30 }, palette, { align: 'center', tracking: 2 });
  }

  return {
    init(w, h, nextSeed) {
      width = w;
      height = h;
      seed = nextSeed;
      build();
    },

    draw(frame) {
      const { ctx, palette, dt, still } = frame;

      if (still) {
        index = paths.length;
      } else if (index < paths.length) {
        progress += SPEED * dt;
        if (progress >= 1) {
          progress = 0;
          index += 1;
        }
      } else {
        rest += dt;
        if (rest > HOLD) {
          seed += 1;
          build();
        }
      }

      furniture(frame);

      for (let i = 0; i < paths.length; i += 1) {
        if (i > index) break;
        const path = paths[i];
        const warped = warp(path.base, frame);
        const drawing = i === index;
        const pts = drawing ? partial(warped, progress) : warped;
        // The line under the pen is blue; set down, it is grey if it held and red if it strayed.
        const color = path.anomalous ? palette.signal : drawing ? palette.blue : palette.soft;
        pixelStroke(ctx, pts, {
          color,
          alpha: drawing ? 0.9 : path.anomalous ? 0.5 : 0.45,
          seed: seed + i * 97,
        });
        if (drawing && progress > 0) {
          pen(ctx, pointAt(warped, polyLengths(warped), progress), palette, path.anomalous ? palette.signal : palette.blue);
        }
        if (!drawing && path.anomalous) {
          const end = warped[warped.length - 1];
          label(ctx, 'ANOMALY', { x: end.x, y: bounds.y1 - 14 }, palette, {
            color: palette.signal,
            align: 'center',
            size: 10,
            tracking: 1,
          });
        }
      }
    },

    readout() {
      if (index >= paths.length) return `${TOKENS} TOKENS TRACED · ${ANOMALOUS.size} ANOMALOUS`;
      const layer = Math.min(LAYERS, Math.round(progress * LAYERS));
      const flag = paths[index]?.anomalous ? ' · ANOMALY' : '';
      return `TOKEN ${index + 1}/${TOKENS} · LAYER ${String(layer).padStart(2, '0')}/${LAYERS}${flag}`;
    },
  };
}
