/**
 * CLUSTERS
 * Layer-wise clustering of hidden states. Few clusters at the first and last layers, many
 * in the middle (a spindle). Representations flow from layer to layer, and clusters split
 * and merge along the way.
 */
import {
  type Bounds,
  type Frame,
  type Point,
  type Program,
  TAU,
  label,
  lerp,
  line,
  pen,
  pixelStroke,
  pointAt,
  polyLengths,
  rand,
  ring,
  smooth,
  ticks,
} from '../kit';

const LAYERS_SHOWN = 12;
const FLOWS = 6;
const SPEED = 0.15;
const RESHUFFLE_MS = 2500;

interface Flow {
  base: Point[];
  bold: boolean;
  t: number;
}

export default function clusters(): Program {
  let centers: Point[][] = [];
  let flows: Flow[] = [];
  let bounds: Bounds = { x0: 0, x1: 1, y0: 0, y1: 1 };
  let seed = 1;
  let shuffles = 0;
  let lastShuffle = 0;
  let splits = 0;
  let merges = 0;
  let unit = 1; // size of the clusters relative to a sheet of 560 x 340

  function nearest(layer: Point[], y: number): number {
    let best = 0;
    let bestDist = Infinity;
    for (let k = 0; k < layer.length; k += 1) {
      const dist = Math.abs(layer[k].y - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = k;
      }
    }
    return best;
  }

  function build(w: number, h: number) {
    const rng = rand(seed);
    unit = Math.min(1.1, Math.max(0.42, Math.min(w / 560, h / 340)));
    const mx = Math.max(36, w * 0.08);
    const top = Math.max(26, h * 0.12);
    const bottom = Math.max(40, h * 0.17);
    bounds = { x0: mx, x1: w - mx, y0: top, y1: h - bottom };
    const dx = (bounds.x1 - bounds.x0) / (LAYERS_SHOWN - 1);
    const span = bounds.y1 - bounds.y0;

    centers = [];
    splits = 0;
    merges = 0;
    for (let li = 0; li < LAYERS_SHOWN; li += 1) {
      const u = li / (LAYERS_SHOWN - 1);
      const spindle = Math.pow(Math.sin(u * Math.PI), 1.5);
      const count = Math.round(1 + spindle * 5);
      const x = bounds.x0 + li * dx;
      const layer: Point[] = [];
      if (count === 1) {
        const at = 0.3 + rng() * 0.4;
        layer.push({ x, y: lerp(bounds.y0, bounds.y1, at) + Math.sin(u * TAU * 0.7 + rng() * TAU) * 3 });
      } else if (count === 2) {
        const upper = 0.25 + rng() * 0.15;
        const lower = 0.6 + rng() * 0.15;
        layer.push(
          { x, y: lerp(bounds.y0, bounds.y1, upper) + Math.sin(u * TAU + 0.6 + rng() * Math.PI) * 4 },
          { x, y: lerp(bounds.y0, bounds.y1, lower) + Math.cos(u * TAU + 0.3 + rng() * Math.PI) * 4 },
        );
      } else {
        const margin = span * 0.12;
        const usable = span - 2 * margin;
        for (let k = 0; k < count; k += 1) {
          const baseY = bounds.y0 + margin + (k / (count - 1)) * usable;
          layer.push({ x, y: baseY + Math.sin(u * TAU + k * 0.8 + rng() * TAU) * 5 });
        }
      }
      if (li > 0) {
        const previous = centers[li - 1].length;
        if (count > previous) splits += count - previous;
        if (count < previous) merges += previous - count;
      }
      centers[li] = layer;
    }

    flows = [];
    for (let i = 0; i < FLOWS; i += 1) {
      const sequence = [Math.floor(rng() * centers[0].length)];
      for (let li = 1; li < LAYERS_SHOWN; li += 1) {
        const u = li / (LAYERS_SHOWN - 1);
        const switchChance = 0.15 + Math.sin(u * Math.PI) * 0.25;
        const from = centers[li - 1][Math.min(sequence[li - 1], centers[li - 1].length - 1)];
        let next = nearest(centers[li], from.y);
        if (rng() < switchChance && rng() >= 0.6) {
          const nearby: number[] = [];
          for (let k = 0; k < centers[li].length; k += 1) {
            if (Math.abs(centers[li][k].y - from.y) < span * 0.3) nearby.push(k);
          }
          if (nearby.length) next = nearby[Math.floor(rng() * nearby.length)];
        }
        sequence.push(next);
      }
      const pts: Point[] = [];
      const sub = 8;
      for (let li = 0; li < LAYERS_SHOWN - 1; li += 1) {
        const a = centers[li][Math.min(sequence[li], centers[li].length - 1)];
        const b = centers[li + 1][Math.min(sequence[li + 1], centers[li + 1].length - 1)];
        for (let s = 0; s < sub; s += 1) {
          const t = smooth(s / sub);
          pts.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
        }
      }
      const tail = centers[LAYERS_SHOWN - 1];
      pts.push({ ...tail[Math.min(sequence[LAYERS_SHOWN - 1], tail.length - 1)] });
      flows.push({ base: pts, bold: false, t: i / FLOWS });
    }
    shuffles = 0;
    lastShuffle = 0;
    reshuffle();
  }

  /** Decide again which flows are emphasised; always keep at least one of each kind. */
  function reshuffle() {
    const rng = rand(seed + shuffles * 1000 + 7);
    let bold = 0;
    flows.forEach((flow) => {
      flow.bold = rng() < 0.5;
      if (flow.bold) bold += 1;
    });
    if (bold === 0) flows[0].bold = true;
    if (bold === flows.length) flows[flows.length - 1].bold = false;
    shuffles += 1;
  }

  function warp(base: Point[], frame: Frame): Point[] {
    const { pointer, t, w, h, still } = frame;
    const sigma = Math.min(w, h) * 0.22;
    const out = new Array<Point>(base.length);
    for (let i = 0; i < base.length; i += 1) {
      let { x, y } = base[i];
      const n = still ? 0 : Math.sin(t * 0.001 + i * 0.18) * 0.9 + Math.cos(t * 0.0012 - i * 0.11) * 0.7;
      x += n;
      y -= n * 0.8;
      if (pointer.active) {
        const dx = x - pointer.x;
        const dy = y - pointer.y;
        const d2 = dx * dx + dy * dy;
        const g = Math.exp(-d2 / (sigma * sigma));
        const inv = 1 / (Math.sqrt(d2) + 0.001);
        x += dx * inv * g * 12;
        y += dy * inv * g * 12;
      }
      out[i] = { x, y };
    }
    return out;
  }

  function backdrop(frame: Frame) {
    const { ctx, palette, t, still } = frame;
    const span = bounds.y1 - bounds.y0;
    const reach = span * 0.5;

    // Possible transitions between neighbouring layers.
    for (let li = 0; li < centers.length - 1; li += 1) {
      for (const from of centers[li]) {
        const links = centers[li + 1]
          .map((to) => ({ to, dist: Math.abs(to.y - from.y) }))
          .filter((link) => link.dist < reach)
          .sort((a, b) => a.dist - b.dist)
          .slice(0, Math.max(1, Math.min(4, Math.floor(centers[li + 1].length * 0.7))));
        for (const link of links) {
          line(ctx, [from, link.to], {
            color: palette.soft,
            alpha: 0.32 * Math.max(0.3, 1 - link.dist / reach),
            width: 1,
          });
        }
      }
    }

    // Clusters: a dashed boundary with member points circling inside.
    const clock = still ? 0 : t * 0.001;
    for (let li = 0; li < centers.length; li += 1) {
      const u = li / (LAYERS_SHOWN - 1);
      const spindle = Math.sin(u * Math.PI);
      const count = centers[li].length;
      const radius = (count <= 2 ? 22 : count <= 4 ? 18 : 14) * (0.6 + spindle * 0.4) * unit;
      const members = Math.round((count <= 2 ? 24 : count <= 4 ? 16 : 10) * Math.max(0.5, unit));
      const orbit = ((count <= 2 ? 18 : count <= 4 ? 14 : 10) + spindle * 6) * unit;
      centers[li].forEach((center, k) => {
        ring(ctx, center, radius * 1.15, { fill: palette.ink, alpha: 0.045 });
        ring(ctx, center, radius * 1.15, { stroke: palette.ink, alpha: 0.4, width: 1, dash: [2, 3] });
        const spin = (k % 2 === 0 ? 0.6 : -0.6) * (1 + k * 0.1);
        ctx.save();
        ctx.fillStyle = palette.ink;
        ctx.globalAlpha = 0.5;
        for (let i = 0; i < members; i += 1) {
          const angle = (i / members) * TAU + clock * spin;
          const r = orbit * (0.28 + 0.75 * (0.5 + 0.5 * Math.sin(clock * 0.9 + i)));
          const size = count <= 2 ? 2 : 1.6;
          ctx.fillRect(
            Math.round(center.x + Math.cos(angle) * r - size / 2),
            Math.round(center.y + Math.sin(angle) * r - size / 2),
            Math.ceil(size),
            Math.ceil(size),
          );
        }
        ctx.restore();
      });
    }

    // On a narrow sheet there is room for every other caption only.
    const tight = (bounds.x1 - bounds.x0) / (LAYERS_SHOWN - 1) < 26;
    ticks(ctx, { x: bounds.x0, y: bounds.y1 + 22 }, { x: bounds.x1, y: bounds.y1 + 22 }, LAYERS_SHOWN - 1, palette, {
      captions: (i) => {
        const last = i === LAYERS_SHOWN - 1;
        if (tight) return i % 4 === 0 || last ? `L${String(i * 2 + 2).padStart(2, '0')}` : null;
        return i % 2 === 0 || last ? `L${String(i * 2 + 2).padStart(2, '0')}` : null;
      },
    });
    if (!tight) {
      label(ctx, 'DEPTH', { x: bounds.x1 + 4, y: bounds.y1 + 8 }, palette, { align: 'right', tracking: 2, size: 10 });
    }
    centers.forEach((layer, li) => {
      if (tight && li % 2 === 1) return;
      label(ctx, `k=${layer.length}`, { x: layer[0].x, y: bounds.y0 - 12 }, palette, { align: 'center', size: 10 });
    });
  }

  return {
    init(w, h, nextSeed) {
      seed = nextSeed;
      build(w, h);
    },

    draw(frame) {
      const { ctx, palette, dt, t, still } = frame;
      backdrop(frame);

      if (!still && t - lastShuffle > RESHUFFLE_MS) {
        lastShuffle = t;
        reshuffle();
      }

      flows.forEach((flow, i) => {
        const pts = warp(flow.base, frame);
        if (flow.bold) pixelStroke(ctx, pts, { color: palette.blue, alpha: 0.85, width: 1.8, seed: seed + i * 97 });
        else line(ctx, pts, { color: palette.soft, alpha: 0.55, width: 1.4 });
        if (still) return;
        flow.t += SPEED * dt;
        if (flow.t > 1) flow.t -= 1;
        pen(ctx, pointAt(pts, polyLengths(pts), flow.t), palette, flow.bold ? palette.blue : palette.ink, Math.max(2.2, 3.2 * unit));
      });
    },

    readout() {
      return `${LAYERS_SHOWN} LAYERS · ${splits} SPLITS · ${merges} MERGES · ${FLOWS} FLOWS`;
    },
  };
}
