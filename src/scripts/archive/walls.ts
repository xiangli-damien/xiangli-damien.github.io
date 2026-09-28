/**
 * THE WALLS
 *
 * Cabinets from the floor to the cornice, along both sides of the hall and for as long as
 * the hall goes on. Most bays are drawers, each with a card in its holder and a pull under
 * it; some are open shelves of binders and boxes. Here and there a drawer has been left
 * pulled out, a ladder leans on its rail, and a plate gives the distance from the entrance.
 *
 * The architecture is ink on white. What colour there is belongs to the things on file:
 * a card, a spine, the tab of a folder.
 *
 * How much is drawn depends on how far away it is. Near bays are drawn in full; farther on
 * a drawer is a dash; at the far end only the shelves remain, as lines.
 */
import { BAY, CABINET_TOP, CELL, COLUMNS, EYE, HALF_WIDTH, HEIGHT, NEAR, PLINTH, POST, RAIL, ROW, ROWS } from './plan';
import { type P, hash, rng, stroke } from './rough';

export interface Inks {
  paper: string;
  bond: string;
  ink: string;
  red: string;
  redDeep: string;
  amber: string;
  blue: string;
  /** the cabinets */
  tan: string;
  /** folders and boxes */
  kraft: string;
}

/** What a part of the drawing needs to know about the picture it is drawn into. */
export interface Stage {
  ctx: CanvasRenderingContext2D;
  inks: Inks;
  w: number;
  h: number;
  camZ: number;
  /** family of the face used for plates */
  font: string;
  project(x: number, y: number, z: number): P | null;
  scaleAt(z: number): number;
  fade(z: number): number;
}

type Side = -1 | 1;
type At = (z: number, y: number) => P;

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const mix = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/* ---------- small marks, drawn straight: at this size a wobble would not show ---------- */

function patch(ctx: CanvasRenderingContext2D, points: P[], color: string, alpha: number) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fill();
}

function edge(
  ctx: CanvasRenderingContext2D,
  points: P[],
  color: string,
  alpha: number,
  width: number,
  closed = false,
) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
  if (closed) ctx.closePath();
  ctx.stroke();
}

/** The colour of the card in a drawer's holder. Most cards are white; an empty holder has none. */
function cardInk(inks: Inks, n: number): string | null {
  if (n < 0.68) return inks.bond;
  if (n < 0.76) return inks.amber;
  if (n < 0.81) return inks.blue;
  if (n < 0.85) return inks.red;
  if (n < 0.93) return inks.kraft;
  return null;
}

function spineInk(inks: Inks, n: number): string {
  if (n < 0.5) return inks.bond;
  if (n < 0.78) return inks.kraft;
  if (n < 0.85) return inks.amber;
  if (n < 0.9) return inks.blue;
  if (n < 0.95) return inks.red;
  return inks.ink;
}

/** Whether a bay holds drawers or open shelves. */
function shelved(index: number, side: Side): boolean {
  return hash(index * 7 + (side > 0 ? 3 : 1)) < 0.3;
}

/* ---------- one drawer ---------- */

function drawer(stage: Stage, at: At, c0: number, c1: number, y0: number, id: number, strength: number) {
  const { ctx, inks } = stage;
  const span = c1 - c0;
  // The holder is never quite in the middle of its drawer.
  const lean = (hash(id * 5 + 1) - 0.5) * 0.05;
  const a = at(c0 + span * (0.3 + lean), y0 + 0.43);
  const b = at(c0 + span * (0.7 + lean), y0 + 0.43);
  const c = at(c0 + span * (0.7 + lean), y0 + 0.64);
  const d = at(c0 + span * (0.3 + lean), y0 + 0.64);
  const tall = Math.abs(d[1] - a[1]);
  const card = cardInk(inks, hash(id));

  if (card) {
    patch(ctx, [a, b, c, d], card, strength * 0.95);
    // What is typed on the card: a line or two, legible only as lines.
    if (tall > 9 && card !== inks.blue && card !== inks.red) {
      const lines = tall > 15 ? 2 : 1;
      for (let i = 0; i < lines; i += 1) {
        const t = lines === 1 ? 0.5 : 0.34 + i * 0.34;
        const from = mix(mix(a, d, t), mix(b, c, t), 0.14);
        const to = mix(mix(a, d, t), mix(b, c, t), 0.5 + hash(id * 3 + i) * 0.36);
        edge(ctx, [from, to], inks.ink, strength * 0.55, clamp(tall / 16, 0.5, 1.1));
      }
    }
  }
  edge(ctx, [a, b, c, d], inks.ink, strength * (card ? 0.72 : 0.4), clamp(tall / 18, 0.45, 1), true);

  // the pull
  const p0 = at(c0 + span * 0.4, y0 + 0.23);
  const p1 = at(c0 + span * 0.6, y0 + 0.23);
  edge(ctx, [p0, p1], inks.ink, strength * 0.8, clamp(tall / 5.5, 0.8, 3.2));
}

/* ---------- one compartment of a shelf ---------- */

function shelf(stage: Stage, at: At, c0: number, c1: number, y0: number, id: number, strength: number) {
  const { ctx, inks } = stage;
  // It is darker inside a shelf than on the face of a drawer.
  patch(ctx, [at(c0, y0), at(c1, y0), at(c1, y0 + ROW), at(c0, y0 + ROW)], inks.ink, strength * 0.07);

  const r = rng(id);
  const boxes = r() < 0.34;
  const base = y0 + 0.03;
  const end = c1 - 0.06;
  let z = c0 + 0.06;
  while (z < end - 0.08) {
    // a gap where something has been taken out
    if (r() < 0.09) {
      z += 0.12 + r() * 0.34;
      continue;
    }
    const wide = boxes ? 0.36 + r() * 0.08 : 0.08 + r() * 0.17;
    const tall = boxes ? 0.6 : 0.42 + r() * 0.3;
    const ze = Math.min(end, z + wide);
    const color = boxes ? (r() < 0.78 ? inks.kraft : inks.bond) : spineInk(inks, r());
    const a = at(z, base);
    const b = at(ze, base);
    const c = at(ze, base + tall);
    const d = at(z, base + tall);
    const size = Math.abs(d[1] - a[1]);
    patch(ctx, [a, b, c, d], color, strength * 0.95);
    edge(ctx, [a, d, c, b], inks.ink, strength * 0.6, clamp(size / 40, 0.4, 0.9));
    if (boxes) {
      // a label and a finger hole
      const l0 = mix(mix(a, d, 0.5), mix(b, c, 0.5), 0.2);
      const l1 = mix(mix(a, d, 0.5), mix(b, c, 0.5), 0.8);
      const l2 = mix(mix(a, d, 0.82), mix(b, c, 0.82), 0.8);
      const l3 = mix(mix(a, d, 0.82), mix(b, c, 0.82), 0.2);
      patch(ctx, [l0, l1, l2, l3], cardInk(inks, r()) ?? inks.bond, strength * 0.95);
      edge(ctx, [l0, l1, l2, l3], inks.ink, strength * 0.5, clamp(size / 50, 0.4, 0.8), true);
      const hole = mix(mix(a, d, 0.26), mix(b, c, 0.26), 0.5);
      ctx.globalAlpha = strength * 0.7;
      ctx.fillStyle = inks.ink;
      ctx.beginPath();
      ctx.arc(hole[0], hole[1], clamp(size / 22, 0.6, 2.4), 0, Math.PI * 2);
      ctx.fill();
    } else if (size > 26 && color !== inks.ink && r() < 0.6) {
      // a band across the spine, where the title goes
      const t0 = mix(a, d, 0.58);
      const t1 = mix(b, c, 0.58);
      const t2 = mix(b, c, 0.74);
      const t3 = mix(a, d, 0.74);
      edge(ctx, [t0, t1, t2, t3], inks.ink, strength * 0.45, 0.6, true);
    }
    z = ze + 0.014;
  }
}

/* ---------- a drawer left pulled out ---------- */

function pulled(stage: Stage, side: Side, c0: number, c1: number, y0: number, id: number, strength: number) {
  const { ctx, inks } = stage;
  const wallX = side * HALF_WIDTH;
  const outX = side * (HALF_WIDTH - 0.8 - hash(id * 11) * 0.35);
  const zn = c0 + 0.05;
  const zf = c1 - 0.05;
  const lo = y0 + 0.05;
  const hi = y0 + ROW - 0.06;
  const p = (x: number, y: number, z: number) => stage.project(x, y, z);
  const corners = [
    p(wallX, lo, zn),
    p(outX, lo, zn),
    p(outX, hi, zn),
    p(wallX, hi, zn),
    p(outX, lo, zf),
    p(outX, hi, zf),
    p(wallX, hi, zf),
  ];
  if (corners.some((corner) => !corner)) return;
  const [n0, n1, n2, n3, f1, f2, f3] = corners as P[];
  const size = Math.abs(n2[1] - n1[1]);
  const thin = clamp(size / 46, 0.5, 1.2);

  // the inside, seen from above
  patch(ctx, [n3, n2, f2, f3], inks.ink, strength * 0.2);

  // folders standing in it, from the wall outwards, each with its tab
  const tabs = [inks.amber, inks.bond, inks.red, inks.kraft, inks.blue, inks.bond];
  const count = 6;
  for (let k = 0; k < count; k += 1) {
    const x = wallX + (outX - wallX) * (0.16 + (k / count) * 0.74);
    const rise = 0.13 + hash(id * 17 + k) * 0.07;
    const a = p(x, hi - 0.04, zn + 0.07);
    const b = p(x, hi - 0.04, zf - 0.07);
    const c = p(x, hi + rise, zf - 0.07);
    const d = p(x, hi + rise, zn + 0.07);
    if (!a || !b || !c || !d) continue;
    patch(ctx, [a, b, c, d], inks.kraft, strength);
    edge(ctx, [a, d, c, b], inks.ink, strength * 0.6, thin * 0.7);
    const from = 0.08 + ((k * 3) % 5) * 0.16;
    const t0 = mix(d, c, from);
    const t1 = mix(d, c, from + 0.24);
    const lift = (d[1] - a[1]) * 0.75;
    const tab: P[] = [t0, t1, [t1[0], t1[1] + lift], [t0[0], t0[1] + lift]];
    patch(ctx, tab, tabs[(k + Math.floor(hash(id) * 6)) % tabs.length], strength);
    edge(ctx, [t0, tab[3], tab[2], t1], inks.ink, strength * 0.6, thin * 0.7);
  }

  // the side that faces the viewer, then the front
  patch(ctx, [n0, n1, n2, n3], inks.bond, strength);
  edge(ctx, [n0, n1, n2, n3], inks.ink, strength * 0.8, thin, true);
  patch(ctx, [n1, f1, f2, n2], inks.bond, strength);
  edge(ctx, [n1, f1, f2, n2], inks.ink, strength * 0.85, thin, true);

  // holder and pull, on the front
  const on = (u: number, v: number) => mix(mix(n1, n2, v), mix(f1, f2, v), u);
  const holder = [on(0.3, 0.5), on(0.7, 0.5), on(0.7, 0.78), on(0.3, 0.78)];
  const card = cardInk(inks, hash(id));
  if (card) patch(ctx, holder, card, strength * 0.95);
  edge(ctx, holder, inks.ink, strength * 0.7, thin * 0.8, true);
  edge(ctx, [on(0.4, 0.25), on(0.6, 0.25)], inks.ink, strength * 0.8, clamp(size / 24, 0.8, 3.2));
}

/* ---------- a bay of the wall ---------- */

export function wall(stage: Stage, index: number, side: Side): void {
  const { ctx, inks, camZ, w } = stage;
  const z0 = index * BAY;
  const z1 = z0 + BAY;
  const nearest = camZ + NEAR + 0.2;
  if (z1 <= nearest + 0.05) return;
  const x = side * HALF_WIDTH;

  // The wall runs outwards as it comes nearer: if its far end is outside the picture, all of it is.
  const farEnd = stage.project(x, EYE, z1);
  if (!farEnd || (side > 0 ? farEnd[0] > w + 60 : farEnd[0] < -60)) return;

  const strength = stage.fade(Math.max(z0 + BAY / 2, camZ + NEAR + 3));
  if (strength <= 0.015) return;

  const distance = Math.max(z0, nearest) - camZ;
  const detail = distance < 30 ? 2 : distance < 64 ? 1 : 0;
  const s = stage.scaleAt(Math.max(z0, camZ + 5));
  const width = clamp(s / 70, 0.6, 1.5);
  const rough = clamp(s / 22, 0.5, 3.2);
  const seed = index * 1009 + (side > 0 ? 500 : 0);
  const at: At = (z, y) => stage.project(x, y, Math.max(z, nearest))!;
  const pen = { color: inks.ink, alpha: strength * 0.6, width, rough, over: 0 };
  const shelves = shelved(index, side);
  const za = z0 + POST;
  const zb = z1 - POST;

  ctx.save();

  // the body of the cabinets: one pale wash, with the pilasters left white
  patch(
    ctx,
    [at(za, PLINTH), at(zb, PLINTH), at(zb, CABINET_TOP), at(za, CABINET_TOP)],
    inks.tan,
    strength * (shelves ? 0.5 : 0.62),
  );

  // plinth, shelves, cornice
  for (let r = 0; r <= ROWS; r += 1) {
    if (detail === 0 && r % 2 === 1) continue;
    const y = PLINTH + r * ROW;
    const outer = r === 0 || r === ROWS;
    stroke(ctx, at(za, y), at(zb, y), seed + 40 + r, {
      ...pen,
      alpha: pen.alpha * (outer ? 0.9 : 0.5),
      width: width * (outer ? 1 : 0.8),
      passes: outer ? 2 : 1,
    });
  }

  if (detail > 0) {
    // the rail the ladders run on
    stroke(ctx, at(z0, RAIL), at(z1, RAIL), seed + 60, { ...pen, alpha: pen.alpha * 0.55, passes: 1 });
    // pilasters, and the uprights between the columns
    for (let c = 0; c <= COLUMNS; c += 1) {
      const z = za + c * CELL;
      if (z <= nearest) continue;
      const outer = c === 0 || c === COLUMNS;
      stroke(ctx, at(z, outer ? 0 : PLINTH), at(z, outer ? HEIGHT : CABINET_TOP), seed + 70 + c, {
        ...pen,
        alpha: pen.alpha * (outer ? 0.55 : 0.42),
        width: width * 0.8,
        passes: 1,
      });
    }
  }

  if (detail === 2) {
    const open: { c0: number; c1: number; y0: number; id: number; held: number }[] = [];
    for (let c = 0; c < COLUMNS; c += 1) {
      const c0 = za + c * CELL;
      const c1 = c0 + CELL;
      if (c0 < nearest) continue;
      const inner = stage.project(x, EYE, c1);
      if (!inner || (side > 0 ? inner[0] > w + 40 : inner[0] < -40)) continue;
      // What is about to pass the viewer is let go of gradually: the eye belongs in the middle.
      const held = strength * clamp((c0 - camZ - 2.5) / 6, 0, 1);
      if (held < 0.02) continue;
      for (let r = 0; r < ROWS; r += 1) {
        const y0 = PLINTH + r * ROW;
        const id = seed * 131 + c * 17 + r;
        if (shelves) shelf(stage, at, c0, c1, y0, id, held);
        else if (r >= 1 && r <= 4 && hash(id * 3 + 7) < 0.05) open.push({ c0, c1, y0, id, held });
        else drawer(stage, at, c0, c1, y0, id, held);
      }
    }
    // the farthest first, so that a nearer one stands in front of it
    open.sort((p, q) => q.c0 - p.c0 || p.y0 - q.y0);
    for (const item of open) {
      // the hole it came out of
      patch(
        ctx,
        [at(item.c0, item.y0), at(item.c1, item.y0), at(item.c1, item.y0 + ROW), at(item.c0, item.y0 + ROW)],
        inks.ink,
        item.held * 0.22,
      );
      pulled(stage, side, item.c0, item.c1, item.y0, item.id, item.held);
    }
  } else if (detail === 1) {
    for (let c = 0; c < COLUMNS; c += 1) {
      const c0 = za + c * CELL;
      if (c0 < nearest) continue;
      for (let r = 0; r < ROWS; r += 1) {
        const y0 = PLINTH + r * ROW;
        const id = seed * 131 + c * 17 + r;
        if (shelves) {
          // a few spines stand for the rest
          for (let k = 0; k < 4; k += 1) {
            const z = c0 + CELL * (0.14 + k * 0.22 + hash(id * 7 + k) * 0.08);
            const tall = 0.4 + hash(id * 9 + k) * 0.3;
            const tone = hash(id * 13 + k);
            const color = tone < 0.78 ? inks.ink : spineInk(inks, (tone - 0.78) / 0.22);
            edge(ctx, [at(z, y0 + 0.04), at(z, y0 + tall)], color, strength * (tone < 0.78 ? 0.4 : 0.8), width * 1.2);
          }
        } else {
          const card = cardInk(inks, hash(id));
          const plain = !card || card === inks.bond || card === inks.kraft;
          edge(
            ctx,
            [at(c0 + CELL * 0.3, y0 + 0.52), at(c0 + CELL * 0.7, y0 + 0.52)],
            plain ? inks.ink : card,
            strength * (plain ? 0.5 : 0.9),
            width * (plain ? 1.3 : 1.7),
          );
        }
      }
    }
  }

  ctx.restore();
}

/* ---------- things that stand out from the wall ---------- */

/** A plate that stands out from the wall above the cabinets and gives the distance walked. */
export function plate(stage: Stage, index: number): void {
  const { ctx, inks } = stage;
  const side: Side = index % 2 === 0 ? -1 : 1;
  const z = index * BAY + BAY / 2;
  if (z - stage.camZ < NEAR + 2) return;
  const strength = stage.fade(z);
  const a = stage.project(side * HALF_WIDTH, 9.52, z);
  const b = stage.project(side * (HALF_WIDTH - 1.3), 8.88, z);
  if (!a || !b || strength < 0.12) return;
  const left = Math.min(a[0], b[0]);
  const right = Math.max(a[0], b[0]);
  const top = a[1];
  const bottom = b[1];
  const tall = bottom - top;
  if (tall < 4 || right < -20 || left > stage.w + 20) return;

  ctx.save();
  const corners: P[] = [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom],
  ];
  patch(ctx, corners, inks.bond, strength);
  ctx.globalAlpha = 1;
  const pen = { color: inks.ink, alpha: strength * 0.85, width: clamp(tall / 26, 0.6, 1.4), rough: clamp(tall / 30, 0.3, 1.4) };
  for (let i = 0; i < 4; i += 1) {
    stroke(ctx, corners[i], corners[(i + 1) % 4], index * 311 + i, { ...pen, over: clamp(tall / 12, 0, 4) });
  }
  if (tall >= 9) {
    ctx.globalAlpha = strength;
    ctx.fillStyle = inks.ink;
    ctx.font = `${(tall * 0.58).toFixed(1)}px ${stage.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(Math.round(z)).padStart(3, '0'), (left + right) / 2, (top + bottom) / 2 + tall * 0.04);
  } else {
    edge(ctx, [[left + (right - left) * 0.25, (top + bottom) / 2], [right - (right - left) * 0.25, (top + bottom) / 2]], inks.ink, strength * 0.7, 1);
  }
  ctx.restore();
}

/** Whether a ladder leans on this side of this bay. */
export function hasLadder(index: number, side: Side): boolean {
  return index > 0 && hash(index * 53 + (side > 0 ? 9 : 4)) < 0.24;
}

export function ladder(stage: Stage, index: number, side: Side): void {
  const { ctx, inks } = stage;
  const z = index * BAY + 1.6 + hash(index * 77 + side) * 2;
  if (z - stage.camZ < NEAR + 1.5) return;
  const strength = stage.fade(z);
  if (strength < 0.1) return;
  const s = stage.scaleAt(z);
  const foot = side * (HALF_WIDTH - 1.85);
  const head = side * (HALF_WIDTH - 0.05);
  const stiles = [z, z + 0.72];
  const pen = {
    color: inks.ink,
    alpha: strength * 0.78 * clamp((z - stage.camZ - 3) / 6, 0, 1),
    width: clamp(s / 64, 0.7, 1.5),
    rough: clamp(s / 30, 0.4, 2),
    over: clamp(s / 14, 0, 6),
  };
  if (pen.alpha < 0.03) return;
  const ends = stiles.map((zs) => [stage.project(foot, 0, zs), stage.project(head, RAIL, zs)] as const);
  if (ends.some(([a, b]) => !a || !b)) return;
  const [[a0, a1], [b0, b1]] = ends as [[P, P], [P, P]];
  if (Math.max(a0[0], b0[0], a1[0]) < -40 || Math.min(a0[0], b0[0], a1[0]) > stage.w + 40) return;

  ctx.save();
  // the rungs, then the stiles over their ends
  const rungs = 19;
  for (let i = 0; i < rungs; i += 1) {
    const t = (i + 0.7) / (rungs + 0.4);
    stroke(ctx, mix(a0, a1, t), mix(b0, b1, t), index * 733 + i, {
      ...pen,
      alpha: pen.alpha * 0.8,
      width: pen.width * 0.8,
      over: 0,
      passes: 1,
    });
  }
  stroke(ctx, a0, a1, index * 733 + 100, pen);
  stroke(ctx, b0, b1, index * 733 + 101, pen);
  ctx.restore();
}
