# Design

This is the rule book for how the site looks and behaves. Read it before adding a page,
a component or a drawing.

## The idea

The site is an **archive**: one hall with no far wall, drawn in one-point perspective,
with cabinets along both walls. Every section is a **gate** further down the hall.
Going to a section sends a small figure walking there and the camera after it.

The site is first of all an academic site. The hall is its setting, not its subject:

- **The hall is one place.** It is drawn once and stays while pages are exchanged in front
  of it, so a walk is never cut by a blank screen.
- **Nobody waits for a walk.** The page that is left goes at once; the next is fed up from
  below like a sheet of paper within half a second; the walk carries on behind it.
- **Every section is always one click away.** Gates that have been walked past are behind
  the viewer, so the strip at the top lists all halls at all times, and a red mark under
  the list shows how far in the visitor stands.

Two hands made it, and they must never be confused:

| | drawn by hand | ruled by machine |
| --- | --- | --- |
| what | the hall, its cabinets, the carpet, marks under a phrase, a few handwritten words | windows, type, tables, controls |
| how | rough, doubled strokes that overshoot their corners | hairlines, square corners, hard shadows |

The future is the clean, empty, endless room. The past is the rough pen, the typewriter and
the filing cabinet. In the hall the two are kept apart by place: the **middle** (gates,
light, carpet) stays white and empty; the **walls** carry the detail.
**Empty space is part of the design.** When in doubt, remove.

## Colour

Named in `src/styles/tokens.css`. Nothing else may be hard-coded.

| token | use |
| --- | --- |
| `--paper`, `--paper-2`, `--bond` | the room, shaded paper, window faces |
| `--ink`, `--ink-2`, `--ink-3` | text and lines; secondary text; labels |
| `--rule`, `--rule-2`, `--rule-3` | hairlines, from faint to strong |
| `--red`, `--red-deep`, `--red-wash` | the carpet, the mark, the thing in use |
| `--amber`, `--blue` | spot colours, **in drawings only** |
| `--tan`, `--kraft` | the cabinets of the hall (a wash); folders and boxes |

**Pages** are paper, ink and one red.

- Red covers **less than a tenth** of any view. Use it for one kind of thing per view.
- No other hue in the pages: no blue links, no green for "ok", no yellow highlights.

**Drawings** (the hall, the work board) have amber and blue as well.

- Colour belongs to **things on file**, never to surfaces: a card in its holder, the spine
  of a binder, the tab of a folder. Architecture is ink on white.
- On the work board blue and amber are **second voices**: one of them, in one role, in a
  drawing that has two kinds of thing to show (the line under the pen, the records that
  are still provisional). Red remains the anomaly. See `src/scripts/board/kit.ts`.
- About one card in six is coloured. If a view starts to look colourful, there is too much.
- Photographs and figures inside lists are shown in ink (`.plate`) and return to their own
  colours when looked at. Pictures inside an article keep their colours.

## Type

Four faces, each with one job.

| token | face | job | sizes |
| --- | --- | --- | --- |
| `--f-dots` | Doto | the few large words: names, hall titles, years | 20px and up, light to medium |
| `--f-machine` | Departure Mono | what the apparatus prints: chrome, labels, read-outs | **11px only**, upper case |
| `--f-typed` | Courier Prime | everything a person wrote: all running text | 13.5 / 15 / 16.5px |
| `--f-hand` | Reenie Beanie | a remark in red ballpoint | a few words, never a sentence of instruction |

- Departure Mono is a bitmap face and is only sharp at multiples of 11px.
- Emphasis is typed: **bold** (struck twice), underline (`.under`), CAPITALS. Italic is for titles of works.
- Chinese text falls back to Fangsong / Songti, the faces of typed and printed Chinese documents.

## Windows

`src/components/chrome/Window.astro`. A window has a title bar (close box on the left, title in
the middle, roll-up and zoom boxes on the right), a body, and an optional status bar.

- The window in use wears pinstripes and a full shadow; the others rest. State is shown by
  adding or removing ornament, not by changing colour.
- On the entrance page windows can be dragged, resized, rolled up, zoomed and closed.
- On an inner page the main window is the page (`document`): its close box leads back to
  the entrance.
- No rounded corners. No blurred shadows. No gradients. No icons: a control is a box or a word.

## Layout of an inner page

```astro
<Room hall="pubs" title="Publications" description="…">
  <div class="page">
    <PageHead no={hall.no} title="Publications" lede="One line about this hall." />
    <Window id="catalogue" title="Catalogue" document flush class="arrive" style="--i:1">
      <div class="toolbar" data-filter>…</div>
      <div data-list>… <article class="entry" data-item>…</article> …</div>
      <Fragment slot="status"><span data-count>12 papers</span><span>…</span></Fragment>
    </Window>
  </div>
</Room>
```

Parts to reuse (do not reinvent them):

- `src/styles/page.css`: `.page`, `.page-head`, `.page-grid` (`.has-side`), `.page-side`,
  `.toolbar`, `.entry`, `.group`, `.plate`, `.crumbs`
- `src/styles/kit.css`: `.form` / `.field`, `.tag` / `.tags`, `.btn` / `.btns`, `.input`,
  `.select`, `.ledger`, `.heading`, `.stamp`, `.under`, `.empty`, `kbd`
- `src/styles/base.css`: `.machine`, `.label`, `.typed`, `.dots` (`.dots-xl` … `.dots-sm`),
  `.hand`, `.head-1` … `.head-3`, `.sr-only`
- `src/scripts/desk/filter.ts`: search and filter a list, state kept in the address
- `src/components/read/Reader.astro`: a document to read, with contents

## The hall and the pages

`src/layouts/Room.astro` uses Astro's `<ClientRouter />`: a link exchanges the page without
loading the document again, and the hall (`transition:persist`) stays.

- `data-hall-key` and `data-mode` on `<html>` say where the page stands and how much of the
  hall it leaves open: `room` (the entrance) or `band` (a strip across the top).
- `src/scripts/archive/hall.ts` listens to the router, walks the camera, and sets
  `data-leaving` / `data-arriving` on `<html>`; the movements themselves are in `chrome.css`.
- **A script that sets a page up must go through `onPage`** (`src/scripts/page.ts`), and add
  its listeners on `window` and `document` with the signal it is given. A script that runs
  only once will find its page gone after the first exchange.

## Motion

- Walking between halls: under two seconds, and never waited for.
- A page is exchanged in about half a second.
- Everything else: under 300ms, and only in answer to something the visitor did.
- `prefers-reduced-motion` exchanges pages at once, moves the camera without a walk, and
  turns every drawing into one settled picture.

## Every page must

- read correctly with JavaScript off (links work, text is there);
- work from 320px wide; nothing scrolls sideways;
- be usable from the keyboard, with a visible red focus outline;
- keep text contrast at 4.5:1 or better (`--ink-3` on paper is the lightest text allowed);
- say nothing the owner did not say: content comes from `src/content` and `src/data`.
