/**
 * THE ARCHIVE
 *
 * A hall with no far wall, drawn in one-point perspective with a rough pen. Cabinets line
 * both sides. Gates stand across it at increasing depth; each gate is one section of the
 * site. A small figure waits on the carpet. Going to a section sends the figure walking
 * and the camera after it.
 *
 * The scene is real geometry (metres, a camera, a focal length), so walking is a change of
 * one number, and the hall can go on for as long as anyone cares to walk.
 *
 * The hall is one place. It is drawn once, on one canvas, and stays while the pages of the
 * site come and go in front of it (see hall.ts).
 */
import {
  BAY,
  CARPET,
  DOOR_HALF,
  DOOR_ROUND,
  DOOR_TOP,
  EYE,
  FAR,
  GATE_DEPTH,
  HALF_WIDTH,
  HEIGHT,
  LEAD,
  NEAR,
} from './plan';
import { type P, fill, outline, rng, stroke, trace } from './rough';
import { drawFigure, FIGURE_HEIGHT } from './figure';
import { type Inks, type Stage, hasLadder, ladder, plate, wall } from './walls';

/**
 * How the view is framed. `room` fills a screen and is framed by its width;
 * `band` is a shallow strip and is framed by its height, so the next gate fits inside it.
 */
export type Mode = 'room' | 'band';

export interface Gate {
  /** depth of the gate along the hall, in metres */
  z: number;
  /** element that carries the gate's name; it is placed on the lintel */
  label?: HTMLElement | null;
}

export interface ArchiveOptions {
  gates: Gate[];
  /** where the camera stands */
  camera?: number;
  mode?: Mode;
  /**
   * Elements as tall as the part of the canvas the hall is seen through, one per mode.
   * Without them the hall is framed by the whole canvas.
   */
  openings?: Partial<Record<Mode, HTMLElement | null>>;
  /** draw the figure */
  figure?: boolean;
  /** called when the camera has moved */
  onMove?: (camera: number) => void;
}

export interface Archive {
  /** Walk from where the camera stands to the given position. A walk under way is taken over. */
  walk(to: number): Promise<void>;
  /** Move the camera without animation. */
  stand(at: number): void;
  /** Change the framing of the view. */
  frame(mode: Mode, animate?: boolean): void;
  /** Draw one gate in red (the one under the pointer), or none. */
  highlight(index: number | null): void;
  readonly camera: number;
  readonly mode: Mode;
  redraw(): void;
  destroy(): void;
}

interface View {
  focal: number;
  /** height of the vanishing point on the canvas, in px */
  cy: number;
}

interface Travel {
  from: number;
  to: number;
  start: number;
  duration: number;
  done: () => void;
}

const css = (el: Element, name: string, fallback: string) =>
  getComputedStyle(el).getPropertyValue(name).trim() || fallback;

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const mix = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** The same colour with no strength at all, for the far end of a gradient. */
const clear = (color: string) => (/^#[0-9a-f]{6}$/i.test(color) ? `${color}00` : 'rgba(255, 255, 255, 0)');

/** Segments to a rounded corner. */
const ARC = 7;

export function createArchive(canvas: HTMLCanvasElement, options: ArchiveOptions): Archive {
  const ctx = canvas.getContext('2d')!;
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
  const gates = options.gates;

  let inks: Inks = readInks();
  let mode: Mode = options.mode ?? 'room';
  let w = 1;
  let h = 1;
  let dpr = 1;
  let cx = 0;
  let view: View = { focal: 1000, cy: 400 };
  let reframe: { from: View; to: View; start: number; duration: number } | null = null;
  let camZ = options.camera ?? 0;
  let told = Number.NaN; // the camera position last reported
  let shiftX = 0; // sideways lean of the viewpoint, metres
  let shiftY = 0;
  let step = 0; // walking phase
  let travel: Travel | null = null;
  let facing: 'in' | 'out' = 'in';
  let lit: number | null = null;
  let raf = 0;
  let destroyed = false;

  function readInks(): Inks {
    return {
      paper: css(canvas, '--paper', '#f6f3ec'),
      bond: css(canvas, '--bond', '#fffefa'),
      ink: css(canvas, '--ink', '#15130f'),
      red: css(canvas, '--red', '#cf2a1d'),
      redDeep: css(canvas, '--red-deep', '#a81f15'),
      amber: css(canvas, '--amber', '#dfa126'),
      blue: css(canvas, '--blue', '#2f5fa3'),
      tan: css(canvas, '--tan', '#ece2cb'),
      kraft: css(canvas, '--kraft', '#d9c08f'),
    };
  }

  /* ---------- framing ---------- */

  function opening(of: Mode): number {
    const probe = options.openings?.[of];
    const tall = probe ? probe.getBoundingClientRect().height : 0;
    return tall > 1 ? Math.min(tall, h) : h;
  }

  function framing(of: Mode): View {
    const open = opening(of);
    // Wide screens are framed by width, tall ones by height, so the hall never looks pinched.
    return of === 'band'
      ? { focal: open * 1.3, cy: open * 0.46 }
      : { focal: Math.max(w * 0.72, open * 0.98), cy: open * 0.47 };
  }

  function measure() {
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, Math.round(rect.width));
    h = Math.max(1, Math.round(rect.height));
    dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    cx = w / 2;
    const target = framing(mode);
    if (reframe) reframe.to = target;
    else view = target;
  }

  /* ---------- projection ---------- */

  /** World point to screen point. Returns null when it is behind the viewer. */
  function project(x: number, y: number, z: number): P | null {
    const dz = z - camZ;
    if (dz < NEAR) return null;
    const s = view.focal / dz;
    return [cx + (x - shiftX) * s, view.cy - (y - EYE - shiftY) * s];
  }

  const scaleAt = (z: number) => view.focal / Math.max(NEAR, z - camZ);

  /** Lines thin out and fade as they recede: the far end of the hall dissolves into light. */
  function fade(z: number): number {
    const dz = z - camZ;
    const far = clamp(1 - (dz - 14) / 120, 0, 1);
    const near = clamp((dz - NEAR) / 3, 0, 1); // things slip out of sight as they pass the viewer
    return Math.pow(far, 1.7) * near;
  }

  const stage: Stage = {
    ctx,
    inks,
    w,
    h,
    camZ,
    font: css(canvas, '--f-machine', 'monospace'),
    project,
    scaleAt,
    fade,
  };

  /* ---------- pieces ---------- */

  function carpet() {
    const z0 = camZ + NEAR + 0.05;
    const a = project(-CARPET, 0, z0)!;
    const b = project(CARPET, 0, z0)!;
    const c = project(CARPET, 0, camZ + FAR)!;
    const d = project(-CARPET, 0, camZ + FAR)!;
    // The near edge is below the frame on any normal screen; clip to keep strokes sane.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    fill(ctx, [a, b, c, d], inks.red, 0.93);
    // Marker strokes along the length of the carpet, lighter and darker, so the fill is not flat.
    const r = rng(4242);
    const thick = view.focal / 1040;
    for (let i = 0; i < 26; i += 1) {
      const t = (i + 0.5) / 26 + (r() - 0.5) * 0.03;
      const x = -CARPET + t * CARPET * 2;
      const from = project(x, 0, z0)!;
      const to = project(x * (0.9 + r() * 0.1), 0, camZ + 60 + r() * 60)!;
      const light = r() < 0.42;
      stroke(ctx, from, to, 900 + i, {
        color: light ? inks.paper : inks.redDeep,
        alpha: light ? 0.1 + r() * 0.16 : 0.18 + r() * 0.2,
        width: Math.max(1, thick * (2 + r() * 5)),
        rough: 2.2,
        passes: 1,
      });
    }
    stroke(ctx, a, d, 11, { color: inks.redDeep, alpha: 0.8, width: 1.4, rough: 1.6 });
    stroke(ctx, b, c, 12, { color: inks.redDeep, alpha: 0.8, width: 1.4, rough: 1.6 });
    // A brass rod holds each edge down.
    for (const side of [-1, 1]) {
      const from = project(side * (CARPET + 0.16), 0, z0)!;
      const to = project(side * (CARPET + 0.16), 0, camZ + 90)!;
      stroke(ctx, from, to, 20 + side, {
        color: inks.amber,
        alpha: 0.95,
        width: Math.max(1, thick * 1.8),
        rough: 1.2,
        passes: 1,
      });
    }
    ctx.restore();
  }

  function bay(index: number) {
    const z = index * BAY;
    // The bay the viewer stands in has no rib in front of him, but its walls still run past.
    const behind = z - camZ < NEAR + 0.2;
    const zRef = behind ? camZ + NEAR + 0.2 : z;
    // The rib fades with its own distance; the walls of the bay with the distance of its middle,
    // so a bay does not dim and then jump back as the viewer walks into it.
    const ribAlpha = behind ? 0 : fade(z);
    const alpha = Math.max(ribAlpha, fade(Math.max(z + BAY / 2, camZ + NEAR + 3)));
    if (alpha <= 0.015) return;
    const s = scaleAt(behind ? camZ + 5 : z);
    const width = clamp(s / 70, 0.6, 1.5);
    const rough = clamp(s / 22, 0.5, 3.2);
    const pen = { color: inks.ink, alpha: alpha * 0.62, width, rough, over: behind ? 0 : clamp(s / 12, 0, 10) };
    const rib = { ...pen, alpha: ribAlpha * 0.62 };
    const seed = index * 1009;

    // The cabinets first: the ribs and rails of the hall are drawn over them.
    wall(stage, index, -1);
    wall(stage, index, 1);

    const fl = project(-HALF_WIDTH, 0, z);
    const fr = project(HALF_WIDTH, 0, z);
    const tl = project(-HALF_WIDTH, HEIGHT, z);
    const tr = project(HALF_WIDTH, HEIGHT, z);
    if (!behind && fl && fr && tl && tr) {
      // The rib of the hall at this bay: two posts and the beam across the ceiling.
      stroke(ctx, fl, tl, seed + 1, rib);
      stroke(ctx, fr, tr, seed + 2, rib);
      stroke(ctx, tl, tr, seed + 3, { ...rib, alpha: rib.alpha * 0.8 });
      // Floor seams, either side of the carpet only.
      const cl = project(-CARPET - 0.16, 0, z)!;
      const cr = project(CARPET + 0.16, 0, z)!;
      stroke(ctx, fl, cl, seed + 4, { ...rib, alpha: rib.alpha * 0.45, over: 0 });
      stroke(ctx, cr, fr, seed + 5, { ...rib, alpha: rib.alpha * 0.45, over: 0 });
    }

    const next = z + BAY;
    // Rails that run the length of the hall, drawn bay by bay so they fade with distance.
    for (const [x, y] of [
      [-HALF_WIDTH, 0],
      [HALF_WIDTH, 0],
      [-HALF_WIDTH, HEIGHT],
      [HALF_WIDTH, HEIGHT],
    ] as const) {
      const from = project(x, y, zRef);
      const to = project(x, y, next);
      if (from && to) stroke(ctx, from, to, seed + 20 + x + y, { ...pen, over: 0 });
    }

    // One lamp to a bay.
    const la = project(-0.9, HEIGHT, z + 1.9);
    const lb = project(0.9, HEIGHT, z + 1.9);
    const lc = project(0.9, HEIGHT, z + 4.1);
    const ld = project(-0.9, HEIGHT, z + 4.1);
    if (la && lb && lc && ld && z - camZ > 7) {
      fill(ctx, [la, lb, lc, ld], inks.bond, alpha);
      outline(ctx, [la, lb, lc, ld], seed + 200, { ...pen, alpha: pen.alpha * 0.75, over: clamp(s / 30, 0, 3) });
      // the two tubes in it
      for (const t of [0.34, 0.66]) {
        stroke(ctx, mix(la, lb, t), mix(ld, lc, t), seed + 210 + t * 10, {
          ...pen,
          alpha: pen.alpha * 0.5,
          width: width * 0.8,
          over: 0,
          passes: 1,
        });
      }
    }

    // What stands out from the wall is drawn last, over the wall behind it.
    plate(stage, index);
    if (hasLadder(index, -1)) ladder(stage, index, -1);
    if (hasLadder(index, 1)) ladder(stage, index, 1);
  }

  /** The outline of a gate's opening at depth z: up the left jamb, over, and down the right. */
  function doorway(z: number): P[] {
    const points: P[] = [];
    const add = (x: number, y: number) => points.push(project(x, y, z)!);
    const r = DOOR_ROUND;
    add(-DOOR_HALF, 0);
    for (let i = 0; i <= ARC; i += 1) {
      const a = Math.PI - (i / ARC) * (Math.PI / 2);
      add(-DOOR_HALF + r + Math.cos(a) * r, DOOR_TOP - r + Math.sin(a) * r);
    }
    for (let i = 0; i <= ARC; i += 1) {
      const a = Math.PI / 2 - (i / ARC) * (Math.PI / 2);
      add(DOOR_HALF - r + Math.cos(a) * r, DOOR_TOP - r + Math.sin(a) * r);
    }
    add(DOOR_HALF, 0);
    return points;
  }

  function gate(index: number) {
    const spec = gates[index];
    const z = spec.z;
    const dz = z - camZ;
    const label = spec.label;
    if (dz < NEAR + 0.4) {
      if (label) label.style.visibility = 'hidden';
      return;
    }
    const alpha = clamp(fade(z) * 1.35, 0, 1);
    const s = scaleAt(z);
    const width = clamp(s / 48, 0.8, 2);
    const pen = {
      color: lit === index ? inks.red : inks.ink,
      alpha,
      width: lit === index ? width * 1.25 : width,
      rough: clamp(s / 19, 0.7, 3.6),
      over: clamp(s / 7.5, 1, 18),
    };
    const seed = 50000 + index * 733;

    const A = project(-HALF_WIDTH, 0, z)!;
    const B = project(HALF_WIDTH, 0, z)!;
    const C = project(HALF_WIDTH, HEIGHT, z)!;
    const D = project(-HALF_WIDTH, HEIGHT, z)!;
    const d = project(-DOOR_HALF, DOOR_TOP, z)!;
    const front = doorway(z);
    // the back edge of the opening: the gate has thickness
    const back = doorway(z + GATE_DEPTH);
    const last = front.length - 1;

    // The wall of the gate hides what is behind it, except through the opening.
    ctx.save();
    ctx.fillStyle = inks.paper;
    ctx.beginPath();
    ctx.moveTo(A[0], A[1]);
    ctx.lineTo(B[0], B[1]);
    ctx.lineTo(C[0], C[1]);
    ctx.lineTo(D[0], D[1]);
    ctx.closePath();
    ctx.moveTo(front[0][0], front[0][1]);
    for (let i = 1; i <= last; i += 1) ctx.lineTo(front[i][0], front[i][1]);
    ctx.closePath();
    ctx.fill('evenodd');
    // Reveals of the opening.
    ctx.beginPath();
    ctx.moveTo(front[0][0], front[0][1]);
    for (let i = 1; i <= last; i += 1) ctx.lineTo(front[i][0], front[i][1]);
    for (let i = last; i >= 0; i -= 1) ctx.lineTo(back[i][0], back[i][1]);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // The underside of the lintel sits in shade, and the shade runs a little way down the curve.
    const hatchPen = {
      color: inks.ink,
      alpha: alpha * 0.34,
      width: clamp(s / 90, 0.6, 1.2),
      rough: 0.8,
      passes: 1,
    };
    const r = rng(seed + 300);
    for (let i = 3; i < last - 3; i += 1) {
      const length = Math.hypot(front[i + 1][0] - front[i][0], front[i + 1][1] - front[i][1]);
      const count = Math.max(1, Math.round(length / clamp(s / 9, 2.2, 8)));
      for (let k = 0; k < count; k += 1) {
        const t = (k + 0.5 + (r() - 0.5) * 0.6) / count;
        const from = mix(front[i], front[i + 1], t);
        const to = mix(back[i], back[i + 1], t);
        stroke(ctx, mix(from, to, -0.03 + r() * 0.06), mix(from, to, 0.95 + r() * 0.08), seed + 310 + i * 40 + k, hatchPen);
      }
    }

    stroke(ctx, B, C, seed + 1, pen);
    stroke(ctx, C, D, seed + 2, pen);
    stroke(ctx, D, A, seed + 3, pen);
    stroke(ctx, A, front[0], seed + 4, { ...pen, over: 0 });
    stroke(ctx, front[last], B, seed + 5, { ...pen, over: 0 });
    // jambs and head are ruled by hand, the corners turned in one movement
    const turn = { ...pen, rough: pen.rough * 0.5, over: 0 };
    stroke(ctx, front[0], front[1], seed + 10, { ...pen, over: pen.over * 0.4 });
    trace(ctx, front.slice(1, ARC + 2), seed + 11, turn);
    stroke(ctx, front[ARC + 1], front[ARC + 2], seed + 12, { ...pen, over: 0 });
    trace(ctx, front.slice(ARC + 2, last), seed + 13, turn);
    stroke(ctx, front[last - 1], front[last], seed + 14, { ...pen, over: pen.over * 0.4 });
    const thin = { ...pen, alpha: alpha * 0.7, width: width * 0.8, rough: pen.rough * 0.5, over: 0 };
    trace(ctx, back, seed + 20, thin);

    if (label) {
      // Nearer gates hide all of this wall except what shows through their openings. The link
      // is cut to that part, so a click on a nearer gate's pier never lands on a farther gate.
      let left = D[0];
      let right = C[0];
      let top = D[1];
      let floor = A[1];
      for (const other of gates) {
        if (other.z >= z || other.z - camZ <= NEAR + 0.4) continue;
        const corner = project(-DOOR_HALF, DOOR_TOP, other.z);
        const foot = project(DOOR_HALF, 0, other.z);
        if (!corner || !foot) continue;
        left = Math.max(left, corner[0]);
        top = Math.max(top, corner[1]);
        right = Math.min(right, foot[0]);
        floor = Math.min(floor, foot[1]);
      }
      const band = d[1] - top;
      const size = clamp(band * 0.4, 9, 46);
      const drawn = alpha > 0.06 && right > left && floor > top;
      // The gate stays a link for as long as it is drawn; only its name is dropped when the
      // strip of lintel left to write on is too thin to read.
      label.style.visibility = drawn ? 'visible' : 'hidden';
      label.style.zIndex = String(10 + index);
      label.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`;
      label.style.setProperty('--gate-w', `${Math.max(0, right - left).toFixed(1)}px`);
      label.style.setProperty('--gate-h', `${Math.max(0, floor - top).toFixed(1)}px`);
      label.style.setProperty('--band-h', `${Math.max(0, band).toFixed(1)}px`);
      label.style.setProperty('--gate-size', `${size.toFixed(2)}px`);
      label.style.setProperty('--gate-alpha', band > 14 ? clamp(alpha * 1.3, 0, 1).toFixed(3) : '0');
    }
  }

  function figure(z: number) {
    const feet = project(0, 0, z);
    if (!feet) return;
    const s = scaleAt(z);
    drawFigure(ctx, feet[0], feet[1], FIGURE_HEIGHT * s, travel ? step : -1, inks.ink, inks.paper, facing);
  }

  function glow() {
    const radius = clamp(view.focal * 0.18, 56, 220);
    const center = project(0, EYE, camZ + FAR)!;
    const gradient = ctx.createRadialGradient(center[0], center[1], 0, center[0], center[1], radius);
    gradient.addColorStop(0, inks.paper);
    gradient.addColorStop(0.35, inks.paper);
    // Fade to the paper colour itself: fading to transparent white would grey the rim in the dusk theme.
    gradient.addColorStop(1, clear(inks.paper));
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(center[0], center[1], radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ---------- a frame ---------- */

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    stage.inks = inks;
    stage.w = w;
    stage.h = h;
    stage.camZ = camZ;

    carpet();

    // Far to near, so nearer things cover farther ones.
    type Item = { z: number; run: () => void };
    const items: Item[] = [];
    const first = Math.floor(camZ / BAY);
    const last = Math.ceil((camZ + 130) / BAY);
    for (let i = first; i <= last; i += 1) items.push({ z: i * BAY + 0.001, run: () => bay(i) });
    gates.forEach((g, i) => items.push({ z: g.z, run: () => gate(i) }));
    const figureZ = camZ + LEAD;
    if (options.figure !== false) items.push({ z: figureZ, run: () => figure(figureZ) });
    items.sort((p, q) => q.z - p.z);

    let glowing = false;
    for (const item of items) {
      // The light at the end of the hall sits behind everything within about 60 metres.
      if (!glowing && item.z - camZ < 64) {
        glow();
        glowing = true;
      }
      item.run();
    }
    if (!glowing) glow();

    if (camZ !== told) {
      told = camZ;
      options.onMove?.(camZ);
    }
  }

  /** One frame of whatever is moving: the walk, the change of framing, or nothing. */
  function tick(now: number) {
    raf = 0;
    if (destroyed) return;
    let busy = false;
    if (travel) {
      const t = clamp((now - travel.start) / travel.duration, 0, 1);
      // Set off gently, keep a steady pace, slow down to a stand.
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      camZ = travel.from + (travel.to - travel.from) * eased;
      step = Math.max(0, now - travel.start) / 120;
      if (t < 1) busy = true;
      else {
        const arrived = travel;
        travel = null;
        facing = 'in';
        camZ = arrived.to;
        arrived.done();
      }
    }
    if (reframe) {
      const t = clamp((now - reframe.start) / reframe.duration, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      view = {
        focal: reframe.from.focal + (reframe.to.focal - reframe.from.focal) * eased,
        cy: reframe.from.cy + (reframe.to.cy - reframe.from.cy) * eased,
      };
      if (t < 1) busy = true;
      else reframe = null;
    }
    draw();
    if (busy) raf = requestAnimationFrame(tick);
  }

  function request() {
    if (!raf && !destroyed) raf = requestAnimationFrame(tick);
  }

  /* ---------- wiring ---------- */

  const resizeObserver = new ResizeObserver(() => {
    measure();
    draw();
  });
  resizeObserver.observe(canvas);
  for (const probe of Object.values(options.openings ?? {})) if (probe) resizeObserver.observe(probe);

  const onPointer = (event: PointerEvent) => {
    if (mode !== 'room' || calm.matches || travel || reframe || event.pointerType !== 'mouse') return;
    const rect = canvas.getBoundingClientRect();
    // A hall that has been scrolled out of sight need not follow anything.
    if (rect.bottom < 40) return;
    const nx = clamp((event.clientX - rect.left) / rect.width - 0.5, -0.5, 0.5);
    const ny = clamp((event.clientY - rect.top) / rect.height - 0.5, -0.5, 0.5);
    shiftX = nx * 0.9;
    shiftY = -ny * 0.5;
    request();
  };
  const onTheme = () => {
    inks = readInks();
    request();
  };
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('theme:change', onTheme);

  // The size of a device pixel changes when the page is zoomed or moved to another screen.
  let density: MediaQueryList | null = null;
  const onDensity = () => {
    density?.removeEventListener('change', onDensity);
    density = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    density.addEventListener('change', onDensity);
    measure();
    draw();
  };
  density = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  density.addEventListener('change', onDensity);

  measure();
  draw();
  document.fonts?.ready.then(() => request());

  return {
    walk(to) {
      // Whoever was waiting for the walk under way is told it is over: another has taken its place.
      travel?.done();
      travel = null;
      const distance = Math.abs(to - camZ);
      if (calm.matches || distance < 0.01) {
        camZ = to;
        facing = 'in';
        request();
        return Promise.resolve();
      }
      // Leaning with the pointer stops while walking.
      shiftX = 0;
      shiftY = 0;
      facing = to < camZ ? 'out' : 'in';
      return new Promise((resolve) => {
        travel = {
          from: camZ,
          to,
          start: performance.now(),
          duration: clamp(700 + distance * 22, 900, 1900),
          done: resolve,
        };
        request();
      });
    },
    stand(at) {
      travel?.done();
      travel = null;
      facing = 'in';
      camZ = at;
      request();
    },
    frame(next, animate = true) {
      mode = next;
      const target = framing(mode);
      if (!animate || calm.matches) {
        reframe = null;
        view = target;
      } else {
        shiftX = 0;
        shiftY = 0;
        reframe = { from: { ...view }, to: target, start: performance.now(), duration: 560 };
      }
      request();
    },
    highlight(index) {
      if (lit === index) return;
      lit = index;
      request();
    },
    get camera() {
      return camZ;
    },
    get mode() {
      return mode;
    },
    redraw: request,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      density?.removeEventListener('change', onDensity);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('theme:change', onTheme);
    },
  };
}
