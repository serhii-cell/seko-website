/**
 * The moment the first screen opens: when the first-load curtain is half way
 * up (`page-intro:done`, sent by PageTransition), or straight away when the
 * page loads without it. The hero's ASCII container, its guide lines and the
 * logo strip all start together here.
 */
export function onIntroOpen(start: () => void): () => void {
  if (!document.documentElement.classList.contains("page-intro")) {
    start();
    return () => {};
  }
  const run = () => {
    document.removeEventListener("page-intro:done", run);
    start();
  };
  document.addEventListener("page-intro:done", run);
  return () => document.removeEventListener("page-intro:done", run);
}
