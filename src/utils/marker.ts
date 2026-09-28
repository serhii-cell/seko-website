/**
 * The marker reveal for headings and body text: each line starts under a
 * solid bar in the text colour, like a highlighter stroke, and the bars are
 * wiped away left to right, line after line. Small supporting lines opt out
 * with `data-marker="off"`.
 */
import { gsap, SplitText } from "@/utils/gsap.ts";

export const isMarkerText = (element: Element) =>
  element.matches(".heading, .text") && !element.closest('[data-marker="off"]');

export type Marker = {
  /** Wipes the bars away, after `delay` seconds. */
  play: (delay?: number) => void;
  /** Puts the text back as it was, bars gone. */
  revert: () => void;
};

export function createMarker(element: HTMLElement): Marker {
  let bars: HTMLElement[] = [];
  let state: "covered" | "playing" | "done" = "covered";
  let tween: gsap.core.Tween | undefined;
  const centred = getComputedStyle(element).textAlign === "center";

  const erase = (delay: number) => {
    tween = gsap.to(bars, {
      scaleX: 0,
      duration: 0.35,
      ease: "power2.inOut",
      stagger: 0.06,
      delay,
      onComplete: () => {
        state = "done";
        split.revert();
      },
    });
    return tween;
  };

  /* Re-split when fonts load or the width changes, so the bars always sit
     on the real lines. */
  const split = SplitText.create(element, {
    type: "lines",
    autoSplit: true,
    onSplit(self) {
      if (state === "done") return;
      bars = (self.lines as HTMLElement[]).map((line) => {
        line.style.width = "fit-content";
        if (centred) line.style.marginInline = "auto";
        const bar = document.createElement("span");
        bar.style.cssText =
          "position:absolute;inset:0.06em 0;background:var(--text);transform-origin:right center;pointer-events:none";
        line.append(bar);
        return bar;
      });
      if (state === "playing") return erase(0);
    },
  });

  return {
    play(delay = 0) {
      if (state !== "covered") return;
      state = "playing";
      erase(delay);
    },
    revert() {
      tween?.kill();
      state = "done";
      split.revert();
    },
  };
}
