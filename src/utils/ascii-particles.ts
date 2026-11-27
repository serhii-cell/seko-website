/**
 * Rising ASCII particles on a canvas, in the accent colour: each one a bright
 * head glyph with a soft glow, trailing a dotted column of fainter glyphs
 * below it, set on a character grid. They rise from the bottom edge at their
 * own speeds and fade out at their own heights, so they gather low and thin
 * out toward the top.
 *
 * `asciiParticles(canvas)` returns `start` and `stop`; it only runs between
 * them. With reduced motion it draws one still frame instead.
 */

/** One character cell, in CSS px. */
const CELL = { w: 9, h: 13 };
/** Simulation steps per second. */
const RATE = 30;
/** Particles alive at once, per 1000 CSS px of width. */
const DENSITY = 75;
/** Rising speed, in CSS px per second. */
const SPEED = { min: 45, max: 230 };
/** Trail length, in cells, for the slowest and the fastest. */
const TRAIL = { min: 10, max: 46 };
/** Trail glyphs from the head down: dotted, as in a long exposure. */
const TRAIL_GLYPHS = ":.:.'.:.";
/** Head glyphs. */
const HEADS = "+*x";
/** Share of heads drawn pale, almost white. */
const PALE = 0.25;

type Particle = {
  column: number;
  y: number;
  speed: number;
  trail: number;
  /** Height (from the bottom, as a share of the canvas) where it is gone. */
  reach: number;
  head: number;
  pale: boolean;
  phase: number;
};

/* Glyph sprites: the trail glyphs and heads in the accent, the heads again
   pale, and a soft glow dot to set under each head. */
function sprites(accent: string, pale: string, font: string, dpr: number) {
  const w = Math.ceil(CELL.w * dpr);
  const h = Math.ceil(CELL.h * dpr);
  const glow = Math.ceil(CELL.h * 2.2 * dpr);
  const chars = TRAIL_GLYPHS + HEADS;
  const canvas = document.createElement("canvas");
  canvas.width = w * chars.length + glow;
  canvas.height = Math.max(h * 2, glow);
  const context = canvas.getContext("2d");
  if (context) {
    context.font = `${Math.round(CELL.h * 0.82 * dpr)}px ${font}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    [accent, pale].forEach((colour, row) => {
      context.fillStyle = colour;
      [...chars].forEach((char, i) => context.fillText(char, i * w + w / 2, row * h + h / 2));
    });
    const cx = w * chars.length + glow / 2;
    const gradient = context.createRadialGradient(cx, glow / 2, 0, cx, glow / 2, glow / 2);
    gradient.addColorStop(0, accent);
    gradient.addColorStop(1, "transparent");
    context.globalAlpha = 0.7;
    context.fillStyle = gradient;
    context.fillRect(cx - glow / 2, 0, glow, glow);
  }
  return { canvas, w, h, glow, glowX: w * chars.length };
}

/* Mixes two #rrggbb colours. */
function mix(a: string, b: string, share: number) {
  const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return a;
  const [x, y] = [parse(a), parse(b)];
  return `rgb(${x.map((v, k) => Math.round(v + (y[k] - v) * share)).join(",")})`;
}

export function asciiParticles(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const style = getComputedStyle(document.documentElement);
  const accent = style.getPropertyValue("--brand-500").trim() || "#7bd52d";
  const light = style.getPropertyValue("--light-100").trim() || "#f4f4f4";
  const pale = mix(accent, light, 0.6);
  const font = style.getPropertyValue("--mono-family").trim() || "monospace";

  let columns = 0;
  let particles: Particle[] = [];
  let atlas: ReturnType<typeof sprites> | null = null;
  let dpr = 0;
  let width = 0;
  let height = 0;
  let frame = 0;
  let last = 0;
  let carry = 0;
  let time = 0;
  let running = false;
  /* The last size laid out, to skip reports that change nothing. */
  let laid = "";

  const born = (anywhere: boolean): Particle => {
    const speed = SPEED.min + Math.random() ** 1.6 * (SPEED.max - SPEED.min);
    const share = (speed - SPEED.min) / (SPEED.max - SPEED.min);
    const reach = 0.3 + Math.random() * 0.75;
    return {
      column: Math.floor(Math.random() * columns),
      /* From just below the bottom edge, or (to fill a first frame)
         anywhere along its way. */
      y: anywhere ? height - Math.random() * height * reach : height + Math.random() * CELL.h * 6,
      speed,
      trail: Math.round(TRAIL.min + share * (TRAIL.max - TRAIL.min) * (0.6 + Math.random() * 0.4)),
      reach,
      head: Math.floor(Math.random() * HEADS.length),
      pale: Math.random() < PALE,
      phase: Math.random() * Math.PI * 2,
    };
  };

  function size() {
    const nextDpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return false;
    const key = `${w}x${h}@${nextDpr}`;
    if (key === laid) return true;
    laid = key;
    width = w;
    height = h;
    canvas.width = Math.round(w * nextDpr);
    canvas.height = Math.round(h * nextDpr);
    columns = Math.ceil(w / CELL.w);
    /* Particles carry over a resize; any past the new width go. */
    particles = particles.filter((p) => p.column < columns);
    if (nextDpr !== dpr || !atlas) {
      dpr = nextDpr;
      atlas = sprites(accent, pale, font, dpr);
    }
    if (running) draw();
    return true;
  }

  function step(dt: number) {
    time += dt;
    const target = Math.round((DENSITY * width) / 1000);
    /* A few new ones a step, so they arrive as a trickle, not a wave. */
    for (let k = 0; k < 3 && particles.length < target; k++) particles.push(born(false));
    particles = particles.filter((p) => {
      p.y -= p.speed * dt;
      const risen = (height - p.y) / height;
      return risen < p.reach + 0.05 && p.y + p.trail * CELL.h > 0;
    });
  }

  function draw() {
    if (!context || !atlas) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    const { w, h, glow, glowX } = atlas;
    const cw = CELL.w * dpr;
    const ch = CELL.h * dpr;
    for (const p of particles) {
      const risen = (height - p.y) / height;
      /* In over the first stretch, out over the last third of its reach. */
      const fadeIn = Math.min(1, risen / 0.06);
      const fadeOut = Math.max(0, Math.min(1, (p.reach - risen) / (p.reach * 0.35)));
      const life = fadeIn * fadeOut;
      if (life <= 0) continue;
      const row = Math.floor(p.y / CELL.h);
      const x = p.column * cw;
      const twinkle = 0.75 + 0.25 * Math.sin(time * 9 + p.phase);
      /* The trail, below the head, dotted and fading with distance. */
      for (let k = 1; k <= p.trail; k++) {
        const y = (row + k) * ch;
        if (y > canvas.height) break;
        const fade = (1 - k / (p.trail + 1)) ** 1.15;
        context.globalAlpha = life * fade * 0.8;
        const glyph = (k + p.column) % TRAIL_GLYPHS.length;
        context.drawImage(atlas.canvas, glyph * w, 0, w, h, x, y, cw, ch);
      }
      /* The glow, then the head. */
      context.globalAlpha = life * 0.8 * twinkle;
      context.drawImage(atlas.canvas, glowX, 0, glow, glow, x + cw / 2 - glow / 2, row * ch + ch / 2 - glow / 2, glow, glow);
      context.globalAlpha = life * twinkle;
      const head = TRAIL_GLYPHS.length + p.head;
      context.drawImage(atlas.canvas, head * w, p.pale ? h : 0, w, h, x, row * ch, cw, ch);
    }
    context.globalAlpha = 1;
  }

  function tick(now: number) {
    if (!running) return;
    frame = requestAnimationFrame(tick);
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / RATE;
    last = now;
    carry += dt;
    if (carry < 1 / RATE) return;
    const steps = Math.min(3, Math.floor(carry * RATE));
    carry -= steps / RATE;
    for (let k = 0; k < steps; k++) step(1 / RATE);
    draw();
  }

  /* A full field straight away: particles already on their way up. */
  function fill() {
    const target = Math.round((DENSITY * width) / 1000);
    particles = Array.from({ length: target }, () => born(true));
    draw();
  }

  const resize = new ResizeObserver(() => {
    if (!running) return;
    const before = laid;
    if (size() && laid !== before && reduce.matches) fill();
  });

  return {
    start() {
      if (running || !context) return;
      running = true;
      if (!size()) {
        running = false;
        return;
      }
      resize.observe(canvas);
      fill();
      if (reduce.matches) return;
      last = 0;
      carry = 0;
      frame = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      cancelAnimationFrame(frame);
      resize.disconnect();
    },
  };
}
