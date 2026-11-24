/**
 * Cards that dissolve into ASCII as they drop out of a deck. While a card's
 * `yPercent` runs from 0 to `drop` (as a scroll-driven timeline moves it), it
 * breaks away cell by cell from its bottom edge up, through an SVG mask, and
 * every cell that goes leaves a character behind that drifts down and to the
 * left, turns green and fades. Everything follows the card's position, so it
 * stops when the scroll stops and rebuilds when it scrolls back.
 *
 * The characters show only on the page around the deck, never over the
 * cards still in it.
 */
import { gsap } from "@/utils/gsap.ts";

/** One character per cell, in CSS px. */
const CELL = { w: 6, h: 9 };
/** Share of a card's drop before it starts to break up. */
const START = 0.25;
/** Share of the dissolve a released character stays visible. */
const LIFE = 0.3;
/** Extra room around a card, for anything drawn past its edges. */
const PAD = 16;
/** A cell fades over 1 / EDGE of the dissolve rather than blinking out. */
const EDGE = 10;
const CHARS = "@%#*+=-:.xoMWqtc$&";
const SVG = "http://www.w3.org/2000/svg";

type Cell = {
  x: number;
  y: number;
  t: number;
  drift: number;
  fall: number;
  shade: number;
  char: number;
  inside: boolean;
};

type Piece = {
  card: HTMLElement;
  id: string;
  image: SVGFEImageElement;
  transfer: SVGFEFuncAElement;
  filter: SVGFilterElement;
  cells: Cell[];
  w: number;
  h: number;
  on: boolean;
  d: number;
};

let count = 0;

/* Smooth value noise on a coarse grid, so cells break away in patches. */
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

/* The moment each cell breaks away: the bottom edge, which leads the drop,
   first, in ragged patches, all done with room for the last characters to
   fade before the card is gone. */
function makeCells(w: number, h: number) {
  const columns = Math.ceil((w + PAD * 2) / CELL.w);
  const rows = Math.ceil((h + PAD * 2) / CELL.h);
  const noise = patches(7, 5);
  const cells: Cell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const x = col * CELL.w - PAD;
      const y = row * CELL.h - PAD;
      const u = (col + 0.5) / columns;
      const v = (row + 0.5) / rows;
      cells.push({
        x,
        y,
        t: 0.35 * noise(u, v) + 0.2 * Math.random() + 0.45 * (1 - v),
        drift: Math.random(),
        fall: Math.random(),
        shade: Math.random(),
        char: Math.floor(Math.random() * CHARS.length),
        inside: x >= 0 && y >= 0 && x + CELL.w <= w && y + CELL.h <= h,
      });
    }
  }
  let low = Infinity;
  let high = -Infinity;
  cells.forEach(({ t }) => {
    low = Math.min(low, t);
    high = Math.max(high, t);
  });
  /* Shifted by the soft edge, so the first cells are whole at the start. */
  cells.forEach((cell) => {
    cell.t = 1 / EDGE + ((cell.t - low) / (high - low)) * (1 - LIFE - 1 / EDGE);
  });
  return cells;
}

/* The mask: each cell painted with its moment as alpha. The filter keeps the
   card only where that is still ahead of the dissolve. */
function maskOf(cells: Cell[], w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w + PAD * 2;
  canvas.height = h + PAD * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  cells.forEach((cell) => {
    ctx.fillStyle = `rgba(255,255,255,${cell.t})`;
    ctx.fillRect(cell.x + PAD, cell.y + PAD, CELL.w, CELL.h);
  });
  return canvas.toDataURL("image/png");
}

function build(card: HTMLElement, defs: SVGDefsElement): Piece {
  const id = `dissolve-${++count}`;
  const filter = document.createElementNS(SVG, "filter");
  filter.id = id;
  filter.setAttribute("filterUnits", "userSpaceOnUse");
  filter.setAttribute("primitiveUnits", "userSpaceOnUse");
  filter.setAttribute("color-interpolation-filters", "sRGB");
  const image = document.createElementNS(SVG, "feImage");
  image.setAttribute("preserveAspectRatio", "none");
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
  const piece: Piece = { card, id, image, transfer, filter, cells: [], w: 0, h: 0, on: false, d: 0 };
  measure(piece);
  return piece;
}

function measure(piece: Piece) {
  const w = piece.card.offsetWidth;
  const h = piece.card.offsetHeight;
  if (w === 0 || (w === piece.w && h === piece.h)) return;
  piece.w = w;
  piece.h = h;
  piece.cells = makeCells(w, h);
  const box = { x: -PAD, y: -PAD, width: w + PAD * 2, height: h + PAD * 2 };
  Object.entries(box).forEach(([key, value]) => {
    piece.filter.setAttribute(key, String(value));
    piece.image.setAttribute(key, String(value));
  });
  piece.image.setAttribute("href", maskOf(piece.cells, w, h));
}

/* A colour as [r, g, b], read back through a canvas. */
function rgb(color: string, fallback: number[]) {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx || !color) return fallback;
  ctx.fillStyle = color;
  const hex = String(ctx.fillStyle);
  if (!hex.startsWith("#")) return fallback;
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

/**
 * Dissolves `cards` as they drop, each by up to `drop` (its `yPercent` at the
 * bottom of the drop, eased in as `power1.in`). Returns a function that puts
 * everything back.
 */
export function dissolveCards(cards: HTMLElement[], drop = 110): () => void {
  if (cards.length === 0) return () => {};
  const style = getComputedStyle(document.documentElement);
  const paper = rgb(style.getPropertyValue("--light-100").trim(), [244, 244, 244]);
  const green = rgb(style.getPropertyValue("--brand-500").trim(), [123, 213, 45]);
  /* Characters start pale, between the card's colour and the green. */
  const mint = paper.map((value, k) => Math.round(value + (green[k] - value) * 0.45));
  const font = style.getPropertyValue("--mono-family").trim() || "monospace";

  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.setAttribute("aria-hidden", "true");
  svg.style.position = "absolute";
  const defs = document.createElementNS(SVG, "defs");
  svg.append(defs);
  document.body.append(svg);

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100vw;height:100vh;z-index:50;pointer-events:none";
  document.body.append(canvas);
  const ctx = canvas.getContext("2d");

  const size = () => {
    if (!ctx) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `${CELL.h * 1.15}px ${font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
  };
  size();

  const pieces = cards.map((card) => build(card, defs));
  const resize = () => {
    size();
    pieces.forEach(measure);
  };
  addEventListener("resize", resize);

  /* Characters, as runs of [x, y, alpha, char, age]. */
  const paint = (list: number[]) => {
    if (!ctx) return;
    for (let i = 0; i < list.length; i += 5) {
      const mix = Math.min(1, list[i + 4] / 0.5);
      const [r, g, b] = mint.map((value, k) => Math.round(value + (green[k] - value) * mix));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.globalAlpha = list[i + 2];
      ctx.fillText(CHARS[list[i + 3]], list[i], list[i + 1]);
    }
  };

  let drawn = false;
  const tick = () => {
    let any = false;
    pieces.forEach((piece) => {
      const dropped = Math.min(
        1,
        Math.max(0, (Number(gsap.getProperty(piece.card, "yPercent")) || 0) / drop),
      );
      const d = Math.min(1, Math.max(0, (Math.sqrt(dropped) - START) / (1 - START)));
      piece.d = d;
      if (d > 0 && !piece.on) {
        piece.card.style.filter = `url(#${piece.id})`;
        piece.on = true;
      } else if (d === 0 && piece.on) {
        piece.card.style.filter = "";
        piece.on = false;
      }
      if (piece.on) {
        piece.transfer.setAttribute("intercept", String(-EDGE * d));
        any = true;
      }
    });

    if (!ctx || (!any && !drawn)) return;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    drawn = false;
    if (!any) return;

    const kept = pieces
      .filter((piece) => piece.d === 0)
      .map((piece) => piece.card.getBoundingClientRect());
    ctx.save();
    if (kept.length > 0) {
      const left = Math.min(...kept.map((r) => r.left));
      const top = Math.min(...kept.map((r) => r.top));
      const right = Math.max(...kept.map((r) => r.right));
      const bottom = Math.max(...kept.map((r) => r.bottom));
      ctx.beginPath();
      ctx.rect(0, 0, innerWidth, innerHeight);
      ctx.rect(left, top, right - left, bottom - top);
      ctx.clip("evenodd");
    }

    const glyphs: number[] = [];
    pieces.forEach((piece) => {
      if (!piece.on) return;
      const box = piece.card.getBoundingClientRect();
      const now = START + piece.d * (1 - START);
      /* Where the card's top was before it started to drop. */
      const rest = box.top - (drop / 100) * piece.h * now * now;
      const scale = piece.w / 860;
      piece.cells.forEach((cell) => {
        if (!cell.inside || cell.t > piece.d + 1 / EDGE) return;
        const a = Math.max(0, (piece.d - cell.t + 1 / EDGE) / LIFE);
        if (a >= 1) return;
        const at = START + cell.t * (1 - START);
        const release = rest + (drop / 100) * piece.h * at * at;
        const e = 1 - (1 - a) * (1 - a);
        const x =
          box.left + cell.x + CELL.w / 2 +
          (-20 - 180 * cell.drift) * e * scale +
          Math.sin(a * 5 + cell.shade * 6.283) * 4;
        const y = release + cell.y + CELL.h / 2 + (-10 + 70 * cell.fall) * e * scale;
        if (y < -20 || y > innerHeight + 20) return;
        const alpha = Math.pow(1 - a, 1.4) * (0.45 + 0.55 * cell.shade);
        glyphs.push(x, y, alpha, (cell.char + Math.floor(a * 7)) % CHARS.length, a);
      });
    });
    paint(glyphs);
    ctx.globalAlpha = 1;
    ctx.restore();
    drawn = true;
  };
  gsap.ticker.add(tick);

  return () => {
    gsap.ticker.remove(tick);
    removeEventListener("resize", resize);
    pieces.forEach((piece) => (piece.card.style.filter = ""));
    svg.remove();
    canvas.remove();
  };
}
