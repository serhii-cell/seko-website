/**
 * The reveal for everything that isn't a section headline, after
 * baseline.agency's hero: each word sits in its own clip and rises into it
 * from below while it fades in. The page's opening headline and the
 * paragraphs under headings rise word by word; smaller headings, eyebrows
 * and labels rise letter by letter. Plays once, then puts the text back as
 * it was.
 */
import { gsap, SplitText } from "@/utils/gsap.ts";

export type RiseUnit = "words" | "chars";

const WORDS =
  ".heading.text-style-h1, p.text:not(.text-style-label, .text-style-display, .text-style-h1, .text-style-h2, .text-style-h3, .text-style-h4)";
const CHARS =
  ".heading.text-style-h3, .eyebrow_text, :is(p, dt, h1, h2, h3, h4, h5, h6).text-style-label";

/** How `element` rises, or `null` when it takes no rise. */
export const riseUnit = (element: Element): RiseUnit | null => {
  if (element.closest('[data-lines="off"]')) return null;
  if (element.matches(WORDS)) return "words";
  if (element.matches(CHARS)) return "chars";
  return null;
};

export type Rise = {
  /** Brings the text in, after `delay` seconds. */
  play: (delay?: number) => void;
  /** Puts the text back as it was. */
  revert: () => void;
};

export function createRise(element: HTMLElement, unit: RiseUnit): Rise {
  const split = SplitText.create(element, {
    type: unit === "chars" ? "words, chars" : "words",
    wordsClass: "scroll-reveal_word",
    charsClass: "scroll-reveal_char",
    mask: "words",
  });
  const parts = (unit === "chars" ? split.chars : split.words) as HTMLElement[];
  const count = Math.max(parts.length, 1);
  gsap.set(parts, { yPercent: 110, opacity: 0 });
  let tween: gsap.core.Tween | undefined;

  return {
    play(delay = 0) {
      if (tween) return;
      tween = gsap.to(parts, {
        yPercent: 0,
        opacity: 1,
        duration: unit === "chars" ? 0.9 : 1.1,
        ease: "power3.out",
        stagger:
          unit === "chars"
            ? Math.min(0.035, 1 / count)
            : Math.min(0.09, 1.4 / count),
        delay,
        onComplete: () => split.revert(),
      });
    },
    revert() {
      tween?.kill();
      split.revert();
    },
  };
}
