// J7 Creations - Main Application JavaScript
// Version: 2026-08-17

// ========== Business Phone ==========
// TO ADD THE GOOGLE VOICE NUMBER: fill in both values below. Every phone
// link, footer, and contact line on the site fills itself in from here, so
// this is the only place it needs to change.
//
// Until both are set, phone elements stay hidden rather than showing a
// placeholder — better no number than a fake one a customer might dial.
// Remember to also add it to the LocalBusiness schema in index.html.
const J7_PHONE = '';          // tel: format, digits only, e.g. '+17315551234'
const J7_PHONE_DISPLAY = '';  // human-readable, e.g. '(731) 555-1234'

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
            if (!el.dataset.j7PhoneKeepText) el.textContent = J7_PHONE_DISPLAY;
        } else {
            el.textContent = J7_PHONE_DISPLAY;
        }
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
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
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
            navMenu.classList.toggle('active');
        });
        
        // Close mobile menu when clicking a link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
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
