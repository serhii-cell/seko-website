/**
 * Burning embers in ASCII, in dark greys, rising from the bottom of a canvas:
 * sparks born a little lighter that cool to a deeper grey as they climb,
 * flickering, swaying on a gentle, ever-changing air current but always
 * making their way up. Each is one bold glyph on a character grid, as in a
 * terminal: fast ones read as streaks (`|`, `/`, `\`) leaning the way they
 * move; the rest are mostly `+`, the hotter ones `x`, `*` and `#`. No dots or
 * commas. A soft dark fade rises from the bottom edge so they stay visible
 * whatever page is behind.
 *
 * `asciiParticles(canvas)` returns `start` and `stop`; it only runs between
 * them. With reduced motion it draws one still frame instead.
 */

/** One character cell, in CSS px. Embers sit on this grid. */
const CELL = { w: 10, h: 16 };
/** Embers alive at once: one per this many square CSS px, within bounds. */
const AREA_PER_EMBER = 3500;
const COUNT = { min: 80, max: 640 };
/** Rising speed, in CSS px per second; most are slow. */
const RISE = { min: 26, max: 112 };
/** How long one burns, in seconds. With the speeds, the highest any can
   climb is 60% of what it once was (112 × 5.2 against 150 × 6.5). */
const LIFE = { min: 1.9, max: 5.2 };
/** Faster than this (CSS px per second) an ember shows as a streak. */
const STREAK_SPEED = 82;
/** Some catch light already low on the screen, up to this share of its
   height from the bottom. */
const LOW_START = 0.21;
/** How hard the air sways them sideways, in CSS px per second. */
const SWAY = 30;
/** Heat steps in the colour ramp, from pale and hot to deep and cool. */
const HEAT_STEPS = 7;

/* Sparks by heat, coolest first, then streaks by lean. Thick ones only, no
   dots or commas, so each reads as a solid mark rather than a speck. */
const SPARKS = ["+", "x", "*", "#"];
const STREAKS = { up: "|", right: "/", left: "\\" };
const GLYPHS = [...SPARKS, STREAKS.up, STREAKS.right, STREAKS.left];

type Ember = {
  x: number;
  y: number;
  /** Its own rising speed. */
  rise: number;
  /** Its own slight lean, one way or the other. */
  drift: number;
  age: number;
  life: number;
  /** How hot it is born, 0–1. */
  heat: number;
  phase: number;
  /** How fast it flickers. */
  flicker: number;
  /** Lateral speed last step, to lean its streak. */
  vx: number;
};

/* Parses #rrggbb. */
const rgb = (hex: string) =>
  /^#[0-9a-f]{6}$/i.test(hex)
    ? [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
    : null;

/* The colour at `share` of the way from `a` to `b`. */
const mix = (a: number[], b: number[], share: number) =>
  `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * share)).join(",")})`;

/* The glyph sprites: every glyph in every heat colour, one cell each,
   traced over as well as filled so the strokes come out thicker. */
function sprites(ramp: string[], font: string, dpr: number) {
  const w = Math.ceil(CELL.w * dpr);
  const h = Math.ceil(CELL.h * dpr);
  const canvas = document.createElement("canvas");
  canvas.width = w * GLYPHS.length;
  canvas.height = h * ramp.length;
  const context = canvas.getContext("2d");
  if (context) {
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `600 ${Math.round(13 * dpr)}px ${font}`;
    context.lineWidth = 0.9 * dpr;
    context.lineJoin = "round";
    ramp.forEach((colour, level) => {
      context.fillStyle = colour;
      context.strokeStyle = colour;
      GLYPHS.forEach((glyph, i) => {
        context.fillText(glyph, i * w + w / 2, level * h + h / 2);
        context.strokeText(glyph, i * w + w / 2, level * h + h / 2);
      });
    });
  }
  return { canvas, w, h };
}

export function asciiParticles(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    rgb(style.getPropertyValue(name).trim()) ?? rgb(fallback)!;
  const light = read("--light-100", "#ffffff");
  const grey = read("--dark-700", "#2a2a2a");
  const dark = read("--dark-900", "#121212");
  const font = style.getPropertyValue("--mono-family").trim() || "monospace";
  /* Hot to cool, all quiet dark greys: from a little lighter than dark-700
     down to dark-700 itself. */
  const ramp = Array.from({ length: HEAT_STEPS }, (_, level) => {
    const heat = 1 - level / (HEAT_STEPS - 1);
    return mix(grey, light, heat * 0.16);
  });
  const shade = `rgba(${dark.join(",")},`;

  let embers: Ember[] = [];
  let atlas: ReturnType<typeof sprites> | null = null;
  let dpr = 0;
  let width = 0;
  let height = 0;
  let frame = 0;
  let last = 0;
  let time = Math.random() * 100;
  let running = false;
  /* The last size laid out, to skip reports that change nothing. */
  let laid = "";

  const target = () =>
    Math.round(
      Math.min(COUNT.max, Math.max(COUNT.min, (width * height) / AREA_PER_EMBER)),
    );

  /* A new ember: mostly from just below the bottom edge, some catching light
     already low on the screen. To fill a first frame, anywhere in its life. */
  const born = (midway: boolean): Ember => {
    const rise = RISE.min + Math.random() ** 1.7 * (RISE.max - RISE.min);
    const life = LIFE.min + Math.random() * (LIFE.max - LIFE.min);
    const low = Math.random() < 0.35;
    const ember: Ember = {
      x: Math.random() * width,
      y: low ? height - Math.random() ** 2 * height * LOW_START : height + 6 + Math.random() * 30,
      rise,
      drift: (Math.random() - 0.5) * 16,
      age: 0,
      life,
      heat: 0.7 + Math.random() * 0.3,
      phase: Math.random() * Math.PI * 2,
      flicker: 6 + Math.random() * 10,
      vx: 0,
    };
    if (midway) {
      ember.age = Math.random() * life;
      ember.y -= rise * ember.age * 0.8;
    }
    return ember;
  };

  function size() {
    const nextDpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return false;
    const key = `${w}x${h}@${nextDpr}`;
    if (key === laid) return true;
    laid = key;
    /* Embers carry over a resize, moved with the bottom edge. */
    const shift = height ? h - height : 0;
    embers.forEach((ember) => (ember.y += shift));
    embers = embers.filter((ember) => ember.x < w);
    width = w;
    height = h;
    canvas.width = Math.round(w * nextDpr);
    canvas.height = Math.round(h * nextDpr);
    if (nextDpr !== dpr || !atlas) {
      dpr = nextDpr;
      atlas = sprites(ramp, font, dpr);
    }
    if (running) draw();
    return true;
  }

  /* The air: a slow current that changes from place to place and moment to
     moment, sideways both ways, never one wind. */
  const air = (x: number, y: number) =>
    Math.sin(y * 0.0062 + time * 0.9 + x * 0.0013) * 0.6 +
    Math.sin(x * 0.0041 - time * 0.55 + y * 0.002) * 0.4;

  function step(dt: number) {
    time += dt;
    const wanted = target();
    /* New ones come in steadily as old ones burn out. */
    for (let k = 0; k < 4 && embers.length < wanted; k++) embers.push(born(false));
    embers = embers.filter((ember) => {
      ember.age += dt;
      if (ember.age >= ember.life) return false;
      const k = ember.age / ember.life;
      /* They slow a little as they cool. */
      const up = ember.rise * (0.6 + 0.4 * (1 - k));
      const side = air(ember.x, ember.y) * SWAY + ember.drift;
      ember.vx += (side - ember.vx) * Math.min(1, dt * 2.5);
      ember.x += ember.vx * dt;
      ember.y -= up * dt;
      return ember.y > -CELL.h * 2 && ember.x > -CELL.w * 2 && ember.x < width + CELL.w * 2;
    });
  }

  function draw() {
    if (!context || !atlas) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);

    /* The fire burns on dark, whatever the page behind: a soft dark fade up
       from the bottom edge. */
    const ground = context.createLinearGradient(0, canvas.height, 0, canvas.height * 0.5);
    ground.addColorStop(0, `${shade}0.92)`);
    ground.addColorStop(0.5, `${shade}0.6)`);
    ground.addColorStop(1, `${shade}0)`);
    context.fillStyle = ground;
    context.fillRect(0, canvas.height * 0.5, canvas.width, canvas.height * 0.5);

    const { w, h } = atlas;
    for (const ember of embers) {
      const k = ember.age / ember.life;
      /* Bright as it catches, gone as it burns out. */
      const fade = Math.min(1, ember.age / 0.25) * (1 - k) ** 0.9;
      const flick =
        0.72 + 0.28 * Math.sin(time * ember.flicker + ember.phase) * Math.sin(time * ember.flicker * 1.7 + ember.phase * 2);
      const heat = ember.heat * (1 - k) ** 0.65;
      const level = Math.min(HEAT_STEPS - 1, Math.round((1 - heat) * (HEAT_STEPS - 1)));
      const up = ember.rise * (0.6 + 0.4 * (1 - k));
      /* A streak when fast, leaning the way it moves; otherwise mostly `+`,
         the hottest heavier. */
      const glyph =
        up > STREAK_SPEED
          ? SPARKS.length + (ember.vx / up > 0.22 ? 1 : ember.vx / up < -0.22 ? 2 : 0)
          : Math.min(SPARKS.length - 1, Math.floor(heat ** 2.2 * SPARKS.length * 1.05));
      /* Snapped to its cell, so it steps from one to the next. */
      const x = Math.floor(ember.x / CELL.w) * w;
      const y = Math.floor(ember.y / CELL.h) * h;
      context.globalAlpha = fade * flick;
      context.drawImage(atlas.canvas, glyph * w, level * h, w, h, x, y, w, h);
    }
    context.globalAlpha = 1;
  }

  function tick(now: number) {
    if (!running) return;
    frame = requestAnimationFrame(tick);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    step(dt);
    draw();
  }

  /* A full fire straight away: embers already on their way up. */
  function fill() {
    embers = Array.from({ length: target() }, () => born(true));
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
      frame = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      cancelAnimationFrame(frame);
      resize.disconnect();
    },
  };
}
