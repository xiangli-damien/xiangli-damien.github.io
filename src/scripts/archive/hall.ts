/**
 * WALKING BETWEEN PAGES
 *
 * The hall is one place, drawn on one canvas that stays while pages are exchanged in front
 * of it. Following a link to another section sets the figure walking there, forwards or
 * back, past whatever gates lie between. The walk is never waited for: the page that is
 * left goes at once, the next one is fed up like a sheet of paper, and the walk carries on
 * behind it for as long as it takes.
 *
 * Gates already passed are behind the viewer and cannot be seen. The strip at the top of
 * the page therefore lists every section at all times, and a mark under the list shows how
 * far into the hall the visitor stands.
 *
 * Walking is an addition to ordinary links, never a condition for them. With reduced motion
 * the camera is simply moved. Without scripts every link loads its page in the ordinary
 * way, and the gates are shown as a plain list (see .gate in chrome.css).
 */
import type { TransitionBeforePreparationEvent } from 'astro:transitions/client';
import { createArchive, type Mode } from './scene';
import { LEAD, standing } from './plan';

interface HallInfo {
  key: string;
  href: string;
  depth: number;
}

/** Time given to the page that is left to get out of the way, in ms. */
const LEAVE = 230;
/** Time after which the arriving page is left alone, in ms. */
const ARRIVE = 1100;

const pause = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

export function initHall(): void {
  const root = document.querySelector<HTMLElement>('[data-hall]');
  const canvas = root?.querySelector('canvas');
  // The hall outlives the pages: it is set up once.
  if (!root || !canvas || root.dataset.live !== undefined) return;
  root.dataset.live = '';

  const html = document.documentElement;
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
  // The same condition as in chrome.css: room for windows beside the hall.
  const wide = window.matchMedia('(min-width: 1200px) and (pointer: fine)');
  const halls: HallInfo[] = JSON.parse(root.dataset.halls || '[]');
  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('[data-gate]'));
  const gates = links.map((label) => ({ z: Number(label.dataset.gateDepth), label }));
  const probe = (mode: Mode) => root.querySelector<HTMLElement>(`[data-opening="${mode}"]`);

  const here = (): HallInfo => halls.find((hall) => hall.key === html.dataset.hallKey) ?? halls[0];
  const modeOf = (hall: HallInfo): Mode => (hall.key === 'home' ? 'room' : 'band');
  const modeNow = (): Mode => (html.dataset.mode === 'room' ? 'room' : 'band');

  /** The hall a page belongs to, judged by its address. */
  function hallOf(pathname: string): HallInfo | null {
    let best: HallInfo | null = null;
    for (const hall of halls) {
      const match = hall.href === '/' ? pathname === '/' : pathname.startsWith(hall.href);
      if (match && (!best || hall.href.length > best.href.length)) best = hall;
    }
    return best;
  }

  /* ---------- the mark in the strip ---------- */

  let stops: { at: number; x: number }[] = [];
  let marker: HTMLElement | null = null;
  let readout: HTMLElement | null = null;

  /** Find the list of halls in the strip. It is part of the page, and is exchanged with it. */
  function survey() {
    const strip = document.querySelector<HTMLElement>('[data-strip]');
    marker = strip?.querySelector<HTMLElement>('[data-marker]') ?? null;
    readout = strip?.querySelector<HTMLElement>('[data-depth]') ?? null;
    stops = Array.from(strip?.querySelectorAll<HTMLElement>('[data-stop]') ?? [])
      .filter((stop) => stop.offsetWidth > 0)
      .map((stop) => ({ at: standing(Number(stop.dataset.stop)), x: stop.offsetLeft + stop.offsetWidth / 2 }))
      .sort((p, q) => p.at - q.at);
  }

  function tell(camera: number) {
    if (readout) {
      const text = String(Math.round(camera + LEAD)).padStart(3, '0');
      if (readout.textContent !== text) readout.textContent = text;
    }
    if (!marker) return;
    if (stops.length < 2) {
      marker.hidden = true;
      return;
    }
    // Between two halls the mark is between their names, by as much as the walk is done.
    let x = stops[0].x;
    for (let i = 0; i < stops.length - 1; i += 1) {
      const a = stops[i];
      const b = stops[i + 1];
      if (camera >= a.at) x = camera >= b.at ? b.x : a.x + ((camera - a.at) / (b.at - a.at)) * (b.x - a.x);
    }
    marker.hidden = false;
    marker.style.transform = `translateX(${x.toFixed(1)}px)`;
  }

  /* ---------- the hall ---------- */

  let heading = standing(here().depth);

  const archive = createArchive(canvas, {
    gates,
    camera: heading,
    mode: modeNow(),
    openings: { room: probe('room'), band: probe('band') },
    onMove: tell,
  });

  // On the workbench (`npm run dev`) the hall can be asked where it stands.
  if (import.meta.env.DEV) (window as unknown as { hall: unknown }).hall = archive;

  function walk(to: number) {
    if (to === heading && Math.abs(archive.camera - to) > 0.01) return; // already on the way there
    heading = to;
    archive.walk(to);
  }

  survey();
  tell(archive.camera);
  document.fonts?.ready.then(() => {
    survey();
    tell(archive.camera);
  });
  window.addEventListener('resize', () => {
    survey();
    tell(archive.camera);
  });

  links.forEach((link, index) => {
    const on = () => archive.highlight(index);
    const off = () => archive.highlight(null);
    link.addEventListener('pointerenter', on);
    link.addEventListener('pointerleave', off);
    link.addEventListener('focus', on);
    link.addEventListener('blur', off);
  });

  /* ---------- leaving a page ---------- */

  /** Where the top edge of the page stands on the screen, measured from the top of the hall. */
  function sheetTop(): number {
    const room = root!.getBoundingClientRect().height;
    if (modeNow() === 'room' && wide.matches) return room; // no sheet: the windows stand in the hall itself
    const open = probe(modeNow())?.getBoundingClientRect().height ?? 0;
    return Math.max(0, open - window.scrollY);
  }

  let left: number | null = null; // where the sheet of the page that was left stood
  let theme: string | undefined;
  let settle = 0;

  document.addEventListener('astro:before-preparation', (event) => {
    const go = event as TransitionBeforePreparationEvent;
    if (go.to.pathname === go.from.pathname) return;
    window.clearTimeout(settle);
    delete html.dataset.arriving;

    const target = hallOf(go.to.pathname);
    left = sheetTop();
    if (target) walk(standing(target.depth));

    if (!calm.matches) {
      // Going out to the entrance, the sheet is drawn down and the whole hall comes into view.
      const down = target !== null && modeOf(target) === 'room' && wide.matches && modeNow() === 'band';
      if (down) {
        html.style.setProperty('--sheet-to', `${Math.ceil(root.getBoundingClientRect().height - left)}px`);
        archive.frame('room');
      }
      html.dataset.leaving = down ? 'down' : 'away';
      const load = go.loader;
      go.loader = async () => {
        await Promise.all([load(), pause(LEAVE)]);
      };
    }
    go.signal.addEventListener('abort', () => delete html.dataset.leaving);
  });

  document.addEventListener('astro:before-swap', (event) => {
    theme = html.dataset.theme;
    // The exchange is animated here, by the sheet and the walk; the browser's own
    // cross-fade would show the hall twice over.
    const transition = (event as Event & { viewTransition?: ViewTransition }).viewTransition;
    transition?.ready?.catch(() => {});
    transition?.skipTransition();
  });

  /* ---------- arriving ---------- */

  document.addEventListener('astro:after-swap', () => {
    // The attributes of <html> are those of the new page: put back what scripts had added.
    html.classList.add('js');
    if (theme) html.dataset.theme = theme;

    const hall = here();
    const mode = modeNow();
    survey();
    tell(archive.camera);
    archive.frame(mode, left !== null);
    walk(standing(hall.depth));

    if (left !== null && !calm.matches) {
      const windows = mode === 'room' && wide.matches;
      html.style.setProperty('--sheet-from', windows ? '0px' : `${Math.round(left - sheetTop())}px`);
      html.dataset.arriving = '';
      settle = window.setTimeout(() => delete html.dataset.arriving, ARRIVE);
    }
    left = null;
  });

  // A page brought back whole by the browser is shown as it was left.
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    delete html.dataset.leaving;
    delete html.dataset.arriving;
    heading = standing(here().depth);
    archive.frame(modeNow(), false);
    archive.stand(heading);
  });
}
