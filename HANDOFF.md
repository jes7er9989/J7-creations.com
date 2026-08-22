# J7 Creations — Handoff

> **State as of 19 Aug 2026.** Everything on the live site is deployed.
> The **chatbot is built but not deployed** — it lives on the `chatbot`
> branch and needs two things set in the Cloudflare dashboard before it can
> work. See *The chatbot* near the end. Nothing else is in flight.

**Last updated:** 19 August 2026
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

The same script also refreshes the "Site last updated" line in every footer
and the `<lastmod>` dates in `sitemap.xml`. Those were typed by hand on six
pages, which meant they were right the day they were written and wrong from
the next edit onward. Do not edit them directly.

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

**A price change is not finished until the assistant's prompt is rebuilt.**
The chatbot quotes from a prompt compiled out of this file, so an un-rebuilt
prompt means the bot quotes last month's rates while the calculators quote
this month's:

```bash
node scripts/build-chat-prompt.js
```

---

## Four things that will bite you

### Internal links must not end in `.html`

Cloudflare Pages serves `/pages/about`, and **308-redirects** `/pages/about.html`
to it. Fifty-four links, every canonical, every `og:url`, the sitemap and the
service worker's precache list all pointed at the redirecting form, so every
navigation on the site cost an extra round trip and search engines were handed
a canonical that redirects.

The local preview does the opposite: `python -m http.server` has no clean-URL
rewriting, so `/pages/about` **404s locally while working correctly in
production**. Verify navigation against the live site, not the preview.

### Anchor targets need `scroll-margin-top`

The navbar is fixed and 90px tall. A fragment jump scrolls the target's top
edge to y=0, which is *underneath* it — `#remote-support` used to put its
heading at y=27, invisible. `--nav-offset` plus a `[id] { scroll-margin-top }`
rule handles this for every id, including ones added later, and also keeps an
invalid form field from landing under the bar on submit.

### Your browser will lie to you about whether a deploy worked

Twice this session a production check returned the *old* prices from a page
whose asset stamp had already updated — the browser was holding cached
JavaScript, and once a registered service worker was serving it. Clearing
service workers and caches and reloading gave the right numbers.

**Verify a deploy by fetching the HTML with `curl` and grepping for the new
stamp**, not by looking at a page you already had open. When checking in a
browser, unregister the service worker first:

```js
navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
caches.keys().then(ks => ks.forEach(k => caches.delete(k)));
```

### A test file that crashes is not a test file that fails

`check()` in `verify-pricing.js` takes **`(label, condition)`**. New assertions
written with the arguments reversed *passed* — on a truthy string — while
testing nothing. And a block pasted at the wrong indent landed inside another
function's scope and threw a `ReferenceError` instead of reporting a failure.

Both look like success at a glance. After adding checks, deliberately break one
and confirm it reports FAIL.

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

## Estimators: the customer never supplies expertise

The governing rule, learned the hard way twice. **Never ask a customer for a
number that is the reason they are hiring you.** They cannot answer it, so they
guess or leave, and either way the estimate is worthless.

Two fields broke this and both are gone:

- **"Part Weight" in grams.** Someone holding a broken bracket owns no scale
  and has never sliced anything. Replaced with three routes — describe the part
  (everyday-object size + shape), upload an STL/OBJ (parsed in the browser, no
  upload), or type a weight if you genuinely know it.
- **"Estimated hours"** on both the IT and installation calculators. Knowing
  how long a job takes *is the service*. Replaced with scope pickers for remote
  support, and with what/how-many/surface/height on site.

Ask what the customer can see. Derive the rest.

### The print weight model

`printed = min(area × wall, solid) + (solid − shell) × infill`

One formula, both behaviours: a 3 mm bracket is entirely wall so infill barely
moves it (85 g at 5%, 94 g at 100%), while a solid part swings 289 g → 1004 g.
A 20 mm cube reads 8.00 cm³ / 24.0 cm² exactly and 9.9 g at 100% infill, which
is its true solid weight.

Wall thickness comes from the nozzle (`nozzle × 1.125 × 3 perimeters`), so the
four nozzles give 0.68 / 1.35 / 2.02 / 2.70 mm of wall. That matters: it was
fixed at 1.35 mm, silently wrong for three of the four.

Build plate is **350 × 350 × 350**, in one constant, checked with sorted axes
so a part that can be *turned* to fit counts as fitting.

### The on-site hours model

Base hours per task × quantity, times surface and height factors — because
brick, height and awkward access are what actually make a job overrun. The
multipliers are printed in the breakdown ("0.75 hr each × 4, Brick or block
adds 40%") so a customer can argue with the arithmetic instead of trusting it.

A rack is one job with a per-unit tail, not N racks. Fault-finding says plainly
that it is open-ended.

### Machine time is not proportional to weight

Print machine time carries a **nozzle factor** (2.0 / 1.0 / 0.67 / 0.5 across
0.2–0.8 mm), calibrated so 0.4 mm is exactly 1.0 and existing quotes did not
move. Without it a 0.8 mm job billed *more* while printing in *half* the time,
and a 0.2 mm job billed less while taking far longer. Charging per gram assumes
grams and hours track each other; nozzle size breaks that in both directions.

---

## The cable run that was priced nowhere

Worth its own heading because it was invisible for so long. **"Cable run"
appeared in the site copy and in no calculator and nowhere in `pricing.js`** —
despite being the biggest labour item on a network job. The per-AP price
quietly looked like it covered one, which made a fresh install underpriced and
a job with existing cable overpriced.

Now a priced line in three places (IT calculator, installation calculator as a
job in its own right, homepage ballpark), banded by how hard the pull is:
**$80 easy / $125 standard / $205 difficult**.

Derived from 2026 market data ($125–300 per drop typical, $500–850 hard
retrofits, materials $20–25, labour 60–70% of the total) against the $60/hr
network rate. They sit at or under the market low, which is where a rural solo
operator belongs.

**Network design was rebased** from `$150 + $50/AP` to `$60 + $35/AP`. The old
formula was reverse-engineered to fit an advertised "$200–800" rather than
built from hours, and charged 2.7 hours of design for a single-AP plan.

---

## Calibrated from market data, not from Thomas

These are the numbers most likely to be wrong. All were derived from research
because Thomas did not have the figures to hand. **Ask him to check them
against a real job before treating them as settled.**

| Number | Current | Basis |
|---|---|---|
| Cable run, easy / standard / difficult | $80 / $125 / $205 | 1.0 / 1.75 / 3.0 hr + materials |
| Mount a bracket | 0.75 hr each | estimate |
| Fit network equipment | 1.0 hr each | estimate |
| Rack build | 3 hr + 0.5/unit | estimate |
| Fault-finding | 1.5 hr | open-ended by nature |
| Surface factors | brick +40%, metal +30%, siding +15% | estimate |
| Height factors | above ground +25%, roof +50% | estimate |
| Print shape occupancy | thin 7%, hollow 14%, normal 40%, solid 75% | validated against 6 reference parts |

The print shape factors were checked against real parts including two from the
portfolio and land inside a sane range; the labour hours have had no such
check.

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
| Chat widget | `js/chat.js` (built in JS — no markup in any page) |
| Chat backend | `functions/api/chat.js` |
| Chat prompt | generated — `scripts/build-chat-prompt.js` → `functions/api/_prompt.js` |

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
- ~~`about.html` and `portfolio.html` have no structured data.~~ Done —
  all seven pages now carry JSON-LD.
- Roughly 350 inline `style` attributes remain, mostly layout one-offs.
- **Cloudflare Browser Cache TTL** should be set to *Respect Existing Headers*
  in the dashboard. The stamp script works around the override, but that
  setting removes the problem at source.

---

## The chatbot

Built, tested locally, **not deployed**. It lives on the `chatbot` branch and
does nothing until the two Cloudflare settings below exist.

**Scope:** pricing, questions about Thomas and how the business works, site
navigation, and walking someone to a quote. **Out of scope, on purpose:** tech
support answers and product recommendations — the first is the paid service,
the second is how people buy the wrong thing.

### How it fits together

```
js/chat.js  →  POST /api/chat  →  functions/api/chat.js  →  Anthropic API
                                        ↑
                              functions/api/_prompt.js
                              (generated from pricing.js + the FAQ)
```

The widget is built in JavaScript and appended to `<body>`, so there is no
chat markup in any of the seven pages and nothing to keep in sync. It styles
itself with the existing `.panel` treatment, which is what makes it work in
both themes for free.

### The prompt is generated, and that is the point

`scripts/build-chat-prompt.js` compiles the system prompt from `js/pricing.js`
and the `FAQPage` JSON-LD already in `pages/faq.html` — every rate, band,
travel tier, town and approved answer, about 3,200 tokens of it. **No number
is typed by hand anywhere in that script.**

A hand-written prompt drifts the first time a rate changes, and a bot quoting
last month's price is worse than no bot. Rebuild it after any pricing or FAQ
edit, and commit the result: Pages has no build step, so the generated file is
what ships.

The behaviour half — scope, voice, what it may promise — is hand-written in
`BEHAVIOUR` at the bottom of that script. That is the part worth arguing with.

### Decisions Thomas made (19 Aug 2026)

- **A quote conversation ends at the contact form.** The bot offers to send
  the estimate; the customer says yes; it fills in the form. It reuses the
  same `sessionStorage` handoff the three calculators already use, so the
  enquiry arrives with the breakdown in it.
- **It may state a price**, always as *"the calculator says roughly $X —
  Thomas confirms before any work starts."* Never a commitment, never a
  number that did not come from `pricing.js`.
- **Haiku 4.5 to start**, in one constant (`MODEL` in `functions/api/chat.js`),
  to be swapped for Opus 5 if it disappoints. Cost per six-exchange
  conversation with the prompt cached: Haiku about \$0.009, Opus about \$0.044.

### Before it can go live

1. **Set the API key.** Cloudflare Pages → the project → Settings →
   Environment variables → add `ANTHROPIC_API_KEY` **as a secret**, on
   Production and Preview. Never in the repo.
2. **Bind a KV namespace called `CHAT_RATE_LIMIT`.** Pages → Settings →
   Functions → KV namespace bindings. The function *refuses to answer at all*
   without it, deliberately — an uncapped endpoint holding an API key is the
   one mistake that costs real money.
3. **Set a spend cap in the Anthropic console.** The caps in the code (30
   requests per IP per hour, 24 turns, 2,000 characters a message, 500 output
   tokens) bound the damage; only the console cap stops it.

Until step 1 and 2 exist the widget shows *"The assistant is not configured
yet"* rather than failing silently.

### How it was tested

Locally against a static server, which has no `/api/chat` — so the failure
path, the estimate handoff, both themes and mobile were all verified, and the
model conversation was not. **The first real conversation is still untested.**

Verified: the widget renders and opens on every page; the conversation
survives a page load (it is in `sessionStorage`, and every link here is a full
page load); a failed send rolls the message back into the box instead of
leaving two user turns in a row, which the API rejects; the estimate block
becomes a button and never reaches the screen as JSON; and the handoff fills
in the contact form from a page with `pricing.js` loaded and from one without.

To test it properly, with the function running:

```bash
npx wrangler pages dev . --binding ANTHROPIC_API_KEY=sk-... --kv CHAT_RATE_LIMIT
```

### What is worth watching once it is live

- **Scope holding.** Scope is a prompt, not a fence. Models follow it well,
  not perfectly. The short `max_tokens` helps — it cannot write a tutorial if
  it cannot write at length — but read the first few real conversations.
- **Whether it quotes correctly.** Every figure should be traceable to
  `pricing.js`. One that is not means the prompt needs tightening, not the
  rates.
- **The contrast run.** The widget was added after the last full audit and
  has not been through one. Its text sits on the same frosted `.panel` as
  every audited card, but include it in the next sweep.

### Still open, and not blocked on code

- A **case study** template was drafted for the waterproof enclosure (problem
  → approach → cost → result) using existing photos. Thomas liked the idea;
  the real job details were never supplied, so nothing was written. The draft
  invented every specific and was flagged as such.
- The **AI-crawler block** in `robots.txt` is still on — Cloudflare injects
  rules disallowing GPTBot, ClaudeBot, CCBot and Google-Extended. Normal
  search is unaffected. Thomas's call whether to turn it off.
- **www.j7creations.com** now resolves (he fixed it) but *serves* the site
  rather than redirecting to the apex. Canonicals point at the apex so search
  consolidates correctly; a redirect would be tidier but nothing is broken.

---

## The highest-value thing left is not code

A **Google Business Profile**. The site now has the phone number, service
radius and structured data that local search ranks on. For a business defined
by a 100-mile radius, that listing will do more than any further work here.
