# J7 Creations Website

**J7 Technical Solutions & Prototyping** - Enterprise IT, Custom Fabrication, Integrated Deployment

## Deployment (Cloudflare Pages via Git)

This site deploys exactly like Ashes of Command — push to Git, Cloudflare Pages auto-deploys.

### Setup Steps

1. **Create GitHub Repository**
   ```bash
   cd /home/thomas/.openclaw/workspace/j7-website
   git remote add origin https://github.com/YOUR_USERNAME/j7-creations.git
   git push -u origin main
   ```

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

4. **Set Up Contact Form**
   - Go to https://formspree.io/
   - Create a free account
   - Create a new form
   - Copy your form ID
   - Edit `index.html` line ~180: Replace `YOUR_FORM_ID_HERE` with your actual Formspree form ID
   - Commit and push

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

Generate icons at https://realfavicongenerator.net/ and place in `assets/icons/`:
- `icon-192x192.png`
- `icon-512x512.png`
- `favicon-32x32.png`
- `apple-touch-icon.png`

### Site Structure

```
j7-website/
├── index.html                    # Homepage
├── manifest.json                 # PWA manifest
├── sw.js                         # Service worker (offline support)
├── assets/
│   ├── images/
│   │   ├── j7-logo.png
│   │   └── portfolio/           # Portfolio photos
│   └── icons/                   # PWA icons
├── css/
│   ├── styles.css               # Main stylesheet
│   └── admin.css                # (Future admin page)
├── js/
│   └── app.js                   # Portfolio tabs, mobile nav
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
