/**
 * Board engine: owns the canvas, the clock and the pointer, and runs one program at a time.
 *
 * It pauses when the canvas is off screen or the tab is hidden, redraws a single settled
 * picture when the visitor prefers reduced motion, and re-reads its colours whenever the
 * site theme changes.
 */
import type { Frame, Palette, Pointer, Program, ProgramFactory } from './kit';

export type ProgramLoader = () => Promise<{ default: ProgramFactory }>;

export interface BoardOptions {
  programs: Record<string, ProgramLoader>;
  /** receives the program's machine read-out a few times per second */
  onReadout?: (text: string) => void;
  /** called when a program could not be loaded */
  onError?: (key: string, error: unknown) => void;
}

export interface Board {
  /**
   * Put a program on the board. `warm` runs the film forward by that many seconds first,
   * frame by frame, so that a later moment can be looked at without waiting for it.
   */
  show(key: string, warm?: number): Promise<void>;
  readonly current: string | null;
  destroy(): void;
}

const css = (el: Element, name: string, fallback: string) =>
  getComputedStyle(el).getPropertyValue(name).trim() || fallback;

export function readPalette(el: Element): Palette {
  return {
    paper: css(el, '--board-paper', '#fffefa'),
    ink: css(el, '--board-ink', '#15130f'),
    soft: css(el, '--board-soft', '#8b857b'),
    faint: css(el, '--board-faint', 'rgba(21,19,15,0.1)'),
    signal: css(el, '--board-signal', '#cf2a1d'),
    blue: css(el, '--board-blue', '#15130f'),
    ochre: css(el, '--board-ochre', '#8b857b'),
    green: css(el, '--board-green', '#8b857b'),
    labelFont: css(el, '--board-font', 'ui-monospace, Menlo, monospace'),
  };
}

export function createBoard(canvas: HTMLCanvasElement, options: BoardOptions): Board {
  const ctx = canvas.getContext('2d')!;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer: Pointer = { x: 0, y: 0, active: false };

  let palette = readPalette(canvas);
  let program: Program | null = null;
  let current: string | null = null;
  let seed = 42;
  let w = 1;
  let h = 1;
  let dpr = 1;
  let frame = 0;
  let visible = true;
  let started = 0;
  let last = 0;
  let lastReadout = -Infinity; // -Infinity: nothing printed yet
  let token = 0;
  let destroyed = false;

  function measure(): boolean {
    const rect = canvas.getBoundingClientRect();
    const nextW = Math.max(1, Math.floor(rect.width));
    const nextH = Math.max(1, Math.floor(rect.height));
    const nextDpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const changed = nextW !== w || nextH !== h || nextDpr !== dpr;
    w = nextW;
    h = nextH;
    dpr = nextDpr;
    if (changed) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return changed;
  }

  function paint(now: number, still: boolean) {
    if (!program) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const state: Frame = { ctx, w, h, t: now - started, dt, pointer, palette, still };
    ctx.save();
    try {
      program.draw(state);
    } catch (error) {
      console.error(`[board] program "${current}" failed while drawing`, error);
      program = null;
      options.onError?.(current ?? '', error);
      // The program may have left saves on the stack: start from a clean context.
      canvas.width = canvas.width;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return;
    }
    ctx.restore();
    if (program?.readout && options.onReadout && now - lastReadout > 240) {
      lastReadout = now;
      options.onReadout(program.readout());
    }
  }

  function loop(now: number) {
    paint(now, false);
    if (running()) frame = requestAnimationFrame(loop);
  }

  const running = () => !destroyed && !motion.matches && visible && !document.hidden && program !== null;

  function sync() {
    cancelAnimationFrame(frame);
    if (destroyed || !program) return;
    if (motion.matches) {
      // One settled picture: let the program believe a long time has passed.
      started = performance.now() - 60_000;
      last = performance.now();
      lastReadout = -Infinity;
      paint(performance.now(), true);
    } else if (visible && !document.hidden) {
      last = performance.now();
      frame = requestAnimationFrame(loop);
    }
  }

  /** Take the running program off the board and leave a blank sheet. */
  function clear() {
    cancelAnimationFrame(frame);
    program = null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
  }

  function restart() {
    if (!program) return;
    try {
      program.init(w, h, seed);
    } catch (error) {
      console.error(`[board] program "${current}" failed to start`, error);
      clear();
      options.onError?.(current ?? '', error);
      return;
    }
    started = performance.now();
    last = started;
    lastReadout = -Infinity;
    sync();
  }

  async function show(key: string, warm = 0) {
    const loader = options.programs[key];
    const mine = ++token;
    // The previous drawing must not go on under the caption of the next work while it loads.
    clear();
    current = null;
    if (!loader) {
      options.onError?.(key, new Error(`Unknown program "${key}"`));
      return;
    }
    try {
      const module = await loader();
      if (mine !== token || destroyed) return;
      seed += 1;
      current = key;
      program = module.default();
      canvas.dataset.program = key;
      measure();
      restart();
      if (warm > 0 && program && !motion.matches) {
        cancelAnimationFrame(frame);
        const from = performance.now();
        started = from;
        last = from;
        for (let now = from; now <= from + warm * 1000 && program; now += 1000 / 60) paint(now, false);
        // Carry on from there in real time.
        started = performance.now() - warm * 1000;
        last = performance.now();
        sync();
      }
    } catch (error) {
      if (mine !== token) return;
      console.error(`[board] could not load program "${key}"`, error);
      clear();
      options.onError?.(key, error);
    }
  }

  const resizeObserver = new ResizeObserver(() => {
    if (measure()) restart();
  });
  resizeObserver.observe(canvas);

  const viewObserver = new IntersectionObserver((entries) => {
    // A batch may hold several changes: the last one is the present state.
    visible = entries[entries.length - 1]?.isIntersecting ?? true;
    sync();
  });
  viewObserver.observe(canvas);

  const onPointerMove = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.active = true;
  };
  const onPointerLeave = () => {
    pointer.active = false;
  };
  const onTheme = () => {
    palette = readPalette(canvas);
    if (motion.matches) sync();
  };

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerenter', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  document.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', sync);
  window.addEventListener('theme:change', onTheme);

  measure();

  return {
    show,
    get current() {
      return current;
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      viewObserver.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerenter', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', sync);
      motion.removeEventListener('change', sync);
      window.removeEventListener('theme:change', onTheme);
    },
  };
}
