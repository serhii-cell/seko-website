/**
 * GSAP and the plugins this site uses, registered once. Components import them
 * from here rather than from `gsap`, so registration, shared defaults and named
 * eases live in one place — see MOTION.md.
 *
 * Everything imported here ships to every page that animates, so a plugin is
 * added when a component first needs it, not ahead of time.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };
