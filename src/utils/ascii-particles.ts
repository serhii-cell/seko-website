/**
 * Burning embers in ASCII, in the accent colour, rising from the bottom of a
 * canvas: sparks born hot and pale that cool to a deep green as they climb,
 * flickering, swaying on a gentle, ever-changing air current but always
 * making their way up. Fast ones read as short streaks (`|`, `/`, `\`) leaning
 * the way they move, slow ones as specks (`.`, `'`, `*`, `+`); a few larger
 * out-of-focus ones float in front, and a faint green haze glows along the
 * bottom edge, as over a fire, on a dark fade so they glow whatever page
 * is behind.
 *
 * `asciiParticles(canvas)` returns `start` and `stop`; it only runs between
 * them. With reduced motion it draws one still frame instead.
 */

/** Embers alive at once: one per this many square CSS px, within bounds. */
const AREA_PER_EMBER = 2600;
const COUNT = { min: 90, max: 800 };
/** Rising speed, in CSS px per second; most are slow. */
const RISE = { min: 35, max: 150 };
/** How long one burns, in seconds. */
const LIFE = { min: 2.4, max: 6.5 };
/** Faster than this (CSS px per second) an ember shows as a streak. */
const STREAK_SPEED = 110;
/** Share of embers that are large and out of focus. */
const SOFT = 0.14;
/** How hard the air sways them sideways, in CSS px per second. */
const SWAY = 30;
/** Heat steps in the colour ramp, from pale and hot to deep and cool. */
const HEAT_STEPS = 7;

/* Specks by heat, hottest last; streaks by lean. */
const SPECKS = [".", ",", "'", ":", "+", "*"];
const STREAKS = { up: "|", right: "/", left: "\\" };
const GLYPHS = [...SPECKS, STREAKS.up, STREAKS.right, STREAKS.left];

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
  soft: boolean;
  /** Size, as a share of the usual. */
  scale: number;
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

/* The glyph sprites: every glyph in every heat colour, sharp and small, then
   again large and blurred for the out-of-focus ones, and one soft glow dot to
   set under the hottest. */
function sprites(ramp: string[], glowColour: string, font: string, dpr: number) {
  const sharp = { w: Math.ceil(16 * dpr), h: Math.ceil(20 * dpr), size: 14 * dpr };
  const soft = { w: Math.ceil(36 * dpr), h: Math.ceil(40 * dpr), size: 22 * dpr };
  const glow = Math.ceil(30 * dpr);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(sharp.w, soft.w) * GLYPHS.length + glow;
  canvas.height = (sharp.h + soft.h) * ramp.length;
  const context = canvas.getContext("2d");
  if (context) {
    context.textAlign = "center";
    context.textBaseline = "middle";
    ramp.forEach((colour, level) => {
      context.fillStyle = colour;
      context.font = `${Math.round(sharp.size)}px ${font}`;
      GLYPHS.forEach((glyph, i) =>
        context.fillText(glyph, i * sharp.w + sharp.w / 2, level * sharp.h + sharp.h / 2),
      );
      const top = ramp.length * sharp.h;
      context.filter = `blur(${(2.2 * dpr).toFixed(1)}px)`;
      context.font = `${Math.round(soft.size)}px ${font}`;
      GLYPHS.forEach((glyph, i) =>
        context.fillText(glyph, i * soft.w + soft.w / 2, top + level * soft.h + soft.h / 2),
      );
      context.filter = "none";
    });
    const gx = Math.max(sharp.w, soft.w) * GLYPHS.length + glow / 2;
    const gradient = context.createRadialGradient(gx, glow / 2, 0, gx, glow / 2, glow / 2);
    gradient.addColorStop(0, glowColour);
    gradient.addColorStop(1, "transparent");
    context.fillStyle = gradient;
    context.fillRect(gx - glow / 2, 0, glow, glow);
  }
  return {
    canvas,
    sharp,
    soft: { ...soft, top: ramp.length * sharp.h },
    glow,
    glowX: Math.max(sharp.w, soft.w) * GLYPHS.length,
  };
}

export function asciiParticles(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    rgb(style.getPropertyValue(name).trim()) ?? rgb(fallback)!;
  const accent = read("--brand-500", "#7bd52d");
  const light = read("--light-100", "#ffffff");
  const dark = read("--dark-900", "#121212");
  const font = style.getPropertyValue("--mono-family").trim() || "monospace";
  /* Hot to cool: nearly white green, the accent, then a deep green. */
  const ramp = Array.from({ length: HEAT_STEPS }, (_, level) => {
    const heat = 1 - level / (HEAT_STEPS - 1);
    return heat > 0.5
      ? mix(accent, light, (heat - 0.5) * 2 * 0.7)
      : mix(accent, dark, (0.5 - heat) * 2 * 0.55);
  });
  const haze = `rgba(${accent.join(",")},`;
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
    const soft = Math.random() < SOFT;
    const rise = (RISE.min + Math.random() ** 1.7 * (RISE.max - RISE.min)) * (soft ? 0.7 : 1);
    const life = LIFE.min + Math.random() * (LIFE.max - LIFE.min);
    const low = Math.random() < 0.35;
    const ember: Ember = {
      x: Math.random() * width,
      y: low ? height - Math.random() ** 2 * height * 0.35 : height + 6 + Math.random() * 30,
      rise,
      drift: (Math.random() - 0.5) * 16,
      age: 0,
      life,
      heat: 0.7 + Math.random() * 0.3,
      soft,
      scale: soft ? 0.8 + Math.random() * 0.5 : 0.75 + Math.random() * 0.5,
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
      atlas = sprites(ramp, mix(accent, light, 0.2), font, dpr);
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
    for (let k = 0; k < 6 && embers.length < wanted; k++) embers.push(born(false));
    embers = embers.filter((ember) => {
      ember.age += dt;
      if (ember.age >= ember.life) return false;
      const k = ember.age / ember.life;
      /* They slow a little as they cool. */
      const up = ember.rise * (0.6 + 0.4 * (1 - k));
      const side = air(ember.x, ember.y) * SWAY * (ember.soft ? 0.6 : 1) + ember.drift;
      ember.vx += (side - ember.vx) * Math.min(1, dt * 2.5);
      ember.x += ember.vx * dt;
      ember.y -= up * dt;
      return ember.y > -40 && ember.x > -40 && ember.x < width + 40;
    });
  }

  function draw() {
    if (!context || !atlas) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);

    /* The fire burns on dark, whatever the page behind: a soft dark fade up
       from the bottom edge, then the green haze over it, breathing slowly. */
    const ground = context.createLinearGradient(0, canvas.height, 0, canvas.height * 0.5);
    ground.addColorStop(0, `${shade}0.92)`);
    ground.addColorStop(0.5, `${shade}0.6)`);
    ground.addColorStop(1, `${shade}0)`);
    context.fillStyle = ground;
    context.fillRect(0, canvas.height * 0.5, canvas.width, canvas.height * 0.5);

    const breath = 0.85 + 0.15 * Math.sin(time * 0.8);
    const gradient = context.createLinearGradient(0, canvas.height, 0, canvas.height * 0.55);
    gradient.addColorStop(0, `${haze}${(0.14 * breath).toFixed(3)})`);
    gradient.addColorStop(0.45, `${haze}${(0.04 * breath).toFixed(3)})`);
    gradient.addColorStop(1, `${haze}0)`);
    context.fillStyle = gradient;
    context.fillRect(0, canvas.height * 0.55, canvas.width, canvas.height * 0.45);

    const { sharp, soft, glow, glowX } = atlas;
    for (const ember of embers) {
      const k = ember.age / ember.life;
      /* Bright as it catches, gone as it burns out. */
      const fade = Math.min(1, ember.age / 0.25) * (1 - k) ** 0.9;
      const flick =
        0.72 + 0.28 * Math.sin(time * ember.flicker + ember.phase) * Math.sin(time * ember.flicker * 1.7 + ember.phase * 2);
      const heat = ember.heat * (1 - k) ** 0.65;
      const level = Math.min(HEAT_STEPS - 1, Math.round((1 - heat) * (HEAT_STEPS - 1)));
      const up = ember.rise * (0.6 + 0.4 * (1 - k));
      /* A streak when fast, leaning the way it moves; a speck otherwise,
         hotter ones larger. */
      let glyph: number;
      if (!ember.soft && up > STREAK_SPEED) {
        const lean = ember.vx / up;
        glyph = SPECKS.length + (lean > 0.22 ? 1 : lean < -0.22 ? 2 : 0);
      } else {
        glyph = Math.min(SPECKS.length - 1, Math.floor(heat ** 2.2 * SPECKS.length * 1.05));
      }
      const x = ember.x * dpr;
      const y = ember.y * dpr;
      if (ember.soft) {
        const w = soft.w * ember.scale;
        const h = soft.h * ember.scale;
        context.globalAlpha = fade * flick * 0.35;
        context.drawImage(atlas.canvas, glyph * soft.w, soft.top + level * soft.h, soft.w, soft.h, x - w / 2, y - h / 2, w, h);
        continue;
      }
      if (heat > 0.35) {
        context.globalAlpha = Math.min(1, fade * flick * (heat - 0.35) * 1.4);
        const g = glow * ember.scale;
        context.drawImage(atlas.canvas, glowX, 0, glow, glow, x - g / 2, y - g / 2, g, g);
      }
      const w = sharp.w * ember.scale;
      const h = sharp.h * ember.scale;
      context.globalAlpha = fade * flick;
      context.drawImage(atlas.canvas, glyph * sharp.w, level * sharp.h, sharp.w, sharp.h, x - w / 2, y - h / 2, w, h);
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
