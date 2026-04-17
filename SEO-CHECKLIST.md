# J7 Creations - SEO Setup Checklist

**Goal:** Get j7creations.com showing up in Google searches for "tech support Atwood TN", "3D printing Milan TN", etc.

**Time needed:** 30-45 minutes total
**Priority:** Do steps 1-3 TODAY

---

## ✅ Step 1: Google Search Console (10 minutes)

**This tells Google your site exists.**

### Choose Property Type
From the screen you're on:
- **Select: URL prefix** (right side)
- **Enter:** `https://j7creations.com`
- Click **CONTINUE**

*Why URL prefix instead of Domain?* Easier verification, you don't need to mess with DNS records.

### Verify Ownership

Google will show you 5 verification methods. Use **HTML file upload**:

1. **Download the HTML file** Google gives you
2. **Upload to Cloudflare Pages:**
   - Go to https://dash.cloudflare.com/
   - Select your j7creations.com site
   - Go to **Deployment** tab
   - You'll need to add the file to your GitHub repo instead:
     - Save the HTML file as `google[verification-code].html`
     - Upload to your j7-website GitHub repo root
     - Commit the change
     - Cloudflare will auto-deploy
3. **Click VERIFY** in Google Search Console

*Alternative - DNS verification (if you prefer):*
1. Choose "DNS record" method
2. Copy the TXT record value Google gives you
3. Go to Cloudflare Dashboard → DNS
4. Add record: Type=TXT, Name=j7creations.com, Content=paste the value
5. Click VERIFY

### Submit Your Sitemap

Once verified:
1. In Search Console, click **Sitemaps** (left sidebar)
2. Enter: `sitemap.xml`
3. Click **SUBMIT**
4. You should see: "Status: Success"

### Request Indexing

1. Click **URL Inspection** (top search bar)
2. Enter: `https://j7creations.com/`
3. Click **REQUEST INDEXING**
4. Wait 1-3 days for Google to crawl your site

---

## ✅ Step 2: Google Business Profile (15 minutes)

**This is CRITICAL for local searches like "tech support near me".**

### Create Your Profile

1. Go to https://www.google.com/business
2. Click **Manage now**
3. Sign in with your Google account

### Enter Business Info

**Business name:**
```
J7 Technical Solutions & Prototyping
```

**Business type:**
- Select: **Service-area business** (you go to clients, they don't come to you)
- UNCHECK "I serve customers at my business location"

**Service areas:**
Add these cities (100-mile radius):
- Atwood, TN
- Milan, TN
- Jackson, TN
- Martin, TN
- Union City, TN
- Dyersburg, TN
- Paris, TN
- Huntingdon, TN
- Trenton, TN
- Humboldt, TN

**Contact info:**
- Phone: Your business phone
- Website: https://j7creations.com
- Email: t.i@j7creations.com

**Business category:**
Add these categories:
1. Computer repair service (primary)
2. IT support
3. 3D printing service
4. Network infrastructure provider
5. Electronics repair shop

**Business hours:**
- Set your available hours (or "Open 24 hours" if you're flexible)

### Verification

Google will verify your business one of these ways:
- **Phone call** (fastest - usually instant)
- **Postcard by mail** (takes 5-7 days)
- **Email** (sometimes available)

**Choose phone verification if offered** — you'll get a code immediately.

### After Verification

Once verified:
1. Add photos (your logo, project photos from portfolio)
2. Write a business description (use your homepage description)
3. Add services with prices:
   - Remote Tech Support - $25/hour
   - Network Installation - Quote required
   - 3D Printing - Quote required
   - Field Installation - $25-50/hour

---

## ✅ Step 3: Bing Webmaster Tools (5 minutes)

**Covers Bing, Yahoo, DuckDuckGo searches.**

1. Go to https://www.bing.com/webmasters
2. Sign in with Microsoft account (or create one)
3. Click **Add Site**
4. Enter: `https://j7creations.com`
5. Verify ownership (same as Google - HTML file or DNS)
6. Submit sitemap: `sitemap.xml`
7. Wait 2-3 days for indexing

---

## ✅ Step 4: Local Directory Listings (20 minutes)

**These boost your SEO and provide backup traffic.**

### Nextdoor (High Priority - Hyperlocal)
1. Download Nextdoor app or go to nextdoor.com
2. Create business page: J7 Technical Solutions
3. Add services, service area, contact info
4. Ask neighbors/family to recommend you

### Yelp
1. Go to https://biz.yelp.com/
2. Create business page
3. Add photos, services, hours
4. Free listing (they'll try to sell you ads - decline)

### YellowPages
1. Go to https://www.yellowpages.com/
2. Add your business
3. Free basic listing

### Angi (formerly Angie's List)
1. Go to https://www.angi.com/
2. Create contractor profile
3. Free to list, they take leads

### Thumbtack
1. Go to https://www.thumbtack.com/
2. Create pro profile
3. Free to join, pay per lead

### Facebook Business
1. Create Facebook page: J7 Technical Solutions & Prototyping
2. Add services, hours, contact info
3. Link to your website

---

## ✅ Step 5: Ongoing SEO (Weekly, 10 minutes)

### Add Content Regularly
- Post project photos to your portfolio
- Share on social media (Facebook, Instagram)
- Ask satisfied customers for Google reviews

### Monitor Search Console
- Check **Performance** tab weekly
- See what searches people use to find you
- Add those keywords to your site

### Get Reviews
- After each job, ask: "Can you leave me a Google review?"
- More reviews = higher local rankings
- Respond to all reviews (good or bad)

---

## 📊 Expected Timeline

| Task | Time to Show Results |
|------|---------------------|
| Google Search Console | 1-3 days |
| Google Business Profile | 2-7 days (after verification) |
| Bing Webmaster Tools | 2-5 days |
| Local directories | 1-2 weeks |
| Organic search rankings | 2-8 weeks |
| First page for "tech support Atwood TN" | 2-4 weeks |

---

## 🎯 Success Metrics

You'll know it's working when:

1. **Google Search Console shows:**
   - Your pages are indexed (all 7 pages)
   - People are finding you via search
   - Click-through rate is increasing

2. **Google Business Profile shows:**
   - Your business appears in map pack
   - People are viewing your profile
   - Getting calls/directions from the listing

3. **Search results show:**
   - Search "j7 creations" → your site is #1
   - Search "tech support atwood tn" → you're in top 3 map results
   - Search "3d printing milian tn" → your site appears

---

## 🆘 Troubleshooting

### "Site not indexed after 1 week"
- Re-submit sitemap in Search Console
- Request indexing again for homepage
- Add more internal links between pages

### "Not showing up in local searches"
- Make sure Google Business Profile is verified
- Add more photos to your business profile
- Get at least 3-5 Google reviews
- Make sure service areas include the cities you're targeting

### "Getting traffic but no clicks"
- Improve your meta description (make it compelling)
- Add call-to-action in description
- Make sure your title includes what people are searching for

---

## 📞 Need Help?

**Google Search Console Help:**
https://support.google.com/webmasters

**Google Business Profile Help:**
https://support.google.com/business

**SEO Best Practices:**
https://developers.google.com/search/docs/beginner/seo-starter-guide

---

## ✅ Checklist Summary

- [ ] Google Search Console - URL prefix verification
- [ ] Submit sitemap.xml to Google
- [ ] Request indexing for homepage
- [ ] Google Business Profile - create and verify
- [ ] Add photos and services to Google Business
- [ ] Bing Webmaster Tools - add site
- [ ] Nextdoor business page
- [ ] Yelp business page
- [ ] Facebook business page
- [ ] Ask first customer for Google review

**Start with the top 3 — those will get you 80% of results.**
