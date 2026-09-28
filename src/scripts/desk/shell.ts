/**
 * The system strip at the top of every page: pull-down menus, the clock, the theme
 * switch, the index of open windows and the quick-jump finder.
 *
 * Everything is found through data attributes, so the markup can be restyled freely:
 *   [data-menu]            a menu: contains [data-menu-button] and [data-menu-list]
 *   [data-clock]           element that shows the time in data-zone (IANA time zone)
 *   [data-set-theme=name]  switches the theme
 *   [data-desk-windows]    list that mirrors the windows of the desk
 *   [data-desk-reset]      puts every window back
 *   [data-finder]          <dialog> with [data-finder-input] and [data-finder-item] links
 *   [data-open-finder]     opens the finder
 *   [data-opens=id]        opens a window of the desk
 */
import type { Desk } from './wm';
import { store } from './store';

const THEMES = ['paper', 'dusk'] as const;
type Theme = (typeof THEMES)[number];

/* ---------- theme ---------- */

export function currentTheme(): Theme {
  const value = document.documentElement.dataset.theme;
  return THEMES.includes(value as Theme) ? (value as Theme) : 'paper';
}

export function setTheme(theme: Theme, remember = true) {
  document.documentElement.dataset.theme = theme;
  if (remember) store.set('theme', theme);
  document.querySelectorAll<HTMLElement>('[data-set-theme]').forEach((el) => {
    const on = el.dataset.setTheme === theme;
    el.setAttribute('aria-pressed', String(on));
  });
  window.dispatchEvent(new CustomEvent('theme:change', { detail: theme }));
}

/* ---------- menus ---------- */

function initMenus(leaving?: AbortSignal) {
  const menus = Array.from(document.querySelectorAll<HTMLElement>('[data-menu]'));
  if (!menus.length) return;
  const button = (menu: HTMLElement) => menu.querySelector<HTMLElement>('[data-menu-button]')!;
  const list = (menu: HTMLElement) => menu.querySelector<HTMLElement>('[data-menu-list]')!;
  const items = (menu: HTMLElement) =>
    Array.from(list(menu).querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
  let open: HTMLElement | null = null;

  function close(focusButton = false) {
    if (!open) return;
    list(open).hidden = true;
    button(open).setAttribute('aria-expanded', 'false');
    if (focusButton) button(open).focus();
    open = null;
  }

  function show(menu: HTMLElement, focusFirst = false) {
    if (open === menu) return;
    close();
    list(menu).hidden = false;
    button(menu).setAttribute('aria-expanded', 'true');
    open = menu;
    if (focusFirst) items(menu)[0]?.focus();
  }

  menus.forEach((menu, index) => {
    const trigger = button(menu);
    trigger.addEventListener('click', () => (open === menu ? close() : show(menu)));
    // Once one menu is open, sliding across the strip opens its neighbours.
    trigger.addEventListener('pointerenter', (event) => {
      if (open && open !== menu && event.pointerType === 'mouse') show(menu);
    });
    menu.addEventListener('keydown', (event) => {
      const entries = items(menu);
      const at = entries.indexOf(document.activeElement as HTMLElement);
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (open !== menu) show(menu, true);
        else entries[(at + 1) % entries.length]?.focus();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (open === menu) entries[(at - 1 + entries.length) % entries.length]?.focus();
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const step = event.key === 'ArrowRight' ? 1 : -1;
        const next = menus[(index + step + menus.length) % menus.length];
        const wasOpen = open !== null;
        close();
        if (wasOpen) show(next, true);
        else button(next).focus();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
      } else if (event.key === 'Home' && open === menu) {
        event.preventDefault();
        entries[0]?.focus();
      } else if (event.key === 'End' && open === menu) {
        event.preventDefault();
        entries[entries.length - 1]?.focus();
      }
    });
    list(menu).addEventListener('click', (event) => {
      const target = (event.target as HTMLElement).closest('a, button');
      if (target && !target.hasAttribute('data-keep-open')) close();
    });
  });

  document.addEventListener(
    'pointerdown',
    (event) => {
      if (open && !open.contains(event.target as Node)) close();
    },
    { signal: leaving },
  );
  // Escape closes the open menu wherever the focus is, and a menu that loses the focus closes.
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && open) close(true);
    },
    { signal: leaving },
  );
  menus.forEach((menu) =>
    menu.addEventListener('focusout', (event) => {
      const next = event.relatedTarget as Node | null;
      if (open === menu && next && !menu.contains(next)) close();
    }),
  );
  window.addEventListener('blur', () => close(), { signal: leaving });
}

/* ---------- clock ---------- */

function initClocks(leaving?: AbortSignal) {
  const clocks = Array.from(document.querySelectorAll<HTMLElement>('[data-clock]'));
  if (!clocks.length) return;
  const formatters = new Map<string, Intl.DateTimeFormat>();
  const formatter = (zone: string) => {
    if (!formatters.has(zone)) {
      let format: Intl.DateTimeFormat;
      try {
        format = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: zone });
      } catch {
        format = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
      }
      formatters.set(zone, format);
    }
    return formatters.get(zone)!;
  };
  const tick = () => {
    const now = new Date();
    for (const clock of clocks) {
      const text = formatter(clock.dataset.zone || 'UTC').format(now);
      if (clock.textContent !== text) clock.textContent = text;
      if (clock instanceof HTMLTimeElement) clock.dateTime = now.toISOString();
    }
  };
  tick();
  // Re-align to the minute so the display never lags by more than a second.
  let timer = 0;
  const schedule = () => {
    const wait = 60_000 - (Date.now() % 60_000) + 50;
    timer = window.setTimeout(() => {
      tick();
      schedule();
    }, wait);
  };
  schedule();
  leaving?.addEventListener('abort', () => window.clearTimeout(timer));
}

/* ---------- finder (quick jump) ---------- */

function initFinder(leaving?: AbortSignal) {
  const dialog = document.querySelector<HTMLDialogElement>('[data-finder]');
  if (!dialog) return;
  const input = dialog.querySelector<HTMLInputElement>('[data-finder-input]');
  const entries = Array.from(dialog.querySelectorAll<HTMLElement>('[data-finder-item]'));
  const empty = dialog.querySelector<HTMLElement>('[data-finder-empty]');
  const visible = () => entries.filter((entry) => !entry.hidden);
  let cursor = 0;

  function mark() {
    const shown = visible();
    cursor = Math.max(0, Math.min(cursor, shown.length - 1));
    entries.forEach((entry) => entry.removeAttribute('data-current'));
    shown[cursor]?.setAttribute('data-current', '');
    shown[cursor]?.scrollIntoView({ block: 'nearest' });
    if (empty) empty.hidden = shown.length > 0;
  }

  function filter() {
    const words = (input?.value || '').toLowerCase().split(/\s+/).filter(Boolean);
    for (const entry of entries) {
      const hay = `${entry.textContent} ${entry.dataset.keywords || ''}`.toLowerCase();
      entry.hidden = !words.every((word) => hay.includes(word));
    }
    cursor = 0;
    mark();
  }

  function openFinder() {
    if (dialog!.open) return;
    if (input) input.value = '';
    filter();
    dialog!.showModal();
    input?.focus();
  }

  input?.addEventListener('input', filter);
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      cursor += 1;
      mark();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      cursor -= 1;
      mark();
    } else if (event.key === 'Enter' && event.target === input && !event.isComposing) {
      const target = visible()[cursor];
      if (target) {
        event.preventDefault();
        (target instanceof HTMLAnchorElement ? target : target.querySelector('a'))?.click();
      }
    }
  });
  dialog.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    // An entry may lead to a place on this very page: the finder must not stay in front of it.
    if (target === dialog || target.closest('[data-finder-item]')) dialog.close();
  });
  window.addEventListener(
    'pagehide',
    () => {
      if (dialog.open) dialog.close();
    },
    { signal: leaving },
  );
  // The finder belongs to the page, and goes with it.
  leaving?.addEventListener('abort', () => {
    if (dialog.open) dialog.close();
  });
  document.querySelectorAll('[data-open-finder]').forEach((el) => el.addEventListener('click', openFinder));
  dialog.querySelectorAll('[data-close-finder]').forEach((el) => el.addEventListener('click', () => dialog.close()));

  document.addEventListener(
    'keydown',
    (event) => {
      const typing =
        event.target instanceof Element &&
        event.target.closest('input, textarea, select, [contenteditable="true"]') !== null;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (dialog.open) dialog.close();
        else openFinder();
      } else if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const search = document.querySelector<HTMLInputElement>('[data-page-search]');
        event.preventDefault();
        if (search) search.focus();
        else openFinder();
      }
    },
    { signal: leaving },
  );
}

/* ---------- windows index ---------- */

function initWindowIndex(desk: Desk | null, leaving?: AbortSignal) {
  const lists = Array.from(document.querySelectorAll<HTMLElement>('[data-desk-windows]'));
  const resets = Array.from(document.querySelectorAll<HTMLElement>('[data-desk-reset]'));
  if (!desk) {
    lists.forEach((list) => list.closest<HTMLElement>('[data-menu]')?.setAttribute('hidden', ''));
    resets.forEach((el) => (el.hidden = true));
    return;
  }
  // The buttons are made once and then only updated, so the one in use keeps the focus.
  const render = () => {
    const windows = desk.list();
    for (const list of lists) {
      for (const win of windows) {
        let button = list.querySelector<HTMLButtonElement>(`button[data-win="${win.id}"]`);
        if (!button) {
          const item = document.createElement('li');
          button = document.createElement('button');
          button.type = 'button';
          button.setAttribute('data-keep-open', '');
          button.dataset.win = win.id;
          item.append(button);
          list.append(item);
        }
        button.textContent = win.title;
        button.setAttribute('aria-pressed', String(!win.closed));
      }
    }
  };
  lists.forEach((list) =>
    list.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('button[data-win]');
      if (!button) return;
      const id = button.dataset.win!;
      const state = desk.list().find((win) => win.id === id);
      if (state?.closed) desk.open(id, button.getBoundingClientRect());
      else desk.close(id);
    }),
  );
  resets.forEach((el) => el.addEventListener('click', () => desk.reset()));
  document.addEventListener('desk:change', render, { signal: leaving });
  render();
}

/* ---------- openers ---------- */

/** [data-opens="id"] opens a window of the desk, with zoom rectangles from the opener. */
function initOpeners(desk: Desk | null, leaving?: AbortSignal) {
  if (!desk) return;
  document.addEventListener(
    'click',
    (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      const opener = (event.target as HTMLElement).closest<HTMLElement>('[data-opens]');
      if (!opener) return;
      event.preventDefault();
      desk.toggle(opener.dataset.opens!, opener.getBoundingClientRect());
    },
    { signal: leaving },
  );
}

/* ---------- windows that are the page ---------- */

/**
 * On an inner page the main window cannot be moved, but its zoom box still works:
 * it widens the page to the full width of the screen and back.
 */
function initDocumentWindows() {
  document.querySelectorAll<HTMLElement>('.win.is-document [data-act="zoom"]').forEach((box) => {
    const page = box.closest<HTMLElement>('.page');
    if (!page) return;
    const key = 'page:wide';
    const apply = (on: boolean) => {
      page.toggleAttribute('data-wide', on);
      box.setAttribute('aria-pressed', String(on));
    };
    apply(store.get(key) === '1');
    box.addEventListener('click', () => {
      const on = !page.hasAttribute('data-wide');
      apply(on);
      store.set(key, on ? '1' : '0');
    });
  });
}

/**
 * @param leaving ends when the page is left: the strip is part of the page, and what it
 *                listens for on the window and the document is given up with it
 */
export function initShell(desk: Desk | null, leaving?: AbortSignal) {
  initMenus(leaving);
  initDocumentWindows();
  initClocks(leaving);
  initFinder(leaving);
  initWindowIndex(desk, leaving);
  initOpeners(desk, leaving);
  document.querySelectorAll<HTMLElement>('[data-set-theme]').forEach((el) =>
    el.addEventListener('click', () => setTheme(el.dataset.setTheme as Theme)),
  );
  // Reflect the theme in the menu without saving it: it may have come from the address.
  setTheme(currentTheme(), false);
}
