/**
 * Pages come and go without the document being loaded again (see Room.astro): the hall
 * stays, and only what stands in front of it is exchanged. A script therefore runs once,
 * and must set its page up every time that page is shown.
 *
 *   onPage((leaving) => { ... })
 *
 * calls the function for every page shown, with a signal that ends when that page is left.
 * Listeners on `window` and `document` must be added with that signal, or they pile up;
 * listeners on elements of the page go when the elements go.
 */
export function onPage(setup: (leaving: AbortSignal) => void): void {
  let page: AbortController | null = null;
  document.addEventListener('astro:page-load', () => {
    page?.abort();
    page = new AbortController();
    setup(page.signal);
  });
  document.addEventListener('astro:before-swap', () => page?.abort());
}
