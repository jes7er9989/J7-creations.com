#!/usr/bin/env python3
"""Stamp CSS/JS references with a hash of their content.

Why this exists
---------------
Cloudflare's free tier overrides Cache-Control with a 4-hour minimum, so an
edited stylesheet or script can keep serving stale to returning visitors long
after a deploy. That is not theoretical: it shipped a broken nav (the .submenu
rule missing) and hid a newly added phone number.

A *static* version string does not help — the site previously carried
`app.js?v=2026042802`, which never changed, so browsers pinned that file
forever. The stamp has to be derived from the file's content.

It also refreshes the "Site last updated" line in every footer and the
<lastmod> dates in sitemap.xml, which were typed by hand on six pages and so
were only ever correct until the next edit.

Run this after changing anything in css/ or js/, then commit the result:

    python scripts/stamp-assets.py
"""
import datetime, hashlib, io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = ('css/styles.css', 'css/mobile-fix.css', 'js/app.js', 'js/pricing.js')

def digest(rel):
    with open(os.path.join(ROOT, rel), 'rb') as fh:
        return hashlib.sha256(fh.read()).hexdigest()[:8]

def main():
    stamps = {}
    for rel in ASSETS:
        path = os.path.join(ROOT, rel)
        if not os.path.exists(path):
            print('missing, skipped:', rel); continue
        stamps[os.path.basename(rel)] = digest(rel)

    targets = ['index.html', '404.html', 'sw.js']
    targets += [os.path.join('pages', f) for f in sorted(os.listdir(os.path.join(ROOT, 'pages')))
                if f.endswith('.html')]

    today = datetime.date.today()
    stamp_month = today.strftime('%B %Y')
    stamp_iso = today.isoformat()

    changed = 0
    for rel in targets:
        path = os.path.join(ROOT, rel)
        if not os.path.exists(path):
            continue
        s = io.open(path, encoding='utf-8').read()
        before = s
        for name, h in stamps.items():
            # match the reference with or without an existing ?v= stamp
            s = re.sub(
                r'((?:\.\./|/)?(?:css|js)/' + re.escape(name) + r')(\?v=[0-9a-f]+)?',
                lambda m: m.group(1) + '?v=' + h, s)
        s = re.sub(r'(Site last updated: )[A-Z][a-z]+ \d{4}',
                   lambda m: m.group(1) + stamp_month, s)
        if s != before:
            io.open(path, 'w', encoding='utf-8', newline='').write(s)
            changed += 1
            print('stamped', rel)

    smap = os.path.join(ROOT, 'sitemap.xml')
    if os.path.exists(smap):
        s = io.open(smap, encoding='utf-8').read()
        s2 = re.sub(r'<lastmod>\d{4}-\d{2}-\d{2}</lastmod>',
                    '<lastmod>' + stamp_iso + '</lastmod>', s)
        if s2 != s:
            io.open(smap, 'w', encoding='utf-8', newline='').write(s2)
            changed += 1
            print('stamped sitemap.xml')

    print()
    print('  %-16s %s' % ('last updated', stamp_month))
    for name, h in sorted(stamps.items()):
        print('  %-16s ?v=%s' % (name, h))
    print('\n%d file(s) updated' % changed)

if __name__ == '__main__':
    sys.exit(main())
