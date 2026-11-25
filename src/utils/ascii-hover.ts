/**
 * A drawing turned to ASCII while it is hovered, in the glyphs and colours
 * of the problems' intros. On entering, the drawing as it stands right then
 * is read cell by cell: each cell's shade becomes a glyph from the ramp,
 * green where the drawing is green and grey elsewhere. The glyphs come in at
 * their own moments as the drawing fades back, flicker to their neighbours
 * on the ramp while the pointer stays, and fade out at their own moments
 * when it leaves, bringing the drawing back.
 */
import { gsap } from "@/utils/gsap.ts";
import { ACCENT, RAMP } from "@/utils/dial-scene.ts";

/** One glyph per cell, in CSS px. */
const CELL = { w: 6, h: 9 };
const GREY = "#9E9E9E";
/** How far the drawing fades back under the glyphs. */
const BEHIND = 0.12;
/** Seconds each glyph takes to come in or go, and the spread of their starts. */
const FADE = 0.18;
const SPREAD = { in: 0.35, out: 0.3 };

type Glyph = {
  x: number;
  y: number;
  shade: number;
  now: number;
  green: boolean;
  delayIn: number;
  delayOut: number;
};

/* The drawing, as it stands, as an image the size of its frame. */
async function snapshot(svg: SVGSVGElement, width: number, height: number) {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute("width", String(width));
  copy.setAttribute("height", String(height));
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const source = new XMLSerializer().serializeToString(copy);
  const image = new Image();
  image.decoding = "async";
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;
  await image.decode();
  return image;
}

/* Reads the image cell by cell into glyphs. */
function read(image: HTMLImageElement, width: number, height: number) {
  const columns = Math.floor(width / CELL.w);
  const rows = Math.floor(height / CELL.h);
  const sampler = document.createElement("canvas");
  sampler.width = columns;
  sampler.height = rows;
  const pen = sampler.getContext("2d", { willReadFrequently: true });
  if (!pen) return [];
  pen.drawImage(image, 0, 0, columns, rows);
  const { data } = pen.getImageData(0, 0, columns, rows);
  const glyphs: Glyph[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const i = (row * columns + column) * 4;
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
      /* Anything the drawing paints, white faces included, becomes a
         glyph, so shapes read solid; the empty frame stays empty. */
      if (a < 40) continue;
      const light = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const green = g > r + 25 && g > b + 25;
      /* The drawings are pale, so their shades are stretched across the
         ramp rather than read as they are; white faces get the lightest
         visible glyph. */
      const dark = Math.min(1, (1 - light) * 7);
      const shade = 2 + Math.round(dark * (RAMP.length - 3));
      glyphs.push({
        x: (column + 0.5) * CELL.w,
        y: (row + 0.5) * CELL.h,
        shade,
        now: shade,
        green,
        delayIn: Math.random() * SPREAD.in,
        delayOut: Math.random() * SPREAD.out,
      });
    }
  }
  return glyphs;
}

/**
 * Turns `visual`'s drawing to ASCII while it is hovered. `busy` says when
 * the drawing is doing something of its own (its intro) and should be left
 * alone. Returns a function that undoes everything.
 */
export function asciiHover(visual: HTMLElement, busy: () => boolean): () => void {
  const svg = visual.querySelector<SVGSVGElement>("svg");
  if (!svg) return () => {};
  const canvas = document.createElement("canvas");
  canvas.className = "problems-main_ascii";
  canvas.setAttribute("aria-hidden", "true");
  svg.after(canvas);
  const context = canvas.getContext("2d");

  let glyphs: Glyph[] = [];
  let enteredAt = -1;
  let leftAt = -1;
  let running = false;
  let token = 0;

  const draw = () => {
    if (!context) return;
    const now = gsap.ticker.time;
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
    context.font = `${CELL.h}px ui-monospace, monospace`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    /* A few glyphs a frame flicker to a neighbour on the ramp. */
    for (let n = Math.ceil(glyphs.length / 25); n > 0; n--) {
      const glyph = glyphs[Math.floor(Math.random() * glyphs.length)];
      if (glyph)
        glyph.now = Math.min(
          RAMP.length - 1,
          Math.max(1, glyph.shade + Math.round(Math.random() * 2 - 1)),
        );
    }
    let visible = 0;
    for (const glyph of glyphs) {
      let alpha = Math.min(1, Math.max(0, (now - enteredAt - glyph.delayIn) / FADE));
      if (leftAt > 0)
        alpha *= 1 - Math.min(1, Math.max(0, (now - leftAt - glyph.delayOut) / FADE));
      if (alpha <= 0.01) continue;
      visible++;
      context.globalAlpha = alpha;
      context.fillStyle = glyph.green ? ACCENT : GREY;
      context.fillText(RAMP[glyph.now], glyph.x, glyph.y);
    }
    context.globalAlpha = 1;
    if (leftAt > 0 && visible === 0) stop();
  };

  const start = () => {
    if (running) return;
    running = true;
    gsap.ticker.add(draw);
  };
  const stop = () => {
    running = false;
    gsap.ticker.remove(draw);
    context?.clearRect(0, 0, canvas.width, canvas.height);
    glyphs = [];
  };

  const onEnter = () => {
    if (busy()) return;
    const mine = ++token;
    const { width, height } = svg.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    snapshot(svg, width, height)
      .then((image) => {
        if (mine !== token) return;
        glyphs = read(image, width, height);
        enteredAt = gsap.ticker.time;
        leftAt = -1;
        gsap.to(svg, { opacity: BEHIND, duration: 0.35, ease: "power2.out", overwrite: true });
        start();
      })
      .catch(() => {});
  };

  const onLeave = () => {
    token++;
    if (!running) return;
    leftAt = gsap.ticker.time;
    gsap.to(svg, { opacity: 1, duration: 0.45, ease: "power2.inOut", overwrite: true });
  };

  visual.addEventListener("pointerenter", onEnter);
  visual.addEventListener("pointerleave", onLeave);

  return () => {
    visual.removeEventListener("pointerenter", onEnter);
    visual.removeEventListener("pointerleave", onLeave);
    stop();
    gsap.killTweensOf(svg);
    gsap.set(svg, { clearProps: "opacity" });
    canvas.remove();
  };
}
