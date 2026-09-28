/**
 * CITY
 * Chicago crime records, drawn as a map and a chart. The stepped outline is the city:
 * inland edge on the west, lake shore on the east. Records arrive one by one as loose
 * grey dots (the live, real-time layer). Every few seconds a batch job sweeps down the
 * map as a ruled line. Where a cell holds enough records the line gathers them into one
 * settled square whose area shows the count; in a quiet cell the dots are filed and the
 * paper is left clean. The busiest cell of the sheet is the one red square: it appears
 * when the first batch line crosses it and does not move again. On the right the same
 * records are counted by hour of day: ink is what the batches have settled, grey on top
 * is what is still live. After three batches the sheet is replaced by another, with
 * other hot spots and another busiest hour.
 */
import {
  type Frame,
  type Palette,
  type Point,
  type Pointer,
  type Program,
  TAU,
  block,
  clamp,
  label,
  lerp,
  line,
  perturb,
  pixelStroke,
  rand,
  smooth,
  snap,
  ticks,
} from '../kit';

const COLS = 9;
const ROWS = 14;
const HOURS = 24;
/** First and last column of every row, north to south. */
const SHAPE: ReadonlyArray<readonly [number, number]> = [
  [2, 4],
  [0, 4],
  [0, 5],
  [1, 5],
  [1, 5],
  [1, 6],
  [1, 6],
  [1, 6],
  [1, 7],
  [2, 7],
  [2, 8],
  [3, 8],
  [3, 8],
  [5, 8],
];

const FIRST = 1.6; // seconds before the first batch: the sheet arrives with records on it
const STREAM = 3.6; // seconds of arrivals between one batch and the next
const SWEEP = 3.2; // seconds the batch line takes to cross the city
const BATCHES = 3; // batches per sheet
const HOLD = 2.8; // seconds to rest on the finished sheet
const PERIOD = STREAM + SWEEP;
const LAST = FIRST + (BATCHES - 1) * PERIOD; // second at which the last batch starts
const SHEET = LAST + SWEEP + HOLD;
const FADE_IN = 0.4; // seconds the new sheet takes to appear
const FADE_OUT = 0.6; // seconds the old sheet takes to leave
const RATE = 8; // dots per second
const BACKLOG = 25; // dots already lying on the sheet when it arrives
const TAIL = 7; // late dots, after the last batch has started
const DROP = 0.5; // seconds a dot takes to fall into place
const GATHER = 0.45; // seconds loose dots take to join their square
const LINE_IN = 0.3;
const LINE_OUT = 0.5;
const EARLY = 0.6; // area of the busiest square after the first batch, as a share of its last
const LIGHTEST = 70; // the fewest records one dot stands for
/** The settled picture: the last batch is done and a few records have arrived since. */
const STILL_AT = LAST + SWEEP + HOLD * 0.5;
/** Steps of the two dealing sequences (golden and silver ratio). */
const GOLD = 0.6180339887498949;
const SILVER = 0.41421356237309515;

interface Cell {
  col: number;
  row: number;
  /** centre, in pixels */
  x: number;
  y: number;
}

interface Rec {
  cell: number;
  /** resting place inside the cell, in cell units from its centre */
  ox: number;
  oy: number;
  hour: number;
  /** how many records the dot stands for */
  weight: number;
  /** second at which it lands; below zero for the backlog */
  at: number;
  /** second at which a batch line reaches it; Infinity if none does on this sheet */
  settle: number;
  /** true if the line gathers it into a square, false if it is filed without a mark */
  joins: boolean;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const spaced = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const sweepStart = (k: number) => FIRST + k * PERIOD;
/** Second at which the line of batch k crosses the middle of a row. */
const rowTime = (k: number, row: number) => sweepStart(k) + (SWEEP * (row + 1)) / (ROWS + 1);
/** First and last column of a row; a row outside the city has none. */
const firstOf = (row: number) => (row < 0 || row >= ROWS ? COLS : SHAPE[row][0]);
const lastOf = (row: number) => (row < 0 || row >= ROWS ? -1 : SHAPE[row][1]);
/** On the boundary, with the rows above and below not reaching past it: a caption fits right beside. */
const open = (c: Cell) =>
  (c.col === firstOf(c.row) && firstOf(c.row - 1) >= c.col && firstOf(c.row + 1) >= c.col) ||
  (c.col === lastOf(c.row) && lastOf(c.row - 1) <= c.col && lastOf(c.row + 1) <= c.col);
const hourTicks = { length: 4, captions: (i: number) => (i % 2 === 0 ? `${pad2(i * 6)}H` : null) };

/**
 * Deal by quota, not by chance: `u` walks the unit interval in even steps and takes the
 * entry whose slice of the total it falls in, so every stretch of the film holds its fair
 * share of each entry.
 */
function deal(share: number[], sum: number, u: number): number {
  let target = u * sum;
  for (let i = 0; i < share.length; i += 1) {
    target -= share[i];
    if (target < 0) return i;
  }
  return share.length - 1;
}

export default function city(): Program {
  let width = 1;
  let height = 1;
  let seed = 1;
  let sheet = 0;
  let clock = 0; // seconds spent on this sheet
  let carried = 0; // records on the sheets already replaced

  let cell = 16;
  let left = 0;
  let top = 0;
  let dot = 2;
  let reach = 50;
  let compact = false;
  let cells: Cell[] = [];
  let outline: Point[] = [];
  let rule: Point[] = [];
  const chart = { x0: 0, x1: 1, base: 1, height: 1, pitch: 1, bar: 2, bins: HOURS };
  const axis: Point[] = [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ];
  /** The key under the chart. Measured once a second, in case the lettering has just loaded. */
  const key = { font: '', second: -1, tracking: 1, square: { x: 0, y: 0 }, settled: { x: 0, y: 0 }, dot: { x: 0, y: 0 }, live: { x: 0, y: 0 } };

  let records: Rec[] = [];
  /** Side of every cell's square after each batch, batch by batch; zero where there is none. */
  let sides = new Float32Array(0);
  let hot = 0;
  let hotEast = true;
  let peakHour = 1;
  let total = 0;

  // Tallies, refilled every frame.
  const hourSettled = new Float32Array(HOURS);
  const hourLive = new Float32Array(HOURS);
  const spot: Point = { x: 0, y: 0 };
  /** The batch line on the sheet: which batch (-1 for none), its height, how strongly drawn. */
  const pass = { k: -1, y: 0, alpha: 0 };

  let batch = 0;
  let ingested = 0;
  let live = 0;

  function layout() {
    const padY = Math.max(16, height * 0.095);
    cell = Math.max(6, Math.floor(Math.min((height - 2 * padY) / ROWS, (width * 0.33) / COLS)));
    dot = cell >= 20 ? 3 : 2;
    compact = width < 380;
    reach = Math.min(width, height) * 0.2;
    left = Math.round(Math.max(34, width * 0.09));
    top = Math.round((height - cell * ROWS) / 2);

    cells = [];
    SHAPE.forEach(([first, last], row) => {
      for (let col = first; col <= last; col += 1) {
        cells.push({ col, row, x: left + (col + 0.5) * cell, y: top + (row + 0.5) * cell });
      }
    });
    sides = new Float32Array(BATCHES * cells.length);

    // The boundary, walked clockwise from the north-west corner, one point per cell side.
    const at = (gx: number, gy: number): Point => ({ x: left + gx * cell, y: top + gy * cell });
    outline = [at(SHAPE[0][0], 0)];
    let gx = SHAPE[0][0];
    let gy = 0;
    const walk = (toX: number, toY: number) => {
      while (gx !== toX || gy !== toY) {
        gx += Math.sign(toX - gx);
        gy += Math.sign(toY - gy);
        outline.push(at(gx, gy));
      }
    };
    for (let row = 0; row < ROWS; row += 1) {
      walk(SHAPE[row][1] + 1, row);
      walk(SHAPE[row][1] + 1, row + 1);
    }
    for (let row = ROWS - 1; row >= 0; row -= 1) {
      walk(SHAPE[row][0], row + 1);
      walk(SHAPE[row][0], row);
    }

    rule = [];
    for (let i = 0; i <= COLS; i += 1) {
      const x = i === 0 ? left - 6 : i === COLS ? left + COLS * cell + 6 : left + i * cell;
      rule.push({ x, y: 0 });
    }

    // The chart stands low on the right, its key on the line of the city's southern edge.
    // A small sheet counts by two hours, so that the bars stay apart.
    const right = width - Math.round(Math.max(16, width * 0.06));
    chart.bins = compact ? HOURS / 2 : HOURS;
    chart.pitch = compact ? 8 : Math.max(4, Math.floor((width * 0.29) / HOURS));
    chart.bar = compact ? 3 : Math.max(2, Math.round(chart.pitch * 0.4));
    chart.x1 = right;
    chart.x0 = right - chart.pitch * chart.bins;
    chart.base = top + cell * ROWS - 30;
    chart.height = Math.round(cell * 4.2);
    axis[0].x = chart.x0;
    axis[1].x = chart.x1;
    axis[0].y = axis[1].y = chart.base + 0.5;
    key.tracking = compact ? 0 : 1;
    key.font = '';
  }

  /** Place the key: a settled square and a loose dot, named once, on one line under the chart. */
  function legend(ctx: CanvasRenderingContext2D, palette: Palette) {
    const second = Math.floor(clock);
    if (key.font === palette.labelFont && key.second === second) return;
    key.font = palette.labelFont;
    key.second = second;
    ctx.save();
    ctx.font = `10px ${key.font}`;
    const letter = ctx.measureText('M').width + key.tracking;
    ctx.restore();
    const next = Math.round(11 + letter * 7 + 10);
    const x = Math.round(Math.min(chart.x0, width - 8 - (next + 8 + letter * 4)));
    const y = chart.base + 30;
    key.square.x = x + 3;
    key.settled.x = x + 11;
    key.dot.x = x + next + 1;
    key.live.x = x + next + 8;
    key.square.y = key.dot.y = y;
    key.settled.y = key.live.y = y + 0.5;
  }

  /** One sheet of records: where the hot spots are, when every dot lands, what each batch leaves. */
  function build() {
    const rng = rand(Math.imul(seed + sheet * 31 + 1, 0x9e3779b1) >>> 0);
    for (let i = 0; i < 4; i += 1) rng();
    const count = cells.length;

    // Three hot spots of falling strength, well apart, on a quiet background. The strongest
    // lies on an open stretch of the boundary, where its caption can stand beside it.
    const spots: Cell[] = [];
    for (let guard = 0; spots.length < 3 && guard < 400; guard += 1) {
      const pick = cells[Math.floor(rng() * count)];
      const fits = spots.length === 0 ? open(pick) : spots.every((s) => Math.hypot(s.col - pick.col, s.row - pick.row) >= 4);
      if (fits) spots.push(pick);
    }
    const strength = [16, 7, 4.5];
    let cellSum = 0;
    const cellShare = cells.map((c) => {
      let v = 0.25;
      spots.forEach((s, k) => {
        const d2 = (s.col - c.col) ** 2 + (s.row - c.row) ** 2;
        v += strength[k] * Math.exp(-d2 / 0.9);
      });
      cellSum += v;
      return v;
    });

    // Quiet before dawn, busiest in the evening.
    const busiest = 17 + rng() * 5;
    let hourSum = 0;
    const hourShare: number[] = [];
    for (let hour = 0; hour < HOURS; hour += 1) {
      const swing = 0.5 + 0.5 * Math.cos(((hour - busiest) / HOURS) * TAU);
      const v = 0.3 + 0.7 * swing + (rng() - 0.5) * 0.12;
      hourSum += v;
      hourShare.push(v);
    }

    // A backlog that lies on the sheet from the start, a steady stream until the last batch
    // begins, then a few late arrivals. A small sheet has less room, so it is given fewer dots.
    const room = clamp(cell / 16, 0.6, 1);
    const times: number[] = [];
    for (let i = Math.round(BACKLOG * room); i > 0; i -= 1) times.push(-1);
    for (let i = Math.round(RATE * room * LAST); i > 0; i -= 1) times.push(0.15 + rng() * (LAST - 0.15));
    for (let i = Math.round(TAIL * room); i > 0; i -= 1) times.push(LAST + 0.3 + rng() * (SWEEP + HOLD - FADE_OUT - 0.7));
    times.sort((a, b) => a - b);

    const cellStart = rng();
    const hourStart = rng();
    const reached = new Int8Array(times.length);
    const hourTotal = new Float32Array(chart.bins);
    const final = new Float32Array(count);
    total = 0;
    records = times.map((at, i) => {
      const index = deal(cellShare, cellSum, (cellStart + i * GOLD) % 1);
      const hour = deal(hourShare, hourSum, (hourStart + i * SILVER) % 1);
      const weight = LIGHTEST + Math.floor(rng() * 60);
      let settle = Infinity;
      reached[i] = -1;
      for (let k = 0; k < BATCHES; k += 1) {
        const crossing = rowTime(k, cells[index].row);
        if (crossing >= at) {
          settle = crossing;
          reached[i] = k;
          final[index] += weight;
          break;
        }
      }
      hourTotal[compact ? hour >> 1 : hour] += weight;
      total += weight;
      return { cell: index, ox: (rng() - 0.5) * 0.76, oy: (rng() - 0.5) * 0.76, hour, weight, at, settle, joins: false };
    });
    peakHour = 1;
    for (let i = 0; i < hourTotal.length; i += 1) peakHour = Math.max(peakHour, hourTotal[i]);

    // The red cell is decided once, from what the sheet holds when all batches are done.
    hot = 0;
    for (let i = 1; i < count; i += 1) if (final[i] > final[hot]) hot = i;
    const home = cells[hot];
    hotEast = lastOf(home.row) - home.col <= home.col - firstOf(home.row);

    // What every batch leaves behind. Area shows the count, measured against the busiest
    // cell, which is already large after the first batch and full size after the last.
    // A cell below the mark, or with a single dot, leaves no square; a square once drawn
    // does not shrink.
    const largest = cell * 0.72;
    const mark = compact ? 0.22 : 0.15;
    const running = new Float32Array(count);
    let before = 0;
    for (let k = 0; k < BATCHES; k += 1) {
      for (let i = 0; i < records.length; i += 1) if (reached[i] === k) running[records[i].cell] += records[i].weight;
      const grown = lerp(EARLY, 1, k / (BATCHES - 1));
      const hotSide = Math.round(largest * Math.sqrt(grown));
      const measure = Math.max(1, running[hot]);
      for (let i = 0; i < count; i += 1) {
        const was = k > 0 ? sides[(k - 1) * count + i] : 0;
        let side = 0;
        if (i === hot) side = hotSide;
        else if (was > 0 || running[i] >= Math.max(mark * measure, 2 * LIGHTEST)) {
          // The line reaches the rows north of the red square first: they are held under
          // the size it still has, so that it is the largest mark at every moment.
          const limit = (cells[i].row < home.row && k > 0 ? before : hotSide) - 2;
          side = clamp(largest * Math.sqrt((grown * running[i]) / measure), Math.max(was, dot + 1), limit);
        }
        sides[k * count + i] = side;
      }
      before = hotSide;
    }
    for (let i = 0; i < records.length; i += 1) {
      records[i].joins = reached[i] >= 0 && sides[reached[i] * count + records[i].cell] > 0;
    }
  }

  /** A place on the sheet, pushed away from the pointer. Returns a shared point. */
  function place(x: number, y: number, pointer: Pointer, push: number): Point {
    spot.x = x;
    spot.y = y;
    if (pointer.active) {
      const dx = x - pointer.x;
      const dy = y - pointer.y;
      const d2 = dx * dx + dy * dy;
      const g = Math.exp(-d2 / (reach * reach));
      const inv = 1 / (Math.sqrt(d2) + 0.001);
      spot.x += dx * inv * g * push;
      spot.y += dy * inv * g * push;
    }
    return spot;
  }

  function furniture(frame: Frame) {
    const { ctx, palette, pointer } = frame;
    pixelStroke(ctx, perturb(outline, pointer, reach, 6), { color: palette.soft, alpha: 0.9, width: 1.6, seed: 4100 });

    line(ctx, axis, { color: palette.soft });
    ticks(ctx, { x: chart.x0, y: chart.base }, { x: chart.x1, y: chart.base }, 4, palette, hourTicks);

    legend(ctx, palette);
    block(ctx, key.square, 5, { fill: palette.ink, alpha: 0.88 });
    label(ctx, 'SETTLED', key.settled, palette, { size: 10, tracking: key.tracking });
    block(ctx, key.dot, dot, { fill: palette.ochre, alpha: 0.95 });
    label(ctx, 'LIVE', key.live, palette, { size: 10, tracking: key.tracking });
  }

  /** Loose dots: falling, resting, being gathered or filed. Fills the tallies on the way. */
  function rain(frame: Frame, tau: number, fade: number, arrive: number) {
    const { ctx, palette, pointer, still } = frame;
    hourSettled.fill(0);
    hourLive.fill(0);
    let landed = 0;
    let loose = 0;

    for (let i = 0; i < records.length; i += 1) {
      const rec = records[i];
      const since = tau - rec.at;
      if (since < -DROP) break;
      if (since < 0 && still) continue;
      // The backlog is counted in while the sheet appears, so the read-out does not jump.
      if (since >= 0) landed += rec.weight * (rec.at < 0 ? arrive : 1);

      const bin = compact ? rec.hour >> 1 : rec.hour;
      const gather = tau - rec.settle;
      if (gather >= GATHER) {
        hourSettled[bin] += rec.weight;
        continue;
      }

      const home = cells[rec.cell];
      let x = home.x + rec.ox * cell;
      let y = home.y + rec.oy * cell;
      let alpha = 0.9;
      let fresh = 0;
      if (since < 0) {
        const u = 1 + since / DROP;
        y -= (1 - u) * (1 - u) * cell * 1.5;
        alpha *= u;
        fresh = 1;
      } else if (gather >= 0) {
        const g = smooth(gather / GATHER);
        if (rec.joins) {
          x = lerp(x, home.x, g);
          y = lerp(y, home.y, g);
        } else {
          alpha *= 1 - g;
        }
        hourSettled[bin] += rec.weight * g;
        hourLive[bin] += rec.weight * (1 - g);
        loose += rec.weight * (1 - g);
      } else {
        hourLive[bin] += rec.weight;
        loose += rec.weight;
        if (!still) fresh = clamp(1 - since / 0.4, 0, 1);
      }

      const p = place(x, y, pointer, 7);
      // What has come in since the last batch is amber; what the batch settled is ink.
      block(ctx, p, dot, { fill: palette.ochre, alpha: alpha * fade });
      if (fresh > 0) block(ctx, p, dot, { fill: palette.ink, alpha: alpha * fresh * fade });
    }

    ingested = carried + landed;
    live = loose * fade;
  }

  /** Find the batch line for this second of the sheet. */
  function locate(tau: number, still: boolean) {
    pass.k = -1;
    batch = sheet * BATCHES + clamp(Math.floor((tau - FIRST) / PERIOD) + 1, 0, BATCHES);
    if (still) return;
    for (let k = 0; k < BATCHES; k += 1) {
      const u = tau - sweepStart(k);
      if (u < -LINE_IN || u > SWEEP + LINE_OUT) continue;
      pass.k = k;
      pass.y = top - cell / 2 + clamp(u / SWEEP, 0, 1) * cell * (ROWS + 1);
      pass.alpha = smooth(clamp((u + LINE_IN) / LINE_IN, 0, 1)) * (1 - smooth(clamp((u - SWEEP) / LINE_OUT, 0, 1)));
    }
  }

  /** Side of a cell's square at this second: it grows each time a batch line crosses its row. */
  function sideAt(index: number, tau: number): number {
    const row = cells[index].row;
    let side = 0;
    for (let k = 0; k < BATCHES; k += 1) {
      const u = (tau - rowTime(k, row)) / GATHER;
      if (u <= 0) break;
      side = lerp(side, sides[k * cells.length + index], smooth(Math.min(1, u)));
    }
    return side;
  }

  /** Settled squares in ink, and the busiest cell of the sheet in red. */
  function squares(frame: Frame, tau: number, fade: number) {
    const { ctx, palette, pointer } = frame;
    const last = (BATCHES - 1) * cells.length;
    for (let i = 0; i < cells.length; i += 1) {
      if (i === hot || sides[last + i] <= 0) continue;
      const side = sideAt(i, tau);
      if (side < 1) continue;
      block(ctx, place(cells[i].x, cells[i].y, pointer, 4), side, { fill: palette.ink, alpha: 0.88 * fade });
    }

    // No red on the sheet until the first batch line has reached the cell.
    const home = cells[hot];
    const side = sideAt(hot, tau);
    if (side < 1) return;
    const p = place(home.x, home.y, pointer, 4);
    block(ctx, p, side, { fill: palette.signal, alpha: fade });

    // Named right beside it, outside the boundary. The caption moves with the square and
    // steps aside while a batch line crosses.
    const clear = pass.k < 0 ? 1 : smooth(clamp((Math.abs(pass.y - home.y) - cell * 0.7) / cell, 0, 1));
    const x = p.x + (hotEast ? cell / 2 + 10 : -cell / 2 - 10);
    label(ctx, 'MAX', { x, y: p.y + 0.5 }, palette, {
      color: palette.signal,
      align: hotEast ? 'left' : 'right',
      size: 10,
      tracking: 1,
      alpha: clear * fade,
    });
  }

  /** The batch line, named at the lake end. */
  function sweep(frame: Frame) {
    if (pass.k < 0) return;
    const { ctx, palette, pointer } = frame;
    for (let i = 0; i < rule.length; i += 1) rule[i].y = pass.y;
    pixelStroke(ctx, perturb(rule, pointer, reach, 6), { color: palette.ink, alpha: 0.92 * pass.alpha, width: 2.4, seed: 900 });
    // A small sheet has no room for the number; the read-out carries it.
    const name = compact ? 'BATCH' : `BATCH ${pad2(sheet * BATCHES + pass.k + 1)}`;
    label(ctx, name, { x: rule[rule.length - 1].x + 8, y: snap(pass.y, 2.5) + 0.5 }, palette, {
      color: palette.ink,
      alpha: 0.85 * pass.alpha,
      size: 10,
      tracking: 1,
    });
  }

  /** Records by hour of day: ink is settled, grey on top is still live. */
  function histogram(frame: Frame, fade: number) {
    const { ctx, palette } = frame;
    ctx.save();
    for (let bin = 0; bin < chart.bins; bin += 1) {
      const x = Math.round(chart.x0 + (bin + 0.5) * chart.pitch - chart.bar / 2);
      const firmTop = Math.round((hourSettled[bin] / peakHour) * chart.height);
      const liveTop = Math.round(((hourSettled[bin] + hourLive[bin]) / peakHour) * chart.height);
      if (firmTop > 0) {
        ctx.globalAlpha = 0.88 * fade;
        ctx.fillStyle = palette.ink;
        ctx.fillRect(x, chart.base - firmTop, chart.bar, firmTop);
      }
      if (liveTop > firmTop) {
        ctx.globalAlpha = 0.9 * fade;
        ctx.fillStyle = palette.ochre;
        ctx.fillRect(x, chart.base - liveTop, chart.bar, liveTop - firmTop);
      }
    }
    ctx.restore();
  }

  return {
    init(w, h, nextSeed) {
      width = w;
      height = h;
      seed = nextSeed;
      sheet = 0;
      clock = 0;
      carried = 0;
      layout();
      build();
    },

    draw(frame) {
      const { still } = frame;
      // The clock counts only the time the machine has been drawing, so a visitor who comes
      // back to the page finds the sheet where it was left.
      if (!still) {
        clock += frame.dt;
        if (clock >= SHEET) {
          clock -= SHEET;
          carried += total;
          sheet += 1;
          build();
        }
      }
      const tau = still ? STILL_AT : clock;
      const arrive = still ? 1 : smooth(clamp(tau / FADE_IN, 0, 1));
      const fade = still ? 1 : arrive * (1 - smooth(clamp((tau - (SHEET - FADE_OUT)) / FADE_OUT, 0, 1)));

      locate(tau, still);
      furniture(frame);
      rain(frame, tau, fade, arrive);
      squares(frame, tau, fade);
      histogram(frame, fade);
      sweep(frame);
    },

    readout() {
      const head = `BATCH ${pad2(batch)} · ${spaced(ingested)} RECORDS`;
      const full = `${head} · ${spaced(live)} LIVE`;
      return full.length < 44 ? full : head;
    },
  };
}
