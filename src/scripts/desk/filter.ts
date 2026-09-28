/**
 * Filtering a list on the page.
 *
 *   [data-filter]          the bar of controls
 *     [data-filter-text]   free text, matched against every item's data-text
 *     [data-filter-<key>]  a <select> or a group of buttons[data-value]; matched against data-<key>
 *     [data-filter-reset]
 *   [data-list]            the list
 *     [data-item]          one entry, with data-text and data-<key> attributes
 *     section / [data-group]  hidden when none of its items is shown
 *     [data-none]          shown when nothing matches
 *   [data-count]           receives "3 of 12"
 *
 * The state is kept in the address (?q=...&type=...), so a filtered list can be linked to.
 */
export function initFilter(scope: ParentNode = document) {
  const bar = scope.querySelector<HTMLElement>('[data-filter]');
  const list = scope.querySelector<HTMLElement>('[data-list]');
  if (!bar || !list) return;

  const items = Array.from(list.querySelectorAll<HTMLElement>('[data-item]'));
  const groups = Array.from(list.querySelectorAll<HTMLElement>('section, [data-group]'));
  const none = list.querySelector<HTMLElement>('[data-none]');
  const count = scope.querySelector<HTMLElement>('[data-count]');
  const text = bar.querySelector<HTMLInputElement>('[data-filter-text]');
  const reset = bar.querySelector<HTMLElement>('[data-filter-reset]');
  const noun = count?.textContent?.trim().replace(/^\d+\s*/, '') || 'items';

  // Every other data-filter-* attribute names a key to match on.
  const controls = Array.from(bar.querySelectorAll<HTMLElement>('*')).flatMap((el) =>
    Object.keys(el.dataset)
      .filter((name) => name.startsWith('filter') && !['filter', 'filterText', 'filterReset'].includes(name))
      .map((name) => ({ el, key: name.slice(6).toLowerCase() })),
  );

  const state = new Map<string, string>();
  const params = new URLSearchParams(location.search);
  if (text) text.value = params.get('q') ?? '';
  for (const { el, key } of controls) {
    const value = params.get(key) ?? '';
    // Only values the control really offers are accepted from the address.
    const offered =
      el instanceof HTMLSelectElement
        ? Array.from(el.options).some((option) => option.value === value)
        : Array.from(el.querySelectorAll<HTMLElement>('[data-value]')).some((button) => button.dataset.value === value);
    state.set(key, offered ? value : '');
    if (el instanceof HTMLSelectElement) el.value = offered ? value : '';
  }

  function paint() {
    for (const { el, key } of controls) {
      if (el instanceof HTMLSelectElement) continue;
      el.querySelectorAll<HTMLElement>('[data-value]').forEach((button) => {
        const on = (button.dataset.value ?? '') === (state.get(key) ?? '');
        button.setAttribute('aria-pressed', String(on));
      });
    }
  }

  function apply(updateAddress = true) {
    const words = (text?.value ?? '').toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const item of items) {
      const hay = item.dataset.text ?? item.textContent?.toLowerCase() ?? '';
      let ok = words.every((word) => hay.includes(word));
      for (const [key, value] of state) {
        if (!ok || !value) continue;
        const own = (item.getAttribute(`data-${key}`) ?? '').split(/\s*,\s*/);
        ok = own.includes(value);
      }
      item.hidden = !ok;
      if (ok) shown += 1;
    }
    for (const group of groups) {
      group.hidden = !group.querySelector('[data-item]:not([hidden])');
    }
    if (none) none.hidden = shown > 0;
    if (count) count.textContent = shown === items.length ? `${items.length} ${noun}` : `${shown} of ${items.length} ${noun}`;
    paint();

    if (!updateAddress) return;
    // Keep whatever else the address carries (for example ?theme=dusk).
    const next = new URLSearchParams(location.search);
    next.delete('q');
    for (const key of state.keys()) next.delete(key);
    if (text?.value) next.set('q', text.value);
    for (const [key, value] of state) if (value) next.set(key, value);
    const query = next.toString();
    history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
  }

  text?.addEventListener('input', () => apply());
  for (const { el, key } of controls) {
    if (el instanceof HTMLSelectElement) {
      el.addEventListener('change', () => {
        state.set(key, el.value);
        apply();
      });
    } else {
      el.addEventListener('click', (event) => {
        const button = (event.target as HTMLElement).closest<HTMLElement>('[data-value]');
        if (!button) return;
        state.set(key, button.dataset.value ?? '');
        apply();
      });
    }
  }
  reset?.addEventListener('click', () => {
    if (text) text.value = '';
    for (const { el, key } of controls) {
      state.set(key, '');
      if (el instanceof HTMLSelectElement) el.value = '';
    }
    apply();
    text?.focus();
  });

  apply(false);
}
