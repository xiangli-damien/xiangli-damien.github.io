/**
 * FORECAST
 * A chart recorder. The pen writes the daily count of emergency-department visits up to
 * NOW: a noisy line with a weekly rhythm and a slow drift. The record is then read again,
 * three times, and split into smooth modes, one quiet lane each: trend, weekly, residual
 * (VMD). Every mode is carried forward past NOW (LSTM); their sum, the forecast, is drawn
 * in the signal colour inside the margin it is expected to keep. The lanes step back as
 * they are summed, and the days that really came arrive as grey squares, so the miss can
 * be seen.
 *
 * The series is invented, but the miss is not: the squares are placed so that the error of
 * the drawn forecast is exactly the reported one (MAPE 5.29%, RMSE 51.89). On a narrow
 * sheet only every second square is drawn; the figures always count all fourteen days.
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
  pen,
  perturb,
  pixelStroke,
  rand,
  ring,
  smooth,
} from '../kit';

const HORIZON = 14; // days forecast ahead
const SUB = 3; // samples per day on the smooth traces
const MAPE = 5.29; // reported miss, per cent
const RMSE = 51.89; // reported miss, visits per day
const NAMES = ['TREND', 'WEEKLY', 'RESIDUAL'];
const COLUMN = 59; // room for the longest lane name and the gap after it, px

// Seconds spent on each part of the film.
const RECORD = 3.4;
const REST = 0.45;
const MODE = 1;
const GAP = 0.25;
const AHEAD = 3.2;
const CHECK = 2.6;
const HOLD = 5.6;
const FADE = 0.5;

const T_SPLIT = RECORD + REST;
const T_SUM = T_SPLIT + NAMES.length * MODE + (NAMES.length - 1) * GAP + REST;
const T_CHECK = T_SUM + AHEAD + REST;
const T_END = T_CHECK + CHECK;

interface Lane {
  mid: number;
  /** the mode over the record, SUB samples per day */
  past: Point[];
  /** the mode carried forward from NOW */
  ahead: Point[];
}

/** The polyline as far as a fractional index, ending exactly under the head. */
function upTo(pts: Point[], index: number): Point[] {
  const last = pts.length - 1;
  if (index >= last) return pts;
  const n = Math.max(0, Math.floor(index));
  const out = pts.slice(0, n + 1);
  const r = index - n;
  if (r > 1e-3) out.push({ x: lerp(pts[n].x, pts[n + 1].x, r), y: lerp(pts[n].y, pts[n + 1].y, r) });
  return out;
}

/** The point at a fractional index of a polyline. */
function spot(pts: Point[], index: number): Point {
  const last = pts.length - 1;
  const n = clamp(Math.floor(index), 0, last);
  if (n >= last) return pts[last];
  const r = clamp(index - n, 0, 1);
  return { x: lerp(pts[n].x, pts[n + 1].x, r), y: lerp(pts[n].y, pts[n + 1].y, r) };
}

export default function forecast(): Program {
  let seed = 1;
  let width = 1;
  let height = 1;
  let clock = 0;

  let x0 = 0;
  let x1 = 1;
  let xNow = 0;
  let top = 0;
  let base = 1;
  let hist = 28;
  let compact = false;
  let every = 1;
  let dot = 4;

  let observed: Point[] = [];
  let lanes: Lane[] = [];
  let sum: Point[] = [];
  let upper: Point[] = [];
  let lower: Point[] = [];
  let actual: Point[] = [];
  let mape = 0;
  let rmse = 0;
  let tagVisits: Point = { x: 0, y: 0 };
  let tagForecast: Point = { x: 0, y: 0 };
  let tagActual: Point = { x: 0, y: 0 };

  function build() {
    // Neighbouring seeds give neighbouring first draws, so the seed is scrambled first.
    const rng = rand(Math.imul(seed, 2654435761) >>> 0);
    for (let i = 0; i < 4; i += 1) rng();
    const gauss = () => (rng() + rng() + rng() - 1.5) * 2;

    /* ----- sheet ----- */
    compact = width < 380;
    // The lettering column sits left of the traces; the right margin mirrors what it leaves.
    x0 = Math.max(compact ? 78 : 94, width * 0.19);
    x1 = width - (x0 - COLUMN);
    // A narrow sheet shows a shorter record, so that the days ahead keep a third of it.
    const weeks = x1 - x0 < 400 ? 4 : x1 - x0 < 560 ? 5 : 6;
    hist = weeks * 7;
    const total = hist + HORIZON;
    const dx = (x1 - x0) / total;
    xNow = x0 + hist * dx;
    // The squares keep air between them: smaller on a tight sheet, then every second day.
    dot = dx >= 7 ? 4 : 3;
    every = dx >= 6 ? 1 : 2;
    top = Math.max(32, height * 0.14);
    base = height - Math.max(34, height * 0.15);
    const inner = base - top;
    // One large drawing, and the three lanes close together as a footnote at its foot.
    const mainBottom = top + inner * 0.52;
    const laneHeight = Math.min(clamp(inner * 0.095, 16, 40), (base - 12 - mainBottom) / NAMES.length);
    const lanesTop = base - 4 - laneHeight * NAMES.length;

    /* ----- the series, in visits around an unknown level ----- */
    const drift = (rng() - 0.5) * 220;
    const swell = 40 + rng() * 50;
    const swellSpan = total * (0.8 + rng() * 0.7);
    const swellPhase = rng() * TAU;
    const beat = 95 + rng() * 45;
    const weekday = rng() * 7;
    const second = 0.2 + rng() * 0.3;
    const breath = rng() * TAU;
    const rough = 34 + rng() * 10;

    const trend = (d: number) => drift * (d / total - 0.5) + swell * Math.sin((TAU * d) / swellSpan + swellPhase);
    const weekly = (d: number) => {
      const a = (TAU * (d + weekday)) / 7;
      const swing = beat * (1 + 0.18 * Math.sin((TAU * d) / (total * 1.4) + breath));
      return swing * (Math.sin(a) + second * Math.sin(2 * a + 0.9));
    };

    const noise = new Array<number>(total + 1);
    let carry = 0;
    for (let d = 0; d <= total; d += 1) {
      carry = carry * 0.3 + gauss() * rough;
      noise[d] = carry;
    }
    // Some sheets carry one surge: a bad night that no rhythm explains.
    if (rng() < 0.6) {
      const day = 6 + Math.floor(rng() * (hist - 14));
      const size = 110 + rng() * 70;
      noise[day] += size;
      noise[day + 1] += size * 0.5;
      noise[day + 2] += size * 0.2;
    }
    const residual = (d: number) => {
      const n = Math.min(total - 1, Math.floor(d));
      return lerp(noise[n], noise[n + 1], d - n);
    };

    // What the model says of each mode after NOW: nearly right, never exactly.
    const bias = (rng() - 0.5) * 80;
    const gain = 0.86 + rng() * 0.24;
    const trendAhead = (d: number) => trend(d) + bias * Math.pow((d - hist) / HORIZON, 1.4);
    const weeklyAhead = (d: number) => weekly(d) * lerp(1, gain, clamp((d - hist) / 4, 0, 1));
    const residualAhead = (d: number) => noise[hist] * Math.pow(0.6, d - hist) * Math.cos((d - hist) * 1.9);
    const said = (d: number) => trendAhead(d) + weeklyAhead(d) + residualAhead(d);

    // The miss grows with the horizon, and is scaled to the reported RMSE.
    const widen = (k: number) => 0.4 + 0.6 * Math.sqrt(k / HORIZON);
    const miss = new Array<number>(HORIZON + 1).fill(0);
    let square = 0;
    for (let k = 1; k <= HORIZON; k += 1) {
      const d = hist + k;
      miss[k] = (trend(d) + weekly(d) + noise[d] - said(d)) * widen(k);
      square += miss[k] * miss[k];
    }
    const fit = RMSE / Math.sqrt(square / HORIZON || 1);
    square = 0;
    for (let k = 1; k <= HORIZON; k += 1) {
      miss[k] *= fit;
      square += miss[k] * miss[k];
    }
    rmse = Math.sqrt(square / HORIZON);

    // The level of the series is then the one at which the same miss is the reported MAPE.
    const mapeAt = (level: number) => {
      let acc = 0;
      for (let k = 1; k <= HORIZON; k += 1) acc += Math.abs(miss[k]) / (level + said(hist + k) + miss[k]);
      return (acc / HORIZON) * 100;
    };
    let low = 450;
    let high = 4000;
    for (let i = 0; i < 40; i += 1) {
      const middle = (low + high) / 2;
      if (mapeAt(middle) > MAPE) low = middle;
      else high = middle;
    }
    mape = mapeAt((low + high) / 2);

    /* ----- onto the sheet ----- */
    const margin = (d: number) => RMSE * 1.7 * widen(d - hist);
    let lo = Infinity;
    let hi = -Infinity;
    for (let d = 0; d <= hist; d += 1) {
      const v = trend(d) + weekly(d) + noise[d];
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    for (let k = 1; k <= HORIZON; k += 1) {
      const d = hist + k;
      lo = Math.min(lo, said(d) - margin(d), said(d) + miss[k]);
      hi = Math.max(hi, said(d) + margin(d), said(d) + miss[k]);
    }
    // Twelve pixels are kept under the main trace for the caption of the squares.
    const scale = (mainBottom - 12 - top) / (hi - lo);
    const yOf = (v: number) => mainBottom - 12 - (v - lo) * scale;
    const xOf = (d: number) => x0 + d * dx;

    observed = [];
    for (let d = 0; d <= hist; d += 1) observed.push({ x: xOf(d), y: yOf(trend(d) + weekly(d) + noise[d]) });

    sum = [];
    upper = [];
    lower = [];
    for (let j = 0; j <= HORIZON * SUB; j += 1) {
      const d = hist + j / SUB;
      const v = said(d);
      sum.push({ x: xOf(d), y: yOf(v) });
      upper.push({ x: xOf(d), y: yOf(v + margin(d)) });
      lower.push({ x: xOf(d), y: yOf(v - margin(d)) });
    }

    actual = [];
    for (let k = 1; k <= HORIZON; k += 1) actual.push({ x: xOf(hist + k), y: yOf(said(hist + k) + miss[k]) });

    const modes: Array<[(d: number) => number, (d: number) => number]> = [
      [trend, trendAhead],
      [weekly, weeklyAhead],
      [residual, residualAhead],
    ];
    lanes = modes.map(([before, after], i) => {
      let min = Infinity;
      let max = -Infinity;
      for (let j = 0; j <= total * SUB; j += 1) {
        const d = j / SUB;
        const v = d <= hist ? before(d) : after(d);
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
      const mid = lanesTop + laneHeight * (i + 0.5);
      // Each lane has its own gain, as on a recorder, but never more than the main trace.
      const centre = i === 0 ? (min + max) / 2 : 0;
      const reachOf = Math.max(max - centre, centre - min, 1);
      const gainOf = Math.min(scale, (laneHeight * 0.3) / reachOf);
      const y = (v: number) => mid - (v - centre) * gainOf;
      const past: Point[] = [];
      const ahead: Point[] = [];
      for (let j = 0; j <= hist * SUB; j += 1) past.push({ x: xOf(j / SUB), y: y(before(j / SUB)) });
      for (let j = 0; j <= HORIZON * SUB; j += 1) {
        const d = hist + j / SUB;
        ahead.push({ x: xOf(d), y: y(j === 0 ? before(d) : after(d)) });
      }
      return { mid, past, ahead };
    });

    /* ----- lettering, set where the lines leave room ----- */
    tagVisits = {
      x: x0 - 10,
      y: clamp((observed[0].y + observed[1].y + observed[2].y) / 3, top + 5, mainBottom - 17),
    };
    // Everything drawn under the two tags is scanned: the bounds at every sample, then the squares.
    const span = Math.ceil(58 / dx);
    let highest = Infinity;
    let lowest = -Infinity;
    for (let j = Math.max(0, (HORIZON - span) * SUB); j <= HORIZON * SUB; j += 1) {
      highest = Math.min(highest, upper[j].y);
      lowest = Math.max(lowest, lower[j].y);
    }
    for (let k = Math.max(1, HORIZON - span); k <= HORIZON; k += 1) {
      if (k % every !== 0) continue;
      highest = Math.min(highest, actual[k - 1].y - dot / 2);
      lowest = Math.max(lowest, actual[k - 1].y + dot / 2);
    }
    tagForecast = { x: x1, y: highest - 11 };
    tagActual = { x: x1, y: lowest + 11 };

    clock = 0;
  }

  function furniture(frame: Frame) {
    const { ctx, palette } = frame;
    const rule = Math.round(xNow) + 0.5;
    line(ctx, [{ x: rule, y: top - 8 }, { x: rule, y: base }], { color: palette.soft, alpha: 0.8, dash: [2, 3] });
    label(ctx, 'NOW', { x: xNow, y: base + 13 }, palette, { align: 'center', size: 10 });
    label(ctx, 'VISITS', tagVisits, palette, { align: 'right', size: 10 });
  }

  /** The margin the forecast is expected to keep: a breath of ink between two bounds. */
  function band(frame: Frame, above: Point[], below: Point[]) {
    const { ctx, palette } = frame;
    if (above.length < 2) return;
    ctx.save();
    ctx.fillStyle = palette.ink;
    ctx.globalAlpha = 0.05;
    ctx.beginPath();
    ctx.moveTo(above[0].x, above[0].y);
    for (let i = 1; i < above.length; i += 1) ctx.lineTo(above[i].x, above[i].y);
    for (let i = below.length - 1; i >= 0; i -= 1) ctx.lineTo(below[i].x, below[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  return {
    init(w, h, nextSeed) {
      width = w;
      height = h;
      seed = nextSeed;
      build();
    },

    draw(frame) {
      const { ctx, palette, dt, still, pointer, w, h } = frame;

      if (still) {
        clock = T_END;
      } else {
        clock += dt;
        if (clock >= T_END + HOLD) {
          seed += 1;
          build();
        }
      }

      const record = clamp(clock / RECORD, 0, 1);
      const split = (i: number) => clamp((clock - T_SPLIT - i * (MODE + GAP)) / MODE, 0, 1);
      const told = clamp((clock - T_SUM) / AHEAD, 0, 1);
      const check = clamp((clock - T_CHECK) / CHECK, 0, 1);
      const writing = NAMES.findIndex((_, i) => split(i) > 0 && split(i) < 1);
      // The modes step back as their sum is written, and leave the sheet to the forecast.
      const back = smooth(told);
      const n = told * HORIZON * SUB;

      // The sheet is nudged once per frame, and only where something is already drawn;
      // strokes and heads share the result.
      const reach = Math.min(w, h) * 0.2;
      const nudge = (pts: Point[], drawn: boolean) => (drawn ? perturb(pts, pointer, reach, 8) : pts);
      const past = nudge(observed, true);
      const modes = lanes.map((lane, i) => ({
        past: nudge(lane.past, split(i) > 0),
        ahead: nudge(lane.ahead, told > 0),
      }));
      const ahead = nudge(sum, told > 0);
      const above = nudge(upper, told > 0);
      const below = nudge(lower, told > 0);
      const came = nudge(actual, check > 0);

      furniture(frame);

      /* the modes, and what the model says of each after NOW */
      lanes.forEach((lane, i) => {
        const m = split(i);
        if (m <= 0) return;
        label(ctx, NAMES[i], { x: x0 - 10, y: lane.mid }, palette, {
          align: 'right',
          size: 10,
          color: i === writing ? palette.ink : palette.soft,
          alpha: clamp(m * 8, 0, 1) * lerp(1, 0.65, back),
        });
        const alpha = lerp(0.75, 0.3, back);
        line(ctx, upTo(modes[i].past, m * hist * SUB), { color: palette.ink, alpha, width: 1.1 });
        if (told > 0) line(ctx, upTo(modes[i].ahead, n), { color: palette.ink, alpha, width: 1.1, dash: [3, 3] });
      });

      /* the record */
      pixelStroke(ctx, upTo(past, record * hist), {
        color: palette.ink,
        alpha: 0.9,
        width: compact ? 1.5 : 1.8,
        seed: seed * 97,
      });

      /* the forecast inside its margin */
      if (told > 0) {
        band(frame, upTo(above, n), upTo(below, n));
        line(ctx, upTo(ahead, n), { color: palette.signal, width: compact ? 1.7 : 2 });
        label(ctx, 'FORECAST', tagForecast, palette, {
          color: palette.signal,
          align: 'right',
          size: 10,
          alpha: clamp(told * 6, 0, 1),
        });
      }

      /* the days that really came */
      if (check > 0) {
        const shown = Math.min(HORIZON, Math.floor(check * HORIZON + 1e-6));
        for (let k = every - 1; k < shown; k += every) block(ctx, came[k], dot, { fill: palette.blue });
        label(ctx, 'ACTUAL', tagActual, palette, {
          align: 'right',
          size: 10,
          color: palette.blue,
          alpha: clamp(check * 6, 0, 1),
        });
      }

      if (still) return;

      /* the heads */
      if (record < 1) pen(ctx, spot(past, record * hist), palette, palette.ink, 3.2);

      if (writing >= 0) {
        // The record is read again: a ring on the day being read, the pen on what is kept of it.
        const m = split(writing);
        const from = spot(past, m * hist);
        const to = spot(modes[writing].past, m * hist * SUB);
        line(ctx, [from, to], { color: palette.soft, alpha: 0.8 });
        ring(ctx, from, 3, { fill: palette.paper, stroke: palette.ink, width: 1.2 });
        pen(ctx, to, palette, palette.ink, 2.4);
      }

      if (told > 0 && told < 1) {
        // One rule ties the three modes to their sum while all four are written together.
        const head = spot(ahead, n);
        const foot = spot(modes[modes.length - 1].ahead, n);
        line(ctx, [head, foot], { color: palette.soft, alpha: 0.8 });
        modes.forEach((mode) => ring(ctx, spot(mode.ahead, n), 2.2, { fill: palette.ink }));
        pen(ctx, head, palette, palette.signal, 3.2);
      }

      if (check > 0 && check < 1) {
        // The pen starts on the last recorded day and walks through the days that came.
        const at = check * HORIZON;
        const head = at < 1 ? spot([past[past.length - 1], came[0]], at) : spot(came, at - 1);
        pen(ctx, head, palette, palette.ink, 2.6);
      }

      // The sheet is changed behind a veil of paper.
      const veil = Math.max(1 - clock / FADE, (clock - (T_END + HOLD - FADE)) / FADE);
      if (veil > 0) {
        ctx.save();
        ctx.globalAlpha = clamp(veil, 0, 1);
        ctx.fillStyle = palette.paper;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
    },

    readout() {
      const two = (v: number) => String(v).padStart(2, '0');
      if (clock < RECORD) {
        const day = Math.min(hist, Math.floor((clock / RECORD) * hist) + 1);
        return `RECORDING · DAY ${two(day)}/${hist}`;
      }
      if (clock < T_SPLIT) return `RECORD CLOSED · ${hist} DAYS`;
      if (clock < T_SUM) {
        const i = Math.min(NAMES.length - 1, Math.floor((clock - T_SPLIT) / (MODE + GAP)));
        return `VMD · MODE ${i + 1}/${NAMES.length} · ${NAMES[i]}`;
      }
      if (clock < T_CHECK) {
        const k = clamp(Math.ceil(((clock - T_SUM) / AHEAD) * HORIZON), 1, HORIZON);
        return `LSTM · SUM OF ${NAMES.length} MODES · H+${two(k)}`;
      }
      // While the days arrive only the day is counted: the figures belong to the whole horizon.
      const landed = Math.floor(((clock - T_CHECK) / CHECK) * HORIZON + 1e-6);
      if (landed < HORIZON) return `CHECK · DAY ${two(landed + 1)}/${HORIZON}`;
      return `MAPE ${mape.toFixed(2)}% · RMSE ${rmse.toFixed(2)} · H+${HORIZON}`;
    },
  };
}
