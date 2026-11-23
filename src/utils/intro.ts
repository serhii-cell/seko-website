/**
 * The first screen appears in numbered steps, in reading order: left to
 * right, top to bottom. Step 1 starts as soon as the page does, and each step
 * after follows `STEP_GAP` seconds later. A component marks its parts with
 * `data-step` and starts each part's animation here.
 *
 * On the home page: 1 the logo, 2 the menus, 3 the clock and button, 4 the
 * hero's text and its ASCII panel together, 5 the stat tiles.
 */
export const STEP_GAP = 0.1;

/** The step of `element`, from the nearest `data-step` around it. */
export const stepOf = (element: Element, fallback = 1) =>
  Number(element.closest<HTMLElement>("[data-step]")?.dataset.step) ||
  fallback;

export function onIntroStep(step: number, start: () => void): () => void {
  const timer = window.setTimeout(
    start,
    Math.max(0, step - 1) * STEP_GAP * 1000,
  );
  return () => clearTimeout(timer);
}
