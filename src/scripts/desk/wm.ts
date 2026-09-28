/**
 * Window manager for the desk.
 *
 * The default arrangement is ordinary CSS (grid / flow), so the page reads correctly
 * without JavaScript and at any width. On a wide screen with a mouse, the windows are
 * "lifted": their laid-out rectangles are measured and turned into absolute positions,
 * after which they can be dragged, resized, rolled up, zoomed and closed.
 *
 * Markup contract
 *   <main data-desk="home">
 *     <section class="win" data-win="identity">
 *       <header class="win-bar" data-drag> … <button data-act="close|shade|zoom"> … </header>
 *       <div class="win-body">…</div>
 *       <span data-resize></span>
 *     </section>
 *   </main>
 */
import { zoomRects } from './zoomrects';
import { store } from './store';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number | null;
}

interface Saved extends Partial<Box> {
  z?: number;
  closed?: boolean;
  shaded?: boolean;
}

const GRID = 8;
const MIN_W = 260;
const MIN_H = 120;
const KEEP_VISIBLE = 96;

const snap = (value: number) => Math.round(value / GRID) * GRID;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export interface DeskWindow {
  id: string;
  title: string;
  closed: boolean;
  shaded: boolean;
}

export interface Desk {
  list(): DeskWindow[];
  open(id: string, from?: DOMRect | null): void;
  close(id: string): void;
  toggle(id: string, from?: DOMRect | null): void;
  focus(id: string): void;
  reset(): void;
  readonly lifted: boolean;
}

/**
 * @param leaving ends when the page the desk stands on is left; what the desk listens for
 *                on the window is given up then
 */
export function createDesk(root: HTMLElement, leaving?: AbortSignal): Desk {
  const name = root.dataset.desk || 'desk';
  const wins = Array.from(root.querySelectorAll<HTMLElement>(':scope > .win, :scope > * > .win'));
  // Below this width there is no room for windows beside the hall: they are laid out under it.
  const wide = window.matchMedia('(min-width: 1200px) and (pointer: fine)');
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
  let lifted = false;
  let top = 10;

  const byId = (id: string) => wins.find((win) => win.dataset.win === id);
  const bucket = () => Math.round(root.clientWidth / 120) * 120;
  const key = () => `desk:${name}:${bucket()}`;
  const flagsKey = `desk:${name}:flags`;

  const readLayout = () => store.json<Record<string, Saved>>(key(), {});
  const readFlags = () => store.json<Record<string, Saved>>(flagsKey, {});

  function announce() {
    root.dispatchEvent(new CustomEvent('desk:change', { bubbles: true }));
  }

  /** Geometry changed (a window moved or was resized); read-outs follow this. */
  function relaid() {
    root.dispatchEvent(new CustomEvent('desk:layout', { bubbles: true }));
  }

  function boxOf(win: HTMLElement): Box {
    return {
      x: parseFloat(win.style.getPropertyValue('--x')) || 0,
      y: parseFloat(win.style.getPropertyValue('--y')) || 0,
      w: parseFloat(win.style.getPropertyValue('--w')) || win.offsetWidth,
      h: win.style.getPropertyValue('--h') ? parseFloat(win.style.getPropertyValue('--h')) : null,
    };
  }

  function place(win: HTMLElement, box: Partial<Box>) {
    if (box.x !== undefined) win.style.setProperty('--x', String(Math.round(box.x)));
    if (box.y !== undefined) win.style.setProperty('--y', String(Math.round(box.y)));
    if (box.w !== undefined) win.style.setProperty('--w', String(Math.round(box.w)));
    if (box.h === null) {
      win.style.removeProperty('--h');
      win.removeAttribute('data-sized');
    } else if (box.h !== undefined) {
      win.style.setProperty('--h', String(Math.round(box.h)));
      win.setAttribute('data-sized', '');
    }
  }

  function save() {
    const flags: Record<string, Saved> = {};
    const layout: Record<string, Saved> = {};
    for (const win of wins) {
      const id = win.dataset.win!;
      flags[id] = { closed: win.hidden, shaded: win.hasAttribute('data-shaded') };
      // A zoomed window keeps the place it will return to: its --x/--y/--w are untouched.
      if (lifted) layout[id] = { ...boxOf(win), z: Number(win.style.zIndex) || 0 };
    }
    store.set(flagsKey, JSON.stringify(flags));
    if (lifted) store.set(key(), JSON.stringify(layout));
  }

  function fitDesk() {
    if (!lifted) return;
    let bottom = 0;
    for (const win of wins) {
      if (win.hidden) continue;
      bottom = Math.max(bottom, win.offsetTop + win.offsetHeight);
    }
    root.style.setProperty('--desk-h', `${Math.ceil(bottom + 48)}px`);
    relaid();
  }

  /** Keep what assistive technology is told in step with what is shown. */
  function reflect(win: HTMLElement) {
    win
      .querySelector<HTMLElement>('[data-act="shade"]')
      ?.setAttribute('aria-expanded', String(!win.hasAttribute('data-shaded')));
    win
      .querySelector<HTMLElement>('[data-act="zoom"]')
      ?.setAttribute('aria-pressed', String(win.hasAttribute('data-zoomed')));
    const bar = win.querySelector<HTMLElement>('[data-drag]');
    const title = win.dataset.title || '';
    bar?.setAttribute(
      'aria-label',
      lifted ? `${title}. Arrow keys move this window, Enter rolls it up.` : `${title}. Enter rolls it up.`,
    );
  }

  const reflectAll = () => wins.forEach(reflect);

  function activate(win: HTMLElement) {
    for (const other of wins) other.toggleAttribute('data-active', other === win);
    top += 1;
    win.style.zIndex = String(top);
  }

  /* ---------- lifting ---------- */

  function lift() {
    if (lifted) return;
    // Measure the default arrangement with every window open and unrolled, so that a window
    // reopened later returns to its own place and not to the place of whatever moved up.
    const state = wins.map((win) => ({ hidden: win.hidden, shaded: win.hasAttribute('data-shaded') }));
    wins.forEach((win) => {
      win.hidden = false;
      win.removeAttribute('data-shaded');
    });
    // offsetLeft/offsetTop ignore transforms, so an arrival animation in progress does not skew them.
    const measured = wins.map((win) => ({ win, x: win.offsetLeft, y: win.offsetTop, w: win.offsetWidth }));
    wins.forEach((win, index) => {
      win.hidden = state[index].hidden;
      win.toggleAttribute('data-shaded', state[index].shaded);
    });

    const saved = readLayout();
    const room = root.clientWidth;
    for (const { win, x, y, w } of measured) {
      win.dataset.home = JSON.stringify({ x, y, w });
      const mine = saved[win.dataset.win!];
      const width = Math.min(mine?.w ?? w, Math.max(MIN_W, room - 16));
      place(win, {
        // A layout saved on a wider screen must not leave a window out of reach.
        x: clamp(mine?.x ?? x, KEEP_VISIBLE - width, Math.max(0, room - KEEP_VISIBLE)),
        y: Math.max(0, mine?.y ?? y),
        w: width,
        h: mine?.h ?? null,
      });
      if (mine?.z) {
        win.style.zIndex = String(mine.z);
        top = Math.max(top, mine.z);
      }
    }
    root.setAttribute('data-lifted', '');
    lifted = true;
    reflectAll();
    fitDesk();
  }

  function drop() {
    if (!lifted) return;
    root.removeAttribute('data-lifted');
    root.style.removeProperty('--desk-h');
    for (const win of wins) {
      win.removeAttribute('data-zoomed');
      win.removeAttribute('data-sized');
      for (const prop of ['--x', '--y', '--w', '--h']) win.style.removeProperty(prop);
      win.style.removeProperty('z-index');
    }
    lifted = false;
    reflectAll();
  }

  function sync() {
    drop();
    if (wide.matches) lift();
  }

  /* ---------- dragging and resizing ---------- */

  function bounds(win: HTMLElement) {
    return {
      minX: KEEP_VISIBLE - win.offsetWidth,
      maxX: root.clientWidth - KEEP_VISIBLE,
      minY: 0,
    };
  }

  function beginDrag(win: HTMLElement, event: PointerEvent) {
    if (!lifted || win.hasAttribute('data-zoomed')) return;
    const handle = event.currentTarget as HTMLElement;
    const start = boxOf(win);
    const limit = bounds(win);
    const originX = event.clientX;
    const originY = event.clientY + window.scrollY;
    let moved = false;

    handle.setPointerCapture(event.pointerId);
    win.setAttribute('data-dragging', '');

    const move = (e: PointerEvent) => {
      const dx = e.clientX - originX;
      const dy = e.clientY + window.scrollY - originY;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      moved = true;
      place(win, {
        x: clamp(start.x + dx, limit.minX, limit.maxX),
        y: Math.max(limit.minY, start.y + dy),
      });
      relaid();
    };
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      win.removeAttribute('data-dragging');
      if (moved) {
        const box = boxOf(win);
        place(win, { x: snap(box.x), y: snap(box.y) });
        fitDesk();
        save();
      }
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  function beginResize(win: HTMLElement, event: PointerEvent) {
    if (!lifted || win.hasAttribute('data-zoomed') || win.hasAttribute('data-shaded')) return;
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget as HTMLElement;
    const startW = win.offsetWidth;
    const startH = win.offsetHeight;
    const originX = event.clientX;
    const originY = event.clientY;
    const minW = Number(win.dataset.minW) || MIN_W;
    const minH = Number(win.dataset.minH) || MIN_H;

    handle.setPointerCapture(event.pointerId);
    win.setAttribute('data-resizing', '');
    activate(win);

    const move = (e: PointerEvent) => {
      place(win, {
        w: Math.max(minW, startW + e.clientX - originX),
        h: Math.max(minH, startH + e.clientY - originY),
      });
      relaid();
    };
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      win.removeAttribute('data-resizing');
      const box = boxOf(win);
      place(win, { w: snap(box.w), h: box.h === null ? null : snap(box.h) });
      fitDesk();
      save();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  /* ---------- window actions ---------- */

  function shade(win: HTMLElement, force?: boolean) {
    const on = force ?? !win.hasAttribute('data-shaded');
    win.toggleAttribute('data-shaded', on);
    // A rolled-up window is only its title bar: it cannot stay zoomed.
    if (on) win.removeAttribute('data-zoomed');
    reflect(win);
    fitDesk();
    save();
    announce();
  }

  function zoom(win: HTMLElement) {
    if (!lifted) return;
    const on = !win.hasAttribute('data-zoomed');
    const from = win.getBoundingClientRect();
    win.toggleAttribute('data-zoomed', on);
    if (on) win.removeAttribute('data-shaded');
    reflect(win);
    activate(win);
    if (!calm.matches) zoomRects(from, win.getBoundingClientRect());
    fitDesk();
    save();
    announce();
  }

  function close(win: HTMLElement) {
    if (win.hidden) return;
    const from = win.getBoundingClientRect();
    const hadFocus = win.contains(document.activeElement);
    const icon = document.querySelector<HTMLElement>(`[data-opens="${win.dataset.win}"]`);
    win.hidden = true;
    win.removeAttribute('data-zoomed');
    reflect(win);
    if (!calm.matches && icon) zoomRects(from, icon.getBoundingClientRect());
    const next = wins.filter((w) => !w.hidden).sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex))[0];
    if (next) activate(next);
    if (hadFocus) {
      // Focus must land somewhere: the next window, or the menu that can bring this one back.
      const target =
        next?.querySelector<HTMLElement>('.win-bar') ??
        document.querySelector<HTMLElement>('[aria-controls="menu-windows"]');
      target?.focus({ preventScroll: true });
    }
    fitDesk();
    save();
    announce();
  }

  function open(win: HTMLElement, from?: DOMRect | null) {
    const wasHidden = win.hidden;
    win.hidden = false;
    win.removeAttribute('data-shaded');
    reflect(win);
    activate(win);
    if (wasHidden && from && !calm.matches) zoomRects(from, win.getBoundingClientRect());
    fitDesk();
    save();
    announce();
    if (wasHidden) win.querySelector<HTMLElement>('.win-bar')?.focus({ preventScroll: true });
    win.scrollIntoView({ block: 'nearest', behavior: calm.matches ? 'auto' : 'smooth' });
  }

  /* ---------- wiring ---------- */

  const flags = readFlags();
  for (const win of wins) {
    const id = win.dataset.win!;
    const mine = flags[id];
    if (mine?.closed !== undefined) win.hidden = mine.closed;
    if (mine?.shaded) win.setAttribute('data-shaded', '');

    const bar = win.querySelector<HTMLElement>('[data-drag]');
    win.addEventListener('pointerdown', () => activate(win), { capture: true });
    win.addEventListener('focusin', () => {
      if (!win.hasAttribute('data-active')) activate(win);
    });

    if (bar) {
      bar.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        if ((event.target as HTMLElement).closest('button, a, input, select')) return;
        beginDrag(win, event);
      });
      bar.addEventListener('dblclick', (event) => {
        if ((event.target as HTMLElement).closest('button, a')) return;
        shade(win);
      });
      bar.addEventListener('keydown', (event) => {
        if (event.target !== bar) return;
        const step = event.shiftKey ? GRID * 4 : GRID;
        const delta: Record<string, [number, number]> = {
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
        };
        if (delta[event.key] && lifted && !win.hasAttribute('data-zoomed')) {
          event.preventDefault();
          const box = boxOf(win);
          const limit = bounds(win);
          place(win, {
            x: clamp(box.x + delta[event.key][0], limit.minX, limit.maxX),
            y: Math.max(limit.minY, box.y + delta[event.key][1]),
          });
          fitDesk();
          save();
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          shade(win);
        }
      });
    }

    win.querySelector<HTMLElement>('[data-resize]')?.addEventListener('pointerdown', (event) => {
      if (event.button === 0) beginResize(win, event);
    });

    win.addEventListener('click', (event) => {
      const control = (event.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (!control || !win.contains(control)) return;
      const act = control.dataset.act;
      if (act === 'close') close(win);
      else if (act === 'shade') shade(win);
      else if (act === 'zoom') zoom(win);
    });
  }

  const first = wins.find((win) => !win.hidden && win.hasAttribute('data-primary')) ?? wins.find((win) => !win.hidden);
  sync();
  reflectAll();
  if (first) activate(first);

  let resizeTimer = 0;
  let lastBucket = bucket();
  window.addEventListener(
    'resize',
    () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(relay, 120);
    },
    { signal: leaving },
  );
  leaving?.addEventListener('abort', () => window.clearTimeout(resizeTimer));
  function relay() {
    if (wide.matches !== lifted || bucket() !== lastBucket) {
      lastBucket = bucket();
      sync();
    } else if (lifted && Object.keys(readLayout()).length === 0) {
      // Nothing has been moved by hand: simply lay the desk out again for the new width.
      sync();
    } else {
      for (const win of wins) {
        const limit = bounds(win);
        place(win, { x: clamp(boxOf(win).x, limit.minX, Math.max(0, limit.maxX)) });
      }
      fitDesk();
    }
  }
  // Other parts of the page may ask for a window by name (the board does, for /#work=...).
  root.addEventListener('desk:open', (event) => {
    const id = (event as CustomEvent<string>).detail;
    const win = typeof id === 'string' ? byId(id) : undefined;
    if (win) open(win);
  });
  // Content that arrives late (images, fonts) can change window heights.
  window.addEventListener('load', fitDesk, { signal: leaving });
  document.fonts?.ready.then(() => {
    if (leaving?.aborted) return;
    if (lifted && Object.keys(readLayout()).length === 0) sync();
    else fitDesk();
  });

  const desk: Desk = {
    get lifted() {
      return lifted;
    },
    list: () =>
      wins.map((win) => ({
        id: win.dataset.win!,
        title: win.dataset.title || win.querySelector('.win-title')?.textContent?.trim() || win.dataset.win!,
        closed: win.hidden,
        shaded: win.hasAttribute('data-shaded'),
      })),
    open: (id, from) => {
      const win = byId(id);
      if (win) open(win, from);
    },
    close: (id) => {
      const win = byId(id);
      if (win) close(win);
    },
    toggle: (id, from) => {
      const win = byId(id);
      if (!win) return;
      if (win.hidden) open(win, from);
      else if (win.hasAttribute('data-active')) close(win);
      else open(win, from);
    },
    focus: (id) => {
      const win = byId(id);
      if (win) activate(win);
    },
    reset: () => {
      store.remove(key());
      store.remove(flagsKey);
      for (const win of wins) {
        win.hidden = win.hasAttribute('data-closed-by-default');
        win.removeAttribute('data-shaded');
        win.removeAttribute('data-zoomed');
      }
      top = 10;
      sync();
      reflectAll();
      const again = wins.find((win) => !win.hidden && win.hasAttribute('data-primary')) ?? wins.find((win) => !win.hidden);
      if (again) activate(again);
      announce();
    },
  };
  return desk;
}
