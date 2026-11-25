/**
 * Parts of a drawing that dissolve into ASCII while they are hovered, as
 * the Services cards do when they drop: the part breaks away cell by cell in
 * ragged patches, through an SVG mask, and each cell leaves a character that
 * drifts out from the part, turns green and fades. It stays gone while the
 * pointer is on it; leaving plays it back, so the characters fly home and
 * the part comes together again.
 */
import { gsap } from "@/utils/gsap.ts";

/** One character per cell: cells are sized so even a small part has about
 *  this many, between the smallest and largest size, in screen px. */
const CELLS = 360;
const CELL = { min: 3, max: 6 };
/** The characters' size, in screen px, whatever the cell. */
const FONT = 9;
/** Share of the dissolve a released character stays visible. */
const LIFE = 0.35;
/** A cell fades over 1 / EDGE of the dissolve rather than blinking out. */
const EDGE = 8;
const CHARS = "@%#*+=-:.xoMWqtc$&";
const GREEN = [123, 213, 45];
/* Characters start a deeper green, so they read on the white frame, and
   brighten to the accent as they drift. */
const DEEP = [84, 160, 30];
const MINT = DEEP;
const SVG = "http://www.w3.org/2000/svg";

type Cell = {
  x: number;
  y: number;
  t: number;
  /* Whether the part is drawn here, so only real cells leave a glyph. */
  inked: boolean;
  drift: number;
  rise: number;
  shade: number;
  char: number;
};

type Piece = {
  el: SVGGraphicsElement;
  id: string;
  transfer: SVGFEFuncAElement;
  cells: Cell[];
  cx: number;
  cy: number;
  size: number;
  state: { d: number };
  tween: gsap.core.Tween | null;
};

let count = 0;

/* Smooth value noise on a coarse grid, so cells go in patches. */
function patches(columns: number, rows: number) {
  const grid = Array.from({ length: (columns + 1) * (rows + 1) }, () => Math.random());
  const at = (i: number, j: number) =>
    grid[Math.min(j, rows) * (columns + 1) + Math.min(i, columns)];
  const smooth = (f: number) => f * f * (3 - 2 * f);
  return (u: number, v: number) => {
    const x = u * columns;
    const y = v * rows;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smooth(x - x0);
    const fy = smooth(y - y0);
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx;
    const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx;
    return top + (bottom - top) * fy;
  };
}

/* The part's mask and cells, in its own coordinates. */
function build(el: SVGGraphicsElement, defs: SVGDefsElement): Piece | null {
  const box = el.getBBox();
  const ctm = el.getScreenCTM();
  if (!ctm || box.width === 0 || box.height === 0) return null;
  const scale = Math.hypot(ctm.a, ctm.b) || 1;
  const area = box.width * box.height * scale * scale;
  const px = Math.min(CELL.max, Math.max(CELL.min, Math.sqrt(area / CELLS)));
  const size = px / scale;
  const pad = size * 2;
  const x0 = box.x - pad;
  const y0 = box.y - pad;
  const width = box.width + pad * 2;
  const height = box.height + pad * 2;
  const columns = Math.max(1, Math.ceil(width / size));
  const rows = Math.max(1, Math.ceil(height / size));
  const noise = patches(4, 4);

  /* Every shape in the part, with the map from the part's coordinates to
     its own, to test which cells the part actually paints. */
  const shapes = [
    ...el.querySelectorAll<SVGGeometryElement>("path, circle, ellipse, rect, polygon, polyline, line"),
  ].flatMap((shape) => {
    const own = shape.getScreenCTM();
    if (!own) return [];
    return [{ shape, map: own.inverse().multiply(ctm) }];
  });
  const inked = (x: number, y: number) =>
    shapes.some(({ shape, map }) => {
      const point = new DOMPoint(x, y).matrixTransform(map);
      try {
        return shape.isPointInFill(point) || shape.isPointInStroke(point);
      } catch {
        return false;
      }
    });

  const cells: Cell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = x0 + (column + 0.5) * size;
      const y = y0 + (row + 0.5) * size;
      cells.push({
        x,
        y,
        inked: inked(x, y),
        t: 0.6 * noise((column + 0.5) / columns, (row + 0.5) / rows) + 0.4 * Math.random(),
        drift: Math.random(),
        rise: Math.random(),
        shade: Math.random(),
        char: Math.floor(Math.random() * CHARS.length),
      });
    }
  }
  let low = Infinity;
  let high = -Infinity;
  cells.forEach(({ t }) => {
    low = Math.min(low, t);
    high = Math.max(high, t);
  });
  cells.forEach((cell) => {
    cell.t = 1 / EDGE + ((cell.t - low) / (high - low || 1)) * (1 - LIFE - 1 / EDGE);
  });

  /* Each cell painted with its moment as alpha, one pixel a cell. */
  const mask = document.createElement("canvas");
  mask.width = columns;
  mask.height = rows;
  const pen = mask.getContext("2d");
  if (!pen) return null;
  cells.forEach((cell, i) => {
    pen.fillStyle = `rgba(255,255,255,${cell.t})`;
    pen.fillRect(i % columns, Math.floor(i / columns), 1, 1);
  });

  const id = `part-dissolve-${++count}`;
  const filter = document.createElementNS(SVG, "filter");
  filter.id = id;
  filter.setAttribute("filterUnits", "userSpaceOnUse");
  filter.setAttribute("primitiveUnits", "userSpaceOnUse");
  filter.setAttribute("color-interpolation-filters", "sRGB");
  const region = { x: x0, y: y0, width, height };
  Object.entries(region).forEach(([key, value]) => filter.setAttribute(key, String(value)));
  const image = document.createElementNS(SVG, "feImage");
  Object.entries(region).forEach(([key, value]) => image.setAttribute(key, String(value)));
  image.setAttribute("preserveAspectRatio", "none");
  image.setAttribute("href", mask.toDataURL("image/png"));
  image.setAttribute("result", "cells");
  const transfer = document.createElementNS(SVG, "feFuncA");
  transfer.setAttribute("type", "linear");
  transfer.setAttribute("slope", String(EDGE));
  transfer.setAttribute("intercept", "0");
  const component = document.createElementNS(SVG, "feComponentTransfer");
  component.setAttribute("in", "cells");
  component.setAttribute("result", "kept");
  component.append(transfer);
  const composite = document.createElementNS(SVG, "feComposite");
  composite.setAttribute("in", "SourceGraphic");
  composite.setAttribute("in2", "kept");
  composite.setAttribute("operator", "in");
  filter.append(image, component, composite);
  defs.append(filter);

  return {
    el,
    id,
    transfer,
    cells,
    cx: box.x + box.width / 2,
    cy: box.y + box.height / 2,
    size,
    state: { d: 0 },
    tween: null,
  };
}

/**
 * Dissolves the parts of `visual`'s drawing matching `selector` while they
 * are hovered. `busy` says when the drawing is doing something of its own
 * (its intro) and should be left alone. Returns a function that undoes it.
 */
export function partDissolve(
  visual: HTMLElement,
  selector: string,
  busy: () => boolean,
): () => void {
  const svg = visual.querySelector<SVGSVGElement>("svg");
  const parts = svg ? [...svg.querySelectorAll<SVGGraphicsElement>(selector)] : [];
  if (!svg || parts.length === 0) return () => {};

  const defs = document.createElementNS(SVG, "defs");
  svg.prepend(defs);
  const canvas = document.createElement("canvas");
  canvas.className = "problems-main_ascii";
  canvas.setAttribute("aria-hidden", "true");
  svg.after(canvas);
  const context = canvas.getContext("2d");
  const pieces = new Map<Element, Piece>();
  let running = false;

  const paint = () => {
    if (!context) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const box = canvas.getBoundingClientRect();
    const width = Math.round(box.width * ratio);
    const height = Math.round(box.height * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, box.width, box.height);
    context.font = `${FONT}px ui-monospace, monospace`;
    context.textAlign = "center";
    context.textBaseline = "middle";

    let any = false;
    for (const piece of pieces.values()) {
      const { d } = piece.state;
      piece.transfer.setAttribute("intercept", String(-EDGE * d));
      if (d > 0) piece.el.setAttribute("filter", `url(#${piece.id})`);
      else piece.el.removeAttribute("filter");
      if (d <= 0) continue;
      any = true;
      const ctm = piece.el.getScreenCTM();
      if (!ctm) continue;
      const point = (x: number, y: number) => ({
        x: ctm.a * x + ctm.c * y + ctm.e - box.left,
        y: ctm.b * x + ctm.d * y + ctm.f - box.top,
      });
      const centre = point(piece.cx, piece.cy);
      for (const cell of piece.cells) {
        if (!cell.inked || cell.t > d + 1 / EDGE) continue;
        const a = Math.max(0, (d - cell.t + 1 / EDGE) / LIFE);
        if (a >= 1) continue;
        const e = 1 - (1 - a) * (1 - a);
        const at = point(cell.x, cell.y);
        const dx = at.x - centre.x;
        const dy = at.y - centre.y;
        const reach = Math.hypot(dx, dy) || 1;
        /* Out from the part's centre, a little up, spreading as they go. */
        const push = (10 + 26 * cell.drift) * e;
        const x = at.x + (dx / reach) * push;
        const y = at.y + (dy / reach) * push - (6 + 14 * cell.rise) * e;
        const mix = Math.min(1, a / 0.5);
        const [r, g, b] = MINT.map((value, k) => Math.round(value + (GREEN[k] - value) * mix));
        context.fillStyle = `rgb(${r},${g},${b})`;
        context.globalAlpha = Math.pow(1 - a, 1.1) * (0.65 + 0.35 * cell.shade);
        context.fillText(CHARS[(cell.char + Math.floor(a * 6)) % CHARS.length], x, y);
      }
    }
    context.globalAlpha = 1;
    if (!any) stop();
  };

  const start = () => {
    if (running) return;
    running = true;
    gsap.ticker.add(paint);
  };
  const stop = () => {
    running = false;
    gsap.ticker.remove(paint);
    context?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const enter = (event: PointerEvent) => {
    const el = event.currentTarget as SVGGraphicsElement;
    /* Not while the drawing is busy, nor a part the scene keeps hidden. */
    if (busy() || getComputedStyle(el).opacity === "0") return;
    let piece = pieces.get(el);
    if (!piece) {
      const made = build(el, defs);
      if (!made) return;
      piece = made;
      pieces.set(el, piece);
    }
    piece.tween?.kill();
    piece.tween = gsap.to(piece.state, { d: 1, duration: 1.2, ease: "power1.inOut" });
    start();
  };
  const leave = (event: PointerEvent) => {
    const piece = pieces.get(event.currentTarget as Element);
    if (!piece) return;
    piece.tween?.kill();
    piece.tween = gsap.to(piece.state, { d: 0, duration: 0.9, ease: "power2.inOut" });
    start();
  };

  parts.forEach((part) => {
    part.addEventListener("pointerenter", enter);
    part.addEventListener("pointerleave", leave);
  });

  return () => {
    parts.forEach((part) => {
      part.removeEventListener("pointerenter", enter);
      part.removeEventListener("pointerleave", leave);
      part.removeAttribute("filter");
    });
    pieces.forEach((piece) => piece.tween?.kill());
    stop();
    defs.remove();
    canvas.remove();
  };
}
