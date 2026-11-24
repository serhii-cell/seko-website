/**
 * The first screen appears in numbered steps, in reading order: left to
 * right, top to bottom. Step 1 starts when the first-load loader hands the
 * page over (`page-intro:content`, sent by PageTransition a moment before its
 * glyphs land in the hero's ASCII panel), or straight away when the page loads without it, and each step after
 * follows `STEP_GAP` seconds later. A component marks its parts with
 * `data-step` and starts each part's animation here.
 *
 * On the home page: 1 the logo, 2 the menus, 3 the clock and button, 4 the
 * hero's text and its ASCII panel together, 5 the stat tiles.
 */
export const STEP_GAP = 0.1;

/** Seconds the first screen's content waits after its step while the frame's
 *  rules draw in. ScrollReveal holds text and blocks back by it; anything
 *  else on the first screen that animates in waits the same. */
export const LEAD = 0.7;

/** The step of `element`, from the nearest `data-step` around it. */
export const stepOf = (element: Element, fallback = 1) =>
  Number(element.closest<HTMLElement>("[data-step]")?.dataset.step) ||
  fallback;

export function onIntroStep(step: number, start: () => void): () => void {
  let timer = 0;
  const run = () => {
    document.removeEventListener("page-intro:content", run);
    timer = window.setTimeout(start, Math.max(0, step - 1) * STEP_GAP * 1000);
  };
  if (document.documentElement.classList.contains("page-intro")) {
    document.addEventListener("page-intro:content", run);
  } else {
    run();
  }
  return () => {
    document.removeEventListener("page-intro:content", run);
    clearTimeout(timer);
  };
}
