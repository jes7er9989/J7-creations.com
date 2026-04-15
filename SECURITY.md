# J7 Creations - Security Setup Guide

## Current Security Measures

✅ **Security Headers** - Prevent XSS, clickjacking, MIME sniffing
✅ **robots.txt** - Blocks admin page from search engines
✅ **sitemap.xml** - Helps search engines index public pages
✅ **hCaptcha Ready** - Contact form protection (needs activation)

## Traffic from Poland - What to Do

### 1. Check Cloudflare Analytics
- Go to: https://dash.cloudflare.com/
- Select your domain (j7creations.com)
- Navigate to: **Analytics & Logs** → **Security**
- Look for:
  - Request patterns (are they hitting the same page repeatedly?)
  - Threat scores
  - User agents (legitimate browsers vs bots)

### 2. Enable Bot Fight Mode (FREE)
1. Cloudflare Dashboard → **Security** → **Bots**
2. Toggle **Bot Fight Mode** to ON
3. This automatically challenges suspicious bots

### 3. Set Up hCaptcha for Contact Form (FREE)
**Why:** Prevents spam form submissions from bots

**Steps:**
1. Go to https://www.hcaptcha.com/
2. Sign up for free account
3. Register your site (j7creations.com)
4. Copy your **Site Key** and **Secret Key**
5. Update `index.html`:
   - Replace `YOUR_HCAPTCHA_SITEKEY` with your actual site key
6. Update Formspree or your form handler to verify hCaptcha response

**Formspree Integration:**
- Formspree supports hCaptcha natively
- Add `?captcha=hcaptcha` to your form action URL
- Or verify in Formspree dashboard settings

### 4. Create Firewall Rules (FREE - up to 5 rules)

**Option A: Rate Limiting (if they're hammering your site)**
```
Rule: (ip.geoip.country eq "PL") and (http.request.uri.path contains "/")
Action: Managed Challenge
Rate: 100 requests per 10 minutes
```

**Option B: Challenge All Traffic from Specific Countries**
```
Rule: ip.geoip.country eq "PL"
Action: Managed Challenge
```
*Note: Only do this if you're sure you don't need Polish visitors*

**Option C: Block Specific IPs**
```
Rule: ip.src in {1.2.3.4 5.6.7.8}
Action: Block
```

### 5. Monitor Google Analytics

Check if the traffic is legitimate:
- **Realtime** → See what they're doing right now
- **Engagement** → Are they staying on pages or bouncing immediately?
- **Events** → Are they submitting forms?

**Legitimate visitor signs:**
- Spending time on pages (>30 seconds)
- Viewing multiple pages
- Low bounce rate

**Bot signs:**
- Instant bounces (<5 seconds)
- Hitting same page repeatedly
- No mouse movement (if you have heatmaps)

## Quick Actions Based on Traffic Type

### If it's form spam:
✅ Enable hCaptcha (see step 3)
✅ Formspree has built-in spam filtering - check settings

### If it's scanning/enumeration:
✅ Enable Bot Fight Mode (step 2)
✅ Security headers already block most attacks

### If it's high volume but harmless:
✅ Set up rate limiting (step 4, Option A)
✅ Consider enabling "Under Attack Mode" temporarily

### If it's legitimate traffic:
✅ Do nothing! Remote tech support is nationwide - could be a customer

## Cloudflare Security Checklist

- [ ] Bot Fight Mode: ON
- [ ] Web Application Firewall (WAF): ON (free tier)
- [ ] SSL/TLS: Full (strict)
- [ ] Always Use HTTPS: ON
- [ ] Automatic HTTPS Rewrites: ON
- [ ] hCaptcha: Configured (once you get keys)

## Contact Form Spam Protection

Current: Security headers + hCaptcha ready
Recommended: 
1. Enable hCaptcha
2. Set up Formspree spam filtering
3. Add honeypot field (invisible to humans)

## Need More Help?

If traffic escalates or you see:
- Failed login attempts (even though there's no login)
- SQL injection attempts
- Path traversal attacks (/../../../etc/passwd)
- High volume from single IP

**Immediate actions:**
1. Enable "Under Attack Mode" in Cloudflare
2. Check Cloudflare Security Events log
3. Create firewall rule to challenge/block offending IPs

---

**Remember:** Some traffic from Poland could be legitimate! Your remote tech support is available nationwide, so don't block an entire country unless you're sure it's malicious.
