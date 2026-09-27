/**
 * The shared engine behind the ASCII visuals: the glyph rule, glyph ramps,
 * dithering, the play/pause controller and drag-to-rotate. Each visual is its
 * own component; what they must agree on lives here, so every ASCII effect on
 * a page draws its glyphs at one size.
 */

export type Rgb = [number, number, number];
export type Engine = { play(): void; pause(): void; destroy(): void };
export type Controller = {
  running(): boolean;
  onChange(listener: (running: boolean) => void): void;
  destroy(): void;
};
export type Look = {
  glyph: string;
  accent: string;
  body: string;
  screen: string;
  font: string;
};

/* 12px glyphs from a 720px model up, where a bigger model gets more glyphs
   rather than bigger ones, and scaled down below that, never under 6px.
   Cells keep the 8 × 14 proportion of the 12px grid. */
export const GLYPH = {
  max: 12,
  min: 6,
  fullAt: 720,
  cellW: 8 / 12,
  cellH: 14 / 12,
};
export const GLYPHS = " .:-'^~=+*ctxowq#M%@";
export const BAYER = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const mix = (a: Rgb, b: Rgb, u: number): Rgb => [
  a[0] + (b[0] - a[0]) * u,
  a[1] + (b[1] - a[1]) * u,
  a[2] + (b[2] - a[2]) * u,
];

/** A view rotation — yaw about y, then tilt about x — as a row-major 3 × 3 matrix. */
export function rotation(yaw: number, tilt: number) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  return [cy, 0, sy, st * sy, ct, -st * cy, -ct * sy, st, ct * cy];
}

const normalize = (v: number[]) => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return v.map((c) => c / l) as Rgb;
};
/* A light from the viewer's upper left for shading and highlights, and a key
   light fixed to the model, so its faces read top brightest, then right,
   front, left, back, bottom darkest from any angle. */
export const LIGHT = normalize([-0.45, 0.7, 0.55]);
export const HALF = normalize([LIGHT[0], LIGHT[1], LIGHT[2] + 1]);
export const KEY = normalize([0.33, 0.84, 0.43]);

/** The glyph size for a model drawn `size` px wide, rounded to 0.25px. */
export const glyphForSize = (size: number) =>
  Math.round(
    clamp((GLYPH.max * size) / GLYPH.fullAt, GLYPH.min, GLYPH.max) * 4,
  ) / 4;

/**
 * The page's one glyph size. The hero cube leads it; every other ASCII visual
 * follows, and only sets it itself when the page has no hero cube.
 */
export const pageGlyph = {
  size: GLYPH.max,
  listeners: new Set<(size: number) => void>(),
  set(size: number) {
    if (Math.abs(size - pageGlyph.size) < 0.01) return;
    pageGlyph.size = size;
    pageGlyph.listeners.forEach((listener) => listener(size));
  },
};

export function toRgb(color: string): Rgb {
  const probe = document.createElement("canvas").getContext("2d");
  if (!probe) return [255, 255, 255];
  probe.fillStyle = color;
  const hex = probe.fillStyle.replace("#", "");
  return [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16) || 0) as Rgb;
}

/** Colours and font from the component's own custom properties. */
export function readLook(element: HTMLElement): Look {
  const style = getComputedStyle(element);
  const read = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  return {
    glyph: read("--_glyph", "#2a2a2a"),
    accent: read("--_accent", "#79d12d"),
    body: read("--_body", "#e8e8e3"),
    screen: read("--_screen", "#2e43d1"),
    font: read("--_glyph-font", "monospace"),
  };
}

/** Animation is off for reduced motion and in Lumos's visual designer. */
export const allowsMotion = () =>
  !matchMedia("(prefers-reduced-motion: reduce)").matches &&
  !document.documentElement.classList.contains("stacki-designer");

/**
 * Glyphs ordered by the ink each one measures at this font and cell size,
 * with their coverage normalised to 0–1.
 */
export function measureRamp(font: string, cw: number, ch: number) {
  const probe = document.createElement("canvas");
  probe.width = cw;
  probe.height = ch;
  const g = probe.getContext("2d", { willReadFrequently: true });
  const ramp: string[] = [];
  const coverage: number[] = [];
  if (!g) return { ramp: [" "], coverage: [0] };
  g.font = font;
  g.textBaseline = "top";
  g.fillStyle = "#fff";
  const measured: [number, string][] = [];
  for (const glyphChar of GLYPHS) {
    g.clearRect(0, 0, cw, ch);
    g.fillText(glyphChar, 0, 0);
    const data = g.getImageData(0, 0, probe.width, probe.height).data;
    let sum = 0;
    for (let i = 3; i < data.length; i += 4) sum += data[i];
    measured.push([sum / 255 / (cw * ch), glyphChar]);
  }
  measured.sort((a, b) => a[0] - b[0]);
  let last = -1;
  for (const [value, glyphChar] of measured) {
    if (value - last > 0.006) {
      ramp.push(glyphChar);
      coverage.push(value);
      last = value;
    }
  }
  const max = coverage[coverage.length - 1] || 1;
  return { ramp, coverage: coverage.map((value) => value / max) };
}

/** The glyph for brightness `b` in cell (x, y), dithered with the Bayer grid. */
export function pickGlyph(
  ramp: string[],
  coverage: number[],
  b: number,
  x: number,
  y: number,
) {
  const n = ramp.length;
  let position = n - 1;
  if (b < 1) {
    let i = 1;
    while (i < n && coverage[i] < b) i++;
    position = i - 1 + (b - coverage[i - 1]) / (coverage[i] - coverage[i - 1]);
  }
  return ramp[
    Math.min(n - 1, Math.floor(position + (BAYER[y & 7][x & 7] + 0.5) / 64))
  ];
}

/* Effects run only while their element is on screen, with a 200px margin, and
   start animating once the page has loaded and the browser is idle, so the
   work stays out of the load that performance tools measure. */
export function createController(element: HTMLElement): Controller {
  let visible = true;
  let started = false;
  let idle = 0;
  let timer = 0;
  const listeners = new Set<(running: boolean) => void>();
  const notify = () =>
    listeners.forEach((listener) => listener(started && visible));

  const observer = new IntersectionObserver(
    (entries) => {
      const now = entries.some((entry) => entry.isIntersecting);
      if (now === visible) return;
      visible = now;
      notify();
    },
    { rootMargin: "200px 0px" },
  );
  observer.observe(element);

  const begin = () => {
    timer = window.setTimeout(() => {
      started = true;
      notify();
    }, 250);
  };
  const whenLoaded = () => {
    if ("requestIdleCallback" in window) {
      idle = requestIdleCallback(begin, { timeout: 1500 });
    } else {
      timer = self.setTimeout(begin, 300);
    }
  };
  if (document.readyState === "complete") whenLoaded();
  else addEventListener("load", whenLoaded, { once: true });

  return {
    running: () => started && visible,
    onChange: (listener) => listeners.add(listener),
    destroy() {
      observer.disconnect();
      removeEventListener("load", whenLoaded);
      if (idle && "cancelIdleCallback" in window) cancelIdleCallback(idle);
      clearTimeout(timer);
      listeners.clear();
    },
  };
}

/**
 * Drag to orbit a model while it keeps animating. It spins slowly on its own;
 * a horizontal drag turns it and the turn is kept on release, folded into the
 * spin; a vertical drag tilts it and the tilt eases back to the resting angle,
 * taking longer the further it went. `redraw` runs on every drag move so a
 * still model follows the pointer too.
 */
export function createOrbit(
  canvas: HTMLCanvasElement,
  motion: boolean,
  restingTilt: number,
  redraw: () => void,
) {
  const drag = {
    yaw: 0,
    pitch: 0,
    active: false,
    lastX: 0,
    lastY: 0,
    sensitivity: 0.006,
  };
  const spin = { yaw: 0, speed: motion ? -0.24 : 0 };
  const settle = { minDuration: 0.6, perRadian: 0.35, maxDuration: 1.6 };
  let tiltReturn: { from: number; t: number; duration: number } | null = null;
  const easeInOutCubic = (u: number) =>
    u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;

  function onPointerDown(event: PointerEvent) {
    drag.active = true;
    tiltReturn = null;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      /* A pointer that can't be captured still drags while over the canvas. */
    }
    canvas.classList.add("dragging");
  }
  function onPointerMove(event: PointerEvent) {
    if (!drag.active) return;
    drag.yaw += (event.clientX - drag.lastX) * drag.sensitivity;
    drag.pitch = clamp(
      drag.pitch + (event.clientY - drag.lastY) * drag.sensitivity,
      -1.35 - restingTilt,
      1.35 - restingTilt,
    );
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    redraw();
  }
  function onPointerUp() {
    if (!drag.active) return;
    drag.active = false;
    canvas.classList.remove("dragging");
    spin.yaw += drag.yaw;
    drag.yaw = 0;
    const from = drag.pitch;
    if (!motion || Math.abs(from) < 1e-3) {
      drag.pitch = 0;
      tiltReturn = null;
    } else {
      tiltReturn = {
        from,
        t: 0,
        duration: Math.min(
          settle.maxDuration,
          settle.minDuration + settle.perRadian * Math.abs(from),
        ),
      };
    }
    redraw();
  }
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  return {
    /** Turn added to the model's own yaw, in radians. */
    yaw: () => spin.yaw + drag.yaw,
    /** Tilt added to the resting tilt, in radians. */
    pitch: () => drag.pitch,
    step(dt: number) {
      if (!drag.active) spin.yaw += spin.speed * dt;
      if (drag.active || !tiltReturn) return;
      tiltReturn.t += dt;
      const u = Math.min(1, tiltReturn.t / tiltReturn.duration);
      drag.pitch = tiltReturn.from * (1 - easeInOutCubic(u));
      if (u >= 1) {
        drag.pitch = 0;
        tiltReturn = null;
      }
    },
    destroy() {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
    },
  };
}
