/**
 * The section headline reveal, from Osmo's Gradient Wave Text on Scroll: the
 * letters wait at 20% of their colour and switch on in reading order as the
 * headline scrolls through, each passing through the brand green on its way
 * to its own colour. Scrolling back switches them off again. A headline
 * already on screen at load lights up once over time instead.
 */
import { gsap, SplitText } from "@/utils/gsap.ts";

const SCROLL_START = "top 95%";
const SCROLL_END = "bottom 75%";
const SCRUB = 0.1;
const WAVE_DURATION = 0.4;

export const isWaveText = (element: Element) =>
  element.matches(".heading:is(.text-style-display, .text-style-h2)") &&
  !element.closest('[data-lines="off"]');

export type Wave = {
  /** Lights the letters one after another over time, after `delay` seconds. */
  play: (delay?: number) => void;
  /** Ties the letters to the scroll from here on. */
  scrub: () => void;
  /** Puts the text back as it was. */
  revert: () => void;
};

/* Each letter's own tweens stay out of the page's GSAP context, which would
   otherwise keep every one made while scrolling; revert() kills them. */
const loose = gsap.context(() => {});

const dim = (color: string) => {
  const [r, g, b, a = 1] = gsap.utils.splitColor(color) as number[];
  return `rgba(${r}, ${g}, ${b}, ${a * 0.2})`;
};

export function createWave(element: HTMLElement): Wave {
  const waveColor = getComputedStyle(element)
    .getPropertyValue("--brand-500")
    .trim();
  const progress = { value: 0 };
  const active = new Set<HTMLElement>();
  let chars: HTMLElement[] = [];
  let ends: string[] = [];
  let starts: string[] = [];
  let ready = false;
  let tween: gsap.core.Tween | undefined;

  const sync = () =>
    loose.ignore(() => {
      const count = Math.round(progress.value * chars.length);
      chars.forEach((char, index) => {
        const on = index < count;
        gsap.killTweensOf(char);
        gsap.set(char, { color: on ? ends[index] : starts[index] });
        if (on) active.add(char);
        else active.delete(char);
      });
    });

  const update = () => {
    if (!ready) return;
    loose.ignore(() => step());
  };

  const step = () => {
    const count = Math.round(progress.value * chars.length);
    chars.forEach((char, index) => {
      const on = index < count;
      if (on && !active.has(char)) {
        active.add(char);
        gsap.killTweensOf(char);
        gsap
          .timeline()
          .to(char, {
            color: waveColor,
            duration: WAVE_DURATION * 0.3,
            ease: "power2.out",
          })
          .to(char, {
            color: ends[index],
            duration: WAVE_DURATION * 0.7,
            ease: "power2.in",
          });
      }
      if (!on && active.has(char)) {
        active.delete(char);
        gsap.killTweensOf(char);
        gsap.to(char, {
          color: starts[index],
          duration: WAVE_DURATION * 0.5,
          ease: "none",
        });
      }
    });
  };

  const split = SplitText.create(element, {
    type: "words, chars",
    wordsClass: "scroll-reveal_word",
    charsClass: "scroll-reveal_char",
    autoSplit: true,
    onSplit(self) {
      chars = self.chars as HTMLElement[];
      ends = chars.map((char) => getComputedStyle(char).color);
      starts = ends.map(dim);
      active.clear();
      sync();
    },
  });

  return {
    play(delay = 0) {
      if (tween) return;
      ready = true;
      tween = gsap.to(progress, {
        value: 1,
        duration: gsap.utils.clamp(0.8, 1.6, chars.length * 0.025),
        delay,
        ease: "none",
        onUpdate: update,
      });
    },
    scrub() {
      if (tween) return;
      tween = gsap.to(progress, {
        value: 1,
        ease: "none",
        scrollTrigger: {
          trigger: element,
          start: SCROLL_START,
          end: SCROLL_END,
          scrub: SCRUB,
          onRefresh: () => {
            ready = false;
            sync();
            requestAnimationFrame(() => (ready = true));
          },
        },
        onUpdate: update,
      });
    },
    revert() {
      tween?.scrollTrigger?.kill();
      tween?.kill();
      chars.forEach((char) => gsap.killTweensOf(char));
      split.revert();
    },
  };
}
