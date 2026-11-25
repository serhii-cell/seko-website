/**
 * Problem 2's gear: a toothed wheel lying flat with a raised hub on it, the
 * hub's green disc throwing light up, drawn in the same oblique view as the
 * Figma original (circles squashed to 0.4536 of their width) so the people
 * beside it still fit. The wheel is drawn by `wheel(angle)`, so it can be
 * rendered still on the server and spun in the browser; `wheelGlyphs()` and
 * `hubGlyphs()` draw the two parts in glyphs for them to appear from.
 *
 * Units are the drawing's own (568 × 500); heights are in screen units.
 */

export const W = 568;
export const H = 500;

const TOP = "#FFFFFF";
const SIDE = "#F0F0F0";
const LINE = "#E0E0E0";
const ACCENT = "#7BD52D";
/** The glyphs' grey, as on the dial. */
const GLYPH = "#9E9E9E";

/** How much a circle on the ground is squashed on screen. */
const SQUASH = 0.4536;
/** The wheel's centre, on its top face, at rest. */
const CX = 284;
const CY = 344;
const WHEEL = { teeth: 12, tip: 170, root: 136, thick: 29.5 };
/* Each tooth's half-width, as an angle, at its tip and at its root. */
const TIP_HALF = 0.105;
const ROOT_HALF = 0.165;
/** The hub on the wheel, the hole through both (green once the hub sits on
    the wheel) and the light above it. */
const HUB = { radius: 75.5, height: 13.6 };
const DISC = 45;
/** The hole's colour while it is just a hole. */
export const HOLE = SIDE;
const GLOW = 45;

const f = (value: number) => value.toFixed(1);
type Point = [number, number];
const pts = (points: Point[]) =>
  points.map(([x, y]) => `${f(x)},${f(y)}`).join(" ");

/* A point on the ground plane, radius r at angle a, `z` up from the wheel's
   underside, on screen. */
const project = (r: number, a: number, z: number): Point => [
  CX + r * Math.cos(a),
  CY + WHEEL.thick + r * Math.sin(a) * SQUASH - z,
];

/* The wheel's outline on the ground, turned `angle` radians: four corners
   per tooth and a few points along the root between teeth. Each point
   carries the face it starts: a flank, a tip or the curved root between
   two teeth, which is drawn as one face. */
function outline(angle: number) {
  const step = (Math.PI * 2) / WHEEL.teeth;
  const points: { r: number; a: number; face: number }[] = [];
  let face = 0;
  for (let i = 0; i < WHEEL.teeth; i++) {
    const a = angle + i * step;
    points.push(
      { r: WHEEL.root, a: a - ROOT_HALF, face: face++ },
      { r: WHEEL.tip, a: a - TIP_HALF, face: face++ },
      { r: WHEEL.tip, a: a + TIP_HALF, face: face++ },
    );
    const root = face++;
    const gap = step - ROOT_HALF * 2;
    for (let k = 0; k < 3; k++) {
      points.push({
        r: WHEEL.root,
        a: a + ROOT_HALF + (gap * k) / 3,
        face: root,
      });
    }
  }
  return points;
}

/** The wheel turned `angle` radians: the sides that face us, far to near,
    then the top face over them. */
export function wheel(angle: number) {
  const ring = outline(angle);
  /* The stretches of each face that point towards us, down the screen.
     The outline runs anticlockwise, so a stretch faces us where it runs
     right to left. */
  const runs: { face: number; points: typeof ring; depth: number }[] = [];
  ring.forEach((p, i) => {
    const q = ring[(i + 1) % ring.length];
    if (q.r * Math.cos(q.a) - p.r * Math.cos(p.a) >= -1e-6) return;
    const depth = p.r * Math.sin(p.a) + q.r * Math.sin(q.a);
    const last = runs[runs.length - 1];
    if (
      last &&
      last.face === p.face &&
      last.points[last.points.length - 1] === p
    ) {
      last.points.push(q);
      last.depth = Math.max(last.depth, depth);
    } else {
      runs.push({ face: p.face, points: [p, q], depth });
    }
  });
  runs.sort((a, b) => a.depth - b.depth);
  const sides = runs.map(({ points }) => {
    const quad: Point[] = [
      ...points.map((p) => project(p.r, p.a, 0)),
      ...points
        .slice()
        .reverse()
        .map((p) => project(p.r, p.a, WHEEL.thick)),
    ];
    return `<polygon points="${pts(quad)}" fill="${SIDE}" stroke="${LINE}" stroke-linejoin="round"/>`;
  });
  const top = ring.map((p) => project(p.r, p.a, WHEEL.thick));
  return (
    sides.join("") +
    `<polygon points="${pts(top)}" fill="${TOP}" stroke="${LINE}" stroke-linejoin="round"/>` +
    `<ellipse cx="${CX}" cy="${CY}" rx="${DISC}" ry="${f(DISC * SQUASH)}" fill="${HOLE}" stroke="${LINE}"/>`
  );
}

/* The hub's top face centre and its radii on screen. */
const HUB_TOP = CY - HUB.height;
const HUB_RY = HUB.radius * SQUASH;

/** The hub: its side, its top face and the hole in it, green as it is once
    the hub is home (the script greys it until then). */
export function hub() {
  const r = HUB.radius;
  const side = `M${f(CX - r)} ${f(HUB_TOP)}V${f(CY)}A${f(r)} ${f(HUB_RY)} 0 0 0 ${f(CX + r)} ${f(CY)}V${f(HUB_TOP)}A${f(r)} ${f(HUB_RY)} 0 0 1 ${f(CX - r)} ${f(HUB_TOP)}Z`;
  return (
    `<path d="${side}" fill="${SIDE}" stroke="${LINE}" stroke-linejoin="round"/>` +
    `<ellipse cx="${CX}" cy="${f(HUB_TOP)}" rx="${r}" ry="${f(HUB_RY)}" fill="${TOP}" stroke="${LINE}"/>` +
    `<ellipse class="gear-hole" cx="${CX}" cy="${f(HUB_TOP)}" rx="${DISC}" ry="${f(DISC * SQUASH)}" fill="${ACCENT}" stroke="${LINE}"/>`
  );
}

/** The light rising out of the disc, as a column that fades upward. */
export function glow(id: string) {
  const top = HUB_TOP - 46;
  return (
    `<defs><linearGradient id="${id}" x1="0" y1="${f(HUB_TOP)}" x2="0" y2="${f(top)}" gradientUnits="userSpaceOnUse"><stop stop-color="${ACCENT}"/><stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/></linearGradient></defs>` +
    `<rect class="gear-glow" x="${f(CX - GLOW)}" y="${f(top)}" width="${GLOW * 2}" height="${f(HUB_TOP - top)}" fill="url(#${id})"/>`
  );
}

/* ---- Glyphs ---------------------------------------------------------- */

/** Glyphs from light to dark, as on the dial. */
export const RAMP = " .:-=+*#%@";
const CELL_W = 7;
const CELL_H = 10;

function inside([x, y]: Point, polygon: Point[]) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      hit = !hit;
    }
  }
  return hit;
}

function toEdge([x, y]: Point, polygon: Point[]) {
  let best = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = polygon[j];
    const [bx, by] = polygon[i];
    const vx = bx - ax;
    const vy = by - ay;
    const t = Math.max(
      0,
      Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy || 1)),
    );
    best = Math.min(best, Math.hypot(x - ax - vx * t, y - ay - vy * t));
  }
  return best;
}

/* A grid of glyphs over a box, each as dense as `shade` says (0 for none).
   Hidden until the intro shows them. */
function grid(
  box: { left: number; top: number; right: number; bottom: number },
  shade: (x: number, y: number) => number,
  name: string,
) {
  const glyphs: string[] = [];
  for (let y = box.top; y <= box.bottom; y += CELL_H) {
    for (let x = box.left; x <= box.right; x += CELL_W) {
      const value = shade(x, y);
      if (value <= 0) continue;
      const grain = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
      const index = Math.max(
        1,
        Math.min(
          RAMP.length - 1,
          Math.round(value * (RAMP.length - 1) + grain * 1.2),
        ),
      );
      glyphs.push(
        `<text x="${f(x)}" y="${f(y)}" opacity="0">${RAMP[index]}</text>`,
      );
    }
  }
  return `<g class="gear-glyphs" data-glyphs="${name}" fill="${GLYPH}" font-family="ui-monospace, monospace" font-size="10" text-anchor="middle" dominant-baseline="central">${glyphs.join("")}</g>`;
}

/** The wheel, at rest, in glyphs: its top face light with its outline
    dense, its hole and sides dark. */
export function wheelGlyphs() {
  const ring = outline(0);
  const top = ring.map((p) => project(p.r, p.a, WHEEL.thick));
  const shade = (x: number, y: number) => {
    if (inside([x, y], top)) {
      if (Math.hypot((x - CX) / DISC, (y - CY) / (DISC * SQUASH)) <= 1)
        return 0.6;
      return toEdge([x, y], top) < 4 ? 0.75 : 0.3;
    }
    for (let drop = 3; drop <= WHEEL.thick; drop += 3) {
      if (inside([x, y - drop], top)) return 0.7;
    }
    return 0;
  };
  return grid(
    {
      left: CX - WHEEL.tip,
      right: CX + WHEEL.tip,
      top: CY - WHEEL.tip * SQUASH,
      bottom: CY + WHEEL.thick + WHEEL.tip * SQUASH,
    },
    shade,
    "wheel",
  );
}

/** The hub in glyphs: its rim dense, its face light, its hole dark. */
export function hubGlyphs() {
  const r = HUB.radius;
  const shade = (x: number, y: number) => {
    const across = (x - CX) / r;
    const fromTop = Math.hypot(across, (y - HUB_TOP) / HUB_RY);
    if (fromTop <= 1) {
      const fromDisc = Math.hypot(
        (x - CX) / DISC,
        (y - HUB_TOP) / (DISC * SQUASH),
      );
      if (fromDisc <= 1) return 0.6;
      return fromTop > 0.9 ? 0.75 : 0.3;
    }
    if (Math.abs(across) <= 1) {
      const rim = Math.sqrt(1 - across * across) * HUB_RY;
      if (y > HUB_TOP && y <= CY + rim) return 0.75;
    }
    return 0;
  };
  return grid(
    {
      left: CX - r,
      right: CX + r,
      top: HUB_TOP - HUB_RY,
      bottom: CY + HUB_RY,
    },
    shade,
    "hub",
  );
}

/** Where the bubbles sit, over each person's head, as shares of the
    drawing: their bottom centre. */
export const BUBBLES = {
  left: { x: 197 / W, y: 96 / H },
  right: { x: 370 / W, y: 96 / H },
};
