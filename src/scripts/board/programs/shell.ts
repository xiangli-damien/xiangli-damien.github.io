/**
 * SHELL
 * One session in msh, a small Linux shell. Commands are typed on the line at the bottom.
 * The square in the corner is the shell, and every command forks a child from it: the pen
 * draws a line from the shell to a new square. The foreground job sits at the end of the
 * heavy line that runs to the right; background jobs hang on thin branches below; a stopped
 * job is a hollow square on a dashed branch. A job that changes place is not carried across
 * the sheet: its line is wound back into the shell and drawn again along the tree.
 * Ctrl-C, Ctrl-Z and kill are the red marks: a signal leaves the shell, travels to the job
 * and ends or stops it. When the job table is empty again a new session begins, with other
 * commands in another order.
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
  pen,
  pixelStroke,
  rand,
  ring,
  smooth,
  snap,
} from '../kit';

const ROWS = 2; // places in the job table
const PITCH = 4; // distance between the points of a line, px
const END = 4; // a line stops this far short of its node, so the node always covers its end
const KEY = 0.085; // seconds per typed character
const EASE = 0.25; // seconds a job takes to change between running and stopped
const PUSH = 9; // how far the pointer can bend a line, px
const THIN = 1.6;
const HEAVY = 2.4;
const PROMPT = 'msh>';
const SCRIPTS = 4;
const STILL_SCRIPT = 2; // the session that holds three jobs at once

type Signal = 'SIGINT' | 'SIGTSTP' | 'SIGTERM';

interface Command {
  text: string;
  name: string;
}

const LONG: Command[] = [
  { text: 'sleep 30', name: 'SLEEP' },
  { text: 'make', name: 'MAKE' },
  { text: './train', name: 'TRAIN' },
  { text: 'vim notes', name: 'VIM' },
  { text: 'tail -f log', name: 'TAIL' },
  { text: 'cc msh.c', name: 'CC' },
  { text: 'find / -name x', name: 'FIND' },
  { text: 'top', name: 'TOP' },
];

// Short-lived commands with redirection: they run in the foreground and exit by themselves.
const SHORT: Command[] = [
  { text: 'ls > out', name: 'LS' },
  { text: 'sort < in', name: 'SORT' },
  { text: 'wc < log', name: 'WC' },
  { text: 'cat a > b', name: 'CAT' },
];

interface Job {
  pid: number;
  name: string;
  /** forked and not yet reaped */
  live: boolean;
  /** 0 = foreground, 1.. = place in the job table */
  row: number;
  /** fraction of the way from the shell that has been drawn */
  grow: number;
  /** 0 = running, 1 = stopped; eased, so that the two line styles fade into each other */
  stopped: number;
  /** hit by a fatal signal: the node becomes a cross */
  ended: boolean;
  size: number;
  ink: number;
}

type Step =
  | { kind: 'prompt'; dur: number }
  | { kind: 'type'; dur: number; text: string }
  | { kind: 'key'; dur: number; text: string }
  | { kind: 'recall'; dur: number; text: string }
  | { kind: 'run'; dur: number }
  | { kind: 'fork'; dur: number; job: number; row: number }
  | { kind: 'move'; dur: number; job: number; row: number }
  | { kind: 'wake'; dur: number; job: number }
  | { kind: 'signal'; dur: number; job: number; signal: Signal }
  | { kind: 'hit'; dur: number; job: number; signal: Signal }
  | { kind: 'exit'; dur: number; job: number };

export default function shell(): Program {
  let seed = 1;
  let width = 1;
  let height = 1;
  let compact = false;

  // Geometry: the shell, the foreground slot at the far end, the rows of the job table.
  let origin: Point = { x: 0, y: 0 };
  let far = 1;
  let branch = 1;
  let gap = 1;
  let baseline = 1;
  let reach = 1;

  // These last for the whole life of the program: one shell, pids that only go up.
  let shellPid = 4000;
  let pid = 4000;
  let script = -1;
  let unplayed: number[] = [];
  let recent: string[] = [];

  let jobs: Job[] = [];
  let steps: Step[] = [];
  let freeze = -1;
  let index = 0;
  let clock = 0;
  let begun = false;
  let settled = false;
  /** how far down the trunk has been drawn, px */
  let depth = 0;

  // The command line.
  let typed = '';
  let echo = '';
  let keys = '';
  let cursor = false;
  let typing = false;

  // The travelling mark: a signal (red) or a plain continue (ink).
  const mark = { on: false, job: 0, u: 0, fade: 1, ripple: 0, signal: null as Signal | null };
  // The job whose line the pen is drawing, and whether that line is a fork.
  let drawing = -1;
  let forking = false;

  const junction = (row: number): Point => ({ x: origin.x, y: origin.y + gap * row });
  const slot = (row: number): Point =>
    row === 0 ? { x: far, y: origin.y } : { x: origin.x + branch, y: origin.y + gap * row };
  /** Length of the way from the shell to a slot: down the trunk, then along the branch. */
  const span = (row: number) => (row === 0 ? far - origin.x : gap * row + branch);
  /** How much of that way a job has drawn, px. */
  const lay = (job: Job) => job.grow * span(job.row);
  /** Drawn length of the job's own line, the part after the trunk. */
  const out = (job: Job) =>
    clamp(lay(job) - (job.row === 0 ? 0 : gap * job.row), 0, (job.row === 0 ? far - origin.x : branch) - END);

  /**
   * Drawn length of one leg of the trunk, from junction k to the next. The last leg stops
   * just short of its junction, so no spur shows below the corner where a branch turns off.
   */
  const legDrawn = (k: number) => Math.min(clamp(depth - k * gap, 0, gap), depth > (k + 1) * gap ? gap : gap - 2);

  function layout() {
    compact = width < 380;
    const mx = Math.max(30, width * 0.1);
    origin = { x: Math.round(mx + 5), y: Math.round(height * 0.27) };
    far = Math.round(width - mx - 5);
    branch = Math.round(clamp(width * 0.2, 52, 150));
    gap = Math.round(clamp(height * 0.135, 30, 60));
    baseline = Math.round(height - Math.max(26, height * 0.13));
    reach = Math.min(width, height) * 0.2;
  }

  /** Write the script of one session. Every session ends with an empty job table. */
  function compose(forced = -1) {
    const rng = rand((seed * 9973 + 17) >>> 0);
    // The seed draws the script from those not yet played: all four are seen before one
    // comes back, and never the same one twice in a row.
    if (unplayed.length === 0) {
      for (let i = 0; i < SCRIPTS; i += 1) if (i !== script) unplayed.push(i);
    }
    const pick = unplayed.splice(Math.floor(rng() * unplayed.length), 1)[0];
    script = forced >= 0 ? forced : pick;

    // Commands of the session before are left out, so two sessions in a row never look alike.
    const pool = LONG.filter((command) => !recent.includes(command.name));
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const k = Math.floor(rng() * (i + 1));
      [pool[i], pool[k]] = [pool[k], pool[i]];
    }
    const quick = SHORT[Math.floor(rng() * SHORT.length)];
    const table = new Array<number>(ROWS).fill(-1);
    jobs = [];
    steps = [];
    freeze = -1;

    const spawn = (command: Command): number => {
      if (pid > 9900) pid = shellPid;
      pid += 1 + Math.floor(rng() * 3);
      jobs.push({
        pid,
        name: command.name,
        live: false,
        row: 0,
        grow: 0,
        stopped: 0,
        ended: false,
        size: 0,
        ink: 0,
      });
      return jobs.length - 1;
    };
    const enter = (job: number): number => {
      const free = Math.max(0, table.indexOf(-1));
      table[free] = job;
      return free + 1;
    };
    const leave = (job: number): number => {
      const held = Math.max(0, table.indexOf(job));
      table[held] = -1;
      return held + 1;
    };
    const say = (text: string) => {
      steps.push({ kind: 'prompt', dur: 0.55 }, { kind: 'type', dur: text.length * KEY + 0.35, text });
    };
    const strike = (job: number, signal: Signal, dur: number) => {
      steps.push({ kind: 'signal', dur, job, signal }, { kind: 'hit', dur: 0.8, job, signal });
    };

    const launch = (command: Command, background: boolean, again = false): number => {
      const job = spawn(command);
      if (background) {
        say(`${command.text} &`);
        steps.push({ kind: 'fork', dur: 0.9, job, row: enter(job) }, { kind: 'run', dur: 0.5 });
      } else {
        // History: "!!" is typed, and the shell echoes the command it stands for.
        say(again ? '!!' : command.text);
        if (again) steps.push({ kind: 'recall', dur: 0.7, text: command.text });
        steps.push({ kind: 'fork', dur: 1, job, row: 0 }, { kind: 'run', dur: 1.3 });
      }
      return job;
    };
    const once = (command: Command) => {
      const job = spawn(command);
      say(command.text);
      steps.push({ kind: 'fork', dur: 1, job, row: 0 }, { kind: 'run', dur: 0.9 }, { kind: 'exit', dur: 0.7, job });
    };
    const interrupt = (job: number, hold = false) => {
      steps.push({ kind: 'key', dur: 0.45, text: '^C' });
      if (hold) freeze = steps.length;
      strike(job, 'SIGINT', 1);
      steps.push({ kind: 'exit', dur: 0.7, job });
    };
    const suspend = (job: number) => {
      steps.push({ kind: 'key', dur: 0.45, text: '^Z' });
      strike(job, 'SIGTSTP', 1);
      steps.push({ kind: 'move', dur: 1.4, job, row: enter(job) });
    };
    const resume = (job: number) => {
      say(`bg %${table.indexOf(job) + 1}`);
      steps.push({ kind: 'wake', dur: 0.95, job }, { kind: 'run', dur: 0.6 });
    };
    const bring = (job: number) => {
      say(`fg %${leave(job)}`);
      steps.push({ kind: 'move', dur: 1.5, job, row: 0 }, { kind: 'run', dur: 1.2 });
    };
    const kill = (job: number) => {
      say(`kill %${leave(job)}`);
      strike(job, 'SIGTERM', 0.8);
      steps.push({ kind: 'exit', dur: 0.7, job });
    };

    if (script === 0) {
      const a = launch(pool[0], true);
      const b = launch(pool[1], false);
      suspend(b);
      resume(b);
      bring(a);
      interrupt(a);
      kill(b);
    } else if (script === 1) {
      const a = launch(pool[0], false);
      interrupt(a);
      const b = launch(pool[0], false, true);
      suspend(b);
      resume(b);
      once(quick);
      kill(b);
    } else if (script === 2) {
      const a = launch(pool[0], true);
      const b = launch(pool[1], false);
      suspend(b);
      const c = launch(pool[2], false);
      interrupt(c, true);
      kill(a);
      bring(b);
      interrupt(b);
    } else {
      const a = launch(pool[0], true);
      const b = launch(pool[1], true);
      once(quick);
      kill(a);
      bring(b);
      interrupt(b);
    }
    steps.push({ kind: 'prompt', dur: 1.6 });
    recent = jobs.map((job) => job.name);

    index = 0;
    clock = 0;
    begun = false;
    typed = '';
    echo = '';
    keys = '';
    cursor = false;
    typing = false;
    mark.on = false;
    drawing = -1;
    forking = false;
  }

  function begin(step: Step) {
    typing = false;
    switch (step.kind) {
      case 'prompt':
        typed = '';
        echo = '';
        keys = '';
        cursor = true;
        break;
      case 'type':
        cursor = true;
        typing = true;
        break;
      case 'key':
        keys = step.text;
        break;
      case 'recall':
        echo = step.text;
        cursor = false;
        break;
      case 'fork': {
        const job = jobs[step.job];
        job.live = true;
        job.row = step.row;
        job.grow = 0;
        job.size = 0;
        job.ink = 0;
        drawing = step.job;
        forking = true;
        cursor = false;
        break;
      }
      case 'move':
        cursor = false;
        break;
      case 'wake':
      case 'signal':
        mark.on = true;
        mark.job = step.job;
        mark.u = 0;
        mark.fade = 1;
        mark.ripple = 0;
        mark.signal = step.kind === 'signal' ? step.signal : null;
        cursor = false;
        break;
      case 'hit':
        if (step.signal !== 'SIGTSTP') jobs[step.job].ended = true;
        break;
      default:
        break;
    }
  }

  function apply(step: Step, u: number) {
    switch (step.kind) {
      case 'type':
        typed = step.text.slice(0, Math.min(step.text.length, Math.floor((u * step.dur) / KEY)));
        break;
      case 'fork': {
        const job = jobs[step.job];
        job.grow = clamp(u / 0.8, 0, 1);
        job.size = smooth(clamp((u - 0.8) / 0.2, 0, 1));
        job.ink = job.size;
        break;
      }
      case 'move': {
        // The line is wound back into the shell, then drawn again along the tree to the new
        // place, so a job never crosses the sheet or another row.
        const job = jobs[step.job];
        if (u < 0.42) {
          const v = u / 0.42;
          job.size = 1 - smooth(clamp(v / 0.3, 0, 1));
          job.ink = job.size;
          job.grow = 1 - smooth(clamp((v - 0.15) / 0.85, 0, 1));
          break;
        }
        if (job.row !== step.row) {
          job.row = step.row;
          // fg sends SIGCONT before it waits: a stopped job runs again.
          if (step.row === 0) job.stopped = 0;
          drawing = step.job;
          forking = false;
        }
        const v = (u - 0.42) / 0.58;
        job.grow = clamp(v / 0.8, 0, 1);
        job.size = smooth(clamp((v - 0.8) / 0.2, 0, 1));
        job.ink = job.size;
        break;
      }
      case 'wake': {
        const woken = smooth(clamp((u * step.dur - (step.dur - EASE)) / EASE, 0, 1));
        mark.u = clamp((u * step.dur) / (step.dur - EASE), 0, 1);
        mark.fade = 1 - woken;
        jobs[step.job].stopped = 1 - woken;
        break;
      }
      case 'signal':
        mark.u = u;
        break;
      case 'hit':
        mark.u = 1;
        mark.ripple = u;
        mark.fade = 1 - smooth(clamp((u - 0.45) / 0.55, 0, 1));
        if (step.signal === 'SIGTSTP') jobs[step.job].stopped = smooth(clamp((u * step.dur) / EASE, 0, 1));
        break;
      case 'exit': {
        const job = jobs[step.job];
        job.size = 1 - smooth(clamp(u / 0.3, 0, 1));
        job.ink = job.size;
        job.grow = 1 - smooth(clamp((u - 0.2) / 0.8, 0, 1));
        break;
      }
      default:
        break;
    }
  }

  function finish(step: Step) {
    switch (step.kind) {
      case 'fork':
      case 'move':
        drawing = -1;
        forking = false;
        break;
      case 'wake':
      case 'hit':
        mark.on = false;
        break;
      case 'exit':
        jobs[step.job].live = false;
        break;
      default:
        break;
    }
  }

  function advance(dt: number) {
    let left = dt;
    while (left > 0) {
      if (index >= steps.length) {
        seed += 1;
        compose();
      }
      const step = steps[index];
      if (!begun) {
        begin(step);
        begun = true;
      }
      const used = Math.min(left, step.dur - clock);
      clock += used;
      left -= used;
      apply(step, clamp(clock / step.dur, 0, 1));
      if (clock >= step.dur - 1e-6) {
        finish(step);
        index += 1;
        clock = 0;
        begun = false;
      }
    }
  }

  /** The reduced-motion picture: three jobs in three states, and a signal on its way. */
  function settle() {
    if (settled) return;
    settled = true;
    compose(STILL_SCRIPT);
    for (let i = 0; i < freeze; i += 1) {
      begin(steps[i]);
      apply(steps[i], 1);
      finish(steps[i]);
    }
    index = freeze;
    begin(steps[freeze]);
    begun = true;
    clock = steps[freeze].dur * 0.6;
    apply(steps[freeze], 0.6);
    cursor = false;
    typing = false;
  }

  /**
   * A point of the line from a to b, `at` px from a, of which `drawn` px are on the sheet.
   * The hand drifts a little across the line and the pointer pushes the line aside, but both
   * fade to nothing at the ends: a line never leaves its anchors, so nodes and lettering can
   * stay where they are.
   */
  function place(a: Point, b: Point, at: number, drawn: number, phase: number, frame: Frame): Point {
    const full = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / full;
    const uy = (b.y - a.y) / full;
    const hold = smooth(clamp((Math.min(at, full - at) - 6) / 18, 0, 1));
    const drift = (Math.sin(at * 0.023 + phase) * 1.1 + Math.sin(at * 0.061 + phase * 2.3) * 0.7) * hold;
    let x = a.x + ux * at - uy * drift;
    let y = a.y + uy * at + ux * drift;
    const { pointer } = frame;
    if (pointer.active && drawn > 1) {
      const bow = Math.sin(Math.PI * clamp(at / drawn, 0, 1));
      const dx = x - pointer.x;
      const dy = y - pointer.y;
      const d2 = dx * dx + dy * dy;
      const push = (Math.exp(-d2 / (reach * reach)) * PUSH * bow) / (Math.sqrt(d2) + 0.001);
      x += dx * push;
      y += dy * push;
    }
    return { x, y };
  }

  /** The first `drawn` px of a line as points at a fixed pitch, so its steps stay put while it grows. */
  function run(a: Point, b: Point, drawn: number, phase: number, frame: Frame): Point[] {
    const pts: Point[] = [];
    if (drawn < 0.5) return pts;
    for (let d = 0; ; d += PITCH) {
      pts.push(place(a, b, Math.min(d, drawn), drawn, phase, frame));
      if (d >= drawn) break;
    }
    return pts;
  }

  /** A point `d` px along the way from the shell to a job, on the line as it is drawn now. */
  function along(job: Job, i: number, d: number, frame: Frame): Point {
    if (job.row === 0) return place(origin, slot(0), d, out(job), seed + i * 1.7, frame);
    const down = gap * job.row;
    if (d < down) {
      const k = Math.min(job.row - 1, Math.floor(d / gap));
      return place(junction(k), junction(k + 1), d - k * gap, legDrawn(k), seed - k * 2.1, frame);
    }
    return place(junction(job.row), slot(job.row), d - down, out(job), seed + i * 1.7, frame);
  }

  /** The points pixelStroke puts down for a line: its dashed twin is ruled through the same ones. */
  function stepped(pts: Point[], weight: number, lineSeed: number): Point[] {
    const pixel = weight >= 2.2 ? 2.5 : 2;
    const jitter = weight >= 2.2 ? 4.2 : 3.5;
    return pts.map((p, j) => {
      const r = rand((lineSeed + j * 31) >>> 0);
      return { x: snap(p.x + (r() - 0.5) * jitter, pixel), y: snap(p.y + (r() - 0.5) * jitter, pixel) };
    });
  }

  /**
   * One line of the tree: solid while the job runs, dashed when it is stopped, both on the
   * same steps. pixelStroke steps cleanly across x and roughly along y, so a line that runs
   * to the right is drawn in a mirrored frame and its rough side falls along the line too.
   */
  function stroke(frame: Frame, pts: Point[], level: boolean, heavy: boolean, lineSeed: number, stopped: number) {
    const { ctx, palette } = frame;
    if (pts.length < 2) return;
    const weight = heavy ? HEAVY : THIN;
    ctx.save();
    if (level) {
      for (const p of pts) {
        const x = p.x;
        p.x = p.y;
        p.y = x;
      }
      ctx.transform(0, 1, 1, 0, 0, 0);
    }
    if (stopped < 0.99) {
      const alpha = (heavy ? 0.92 : 0.62) * (1 - stopped);
      pixelStroke(ctx, pts, { color: palette.ink, alpha, width: weight, seed: lineSeed });
    }
    if (stopped > 0.01) {
      line(ctx, stepped(pts, weight, lineSeed), {
        color: palette.ink,
        alpha: 0.7 * stopped,
        width: heavy ? 1.8 : 1.2,
        dash: [3, 4],
      });
    }
    ctx.restore();
  }

  function measure(frame: Frame, text: string, size: number, tracking = 0): number {
    const { ctx, palette } = frame;
    ctx.save();
    ctx.font = `${size}px ${palette.labelFont}`;
    const measured = ctx.measureText(text).width + tracking * text.length;
    ctx.restore();
    return measured;
  }

  /** The free place above the main line, half way between the two labels at its ends. */
  function middle(frame: Frame): Point {
    const lo = origin.x - 5 + measure(frame, `MSH ${shellPid}`, 11);
    const hi = far + 5 - measure(frame, 'FOREGROUND', 10, 2);
    return { x: (lo + hi) / 2, y: origin.y - 17 };
  }

  function survey() {
    depth = 0;
    for (const job of jobs) {
      if (job.live && job.row > 0) depth = Math.max(depth, Math.min(lay(job), gap * job.row));
    }
  }

  function furniture(frame: Frame) {
    const { ctx, palette } = frame;
    const foot = origin.y + gap * ROWS + 12;
    const x = Math.round(origin.x) + 0.5;
    const y = Math.round(origin.y) + 0.5;
    // Two faint rails: the foreground runs to the right, the job table runs down. They are
    // ruled only where no line has been drawn over them.
    let covered = 0;
    for (const job of jobs) if (job.live && job.row === 0) covered = Math.max(covered, out(job));
    if (origin.x + covered < far) line(ctx, [{ x: origin.x + covered, y }, { x: far, y }], { color: palette.faint, width: 1 });
    if (origin.y + depth < foot) line(ctx, [{ x, y: origin.y + depth }, { x, y: foot }], { color: palette.faint, width: 1 });
    label(ctx, 'FOREGROUND', { x: far + 5, y: origin.y - 17 }, palette, { align: 'right', size: 10, tracking: 2 });
    // On a small sheet the job numbers alone say what hangs below.
    if (!compact) label(ctx, 'BACKGROUND', { x: origin.x - 5, y: foot + 13 }, palette, { size: 10, tracking: 2 });
    label(ctx, `MSH ${shellPid}`, { x: origin.x - 5, y: origin.y - 17 }, palette, { color: palette.ink, size: 11 });
  }

  function tree(frame: Frame) {
    const { ctx, palette } = frame;

    // The trunk is drawn junction by junction, so every branch leaves it at a fixed point.
    for (let k = 0; k < ROWS; k += 1) {
      const drawn = legDrawn(k);
      if (drawn < 0.5) break;
      const pts = run(junction(k), junction(k + 1), drawn, seed - k * 2.1, frame);
      stroke(frame, pts, false, false, seed * 101 + 3 + k * 13, 0);
    }

    jobs.forEach((job, i) => {
      if (!job.live) return;
      const at = slot(job.row);
      const pts = run(junction(job.row), at, out(job), seed + i * 1.7, frame);
      stroke(frame, pts, true, job.row === 0, seed * 101 + 7 * (i + 1), job.stopped);

      if (job.size > 0.02) {
        if (job.ended) {
          const r = 4.5 * job.size;
          line(ctx, [{ x: at.x - r, y: at.y - r }, { x: at.x + r, y: at.y + r }], { color: palette.ink, width: 1.8 });
          line(ctx, [{ x: at.x - r, y: at.y + r }, { x: at.x + r, y: at.y - r }], { color: palette.ink, width: 1.8 });
        } else {
          if (job.stopped < 0.99) block(ctx, at, 8 * job.size, { fill: palette.ink, alpha: 1 - job.stopped });
          if (job.stopped > 0.01) {
            block(ctx, at, 9 * job.size, { fill: palette.paper, stroke: palette.ink, width: 1.5, alpha: job.stopped });
          }
        }
      }

      if (job.ink <= 0.02) return;
      if (job.row === 0) {
        // Only the shell and the job it waits for show their pid.
        label(ctx, `${job.pid} ${job.name}`, { x: at.x + 5, y: at.y + 19 }, palette, {
          color: palette.ink,
          alpha: job.ink,
          align: 'right',
          size: 11,
        });
        return;
      }
      const text = `[${job.row}] ${job.name}`;
      const x = at.x + 16;
      label(ctx, text, { x, y: at.y + 1 }, palette, { color: palette.ink, alpha: job.ink, size: 11 });
      const struck = mark.on && mark.signal !== null && mark.job === i;
      const note = struck ? mark.signal : job.stopped > 0.01 ? 'STOPPED' : null;
      if (!note) return;
      const alpha = struck ? smooth(clamp(mark.u / 0.2, 0, 1)) * mark.fade : job.stopped;
      if (alpha * job.ink <= 0.02) return;
      label(ctx, note, { x: x + measure(frame, text, 11) + 12, y: at.y + 1 }, palette, {
        color: struck ? palette.signal : palette.soft,
        alpha: alpha * job.ink,
        size: 10,
        tracking: 1,
      });
    });

    block(ctx, origin, 10, { fill: palette.ink });
  }

  function marks(frame: Frame) {
    const { ctx, palette, still } = frame;

    if (drawing >= 0 && !still) {
      const job = jobs[drawing];
      const drawn = lay(job);
      if (job.grow < 1) pen(ctx, along(job, drawing, drawn, frame), palette, palette.ink);
      // The word waits until the pen is clear of the shell, and leaves when the node arrives.
      const alpha = forking ? smooth(clamp((drawn - 14) / 10, 0, 1)) * (1 - job.size) : 0;
      if (alpha > 0.02) {
        const at = job.row === 0 ? middle(frame) : { x: origin.x + 13, y: origin.y + gap * job.row - 15 };
        label(ctx, 'FORK', at, palette, { alpha, align: job.row === 0 ? 'center' : 'left', size: 10, tracking: 1 });
      }
    }

    if (!mark.on) return;
    const job = jobs[mark.job];
    const travelled = mark.u * span(job.row);
    const head = along(job, mark.job, travelled, frame);
    if (mark.signal === null) {
      block(ctx, head, 5, { fill: palette.ink, alpha: mark.fade });
      return;
    }
    // The tail is laid along the line, so it turns the corner with the mark.
    const tail: Point[] = [];
    for (let back = Math.min(14, travelled); back > 0.5; back -= 3.5) {
      tail.push(along(job, mark.job, travelled - back, frame));
    }
    tail.push(head);
    line(ctx, tail, { color: palette.signal, alpha: 0.55 * mark.fade, width: 2 });
    block(ctx, head, 6, { fill: palette.signal, alpha: mark.fade });
    if (mark.ripple > 0) {
      ring(ctx, head, lerp(5, 9, smooth(mark.ripple)), {
        stroke: palette.signal,
        alpha: 1 - mark.ripple,
        width: 1.5,
      });
    }
    if (job.row === 0) {
      label(ctx, mark.signal, middle(frame), palette, {
        color: palette.signal,
        alpha: smooth(clamp(mark.u / 0.2, 0, 1)) * mark.fade,
        align: 'center',
        size: 10,
        tracking: 1,
      });
    }
  }

  function terminal(frame: Frame) {
    const { ctx, palette, t, still } = frame;
    const y = baseline;
    const space = measure(frame, ' ', 11);
    let x = origin.x - 5;
    label(ctx, PROMPT, { x, y }, palette, { size: 11 });
    x += measure(frame, `${PROMPT} `, 11);
    if (typed) {
      label(ctx, typed, { x, y }, palette, { color: palette.ink, size: 11 });
      x += measure(frame, typed, 11);
    }
    if (cursor && !still && (typing || Math.floor(t / 520) % 2 === 0)) {
      ctx.save();
      ctx.fillStyle = palette.ink;
      ctx.fillRect(Math.round(x + 1), Math.round(y - 6), 6, 11);
      ctx.restore();
    }
    if (echo) {
      // What "!!" stands for, echoed by the shell.
      x += space * 2;
      label(ctx, echo, { x, y }, palette, { size: 11 });
      x += measure(frame, echo, 11);
    }
    if (keys) label(ctx, keys, { x: x + space, y }, palette, { color: palette.signal, size: 11 });
  }

  return {
    init(w, h, nextSeed) {
      width = w;
      height = h;
      seed = nextSeed;
      settled = false;
      shellPid = 4000 + Math.floor(rand((nextSeed * 7919 + 101) >>> 0)() * 900);
      pid = shellPid;
      script = -1;
      unplayed = [];
      recent = [];
      layout();
      compose();
    },

    draw(frame) {
      // The film runs on the time the board has really shown, so a pause does not skip it.
      // The clock of the board only blinks the cursor.
      if (frame.still) settle();
      else advance(frame.dt);
      survey();
      furniture(frame);
      tree(frame);
      marks(frame);
      terminal(frame);
    },

    readout() {
      let table = 0;
      let holder = `${shellPid} MSH`;
      jobs.forEach((job, i) => {
        if (!job.live) return;
        // A job that was just struck is still named until the mark has gone.
        const struck = mark.on && mark.signal !== null && mark.job === i;
        if (job.ended && !struck) return;
        if (job.row === 0) holder = `${job.pid} ${job.name}`;
        else if (!job.ended) table += 1;
      });
      const target = mark.on && mark.signal ? jobs[mark.job] : null;
      const signal = target ? ` · ${mark.signal}${target.row > 0 ? ` %${target.row}` : ''}` : '';
      return `JOBS ${table} · FG ${holder}${signal}`;
    },
  };
}
