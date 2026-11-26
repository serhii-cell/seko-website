/**
 * ASCII that comes in over a work card's picture while it is hovered. The
 * glyph layer (white glyphs on transparent, the picture's size) is split
 * along its character grid, and on hover every character fades in where it
 * stands, at its own moment, in ragged patches, until the whole scene has
 * assembled. Leaving the card plays it back out, faster.
 *
 * The layer is always drawn whole and then masked per character cell, so the
 * glyphs never move and nothing snaps into place at the end.
 *
 * The layer loads on the first hover. With reduced motion it simply fades
 * in and out; on screens without hover nothing is drawn.
 */
import { gsap } from "@/utils/gsap.ts";

/** Seconds over which the characters start to show, and each one's fade. */
const SPREAD = 0.7;
const FADE = 0.16;
const TOTAL = SPREAD + FADE;
/** How much faster the characters leave than they came. */
const OUT = 1.8;
/** How much of each character's moment comes from its patch, not chance. */
const CLUMP = 0.7;

/* Smooth value noise on a coarse grid, so characters arrive in patches. */
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

type Cells = {
  /** The grid's first border, in layer px (at or before 0). */
  x0: number;
  y0: number;
  pw: number;
  ph: number;
  columns: number;
  rows: number;
  /** Each cell's start in seconds; -1 where the cell is empty. */
  start: Float32Array;
};

/* The layer's character cells and when each one shows. */
function cut(image: HTMLImageElement, grid: number[]): Cells | null {
  const [pw, ph, ox, oy] = grid;
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  const probe = document.createElement("canvas");
  probe.width = w;
  probe.height = h;
  const context = probe.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0);
  const alpha = context.getImageData(0, 0, w, h).data;
  const x0 = ox - pw * Math.ceil(ox / pw);
  const y0 = oy - ph * Math.ceil(oy / ph);
  const columns = Math.ceil((w - x0) / pw);
  const rows = Math.ceil((h - y0) / ph);
  const noise = patches(7, 4);
  const start = new Float32Array(columns * rows).fill(-1);
  for (let j = 0; j < rows; j++) {
    const top = Math.max(0, Math.round(y0 + j * ph));
    const bottom = Math.min(h, Math.round(y0 + (j + 1) * ph));
    for (let i = 0; i < columns; i++) {
      const left = Math.max(0, Math.round(x0 + i * pw));
      const right = Math.min(w, Math.round(x0 + (i + 1) * pw));
      let ink = 0;
      for (let y = top; y < bottom && !ink; y += 2) {
        for (let x = left; x < right; x += 2) {
          if (alpha[(y * w + x) * 4 + 3] > 8) {
            ink = 1;
            break;
          }
        }
      }
      if (!ink) continue;
      const order = noise((left + pw / 2) / w, (top + ph / 2) / h) * CLUMP + Math.random() * (1 - CLUMP);
      start[j * columns + i] = order * SPREAD;
    }
  }
  return { x0, y0, pw, ph, columns, rows, start };
}

export function glyphHover(card: HTMLElement) {
  const canvas = card.querySelector<HTMLCanvasElement>(".card_glyphs");
  const src = canvas?.dataset.src;
  const grid = (canvas?.dataset.grid ?? "").split(",").map(Number);
  if (!canvas || !src || grid.length !== 4 || grid.some((n) => !Number.isFinite(n)))
    return () => {};
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return () => {};
  const context = canvas.getContext("2d");
  if (!context) return () => {};
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  let image: HTMLImageElement | null = null;
  let cells: Cells | null = null;
  /* One pixel per character cell; its alpha is how far that cell is in. */
  const mask = document.createElement("canvas");
  const maskContext = mask.getContext("2d");
  let maskData: ImageData | null = null;
  let loading: Promise<void> | null = null;
  const clock = { t: 0 };
  let timeline: gsap.core.Tween | null = null;
  let hovered = false;

  const load = () =>
    (loading ??= (async () => {
      const next = new Image();
      next.decoding = "async";
      next.src = src;
      await next.decode();
      image = next;
      cells = cut(next, grid);
      if (cells && maskContext) {
        mask.width = cells.columns;
        mask.height = cells.rows;
        maskData = maskContext.createImageData(cells.columns, cells.rows);
        /* White, so only the alpha below decides anything. */
        for (let k = 0; k < maskData.data.length; k += 4) {
          maskData.data[k] = maskData.data[k + 1] = maskData.data[k + 2] = 255;
        }
      }
    })());

  /* Sized to the picture's box, which scales with it on hover. */
  function fit() {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.round(canvas!.clientWidth * ratio);
    const height = Math.round(canvas!.clientHeight * ratio);
    if (canvas!.width !== width || canvas!.height !== height) {
      canvas!.width = width;
      canvas!.height = height;
    }
  }

  function draw(t: number) {
    if (!image || !context) return;
    fit();
    const W = image.naturalWidth;
    const H = image.naturalHeight;
    /* The layer covers the box as the picture under it does. */
    const scale = Math.max(canvas!.width / W, canvas!.height / H);
    const left = (canvas!.width - W * scale) / 2;
    const top = (canvas!.height - H * scale) / 2;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalCompositeOperation = "source-over";
    context.globalAlpha = 1;
    context.clearRect(0, 0, canvas!.width, canvas!.height);
    if (t <= 0) return;
    if (reduce.matches || !cells || !maskData || !maskContext) {
      context.globalAlpha = Math.min(1, t / TOTAL);
      context.drawImage(image, left, top, W * scale, H * scale);
      context.globalAlpha = 1;
      return;
    }
    context.drawImage(image, left, top, W * scale, H * scale);
    /* Each cell's share of the way in, eased, as the mask's alpha. */
    const { start, x0, y0, pw, ph, columns, rows } = cells;
    const data = maskData.data;
    for (let k = 0; k < start.length; k++) {
      const s = start[k];
      let a = 0;
      if (s >= 0) {
        const p = Math.min(1, Math.max(0, (t - s) / FADE));
        a = 1 - (1 - p) * (1 - p);
      }
      data[k * 4 + 3] = Math.round(a * 255);
    }
    maskContext.putImageData(maskData, 0, 0);
    context.globalCompositeOperation = "destination-in";
    context.imageSmoothingEnabled = false;
    context.drawImage(mask, left + x0 * scale, top + y0 * scale, columns * pw * scale, rows * ph * scale);
    context.imageSmoothingEnabled = true;
    context.globalCompositeOperation = "source-over";
  }

  const play = (on: boolean) => {
    timeline?.kill();
    const to = on ? TOTAL : 0;
    const speed = on ? 1 : OUT;
    timeline = gsap.to(clock, {
      t: to,
      duration: Math.abs(to - clock.t) / speed,
      ease: "none",
      onUpdate: () => draw(clock.t),
    });
  };

  const enter = async () => {
    hovered = true;
    try {
      await load();
    } catch {
      return;
    }
    if (hovered) play(true);
  };
  const leave = () => {
    hovered = false;
    if (image) play(false);
  };
  /* Redrawn at the new size if the card is resized while showing. */
  const resize = new ResizeObserver(() => draw(clock.t));
  resize.observe(canvas);

  card.addEventListener("pointerenter", enter);
  card.addEventListener("pointerleave", leave);
  return () => {
    timeline?.kill();
    resize.disconnect();
    card.removeEventListener("pointerenter", enter);
    card.removeEventListener("pointerleave", leave);
    context.clearRect(0, 0, canvas.width, canvas.height);
  };
}
