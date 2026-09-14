# How to run and edit the J7 Creations website

The practical guide for changing the site yourself, with or without an AI
helper. `HANDOFF.md` has the long history of *why* things work the way they
do; you do not need it for everyday edits.

> Everything in this folder is also published on the website, including this
> file. Never put a password, API key or customer detail in any file here.

---

## 1. What the site is

- **Plain HTML, CSS and JavaScript.** No framework and nothing to compile. What
  you see in the files is what visitors get.
- **The code lives on GitHub:** https://github.com/jes7er9989/J7-creations.com
- **Cloudflare Pages publishes it.** Pushing to the `main` branch updates the
  live site in about a minute. There is no separate test copy online, so look
  at your change on your own PC first (section 4).
- **Three small pieces run on Cloudflare's servers**, in `functions/api/`:

  | File | What it does | Needs, set in the Cloudflare dashboard |
  | --- | --- | --- |
  | `chat.js` | the chat assistant | `ANTHROPIC_API_KEY` secret, `CHAT_RATE_LIMIT` KV binding |
  | `intake.js` | copies each contact-form enquiry into the CRM database | `DB` D1 binding, `INTAKE_SALT` secret |
  | `_push.js` | buzzes Thomas's phone for a new enquiry | `VAPID_PUBLIC_KEY` text, `VAPID_PRIVATE_KEY` secret |

  Those settings live in the Cloudflare dashboard: **Workers & Pages →
  j7-creations-com → Settings**. A changed setting only takes effect after a new
  deployment (**Deployments → ⋯ → Retry deployment**).

---

## 2. Tools to install once

| Tool | What it is for | Download |
| --- | --- | --- |
| Git | download, save and publish changes | https://git-scm.com |
| Node.js (the LTS version) | the check and build scripts | https://nodejs.org |
| Python 3 | the stamp script and a simple local web server | https://www.python.org |
| VS Code (optional) | an editor that shows every file and colours the code | https://code.visualstudio.com |

---

## 3. Get a copy

On this PC the site is already at `C:\Users\thoma\OneDrive\Desktop\J7-creations.com`.
On a new PC:

```bash
git clone https://github.com/jes7er9989/J7-creations.com.git
cd J7-creations.com
```

**Before you start editing, always get the latest version:**

```bash
git pull
```

---

## 4. See it on your own PC

### Quick way: pages, wording, prices and calculators

```bash
python -m http.server 8765
```

Open http://localhost:8765 and stop it with Ctrl+C. Two differences from the
live site:

- **Add `.html` to page addresses.** http://localhost:8765/pages/about.html
  works; `/pages/about` shows "not found" locally but works on the live site.
- **The chat assistant and the contact form's copy to the CRM do not work**,
  because those run on Cloudflare.

### Exact copy of the live site, including the chat assistant

```bash
npx wrangler pages dev . --port 8799 --kv CHAT_RATE_LIMIT
```

For the assistant to answer, first create a file called `.dev.vars` in the site
folder containing this one line, with the real key after the `=`:

```
ANTHROPIC_API_KEY=
```

`.gitignore` keeps `.dev.vars` out of Git. Never commit it, and remember every
local chat message costs real API money.

To test the contact form feeding the CRM, use the CRM's `npm run dev:site`
instead. The CRM's `START-HERE.md` explains it.

---

## 5. Find what to edit

Every setting you are likely to change is labelled in the code with the words
**EDIT HERE**. To list them all:

```bash
git grep -n "EDIT HERE"
```

In VS Code, press Ctrl+Shift+F and search for `EDIT HERE`.

| I want to change... | Where |
| --- | --- |
| any price, fee, minimum, rush or deposit rule | `js/pricing.js`, the `J7_PRICING` sections |
| towns and travel distances | `js/pricing.js`, `J7_SERVICE_AREA` |
| printers, nozzles, material weights | `js/pricing.js`, `J7_PRINTERS`, `J7_NOZZLES`, `J7_FILAMENT_DENSITY` |
| the questions the contact form asks | `js/pricing.js`, `J7_INTAKE` |
| the phone number | `js/app.js`, top of the file (recipe 6c) |
| business hours | several places (recipe 6d) |
| wording on a page | that page's `.html` file. Each page has a `PAGE CONTENT` note |
| FAQ answers | `pages/faq.html`, twice (recipe 6e) |
| the menu or footer | every `.html` file (they are copies) |
| colours | `css/styles.css`, top of the file |
| what the chat assistant is told | `scripts/build-chat-prompt.js`, `BEHAVIOUR` |
| the chat greeting | `js/chat.js`, `GREETING` |
| the chat model and cost limits | `functions/api/chat.js`, top of the file |
| offline caching (rarely) | `sw.js`, `CACHE_NAME` |

---

## 6. Recipes

### 6a. Change a price

1. Open `js/pricing.js` and find the price under its `EDIT HERE` section.
2. Change only the number. Keep the commas, quotes and brackets exactly as
   they are.
3. Run the after-edit checks (section 7).
4. Search the pages for the old figure in case it is also typed into the
   wording, for example `git grep -n "\$85"`.

### 6b. Add a town, or change a distance

1. In `js/pricing.js`, `J7_SERVICE_AREA`, add `{ town: "Name", miles: 12 },`.
   Miles are road miles from Milan.
2. Run `node scripts/build-service-area.js`. It rebuilds the town list on the
   installation page.
3. Run the after-edit checks (section 7).

### 6c. Change the phone number

1. `js/app.js`: set `J7_PHONE` (like `+17315551234`) and `J7_PHONE_DISPLAY`
   (like `(731) 555-1234`).
2. `index.html`: change `"telephone"` in the Local Business Schema near the
   top. Google reads that one directly.
3. Search for anything left over: `git grep -n "238-1438"` and
   `git grep -n "7312381438"`.
4. Run the after-edit checks.

### 6d. Change business hours

The hours are written in five places. Change all of them:

1. `index.html`, the Local Business Schema near the top
   (`openingHoursSpecification`).
2. `index.html`, the line above the contact form.
3. `pages/faq.html`, twice (see 6e).
4. The CRM's working hours: the CRM's `START-HERE.md`, "Changing business
   settings".
5. Your Google Business Profile.

### 6e. Change an FAQ answer

Each answer is written **twice** in `pages/faq.html`:

- in the `FAQPage` block near the top of the file, which Google and the chat
  assistant read
- in the visible sections further down, which visitors read

Change both copies the same way, then run `node scripts/build-chat-prompt.js`
so the assistant gives the new answer.

### 6f. Change a filament price

A filament's price per kg is also its ID, so it must match in three places:

1. `js/pricing.js`, `filamentPerKg`
2. `js/pricing.js`, the key in `J7_FILAMENT_DENSITY`
3. `pages/services-fabrication.html`, the `<option value="...">` in the material
   dropdown, and the `(~$../kg)` wording next to it

No two filaments may have the same price. `verify-pricing.js` checks this.

### 6g. Change what the chat assistant says

- **Rules and tone:** `scripts/build-chat-prompt.js`, the `BEHAVIOUR` text.
- **Prices, towns and printers:** filled in from `js/pricing.js` automatically.
- **Approved answers:** the FAQ (6e).

After any of those, run `node scripts/build-chat-prompt.js`. Commit the
regenerated `functions/api/_prompt.js` along with your change.

### 6h. Add a portfolio photo

Images are cached by visitors' browsers for a year, so **a changed image needs a
new file name**. Read rule 2 in `HANDOFF.md` and `scripts/optimize-media.sh`
before adding or replacing one.

---

## 7. After every edit

Run these from the site folder. When nothing relevant changed, they change
nothing, so it is safe to run them every time:

```bash
node scripts/verify-pricing.js         # must end with ALL CHECKS PASSED
node scripts/build-chat-prompt.js      # keeps the chat assistant in step with prices and the FAQ
python scripts/stamp-assets.py         # makes browsers fetch changed CSS and JavaScript
```

Then look at the changed pages locally (section 4):

- **Try it:** each calculator you touched, the menu on a narrow window, and
  both the light and dark themes (the moon/sun button).
- **Check for errors:** open the browser's developer tools (F12) → Console and
  make sure no red errors appeared. Two `ERR_ADDRESS_INVALID` lines about Google
  Tag Manager are normal on localhost.

---

## 8. Publish

```bash
git status                 # which files changed
git diff                   # read exactly what changed
git add -A
git commit -m "Say what you changed"
git push
```

The live site updates in about a minute. **Check it in a private or incognito
window**, because a normal window may show you your own cached copy of the old
version.

---

## 9. Undo a bad change

- **Quickest:** Cloudflare dashboard → Workers & Pages → j7-creations-com →
  Deployments. Open the last good deployment → **Rollback**. It is instant, but
  your next push publishes over it, so fix the code too.
- **In the code:**

  ```bash
  git log --oneline -5       # find the bad commit
  git revert <its id>        # makes a new commit that undoes it
  git push
  ```

---

## 10. Where things are

```
index.html                 the homepage (also the contact form)
404.html                   the not-found page
pages/                     every other page
css/styles.css             all styling; colours at the top
css/mobile-fix.css         phone-size adjustments
js/pricing.js              EVERY price and business number, plus the estimator maths
js/app.js                  phone number, menu, theme, calculators, contact form
js/chat.js                 the chat window in the corner
functions/api/chat.js      the chat assistant on Cloudflare
functions/api/_prompt.js   GENERATED by scripts/build-chat-prompt.js; do not edit
functions/api/intake.js    sends enquiries to the CRM
functions/api/_push.js     phone notifications
scripts/verify-pricing.js  the price checks
scripts/build-chat-prompt.js    builds the assistant's instructions
scripts/build-service-area.js   rebuilds the installation page's town list
scripts/stamp-assets.py    cache-busting stamps and "last updated" dates
sw.js                      offline support
_headers                   caching and security headers for Cloudflare
sitemap.xml, robots.txt    for search engines
assets/                    images and icons
HANDOFF.md                 the long history and reasoning
SECURITY.md                security headers and decisions
```
