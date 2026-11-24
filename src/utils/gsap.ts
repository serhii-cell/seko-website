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
import { SplitText } from "gsap/SplitText";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { CustomEase } from "gsap/CustomEase";

gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin, CustomEase);
gsap.defaults({ duration: 0.8, ease: "power3.out" });

/* Osmo's ease: a slow start, a quick middle and a long, soft landing. Lines
   that draw in and tags that rise use it by name. */
CustomEase.create("osmo", "0.625, 0.05, 0, 1");

export { gsap, ScrollTrigger, SplitText };
