/**
 * The plan of the hall, in metres. Everything that is drawn is measured from these.
 */

/** Half the width of the hall: the cabinets stand at x = -HALF_WIDTH and x = +HALF_WIDTH. */
export const HALF_WIDTH = 6;
export const HEIGHT = 10;
/** Height of the viewer's eye. Half the height of the hall, so floor and ceiling recede alike. */
export const EYE = 5;
/** Length of one bay. Gates stand on bay lines, so their depths are multiples of this. */
export const BAY = 6;
/** Half the width of the carpet. */
export const CARPET = 1.45;

export const DOOR_HALF = 3.3;
export const DOOR_TOP = 8.2;
/** Radius of the rounded corners of a gate's opening. */
export const DOOR_ROUND = 1.25;
export const GATE_DEPTH = 0.9;

export const NEAR = 0.6;
export const FAR = 150;

/** Distance from the camera at which the figure walks ahead of it. */
export const LEAD = 14.5;

/** Where the camera stands in a hall whose gate is at `depth`: a few steps inside the gate. */
export const standing = (depth: number) => (depth <= 0 ? 0 : depth - LEAD + 4);

/* ---------- the cabinets along the walls ---------- */

/** Height of the plinth the cabinets stand on. */
export const PLINTH = 0.35;
export const ROWS = 10;
export const ROW = 0.8;
/** Top of the cabinets; above it the wall is bare up to the ceiling. */
export const CABINET_TOP = PLINTH + ROWS * ROW;
/** Drawers, or compartments of a shelf, to a bay. */
export const COLUMNS = 4;
/** Half the width of the pilaster that stands on every bay line. */
export const POST = 0.18;
export const CELL = (BAY - POST * 2) / COLUMNS;
/** Height of the rail the ladders run on. */
export const RAIL = CABINET_TOP + 0.3;
