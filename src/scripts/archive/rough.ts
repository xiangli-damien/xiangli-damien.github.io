/**
 * Rough pen.
 *
 * Every line is drawn the way a person draws it: twice, slightly apart, a little bowed,
 * running past the corner it was aiming for. The unevenness comes from a seeded generator,
 * so a given line always wobbles the same way and the drawing does not shimmer.
 */

/** A number from 0 to 1 that depends on `n` alone, and shares nothing with its neighbours'. */
export function hash(n: number): number {
  let x = (Math.round(n) | 0) + 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export function rng(seed: number): () => number {
  // Seeds are small whole numbers, and a plain xorshift starts badly from those: stir first.
  let x = (Math.floor(hash(seed) * 4294967296) | 0) >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >> 17;
    x >>>= 0;
    x ^= x << 5;
    x >>>= 0;
    return (x >>> 0) / 4294967296;
  };
}

export interface PenOptions {
  /** stroke colour */
  color: string;
  /** 0..1 */
  alpha?: number;
  /** line width in px */
  width?: number;
  /** how far the hand strays, in px. 0 draws a ruled line. */
  rough?: number;
  /** how far the line runs past its end points, in px */
  over?: number;
  /** number of passes (1 or 2) */
  passes?: number;
}

export type P = [number, number];

/** One straight-ish stroke from a to b. */
export function stroke(ctx: CanvasRenderingContext2D, a: P, b: P, seed: number, options: PenOptions): void {
  const { color, alpha = 1, width = 1, rough = 1.2, over = 0, passes = 2 } = options;
  const r = rng(seed * 7919 + 13);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy);
  if (length < 0.5) return;
  const ux = dx / length;
  const uy = dy / length;
  // Short lines wobble less; long ones cannot wobble without limit.
  const amount = Math.min(rough, Math.max(0.25, length / 60) * rough);
  // Now and then the hand goes over a line a third time.
  const again = passes > 1 && length > 90 && r() < 0.22 ? 1 : 0;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let pass = 0; pass < passes + again; pass += 1) {
    const j = () => (r() - 0.5) * 2 * amount;
    const extra = over * (0.4 + r() * 0.8);
    const x0 = a[0] - ux * extra + j();
    const y0 = a[1] - uy * extra + j();
    const x1 = b[0] + ux * over * (0.4 + r() * 0.8) + j();
    const y1 = b[1] + uy * over * (0.4 + r() * 0.8) + j();
    // The hand bows the line sideways around the middle.
    const bow = (r() - 0.5) * 2 * amount * Math.min(2.2, length / 140 + 0.6);
    const m1 = 0.3 + r() * 0.12;
    const m2 = 0.62 + r() * 0.12;
    const c1x = x0 + (x1 - x0) * m1 - uy * bow + j() * 0.5;
    const c1y = y0 + (y1 - y0) * m1 + ux * bow + j() * 0.5;
    const c2x = x0 + (x1 - x0) * m2 - uy * bow * 0.7 + j() * 0.5;
    const c2y = y0 + (y1 - y0) * m2 + ux * bow * 0.7 + j() * 0.5;
    ctx.globalAlpha = alpha * (pass === 0 ? 1 : pass === 1 ? 0.62 : 0.4);
    // The pen does not press evenly.
    ctx.lineWidth = width * (pass === 0 ? 1 : 0.7 + r() * 0.5);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x1, y1);
    ctx.stroke();
  }
  ctx.restore();
}

/** A closed outline through the given corners. */
export function outline(ctx: CanvasRenderingContext2D, points: P[], seed: number, options: PenOptions): void {
  for (let i = 0; i < points.length; i += 1) {
    stroke(ctx, points[i], points[(i + 1) % points.length], seed + i * 101, options);
  }
}

/** An open run of strokes through the given points. */
export function path(ctx: CanvasRenderingContext2D, points: P[], seed: number, options: PenOptions): void {
  for (let i = 0; i < points.length - 1; i += 1) {
    stroke(ctx, points[i], points[i + 1], seed + i * 101, options);
  }
}

/** Flat fill of a polygon, used to let nearer surfaces hide farther ones. */
export function fill(ctx: CanvasRenderingContext2D, points: P[], color: string, alpha = 1): void {
  if (points.length < 3) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * A flat patch of colour that does not quite sit on its outline, the way a second printing
 * plate never quite registers with the first.
 */
export function wash(
  ctx: CanvasRenderingContext2D,
  points: P[],
  color: string,
  alpha: number,
  seed: number,
  slip = 1.2,
): void {
  const dx = (hash(seed * 3 + 1) - 0.5) * 2 * slip;
  const dy = (hash(seed * 3 + 2) - 0.5) * 2 * slip;
  fill(
    ctx,
    points.map(([x, y]) => [x + dx, y + dy] as P),
    color,
    alpha,
  );
}

/**
 * A run of short segments drawn as one line. For curves, where separate strokes would
 * bristle at every joint.
 */
export function trace(ctx: CanvasRenderingContext2D, points: P[], seed: number, options: PenOptions): void {
  const { color, alpha = 1, width = 1, rough = 1.2, passes = 2 } = options;
  if (points.length < 2) return;
  const r = rng(seed * 6007 + 3);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let pass = 0; pass < passes; pass += 1) {
    // The whole line strays a little as one, and each point a little more by itself.
    const ox = (r() - 0.5) * rough;
    const oy = (r() - 0.5) * rough;
    ctx.globalAlpha = alpha * (pass === 0 ? 1 : 0.6);
    ctx.lineWidth = width * (pass === 0 ? 1 : 0.7 + r() * 0.5);
    ctx.beginPath();
    for (let i = 0; i < points.length; i += 1) {
      const x = points[i][0] + ox + (r() - 0.5) * rough * 0.5;
      const y = points[i][1] + oy + (r() - 0.5) * rough * 0.5;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Hatching: parallel strokes laid across a four-sided patch, the way a marker fills an area.
 * `a -> b` and `d -> c` are the two edges the strokes run between.
 */
export function hatch(
  ctx: CanvasRenderingContext2D,
  a: P,
  b: P,
  c: P,
  d: P,
  count: number,
  seed: number,
  options: PenOptions,
): void {
  const r = rng(seed * 31 + 5);
  for (let i = 0; i < count; i += 1) {
    const t = (i + 0.5 + (r() - 0.5) * 0.7) / count;
    const from: P = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const to: P = [d[0] + (c[0] - d[0]) * t, d[1] + (c[1] - d[1]) * t];
    // Strokes start and stop a little short of, or past, the edge.
    const s0 = (r() - 0.35) * 0.05;
    const s1 = 1 + (r() - 0.65) * 0.05;
    const p0: P = [from[0] + (to[0] - from[0]) * s0, from[1] + (to[1] - from[1]) * s0];
    const p1: P = [from[0] + (to[0] - from[0]) * s1, from[1] + (to[1] - from[1]) * s1];
    stroke(ctx, p0, p1, seed + i * 17, { ...options, alpha: (options.alpha ?? 1) * (0.72 + r() * 0.28), passes: 1 });
  }
}
