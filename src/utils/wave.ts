/**
 * The section headline reveal, after baseline.agency's statement reveal: a
 * soft diagonal edge sweeps across the text from the left, so every line
 * fills at once with the upper ones slightly ahead. Text ahead of the edge
 * waits at 27% of its colour and passes through the brand green as the edge
 * reaches it. It plays at its own pace once started; ScrollReveal starts it
 * when the headline scrolls in. The text sits in a wrapper with room above
 * and below, so the gradient reaches every ascender and descender; the
 * gradient itself is CSS, in ScrollReveal. The page's opening h1 rises
 * instead (rise.ts).
 */
import { gsap } from "@/utils/gsap.ts";

export const isWaveText = (element: Element) =>
  element.matches(".heading:is(.text-style-display, .text-style-h2)") &&
  !element.closest('[data-lines="off"]');

export type Wave = {
  /** Sweeps the edge across, after `delay` seconds. */
  play: (delay?: number) => void;
  /** Puts the text back as it was. */
  revert: () => void;
};

export function createWave(element: HTMLElement): Wave {
  const fill = document.createElement("span");
  fill.className = "scroll-reveal_wave";
  fill.append(...element.childNodes);
  element.append(fill);
  gsap.set(fill, { "--reveal": 0 });
  let tween: gsap.core.Tween | undefined;

  const revert = () => {
    tween?.kill();
    if (fill.parentNode !== element) return;
    fill.replaceWith(...fill.childNodes);
  };

  return {
    play(delay = 0) {
      if (tween) return;
      tween = gsap.to(fill, {
        "--reveal": 1,
        duration: 2.4,
        delay,
        ease: "power1.inOut",
        onComplete: revert,
      });
    },
    revert,
  };
}
