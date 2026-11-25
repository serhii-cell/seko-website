/**
 * Problem 1's dial: a washing-machine programme knob for a strong product
 * behind a confusing interface. Eight settings ring the knob, each a
 * Material Symbols icon in a round frame (power, cloud, database, code...),
 * and the knob keeps turning between them, unsure which one it wants.
 *
 * The knob's grip is drawn by `grip(angle)`, so the page can render a still
 * on the server and the script can redraw it as it turns. Drawn in the
 * site's light palette as SVG, the symbols in ink like a real panel's print,
 * the pointer and the chosen setting, frame and symbol, in the accent.
 */

export const W = 779;
export const H = 500;

const TOP = "#FFFFFF";
const SIDE = "#F0F0F0";
const LINE = "#E0E0E0";
/** The symbols, quiet until their setting is chosen. */
const ICON_INK = "#9E9E9E";
export const ACCENT = "#7BD52D";

/** The knob's foot on the panel; the settings ring it. */
const CX = W / 2;
const CY = 254;
/** The knob: its radius and how far it stands off the panel, seen from a
    little above, so its top face sits that much higher on screen. */
const KNOB = 90;
const DEPTH = 14;
/** The grip across the knob's face: its half-width and height. */
const GRIP = 15;
const GRIP_RISE = 8;
/** The settings' round frames: how far out they sit and their radius. */
const RING = 184;
const FRAME = 32;
/** The symbols' size inside the frames. */
const ICON = 28;
export const STEPS = 8;
export const STEP = 360 / STEPS;
/** The setting the still shows the knob on. */
export const STILL = 2;
/** The dial is drawn at this size within the frame, centred, so it has
    room above and below; `PLACE` is the transform that puts it there. */
const SCALE = 0.8;
export const PLACE = `translate(${(CX * (1 - SCALE)).toFixed(1)} ${(H / 2 - CY * SCALE).toFixed(1)}) scale(${SCALE})`;

/** The whole frame in the dial's own units (before `PLACE`), for things
    that come in from anywhere in it. */
export const FRAME_BOUNDS = (() => {
  const tx = CX * (1 - SCALE);
  const ty = H / 2 - CY * SCALE;
  return {
    left: -tx / SCALE,
    top: -ty / SCALE,
    right: (W - tx) / SCALE,
    bottom: (H - ty) / SCALE,
  };
})();

const f = (value: number) => value.toFixed(1);

/* The symbols: Material Symbols (outlined, weight 400, Apache 2.0), each
   a filled path on its 960-unit grid, whose top edge is at -960. */
const SYMBOLS: Record<string, string> = {
  power:
    "M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-84 31.5-156.5T197-763l56 56q-44 44-68.5 102T160-480q0 134 93 227t227 93q134 0 227-93t93-227q0-67-24.5-125T707-707l56-56q54 54 85.5 126.5T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm-40-360v-440h80v440h-80Z",
  cloud:
    "M260-160q-91 0-155.5-63T40-377q0-78 47-139t123-78q25-92 100-149t170-57q117 0 198.5 81.5T760-520q69 8 114.5 59.5T920-340q0 75-52.5 127.5T740-160H260Zm0-80h480q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-80q0-83-58.5-141.5T480-720q-83 0-141.5 58.5T280-520h-20q-58 0-99 41t-41 99q0 58 41 99t99 41Zm220-240Z",
  database:
    "M480-120q-151 0-255.5-46.5T120-280v-400q0-66 105.5-113T480-840q149 0 254.5 47T840-680v400q0 67-104.5 113.5T480-120Zm0-479q89 0 179-25.5T760-679q-11-29-100.5-55T480-760q-91 0-178.5 25.5T200-679q14 30 101.5 55T480-599Zm0 199q42 0 81-4t74.5-11.5q35.5-7.5 67-18.5t57.5-25v-120q-26 14-57.5 25t-67 18.5Q600-528 561-524t-81 4q-42 0-82-4t-75.5-11.5Q287-543 256-554t-56-25v120q25 14 56 25t66.5 18.5Q358-408 398-404t82 4Zm0 200q46 0 93.5-7t87.5-18.5q40-11.5 67-26t32-29.5v-98q-26 14-57.5 25t-67 18.5Q600-328 561-324t-81 4q-42 0-82-4t-75.5-11.5Q287-343 256-354t-56-25v99q5 15 31.5 29t66.5 25.5q40 11.5 88 18.5t94 7Z",
  code: "M320-240 80-480l240-240 57 57-184 184 183 183-56 56Zm320 0-57-57 184-184-183-183 56-56 240 240-240 240Z",
  sync: "M160-160v-80h110l-16-14q-52-46-73-105t-21-119q0-111 66.5-197.5T400-790v84q-72 26-116 88.5T240-478q0 45 17 87.5t53 78.5l10 10v-98h80v240H160Zm400-10v-84q72-26 116-88.5T720-482q0-45-17-87.5T650-648l-10-10v98h-80v-240h240v80H690l16 14q49 49 71.5 106.5T800-482q0 111-66.5 197.5T560-170Z",
  folder:
    "M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h240l80 80h320q33 0 56.5 23.5T880-640v400q0 33-23.5 56.5T800-160H160Zm0-80h640v-400H447l-80-80H160v480Zm0 0v-480 480Z",
  settings:
    "m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z",
  wifi: "M409-149q-29-29-29-71t29-71q29-29 71-29t71 29q29 29 29 71t-29 71q-29 29-71 29t-71-29ZM254-346l-84-86q59-59 138.5-93.5T480-560q92 0 171.5 35T790-430l-84 84q-44-44-102-69t-124-25q-66 0-124 25t-102 69ZM84-516 0-600q92-94 215-147t265-53q142 0 265 53t215 147l-84 84q-77-77-178.5-120.5T480-680q-116 0-217.5 43.5T84-516Z",
};

/** Each setting, clockwise from the top. */
const SETTINGS = [
  "power",
  "cloud",
  "database",
  "code",
  "sync",
  "folder",
  "settings",
  "wifi",
];

/* A setting: its round frame and its symbol centred in it, both in the
   accent when lit. */
function setting(name: string, x: number, y: number, lit: boolean) {
  const k = ICON / 960;
  return (
    `<g class="dial-setting">` +
    `<circle cx="${f(x)}" cy="${f(y)}" r="${FRAME}" fill="${TOP}" stroke="${lit ? ACCENT : LINE}" data-setting/>` +
    `<path d="${SYMBOLS[name]}" fill="${lit ? ACCENT : ICON_INK}" data-symbol transform="translate(${f(x - ICON / 2)} ${f(y + ICON / 2)}) scale(${k.toFixed(5)})"/>` +
    `</g>`
  );
}

/** Where a setting sits, `radius` out from the knob's centre. */
const around = (index: number, radius: number): [number, number] => {
  const a = (index * STEP * Math.PI) / 180;
  return [CX + Math.sin(a) * radius, CY - Math.cos(a) * radius];
};

/* A rounded slab, as a thick round-joined line: the shape (points) grown
   by `r` all round, outlined. */
const slab = (points: [number, number][], r: number, fill: string) => {
  const d = `M${points.map(([x, y]) => `${f(x)} ${f(y)}`).join("L")}Z`;
  return (
    `<path d="${d}" stroke="${LINE}" stroke-width="${f(r * 2 + 2)}" stroke-linejoin="round" stroke-linecap="round" fill="${LINE}"/>` +
    `<path d="${d}" stroke="${fill}" stroke-width="${f(r * 2)}" stroke-linejoin="round" stroke-linecap="round" fill="${fill}"/>`
  );
};

/* The grip's axis turned `angle` degrees clockwise from the top: its
   direction, and a point `s` (-1 to 1) along it, `lift` above the face. */
function gripAxis(angle: number) {
  const a = (angle * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const reach = KNOB - GRIP - 9;
  const end = (s: number, lift: number): [number, number] => [
    CX + dx * reach * s,
    CY - DEPTH + dy * reach * s - lift,
  ];
  return { dx, dy, end };
}

/** The grip across the knob's face and the pointer printed on it, turned
    `angle` degrees clockwise from the top. */
export function grip(angle: number) {
  const { dx, dy, end } = gripAxis(angle);
  const side = slab(
    [end(-1, 0), end(1, 0), end(1, GRIP_RISE), end(-1, GRIP_RISE)],
    GRIP,
    SIDE,
  );
  const top = slab([end(-1, GRIP_RISE), end(1, GRIP_RISE)], GRIP, TOP);
  const [px, py] = end(1, GRIP_RISE);
  const pointer = `<path d="M${f(px)} ${f(py)}L${f(px - dx * 30)} ${f(py - dy * 30)}" stroke="${ACCENT}" stroke-width="4" stroke-linecap="round"/>`;
  return side + top + pointer;
}

/** The setting the knob is on at `angle`, or -1 between settings. */
export function settingAt(angle: number) {
  const steps = angle / STEP;
  const nearest = Math.round(steps);
  if (Math.abs(steps - nearest) * STEP > 3) return -1;
  return ((nearest % STEPS) + STEPS) % STEPS;
}

/** Everything that stays put: the settings in their frames, the glow
    round the frame of the setting `lit`, and the knob's body. */
export function panel(lit: number) {
  const [gx, gy] = around(Math.max(lit, 0), RING);
  const glow = `<circle class="dial-glow" cx="${f(gx)}" cy="${f(gy)}" r="${FRAME}" fill="${ACCENT}" opacity="${lit < 0 ? 0 : 0.5}" filter="url(#dial-blur)"/>`;
  const settings = SETTINGS.map((name, i) => {
    const [x, y] = around(i, RING);
    return setting(name, x, y, i === lit);
  }).join("");
  const well = `<circle cx="${CX}" cy="${CY}" r="${KNOB + 18}" fill="none" stroke="${LINE}"/>`;
  const body = slab(
    [
      [CX, CY],
      [CX, CY - DEPTH],
    ],
    KNOB,
    SIDE,
  );
  const face = `<circle cx="${CX}" cy="${CY - DEPTH}" r="${KNOB}" fill="${TOP}" stroke="${LINE}"/>`;
  return (
    `<defs><filter id="dial-blur" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="7"/></filter></defs>` +
    glow +
    settings +
    `<g class="dial-knob">${well}${body}${face}</g>`
  );
}

/** Glyphs from light to dark. */
export const RAMP = " .:-=+*#%@";
/** The glyph grid's cell, in drawing units. */
const CELL_W = 7;
const CELL_H = 10;

/* How far the point (px, py) is from the segment a-b. */
function toSegment(
  px: number,
  py: number,
  [ax, ay]: [number, number],
  [bx, by]: [number, number],
) {
  const vx = bx - ax;
  const vy = by - ay;
  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1)),
  );
  return Math.hypot(px - ax - vx * t, py - ay - vy * t);
}

/** The knob turned to `angle`, drawn in glyphs for it to appear from: one
    character per cell, denser where the knob is darker (the grip's side and
    the knob's side), the pointer densest, in the symbols' grey. Each glyph is a
    separate `<text>` so it can come and go on its own. */
export function knobGlyphs(angle: number) {
  const { dx, dy, end } = gripAxis(angle);
  const face = CY - DEPTH;
  const [px, py] = end(1, GRIP_RISE);
  const pointerEnd: [number, number] = [px - dx * 30, py - dy * 30];
  const density = (x: number, y: number) => {
    if (toSegment(x, y, [px, py], pointerEnd) <= 4) return 1;
    const top = toSegment(x, y, end(-1, GRIP_RISE), end(1, GRIP_RISE));
    if (top <= GRIP) return top > GRIP - 4 ? 0.8 : 0.5;
    for (let lift = 0; lift < GRIP_RISE; lift += 2) {
      if (toSegment(x, y, end(-1, lift), end(1, lift)) <= GRIP) return 0.8;
    }
    const fromFace = Math.hypot(x - CX, y - face);
    if (fromFace <= KNOB) {
      return fromFace > KNOB - 5
        ? 0.75
        : 0.3 + (0.15 * (y - face + KNOB)) / (2 * KNOB);
    }
    const fromFoot = Math.hypot(x - CX, y - CY);
    if (fromFoot <= KNOB || (Math.abs(x - CX) <= KNOB && y >= face && y <= CY))
      return 0.7;
    if (Math.abs(fromFoot - (KNOB + 18)) <= 3) return 0.35;
    return 0;
  };
  const reach = KNOB + 22;
  const glyphs: string[] = [];
  for (let y = CY - DEPTH - reach; y <= CY + reach; y += CELL_H) {
    for (let x = CX - reach; x <= CX + reach; x += CELL_W) {
      const value = density(x, y);
      if (value <= 0) continue;
      /* A little grain, the same every time. */
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
  return `<g class="dial-glyphs" fill="${ICON_INK}" font-family="ui-monospace, monospace" font-size="10.5" text-anchor="middle" dominant-baseline="central">${glyphs.join("")}</g>`;
}
