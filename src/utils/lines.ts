/**
 * The line reveal for text: each line rises into place from under its own
 * mask while fading in, line after line. Small supporting lines that should
 * not move opt out with `data-lines="off"`.
 */
import { gsap, SplitText } from "@/utils/gsap.ts";

export const isLineText = (element: Element) =>
  element.matches(".heading, .text, [data-lines]") &&
  !element.closest('[data-lines="off"]');

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
    tween = gsap.fromTo(
      lines,
      { yPercent: 105, opacity: 0 },
      {
        yPercent: 0,
        opacity: 1,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.08,
        delay,
        onComplete: () => {
          state = "done";
          split.revert();
        },
      },
    );
    return tween;
  };

  /* Re-split when fonts load or the width changes, so the lines are always
     the real ones. */
  const split = SplitText.create(element, {
    type: "lines",
    mask: "lines",
    autoSplit: true,
    onSplit(self) {
      if (state === "done") return;
      lines = self.lines as HTMLElement[];
      if (state === "playing") return rise(0);
      gsap.set(lines, { yPercent: 105, opacity: 0 });
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
