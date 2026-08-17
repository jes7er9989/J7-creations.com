# J7 Creations Website

**J7 Technical Solutions & Prototyping** - Enterprise IT, Custom Fabrication, Integrated Deployment

## Changing prices

**All rates live in one file: `js/pricing.js`.** Edit the constant there and every
calculator and pricing table on the site updates together — do not edit prices
in the HTML, they are overwritten from that file on load.

After changing a rate, run the check:

```bash
node scripts/verify-pricing.js
```

It enforces the rule that a bigger job must never cost less than a smaller one,
and confirms the advertised price ranges still match what the calculators produce.

## Adding the business phone number

Fill in `J7_PHONE` and `J7_PHONE_DISPLAY` at the top of `js/app.js`. Every phone
link, footer, and contact line fills itself in from there. Until both are set,
phone elements stay hidden rather than showing a placeholder.

Also add a `"telephone"` field to the LocalBusiness schema block in `index.html` —
search crawlers do not run the JavaScript, so that one has to be typed in literally.

## Deployment (Cloudflare Pages via Git)

Push to `main` and Cloudflare Pages auto-deploys in ~30 seconds. No build step.

**Repository:** https://github.com/jes7er9989/J7-creations.com

### First-time setup (already done)

2. **Connect to Cloudflare Pages**
   - Go to https://dash.cloudflare.com/?to=/:account/pages
   - Click "Create a project"
   - Select "Connect to Git"
   - Choose the `j7-creations` repository
   - Click "Begin setup"

3. **Configure Build Settings**
   - **Framework preset:** None (static site)
   - **Build command:** (leave blank)
   - **Build output directory:** `/` (root)
   - Click "Save and Deploy"

4. **Contact Form** — already live. Formspree form ID `xzdypkbz`, wired up in
   `index.html` at the `#contact-form` action. Free tier is 50 submissions/month.

5. **Add Custom Domain (Optional)**
   - In Cloudflare Pages → j7-creations → Custom domains
   - Add `j7creations.com`
   - Update DNS as instructed

### Portfolio Images

Add your portfolio photos to `assets/images/portfolio/`:
- `enclosure.jpg`
- `finishline-sign.jpg`
- `vesa-mount.jpg`
- `nameplate.jpg`
- `wifi-deployment.jpg`
- `rack-mount.jpg`

### PWA Icons

Already generated in `assets/icons/` (192, 512, favicon, apple-touch), cropped to
the J7 monogram with maskable safe-zone padding. To regenerate after a logo
change, the 512 and 192 need the mark at ~74% of the canvas so Android's
circular crop doesn't clip it.

### Images

The logo is served as JPEG, not PNG — it is a photographic 3D render, so PNG cost
6.76MB for the same picture that JPEG delivers in 213KB. `j7-logo.jpg` (1600px) is
the page background and social share image; `j7-logo-nav.jpg` (480px) is the navbar.
Keep new portfolio photos under ~400KB; `scripts/optimize-media.sh` handles bulk resizing.

### Site Structure

```
J7-creations.com/
├── index.html                    # Homepage
├── manifest.json                 # PWA manifest
├── sw.js                         # Service worker (network-first for content)
├── assets/
│   ├── images/
│   │   ├── j7-logo.jpg           # Background + social (1600px)
│   │   ├── j7-logo-nav.jpg       # Navbar (480px)
│   │   └── portfolio/            # Portfolio photos
│   └── icons/                    # PWA icons + favicons
├── css/
│   ├── styles.css                # Main stylesheet
│   └── mobile-fix.css            # Mobile responsive polish
├── js/
│   ├── pricing.js                # ALL RATES LIVE HERE - single source of truth
│   └── app.js                    # Phone wiring, theme, tabs, nav, contact form
├── scripts/
│   └── verify-pricing.js         # Run after any price change
└── pages/
    ├── services-it.html
    ├── services-fabrication.html
    ├── services-installation.html
    ├── about.html
    └── portfolio.html
```

## Contact Form

The contact form uses Formspree (free tier: 50 submissions/month). Submissions go to your email directly — no dashboard needed.

## Updates

To update the site:
```bash
# Edit files
git add .
git commit -m "Description of changes"
git push
```

Cloudflare Pages will auto-deploy in ~30 seconds.

---

**Built for:** J7 Technical Solutions & Prototyping  
**Location:** Atwood, TN  
**Service Area:** 100-mile radius
