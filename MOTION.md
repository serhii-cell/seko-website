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
- **GSAP skills:** GreenSock's official skills in `.claude/skills/gsap-*`,
  copied unchanged. They cover GSAP itself; where they differ from this file,
  this file wins — Lenis rather than ScrollSmoother, for one.
- **Smooth scroll:** Lenis, on every page through `SmoothScroll`. It pauses
  while Lumos locks the page for an open modal, lets inner scroll areas scroll
  natively, and turns itself off for reduced motion. It leaves in-page links to
  the browser, so the skip link still moves focus.
- **Named ease:** `osmo` (Osmo's `0.625, 0.05, 0, 1`, through CustomEase in
  `src/utils/gsap.ts`): a slow start, a quick middle and a long, soft landing.
  Lines drawing in and tags rising use it by name.
- **Counters:** `Odometer` (from Osmo's Number Odometer) rolls each digit of a
  figure through 0–9 and fades it up from nothing. Figures inside one
  `data-odometer-group` roll together, one after another; on the first screen
  they wait for their intro step and `LEAD`, further down for the scroll.
- **Dissolve:** `src/utils/dissolve.ts` turns a card dropping out of a deck
  into ASCII: an SVG mask takes it away cell by cell from its bottom edge,
  and each cell leaves a character that drifts off, turns green and fades,
  shown only around the deck. It reads the card's `yPercent`, so it follows
  the scroll both ways. The Services deck uses it while it is held.
- **Part dissolve:** `src/utils/part-dissolve.ts` dissolves a hovered part
  of an SVG drawing the same way, cell by cell through a mask, its cells
  shedding green characters only where the part is drawn; leaving plays it
  back. The Problems drawings use it on their settings, knob, people, gear,
  hub and scooter parts, once their intros have played.
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

Both go through `onPage()` from `src/utils/lifecycle.ts`, so components never
listen for router events themselves: a script hands it a start function, which
returns its clean up. It starts the first page itself, then follows
`astro:page-load` and `astro:before-swap`, so the same script works with the
router on or off.

## Script checklist

Every box has to be ticked before a script is accepted.

- [ ] Lives in the component that needs it, per LUMOS.md, and registers
      through `onPage()` rather than moving to a global file.
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
- [ ] Leaves content alone in Lumos's visual designer, when `<html>` has
      `stacki-designer`: nothing is hidden or animated there.
- [ ] Refreshes ScrollTrigger after anything it changes that moves layout —
      split text, added content — never on a timer. ScrollTrigger refreshes
      itself on load and resize.

## Site-wide pieces

`BaseLayout` renders these once. They output a script and no markup, so they
take no `render` prop; the layout decides where they appear.

- **`SmoothScroll`** starts Lenis once per visit and drives it from GSAP's
  ticker, so ScrollTrigger reads the same scroll position. Its CSS is Lenis's
  own, class names included.
- **`ScrambleCursor`** (from Osmo's Scramble Text Cursor) follows the mouse
  and, over anything marked `data-cursor-hover`, shows a small label that
  scrambles through the facts in its `data-cursor-text` (separated by `|`),
  one every 1.8s. Work cards set these from their `cursor` prop. It lives in
  the layout, not a section, because a pinned section's transform would
  shift a fixed element inside it.
- **`ScrollReveal`** runs on pages whose layout has `reveal`. Section
  headlines (display or h2) light up letter by letter as they scroll through
  (`src/utils/wave.ts`, from Osmo's Gradient Wave Text on Scroll): each
  letter waits at 20% of its colour, switches on in reading order between
  `top 95%` and `bottom 75%` (done while the whole headline is still low on
  screen) with a 0.1 scrub, and passes through the brand
  green on its way to its own colour; scrolling back switches them off. A
  headline already on screen at load lights up once over time instead. The
  page's opening headline, the paragraphs under headings, smaller headings
  (h3), eyebrows, labels (`.text-style-label` on a `p`, `dt` or heading) and
  anything marked `data-lines` rise line by line from under their own masks
  (`src/utils/lines.ts`, from Osmo's Masked Text Reveal, slowed down: each
  line rises from `yPercent` 110 over 1.4s (`power3.out`) and fades in over 2s
  (`power1.out`), 0.12s apart), once their top reaches `clamp(top
  80%)`, then the text goes back to how it was. `data-lines="off"` opts out
  of both. Blocks with no text of their own, and anything marked
  `data-fade`, fade in from 0 opacity instead. Parts outside `<main>`
  that should join in, like the nav's, are marked `data-intro`. Whatever is on
  screen at load comes in in numbered steps, left to right and top to bottom:
  each part carries `data-step`, step 1 starts when the first-load loader
  hands the page over (`page-intro:content`), a moment before its glyphs
  land in the hero's ASCII panel, and each step follows
  0.1s later (`src/utils/intro.ts`). First, every rule on that screen —
  `.dashed` lines, the frame rails and anything marked `data-draw` — draws
  itself in over 1.6s (`power3.inOut`), across from the left and down from
  the top, driven by a `--draw` variable from 0 to 1; the content in `<main>`
  starts 0.7s later, its blocks rising 1.125rem over 1s as they fade in over 1.6s. Items in the same step go in reading
  order, 0.06s apart; components with their own first-screen animation — the
  hero's ASCII container and guides, the logo strip — start on their step too. The rest comes in as
  it scrolls into view: text once its top reaches `clamp(top 80%)`, section
  headlines tied to the scroll, blocks in batches (`top 90%`). A block marked `data-reveal="own"` runs its own reveal and is
  skipped, like the cards of `SectionHelpMain`, which slide up into their
  columns while the section is pinned. `SectionObservationsMain` plays its
  chart once, by itself, when the chart scrolls into view — it is not pinned
  or tied to the scroll, so scrolling back up never replays it.

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

## Before the first page transition

GSAP, Lenis, `onPage()` and the reveal are in place, and new scripts use them
from the start. The router isn't on yet. Before it is, in this order:

1. Move the ten Lumos components with scripts onto `onPage()`: Form, Range,
   Nav, Footer, Accordion, Dropdown, Marquee, Modal, Slider and Tabs. Each wires
   itself up once at load, and Nav, Dropdown, Modal and Accordion attach
   listeners or observers to the whole document that are never removed, so all
   ten break or leak after the first page change.
2. Refresh ScrollTrigger after every swap, since its own refresh on the load
   event only comes with a full load, and give Lenis `stopInertiaOnNavigate`.
3. Add `<ClientRouter />` to `BaseHead.astro`, only once the above is done.

Remove this section once that's done.
