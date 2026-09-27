/**
 * Renders a 3D model as glyphs: rays marched through a signed-distance field,
 * lit, dithered onto the page's one glyph grid, and fitted so the whole model
 * stays inside its canvas from every angle it can be turned to. Each ASCII
 * model component describes only its shape, colours and extras in a
 * `ModelSpec`; drag-to-rotate, the idle spin, pausing off screen and sizing
 * all happen here.
 */
import { onPage } from "@/utils/lifecycle.ts";
import {
  GLYPH,
  mix,
  toRgb,
  glyphForSize,
  pageGlyph,
  measureRamp,
  pickGlyph,
  createController,
  createOrbit,
  rotation,
  LIGHT,
  HALF,
  KEY,
  readLook,
  allowsMotion,
  type Rgb,
  type Look,
} from "@/utils/ascii.ts";

/** A glyph's colour and brightness, 0–1. */
export type Paint = { color: Rgb; brightness: number };

/** The glyph grid a model is drawn on, for extras drawn over it. */
export type Grid = {
  context: CanvasRenderingContext2D;
  cols: number;
  rows: number;
  cw: number;
  ch: number;
  ox: number;
  oy: number;
  font: string;
  ramp: string[];
  coverage: number[];
  /** Model units to pixels, and the canvas centre the model turns about. */
  scale: number;
  centerX: number;
  centerY: number;
};

export type ModelSpec = {
  /** The farthest any part of the model sits from the point it turns about. */
  radius: number;
  /** The point it turns about, in model units. Defaults to the origin. */
  pivot?: [number, number, number];
  restYaw: number;
  restTilt: number;
  /** Signed distance to the model's surface, in model units. */
  field(x: number, y: number, z: number): number;
  /** Runs before each frame is traced, for anything that moves inside the model. */
  frame?(time: number): void;
  /** Surfaces that glow flat rather than take light, such as a screen: fills
      `paint` and returns true. Everything else is lit. */
  glow?(x: number, y: number, z: number, time: number, paint: Paint): boolean;
  /** Colour of a lit surface at a point. Defaults to the look's body colour. */
  tint?(x: number, y: number, z: number): Rgb;
  /** Drawn over the model each frame, on the same glyph grid. */
  overlay?(grid: Grid, time: number): void;
  /** Model time, in ms, shown when there's no motion. */
  stillTime?: number;
};

/** Distance to a box of half-extents (hx, hy, hz) with edges rounded by r. */
export function roundBox(
  x: number,
  y: number,
  z: number,
  hx: number,
  hy: number,
  hz: number,
  r: number,
) {
  const qx = Math.abs(x) - hx + r;
  const qy = Math.abs(y) - hy + r;
  const qz = Math.abs(z) - hz + r;
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  const az = Math.max(qz, 0);
  return (
    Math.sqrt(ax * ax + ay * ay + az * az) +
    Math.min(Math.max(qx, Math.max(qy, qz)), 0) -
    r
  );
}

/** A flat 2D shape at distance `d2` extruded along z to half-thickness h. */
export function extrude(d2: number, z: number, h: number) {
  const dz = Math.abs(z) - h;
  const a = Math.max(d2, 0);
  const b = Math.max(dz, 0);
  return Math.min(Math.max(d2, dz), 0) + Math.sqrt(a * a + b * b);
}

const CAM = 9;
const LIT = 1;
const GLOWING = 2;
const HIGHLIGHT: Rgb = [255, 255, 250];

export function createModelView(
  canvas: HTMLCanvasElement,
  look: Look,
  motion: boolean,
  spec: ModelSpec,
) {
  const context = canvas.getContext("2d");
  const controller = createController(canvas);
  if (!context) return () => controller.destroy();

  const body = toRgb(look.body);
  const [px0, py0, pz0] = spec.pivot ?? [0, 0, 0];
  const bound = spec.radius + 0.05;
  /* Follows the hero cube's glyph size when the page has one. */
  const follows = !!document.querySelector(".ascii-stage_cubes");

  let width = 0;
  let height = 0;
  let grid: Grid | null = null;
  let brightness = new Float32Array(0);
  let specular = new Float32Array(0);
  let depth = new Float32Array(0);
  let kind = new Uint8Array(0);
  let colors: Rgb[] = [];
  let R = rotation(spec.restYaw, spec.restTilt);
  const paint: Paint = { color: body, brightness: 0 };

  /* A view-space point in the model's own coordinates. */
  const toModel = (x: number, y: number, z: number): Rgb => [
    R[0] * x + R[3] * y + R[6] * z + px0,
    R[1] * x + R[4] * y + R[7] * z + py0,
    R[2] * x + R[5] * y + R[8] * z + pz0,
  ];
  const field = (x: number, y: number, z: number) => {
    const [mx, my, mz] = toModel(x, y, z);
    return spec.field(mx, my, mz);
  };

  function scene(time: number) {
    if (!grid) return;
    const { cols, rows, cw, ch, ox, oy, scale, centerX, centerY } = grid;
    spec.frame?.(time);
    R = rotation(spec.restYaw + orbit.yaw(), spec.restTilt + orbit.pitch());
    kind.fill(0);
    const e = 0.004;
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const X = (ox + gx * cw + cw / 2 - centerX) / scale;
        const Y = (centerY - (oy + gy * ch + ch / 2)) / scale;
        const rl = Math.sqrt(X * X + Y * Y + CAM * CAM);
        const rx = X / rl;
        const ry = Y / rl;
        const rz = -CAM / rl;
        /* Only march rays that enter the sphere around the model. */
        const b = CAM * rz;
        const disc = b * b - (CAM * CAM - bound * bound);
        if (disc < 0) continue;
        const root = Math.sqrt(disc);
        let t = -b - root;
        const far = -b + root;
        let found = false;
        let px = 0;
        let py = 0;
        let pz = 0;
        for (let step = 0; step < 64 && t < far; step++) {
          px = rx * t;
          py = ry * t;
          pz = CAM + rz * t;
          const d = field(px, py, pz);
          if (d < 0.003) {
            found = true;
            break;
          }
          t += Math.max(d * 0.85, 0.004);
        }
        if (!found) continue;
        const i = gy * cols + gx;
        const [mx, my, mz] = toModel(px, py, pz);
        depth[i] = pz;
        specular[i] = 0;
        if (spec.glow?.(mx, my, mz, time, paint)) {
          kind[i] = GLOWING;
          brightness[i] = paint.brightness;
          colors[i] = paint.color;
          continue;
        }
        kind[i] = LIT;
        const f1 = field(px + e, py - e, pz - e);
        const f2 = field(px - e, py - e, pz + e);
        const f3 = field(px - e, py + e, pz - e);
        const f4 = field(px + e, py + e, pz + e);
        let nx = f1 - f2 - f3 + f4;
        let ny = -f1 - f2 + f3 + f4;
        let nz = -f1 + f2 - f3 + f4;
        const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nx /= nl;
        ny /= nl;
        nz /= nl;
        const diffuse = Math.max(
          0,
          nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2],
        );
        const spec16 = Math.pow(
          Math.max(0, nx * HALF[0] + ny * HALF[1] + nz * HALF[2]),
          16,
        );
        const wx = R[0] * nx + R[3] * ny + R[6] * nz;
        const wy = R[1] * nx + R[4] * ny + R[7] * nz;
        const wz = R[2] * nx + R[5] * ny + R[8] * nz;
        const tone = 0.5 + 0.5 * (wx * KEY[0] + wy * KEY[1] + wz * KEY[2]);
        brightness[i] = Math.min(
          1,
          0.04 + 0.5 * tone + 0.16 * diffuse + 0.25 * spec16,
        );
        specular[i] = spec16;
        colors[i] = spec.tint?.(mx, my, mz) ?? body;
      }
    }
    /* Silhouette and fold edges read brighter, as on the cube. */
    const total = cols * rows;
    for (let i = 0; i < total; i++) {
      if (kind[i] !== LIT) continue;
      for (const j of [i - 1, i + 1, i - cols, i + cols]) {
        if (j < 0 || j >= total) continue;
        if (!kind[j] || Math.abs(depth[j] - depth[i]) > 0.12) {
          brightness[i] = Math.max(brightness[i], 0.5);
          break;
        }
      }
    }
  }

  function draw(time: number) {
    if (!context || !grid) return;
    const { cols, rows, cw, ch, ox, oy, font, ramp, coverage } = grid;
    context.clearRect(0, 0, width, height);
    context.font = font;
    context.textBaseline = "top";
    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const i = gy * cols + gx;
        const k = kind[i];
        if (!k) continue;
        const b = brightness[i];
        let color = colors[i];
        if (k === LIT && specular[i] > 0.3) {
          color = mix(
            color,
            HIGHLIGHT,
            Math.min(1, (specular[i] - 0.3) * 1.3) * 0.7,
          );
        }
        const glyphChar = pickGlyph(ramp, coverage, b, gx, gy);
        if (glyphChar === " ") continue;
        /* Glowing surfaces keep their full colour; lit ones are shaded. */
        const lum = k === GLOWING ? 1 : 0.55 + 0.45 * b;
        context.fillStyle = `rgb(${(color[0] * lum) | 0},${(color[1] * lum) | 0},${(color[2] * lum) | 0})`;
        context.fillText(glyphChar, ox + gx * cw, oy + gy * ch);
      }
    }
    spec.overlay?.(grid, time);
  }

  /* Drawn at its real size on screen, so glyphs are true pixels, in the
     page's one glyph size. A sphere of the model's radius fits inside the
     canvas, so no angle can push it out; perspective draws that sphere a
     touch larger, and one glyph cell of margin covers glyphs snapping to the
     grid. */
  function configure(
    w: number,
    h: number,
    glyph = follows ? pageGlyph.size : glyphForSize(Math.min(w, h)),
  ) {
    if (!context) return;
    width = Math.max(160, Math.round(w));
    height = Math.max(160, Math.round(h));
    const cw = glyph * GLYPH.cellW;
    const ch = glyph * GLYPH.cellH;
    const cols = Math.floor(width / cw);
    const rows = Math.floor(height / ch);
    const font = `${glyph}px ${look.font}`;
    const projected =
      (spec.radius * CAM) / Math.sqrt(CAM * CAM - spec.radius * spec.radius);
    grid = {
      context,
      cols,
      rows,
      cw,
      ch,
      ox: (width - cols * cw) / 2,
      oy: (height - rows * ch) / 2,
      font,
      ...measureRamp(font, cw, ch),
      scale: (Math.min(width, height) - 2 * ch) / (2 * projected),
      centerX: width / 2,
      centerY: height / 2,
    };
    const n = cols * rows;
    brightness = new Float32Array(n);
    specular = new Float32Array(n);
    depth = new Float32Array(n);
    kind = new Uint8Array(n);
    colors = new Array<Rgb>(n);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!follows) pageGlyph.set(glyph);
  }
  let measured = { w: 0, h: 0 };
  function watchSize() {
    const rect = canvas.getBoundingClientRect();
    if (
      Math.abs(rect.width - measured.w) < 1 &&
      Math.abs(rect.height - measured.h) < 1
    )
      return;
    measured = { w: rect.width, h: rect.height };
    configure(rect.width, rect.height);
  }
  const onGlyph = () => {
    if (!measured.w) return;
    configure(measured.w, measured.h);
    still();
  };
  if (follows) pageGlyph.listeners.add(onGlyph);

  /* Its own clock, so after a pause the model carries on where it was. */
  let frame = 0;
  let simTime = motion ? 0 : (spec.stillTime ?? 2600);
  let lastNow = 0;
  let lastStep = -1e9;
  function render() {
    scene(simTime / 1000);
    draw(simTime / 1000);
  }
  function loop(now: number) {
    frame = requestAnimationFrame(loop);
    simTime += Math.min(100, now - lastNow);
    lastNow = now;
    if (simTime - lastStep < 42) return;
    const dt = Math.min(0.1, (simTime - lastStep) / 1000);
    lastStep = simTime;
    orbit.step(dt);
    render();
  }
  function play() {
    if (!motion || frame || !controller.running()) return;
    lastNow = performance.now();
    frame = requestAnimationFrame(loop);
  }
  function pause() {
    cancelAnimationFrame(frame);
    frame = 0;
  }
  function still() {
    if (frame || !grid) return;
    render();
  }
  const orbit = createOrbit(canvas, motion, spec.restTilt, () => still());

  watchSize();
  const observer = new ResizeObserver(() => {
    watchSize();
    still();
  });
  observer.observe(canvas);
  still();
  controller.onChange((running) => (running ? play() : pause()));
  play();

  return () => {
    pause();
    observer.disconnect();
    orbit.destroy();
    controller.destroy();
    pageGlyph.listeners.delete(onGlyph);
  };
}

/**
 * Starts a model in every `wrapSelector` element on each page, drawn into its
 * `canvasSelector` canvas once the glyph font has loaded, and stops it before
 * the page is replaced. `makeSpec` runs once per model, with the colours and
 * font read from its element and the element itself, so each has its own
 * state.
 */
export function mountModels(
  wrapSelector: string,
  canvasSelector: string,
  makeSpec: (look: Look, wrap: HTMLElement) => ModelSpec,
) {
  const started = new WeakMap<HTMLElement, () => void>();

  function start(wrap: HTMLElement) {
    const canvas = wrap.querySelector<HTMLCanvasElement>(canvasSelector);
    if (!canvas) return () => {};
    const look = readLook(wrap);
    let stop: (() => void) | null = null;
    let stopped = false;
    document.fonts
      .load(`12px ${look.font}`)
      .catch(() => {})
      .then(() => {
        if (!stopped) {
          stop = createModelView(
            canvas,
            look,
            allowsMotion(),
            makeSpec(look, wrap),
          );
        }
      });
    return () => {
      stopped = true;
      stop?.();
    };
  }

  onPage(() => {
    const wraps = [
      ...document.querySelectorAll<HTMLElement>(wrapSelector),
    ].filter((wrap) => !started.has(wrap));
    for (const wrap of wraps) started.set(wrap, start(wrap));

    return () => {
      for (const wrap of wraps) {
        started.get(wrap)?.();
        started.delete(wrap);
      }
    };
  });
}
