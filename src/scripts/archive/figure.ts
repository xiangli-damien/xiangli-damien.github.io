/**
 * The visitor: a small figure drawn in pixels, seen from behind on the way in and from the
 * front on the way back out.
 * Everything else in the hall is ink on paper; the one who walks through it is made of
 * the same squares as the screen.
 */

/** Height of the figure in metres. */
export const FIGURE_HEIGHT = 1.78;

const COLS = 12;
const ROWS = 28;

// '#' ink, 'o' paper (a gap that must stay open), '.' nothing
const HEAD = [
  '....####....',
  '...######...',
  '...######...',
  '...######...',
  '....####....',
  '.....##.....',
];

/** The same head from the front: a face is a gap in the ink. */
const FACE = [
  '....####....',
  '...######...',
  '...#oooo#...',
  '...#oooo#...',
  '....#oo#....',
  '.....##.....',
];

/** Rows of the torso that show a shirt front when the figure faces the viewer. */
const SHIRT = ['..###oo###..', '.####oo####.', '.#####o####.'];

const TORSO = [
  '..########..',
  '.##########.',
  '.##########.',
  '.##########.',
  '.##########.',
  '.##########.',
  '.##########.',
  '.##########.',
  '..########..',
  '..########..',
  '..########..',
];

/** Legs for one frame: how many rows each leg is shortened by (a lifted foot). */
function legs(leftLift: number, rightLift: number, together: boolean): string[] {
  const rows: string[] = [];
  const length = ROWS - HEAD.length - TORSO.length;
  for (let i = 0; i < length; i += 1) {
    const row = '............'.split('');
    const put = (from: number, to: number) => {
      for (let c = from; c <= to; c += 1) row[c] = '#';
    };
    const left = i < length - leftLift;
    const right = i < length - rightLift;
    const leftFoot = i === length - leftLift - 1;
    const rightFoot = i === length - rightLift - 1;
    if (together) {
      if (left) put(3, 5);
      if (right) put(6, 8);
      if (leftFoot) put(2, 5);
      if (rightFoot) put(6, 9);
    } else {
      if (left) put(2, 4);
      if (right) put(7, 9);
      if (leftFoot) put(1, 4);
      if (rightFoot) put(7, 10);
    }
    rows.push(row.join(''));
  }
  return rows;
}

function frame(
  leftLift: number,
  rightLift: number,
  together: boolean,
  leftArm: boolean,
  rightArm: boolean,
  front = false,
): string[] {
  const torso = TORSO.map((row, index) => {
    const cells = (front && index < SHIRT.length ? SHIRT[index] : row).split('');
    // An arm that swings forward is seen shorter from behind.
    if (leftArm && index >= 5 && index <= 7) cells[1] = '.';
    if (rightArm && index >= 5 && index <= 7) cells[10] = '.';
    return cells.join('');
  });
  return [...(front ? FACE : HEAD), ...torso, ...legs(leftLift, rightLift, together)];
}

const reel = (front: boolean) => ({
  stand: frame(0, 0, false, false, false, front),
  walk: [
    frame(0, 3, false, false, true, front),
    frame(0, 0, true, false, false, front),
    frame(3, 0, false, true, false, front),
    frame(0, 0, true, false, false, front),
  ],
});

const REELS = { in: reel(false), out: reel(true) };

/**
 * @param x      screen x of the point between the feet
 * @param y      screen y of the ground under the feet
 * @param height height on screen, in px
 * @param phase  walking phase (any number; its integer part picks the frame), or -1 to stand
 * @param facing `in` shows the back of the figure, `out` its front
 */
export function drawFigure(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  phase: number,
  ink: string,
  paper: string,
  facing: 'in' | 'out' = 'in',
): void {
  if (height < 4) return;
  const frames = REELS[facing];
  const index = phase < 0 ? -1 : Math.floor(phase) % frames.walk.length;
  const grid = index < 0 ? frames.stand : frames.walk[index];
  // The body rises a little on the passing step.
  const bob = index === 1 || index === 3 ? -1 : 0;
  const px = height / ROWS;
  const left = x - (COLS / 2) * px;
  const top = y - height;

  ctx.save();
  // A short shadow on the carpet, so the feet touch the floor.
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.ellipse(x, y + px * 0.2, px * 5.2, px * 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const waist = HEAD.length + TORSO.length;
  for (let row = 0; row < ROWS; row += 1) {
    const line = grid[row];
    const lift = row < waist ? bob : 0;
    // When the body rises, the legs reach one row higher, so no gap opens at the waist.
    const stretch = bob < 0 && row === waist ? -bob : 0;
    let col = 0;
    while (col < COLS) {
      const cell = line[col];
      if (cell === '.') {
        col += 1;
        continue;
      }
      // Merge runs of the same cell into one rectangle: fewer seams between pixels.
      let end = col;
      while (end + 1 < COLS && line[end + 1] === cell) end += 1;
      const x0 = Math.round(left + col * px);
      const x1 = Math.round(left + (end + 1) * px);
      const y0 = Math.round(top + (row + lift - stretch) * px);
      const y1 = Math.round(top + (row + lift + 1) * px);
      ctx.fillStyle = cell === '#' ? ink : paper;
      ctx.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
      col = end + 1;
    }
  }
  ctx.restore();
}
