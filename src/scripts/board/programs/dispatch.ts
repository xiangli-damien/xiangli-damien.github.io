/**
 * DISPATCH
 * Five regions joined by a few roads. Above each region stands its medical staff as a
 * tally of teams, one doctor (square) with its nurses (rings), and a short rule marks how
 * many teams the region needs; teams above the rule are spare and drawn in grey. An
 * emergency lifts one rule: that region is short, and its shortage is the only red on the
 * sheet. The pen inks a route from the nearest regions with staff to spare and the teams
 * travel in single file, doctor first, so the ratio of doctors to nurses holds all the way.
 * When the rule is reached the region returns to ink, its emergency passes, and another
 * region becomes the short one. After five emergencies the sheet is replaced.
 */
import {
  type Frame,
  type Lengths,
  type Palette,
  type Point,
  type Program,
  block,
  clamp,
  label,
  lerp,
  line,
  partial,
  pen,
  pixelStroke,
  pointAt,
  polyLengths,
  rand,
  ring,
  smooth,
} from '../kit';

const REGIONS = 5;
const MAX_ROWS = 5; // the tallest tally a region may carry
// Speeds are in px per second on a sheet 444 px wide and scale with the sheet.
const DRAFT_SPEED = 380; // the pen laying out the roads
const INK_SPEED = 240; // the pen inking a route
const TRAVEL_SPEED = 70; // a team on the road
const ALARM = 0.6; // seconds for a demand rule to rise or fall
const STAGGER = 0.75; // seconds between two teams leaving the same region
const HOLD = 1.1; // seconds of rest after a region is served
const REST = 2.2; // seconds on the finished sheet
const FADE = 0.6; // seconds to clear the sheet
const STILL_EVENT = 2; // the emergency shown in the reduced-motion picture
const LETTER = 10; // size of all lettering

/** Direct roads that skip a region or two. They sag under the line; one set per sheet. */
const CHORDS: Array<Array<[number, number]>> = [
  [[0, 2]],
  [[2, 4]],
  [[1, 3]],
  [[0, 3]],
  [[1, 4]],
  [
    [0, 2],
    [2, 4],
  ],
];

interface Region {
  at: Point;
  name: string;
  /** teams needed on an ordinary day */
  base: number;
  /** teams present when the sheet starts */
  staff: number;
  /** second at which the pen first reaches it */
  born: number;
  /** sideways shift of the name, away from a direct road that leaves downwards */
  nudge: number;
}

interface Link {
  a: number;
  b: number;
  /** from a to b, stopping short of both region rings */
  pts: Point[];
  length: number;
  born: number;
  drawn: number;
}

interface Hop {
  link: number;
  /** true when the road is travelled from a to b */
  forward: boolean;
}

interface Route {
  hops: Hop[];
  length: number;
  inkFrom: number;
  inkTo: number;
}

interface Team {
  from: number;
  to: number;
  hops: Hop[];
  /** second at which the doctor leaves */
  depart: number;
  /** seconds one member spends on the road */
  travel: number;
  fromRow: number;
  toRow: number;
}

interface Emergency {
  region: number;
  /** teams needed while the emergency lasts */
  demand: number;
  start: number;
  served: number;
  /** second at which the rule goes back down */
  end: number;
  routes: Route[];
  teams: Team[];
}

/**
 * The end of a polyline from `from01` on. Every point keeps its index, so the hand jitter
 * of the inked part falls exactly on the road underneath.
 */
function tail(pts: Point[], lengths: Lengths, from01: number): Point[] {
  const tip = pointAt(pts, lengths, from01);
  const target = clamp(from01, 0, 1) * lengths.total;
  const out = new Array<Point>(pts.length);
  let acc = 0;
  for (let i = 0; i < pts.length; i += 1) {
    out[i] = acc < target ? tip : pts[i];
    if (i < lengths.seg.length) acc += lengths.seg[i];
  }
  return out;
}

export default function dispatch(): Program {
  let regions: Region[] = [];
  let links: Link[] = [];
  let events: Emergency[] = [];
  let width = 1;
  let height = 1;
  let seed = 1;

  // Sizes, all derived from the sheet.
  let unit = 1;
  let pace = 1;
  let nurses = 2;
  let radius = 5;
  let mark = 5;
  let pitch = 8;
  let lift = 17; // from the centre of a region up to the first row of its tally
  let cross = 16; // the way across a region, from one road to the next
  let lag = 0.15; // seconds between two members of a team

  // Clock, in seconds.
  let origin = 0;
  let now = 0;
  let duration = 1;
  let stillAt = 0;

  // The state of the sheet at `now`.
  let count: number[] = [];
  let current: Emergency | null = null;
  let served = 0;

  function road(a: number, b: number, bend: number | null): Link {
    const from = regions[a].at;
    const to = regions[b].at;
    const control = { x: (from.x + to.x) / 2, y: bend ?? (from.y + to.y) / 2 };
    const curve = (s: number): Point => ({
      x: (1 - s) * (1 - s) * from.x + 2 * s * (1 - s) * control.x + s * s * to.x,
      y: (1 - s) * (1 - s) * from.y + 2 * s * (1 - s) * control.y + s * s * to.y,
    });
    const away = (s: number, p: Point) => Math.hypot(curve(s).x - p.x, curve(s).y - p.y);
    let s0 = 0;
    let s1 = 1;
    while (s0 < 0.4 && away(s0, from) < cross / 2) s0 += 0.004;
    while (s1 > 0.6 && away(s1, to) < cross / 2) s1 -= 0.004;
    const span = Math.hypot(to.x - from.x, to.y - from.y) + Math.abs(control.y - (from.y + to.y) / 2) * 0.5;
    const steps = Math.max(6, Math.round(span / (6 * unit)));
    const pts: Point[] = [];
    for (let i = 0; i <= steps; i += 1) pts.push(curve(lerp(s0, s1, i / steps)));
    return { a, b, pts, length: polyLengths(pts).total, born: 0, drawn: 0 };
  }

  /** How low a direct road must hang to pass under the names of the regions it skips. */
  function sag(a: number, b: number): number {
    const from = regions[a].at;
    const to = regions[b].at;
    const clear = radius + LETTER * 2 + 8;
    let control = Math.max(from.y, to.y) + 34 * unit;
    for (let n = a + 1; n < b; n += 1) {
      const s = (regions[n].at.x - from.x) / (to.x - from.x);
      const needed = (regions[n].at.y + clear - (1 - s) * (1 - s) * from.y - s * s * to.y) / (2 * s * (1 - s));
      control = Math.max(control, needed);
    }
    return control;
  }

  /** The way from every region to the target: fewest roads first, then least distance. */
  function reach(target: number): { far: number[]; via: number[] } {
    const far = new Array<number>(REGIONS).fill(Infinity);
    const via = new Array<number>(REGIONS).fill(-1);
    const done = new Array<boolean>(REGIONS).fill(false);
    far[target] = 0;
    for (let round = 0; round < REGIONS; round += 1) {
      let best = -1;
      for (let i = 0; i < REGIONS; i += 1) {
        if (!done[i] && (best < 0 || far[i] < far[best])) best = i;
      }
      if (best < 0 || far[best] === Infinity) break;
      done[best] = true;
      links.forEach((link, l) => {
        const other = link.a === best ? link.b : link.b === best ? link.a : -1;
        if (other < 0 || done[other]) return;
        const cost = far[best] + 10_000 + link.length;
        if (cost < far[other]) {
          far[other] = cost;
          via[other] = l;
        }
      });
    }
    return { far, via };
  }

  function trace(from: number, target: number, via: number[]): Hop[] {
    const hops: Hop[] = [];
    let at = from;
    while (at !== target && hops.length < REGIONS && via[at] >= 0) {
      const link = links[via[at]];
      const forward = link.a === at;
      hops.push({ link: via[at], forward });
      at = forward ? link.b : link.a;
    }
    return hops;
  }

  /**
   * The whole film of one sheet, written before it plays: which region is short when, who
   * sends how many teams along which route, and when each team lands. Returns the second
   * at which the last region is served.
   */
  function plan(rng: () => number, startAt: number): number {
    const staff = regions.map((region) => region.staff);
    const order = regions.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    events = [];
    let clock = startAt;
    let finished = startAt;
    for (const target of order) {
      // The earlier emergency has passed by now, so its region counts as a source again.
      const spare = staff.map((teams, i) => (i === target ? 0 : teams - regions[i].base));
      const available = spare.reduce((sum, teams) => sum + teams, 0);
      let left = Math.min(rng() < 0.4 ? 3 : 2, MAX_ROWS - staff[target], available);
      if (left < 1) continue;

      // Nearest regions give first.
      const { far, via } = reach(target);
      const sources = spare
        .map((teams, i) => ({ i, teams }))
        .filter((source) => source.teams > 0 && via[source.i] >= 0)
        .sort((p, q) => far[p.i] - far[q.i]);

      const routes: Route[] = [];
      const teams: Team[] = [];
      let inkAt = clock + ALARM + 0.2;
      for (const source of sources) {
        if (left <= 0) break;
        const hops = trace(source.i, target, via);
        const length = hops.reduce((sum, hop) => sum + links[hop.link].length, 0) + (hops.length - 1) * cross;
        const route: Route = { hops, length, inkFrom: inkAt, inkTo: inkAt + length / (INK_SPEED * pace) };
        routes.push(route);
        const sent = Math.min(source.teams, left);
        for (let n = 0; n < sent; n += 1) {
          staff[source.i] -= 1;
          teams.push({
            from: source.i,
            to: target,
            hops,
            depart: route.inkTo + 0.2 + n * STAGGER,
            travel: length / (TRAVEL_SPEED * pace),
            fromRow: staff[source.i],
            toRow: 0,
          });
        }
        left -= sent;
        inkAt += 0.45;
      }
      if (teams.length === 0) continue;

      // Teams land one after another, each on the next free row of the tally.
      teams.sort((p, q) => p.depart + p.travel - (q.depart + q.travel));
      const apart = (nurses + 1) * lag + 0.2;
      teams.forEach((team, n) => {
        if (n > 0) {
          const before = teams[n - 1];
          team.depart = Math.max(team.depart, before.depart + before.travel + apart - team.travel);
        }
        team.toRow = staff[target] + n;
      });
      staff[target] += teams.length;
      const last = teams[teams.length - 1];
      finished = last.depart + last.travel + nurses * lag;

      const previous = events[events.length - 1];
      if (previous) previous.end = clock;
      events.push({ region: target, demand: staff[target], start: clock, served: finished, end: Infinity, routes, teams });
      clock = finished + HOLD;
    }
    return finished;
  }

  function build() {
    // Neighbouring seeds give neighbouring first numbers, so the seed is scrambled first.
    const rng = rand(Math.imul(seed, 2654435761) >>> 0);
    unit = clamp(Math.min(width / 444, height / 278), 0.72, 1.3);
    pace = width / 444;
    nurses = rng() < 0.65 ? 2 : 3;
    radius = 5.5 * unit;
    mark = Math.max(4, Math.round(5 * unit));
    pitch = Math.round(8 * unit);
    lift = Math.round(radius + 11 * unit);
    cross = 2 * (radius + 2.5 * unit);
    lag = (11 * unit) / (TRAVEL_SPEED * pace);

    // Regions stand on a shallow zigzag, so every road leaves sideways or downwards and
    // the space above each region stays free for its tally.
    const mx = Math.max(38, width * 0.105);
    const mid = height * 0.6;
    const amp = height * 0.06;
    const flip = rng() < 0.5 ? 1 : -1;
    regions = [];
    let spare = 0;
    for (let i = 0; i < REGIONS; i += 1) {
      const side = (i % 2 === 0 ? 1 : -1) * flip;
      const base = 1 + Math.floor(rng() * 2);
      const extra = Math.floor(rng() * 3);
      spare += extra;
      regions.push({
        at: {
          x: Math.round(lerp(mx, width - mx, i / (REGIONS - 1))),
          y: Math.round(mid + side * amp * (0.4 + 0.6 * rng())),
        },
        name: `R${i + 1}`,
        base,
        staff: base + extra,
        born: 0,
        nudge: 0,
      });
    }
    // Nothing can be dispatched unless some regions hold more than they need.
    for (let guard = 0; spare < 4 && guard < 40; guard += 1) {
      const region = regions[Math.floor(rng() * REGIONS)];
      if (region.staff - region.base < 2) {
        region.staff += 1;
        spare += 1;
      }
    }

    links = [];
    for (let i = 0; i < REGIONS - 1; i += 1) links.push(road(i, i + 1, null));
    for (const [a, b] of CHORDS[Math.floor(rng() * CHORDS.length)]) {
      links.push(road(a, b, sag(a, b)));
      regions[a].nudge -= 6;
      regions[b].nudge += 6;
    }

    // The pen lays out the roads first, left to right, and each region appears as it is reached.
    let clock = 0.3;
    regions[0].born = clock;
    links.forEach((link, l) => {
      link.born = clock;
      clock += link.length / (DRAFT_SPEED * pace);
      link.drawn = clock;
      if (l < REGIONS - 1) regions[l + 1].born = clock;
    });

    duration = plan(rng, clock + 0.9) + REST + FADE;

    // The settled picture: the third emergency, its first team half way down the road.
    const shown = events[Math.min(STILL_EVENT, events.length - 1)];
    const first = shown?.teams[0];
    stillAt = first ? first.depart + Math.max(first.travel * 0.55, nurses * lag + 0.05) : clock;
  }

  /** Move the clock, replacing the sheet when its film is over. */
  function tick(frame: Frame) {
    if (frame.still) {
      now = stillAt;
      return;
    }
    let tau = frame.t / 1000 - origin;
    // The sheet was away for a long time: go straight to the next one.
    if (tau > duration * 4) {
      origin = frame.t / 1000 - duration;
      tau = duration;
    }
    while (tau >= duration) {
      origin += duration;
      tau -= duration;
      seed += 1;
      build();
    }
    now = tau;
  }

  /** Who holds how many complete rows right now, and which region is short. */
  function census() {
    count = regions.map((region) => region.staff);
    current = null;
    served = 0;
    for (const event of events) {
      if (now >= event.served) served += 1;
      else if (now >= event.start) current = event;
      for (const team of event.teams) {
        if (now >= team.depart) count[team.from] -= 1;
        if (now >= team.depart + team.travel + nurses * lag) count[team.to] += 1;
      }
    }
  }

  function demandAt(region: number): number {
    const { base } = regions[region];
    const event = events.find((e) => e.region === region);
    if (!event) return base;
    const up = smooth(clamp((now - event.start) / ALARM, 0, 1));
    const down = smooth(clamp((now - event.end) / ALARM, 0, 1));
    return base + (event.demand - base) * (up - down);
  }

  /** Slow breathing of the sheet plus a push away from the pointer. Both ends stay on their regions. */
  function warp(base: Point[], frame: Frame, index: number): Point[] {
    const { pointer, t, still } = frame;
    const sigma = Math.min(width, height) * 0.22;
    const last = base.length - 1;
    const out = new Array<Point>(base.length);
    for (let i = 0; i <= last; i += 1) {
      const hold = Math.sin((i / last) * Math.PI);
      let { x, y } = base[i];
      if (!still) y += Math.sin(t * 0.001 + i * 0.3 + index * 1.7) * 0.9 * hold;
      if (pointer.active) {
        const dx = x - pointer.x;
        const dy = y - pointer.y;
        const d2 = dx * dx + dy * dy;
        const g = Math.exp(-d2 / (sigma * sigma));
        const inv = 1 / (Math.sqrt(d2) + 0.001);
        x += dx * inv * g * 10 * hold;
        y += dy * inv * g * 10 * hold;
      }
      out[i] = { x, y };
    }
    return out;
  }

  /** Where a member of a team is after `distance` px on its route; nowhere while it passes through a region. */
  function locate(hops: Hop[], shapes: Point[][], measures: Lengths[], distance: number): Point | null {
    let left = distance;
    for (let h = 0; h < hops.length; h += 1) {
      const { link, forward } = hops[h];
      if (left <= links[link].length || h === hops.length - 1) {
        const u = clamp(left / links[link].length, 0, 1);
        return pointAt(shapes[link], measures[link], forward ? u : 1 - u);
      }
      left -= links[link].length;
      if (left <= cross) return null;
      left -= cross;
    }
    return null;
  }

  /** Place of member k (0 is the doctor) on row j of a region's tally. */
  function slot(region: number, row: number, k: number): Point {
    const { at } = regions[region];
    return { x: at.x + (k - nurses / 2) * pitch, y: at.y - lift - row * pitch };
  }

  function ruleY(region: number, need: number): number {
    return Math.round(regions[region].at.y - lift - need * pitch + pitch / 2);
  }

  /** One member of staff: a square for the doctor, a ring for a nurse, an outline where one is missing. */
  function member(ctx: CanvasRenderingContext2D, at: Point, k: number, color: string, palette: Palette, missing = false) {
    const centre = { x: Math.round(at.x - mark / 2) + mark / 2, y: Math.round(at.y - mark / 2) + mark / 2 };
    if (k === 0) block(ctx, centre, mark, missing ? { stroke: color, width: 1 } : { fill: color });
    else ring(ctx, centre, (mark - 1) / 2, { fill: palette.paper, stroke: color, width: missing ? 1 : 1.3 });
  }

  function roads(frame: Frame, shapes: Point[][], measures: Lengths[], tips: Point[]) {
    const { ctx, palette, still } = frame;

    // The map goes on beyond the sheet.
    const west = regions[0];
    const east = regions[REGIONS - 1];
    const beyond = { color: palette.soft, alpha: 0.55, dash: [1, 5] };
    if (still || now >= west.born) {
      line(ctx, [{ x: west.at.x - cross / 2, y: west.at.y + 0.5 }, { x: 0, y: west.at.y + 0.5 }], beyond);
    }
    if (still || now >= east.born) {
      line(ctx, [{ x: east.at.x + cross / 2, y: east.at.y + 0.5 }, { x: width, y: east.at.y + 0.5 }], beyond);
    }

    links.forEach((link, l) => {
      const p = still ? 1 : clamp((now - link.born) / (link.drawn - link.born), 0, 1);
      if (p <= 0) return;
      pixelStroke(ctx, p < 1 ? partial(shapes[l], p) : shapes[l], {
        color: palette.soft,
        alpha: 0.55,
        width: 1.4,
        seed: seed + l * 97,
      });
      if (p < 1) tips.push(pointAt(shapes[l], measures[l], p));
    });

    // Routes in use, inked over their roads from the sending region to the short one.
    const inked = new Array<boolean>(links.length).fill(false);
    for (const event of events) {
      if (now < event.start) continue;
      const fade = 1 - clamp((now - event.served - 0.3) / 0.7, 0, 1);
      if (fade <= 0) continue;
      for (const route of event.routes) {
        const p = still ? 1 : clamp((now - route.inkFrom) / (route.inkTo - route.inkFrom), 0, 1);
        let left = p * route.length;
        for (const hop of route.hops) {
          const u = clamp(left / links[hop.link].length, 0, 1);
          left -= links[hop.link].length + cross;
          if (u <= 0) break;
          const whole = u > 0.999;
          if (whole && inked[hop.link]) continue;
          const shape = shapes[hop.link];
          const measure = measures[hop.link];
          if (whole) inked[hop.link] = true;
          else tips.push(pointAt(shape, measure, hop.forward ? u : 1 - u));
          pixelStroke(ctx, whole ? shape : hop.forward ? partial(shape, u) : tail(shape, measure, 1 - u), {
            color: palette.ink,
            alpha: 0.85 * fade,
            width: 1.8,
            seed: seed + hop.link * 97,
          });
        }
      }
    }
  }

  function places(frame: Frame) {
    const { ctx, palette, still } = frame;
    regions.forEach((region, i) => {
      if (!still && now < region.born) return;
      const short = current?.region === i;
      if (short) {
        // A slow beat around the region, kept clear of its name.
        const beat = still ? 0.4 : (now * 0.9) % 1;
        ring(ctx, region.at, radius + 2 + beat * 6 * unit, { stroke: palette.signal, alpha: (1 - beat) * 0.6, width: 1 });
      }
      ring(ctx, region.at, radius, {
        fill: palette.paper,
        stroke: short ? palette.signal : palette.ink,
        width: short ? 2 : 1.5,
      });
      label(ctx, region.name, { x: region.at.x + region.nudge, y: region.at.y + radius + LETTER + 1 }, palette, {
        align: 'center',
        size: LETTER,
      });
    });
  }

  function tallies(frame: Frame) {
    const { ctx, palette, still } = frame;
    const reachX = Math.round((nurses / 2) * pitch + mark / 2 + 5 * unit);
    regions.forEach((region, i) => {
      const age = still ? 60 : now - region.born - 0.15;
      if (age < 0) return;
      const need = demandAt(i);
      const short = current?.region === i ? current : null;

      for (let j = 0; j < count[i] && age >= j * 0.08; j += 1) {
        const color = j + 0.5 < need ? palette.ink : palette.soft;
        for (let k = 0; k <= nurses; k += 1) member(ctx, slot(i, j, k), k, color, palette);
      }
      // The rows still to be filled, up to the rule.
      for (let j = count[i]; short && j < short.demand && j + 0.5 < need; j += 1) {
        const due = short.teams.find((team) => team.toRow === j);
        for (let k = 0; k <= nurses; k += 1) {
          const landed = due !== undefined && now >= due.depart + k * lag + due.travel;
          if (!landed) member(ctx, slot(i, j, k), k, palette.signal, palette, true);
        }
      }

      if (age < region.staff * 0.08 + 0.1) return;
      const y = ruleY(i, need) + (short ? 0 : 0.5);
      line(ctx, [{ x: region.at.x - reachX, y }, { x: region.at.x + reachX, y }], {
        color: short ? palette.signal : palette.ink,
        width: short ? 2 : 1,
      });
      if (short) {
        label(ctx, `SHORT ${short.demand - count[i]}`, { x: region.at.x, y: ruleY(i, short.demand) - 10 }, palette, {
          color: palette.signal,
          align: 'center',
          size: LETTER,
          tracking: 1,
          alpha: clamp((now - short.start) / ALARM, 0, 1),
        });
      }
    });
  }

  /** Teams leaving, on the road, and landing. Every member is in exactly one place. */
  function convoys(frame: Frame, shapes: Point[][], measures: Lengths[]) {
    const { ctx, palette } = frame;
    for (const event of events) {
      for (const team of event.teams) {
        if (now < team.depart || now >= team.depart + team.travel + nurses * lag) continue;
        for (let k = 0; k <= nurses; k += 1) {
          const gone = now - team.depart - k * lag;
          if (gone < 0) member(ctx, slot(team.from, team.fromRow, k), k, palette.soft, palette);
          else if (gone >= team.travel) member(ctx, slot(team.to, team.toRow, k), k, palette.ink, palette);
          else {
            const at = locate(team.hops, shapes, measures, gone * TRAVEL_SPEED * pace);
            if (at) member(ctx, at, k, palette.ink, palette);
          }
        }
      }
    }
  }

  function legend(frame: Frame) {
    const { ctx, palette } = frame;
    const y = Math.round(Math.max(16, height * 0.075));
    const measure = (text: string) => {
      ctx.save();
      ctx.font = `${LETTER}px ${palette.labelFont}`;
      const size = ctx.measureText(text).width + text.length;
      ctx.restore();
      return size;
    };
    let x = Math.round(regions[0].at.x - (nurses / 2) * pitch - mark / 2);
    member(ctx, { x: x + mark / 2, y }, 0, palette.ink, palette);
    x += mark + 6;
    label(ctx, 'DOCTOR', { x, y }, palette, { size: LETTER, tracking: 1 });
    x += Math.round(measure('DOCTOR')) + 14;
    for (let k = 1; k <= nurses; k += 1) {
      member(ctx, { x: x + mark / 2, y }, k, palette.ink, palette);
      x += pitch;
    }
    x += mark + 6 - pitch;
    label(ctx, 'NURSES', { x, y }, palette, { size: LETTER, tracking: 1 });
  }

  return {
    init(w, h, nextSeed) {
      width = w;
      height = h;
      seed = nextSeed;
      origin = 0;
      build();
    },

    draw(frame) {
      const { ctx, palette, still } = frame;
      tick(frame);
      census();

      const shapes = links.map((link, l) => warp(link.pts, frame, l));
      const measures = shapes.map(polyLengths);
      const tips: Point[] = [];

      roads(frame, shapes, measures, tips);
      places(frame);
      tallies(frame);
      convoys(frame, shapes, measures);
      if (!still) for (const tip of tips) pen(ctx, tip, palette, palette.ink, 3);

      // Rub the sheet out before the next one; the legend stays.
      const clearing = still ? 0 : smooth(clamp((now - (duration - FADE)) / FADE, 0, 1));
      if (clearing > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = clearing;
        ctx.fillStyle = palette.ink;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
      legend(frame);
    },

    readout() {
      const ratio = `RATIO 1:${nurses}`;
      const progress = `${served} OF ${events.length} SERVED`;
      if (!current) return `${ratio} · ${progress}`;
      const missing = current.demand - count[current.region];
      return `${ratio} · ${regions[current.region].name} SHORT ${missing} · ${progress}`;
    },
  };
}
