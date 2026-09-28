/**
 * RPC
 * A remote call drawn as a small telephone exchange. The client (solid square, left) asks
 * the registry (ring, top) where the service lives, and the pen draws a line to each of
 * three providers (open squares, right). A selector arm turns from contact to contact and
 * sends every request (solid square) down one line; the reply (open square) comes back the
 * same way. Providers tick heartbeats up the dashed rail beside them to the registry. Then
 * one falls silent: a call gets no answer, the heartbeat does not come and the provider is
 * crossed out in the signal colour. The call is tried again on another line, the registry
 * drops the entry, and two providers share the traffic until the third registers again.
 * The column under the client is the token bucket: one token per call, refilled with time.
 *
 * Every sheet follows the same short timeline (ask, draw, fail, miss, drop, return, end).
 * Only the traffic between those moments is left to the balancer, and its strategy changes
 * with the sheet: round-robin steps 1-2-3, random may repeat itself, hash keeps a whole
 * burst of calls on the line that owns their key.
 */
import {
  type Frame,
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

const PROVIDERS = 3;
const STRATEGIES = ['ROUND-ROBIN', 'RANDOM', 'HASH'] as const;
const CAPACITY = 5; // tokens the bucket can hold
const REFILL = 1.1; // tokens per second
const BEAT = 2.4; // seconds between two heartbeats of one provider
const CLIMB = 1.1; // seconds for a heartbeat from the farthest provider to reach the registry
const FLIGHT = 0.95; // seconds for a message to cross from client to provider
const ANSWER = 0.16; // seconds a provider works on a call
const TIMEOUT = 1; // seconds the client waits at a silent provider before it tries again
const HOP = 0.6; // seconds for a dot to travel between client and registry
const DRAW = 0.5; // seconds for the pen to draw one line
const STAGGER = 0.15; // seconds between the starts of two lines
const GAP = 0.5; // seconds between two calls of one burst
const MARK = 0.4; // seconds to draw the cross, and to lift it
const FADE = 0.6; // seconds for the lines to fade when the sheet is replaced

/* The timeline of one sheet, in seconds. */
const ASK = 0.3; // the client asks the registry
const OPEN = ASK + 2 * HOP + 0.1 + DRAW + 2 * STAGGER + 0.2; // the lines are drawn, traffic opens
const MISS = 1; // after the failure: the heartbeat that does not come
const DROP = 3.2; // after the failure: the registry drops the entry
const REST = 7; // seconds the dropped provider stays away
const OUTRO = 3.5; // seconds of healthy traffic before the sheet is replaced

const TRUNK = 5; // points in the shared line from client to selector
const LINE = 13; // points in each line from selector to provider
const ARC = 24; // points in each dashed link to the registry

interface Provider {
  at: Point;
  /** trunk and line as one polyline, from the client to this provider */
  route: Point[];
  /** fraction of the route at which a call reaches the selector */
  turn: number;
  /** angle of its contact on the selector */
  angle: number;
  /** length of stub and rail between its edge and the top of the rail */
  climb: number;
  /** it answers calls and sends heartbeats */
  alive: boolean;
  /** the registry holds an entry for it */
  listed: boolean;
  /** the client has it in its list and keeps a line to it */
  known: boolean;
  /** the client had a line to it and closed it */
  closed: boolean;
  /** a call to it went unanswered: the balancer avoids it */
  suspect: boolean;
  /** how much of its line the pen has drawn, 0..1; the pen waits while negative */
  drawn: number;
  /** seconds since the registry last heard from it */
  age: number;
  /** seconds until its next heartbeat, and between two of them */
  wait: number;
  period: number;
  /** seconds left of work on a call */
  busy: number;
}

interface Message {
  to: number;
  /** 0 at the client, 1 at the provider */
  u: number;
  kind: 'request' | 'reply' | 'lost';
  /** a reply waits while this is negative; a lost request counts the silence here */
  age: number;
  /** the selector has already turned for it */
  routed: boolean;
}

interface Beat {
  from: number;
  /** pixels travelled towards the registry */
  s: number;
  /** a provider that is not listed sends a registration instead */
  join: boolean;
}

interface Hop {
  /** 0..1 along the link between client and registry; waits while negative */
  u: number;
  /** the client's question going up, or the registry's list coming down */
  kind: 'query' | 'list';
}

interface Cue {
  at: number;
  run: () => void;
}

export default function rpc(): Program {
  let seed = 1;
  let first = 1;
  let width = 1;
  let height = 1;

  /* the sheet */
  let unit = 1;
  let node = 12;
  let reach = 18;
  let stub = 8;
  let client: Point = { x: 0, y: 0 };
  let registry: Point = { x: 0, y: 0 };
  let pivot: Point = { x: 0, y: 0 };
  let railTop: Point = { x: 0, y: 0 };
  let providers: Provider[] = [];
  let hold: number[] = [];
  let arcHold: number[] = [];
  let lookup: Point[] = [];
  let pulse: Point[] = [];
  let pulseLength = 1;
  let beatSpeed = 1;

  /* the film */
  let dice = rand(1);
  let strategy = 0;
  let failing = 0;
  let cues: Cue[] = [];
  let cue = 0;
  let clock = 0;
  let dropAt = 0;
  let endAt = Infinity;
  let openAt = Infinity;
  let missAt = Infinity;
  let healAt = Infinity;
  let retryAt = -10;
  let looked = false;
  let open = false;
  let failed = false;
  let tokens = CAPACITY;
  let calls = 0;
  let nextSend = Infinity;
  let burst = 0;
  let cursor = 0;
  let home = 0;
  let cast = -1;
  let armFrom = 0;
  let armTo = 0;
  let armT = 1;
  let lookupGlow = 0;
  let messages: Message[] = [];
  let beats: Beat[] = [];
  let hops: Hop[] = [];

  /** A quarter of an ellipse: `upright` leaves vertically and arrives level, otherwise the reverse. */
  function quarter(from: Point, to: Point, upright: boolean): Point[] {
    const pts: Point[] = [];
    for (let i = 0; i < ARC; i += 1) {
      const a = (i / (ARC - 1)) * Math.PI * 0.5;
      const p = upright ? 1 - Math.cos(a) : Math.sin(a);
      const q = upright ? Math.sin(a) : 1 - Math.cos(a);
      pts.push({ x: lerp(from.x, to.x, p), y: lerp(from.y, to.y, q) });
    }
    return pts;
  }

  function layout() {
    unit = clamp(Math.min(width / 444, height / 278), 0.72, 1.3);
    node = Math.round(12 * unit);
    reach = Math.max(16, 18 * unit);
    stub = Math.max(6, Math.round(8 * unit));
    const mx = Math.max(28, width * 0.1);
    // The column keeps room on its right for the rail and for the words "P1 DOWN".
    const column = Math.round(width - Math.max(76, width * 0.2));
    const gap = height * 0.235;
    const edge = node / 2 + 3;
    client = { x: Math.round(mx + node / 2 + 2), y: Math.round(height * 0.63) };
    registry = { x: Math.round(lerp(client.x, column, 0.5)), y: Math.round(Math.max(32, height * 0.17)) };
    pivot = { x: Math.round(lerp(client.x, column, 0.36)), y: client.y };
    // The heartbeat rail stands beside the providers, so no beat ever passes through a node.
    railTop = { x: column + node / 2 + stub, y: Math.round(client.y - gap) - edge };

    // Lines end just inside the nodes, which are drawn over them.
    const inside = node / 2 - 2;
    providers = [];
    for (let i = 0; i < PROVIDERS; i += 1) {
      const at = { x: column, y: Math.round(client.y + (i - 1) * gap) };
      const angle = (i - 1) * 0.7;
      const contact = { x: pivot.x + Math.cos(angle) * reach, y: pivot.y + Math.sin(angle) * reach };
      const route: Point[] = [];
      for (let k = 0; k < TRUNK; k += 1) {
        route.push({ x: lerp(client.x + inside, pivot.x, k / (TRUNK - 1)), y: client.y });
      }
      for (let k = 0; k < LINE; k += 1) {
        const u = k / (LINE - 1);
        route.push({ x: lerp(contact.x, at.x - inside, u), y: lerp(contact.y, at.y, smooth(u)) });
      }
      providers.push({
        at,
        route,
        turn: (pivot.x - client.x - inside) / polyLengths(route).total,
        angle,
        climb: stub + at.y - railTop.y,
        alive: true,
        listed: true,
        known: false,
        closed: false,
        suspect: false,
        drawn: 0,
        age: 0.4 * i,
        wait: 0.5 + (i * BEAT) / PROVIDERS,
        period: BEAT,
        busy: 0,
      });
    }

    // How far the pointer may move a point: not at all at a node, most in the middle of a
    // span, and the trunk and the dashed links half as far as the lines.
    hold = [];
    for (let k = 0; k < TRUNK; k += 1) hold.push(Math.sin((k / (TRUNK - 1)) * Math.PI) * 5);
    for (let k = 0; k < LINE; k += 1) hold.push(Math.sin((k / (LINE - 1)) * Math.PI) * 10);
    arcHold = [];
    for (let k = 0; k < ARC; k += 1) arcHold.push(Math.sin((k / (ARC - 1)) * Math.PI) * 5);

    const r = 7 * unit + 3;
    lookup = quarter({ x: client.x, y: client.y - edge }, { x: registry.x - r, y: registry.y }, true);
    // The heartbeat link is stored in the direction of travel: top of the rail to registry.
    pulse = quarter({ x: registry.x + r, y: registry.y }, railTop, false).reverse();
    pulseLength = polyLengths(pulse).total;
    beatSpeed = (providers[PROVIDERS - 1].climb + pulseLength) / CLIMB;
    tokens = CAPACITY;
    beats = [];
  }

  /** A new sheet: the exchange and its heartbeats stand, the client starts from nothing. */
  function reset() {
    // Neighbouring seeds give neighbouring first numbers, so the seed is scrambled first.
    const rng = rand(Math.imul(seed, 0x9e3779b1) >>> 0);
    dice = rand(Math.imul(seed + 7, 0x85ebca6b) >>> 0);
    const sheet = Math.abs(seed - first);
    strategy = sheet % STRATEGIES.length;
    // A different provider fails on every sheet, out of step with the strategy.
    const base = Math.floor(rand(Math.imul(first, 0x9e3779b1) >>> 0)() * PROVIDERS);
    failing = (base + sheet + Math.floor(sheet / PROVIDERS)) % PROVIDERS;
    const lame = providers[failing];

    for (const p of providers) {
      p.alive = true;
      p.listed = true;
      p.known = false;
      p.closed = false;
      p.suspect = false;
      p.drawn = 0;
      p.period = BEAT;
    }

    const failAt = OPEN + 1.8 + rng();
    const backAt = failAt + DROP + REST;
    dropAt = failAt + DROP;
    endAt = backAt + 0.3 + (lame.climb + pulseLength) / beatSpeed + HOP + DRAW + OUTRO;
    cues = [
      { at: ASK, run: () => void hops.push({ u: 0, kind: 'query' }) },
      { at: failAt, run: fail },
      {
        at: failAt + MISS,
        run: () => {
          missAt = clock;
        },
      },
      {
        at: dropAt,
        run: () => {
          lame.listed = false;
          hops.push({ u: 0, kind: 'list' });
        },
      },
      {
        at: backAt,
        run: () => {
          lame.alive = true;
          lame.wait = 0.3;
          lame.period = BEAT;
          healAt = clock;
        },
      },
    ];
    cue = 0;
    // Its heartbeats are paced so that one falls due at the very moment it is missed.
    const span = failAt + MISS - lame.wait;
    lame.period = span / Math.max(1, Math.round(span / BEAT));

    clock = 0;
    openAt = Infinity;
    missAt = Infinity;
    healAt = Infinity;
    retryAt = -10;
    looked = false;
    open = false;
    failed = false;
    calls = 0;
    nextSend = Infinity;
    // One burst of healthy traffic comes before the failure. Round-robin starts where its
    // steps will bring it to the failing provider at the right moment.
    burst = 2 + Math.floor(rng() * 2);
    cursor = (failing + 2 * PROVIDERS - burst - 1) % PROVIDERS;
    home = (failing + 1 + Math.floor(rng() * 2)) % PROVIDERS;
    cast = -1;
    armFrom = 0;
    armTo = 0;
    armT = 1;
    lookupGlow = 0;
    messages = [];
    hops = [];
  }

  const usable = (p: Provider) => p.known && p.drawn >= 1 && !p.suspect;

  /** The load balancer: which provider takes the next call, or -1 when none can. */
  function pick(): number {
    let count = 0;
    for (const p of providers) if (usable(p)) count += 1;
    if (count === 0) return -1;
    if (cast >= 0 && usable(providers[cast])) {
      // The film has cast this call; the balancer carries on from there.
      cursor = cast;
      home = cast;
      cast = -1;
      return cursor;
    }
    if (strategy === 0) {
      do cursor = (cursor + 1) % PROVIDERS;
      while (!usable(providers[cursor]));
      return cursor;
    }
    if (strategy === 1) {
      let nth = Math.floor(dice() * count) % count;
      for (let i = 0; i < PROVIDERS; i += 1) {
        if (!usable(providers[i])) continue;
        if (nth === 0) return i;
        nth -= 1;
      }
    }
    // Hash ring: the key of this burst has one owner, or the next one round that is up.
    let at = home;
    while (!usable(providers[at])) at = (at + 1) % PROVIDERS;
    return at;
  }

  function send(to: number, again = false) {
    messages.push({ to, u: 0, kind: 'request', age: 0, routed: false });
    if (!again) calls += 1;
  }

  /** A call leaves for a provider that dies while it is on its way; the exchange falls quiet. */
  function fail() {
    cast = failing;
    const to = pick();
    if (to < 0) return;
    send(to);
    tokens = Math.max(0, tokens - 1);
    providers[failing].alive = false;
    failed = true;
    burst = 0;
    nextSend = clock + 2.6;
  }

  /** The client takes the registry's list: new lines are drawn, dropped ones are closed. */
  function learn() {
    looked = true;
    let order = 0;
    for (const p of providers) {
      if (p.listed && !p.known) {
        p.known = true;
        p.suspect = false;
        p.drawn = (-order * STAGGER) / DRAW;
        order += 1;
      } else if (!p.listed && p.known) {
        p.known = false;
        p.closed = true;
      }
    }
  }

  function step(dt: number) {
    clock += dt;
    while (cue < cues.length && clock >= cues[cue].at) {
      cues[cue].run();
      cue += 1;
    }

    /* providers: a heartbeat whenever one falls due */
    providers.forEach((p, i) => {
      p.age += dt;
      p.wait -= dt;
      if (p.busy > 0) p.busy -= dt;
      if (!p.alive || p.wait > 0) return;
      p.wait += p.period;
      beats.push({ from: i, s: 0, join: !p.listed });
    });

    /* registry: a heartbeat refreshes an entry, a registration adds one and the client is told */
    for (let k = beats.length - 1; k >= 0; k -= 1) {
      const beat = beats[k];
      const p = providers[beat.from];
      beat.s += beatSpeed * dt;
      if (beat.s < p.climb + pulseLength) continue;
      beats.splice(k, 1);
      p.age = 0;
      if (p.listed) continue;
      p.listed = true;
      hops.push({ u: 0, kind: 'list' });
    }

    /* client and registry: the question goes up, the list comes down */
    for (let k = hops.length - 1; k >= 0; k -= 1) {
      const hop = hops[k];
      hop.u += dt / HOP;
      if (hop.u < 1) continue;
      hops.splice(k, 1);
      if (hop.kind === 'query') hops.push({ u: -0.1 / HOP, kind: 'list' });
      else learn();
    }
    lookupGlow = clamp(lookupGlow + (hops.length > 0 ? dt * 5 : -dt * 1.2), 0, 1);

    /* the pen draws the lines the client has learned about */
    providers.forEach((p, i) => {
      if (!p.known || p.drawn >= 1) return;
      p.drawn = Math.min(1, p.drawn + dt / DRAW);
      if (p.drawn < 1) return;
      p.closed = false;
      if (!failed) return;
      // The provider that has come back takes the next call at once.
      cast = i;
      burst = 0;
      nextSend = clock + 0.3;
    });
    if (!open && looked && providers.every(usable)) {
      open = true;
      openAt = clock;
      nextSend = clock + 0.2;
    }

    /* client: calls leave in short bursts, and each one takes a token */
    tokens = Math.min(CAPACITY, tokens + REFILL * dt);
    if (open && clock >= nextSend && tokens >= 1 && clock < endAt - 0.8) {
      if (burst <= 0) {
        burst = cast >= 0 ? 3 : 2 + Math.floor(dice() * 2);
        home = (home + 1 + Math.floor(dice() * 2)) % PROVIDERS;
      }
      const to = pick();
      if (to >= 0) {
        tokens -= 1;
        send(to);
        burst -= 1;
        // Before the failure the film allows one burst only; the failure opens the next.
        if (burst > 0) nextSend = clock + GAP;
        else nextSend = failed ? clock + 1.4 + dice() * 0.7 : Infinity;
      }
    }

    /* calls in flight */
    for (let k = messages.length - 1; k >= 0; k -= 1) {
      const m = messages[k];
      const p = providers[m.to];
      if (m.kind === 'request') {
        m.u += dt / FLIGHT;
        if (!m.routed && m.u >= p.turn) {
          m.routed = true;
          armFrom = lerp(armFrom, armTo, smooth(armT));
          armTo = p.angle;
          armT = 0;
        }
        if (m.u < 1) continue;
        m.u = 1;
        m.kind = p.alive ? 'reply' : 'lost';
        m.age = p.alive ? -ANSWER : 0;
        if (p.alive) p.busy = ANSWER;
      } else if (m.kind === 'reply') {
        if (m.age < 0) m.age += dt;
        else m.u -= dt / FLIGHT;
        if (m.u <= 0) messages.splice(k, 1);
      } else {
        m.age += dt;
        if (m.age < TIMEOUT) continue;
        // No answer: the client stops trusting this line and tries the call on another.
        messages.splice(k, 1);
        p.suspect = true;
        const to = pick();
        if (to < 0) continue;
        send(to, true);
        retryAt = clock;
      }
    }
    if (armT < 1) armT = Math.min(1, armT + dt / 0.14);

    if (clock >= endAt + FADE) {
      seed += 1;
      reset();
    }
  }

  /** The picture is worth stopping on: a call on each of two lines and a heartbeat on the arch. */
  function composed(): boolean {
    let onLines = 0;
    for (const m of messages) if (m.kind !== 'lost' && m.age >= 0 && m.u > 0.45 && m.u < 0.9) onLines += 1;
    return onLines >= 2 && beats.some((b) => b.s > providers[b.from].climb + pulseLength * 0.25);
  }

  /**
   * The reduced-motion picture is a frame of the film itself, reached without drawing: soon
   * after the drop, two providers carrying the traffic. Should motion be switched on later,
   * the film carries on from here.
   */
  function settle() {
    layout();
    reset();
    const from = dropAt + 1.5;
    while (clock < from || (clock < from + 4 && !composed())) step(1 / 30);
    armT = 1;
  }

  /** A push away from the pointer; nodes stay where they are. */
  function warp(base: Point[], weights: number[], frame: Frame): Point[] {
    const { pointer, w, h } = frame;
    if (!pointer.active) return base;
    const sigma = Math.min(w, h) * 0.2;
    const out = new Array<Point>(base.length);
    for (let i = 0; i < base.length; i += 1) {
      const dx = base[i].x - pointer.x;
      const dy = base[i].y - pointer.y;
      const d2 = dx * dx + dy * dy;
      const g = (Math.exp(-d2 / (sigma * sigma)) * weights[i]) / (Math.sqrt(d2) + 0.001);
      out[i] = { x: base[i].x + dx * g, y: base[i].y + dy * g };
    }
    return out;
  }

  return {
    init(w, h, nextSeed) {
      width = w;
      height = h;
      seed = nextSeed;
      first = nextSeed;
      layout();
      reset();
    },

    draw(frame) {
      const { ctx, palette, dt, still } = frame;
      if (still) settle();
      else step(dt);

      const size = Math.max(4, Math.round(5 * unit));
      const dot = Math.max(2, 2.6 * unit);
      const paths = providers.map((p) => warp(p.route, hold, frame));
      const lengths = paths.map(polyLengths);
      const up = warp(lookup, arcHold, frame);
      const down = warp(pulse, arcHold, frame);
      const upLengths = polyLengths(up);
      const downLengths = polyLengths(down);
      // When the sheet is replaced only the client's lines go; the exchange stands.
      const wire = 1 - clamp((clock - endAt) / FADE, 0, 1);

      /* dashed links: client to registry, registry to the rail, and a stub to every provider */
      const dashed = { color: palette.blue, alpha: 0.7, dash: [2, 4] };
      line(ctx, up, dashed);
      line(ctx, down, dashed);
      line(ctx, [railTop, { x: railTop.x, y: providers[PROVIDERS - 1].at.y }], dashed);
      for (const p of providers) {
        line(ctx, [{ x: p.at.x + node / 2 + 1, y: p.at.y }, { x: railTop.x, y: p.at.y }], {
          color: palette.soft,
          alpha: 0.75,
        });
      }

      /* trunk, selector and lines */
      pixelStroke(ctx, paths[0].slice(0, TRUNK), { color: palette.ink, alpha: 0.62, width: 1.8, seed: first * 13 });
      providers.forEach((p, i) => {
        const run = paths[i].slice(TRUNK);
        line(ctx, [pivot, run[0]], { color: palette.soft, alpha: 0.5 });
        if (p.closed) line(ctx, run, { color: palette.soft, alpha: 0.6 * wire, dash: [1, 5] });
        if (!p.known || p.drawn <= 0) return;
        const pts = p.drawn < 1 ? partial(run, p.drawn) : run;
        pixelStroke(ctx, pts, { color: palette.ink, alpha: 0.62 * wire, width: 1.8, seed: seed * 13 + (i + 1) * 97 });
        if (p.drawn < 1 && !still) pen(ctx, pts[pts.length - 1], palette, palette.ink, 3);
      });
      const swing = wire * clamp((clock - openAt) / 0.3, 0, 1);
      if (swing > 0) {
        const angle = lerp(armFrom, armTo, smooth(armT));
        const tip = { x: pivot.x + Math.cos(angle) * reach, y: pivot.y + Math.sin(angle) * reach };
        line(ctx, [pivot, tip], { color: palette.ink, width: unit < 0.85 ? 2 : 2.4, alpha: swing });
      }

      /* dots on the dashed links: solid for a question or a heartbeat, open for a list or a registration */
      for (const hop of hops) {
        if (hop.u < 0) continue;
        const at = pointAt(up, upLengths, hop.kind === 'query' ? hop.u : 1 - hop.u);
        if (hop.kind === 'query') ring(ctx, at, 2.4, { fill: palette.ink });
        else ring(ctx, at, 2.6, { fill: palette.paper, stroke: palette.ink, width: 1.3 });
      }
      for (const beat of beats) {
        const p = providers[beat.from];
        // Out along its own stub, up the rail beside the other providers, then over the arch.
        let at: Point;
        if (beat.s < stub) at = { x: p.at.x + node / 2 + beat.s, y: p.at.y };
        else if (beat.s < p.climb) at = { x: railTop.x, y: p.at.y - (beat.s - stub) };
        else at = pointAt(down, downLengths, (beat.s - p.climb) / pulseLength);
        if (beat.join) ring(ctx, at, 2.6, { fill: palette.paper, stroke: palette.ink, width: 1.3 });
        else ring(ctx, at, 2, { fill: palette.ink, alpha: 0.85 });
      }

      /* calls in flight */
      for (const m of messages) {
        if (m.kind === 'reply' && m.age < 0) continue;
        if (m.kind === 'lost') {
          // The unanswered call waits at the door of the silent provider and fades.
          const door = { x: providers[m.to].at.x - node / 2 - size / 2 - 3, y: providers[m.to].at.y };
          block(ctx, door, size, { fill: palette.ink, alpha: clamp(1 - m.age / TIMEOUT, 0, 1) * 0.9 });
          continue;
        }
        const at = pointAt(paths[m.to], lengths[m.to], m.u);
        if (m.kind === 'request') block(ctx, at, size, { fill: palette.ink, alpha: wire });
        else block(ctx, at, size, { fill: palette.paper, stroke: palette.ink, width: 1.2, alpha: wire });
      }

      /* nodes */
      block(ctx, client, node, { fill: palette.ink });
      ring(ctx, pivot, Math.max(2.2, 3 * unit), { fill: palette.ink });
      // How much of the red mark stands: it is drawn when the heartbeat is missed, lifted on return.
      const struck = clamp((clock - missAt) / MARK, 0, 1);
      const mark = struck * (1 - clamp((clock - healAt) / MARK, 0, 1));
      providers.forEach((p, i) => {
        const down = i === failing ? mark : 0;
        const contact = paths[i][TRUNK];
        ring(ctx, contact, dot, { fill: palette.paper, stroke: palette.soft });
        if (p.known) ring(ctx, contact, dot, { fill: palette.ink, alpha: wire });

        block(ctx, p.at, node, { fill: palette.paper });
        block(ctx, p.at, node, { stroke: palette.ink, width: 1.5, alpha: lerp(1, 0.4, down) });
        if (p.busy > 0) block(ctx, p.at, node - 6, { fill: palette.ink });
        const name = { x: railTop.x + 8, y: p.at.y };
        label(ctx, `P${i + 1}`, name, palette, { size: 10, alpha: 1 - down });
        if (down <= 0) return;
        // The one red mark of the drawing: two pen strokes through the silent provider.
        label(ctx, `P${i + 1} DOWN`, name, palette, { size: 10, color: palette.signal, alpha: down });
        const k = node * 0.8;
        const fall = [{ x: p.at.x - k, y: p.at.y - k }, p.at, { x: p.at.x + k, y: p.at.y + k }];
        const rise = [{ x: p.at.x + k, y: p.at.y - k }, p.at, { x: p.at.x - k, y: p.at.y + k }];
        const red = { color: palette.signal, width: 1.8, alpha: down / struck };
        pixelStroke(ctx, partial(fall, clamp(struck * 2, 0, 1)), { ...red, seed: seed + 5 });
        if (struck > 0.5) pixelStroke(ctx, partial(rise, struck * 2 - 1), { ...red, seed: seed + 9 });
      });

      /* registry: a ring, and one mark per provider that fades until the next heartbeat */
      const r = 7 * unit;
      ring(ctx, registry, r, { fill: palette.paper, stroke: palette.ink, width: 1.5 });
      providers.forEach((p, i) => {
        const at = { x: registry.x + (i - 1) * 8, y: registry.y + r + 9 };
        if (p.listed) block(ctx, at, 4, { fill: palette.ink, alpha: lerp(1, 0.2, clamp(p.age / (BEAT * 2), 0, 1)) });
        else block(ctx, at, 5, { stroke: palette.soft, width: 1, alpha: 0.8 });
      });

      /* token bucket: filled from the bottom */
      const pitch = size + 2;
      const bucket = client.y + node / 2 + 8;
      for (let k = 0; k < CAPACITY; k += 1) {
        const at = { x: client.x, y: bucket + (CAPACITY - 1 - k) * pitch + size / 2 };
        const level = clamp(tokens - k, 0, 1);
        block(ctx, at, size, { stroke: palette.soft, width: 1, alpha: 0.7 });
        if (level > 0) block(ctx, at, size, { fill: palette.ink, alpha: level * 0.9 });
      }

      /* lettering: the two words on the dashed links move with their lines */
      const side = client.x + node / 2 + 7;
      label(ctx, 'CLIENT', { x: side, y: client.y - node / 2 - 10 }, palette, { size: 10 });
      label(ctx, 'TOKENS', { x: side, y: bucket + (CAPACITY * pitch) / 2 }, palette, { size: 10 });
      label(ctx, 'REGISTRY', { x: registry.x, y: registry.y - r - 10 }, palette, { size: 10, align: 'center' });
      const beatNote = pointAt(down, downLengths, 0.5);
      label(ctx, 'HEARTBEAT', { x: beatNote.x + 10, y: beatNote.y - 10 }, palette, { size: 10, color: palette.blue });
      if (lookupGlow > 0) {
        const note = pointAt(up, upLengths, 0.5);
        label(ctx, 'LOOKUP', { x: note.x - 10, y: note.y - 10 }, palette, {
          size: 10,
          align: 'right',
          alpha: lookupGlow,
        });
      }
      // Under the selector, for a moment: the call that got no answer is sent again.
      const again = clamp((retryAt + 1.2 - clock) / 0.3, 0, 1);
      if (again > 0) {
        label(ctx, 'RETRY', { x: pivot.x + reach * 0.5, y: pivot.y + reach + 16 }, palette, {
          size: 10,
          align: 'center',
          color: palette.ink,
          alpha: again,
        });
      }
    },

    readout() {
      let up = 0;
      for (const p of providers) if (p.listed) up += 1;
      return `${looked ? STRATEGIES[strategy] : 'LOOKUP'} · ${up}/${PROVIDERS} UP · ${calls} CALLS`;
    },
  };
}
