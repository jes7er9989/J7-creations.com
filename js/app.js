// J7 Creations - Main Application JavaScript
// Version: 2026-08-17

// ========== Business Phone ==========
// TO ADD THE GOOGLE VOICE NUMBER: fill in both values below. Every phone
// link, footer, and contact line on the site fills itself in from here, so
// this is the only place it needs to change.
//
// If either is blanked, phone elements hide themselves rather than showing a
// half-set or placeholder number. The same number is also in the
// LocalBusiness schema in index.html, which crawlers read directly.
const J7_PHONE = '+17312381438';
const J7_PHONE_DISPLAY = '(731) 238-1438';

function j7PopulatePhone() {
    const configured = J7_PHONE && J7_PHONE_DISPLAY;

    document.querySelectorAll('[data-j7-phone]').forEach(el => {
        if (!configured) {
            el.style.display = 'none';
            return;
        }
        el.style.removeProperty('display');
        if (el.tagName === 'A') {
            el.href = 'tel:' + J7_PHONE;
            // hasAttribute, not dataset: a valueless attribute reads back as
            // '' from dataset, which is falsy, so the label got overwritten.
            if (!el.hasAttribute('data-j7-phone-keep-text')) el.textContent = J7_PHONE_DISPLAY;
        } else {
            el.textContent = J7_PHONE_DISPLAY;
        }
    });

    // Text links. sms: is a separate scheme from tel: and needs its own
    // href, but it comes from the same single constant.
    document.querySelectorAll('[data-j7-sms]').forEach(el => {
        if (!configured) {
            el.style.display = 'none';
            return;
        }
        el.style.removeProperty('display');
        el.href = 'sms:' + J7_PHONE;
    });

    // Whole blocks that only make sense once a number exists
    document.querySelectorAll('[data-j7-phone-block]').forEach(el => {
        el.style.display = configured ? '' : 'none';
    });
}

document.addEventListener('DOMContentLoaded', () => {

    j7PopulatePhone();

    // ========== Theme Toggle (remembers preference) ==========
    // The theme itself is applied by the inline script in <head>, before first
    // paint — setting it here would flash dark before switching to light.
    const themeToggle = document.querySelector('.theme-toggle');
    const html = document.documentElement;

    function reflectThemeState() {
        if (!themeToggle) return;
        const isLight = html.getAttribute('data-theme') === 'light';
        themeToggle.setAttribute('aria-pressed', String(isLight));
        themeToggle.setAttribute('aria-label',
            isLight ? 'Switch to dark theme' : 'Switch to light theme');
    }

    reflectThemeState();

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = html.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            html.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme); // Save preference
            reflectThemeState();
        });
    }
    
    // ========== Portfolio Tabs ==========
    const tabBtns = document.querySelectorAll('.tab-btn');
    const portfolioItems = document.querySelectorAll('.portfolio-item');
    
    // Ensure all items are visible by default - use flex for grid items
    portfolioItems.forEach(item => {
        item.style.display = 'flex';
    });
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => {
                b.classList.remove('active');
                if (b.hasAttribute('role')) b.setAttribute('aria-selected', 'false');
            });
            btn.classList.add('active');
            if (btn.hasAttribute('role')) btn.setAttribute('aria-selected', 'true');
            
            const category = btn.dataset.tab;
            
            portfolioItems.forEach(item => {
                if (category === 'all' || item.dataset.category === category) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });
    
    // ========== Services Submenu ==========
    // Hover alone is not enough: it excludes keyboard and touch users, and
    // the three service pages are the only route to the detailed pricing.
    const submenuToggle = document.querySelector('.submenu-toggle');
    const submenu = document.getElementById('services-submenu');

    if (submenuToggle && submenu) {
        const isMobileLayout = () => window.matchMedia('(max-width: 768px)').matches;

        const closeSubmenu = () => submenuToggle.setAttribute('aria-expanded', 'false');

        submenuToggle.addEventListener('click', () => {
            if (isMobileLayout()) return; // always expanded in the mobile menu
            const open = submenuToggle.getAttribute('aria-expanded') === 'true';
            submenuToggle.setAttribute('aria-expanded', String(!open));
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.has-submenu')) closeSubmenu();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && submenuToggle.getAttribute('aria-expanded') === 'true') {
                closeSubmenu();
                submenuToggle.focus();
            }
        });
    }

    // ========== Mobile Navigation ==========
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');
    
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            const open = navMenu.classList.toggle('active');
            navToggle.setAttribute('aria-expanded', String(open));
        });
        
        // Close mobile menu when clicking a link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
                navToggle.setAttribute('aria-expanded', 'false');
            });
        });
    }
    
    // ========== Smooth Scroll for Anchor Links ==========
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (!href || href === '#') return;
            
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // ========== Contact Form AJAX Submission ==========
    const contactForm = document.getElementById('contact-form');
    const formSuccess = document.getElementById('form-success');
    const submitBtn = document.getElementById('submit-btn');
    
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Disable submit button
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Sending...';
            }
            
            const formData = new FormData(contactForm);
            
            try {
                const response = await fetch(contactForm.action, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                if (response.ok) {
                    // Show success message
                    if (formSuccess) {
                        formSuccess.style.display = 'block';
                    }
                    
                    // Hide form
                    contactForm.style.display = 'none';
                    
                    // Scroll to success message
                    formSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    const data = await response.json();
                    alert('Oops! There was a problem sending your message: ' + (data.errors ? data.errors.join(', ') : 'Please try again.'));
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Send Message';
                    }
                }
            } catch (error) {
                console.error('Form submission error:', error);
                alert('Oops! There was a problem sending your message. Please try again or email directly.');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Send Message';
                }
            }
        });
    }
    
    // ========== Print weight helper ==========
    // Three routes to a gram figure, all of them ending in the estimator's own
    // weight field. See js/pricing.js for the model.
    (function j7WeightHelper() {
        const root = document.getElementById('weight-helper');
        if (!root || typeof j7GramsFromDescription !== 'function') return;

        const el = id => document.getElementById(id);
        const sizeSel  = el('wh-size');
        const shapeSel = el('wh-shape');
        const infillSel = el('wh-infill');
        const dimsWrap = el('wh-dims-wrap');
        const result   = el('wh-result');
        const meshOut  = el('wh-mesh');
        const fileIn   = el('wh-file');
        const infillWrap = el('wh-infill-wrap');
        const weightField = el('part-weight');
        const unitField   = el('weight-unit');
        const materialSel = el('material-type');

        let mesh = null;   // set once a file has been read
        let mode = 'describe';

        // --- populate the selects from the single source of truth -----------
        J7_SIZE_REFS.forEach((r, i) => {
            sizeSel.add(new Option(r.label, String(i)));
        });
        sizeSel.add(new Option('I would rather give measurements', 'custom'));
        sizeSel.value = '3';

        J7_PART_SHAPES.forEach(s => shapeSel.add(new Option(s.label, s.id)));
        shapeSel.value = 'normal';

        J7_INFILL.forEach(f => {
            const o = new Option(f.label, String(f.value));
            infillSel.add(o);
            if (f.preset) infillSel.value = String(f.value);
        });

        const density = () => J7_FILAMENT_DENSITY[materialSel && materialSel.value] || 1.24;

        // --- write the answer into the estimator ----------------------------
        function apply(grams, note) {
            if (!isFinite(grams) || grams <= 0) { result.hidden = true; return; }
            const g = grams < 10 ? grams.toFixed(1) : String(Math.round(grams));
            // The option's value is 'g'; only its label reads "grams".
            if (unitField) unitField.value = 'g';
            weightField.value = g;
            // convertWeight() is the page's own handler; fire the events it
            // listens for rather than calling it directly, so this keeps
            // working if the page changes how it is wired.
            weightField.dispatchEvent(new Event('input', { bubbles: true }));
            if (unitField) unitField.dispatchEvent(new Event('change', { bubbles: true }));
            result.hidden = false;
            result.innerHTML = '<strong>About ' + g + ' g</strong> &mdash; filled into the weight field below. '
                + (note || '') + ' Adjust it if you know better; either way I confirm the real figure before printing.';
        }

        function recalc() {
            if (mode === 'manual') { result.hidden = true; return; }
            const infill = parseFloat(infillSel.value);

            if (mode === 'file') {
                if (!mesh) { result.hidden = true; return; }
                apply(j7GramsFromMesh(mesh.volumeCm3, mesh.areaCm2, infill, density()),
                      'Measured from your file.');
                return;
            }

            let dims;
            if (sizeSel.value === 'custom') {
                const v = ['wh-l', 'wh-w', 'wh-h'].map(id => parseFloat(el(id).value));
                if (v.some(x => !isFinite(x) || x <= 0)) { result.hidden = true; return; }
                dims = v.map(x => x * 2.54);          // inches in, cm out
            } else {
                dims = J7_SIZE_REFS[+sizeSel.value].dims;
            }
            apply(j7GramsFromDescription(dims[0], dims[1], dims[2],
                                         shapeSel.value, infill, density()),
                  'A rough estimate from the size and shape.');
        }

        // --- tabs ------------------------------------------------------------
        root.querySelectorAll('.wh-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                mode = tab.dataset.mode;
                root.querySelectorAll('.wh-tab').forEach(t => {
                    const on = t === tab;
                    t.classList.toggle('active', on);
                    t.setAttribute('aria-selected', on ? 'true' : 'false');
                });
                ['describe', 'file', 'manual'].forEach(m => {
                    el('wh-panel-' + m).hidden = (m !== mode);
                });
                // Infill is meaningless when someone types a weight they have
                // already measured — that number is the printed part.
                infillWrap.hidden = (mode === 'manual');
                recalc();
            });
        });

        sizeSel.addEventListener('change', () => {
            dimsWrap.hidden = (sizeSel.value !== 'custom');
            recalc();
        });

        [shapeSel, infillSel, materialSel].forEach(s => {
            if (s) s.addEventListener('change', recalc);
        });
        ['wh-l', 'wh-w', 'wh-h'].forEach(id => el(id).addEventListener('input', recalc));

        // --- file ------------------------------------------------------------
        fileIn.addEventListener('change', () => {
            const f = fileIn.files && fileIn.files[0];
            if (!f) return;
            meshOut.hidden = false;
            meshOut.textContent = 'Reading ' + f.name + '…';
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    mesh = /\.obj$/i.test(f.name)
                        ? j7ParseOBJ(new TextDecoder().decode(reader.result))
                        : j7ParseSTL(reader.result);
                } catch (e) {
                    mesh = null;
                }
                if (!mesh) {
                    meshOut.textContent = 'I could not read that one. Send it with your enquiry and I will quote it by hand.';
                    result.hidden = true;
                    return;
                }
                const d = mesh.dimsMm.map(x => Math.round(x));
                const tooBig = !j7FitsBuildPlate(mesh.dimsMm);
                meshOut.innerHTML = d.join(' &times; ') + ' mm &middot; '
                    + mesh.volumeCm3.toFixed(1) + ' cm&sup3; of solid model &middot; '
                    + mesh.triangles.toLocaleString() + ' triangles'
                    + (tooBig ? '<br><strong>Larger than my build plate</strong> &mdash; I would print this in sections and join them, which adds time. Worth a conversation.' : '');
                recalc();
            };
            reader.onerror = () => {
                meshOut.textContent = 'That file could not be read.';
            };
            if (/\.obj$/i.test(f.name)) reader.readAsArrayBuffer(f);
            else reader.readAsArrayBuffer(f);
        });

        recalc();
    })();

    // ========== "Do you come to my town?" ==========
    // The travel tiers were already in pricing.js and read by nothing, so a
    // customer in Bells had to work out their own mileage to know what the
    // call-out costs. This answers it directly.
    (function j7AreaCheck() {
        const form   = document.getElementById('area-check-form');
        const input  = document.getElementById('area-town');
        const result = document.getElementById('area-result');
        if (!form || !input || !result || typeof j7LookupTown !== 'function') return;

        // Populate the datalist so the field autocompletes without a library.
        const list = document.getElementById('area-town-list');
        if (list && !list.children.length) {
            J7_SERVICE_AREA.forEach(t => {
                const o = document.createElement('option');
                o.value = t.town;
                list.appendChild(o);
            });
        }

        form.addEventListener('submit', e => {
            e.preventDefault();
            const q = input.value.trim();
            if (!q) { result.textContent = ''; return; }
            const hit = j7LookupTown(q);
            result.hidden = false;
            if (!hit) {
                result.className = 'callout';
                result.innerHTML = '<strong>' + q.replace(/[<>&]/g, '') + ' is not on my list.</strong> ' +
                    'That does not mean no — it just means I have not measured it. ' +
                    'Call or text and I will tell you straight away.';
            } else if (hit.fee < 0) {
                result.className = 'callout';
                result.innerHTML = '<strong>' + hit.town + ' is about ' + hit.miles +
                    ' miles out</strong>, past my 100-mile on-site radius. ' +
                    'Remote support is still available nationwide, and I will quote longer trips case by case.';
            } else {
                result.className = 'callout callout--success';
                result.innerHTML = '<strong>Yes — I cover ' + hit.town + '.</strong> ' +
                    'About ' + hit.miles + ' miles, so the travel fee is ' +
                    (hit.fee === 0 ? '<strong>nothing</strong>.' : '<strong>$' + hit.fee + '</strong>.') +
                    ' Confirmed in your written quote before any work starts.';
            }
        });
    })();

    // ========== Estimate handoff from the calculators ==========
    // The three estimators used to produce a full breakdown and then discard
    // it, leaving the visitor to retype it. If one handed us an estimate,
    // pre-select the service and write the figures into the message.
    (function applyIncomingEstimate() {
        let data;
        try {
            const raw = sessionStorage.getItem('j7Estimate');
            if (!raw) return;
            sessionStorage.removeItem('j7Estimate');
            data = JSON.parse(raw);
        } catch (e) {
            return;
        }
        // Ignore anything stale enough to be from a previous visit
        if (!data || !data.at || Date.now() - data.at > 30 * 60 * 1000) return;

        const serviceSelect = document.getElementById('service');
        const message = document.getElementById('message');
        if (!serviceSelect || !message) return;

        if (data.service) {
            if ([...serviceSelect.options].some(o => o.value === data.service)) {
                serviceSelect.value = data.service;
            } else {
                // A calculator sent a value this form does not have. Silence
                // here is how the IT estimator shipped 'network' against an
                // option named 'network-infrastructure' and left the field
                // blank for four of its five services.
                console.warn('J7: no #service option "' + data.service + '" — falling back to "other"');
                serviceSelect.value = 'other';
            }
            if (typeof updateServiceForm === 'function') updateServiceForm();
        }

        const lines = (data.lines || []).filter(Boolean).join('\n');
        const preamble = 'Estimate from the ' + (data.page || 'website') +
                         ' calculator:\n\n' +
                         (data.headline ? data.headline + '\n' : '') + lines +
                         '\n\n(Figures from your online estimator - happy to adjust.)\n\n';
        message.value = preamble + message.value;

        const note = document.getElementById('estimate-loaded');
        if (note) note.style.display = 'block';
        document.getElementById('contact').scrollIntoView({ behavior: 'smooth', block: 'start' });
    })();

    // ========== Back to Top Button ==========
    const backToTopBtn = document.getElementById('back-to-top');
    
    if (backToTopBtn) {
        // Show/hide button on scroll
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
            }
        });
        
        // Scroll to top on click
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }
    
});

// ========== Service Worker Registration for PWA ==========
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered:', registration.scope);
            })
            .catch(error => {
                console.log('SW registration failed:', error);
            });
    });
}
