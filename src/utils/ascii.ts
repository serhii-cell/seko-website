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

/* 8px glyphs from a 440px model up, where a bigger model gets more glyphs
   rather than bigger ones, and scaled down below that, never under 6px.
   Cells keep the 8 × 14 proportion of the original 12px grid. */
export const GLYPH = {
  max: 8,
  min: 6,
  fullAt: 440,
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
 * Models turn a little either way of their resting angle and back, so their
 * face is always toward the viewer: a sway of this many radians each side,
 * one full swing every ~12s.
 */
export const SWAY = 0.3;
export const sway = (time: number) => SWAY * Math.sin(time * 0.52);

/** The tint the torch pushes lit glyphs toward. */
const TORCH_LIGHT: Rgb = [255, 255, 240];

/**
 * The cursor as a torch over `area`: glyphs near it on `canvas` get denser and
 * brighter, fading out smoothly with distance. Its position and strength ease
 * toward the pointer, so the light glides and fades rather than snapping.
 * Only for a mouse; does nothing without motion.
 */
export function createTorch(
  area: HTMLElement,
  canvas: HTMLCanvasElement,
  motion: boolean,
) {
  const torch = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    strength: 0,
    on: false,
    /* Spread of the light, in px: most of it falls within 2.5× this. */
    spread: 72,
  };
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  function onPointerMove(event: PointerEvent) {
    if (!fine.matches || event.pointerType !== "mouse") return;
    const rect = canvas.getBoundingClientRect();
    torch.targetX = event.clientX - rect.left;
    torch.targetY = event.clientY - rect.top;
    if (!torch.on && torch.strength < 0.01) {
      torch.x = torch.targetX;
      torch.y = torch.targetY;
    }
    torch.on = true;
  }
  function onPointerLeave() {
    torch.on = false;
  }
  if (motion) {
    area.addEventListener("pointermove", onPointerMove);
    area.addEventListener("pointerleave", onPointerLeave);
  }
  const reach = () => 2 * torch.spread * torch.spread;

  return {
    step(dt: number) {
      const follow = 1 - Math.exp(-dt * 10);
      torch.x += (torch.targetX - torch.x) * follow;
      torch.y += (torch.targetY - torch.y) * follow;
      const fade = 1 - Math.exp(-dt * (torch.on ? 6 : 3));
      torch.strength += ((torch.on ? 1 : 0) - torch.strength) * fade;
      if (torch.strength < 0.002) torch.strength = 0;
    },
    /** Whether any light is falling at all, to skip the work when not. */
    lit: () => torch.strength > 0,
    /**
     * A glyph of brightness `b` and colour `color` centred at (x, y) on the
     * canvas, lit by the torch: returns its brightness, colour and the extra
     * luminance to draw it with.
     */
    light(x: number, y: number, b: number, color: Rgb) {
      const dx = x - torch.x;
      const dy = y - torch.y;
      const glow = torch.strength * Math.exp(-(dx * dx + dy * dy) / reach());
      if (glow <= 0.004) return { b, color, boost: 0 };
      return {
        b: Math.min(1, b + 0.4 * glow),
        color: mix(color, TORCH_LIGHT, 0.55 * glow),
        boost: 0.3 * glow,
      };
    },
    destroy() {
      area.removeEventListener("pointermove", onPointerMove);
      area.removeEventListener("pointerleave", onPointerLeave);
    },
  };
}
