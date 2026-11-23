/**
 * The masked line reveal, from Osmo's Masked Text Reveal: the text splits
 * into lines, each line sits in its own clip and rises into it from below.
 * It takes the page's opening headline, the paragraphs under headings,
 * smaller headings, eyebrows and labels, and anything marked `data-lines`;
 * `data-lines="off"` opts out. Once every line is in, the text goes back to
 * how it was.
 */
import { gsap, SplitText } from "@/utils/gsap.ts";

const TARGETS = [
  ".heading.text-style-h1",
  ".heading.text-style-h3",
  "p.text:not(.text-style-label, .text-style-display, .text-style-h1, .text-style-h2, .text-style-h3, .text-style-h4)",
  ".eyebrow_text",
  ":is(p, dt, h1, h2, h3, h4, h5, h6).text-style-label",
  "[data-lines]",
].join(", ");

export const isLineText = (element: Element) =>
  element.matches(TARGETS) && !element.closest('[data-lines="off"]');

export type Lines = {
  /** Brings the lines in, after `delay` seconds. */
  play: (delay?: number) => void;
  /** Puts the text back as it was. */
  revert: () => void;
};

export function createLines(element: HTMLElement): Lines {
  let lines: HTMLElement[] = [];
  let state: "waiting" | "playing" | "done" = "waiting";
  let tween: gsap.core.Tween | undefined;

  const rise = (delay: number) => {
    tween = gsap.to(lines, {
      yPercent: 0,
      duration: 0.8,
      stagger: 0.08,
      ease: "expo.out",
      delay,
      onComplete: () => {
        state = "done";
        split.revert();
      },
    });
    return tween;
  };

  /* Re-split when fonts load or the width changes, so the lines are always
     the real ones. */
  const split = SplitText.create(element, {
    type: "lines",
    mask: "lines",
    linesClass: "scroll-reveal_line",
    autoSplit: true,
    onSplit(self) {
      if (state === "done") return;
      lines = self.lines as HTMLElement[];
      gsap.set(lines, { yPercent: 110 });
      if (state === "playing") return rise(0);
    },
  });

  return {
    play(delay = 0) {
      if (state !== "waiting") return;
      state = "playing";
      rise(delay);
    },
    revert() {
      tween?.kill();
      state = "done";
      split.revert();
    },
  };
}
