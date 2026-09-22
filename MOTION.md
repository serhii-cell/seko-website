# Motion and interactions

How scripts, animation and page transitions work in this project, and how a
resource from [Osmo](https://www.osmo.supply) becomes part of it. Read this
before adding any of them. [LUMOS.md](LUMOS.md) still governs markup, classes
and CSS; this covers what changes once JavaScript is involved.

## The stack

- **Page changes:** Astro's `<ClientRouter />`. Not Barba.js, and never both —
  two routers fight over the same clicks. See [Why not Barba](#why-not-barba).
- **Animation:** GSAP from npm, plugins included — ScrollTrigger, SplitText,
  Flip — all imported from that one package. No CDN copies.
- **Smooth scroll:** Lenis, only if the design calls for it.
- CSS stays the first choice for hovers and simple state changes, on the
  `--hover-*` and `--open-*` tokens in `src/styles/base.css`. GSAP is for
  anything sequenced, scroll-driven or split into parts.

## The page lifecycle

With the router on, the browser loads the site once, and Astro swaps each page
in place after that, replacing the whole `<body>`. A script runs once per
visit, not once per page, so nothing may rely on running at page load.

Every script that touches the page follows one contract, Astro's version of the
function registry in Osmo's boilerplate:

- **Start** runs on every page the component appears on, the first included.
  It finds its elements, wires them up, and creates its animations inside a
  `gsap.context()`.
- **Clean up** runs before that page is replaced. It reverts the context, which
  kills its tweens, timelines and ScrollTriggers, and removes anything it added
  outside its own elements: listeners on `window` or `document`, observers,
  intervals.

Both go through one helper, `src/utils/lifecycle.ts`, so components never listen
for router events themselves. It ties start to `astro:page-load` and clean up
to `astro:before-swap`, and it works without the router too: the
`astro-view-transitions-enabled` meta tag says which case applies.

## Script checklist

Every box has to be ticked before a script is accepted.

- [ ] Lives in the component that needs it, per LUMOS.md, and registers
      through the lifecycle helper rather than moving to a global file.
- [ ] Finds its elements from the component's root class. Behavior hooks and
      per-instance settings may be `data-` attributes, as Osmo's are; looks stay
      on Lumos classes and variants.
- [ ] Does nothing, and throws nothing, on a page without its elements.
- [ ] Is safe to start again on an element it already started: no doubled
      listeners, no text split twice.
- [ ] Creates every animation inside the component's `gsap.context()`, or
      `gsap.matchMedia()` where it changes by breakpoint or motion preference.
- [ ] Imports GSAP and its plugins from `src/utils/gsap.ts`, which registers
      them and sets shared defaults and named eases once. No component repeats
      a duration or ease that belongs there.
- [ ] Handles `prefers-reduced-motion` itself, as Tabs, Marquee and Slider
      already do. The rule in `base.css` stops CSS animation but can't reach
      GSAP: movement is removed or reduced to a fade, and nothing the user needs
      waits on an animation.
- [ ] Keeps content visible if JavaScript never runs. Anything hidden before
      its entrance is hidden under a class a script sets on `<html>`, never by
      default CSS.
- [ ] Refreshes ScrollTrigger once its layout has settled — images, fonts,
      split text — never on a timer.

## Page transitions

- One component, `src/components/Global/PageTransition.astro`, owns them: the
  overlay markup, its CSS and the script that drives every page change.
  `BaseLayout` renders it once, its overlay marked `transition:persist` so it
  survives the swap it covers. No other component animates the page in or out.
- The old page leaves in `astro:before-preparation`, by wrapping
  `event.loader` so the next page loads while the animation plays, and Astro
  waits for both.
- The new page gets its starting states in `astro:after-swap`, the last point
  before it paints, and enters on `astro:page-load`.
- Which transition plays is chosen from `event.from`, `event.to` and
  `event.sourceElement`, in place of Barba's rules and namespaces. A page that
  needs its own carries `data-page` on `<main>`.
- Astro's own fade is turned off with `transition:animate="none"` on `<html>`,
  so only one animation runs.
- The first-load animation runs on the first `astro:page-load` only.
- Clicks are ignored while a transition runs.
- Lenis, and anything else site-wide, is created once per visit, never per page.
- A link that must reload the page fully carries `data-astro-reload`.

## Bringing in an Osmo resource

Osmo resources come as HTML, CSS and JS written for Webflow or plain pages. One
becomes a Lumos component only once the site uses it: Osmo's license allows
resources in finished projects but not a stored library of them. So this
repository never holds reference copies or the course boilerplate, and stays
private while it holds Osmo code, since publishing it would redistribute that
code.

1. Paste the resource's HTML, CSS and JS in. The vault is behind a login, so a
   link alone can't be read.
2. Build the markup from Lumos components where they fit — `Heading`,
   `Button`, `Img` — and give the rest Lumos class names, per LUMOS.md.
3. Convert the CSS with LUMOS.md's checklist: `rem` rather than `px`, values
   from `src/styles/base.css`, the component's own `<style is:global>` under
   `@layer components`.
4. Rewrite the script to the checklist above.
5. Make settings that vary per use — speed, direction, delay — props, handed to
   the script as `data-` attributes.
6. Name the Osmo resource in the commit that adds it, so it can be found in the
   vault again.

## Why not Barba

Barba swaps only the page content. Astro gives each page the CSS and scripts
its own components need — the home page and the components page already load
different sets — so after a Barba navigation the new page's styles and scripts
never arrive, and its title and meta tags stay the previous page's. Working
around that means one global bundle for all CSS and JS, undoing LUMOS.md's rule
that a component carries its own and making every Lumos upgrade harder. Astro's
router already loads them, updates the head, restores scroll, announces the new
page to screen readers and switches its own animations off for reduced motion.

Osmo's transitions port by moving their GSAP timelines onto Astro's events:

| Barba, in Osmo's boilerplate | Astro                                               |
| ---------------------------- | --------------------------------------------------- |
| `once`                       | the first `astro:page-load`                         |
| `leave`                      | `astro:before-preparation`, wrapping `event.loader` |
| `beforeEnter`                | `astro:after-swap`                                  |
| `enter`, `afterEnter`        | `astro:page-load`                                   |
| namespaces and rules         | `data-page`, `event.from`, `event.to`               |

A transition that needs the old and new page on screen together, like a
grid-to-detail with Flip, needs a custom `event.swap` in `astro:before-swap`
that keeps the old content on the page, and animates both once the swap is
done.

## Not set up yet

None of this is installed: no GSAP, no router, no helper. The first time a
script or animation is added, do it in this order:

1. Install GSAP and add `src/utils/gsap.ts`.
2. Add `src/utils/lifecycle.ts`.
3. Move the ten Lumos components with scripts onto it: Form, Range, Nav,
   Footer, Accordion, Dropdown, Marquee, Modal, Slider and Tabs. Each wires
   itself up once at load, and Nav, Dropdown, Modal and Accordion attach
   listeners or observers to the whole document that are never removed, so all
   ten break or leak after the first page change.
4. Add `<ClientRouter />` to `BaseHead.astro`, only once all ten are moved.

Remove this section once that's done.
