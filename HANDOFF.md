# J7 Creations — Handoff

**Last updated:** 18 August 2026
**Live:** https://j7creations.com · **Repo:** https://github.com/jes7er9989/J7-creations.com

Static site — plain HTML/CSS/JS, no build step, no framework. Pushing to `main`
deploys to Cloudflare Pages in about 30 seconds. **Merging to `main` *is*
deploying**; there is no staging step.

---

## The three rules that matter

Everything else in this document is detail. These three cost real time to
rediscover.

### 1. Run the stamp script after touching CSS or JS

```bash
python scripts/stamp-assets.py
```

Then commit the result. It rewrites every `?v=` on the stylesheet and script
tags with a hash of the file's contents.

Cloudflare's free tier **overrides `Cache-Control` with a 4-hour minimum**, so
without a content-derived stamp an edited file keeps serving stale to anyone
who visited recently. This is not hypothetical: during this work it shipped a
broken navigation menu and hid a newly added phone number from the live site.

A *fixed* version string does not help. The site previously carried
`app.js?v=2026042802`, which never changed, so browsers pinned that file
indefinitely.

### 2. Changing an image means changing its filename

`_headers` caches images and video as `immutable, max-age=1yr`. That is only
safe when the filename changes with the content, so every processed image
carries a content hash — `waterproof-box-view1.7ce79569.jpg`.

**Editing an image in place and keeping its name does not work.** The deploy
succeeds and visitors keep seeing the old picture, for a year. This happened
during this work.

Related: never request an asset URL while a deploy is still propagating. Doing
so once cached a 404 HTML fallback *as* an image, under a one-year TTL. There
is now a real `404.html`, so misses return 404 instead of a cacheable 200 —
but poll the HTML, not the assets, when checking a deploy.

### 3. All prices live in `js/pricing.js`

One file. Editing a price anywhere else will drift, which is exactly how the
site ended up quoting two different figures for the same job. After any change:

```bash
node scripts/verify-pricing.js
```

It enforces the rule that a bigger job must never cost less than a smaller one
— a rule the original estimators broke in three separate places — and checks
that the advertised ranges still match what the calculators produce.

---

## How the design works

### The wallpaper

The logo is a fixed, centred background on `body::before`; content scrolls in
front of it. `body::after` is a scrim that keeps text readable over the
artwork.

The image is **dimmed in the file itself** (`brightness ×0.42`), not veiled by
a heavy overlay. Multiplying preserves the dark canvas texture and the relative
colour; a flat overlay lifts the blacks and pushes the whole thing toward grey.
That is what lets the scrim sit at 0.35 instead of 0.78, so the mark is
actually visible.

Phones get a smaller rendition and `background-attachment: scroll`, because
fixed backgrounds judder badly on iOS.

### Light mode is not an inverted page

Both themes share the same dark wallpaper and the same scrim. **Only the cards
change** — in light mode they become translucent white frosted glass, so the
artwork stays visible through and around them.

**The glass lifts the backdrop rather than covering it.** Measured from
`j7-wall.fd59da6c.jpg` itself, blurred to what a 14px `backdrop-filter`
samples and composited with the scrim, the backdrop is **grey 5 to grey 40** —
very nearly black. A plain white wash bright enough to carry dark text on that
therefore has to be almost opaque, which is why simply thinning it makes the
cards dim instead of clear.

So the light-mode glass filter is `blur() contrast(0.5) brightness(2)
saturate(1.8)`. `contrast()` below 1 is an *additive* transfer — it pulls the
backdrop toward mid-grey — where `brightness()` multiplies and so cannot lift
black at all. The artwork comes up into view instead of being papered over,
and a 29% wash lands brighter than the old 60% one did.

**Keep `contrast()` as high as the text floor allows.** Every step down
flattens the artwork at the same time as it lifts it. A first attempt used
0.34 and the cards came out looking identical to the old, thicker wash —
thinner glass with nothing more visible through it, which defeats the point.
0.5 leaves roughly 25 levels of the mark showing through; 0.34 left about 14.

Three things to know about it:

- The filter lives in `--glass-filter` / `--glass-filter-dense`, defined
  **only** under `[data-theme="light"]`. `mobile-fix.css` refers to it as
  `var(--glass-filter, blur(12px))`, so dark mode silently takes the plain
  blur. Do not move those tokens to `:root`.
- Anything whose surface comes from an inline `background: var(--color-bg-*)`
  needs the filter applied by the `[style*="var(--color-bg-dark)"]` selector
  group, or it is a thin wash straight onto black.
- **The navbar is deliberately excluded** from the card scope and from the
  glass rules. It has no surface at all — just a top-to-bottom fade — and
  keeps the dark treatment in both themes, because it sits over artwork and
  never over a card. Adding it back to the light scope flips its text to
  #101010 against the wallpaper at about 1.6:1. The dropdown, by contrast,
  *does* keep a panel: it opens over scrolling content.

### How dark the accent can go

Light-mode cards carry the Covenant violet `#4c1d95` at about 5.2:1. Dark
mode cannot: a dark panel is 46% over the wallpaper, so where the artwork is
brightest behind it the card sits at grey 34, and `#4c1d95` measures 1.6:1
there. Dark mode's accent is `#9b78f5` — as deep as that surface allows, at
4.89:1. The estimator result panel carries a brand wash on top of the card
and sits lighter still, so it keeps its own lighter accent.

This has two further consequences that are easy to trip over:

- **Text colour depends on whether an element sits on a card or on the
  wallpaper.** Page-level text tokens stay *light* in light mode, because
  section titles sit on dark artwork. Card-scoped rules flip them dark.
- **Sections must stay transparent.** Giving `.contact` or `.footer` a
  full-width background turns the lower half of the page into one continuous
  translucent sheet, which reads as flat grey. Blocks that need a surface —
  the form, the contact details, the footer content — get their own card.

### Inline styles beat stylesheets

Much of the markup still carries inline `style` attributes. An inline
`color: var(--color-accent)` cannot be overridden by a CSS rule.

**The fix is to redefine the token on the parent, not to reach for
`!important`.** The inline reference then resolves to the new value. This is
how the carousel arrows, the callout links and the light-mode cards are all
handled. `[style*="var(--color-bg-dark)"]` is used to catch anonymous
inline-styled boxes without maintaining a list of unnamed divs.

---

## Verifying a change

Contrast is measured against computed styles in a real browser, not estimated
from the CSS. Two things will give false results:

- **Colour transitions.** `a { transition: color 0.3s }` means reading
  immediately after switching theme catches a half-faded value. Disable
  transitions before measuring.
- **Offscreen iframes.** Browsers throttle compositing for offscreen content,
  so transitions never advance there at all.
- **Guessing what the wallpaper's luminance is.** An earlier pass assumed the
  backdrop was around grey 70 and reported a clean sweep while grey card text
  was actually sitting at 3.05:1. *Measure the image file* (any blurred
  downsample plus the scrim will do) and run the check at the darkest, median
  and brightest values — the wallpaper is fixed and the content scrolls, so
  every card passes over every part of it.
- **Ignoring `backdrop-filter` when compositing.** With a `contrast()` or
  `brightness()` in the chain, the element's own background colour is not the
  whole story; the filter is applied to everything behind it first.

Sanity-check the checker itself by re-running it against the previous recipe.
If it does not light up, it is not measuring what you think it is.

One more trap, found the same way: **a gradient is a layer with its own
alpha.** Substituting an opaque colour for it turned the estimator's
15%-alpha wash into a solid fill and invented six failures. Average the
stops and composite them properly. Force dropdowns open and result panels
expanded before measuring, or you skip them entirely.

Current state: **10,848 text measurements — six pages × two themes × three
wallpaper brightnesses × desktop and mobile widths, with menus open — zero
contrast failures.**

---

## Where things are

| Thing | File |
|---|---|
| All prices | `js/pricing.js` |
| Phone number | `js/app.js` (`J7_PHONE`) **and** the JSON-LD in `index.html` |
| Design tokens | top of `css/styles.css` |
| Light-mode card rules | `css/styles.css`, the `[data-theme="light"]` blocks |
| Cache stamping | `scripts/stamp-assets.py` |
| Pricing tests | `scripts/verify-pricing.js` |

The phone number appears in two places on purpose: crawlers do not run the
JavaScript that fills the visible copies, so the structured data carries a
literal. **Keep them in sync.**

---

## Decisions that were made deliberately

Do not silently reverse these.

- **Remote support stays $25/hr.** It is the accessible entry point, held low
  on purpose. Everything else was raised toward market.
- **On-site labour is $45 / $60 / $85** by complexity, roughly 60% of national
  rate. Market research showed the previous rates were 2–20× *under* market,
  not over — a salaried IT tech in Tennessee earns more per hour than the
  business was charging.
- **Cameras and access points are priced per unit** with volume breaks, because
  that is how customers compare installers.
- **3D printing is cheaper on large jobs.** A 1kg print went from $91 to $52.
  The old flat per-gram rate scaled linearly forever.
- **No checks.** Cash, Venmo, Cash App and Net-7 invoicing only.
- **No testimonials or invented credibility.** There are none yet, so the site
  surfaces the real commitments instead: no markup on equipment with receipts
  shown, free first hour on site, 30-day callback on installs.

---

## Known gaps

- **No portfolio evidence for IT or field installation** — two of the three
  business lines. The six existing items are fabrication and signage. This is
  the weakest thing on the site and only new photos can fix it.
- Two of the portfolio entries are J7's own business cards, i.e. marketing
  collateral rather than client work.
- `about.html` and `portfolio.html` have no structured data.
- Roughly 350 inline `style` attributes remain, mostly layout one-offs.
- **Cloudflare Browser Cache TTL** should be set to *Respect Existing Headers*
  in the dashboard. The stamp script works around the override, but that
  setting removes the problem at source.

## The highest-value thing left is not code

A **Google Business Profile**. The site now has the phone number, service
radius and structured data that local search ranks on. For a business defined
by a 100-mile radius, that listing will do more than any further work here.
