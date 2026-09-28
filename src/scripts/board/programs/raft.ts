/**
 * RAFT
 * Five servers keep five copies of one message log, drawn as five tapes that run under a
 * fixed head, the dashed COMMIT line in the middle of the sheet. The leader (a solid dot
 * inside a double ring) takes each new message, which slides in from the right, and copies
 * it to the other tapes; its heartbeats, small solid squares, travel along the bus on the
 * left. A message is hollow until three of the five hold it; then it turns solid and the
 * tapes move on by one column. Then the leader fails (the red cross, its tape goes dashed)
 * and the bus falls silent. Election timers, thin arcs, appear around the others and run
 * down; the first to reach zero asks for votes (hollow squares), the votes come back one
 * by one (solid squares), it wins, the term goes up and writing resumes. The failed server
 * comes back and is sent what it missed.
 */
import {
  type Frame,
  type Point,
  type Program,
  TAU,
  block,
  clamp,
  label,
  lerp,
  line,
  partial,
  perturb,
  pixelStroke,
  rand,
  ring,
  smooth,
} from '../kit';

const NODES = 5;
const MAJORITY = 3;
const SHOWN = 5; // committed columns kept on the sheet, left of the commit line
const BEAT = 2.0; // seconds between heartbeats, give or take
const HOP = 0.45; // seconds a signal needs from one server to the next
const PAUSE = 0.7; // least seconds between two votes, so that every count can be read
const COPY = 0.26; // seconds a message needs from one tape to the next
const LAG = 0.35; // seconds the leader holds a message before passing it on
const SLIDE = 0.5; // seconds a new message takes to slide in
const STEP = 0.35; // seconds the tapes take to move on by one column
const HOLD = 1.3; // seconds to rest once all five tapes agree

type Role = 'leader' | 'follower' | 'candidate' | 'down';

interface Entry {
  slot: number;
  writer: number;
  /** when it lands on the writer's tape */
  born: number;
  /** when a copy leaves for, and lands on, each other tape (Infinity: never) */
  depart: number[];
  arrive: number[];
  commit: number;
  /** when the writer's own copy is overwritten (only for a message that was never passed on) */
  erased: number;
}

interface Pulse {
  from: number;
  to: number;
  t0: number;
  t1: number;
  kind: 'beat' | 'ask' | 'vote';
}

/** One reel of the film: everything that happens, with the second at which it happens. */
interface Script {
  seed: number;
  term: number;
  /** messages committed before the first column of this reel */
  before: number;
  leader: number;
  heir: number;
  entries: Entry[];
  pulses: Pulse[];
  /** election timers: last wound up at `wound`, due `timeout` seconds later, put away at `asked` */
  wound: number[];
  timeout: number[];
  asked: number[];
  votes: number[];
  used: number;
  fail: number;
  expire: number;
  won: number;
  back: number;
  synced: number;
  total: number;
}

const scramble = (seed: number) => Math.imul(seed >>> 0, 2654435761) >>> 0;
const name = (n: number) => `N${n + 1}`;
const wrap = (v: number, period: number) => ((v % period) + period) % period;

function compose(seed: number, term: number, before: number, leader: number, tired: number): Script {
  const rng = rand(scramble(seed));
  rng();
  const entries: Entry[] = [];
  const pulses: Pulse[] = [];
  const never = () => new Array<number>(NODES).fill(Infinity);
  const gap = () => 1.0 + rng() * 0.35;
  /** Seconds after which a signal from server n has reached every other server. */
  const reach = (n: number) => Math.max(n, NODES - 1 - n) * HOP + 0.1;

  /** The heartbeats of one leader, evenly spaced from `first` to `last`. */
  const beats = (from: number, first: number, last: number, down: number, until: number) => {
    const count = Math.max(1, Math.round((last - first) / BEAT));
    for (let i = 0; i <= count; i += 1) {
      const at = lerp(first, last, i / count);
      for (let n = 0; n < NODES; n += 1) {
        if (n === from || (n === down && at < until)) continue;
        pulses.push({ from, to: n, t0: at, t1: at + Math.abs(n - from) * HOP, kind: 'beat' });
      }
    }
  };

  let settled = 0;
  const write = (writer: number, born: number, slot: number, down: number): Entry => {
    const depart = never();
    const arrive = never();
    const landed: number[] = [];
    for (let n = 0; n < NODES; n += 1) {
      if (n === writer || n === down) continue;
      depart[n] = born + LAG;
      arrive[n] = depart[n] + Math.abs(n - writer) * COPY;
      landed.push(arrive[n]);
    }
    landed.sort((a, b) => a - b);
    settled = landed[landed.length - 1];
    // The writer holds it too, so two more copies make a majority.
    const entry: Entry = { slot, writer, born, depart, arrive, commit: landed[MAJORITY - 2], erased: Infinity };
    entries.push(entry);
    return entry;
  };

  // What the reel before left on the sheet.
  for (let slot = 0; slot < SHOWN; slot += 1) {
    entries.push({
      slot,
      writer: leader,
      born: -Infinity,
      depart: never(),
      arrive: new Array<number>(NODES).fill(-Infinity),
      commit: -Infinity,
      erased: Infinity,
    });
  }

  // 1. The leader takes messages and copies them to the others.
  let slot = SHOWN;
  let clock = 1.0 + rng() * 0.3;
  const first = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < first; i += 1) {
    write(leader, clock, slot, -1);
    slot += 1;
    clock += gap();
  }

  // 2. It fails. Every other time it fails holding a message it never passed on.
  let orphan: Entry | null = null;
  let fail = Math.max(settled + 0.4, clock - 0.4);
  if (rng() < 0.5) {
    orphan = { slot, writer: leader, born: clock, depart: never(), arrive: never(), commit: Infinity, erased: Infinity };
    entries.push(orphan);
    fail = clock + LAG * 0.8;
  }
  // Its last heartbeat has reached everyone by then, so the bus is silent after the failure.
  const lastBeat = fail - reach(leader);
  beats(leader, 0.1, lastBeat, -1, 0);

  // 3. Nothing winds the election timers up again; the heir's runs out first.
  const followers: number[] = [];
  for (let n = 0; n < NODES; n += 1) if (n !== leader) followers.push(n);
  // Not the server that led the reel before, so the lead keeps moving around.
  const fit = followers.filter((n) => n !== tired);
  const heir = fit[Math.floor(rng() * fit.length)];
  const expire = fail + 1.5 + rng() * 0.5;
  const wound = never();
  const timeout = never();
  const asked = never();
  for (const n of followers) {
    wound[n] = lastBeat + Math.abs(n - leader) * HOP;
    asked[n] = expire + Math.abs(n - heir) * HOP;
    timeout[n] = asked[n] - wound[n] + (n === heir ? 0 : 0.5 + rng() * 0.7);
  }

  // It asks the others for their vote. They answer one after the other, the nearest first,
  // so that no two votes land together.
  const side = rng() < 0.5 ? 1 : -1;
  const voters = followers
    .filter((n) => n !== heir)
    .sort((a, b) => Math.abs(a - heir) - Math.abs(b - heir) || (a - b) * side);
  const votes: number[] = [];
  let landed = expire;
  for (const n of voters) {
    const hop = Math.abs(n - heir) * HOP;
    pulses.push({ from: heir, to: n, t0: expire, t1: asked[n], kind: 'ask' });
    landed = Math.max(asked[n] + 0.12 + hop, landed + PAUSE);
    pulses.push({ from: n, to: heir, t0: landed - hop, t1: landed, kind: 'vote' });
    votes.push(landed);
  }
  // Its own vote and two more.
  const won = votes[MAJORITY - 2];

  // 4. The new leader writes on; the failed server misses these.
  const missed: Entry[] = [];
  clock = won + 1.0;
  const behind = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < behind; i += 1) {
    missed.push(write(heir, clock, slot, leader));
    slot += 1;
    clock += gap();
  }

  // 5. The failed server returns and is sent what it missed, one message after another.
  const back = settled + 0.6;
  let turn = back + 0.8;
  for (const entry of missed) {
    entry.depart[leader] = turn;
    entry.arrive[leader] = turn + Math.abs(leader - heir) * COPY * 0.6;
    turn += 0.24;
  }
  const synced = missed[missed.length - 1].arrive[leader];
  if (orphan) orphan.erased = missed[0].arrive[leader];

  // 6. All five agree again.
  clock = synced + 0.7;
  const last = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < last; i += 1) {
    write(heir, clock, slot, -1);
    slot += 1;
    clock += gap();
  }
  const total = settled + HOLD;

  // The new leader announces itself at once. Its last heartbeat of the reel has arrived
  // everywhere before the reel ends, and the next reel picks up the rhythm.
  beats(heir, won, total - reach(heir), leader, back);

  return {
    seed,
    term,
    before,
    leader,
    heir,
    entries,
    pulses,
    wound,
    timeout,
    asked,
    votes,
    used: slot,
    fail,
    expire,
    won,
    back,
    synced,
    total,
  };
}

/** The reel that follows: the heir leads and the term has gone up. */
function follow(prev: Script): Script {
  return compose(prev.seed + 7919, prev.term + 1, prev.before + prev.used - SHOWN, prev.heir, prev.leader);
}

function roleOf(script: Script, n: number, s: number): Role {
  if (n === script.leader) return s < script.fail ? 'leader' : s < script.back ? 'down' : 'follower';
  if (n === script.heir) return s < script.expire ? 'follower' : s < script.won ? 'candidate' : 'leader';
  return 'follower';
}

export default function raft(): Program {
  let script = compose(1, 1, 0, 0, -1);
  let origin = 0; // second at which the current reel began
  let baseSeed = 1;
  let width = 1;
  let height = 1;

  let labelX = 0;
  let nodeX = 0;
  let logX = 0;
  let commitX = 0;
  let edge = 0;
  let pitch = 1;
  let size = 1;
  let radius = 1;
  let sub = 1; // pen points per column of tape
  let headY = 0;
  let footY = 0;
  const rowY = new Array<number>(NODES).fill(0);

  let shownTerm = 1;
  let shownCommit = 0;
  let shownState = '';

  function layout() {
    radius = clamp(height * 0.02, 4, 6.5);
    labelX = Math.max(14, width * 0.055);
    nodeX = labelX + 24 + radius * 2.4;
    logX = nodeX + radius * 2 + 22;
    edge = width - Math.max(16, width * 0.05);
    commitX = Math.round(width * 0.5) + 0.5;
    pitch = (commitX - logX) / (SHOWN - 0.5);
    size = clamp(Math.round(pitch * 0.36), 6, 12);
    sub = Math.max(1, Math.round(pitch / 14));
    const top = Math.max(40, height * 0.2);
    const bottom = Math.max(38, height * 0.19);
    for (let n = 0; n < NODES; n += 1) rowY[n] = Math.round(lerp(top, height - bottom, n / (NODES - 1)));
    headY = Math.round(top * 0.42);
    footY = Math.round(height - bottom * 0.4);
  }

  function arc(frame: Frame, at: Point, r: number, share: number, color: string, alpha: number, weight: number) {
    if (share <= 0) return;
    const { ctx } = frame;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = weight;
    ctx.beginPath();
    ctx.arc(at.x, at.y, r, -TAU / 4, -TAU / 4 + TAU * Math.min(1, share));
    ctx.stroke();
    ctx.restore();
  }

  /** How far tape n has been written, in columns. It grows just before a message lands. */
  function headOf(n: number, s: number): number {
    let head = 0;
    for (const entry of script.entries) {
      const landing = n === entry.writer ? entry.born : entry.arrive[n];
      if (s <= landing - 0.25) continue;
      if (n === entry.writer && s >= entry.erased) continue;
      const u = landing === -Infinity ? 1 : clamp((s - landing) / 0.25 + 1, 0, 1);
      head = Math.max(head, entry.slot - 1 + smooth(u));
    }
    return head;
  }

  return {
    init(w, h, nextSeed) {
      width = w;
      height = h;
      baseSeed = nextSeed;
      layout();
      const rng = rand(scramble(nextSeed + 11));
      rng();
      const leader = Math.floor(rng() * NODES);
      script = compose(nextSeed, 1 + Math.floor(rng() * 3), 4 + Math.floor(rng() * 9), leader, -1);
      origin = 0;
      shownTerm = script.term;
      shownCommit = script.before + SHOWN;
      shownState = `LEADER ${name(script.leader)}`;
    },

    draw(frame) {
      const { ctx, palette, pointer, still } = frame;

      // Which second of which reel. The still picture is the moment before the failed
      // server returns: one server down, a new leader, a new term, one tape behind.
      let s = script.back - 0.05;
      if (!still) {
        const now = frame.t / 1000;
        for (let i = 0; i < 4 && now - origin >= script.total; i += 1) {
          origin += script.total;
          script = follow(script);
        }
        if (now - origin >= script.total) origin = now;
        s = Math.max(0, now - origin);
      }

      const reach = Math.min(width, height) * 0.24;
      const nudge = (pts: Point[]) => perturb(pts, pointer, reach, 7);
      const nudged = (x: number, y: number) => nudge([{ x, y }])[0];

      // Every commit moves the tapes one column to the left, under the fixed commit line.
      let committed = 0;
      let moved = 0;
      for (const entry of script.entries) {
        if (entry.commit > s) continue;
        committed += 1;
        if (entry.commit !== -Infinity) moved += smooth(clamp((s - entry.commit) / STEP, 0, 1));
      }
      const slotX = (slot: number) => commitX - pitch / 2 + (slot - (SHOWN - 1) - moved) * pitch;
      const slotAt = (x: number) => (x - commitX + pitch / 2) / pitch + (SHOWN - 1) + moved;
      const from = nodeX + radius + 10; // where the tapes begin
      // The older a column, the paler, in three strengths. It is gone before it meets the server.
      const gone = from + size / 2;
      const fade = (x: number) =>
        x < logX ? 0.22 * clamp((x - gone) / (logX - gone), 0, 1) : Math.min(1, 0.22 + (0.44 * (x - logX)) / pitch);
      const roles: Role[] = [];
      for (let n = 0; n < NODES; n += 1) roles.push(roleOf(script, n, s));
      const halo = radius + 4.5;

      // The bus the servers talk over.
      line(ctx, nudge(rowY.map((y) => ({ x: nodeX, y }))), { color: palette.soft, alpha: 0.4, width: 1 });

      // The tapes: written so far by the pen, the rest still blank and fading into the sheet.
      for (let n = 0; n < NODES; n += 1) {
        const y = rowY[n];
        const to = Math.max(from + 6, slotX(headOf(n, s)) + pitch * 0.5 - 4);
        const x0 = nudged(from, y).x;
        const x1 = nudged(to, y).x;
        // The line belongs to the tape, not to the sheet: it is drawn past both ends and
        // cut off at the server and at the head, so it travels with the messages.
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0, 0, x1 - x0, height);
        ctx.clip();
        if (roles[n] === 'down') {
          // The dashes keep their place on the tape too.
          const start = from - wrap(from - slotX(-script.before), 7);
          const spans = Math.max(1, Math.round((to - start) / 14));
          const pts: Point[] = [];
          for (let i = 0; i <= spans; i += 1) pts.push({ x: lerp(start, to, i / spans), y });
          line(ctx, nudge(pts), { color: palette.soft, alpha: 0.9, width: 1, dash: [3, 4] });
        } else {
          // Pen points sit at fixed places on the tape and are numbered from its beginning.
          // pixelStroke seeds point j with seed + j * 31 and blots every fifth, so starting
          // at a multiple of five keeps both the wobble and the blots where they were.
          const first = Math.floor(((slotAt(from - 3) + script.before) * sub) / 5) * 5;
          const last = Math.ceil((slotAt(to + 3) + script.before) * sub);
          const pts: Point[] = [];
          for (let k = first; k <= last; k += 1) pts.push({ x: slotX(k / sub - script.before), y });
          const leads = roles[n] === 'leader';
          pixelStroke(ctx, nudge(pts), {
            color: leads ? palette.ink : palette.soft,
            alpha: leads ? 0.85 : 0.7,
            width: 1.5,
            seed: baseSeed + n * 97 + first * 31,
          });
        }
        ctx.restore();
        // Three strengths, laid end to end so that the round caps do not overlap.
        const blank = [0.22, 0.13, 0.06];
        for (let k = 0; k < blank.length; k += 1) {
          const a = { x: lerp(to, edge, k / blank.length) + 0.5, y };
          const b = { x: lerp(to, edge, (k + 1) / blank.length) - 0.5, y };
          line(ctx, nudge([a, b]), { color: palette.soft, alpha: blank[k], width: 1 });
        }
      }

      // The commit line: everything to its left is held by a majority. Its two ends keep
      // their height, so a nudge never pushes it into the lettering above and below.
      const over = Math.min(14, (rowY[1] - rowY[0]) * 0.3);
      const spine: Point[] = [];
      for (let i = 0; i <= 8; i += 1) spine.push({ x: commitX, y: lerp(rowY[0] - over, rowY[NODES - 1] + over, i / 8) });
      const bent = nudge(spine).map((p, i) => (i === 0 || i === 8 ? { x: p.x, y: spine[i].y } : p));
      line(ctx, bent, { color: palette.ochre, alpha: 0.95, width: 1.2, dash: [2, 3] });

      // Messages: hollow while only some hold them, solid once committed.
      for (const entry of script.entries) {
        const solid = entry.commit <= s;
        const x = slotX(entry.slot);
        for (let n = 0; n < NODES; n += 1) {
          const own = n === entry.writer;
          const landing = own ? entry.born : entry.arrive[n];
          if (landing <= s) {
            if (own && s >= entry.erased) continue;
            const down = roles[n] === 'down';
            let alpha = fade(x);
            if (alpha <= 0) continue;
            // The tape of the failed server is drawn in grey; keep its old messages readable.
            if (down) alpha = Math.max(alpha, 0.5 * Math.min(1, alpha / 0.1));
            const at = nudged(x, rowY[n]);
            const color = down ? palette.soft : palette.ink;
            // Paper first, so the tape does not show through a pale message.
            block(ctx, at, size, { fill: palette.paper, alpha: Math.min(1, alpha * 5) });
            if (solid) block(ctx, at, size, { fill: color, alpha: alpha * 0.9 });
            else block(ctx, at, size, { stroke: color, alpha, width: 1.5 });
          } else if (still) {
            continue;
          } else if (own && s > entry.born - SLIDE) {
            // A new message arrives from the right, along the leader's tape.
            const u = (s - (entry.born - SLIDE)) / SLIDE;
            const ease = 1 - Math.pow(1 - u, 3);
            const at = nudged(x + (1 - ease) * pitch * 3, rowY[n]);
            block(ctx, at, size, { fill: palette.paper, alpha: u });
            block(ctx, at, size, { stroke: palette.ink, alpha: u, width: 1.5 });
          } else if (!own && entry.depart[n] <= s) {
            // A copy on its way to another tape. It passes behind the tapes in between.
            const u = (s - entry.depart[n]) / (entry.arrive[n] - entry.depart[n]);
            const y = lerp(rowY[entry.writer], rowY[n], u);
            const small = Math.max(4, Math.round(size * 0.6));
            if (rowY.some((row) => Math.abs(row - y) < (size + small) / 2 + 1)) continue;
            const at = nudged(x, y);
            if (solid) block(ctx, at, small, { fill: palette.ink, alpha: 0.85 });
            else block(ctx, at, small, { fill: palette.paper, stroke: palette.ink, alpha: 0.9, width: 1.2 });
          }
        }
      }

      // Signals on the bus: heartbeats are small and solid, vote requests hollow, votes solid.
      // They are drawn before the servers, so they slide under each one they pass.
      if (!still) {
        for (const pulse of script.pulses) {
          if (s < pulse.t0 || s >= pulse.t1) continue;
          const y = lerp(rowY[pulse.from], rowY[pulse.to], (s - pulse.t0) / (pulse.t1 - pulse.t0));
          const at = nudged(nodeX, y);
          if (pulse.kind === 'ask') block(ctx, at, 6, { fill: palette.paper, stroke: palette.ink, width: 1.2 });
          else block(ctx, at, pulse.kind === 'vote' ? 6 : 5, { fill: palette.ink, alpha: 0.9 });
        }
      }

      // The servers.
      let tally = 1;
      for (const at of script.votes) if (at <= s) tally += 1;
      for (let n = 0; n < NODES; n += 1) {
        const at = nudged(nodeX, rowY[n]);
        const role = roles[n];
        // How much of the failure mark is left: it fades once the server has returned.
        const mark = n === script.leader && s >= script.fail ? 1 - clamp((s - script.back) / 0.3, 0, 1) : 0;
        ring(ctx, at, halo + 1.5, { fill: palette.paper });
        if (role === 'leader') {
          ring(ctx, at, halo, { stroke: palette.ink, width: 1.4 });
          ring(ctx, at, radius - 1, { fill: palette.ink });
        } else if (role === 'down') {
          ring(ctx, at, radius, { stroke: palette.soft, width: 1.2, alpha: 0.8 });
        } else if (role === 'candidate') {
          // The outer ring closes as the votes come in.
          ring(ctx, at, halo, { stroke: palette.soft, width: 1, dash: [2, 3] });
          arc(frame, at, halo, tally / MAJORITY, palette.ink, 1, 1.4);
          ring(ctx, at, radius, { stroke: palette.ink, width: 1.4 });
        } else {
          // The election timer is only shown while it matters: from the failure until
          // this server is asked for its vote, or asks for votes itself.
          if (!still && n !== script.leader && s >= script.fail) {
            const until = Math.min(script.asked[n], script.won);
            const show = clamp((s - script.fail) / 0.3, 0, 1) * (1 - clamp((s - until) / 0.25, 0, 1));
            const left = 1 - (s - script.wound[n]) / script.timeout[n];
            if (show > 0) arc(frame, at, halo, left, palette.soft, 0.9 * show, 1);
          }
          ring(ctx, at, radius, { stroke: palette.ink, width: 1.4 });
        }
        if (mark > 0) {
          // The cross is struck in two strokes. It is the one exact mark on the sheet.
          const arm = Math.max(radius + 3, 9);
          const struck = still ? 2 : (s - script.fail) / 0.14;
          for (let i = 0; i < 2; i += 1) {
            const u = clamp(struck - i, 0, 1);
            if (u <= 0) continue;
            const lean = i === 0 ? arm : -arm;
            const stroke = [
              { x: at.x - lean, y: at.y - arm },
              { x: at.x + lean, y: at.y + arm },
            ];
            line(ctx, partial(stroke, u), { color: palette.signal, alpha: mark, width: 2.2 });
          }
        }
        const plain = role === 'leader' ? palette.ink : palette.soft;
        if (mark < 1) label(ctx, name(n), { x: labelX, y: rowY[n] }, palette, { color: plain, alpha: 1 - mark, tracking: 1 });
        if (mark > 0) label(ctx, name(n), { x: labelX, y: rowY[n] }, palette, { color: palette.signal, alpha: mark, tracking: 1 });
      }

      // The caption of the film, and the read-out.
      const old = name(script.leader);
      const heir = name(script.heir);
      let caption = `LEADER ${heir}`;
      let alarm = false;
      shownState = caption;
      if (s < script.fail) {
        caption = `LEADER ${old}`;
        shownState = caption;
      } else if (s < script.expire) {
        caption = `${old} DOWN`;
        shownState = caption;
        alarm = true;
      } else if (s < script.won) {
        caption = `${heir} ASKS FOR VOTES · ${tally}/${NODES}`;
        shownState = `ELECTION ${tally}/${NODES}`;
      } else if (s < Math.min(script.won + 1.4, script.back) && !still) {
        caption = `${heir} ELECTED · ${MAJORITY}/${NODES}`;
      } else if (s >= script.back && s < script.synced) {
        caption = `${old} BACK · CATCHING UP`;
        shownState = `${old} CATCHING UP`;
      }
      shownTerm = s < script.expire ? script.term : script.term + 1;
      shownCommit = script.before + committed;

      const termText = `TERM ${shownTerm}`;
      label(ctx, termText, { x: labelX, y: headY }, palette, { color: palette.ink, tracking: 1 });
      label(ctx, caption, { x: Math.max(logX - size / 2, labelX + termText.length * 7.6 + 12), y: headY }, palette, {
        color: alarm ? palette.signal : palette.soft,
        tracking: 1,
      });
      label(ctx, `COMMIT ${shownCommit}`, { x: commitX, y: footY }, palette, {
        align: 'center',
        tracking: 1,
        color: palette.ochre,
      });
    },

    readout() {
      return `TERM ${shownTerm} · ${shownState} · COMMIT ${shownCommit}`;
    },
  };
}
