type Cleanup = () => void;
type Start = () => Cleanup | void;

const starts: Start[] = [];
let cleanups: Cleanup[] = [];
let started = false;

function run(start: Start) {
  try {
    const cleanup = start();
    if (cleanup) cleanups.push(cleanup);
  } catch (error) {
    reportError(error);
  }
}

function startPage() {
  if (started) return;
  started = true;
  for (const start of starts) run(start);
}

function cleanUpPage() {
  started = false;
  const pending = cleanups;
  cleanups = [];
  for (const cleanup of pending) {
    try {
      cleanup();
    } catch (error) {
      reportError(error);
    }
  }
}

document.addEventListener("astro:page-load", startPage);
document.addEventListener("astro:before-swap", cleanUpPage);
startPage();

/**
 * Runs `start` on every page, the first included, and the cleanup it returns
 * just before that page is replaced.
 *
 * With Astro's router on, a script runs once per visit while pages swap in
 * place, so a component wires itself up here instead of at the top of its
 * script. Without the router every navigation is a full load and this simply
 * runs once. `start` runs on every page, so it has to do nothing when its
 * elements are missing. One that throws is reported without stopping the rest.
 */
export function onPage(start: Start): void {
  starts.push(start);
  if (started) run(start);
}
