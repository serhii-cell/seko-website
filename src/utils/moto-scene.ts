/**
 * Problem 3's ride: a simple retro scooter — a deep front mudguard, a leg
 * shield rising to the headset with its round headlamp, a flat floorboard,
 * a big rounded body over the back wheel with vents in its side, a
 * cushioned seat, small whitewall wheels with bolted hubs.
 *
 * It is a small 3D model drawn in the site's light style, in the same view
 * as the bicycle it replaced: u runs along it towards the back, v up, w
 * across towards us, in wheel radii. Every face that turns towards us is
 * drawn, far to near, white where it faces up or towards us, grey on the
 * sides; panels are rounded off so they curve like pressed steel. The
 * wheels are drawn on their own and only their bolts move as they turn;
 * the rest shakes as one with the engine.
 *
 * Units are the drawing's own (779 × 500).
 */

export const W = 779;
export const H = 500;

const TOP = "#FFFFFF";
const SIDE = "#F0F0F0";
const LINE = "#E0E0E0";
const ACCENT = "#7BD52D";

type V3 = [number, number, number];
type P2 = [number, number];

/* One unit along, up and across, on screen. */
const SCALE = 0.688;
const U: P2 = [96.6 * SCALE, -14.7 * SCALE];
const V: P2 = [0, -76.1 * SCALE];
const A: P2 = [33.9 * SCALE, 49.5 * SCALE];
/** Where the front axle is drawn. */
const ORIGIN: P2 = [281, 328];

/* The direction towards us, in model space: the one that lands on a point
   on screen. */
const VIEW = (() => {
  const a = -A[0] / U[0];
  const b = (-A[1] - a * U[1]) / V[1];
  const length = Math.hypot(a, b, 1);
  return [a / length, b / length, 1 / length] as V3;
})();

const f = (value: number) => value.toFixed(1);
const project = ([u, v, w]: V3, dy = 0): P2 => [
  ORIGIN[0] + u * U[0] + v * V[0] + w * A[0],
  ORIGIN[1] + u * U[1] + v * V[1] + w * A[1] + dy,
];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: V3): V3 => {
  const length = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
};
const mean = (points: V3[]): V3 => {
  const sum = points.reduce((s, p) => add(s, p), [0, 0, 0] as V3);
  return [
    sum[0] / points.length,
    sum[1] / points.length,
    sum[2] / points.length,
  ];
};

/** Something to draw, with how near it is. */
type Piece = { depth: number; svg: string };

/* White where a face looks up or towards us, grey on the sides. */
const shade = (normal: V3) =>
  normal[1] > 0.55 || normal[2] > 0.7 ? TOP : SIDE;

function polygon(points: V3[], fill: string, dy: number, extra = "") {
  const at = points.map((p) => project(p, dy).map(f).join(",")).join(" ");
  return `<polygon points="${at}" fill="${fill}" stroke="${LINE}" stroke-linejoin="round"${extra}/>`;
}

/* A flat shape (`base`, in a plane) pushed out along `out`, as one piece:
   the walls and caps that face us (for a convex shape these never overlap,
   so they need no order among themselves). `fill` overrides the shading.
   A `smooth` prism is a rounded thing (a drum, a tank): its walls are
   drawn as one surface, outlined only where it ends, with no seams.
   Without `caps` only the walls are drawn; `inside` draws the walls seen
   from within (the inside of a rim). `sides` colours the walls alone;
   `hidden` leaves out walls (by their index round `base`) that are out of
   sight anyway, so a hollow shape's inside edges don't show through. */
function prism(
  base: V3[],
  out: V3,
  dy: number,
  fill?: string,
  smooth = false,
  caps = true,
  inside = false,
  {
    sides,
    hidden,
  }: { sides?: string; hidden?: (index: number) => boolean } = {},
): Piece {
  const top = base.map((p) => add(p, out));
  const centre = mean([...base, ...top]);
  const at = (points: V3[]) =>
    points.map((q) => project(q, dy).map(f).join(",")).join(" ");
  const seen = (normal: V3) => dot(normal, VIEW) > 0.01;
  const walls: { quad: V3[]; normal: V3; index: number }[] = [];
  base.forEach((p, i) => {
    const q = base[(i + 1) % base.length];
    const quad = [p, q, add(q, out), add(p, out)];
    let normal = unit(cross(sub(q, p), out));
    if (dot(normal, sub(mean(quad), centre)) < 0 !== inside)
      normal = [-normal[0], -normal[1], -normal[2]];
    if (seen(normal) && !hidden?.(i)) walls.push({ quad, normal, index: i });
  });
  walls.sort((a, b) => dot(mean(a.quad), VIEW) - dot(mean(b.quad), VIEW));
  const colour = (normal: V3) => fill ?? shade(normal);
  const wallColour = (normal: V3) => sides ?? colour(normal);
  const shown = new Set(walls.map((wall) => wall.index));
  const n = base.length;
  const line = (a: V3, b: V3) =>
    `M${project(a, dy).map(f).join(" ")}L${project(b, dy).map(f).join(" ")}`;
  let svg = smooth
    ? /* The walls filled in their own colours (their strokes cover the
         seams), then outlined in one go only where the surface ends: along
         their two long edges, and across where the next wall round is out
         of sight. One 1px line, on the edge itself. */
      walls
        .map(
          ({ quad, normal }) =>
            `<polygon points="${at(quad)}" fill="${wallColour(normal)}" stroke="${wallColour(normal)}" stroke-linejoin="round"/>`,
        )
        .join("") +
      `<path d="${walls
        .map(({ quad, index }) => {
          const [p, q, qTop, pTop] = quad;
          let edges = line(p, q) + line(pTop, qTop);
          if (!shown.has((index - 1 + n) % n)) edges += line(p, pTop);
          if (!shown.has((index + 1) % n)) edges += line(q, qTop);
          return edges;
        })
        .join("")}" fill="none" stroke="${LINE}" stroke-linecap="round"/>`
    : walls
        .map(({ quad, normal }) => polygon(quad, wallColour(normal), dy))
        .join("");
  const capNormal = unit(out);
  const back: V3 = [-capNormal[0], -capNormal[1], -capNormal[2]];
  if (caps && seen(capNormal)) svg += polygon(top, colour(capNormal), dy);
  if (caps && seen(back)) svg += polygon(base, colour(back), dy);
  return { depth: dot(centre, VIEW), svg };
}

/* A round tube from a to b, drawn as an outlined thick line. */
function tube(a: V3, b: V3, radius: number, dy: number): Piece {
  const [x1, y1] = project(a, dy);
  const [x2, y2] = project(b, dy);
  const width = radius * 2 * 82 * SCALE;
  const d = `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;
  return {
    depth: dot(mean([a, b]), VIEW),
    svg:
      `<path d="${d}" stroke="${LINE}" stroke-width="${f(width + 2)}" stroke-linecap="round"/>` +
      `<path d="${d}" stroke="${TOP}" stroke-width="${f(width)}" stroke-linecap="round"/>`,
  };
}

/* A circle of `n` points in the u–v plane, at depth w. */
const ring = (u: number, v: number, w: number, r: number, n = 28, from = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = from + (i * Math.PI * 2) / n;
    return [u + Math.cos(a) * r, v + Math.sin(a) * r, w] as V3;
  });

/* A circle in the v–w plane (facing along the bike), at u. */
const disc = (u: number, v: number, w: number, r: number, n = 28) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i * Math.PI * 2) / n;
    return [u, v + Math.sin(a) * r, w + Math.cos(a) * r] as V3;
  });

const draw = (pieces: Piece[]) =>
  pieces
    .sort((a, b) => a.depth - b.depth)
    .map((piece) => piece.svg)
    .join("");

/* ---- The wheels -------------------------------------------------------- */

/** Where the axles are, along the scooter: the front wheel out ahead of
    the leg shield, the back one centred under the body. */
export const AXLES = { front: -0.35, rear: 3.72 };
/* Small wheels: a smooth tyre, a white wall inside it and a bolted hub. */
const TYRE = { outer: 1, wall: 0.8, hub: 0.62, half: 0.17 };
/* The hub stands out from the white wall, its edge on the wall's; its
   five bolts, how far out they sit. */
const HUB_FACE = TYRE.half + 0.07;
const BOLTS = 5;
const BOLT_RING = 0.38;

/** Where a wheel's bolts are, turned `angle` radians: all that moves as
    it turns, the tyre, white wall and hub being round. */
export function bolts(which: keyof typeof AXLES, angle: number) {
  const u0 = AXLES[which];
  return Array.from({ length: BOLTS }, (_, i) => {
    const a = angle + (i * Math.PI * 2) / BOLTS;
    return project([
      u0 + Math.cos(a) * BOLT_RING,
      Math.sin(a) * BOLT_RING,
      HUB_FACE + 0.01,
    ]);
  });
}

/** A wheel: tyre, white wall and a hub with five bolts (in a group of
    their own, `.moto-bolts`, which the page turns). Drawn apart from the
    body so it stays put while the body shakes. */
export function wheel(which: keyof typeof AXLES) {
  const u0 = AXLES[which];
  const out: V3 = [0, 0, TYRE.half * 2];
  const tread = prism(
    ring(u0, 0, -TYRE.half, TYRE.outer, 48),
    out,
    0,
    SIDE,
    true,
    false,
  );
  const near = (r: number) =>
    ring(u0, 0, TYRE.half, r, 48)
      .map((p) => project(p).map(f).join(" "))
      .join("L");
  const tyre = `<path d="M${near(TYRE.outer)}ZM${near(TYRE.wall)}Z" fill="${SIDE}" stroke="${LINE}" fill-rule="evenodd" stroke-linejoin="round"/>`;
  const wall = `<path d="M${near(TYRE.wall)}ZM${near(TYRE.hub)}Z" fill="${TOP}" stroke="${LINE}" fill-rule="evenodd" stroke-linejoin="round"/>`;
  const hub = prism(
    ring(u0, 0, TYRE.half, TYRE.hub, 40),
    [0, 0, HUB_FACE - TYRE.half],
    0,
    undefined,
    true,
    true,
    false,
    { sides: SIDE },
  );
  const dots = bolts(which, 0)
    .map(
      ([x, y]) =>
        `<circle cx="${f(x)}" cy="${f(y)}" r="${f(3.5 * SCALE)}" fill="${SIDE}" stroke="${LINE}"/>`,
    )
    .join("");
  const cap = ring(u0, 0, HUB_FACE + 0.01, 0.17, 20)
    .map((p) => project(p).map(f).join(","))
    .join(" ");
  return (
    tread.svg +
    tyre +
    wall +
    hub.svg +
    `<polygon points="${cap}" fill="${SIDE}" stroke="${LINE}"/>` +
    `<g class="moto-bolts">${dots}</g>`
  );
}

/* ---- The body ---------------------------------------------------------- */

/* A closed outline with its corners rounded off (Chaikin's corner
   cutting), so the scooter's panels curve the way pressed steel does. */
function rounded(profile: [number, number][], passes = 3) {
  let points = profile;
  for (let pass = 0; pass < passes; pass++) {
    points = points.flatMap(([u, v], i) => {
      const [nu, nv] = points[(i + 1) % points.length];
      return [
        [u * 0.75 + nu * 0.25, v * 0.75 + nv * 0.25],
        [u * 0.25 + nu * 0.75, v * 0.25 + nv * 0.75],
      ] as [number, number][];
    });
  }
  return points;
}

/* A rounded slab: the outline `profile` (along, up), its corners rounded,
   made `width` thick across, centred. */
const slab = (
  profile: [number, number][],
  width: number,
  dy: number,
  fill?: string,
  round = true,
  extra: { sides?: string; hidden?: (index: number) => boolean } = {},
) =>
  prism(
    (round ? rounded(profile) : profile).map(
      ([u, v]) => [u, v, -width / 2] as V3,
    ),
    [0, 0, width],
    dy,
    fill,
    true,
    true,
    false,
    extra,
  );

/** The headlamp, set flush in the front of the headset, facing forward:
    a flat rim round its glass, centred between the front's two edges (a
    rim with depth showed past the right one). */
const LAMP = { u: 0.47, v: 2.86, r: 0.17 };
/* Its glass, just in front of it, and how far ahead its beam reaches. */
const GLASS = { u: LAMP.u - 0.01, r: LAMP.r * 0.82 };
const BEAM = { reach: 2.1, spread: 0.4 };

/* Nothing of the scooter shows behind its wheels. */
function far(_dy: number) {
  return "";
}

/* The scooter's body, in front of its wheels. Its big panels are drawn in
   a set order (the mudguard under the leg shield, the floor running into
   the body at the back) rather than by depth, which their sizes would
   muddle; the small parts on top are sorted. */
function body(dy: number) {
  /* The front mudguard, hugging the top of the front wheel, about as wide
     as the tyre. */
  const n = 22;
  const arc = (r: number) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const a = 0.5 + ((2.78 - 0.5) * i) / n;
      return [AXLES.front + Math.cos(a) * r, Math.sin(a) * r] as [
        number,
        number,
      ];
    });
  const mudguard = slab(
    [...arc(1.36), ...arc(1.16).reverse()],
    0.5,
    dy,
    /* All white: its curved tip faces forward, not up, and would shade
       grey. */
    TOP,
    false,
    /* Its underside, hidden under its top. */
    { hidden: (i) => i > n && i < 2 * n + 1 },
  );
  /* The floorboard, from the leg shield into the body. */
  const floor = prism(
    [
      [0.9, 0.42, -0.5],
      [2.9, 0.42, -0.5],
      [2.9, 0.6, -0.5],
      [0.9, 0.6, -0.5],
    ],
    [0, 0, 1],
    dy,
  );
  /* The leg shield, rising from the floor to the headset. */
  const shield = slab(
    [
      [0.62, 0.5],
      [0.32, 1.15],
      [0.24, 1.85],
      [0.36, 2.4],
      [0.6, 2.68],
      [0.88, 2.62],
      [0.9, 2.2],
      [1.0, 1.45],
      [1.2, 0.8],
      [1.35, 0.5],
    ],
    1.0,
    dy,
    undefined,
    true,
    { sides: SIDE },
  );
  /* The big rounded body over the back wheel, as wide as the floor, with
     vents in its side. */
  const cowl: [number, number][] = [
    [2.35, 0.42],
    [2.3, 0.85],
    [2.42, 1.3],
    [2.7, 1.6],
    [3.2, 1.76],
    [4.0, 1.72],
    [4.6, 1.52],
    [4.98, 1.12],
    [5.08, 0.62],
    [4.8, 0.42],
  ];
  const shell = slab(cowl, 1.0, dy, undefined, true, { sides: SIDE });
  const onSide = (points: [number, number][]) =>
    points.map(([u, v]) => project([u, v, 0.5], dy).map(f).join(" ")).join("L");
  const vents = [0.95, 1.1, 1.25]
    .map(
      (v) =>
        `M${onSide([
          [3.75, v],
          [4.35, v - 0.03],
        ])}`,
    )
    .join("");
  const panels =
    mudguard.svg +
    floor.svg +
    shell.svg +
    `<path d="${vents}" fill="none" stroke="${LINE}" stroke-linecap="round"/>` +
    shield.svg;

  const pieces: Piece[] = [];
  /* The cushioned seat. */
  pieces.push(
    slab(
      [
        [2.6, 1.7],
        [2.72, 1.98],
        [3.0, 2.06],
        [3.55, 2.04],
        [3.8, 1.88],
        [3.65, 1.72],
      ],
      0.64,
      dy,
      TOP,
    ),
  );
  /* The headset with the handlebar and its grips, a mirror, and the round
     headlamp in front. */
  pieces.push(
    slab(
      [
        [0.42, 2.64],
        [0.98, 2.7],
        [1.04, 2.98],
        [0.5, 3.08],
      ],
      0.44,
      dy,
    ),
  );
  /* The handlebar runs behind the headset, long and swept a little: its
     far end higher, its near end lower, grips at both ends and a mirror on
     the far side. */
  const BAR = {
    u: 1.0,
    v: 2.84,
    reach: 1.15,
    sweep: 0.12,
    r: 0.06,
    grip: 0.085,
  };
  const onBar = (w: number): V3 => [
    BAR.u,
    BAR.v - (BAR.sweep * w) / BAR.reach,
    w,
  ];
  pieces.push(tube(onBar(-BAR.reach), onBar(BAR.reach), BAR.r, dy));
  pieces.push(tube(onBar(BAR.reach - 0.3), onBar(BAR.reach), BAR.grip, dy));
  pieces.push(tube(onBar(-BAR.reach + 0.3), onBar(-BAR.reach), BAR.grip, dy));
  const foot = onBar(-0.8);
  const head: V3 = [foot[0] - 0.12, foot[1] + 0.47, foot[2] - 0.05];
  pieces.push(tube(foot, head, 0.02, dy));
  pieces.push(
    prism(
      disc(head[0] - 0.04, head[1] + 0.05, head[2], 0.1, 18),
      [0.05, 0, 0],
      dy,
      undefined,
      true,
    ),
  );
  /* The lamp, its glass grey until it is lit (the lit glass is drawn with
     the beam, over the body). */
  const rim = disc(LAMP.u, LAMP.v, 0, LAMP.r, 32)
    .map((p) => project(p, dy).map(f).join(","))
    .join(" ");
  pieces.push({
    depth: dot([LAMP.u, LAMP.v, 0], VIEW) + 1,
    svg:
      `<polygon points="${rim}" fill="${TOP}" stroke="${LINE}"/>` +
      `<polygon points="${glass(dy)}" fill="${SIDE}" stroke="${LINE}"/>`,
  });
  return panels + draw(pieces);
}

/* The lamp's glass, on screen. */
const glass = (dy = 0) =>
  disc(GLASS.u, LAMP.v, 0, GLASS.r, 32)
    .map((p) => project(p, dy).map(f).join(","))
    .join(" ");

/* The points round a set of points (a convex hull), on screen. */
function hull(points: P2[]) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o: P2, a: P2, b: P2) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: P2[]) => {
    const out: P2[] = [];
    for (const p of list) {
      while (
        out.length >= 2 &&
        turn(out[out.length - 2], out[out.length - 1], p) <= 0
      )
        out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

/** The headlamp lit: its glass in the accent and its beam, a cone of light
    thrown forward from the glass, fading as it goes. Drawn over the body,
    so it hides when the lamp is off. */
export function beam(id: string) {
  const near = disc(GLASS.u, LAMP.v, 0, GLASS.r, 24).map((p) => project(p));
  const far = disc(GLASS.u - BEAM.reach, LAMP.v, 0, BEAM.spread, 24).map((p) =>
    project(p),
  );
  const from = project([GLASS.u, LAMP.v, 0]);
  const to = project([GLASS.u - BEAM.reach, LAMP.v, 0]);
  const cone = hull([...near, ...far])
    .map((p) => p.map(f).join(","))
    .join(" ");
  return (
    `<defs><linearGradient id="${id}" x1="${f(from[0])}" y1="${f(from[1])}" x2="${f(to[0])}" y2="${f(to[1])}" gradientUnits="userSpaceOnUse"><stop stop-color="${ACCENT}" stop-opacity="0.9"/><stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/></linearGradient></defs>` +
    `<polygon class="moto-beam" points="${cone}" fill="url(#${id})"/>` +
    `<polygon class="moto-lamp" points="${glass()}" fill="${ACCENT}" stroke="${ACCENT}"/>`
  );
}

/** The engine's shake: the body jumps a pixel or so, eight times a second,
    as a square wave. */
export const shake = (t: number) => (Math.floor(t * 8) % 2 ? 1.4 : 0);

/** The whole scooter at rest, in layers the page can move: the far side,
    the back wheel, the front wheel, the rest of the body, then the lamp
    lit. */
export function motorcycle() {
  return (
    `<svg viewBox="0 0 ${W} ${H}">` +
    `<g class="moto-body">${far(0)}</g>` +
    `<g class="moto-wheel" data-wheel="rear">${wheel("rear")}</g>` +
    `<g class="moto-wheel" data-wheel="front">${wheel("front")}</g>` +
    `<g class="moto-body">${body(0)}</g>` +
    `<g class="moto-light">${beam("moto-light")}</g>` +
    `</svg>`
  );
}
