/**
 * Limits on how far the reader's own scrolling (wheel, touch, keys) may go,
 * for parts of the page that must play through before the page moves on,
 * such as the services deck. Scrolling done by the page itself (a menu link,
 * a jump to a card) is never held.
 *
 * Wheel scrolling runs through Lenis, which asks `guardWheel` about every
 * step, so the page glides up to a limit and stops there. Keys, touch and
 * the scrollbar scroll natively; `heldAt` tells a part where to put the page
 * back if they took it past a limit.
 */
import type Lenis from "lenis";

export type Range = { min: number; max: number };
type Limit = () => Range | null;

const limits = new Set<Limit>();
let lenis: Lenis | null = null;
/* When the reader last scrolled by hand, in ms. */
let lastInput = -Infinity;

const SCROLL_KEYS = new Set([
  "ArrowDown",
  "ArrowUp",
  "PageDown",
  "PageUp",
  "Home",
  "End",
  " ",
]);

if (typeof window !== "undefined") {
  const mark = () => (lastInput = performance.now());
  addEventListener("wheel", mark, { passive: true, capture: true });
  addEventListener("touchstart", mark, { passive: true, capture: true });
  addEventListener("touchmove", mark, { passive: true, capture: true });
  addEventListener(
    "keydown",
    (event) => {
      if (SCROLL_KEYS.has(event.key)) mark();
    },
    { capture: true },
  );
}

export function bindLenis(instance: Lenis) {
  lenis = instance;
}

/** Adds a limit; returns a function that removes it. */
export function addScrollLimit(limit: Limit) {
  limits.add(limit);
  return () => {
    limits.delete(limit);
  };
}

/* All limits together: the tightest of each. */
function range(): Range | null {
  let min = -Infinity;
  let max = Infinity;
  limits.forEach((limit) => {
    const r = limit();
    if (!r) return;
    min = Math.max(min, r.min);
    max = Math.min(max, r.max);
  });
  return min === -Infinity && max === Infinity ? null : { min, max };
}

/** Whether the reader is scrolling by hand right now. */
export function scrollingByHand() {
  return performance.now() - lastInput < 400;
}

/**
 * Lenis's `virtualScroll` hook: lets a wheel or touch step through, or takes
 * it over and stops it at the limit.
 */
export function guardWheel(data: { deltaY: number; event: WheelEvent | TouchEvent }) {
  lastInput = performance.now();
  const r = range();
  if (!r || !lenis || data.event.ctrlKey) return true;
  const { deltaY, event } = data;
  if (event.type.includes("touch")) {
    /* Touch scrolls natively: only refuse a move further past the limit. */
    const blocked = (deltaY > 0 && scrollY >= r.max - 1) || (deltaY < 0 && scrollY <= r.min + 1);
    if (blocked && event.cancelable) event.preventDefault();
    return !blocked;
  }
  const wanted = lenis.targetScroll + deltaY;
  const allowed = Math.min(r.max, Math.max(r.min, wanted));
  if (allowed === wanted) return true;
  if (event.cancelable) event.preventDefault();
  if (allowed !== lenis.targetScroll) lenis.scrollTo(allowed, { lerp: lenis.options.lerp });
  return false;
}

/** Puts the page at `y` straight away, Lenis included. */
export function jumpTo(y: number) {
  window.scrollTo(0, y);
  lenis?.scrollTo(y, { immediate: true, force: true });
}
