/**
 * Drawing kit shared by every board program.
 *
 * Programs never pick colours or fonts themselves: they ask the palette, so the
 * whole board follows the site theme and every drawing looks like it came from
 * the same pen.
 *
 * A drawing is ink on paper. It tells things apart by line (solid, dashed, heavy, light),
 * by marker (square, ring, dot) and by position, and spends its red on the one thing the
 * viewer must not miss. Blue and amber are second voices: one of them, in one role, in a
 * drawing that has two kinds of thing to show. They are never decoration.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Palette {
  /** the sheet the pen draws on */
  paper: string;
  /** main line colour */
  ink: string;
  /** secondary lines, completed strokes */
  soft: string;
  /** grid and guides */
  faint: string;
  /** the one colour: the anomaly, the failure, the thing to look at */
  signal: string;
  /** a second voice: what is in motion, what is measured (the line under the pen, the days that came) */
  blue: string;
  /** a second voice: what is provisional or marks a threshold (live records, the commit line) */
  ochre: string;
  /** @deprecated the same as `soft` */
  green: string;
  /** font stack for labels drawn on the canvas */
  labelFont: string;
}

export interface Pointer extends Point {
  active: boolean;
}

export interface Frame {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  /** milliseconds since the program started */
  t: number;
  /** seconds since the previous frame (capped) */
  dt: number;
  pointer: Pointer;
  palette: Palette;
  /** true when the visitor prefers reduced motion: draw one settled, complete picture */
  still: boolean;
}

export interface Program {
  /** Build geometry for a canvas of w x h CSS pixels. Called again on resize. */
  init(w: number, h: number, seed: number): void;
  /** Draw one frame. The canvas has already been cleared to paper. */
  draw(frame: Frame): void;
  /** Optional short machine read-out shown under the drawing, e.g. "LAYER 17/28". */
  readout?(): string;
}

export type ProgramFactory = () => Program;

/* ---------- numbers ---------- */

/** Deterministic xorshift32 generator: same seed, same drawing. */
export function rand(seed: number): () => number {
  // Small seeds (1, 2, 3 ...) are scrambled first; fed in raw, the first numbers they
  // produce are all close to zero and close to each other.
  let x = Math.imul((seed ^ 0x9e3779b9) >>> 0, 0x85ebca6b) >>> 0 || 1;
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

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
export const smooth = (u: number) => u * u * (3 - 2 * u);
export const snap = (v: number, step: number) => Math.round(v / step) * step;
export const TAU = Math.PI * 2;

/* ---------- polylines ---------- */

export interface Lengths {
  seg: number[];
  total: number;
}

export function polyLengths(pts: Point[]): Lengths {
  const seg = new Array<number>(Math.max(0, pts.length - 1));
  let total = 0;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    seg[i] = l;
    total += l;
  }
  return { seg, total: Math.max(1e-6, total) };
}

/** Point at fraction t01 (0..1) of the way along a polyline. */
export function pointAt(pts: Point[], lengths: Lengths, t01: number): Point {
  const target = clamp(t01, 0, 1) * lengths.total;
  let acc = 0;
  for (let i = 0; i < lengths.seg.length; i += 1) {
    const l = lengths.seg[i];
    if (acc + l >= target) {
      const r = (target - acc) / (l || 1);
      return {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * r,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * r,
      };
    }
    acc += l;
  }
  const last = pts[pts.length - 1];
  return { x: last.x, y: last.y };
}

/** The first `t01` fraction of a polyline, ending exactly at the pen position. */
export function partial(pts: Point[], t01: number): Point[] {
  if (pts.length < 2) return pts.slice();
  const lengths = polyLengths(pts);
  const target = clamp(t01, 0, 1) * lengths.total;
  const out: Point[] = [pts[0]];
  let acc = 0;
  for (let i = 0; i < lengths.seg.length; i += 1) {
    const l = lengths.seg[i];
    if (acc + l >= target) {
      const r = (target - acc) / (l || 1);
      out.push({
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * r,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * r,
      });
      return out;
    }
    out.push(pts[i + 1]);
    acc += l;
  }
  return out;
}

/** Push points away from the pointer, as if the sheet were nudged. */
export function perturb(pts: Point[], pointer: Pointer, reach: number, push: number, pushY = push): Point[] {
  if (!pointer.active) return pts;
  const out = new Array<Point>(pts.length);
  for (let i = 0; i < pts.length; i += 1) {
    const dx = pts[i].x - pointer.x;
    const dy = pts[i].y - pointer.y;
    const d2 = dx * dx + dy * dy;
    const g = Math.exp(-d2 / (reach * reach));
    const inv = 1 / (Math.sqrt(d2) + 0.001);
    out[i] = { x: pts[i].x + dx * inv * g * push, y: pts[i].y + dy * inv * g * pushY };
  }
  return out;
}

/* ---------- strokes ---------- */

export interface StrokeOptions {
  color: string;
  alpha?: number;
  width?: number;
  /** seed for the hand jitter, keep it stable per line so it does not shimmer */
  seed?: number;
}

/**
 * The signature line of the site: a polyline snapped to a coarse pixel grid with a
 * little deterministic jitter and square ink blots, as if drawn by a stepping motor.
 */
export function pixelStroke(ctx: CanvasRenderingContext2D, pts: Point[], options: StrokeOptions): void {
  if (pts.length < 2) return;
  const { color, alpha = 1, width = 2.4, seed = 1 } = options;
  const pixel = width >= 2.2 ? 2.5 : 2;
  const jitter = width >= 2.2 ? 4.2 : 3.5;
  const every = width >= 2.2 ? 3 : 5;

  const rough = new Array<Point>(pts.length);
  for (let j = 0; j < pts.length; j += 1) {
    const r = rand((seed + j * 31) >>> 0);
    rough[j] = {
      x: snap(pts[j].x + (r() - 0.5) * jitter, pixel),
      y: snap(pts[j].y + (r() - 0.5) * jitter, pixel),
    };
  }

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'square';
  ctx.lineJoin = 'miter';
  ctx.lineWidth = width;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.moveTo(rough[0].x, rough[0].y);
  for (let j = 1; j < rough.length; j += 1) ctx.lineTo(rough[j].x, rough[j].y);
  ctx.stroke();

  for (let j = 0; j < rough.length; j += every) {
    const r = rand((seed + 2000 + j * 17) >>> 0);
    const size = pixel * (0.7 + r() * 0.7);
    ctx.globalAlpha = alpha * (0.4 + r() * 0.35);
    ctx.fillRect(Math.round(rough[j].x - size / 2), Math.round(rough[j].y - size / 2), Math.round(size), Math.round(size));
  }
  ctx.restore();
}

/** A plain ruled line, for guides and secondary strokes. */
export function line(ctx: CanvasRenderingContext2D, pts: Point[], options: StrokeOptions & { dash?: number[] }): void {
  if (pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = options.color;
  ctx.globalAlpha = options.alpha ?? 1;
  ctx.lineWidth = options.width ?? 1;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (options.dash) ctx.setLineDash(options.dash);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let j = 1; j < pts.length; j += 1) ctx.lineTo(pts[j].x, pts[j].y);
  ctx.stroke();
  ctx.restore();
}

/** The travelling pen head: a solid dot inside a soft ring. */
export function pen(ctx: CanvasRenderingContext2D, at: Point, palette: Palette, color = palette.ink, radius = 3.6): void {
  ctx.save();
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.2;
  ctx.arc(at.x, at.y, radius * 2.8, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = palette.ink;
  ctx.globalAlpha = 0.95;
  ctx.arc(at.x, at.y, radius, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** A square node marker snapped to whole pixels. */
export function block(
  ctx: CanvasRenderingContext2D,
  at: Point,
  size: number,
  options: { fill?: string; stroke?: string; alpha?: number; width?: number },
): void {
  const x = Math.round(at.x - size / 2);
  const y = Math.round(at.y - size / 2);
  const s = Math.round(size);
  ctx.save();
  ctx.globalAlpha = options.alpha ?? 1;
  if (options.fill) {
    ctx.fillStyle = options.fill;
    ctx.fillRect(x, y, s, s);
  }
  if (options.stroke) {
    ctx.strokeStyle = options.stroke;
    ctx.lineWidth = options.width ?? 1.5;
    ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
  }
  ctx.restore();
}

export function ring(
  ctx: CanvasRenderingContext2D,
  at: Point,
  radius: number,
  options: { fill?: string; stroke?: string; alpha?: number; width?: number; dash?: number[] },
): void {
  ctx.save();
  ctx.globalAlpha = options.alpha ?? 1;
  ctx.beginPath();
  ctx.arc(at.x, at.y, Math.max(0.1, radius), 0, TAU);
  if (options.fill) {
    ctx.fillStyle = options.fill;
    ctx.fill();
  }
  if (options.stroke) {
    ctx.strokeStyle = options.stroke;
    ctx.lineWidth = options.width ?? 1;
    if (options.dash) ctx.setLineDash(options.dash);
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------- lettering ---------- */

export interface LabelOptions {
  color?: string;
  alpha?: number;
  size?: number;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  /** rotate the text by this many radians around its anchor */
  rotate?: number;
  /** letter-spacing in px */
  tracking?: number;
}

/** Small technical lettering. Text is upper-cased by convention at the call site. */
export function label(ctx: CanvasRenderingContext2D, text: string, at: Point, palette: Palette, options: LabelOptions = {}): void {
  ctx.save();
  ctx.fillStyle = options.color ?? palette.soft;
  ctx.globalAlpha = options.alpha ?? 1;
  ctx.font = `${options.size ?? 11}px ${palette.labelFont}`;
  ctx.textAlign = options.align ?? 'left';
  ctx.textBaseline = options.baseline ?? 'middle';
  if (options.tracking !== undefined && 'letterSpacing' in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${options.tracking}px`;
  }
  ctx.translate(Math.round(at.x), Math.round(at.y));
  if (options.rotate) ctx.rotate(options.rotate);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/* ---------- sheet furniture ---------- */

export interface Bounds {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Ruled guide lines across a rectangle. */
export function grid(
  ctx: CanvasRenderingContext2D,
  bounds: Bounds,
  cols: number,
  rows: number,
  palette: Palette,
  alpha = 1,
): void {
  const { x0, x1, y0, y1 } = bounds;
  ctx.save();
  ctx.strokeStyle = palette.faint;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= rows; i += 1) {
    const y = Math.round(lerp(y0, y1, i / rows)) + 0.5;
    ctx.moveTo(Math.min(x0, x1), y);
    ctx.lineTo(Math.max(x0, x1), y);
  }
  for (let i = 0; i <= cols; i += 1) {
    const x = Math.round(lerp(x0, x1, cols <= 0 ? 0 : i / cols)) + 0.5;
    ctx.moveTo(x, Math.min(y0, y1));
    ctx.lineTo(x, Math.max(y0, y1));
  }
  ctx.stroke();
  ctx.restore();
}

/** Short tick marks along one edge of a rectangle, with optional captions. */
export function ticks(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  count: number,
  palette: Palette,
  options: { length?: number; captions?: (index: number) => string | null; side?: 1 | -1; size?: number } = {},
): void {
  const length = options.length ?? 5;
  const side = options.side ?? 1;
  const horizontal = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y);
  ctx.save();
  ctx.strokeStyle = palette.soft;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= count; i += 1) {
    const x = Math.round(lerp(from.x, to.x, i / count)) + 0.5;
    const y = Math.round(lerp(from.y, to.y, i / count)) + 0.5;
    ctx.moveTo(x, y);
    if (horizontal) ctx.lineTo(x, y + length * side);
    else ctx.lineTo(x - length * side, y);
  }
  ctx.stroke();
  ctx.restore();
  if (!options.captions) return;
  for (let i = 0; i <= count; i += 1) {
    const caption = options.captions(i);
    if (!caption) continue;
    const x = lerp(from.x, to.x, i / count);
    const y = lerp(from.y, to.y, i / count);
    if (horizontal) {
      label(ctx, caption, { x, y: y + (length + 8) * side }, palette, { align: 'center', size: options.size ?? 10 });
    } else {
      label(ctx, caption, { x: x - (length + 5) * side, y }, palette, {
        align: side === 1 ? 'right' : 'left',
        size: options.size ?? 10,
      });
    }
  }
}

/** Registration crosses in the corners, as on a printed proof. */
export function registration(ctx: CanvasRenderingContext2D, w: number, h: number, palette: Palette, inset = 10): void {
  const arm = 5;
  ctx.save();
  ctx.strokeStyle = palette.soft;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const [cx, cy] of [
    [inset, inset],
    [w - inset, inset],
    [inset, h - inset],
    [w - inset, h - inset],
  ]) {
    const x = Math.round(cx) + 0.5;
    const y = Math.round(cy) + 0.5;
    ctx.moveTo(x - arm, y);
    ctx.lineTo(x + arm, y);
    ctx.moveTo(x, y - arm);
    ctx.lineTo(x, y + arm);
  }
  ctx.stroke();
  ctx.restore();
}
