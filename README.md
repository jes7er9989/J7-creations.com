# J7 Creations Website

The website for J7 Creations: tech support, 3D printing and fabrication,
network and field installation, and custom builds, in Milan and Atwood, TN.

- **Live:** https://j7creations.com
- **Repository:** https://github.com/jes7er9989/J7-creations.com
- **Hosting:** Cloudflare Pages. Pushing to `main` publishes the live site in
  about a minute.

## Start here

**`HOW-TO-RUN-AND-EDIT.md`** is the practical guide. It covers how to:

- run the site on your own PC
- find what to change
- make common changes (prices, towns, hours, phone, FAQ, the chat assistant)
- check your work, publish it and undo it

Every setting you are likely to change is labelled in the code with
**EDIT HERE**:

```bash
git grep -n "EDIT HERE"
```

`HANDOFF.md` has the longer history of why things work the way they do.

## The three rules

1. **All prices live in `js/pricing.js`.** After changing one, run
   `node scripts/verify-pricing.js` and `node scripts/build-chat-prompt.js`.
2. **After editing any CSS or JavaScript, run `python scripts/stamp-assets.py`**
   so visitors' browsers fetch the new file.
3. **A changed image needs a new file name.** Images are cached for a year.

## Contact form

The form posts to Formspree (form ID `xzdypkbz`, in `index.html`). Formspree
emails the enquiry. Once Formspree accepts it, `js/app.js` also sends a copy to
`functions/api/intake.js`, which writes it into the J7 CRM database and buzzes
the phone.

**Location:** Atwood, TN. Travel fees are measured from Milan.
**Service area:** 100-mile radius.
