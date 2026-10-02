/**
 * The first screen appears in numbered steps, in reading order: left to
 * right, top to bottom. Step 1 starts when the first-load curtain's edge
 * reaches the first heading (`page-intro:content`, sent by PageTransition),
 * or straight away when the page loads without it, and each step after
 * follows `STEP_GAP` seconds later. A component marks its parts with
 * `data-step` and starts each part's animation here.
 *
 * On the home page: 1 the menus, 2 the logo, 3 the clock and button, 4 the
 * hero's text, its ASCII container and its guides together, 5 the line
 * above the logos, 6 the logo strip.
 */
export const STEP_GAP = 0.1;

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
