/**
 * CELLS
 * A cloud of cells rocks slowly on its axis; every square is one cell in 3D. The pen visits
 * them one at a time and draws a thread to the write head of a tape: the point becomes a
 * token, and the identity of the cell is typed under it. Then the tape feeds one step.
 * Hollow squares are masked points: their thread is dashed and the machine has to fill them
 * in before it can name them. Two cells lie on top of each other, and they are the only two
 * on the sheet that ever do: they arrive as ONE token, marked in the signal colour, and are
 * then split into two identities. The red is loudest at that moment and calms down after it.
 * The finished cloud comes to rest, then a new one takes its place; the tape never stops.
 */
import {
  type Frame,
  type Palette,
  type Point,
  type Program,
  TAU,
  block,
  clamp,
  label,
  lerp,
  line,
  partial,
  pen,
  perturb,
  pixelStroke,
  rand,
  ring,
  smooth,
} from '../kit';

const TILT = 0.2; // the axis leans towards the viewer by this many radians
const COS_TILT = Math.cos(TILT);
const SIN_TILT = Math.sin(TILT);
const ROCK = 0.45; // the cloud turns this far to either side of its rest angle, in radians
const ASKEW = 0.5; // at rest the overlapping pair is seen this far from side-on
const SAMPLES = 13; // angles across the rock at which a new cell is tested against the others
const SEGMENTS = 20;

// Seconds. One plain token takes SEEK + DRAW + REST + FEED.
const SEEK = 0.16;
const DRAW = 0.5;
const REST = 0.18;
const FEED = 0.24;
const WAIT = 0.35; // a masked token sits hollow for this long
const FILL = 0.55; // and is filled in over this long
const DOUBT = 0.9; // the overlapping pair sits unresolved for this long
const SPLIT = 0.75;
const NAME = 0.5;
const HOLD = 2.4; // rest on the finished cloud
const EASE = 0.6; // the rock dies away over this long once the cloud is finished
const SWAP = 0.9; // one cloud leaves, the next arrives

/** Tokens older than this many steps have run off the tape. */
const TAPE_LIFE = 5;

type Kind = 'plain' | 'masked' | 'pair';
type Mode = 'run' | 'hold' | 'swap';

interface Cell {
  /** position in cloud radii; y grows downward as on the sheet */
  x: number;
  y: number;
  z: number;
  kind: Kind;
  id: string;
  /** 0 = not yet recognised, 1 = named (a masked cell: filled in) */
  known: number;
}

interface Spot extends Point {
  /** -1 far .. 1 near */
  depth: number;
}

interface Token {
  /** position on the tape, counted in steps since the program started */
  slot: number;
  /** index of its cell, -1 once that cloud has gone */
  cell: number;
  kind: Kind;
  id: string;
  /** how much of the identity has been typed, 0..1 */
  typed: number;
  /** masked token: 0 hollow .. 1 filled in */
  fill: number;
  /** pair token: true while the two cells are still one unresolved token */
  open: boolean;
  /** pair token: 0 = thread leaves the middle of the pair, 1 = leaves its own cell */
  lean: number;
  /** which way the mark moves when the pair separates */
  side: -1 | 1;
  /** how much of its thread has been drawn, 0..1 */
  drawn: number;
}

interface Step {
  kind: Kind;
  cells: number[];
}

interface Head extends Point {
  on: boolean;
  hot: boolean;
}

const two = (n: number) => String(n).padStart(2, '0');

/** Where a cell falls when the cloud is turned by `turn`; in cloud radii around the axis. */
function project(cell: { x: number; y: number; z: number }, turn: number, out: Spot) {
  const ca = Math.cos(turn);
  const sa = Math.sin(turn);
  const xr = cell.x * ca + cell.z * sa;
  const zr = -cell.x * sa + cell.z * ca;
  const depth = cell.y * SIN_TILT + zr * COS_TILT;
  const scale = 1 + depth * 0.1;
  out.x = xr * scale;
  out.y = (cell.y * COS_TILT - zr * SIN_TILT) * scale;
  out.depth = depth;
}

/** How far along a thread a point is, 0..1, and the four weights of its curve there. */
const weigh = (u: number, into: number[]) => {
  const v = 1 - u;
  into[0] = v * v * v;
  into[1] = 3 * v * v * u;
  into[2] = 3 * v * u * u;
  into[3] = u * u * u;
  return into;
};
const BEND = 0.45; // a thread turns downward at this share of its fall
const weights: number[] = [0, 0, 0, 0];

/** The height of a thread from (fx, fy) to (tx, ty) where it passes x. */
function sink(fx: number, fy: number, tx: number, ty: number, x: number): number {
  const u = 1 - Math.cbrt(clamp((tx - x) / (tx - fx || 1), 0, 1));
  const [a, b, c, d] = weigh(u, weights);
  return (a + b) * fy + c * lerp(fy, ty, BEND) + d * ty;
}

export default function cells(): Program {
  let width = 1;
  let height = 1;
  let seed = 1;

  // layout
  let cx = 0;
  let cy = 0;
  let radius = 1;
  let dot = 6;
  let mark = 7;
  let tapeY = 0;
  let ruleY = 0;
  let idY = 0;
  let headX = 0;
  let pitch = 30;
  let left = 0;
  let right = 1;

  // cloud
  let cloud: Cell[] = [];
  let spots: Spot[] = [];
  let steps: Step[] = [];
  let masked = 0;
  let restAngle = 0;
  /** the rock: where it is in its swing, and how fast the swing runs (radians per second, signed) */
  let swing = 0;
  let pace = 0.35;
  let veil = 1;
  /** 0 = calm .. 1 = the machine is busy with the overlapping pair */
  let heat = 0;

  // tape
  let tokens: Token[] = [];
  let fed = 0;
  let feed = 0;

  // run
  let mode: Mode = 'swap';
  let step = 0;
  let clock = 0;
  let reach = 0;
  let stamped = false;
  /** pair only: the second token exists / the two tokens have come apart */
  let doubled = false;
  let parted = false;
  let swapped = true;
  let time = 0;
  let status = '';

  // Pen heads and the seek ring are drawn after the cells, so a cell never hides them.
  const heads: Head[] = [
    { x: 0, y: 0, on: false, hot: false },
    { x: 0, y: 0, on: false, hot: false },
  ];
  const seek = { x: 0, y: 0, radius: 0, alpha: 0 };

  function layout() {
    radius = Math.min(height * 0.225, width * 0.17);
    cx = Math.round(width * 0.34);
    cy = Math.round(height * 0.415);
    // On a phone the cells keep a size at which a square still reads as a square.
    dot = clamp(radius * 0.09, width < 380 ? 5 : 4.5, 7.5);
    mark = width < 380 ? 6 : width < 600 ? 7 : 8;
    tapeY = Math.round(height * 0.78);
    ruleY = tapeY + 10;
    idY = tapeY + 22;
    headX = Math.round(width * 0.72);
    pitch = Math.round(clamp(width * 0.07, 27, 44));
    // On a phone the row captions move out to the edge, so they keep clear of the head.
    left = width < 380 ? 14 : width * 0.07;
    right = width - left;
  }

  /** The side of a cell's square on the sheet: near cells are a little larger. */
  const sizeOf = (spot: Spot, kind: Kind) => dot * (0.84 + 0.14 * (spot.depth + 1)) + (kind === 'masked' ? 1.5 : 0);

  /** A new cloud from the current seed. The two poles carry the specimens that are labelled. */
  function grow() {
    const rng = rand(Math.imul(seed, 0x9e3779b1) >>> 0);
    const make = (x: number, y: number, z: number, kind: Kind): Cell => ({ x, y, z, kind, id: '', known: 0 });
    const count = width < 380 ? 9 + Math.floor(rng() * 2) : 10 + Math.floor(rng() * 3);
    cloud = [];

    // The hard case: two cells on top of each other near the upper pole. Their distance is
    // set in pixels, so that at every size they cover about half of each other.
    const around = rng() * TAU;
    const off = 0.04 + rng() * 0.06;
    const apart = rng() * TAU;
    const px = Math.cos(around) * off;
    const pz = Math.sin(around) * off;
    const gap = (dot * 0.38) / radius;
    const rise = (dot * 0.24) / radius;
    cloud.push(make(px + Math.cos(apart) * gap, -0.855 - rise, pz + Math.sin(apart) * gap, 'pair'));
    cloud.push(make(px - Math.cos(apart) * gap, -0.855 + rise, pz - Math.sin(apart) * gap, 'pair'));
    // The cloud rocks around this angle. The pair is never seen end-on, so both cells show,
    // and the second one stays in front.
    restAngle = apart + ASKEW;

    // One masked cell near the lower pole: it stays put, so it can carry the tag.
    const below = rng() * TAU;
    const out = 0.03 + rng() * 0.06;
    cloud.push(make(Math.cos(below) * out, 0.84, Math.sin(below) * out, 'masked'));

    // Every cell as it is seen at each sample angle of the rock, in pixels from the axis.
    const probe: Spot = { x: 0, y: 0, depth: 0 };
    const look = (cell: { x: number; y: number; z: number }, into: number[]) => {
      for (let k = 0; k < SAMPLES; k += 1) {
        project(cell, restAngle + lerp(-ROCK, ROCK, k / (SAMPLES - 1)), probe);
        into[k * 2] = probe.x * radius;
        into[k * 2 + 1] = probe.y * radius;
      }
      return into;
    };
    const first = look(cloud[0], []);
    const second = look(cloud[1], []);
    const seen: number[][] = [look(cloud[2], [])];
    const trial: number[] = [];

    // Two squares never come closer than 4 px, and nothing comes near the ring of the pair.
    // A cell that sits on the thread of another would hang on it like a bead, so each cell
    // also gets a lane of its own, as wide as the cloud has room for.
    const room = dot * 1.12 + 5.5;
    const berth = dot * 2 + 8;
    const hx = headX - cx;
    const hy = tapeY - 11 - cy;
    let lane = dot / 2 + 5;
    const free = (candidate: number[]) => {
      for (let k = 0; k < SAMPLES * 2; k += 2) {
        const x = candidate[k];
        const y = candidate[k + 1];
        const mx = (first[k] + second[k]) / 2;
        const my = (first[k + 1] + second[k + 1]) / 2;
        const half = Math.hypot(first[k] - second[k], first[k + 1] - second[k + 1]) / 2;
        if (Math.hypot(x - mx, y - my) < half + berth) return false;
        for (const other of seen) {
          const ox = other[k];
          const oy = other[k + 1];
          if (Math.abs(x - ox) < room && Math.abs(y - oy) < room) return false;
          const crossed = x < ox ? Math.abs(sink(x, y, hx, hy, ox) - oy) : Math.abs(sink(ox, oy, hx, hy, x) - y);
          if (crossed < lane) return false;
        }
      }
      return true;
    };

    // The body: spread out in depth, kept clear of both poles, and apart on the sheet.
    // The spread in depth and the lanes give way when the cloud is hard to fill; the
    // distance between two squares never does.
    let need = 0.62;
    let tries = 0;
    while (cloud.length < count && tries < 4000) {
      tries += 1;
      if (tries % 60 === 0) {
        need *= 0.93;
        lane *= 0.9;
      }
      const y = lerp(-0.46, 0.46, rng());
      const limit = Math.min(Math.sqrt(1 - y * y) * 0.98, (0.5 - COS_TILT * Math.abs(y)) / SIN_TILT);
      const r = limit * Math.sqrt(lerp(0.1, 1, rng()));
      const theta = rng() * TAU;
      const candidate = make(Math.cos(theta) * r, y, Math.sin(theta) * r, 'plain');
      let clear = true;
      for (const other of cloud) {
        if (Math.hypot(other.x - candidate.x, other.y - candidate.y, other.z - candidate.z) < need) {
          clear = false;
          break;
        }
      }
      if (!clear || !free(look(candidate, trial))) continue;
      cloud.push(candidate);
      seen.push(trial.slice());
    }

    // Reading order: from the bottom of the cloud upwards, the pair last.
    const singles: number[] = [];
    for (let i = 2; i < cloud.length; i += 1) singles.push(i);
    singles.sort((a, b) => cloud[b].y - cloud[a].y);

    // More masked cells: the last single one, so that it is still on the tape when the
    // cloud is finished, and often one in the middle of the sequence.
    const picks = [singles.length - 1];
    if (rng() < 0.65) picks.push(3 + Math.floor(rng() * 3));
    for (const pick of picks) cloud[singles[Math.min(pick, singles.length - 1)]].kind = 'masked';
    masked = 0;
    for (const cell of cloud) if (cell.kind === 'masked') masked += 1;

    // Identities are names, not a count: hand them out in shuffled order.
    const names: number[] = [];
    for (let i = 0; i < cloud.length; i += 1) names.push(i + 1);
    for (let i = names.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      const keep = names[i];
      names[i] = names[j];
      names[j] = keep;
    }
    cloud.forEach((cell, i) => {
      cell.id = `C${two(names[i])}`;
    });

    steps = singles.map((index) => ({ kind: cloud[index].kind, cells: [index] }));
    steps.push({ kind: 'pair', cells: [0, 1] });

    spots = cloud.map(() => ({ x: 0, y: 0, depth: 0 }));
    pace = (rng() < 0.5 ? -1 : 1) * (0.3 + rng() * 0.1);
    swing = rng() * TAU;
  }

  /** Project every cell onto the sheet. */
  function place(frame: Frame) {
    const { pointer, still } = frame;
    const angle = still ? restAngle : restAngle + Math.sin(swing) * ROCK;
    const sigma = radius * 0.7;
    for (let i = 0; i < cloud.length; i += 1) {
      const spot = spots[i];
      project(cloud[i], angle, spot);
      let x = cx + spot.x * radius;
      let y = cy + spot.y * radius;
      if (pointer.active) {
        const dx = x - pointer.x;
        const dy = y - pointer.y;
        const d2 = dx * dx + dy * dy;
        const g = Math.exp(-d2 / (sigma * sigma));
        const inv = 1 / (Math.sqrt(d2) + 0.001);
        x += dx * inv * g * 6;
        y += dy * inv * g * 6;
      }
      spot.x = x;
      spot.y = y;
    }
  }

  const middle = (): Point => ({ x: (spots[0].x + spots[1].x) / 2, y: (spots[0].y + spots[1].y) / 2 });
  const halo = () => Math.hypot(spots[0].x - spots[1].x, spots[0].y - spots[1].y) / 2 + dot + 3;
  const slotX = (slot: number, adv: number) => Math.min(headX, headX - (adv - slot) * pitch);

  /** A thread leaves its cell sideways and drops into the slot from above. */
  function thread(from: Point, to: Point): Point[] {
    const out = new Array<Point>(SEGMENTS + 1);
    const bend = lerp(from.y, to.y, BEND);
    for (let i = 0; i <= SEGMENTS; i += 1) {
      const [a, b, c, d] = weigh(i / SEGMENTS, weights);
      out[i] = {
        x: a * from.x + (b + c + d) * to.x,
        y: (a + b) * from.y + c * bend + d * to.y,
      };
    }
    return out;
  }

  function push(cell: number, kind: Kind, slot: number, side: -1 | 1): Token {
    const token: Token = {
      slot,
      cell,
      kind,
      id: cloud[cell].id,
      typed: 0,
      fill: 0,
      open: kind === 'pair',
      lean: kind === 'pair' ? 0 : 1,
      side,
      drawn: 1,
    };
    tokens.push(token);
    return token;
  }

  function next() {
    fed += 1;
    feed = 0;
    step += 1;
    clock = 0;
    reach = 0;
    heat = 0;
    stamped = false;
    doubled = false;
    parted = false;
    while (tokens.length && fed - tokens[0].slot > TAPE_LIFE + 1) tokens.shift();
    if (step >= steps.length) mode = 'hold';
  }

  function tick(dt: number) {
    time += dt;
    clock += dt;

    if (mode === 'hold') {
      // The finished cloud comes to rest where it is.
      swing += pace * dt * (1 - smooth(clamp(clock / EASE, 0, 1)));
      status = `${cloud.length} CELLS NAMED · ${masked} FILLED · 1 SPLIT`;
      if (clock >= HOLD) {
        mode = 'swap';
        clock = 0;
        swapped = false;
      }
      return;
    }

    if (mode === 'swap') {
      const u = clamp(clock / SWAP, 0, 1);
      if (u >= 0.5 && !swapped) {
        swapped = true;
        seed += 1;
        for (const token of tokens) token.cell = -1;
        grow();
      }
      // The old cloud leaves at rest; the new one starts to rock as it arrives.
      swing += pace * dt * smooth(clamp(u * 2 - 1, 0, 1));
      // The tape feeds one blank step between two clouds.
      veil = u < 0.5 ? 1 - smooth(u * 2) : smooth(u * 2 - 1);
      feed = smooth(u);
      status = `NEXT CLOUD · ${cloud.length} POINTS`;
      if (u >= 1) {
        veil = 1;
        mode = 'run';
        step = -1;
        next();
      }
      return;
    }

    swing += pace * dt;
    const now = steps[step];
    const head = `TOKEN ${two(step + 1)}/${cloud.length}`;
    const first = cloud[now.cells[0]];

    if (now.kind === 'plain') {
      const t1 = SEEK + DRAW;
      const t2 = t1 + REST;
      reach = clamp((clock - SEEK) / DRAW, 0, 1);
      if (clock >= t1 && !stamped) {
        stamped = true;
        push(now.cells[0], 'plain', fed, 1);
        first.known = 1;
      }
      const token = tokens[tokens.length - 1];
      if (stamped) token.typed = clamp((clock - t1) / REST, 0, 1);
      feed = smooth(clamp((clock - t2) / FEED, 0, 1));
      status = `${head} · ${masked} MASKED · ID ${stamped ? first.id : '...'}`;
      if (clock >= t2 + FEED) next();
      return;
    }

    if (now.kind === 'masked') {
      const t1 = SEEK + DRAW;
      const t2 = t1 + WAIT;
      const t3 = t2 + FILL;
      const t4 = t3 + REST;
      reach = clamp((clock - SEEK) / DRAW, 0, 1);
      if (clock >= t1 && !stamped) {
        stamped = true;
        push(now.cells[0], 'masked', fed, 1);
      }
      if (stamped) {
        const token = tokens[tokens.length - 1];
        const u = clamp((clock - t2) / FILL, 0, 1);
        token.fill = smooth(u);
        token.typed = clamp((u - 0.5) * 2, 0, 1);
        first.known = token.fill;
      }
      feed = smooth(clamp((clock - t4) / FEED, 0, 1));
      status =
        clock < t2
          ? `${head} · MASKED · HIDDEN`
          : clock < t3
            ? `${head} · MASKED · FILLING IN`
            : `${head} · FILLED · ID ${first.id}`;
      if (clock >= t4 + FEED) next();
      return;
    }

    // The pair: one token, a pause, then two.
    const t1 = SEEK * 2 + DRAW;
    const t2 = t1 + DOUBT;
    const t3 = t2 + SPLIT;
    const t4 = t3 + NAME + REST * 2;
    const second = cloud[now.cells[1]];
    reach = clamp((clock - SEEK * 2) / DRAW, 0, 1);
    if (clock >= t1 && !stamped) {
      stamped = true;
      push(now.cells[0], 'pair', fed, -1);
    }
    if (clock >= t2 && stamped && !doubled) {
      doubled = true;
      push(now.cells[1], 'pair', fed + 1, 1).drawn = 0;
    }
    if (doubled) {
      const a = tokens[tokens.length - 2];
      const b = tokens[tokens.length - 1];
      const u = clamp((clock - t2) / SPLIT, 0, 1);
      a.lean = smooth(u);
      b.lean = a.lean;
      b.drawn = u;
      if (!parted) feed = smooth(u);
      if (clock >= t3 && !parted) {
        parted = true;
        fed += 1;
        feed = 0;
        a.open = false;
        b.open = false;
        first.known = 1;
        second.known = 1;
      }
      if (parted) {
        const n = clamp((clock - t3) / NAME, 0, 1);
        a.typed = clamp(n / 0.6, 0, 1);
        b.typed = clamp((n - 0.4) / 0.6, 0, 1);
        feed = smooth(clamp((clock - t4) / FEED, 0, 1));
      }
    }
    // The red rises as the pen arrives and is let go while the two names are typed.
    heat = parted ? 1 - smooth(clamp((clock - t3) / NAME, 0, 1)) : smooth(clamp(clock / (SEEK * 2), 0, 1));
    status =
      clock < t2
        ? `${head} · OVERLAP · ID ??`
        : clock < t3
          ? `${head} · OVERLAP · SPLITTING`
          : `SPLIT · ${first.id} + ${second.id}`;
    if (clock >= t4 + FEED) {
      // The second token of the pair took a slot of its own.
      step += 1;
      next();
    }
  }

  /** The finished cloud: every cell named, the last tokens still on the tape. */
  function settle() {
    tokens = [];
    let slot = 0;
    for (const item of steps) {
      item.cells.forEach((index, k) => {
        cloud[index].known = 1;
        const token = push(index, item.kind, slot, k === 0 ? -1 : 1);
        token.typed = 1;
        token.fill = 1;
        token.open = false;
        token.lean = 1;
        slot += 1;
      });
    }
    fed = slot;
    feed = 0;
    veil = 1;
    reach = 0;
    heat = 0;
    mode = 'hold';
    status = `${cloud.length} CELLS NAMED · ${masked} FILLED · 1 SPLIT`;
  }

  /**
   * How strongly a thread shows, by the age of its token in tape steps. In motion only the
   * newest thread stays behind the pen and fades as the tape feeds, so the sheet stays
   * quiet; the settled picture keeps exactly three.
   */
  function strength(age: number, kind: Kind, still: boolean): number {
    if (kind === 'pair') {
      const full = lerp(0.92, 0.7, clamp(age, 0, 1)) * clamp((5 - age) / 1.5, 0, 1);
      return still ? full : full * lerp(0.64, 1, heat);
    }
    if (still) return age < 3.5 ? 0.5 : 0;
    return lerp(0.9, 0.3, clamp(age, 0, 1)) * clamp((1.6 - age) / 0.6, 0, 1);
  }

  function furniture(frame: Frame, adv: number) {
    const { ctx, palette } = frame;
    line(ctx, [{ x: left, y: ruleY + 0.5 }, { x: right, y: ruleY + 0.5 }], { color: palette.soft, alpha: 0.5 });

    // Slot boundaries travel with the tape.
    const frac = adv - Math.floor(adv);
    const start = headX + pitch / 2 - frac * pitch;
    const first = start + Math.floor((right - start) / pitch) * pitch;
    for (let x = first; x >= left; x -= pitch) {
      const at = Math.round(x) + 0.5;
      line(ctx, [{ x: at, y: ruleY }, { x: at, y: ruleY - 3 }], { color: palette.soft, alpha: 0.5 });
    }

    // The write head: a small hood over the slot that is being written.
    const half = mark / 2 + 5;
    line(
      ctx,
      [
        { x: headX - half + 0.5, y: tapeY - 4 },
        { x: headX - half + 0.5, y: tapeY - 10.5 },
        { x: headX + half - 0.5, y: tapeY - 10.5 },
        { x: headX + half - 0.5, y: tapeY - 4 },
      ],
      { color: palette.ink, alpha: 0.75 },
    );

    label(ctx, 'TOKEN', { x: right, y: tapeY }, palette, { align: 'right', size: 10, tracking: 1 });
    label(ctx, 'CELL ID', { x: right, y: idY }, palette, { align: 'right', size: 10, tracking: 1 });
  }

  /** The two tags, one at each pole of the cloud, close enough to need no leader line. */
  function tags(frame: Frame) {
    const { ctx, palette, still } = frame;
    const mid = middle();
    const r = halo();
    // In motion the red waits at half strength and peaks while the pair is being split.
    const glow = still ? 1 : lerp(0.55, 1, heat);
    const pulse = still ? 0 : Math.sin(time * 7) * 1.2 * heat;
    ring(ctx, mid, r + pulse, { stroke: palette.signal, width: 1.2, dash: [3, 3], alpha: veil * (still ? 0.85 : glow) });
    label(ctx, 'OVERLAP', { x: mid.x, y: mid.y - r - 12 }, palette, {
      color: palette.signal,
      alpha: veil * glow,
      align: 'center',
      size: 10,
      tracking: 1,
    });

    const low = spots[2];
    label(ctx, 'MASKED', { x: low.x, y: low.y + dot / 2 + 16 }, palette, { alpha: veil, align: 'center', size: 10, tracking: 1 });
  }

  function strand(frame: Frame, pts: Point[], kind: Kind, alpha: number, jitter: number) {
    const { ctx, palette } = frame;
    if (kind === 'masked') line(ctx, pts, { color: palette.ink, alpha: alpha * 0.9, width: 1.2, dash: [3, 4] });
    else pixelStroke(ctx, pts, { color: kind === 'pair' ? palette.signal : palette.ink, alpha, width: 1.8, seed: jitter });
  }

  function rest(head: Head, at: Point, hot: boolean) {
    head.x = at.x;
    head.y = at.y;
    head.hot = hot;
    head.on = true;
  }

  function threads(frame: Frame, adv: number) {
    const { pointer, still } = frame;
    const nudge = Math.min(width, height) * 0.2;
    heads[0].on = false;
    heads[1].on = false;
    seek.alpha = 0;

    for (const token of tokens) {
      if (token.cell < 0 || token.drawn <= 0) continue;
      const age = adv - token.slot;
      const alpha = strength(age, token.kind, still) * veil;
      if (alpha < 0.02) continue;
      const own = spots[token.cell];
      const mid = middle();
      const from = token.kind === 'pair' ? { x: lerp(mid.x, own.x, token.lean), y: lerp(mid.y, own.y, token.lean) } : own;
      let pts = perturb(thread(from, { x: slotX(token.slot, adv), y: tapeY - 11 }), pointer, nudge, 9);
      if (token.drawn < 1) pts = partial(pts, token.drawn);
      strand(frame, pts, token.kind, alpha, seed + token.slot * 97);
      if (token.drawn < 1 && !still) rest(heads[0], pts[pts.length - 1], true);
    }

    // The thread that is being drawn now.
    if (still || mode !== 'run' || stamped) return;
    const now = steps[step];
    const hot = now.kind === 'pair';
    const from = hot ? middle() : spots[now.cells[0]];
    if (!hot) {
      // A ring closes on the cell the pen has chosen and lets go as the thread leaves it.
      // The pair needs none: its own ring wakes up.
      const near = clamp(clock / SEEK, 0, 1);
      seek.x = from.x;
      seek.y = from.y;
      seek.radius = dot + 3 + (1 - near) * 5;
      seek.alpha = 0.75 * near * (1 - reach);
    }
    if (reach <= 0) return;
    const pts = partial(perturb(thread(from, { x: headX, y: tapeY - 11 }), pointer, nudge, 9), lerp(reach, smooth(reach), 0.6));
    strand(frame, pts, now.kind, 0.92, seed + fed * 97);
    rest(heads[1], pts[pts.length - 1], hot);
  }

  /**
   * The mark of a masked point: an empty outline, and a core that grows once it is filled in.
   * Both squares are set on whole pixels around one centre, so the core never sits askew.
   */
  function hollow(ctx: CanvasRenderingContext2D, palette: Palette, at: Point, size: number, fill: number, color: string, alpha: number) {
    const outer = Math.round(size);
    const centre = { x: Math.round(at.x - outer / 2) + outer / 2, y: Math.round(at.y - outer / 2) + outer / 2 };
    block(ctx, centre, outer, { fill: palette.paper, stroke: color, alpha, width: 1.2 });
    const core = Math.round((outer - 4) * fill);
    if (core > 0) block(ctx, centre, core + ((outer - core) % 2), { fill: palette.ink, alpha });
  }

  function points(frame: Frame) {
    const { ctx, palette } = frame;
    // Paper under every cell: a thread that meets a cell which is not its own passes behind it.
    for (let i = 0; i < cloud.length; i += 1) {
      block(ctx, spots[i], sizeOf(spots[i], cloud[i].kind) + 4, { fill: palette.paper, alpha: veil });
    }
    for (let i = 0; i < cloud.length; i += 1) {
      const cell = cloud[i];
      const spot = spots[i];
      const size = sizeOf(spot, cell.kind);
      const alpha = (0.5 + 0.25 * (spot.depth + 1)) * veil;
      if (cell.kind === 'masked') {
        hollow(ctx, palette, spot, size, cell.known, cell.known > 0 ? palette.ink : palette.soft, alpha);
        continue;
      }
      // Once the pair is split its front cell gets an edge of its own: two cells, not one blot.
      if (i === 1 && cell.known > 0) block(ctx, spot, size + 2, { fill: palette.paper, alpha: veil });
      if (cell.known > 0) block(ctx, spot, size, { fill: palette.ink, alpha });
      else block(ctx, spot, size, { fill: palette.soft, alpha: alpha * 0.85 });
    }
  }

  function marks(frame: Frame) {
    const { ctx, palette } = frame;
    if (seek.alpha > 0.02) ring(ctx, seek, seek.radius, { stroke: palette.ink, alpha: seek.alpha, width: 1 });
    for (const head of heads) {
      if (head.on) pen(ctx, head, palette, head.hot ? palette.signal : palette.ink, 3);
    }
  }

  function stamp(ctx: CanvasRenderingContext2D, palette: Palette, at: Point, token: Token, alpha: number) {
    if (token.kind === 'pair' && token.open) {
      // Two outlines sharing one slot; they drift apart as the pair is split.
      const shift = 2 * (1 - token.lean);
      const twin = token.side === -1 && token.lean === 0;
      block(ctx, { x: at.x + shift * token.side, y: at.y + shift * token.side }, mark, { stroke: palette.signal, alpha, width: 1.3 });
      if (twin) block(ctx, { x: at.x + shift, y: at.y + shift }, mark, { stroke: palette.signal, alpha, width: 1.3 });
      return;
    }
    if (token.kind === 'masked') {
      hollow(ctx, palette, at, mark + 1, token.fill, palette.ink, alpha);
      return;
    }
    block(ctx, at, mark, { fill: palette.ink, alpha });
  }

  function tape(frame: Frame, adv: number) {
    const { ctx, palette } = frame;
    ctx.save();
    ctx.font = `10px ${palette.labelFont}`;
    const half = ctx.measureText('C00').width / 2;
    ctx.restore();

    for (const token of tokens) {
      const age = adv - token.slot;
      const x = slotX(token.slot, adv);
      const alpha = clamp((TAPE_LIFE - age) / 2, 0, 1) * clamp((x - left) / pitch, 0, 1);
      if (alpha <= 0) continue;
      stamp(ctx, palette, { x, y: tapeY }, token, alpha);
      if (token.kind === 'pair' && token.open) {
        if (token.side === -1 && token.lean < 1) {
          label(ctx, '??', { x, y: idY }, palette, { color: palette.signal, alpha: alpha * (1 - token.lean), align: 'center', size: 10 });
        }
        continue;
      }
      const shown = Math.ceil(token.typed * token.id.length);
      if (shown > 0) {
        label(ctx, token.id.slice(0, shown), { x: x - half, y: idY }, palette, { color: palette.ink, alpha: alpha * 0.86, size: 10 });
      }
    }
  }

  return {
    init(w, h, nextSeed) {
      width = w;
      height = h;
      seed = nextSeed;
      layout();
      grow();
      tokens = [];
      fed = 0;
      feed = 0;
      time = 0;
      // Start half way through a swap: the first cloud fades in like every later one.
      mode = 'swap';
      clock = SWAP / 2;
      swapped = true;
      veil = 0;
      heat = 0;
      step = 0;
      reach = 0;
      stamped = false;
      doubled = false;
      parted = false;
      status = '';
    },

    draw(frame) {
      if (frame.still) settle();
      else tick(frame.dt);
      place(frame);
      const adv = fed + feed;
      furniture(frame, adv);
      tags(frame);
      threads(frame, adv);
      points(frame);
      marks(frame);
      tape(frame, adv);
    },

    readout() {
      return status;
    },
  };
}
