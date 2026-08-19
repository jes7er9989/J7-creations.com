// J7 Creations - Single source of truth for all service pricing.
//
// Every rate quoted anywhere on the site comes from this file. The visible
// pricing tables in the HTML carry the same numbers as literal text, so search
// crawlers and no-JS visitors still see real prices; syncPricingLabels() then
// overwrites them from here on load. That way a rate can never drift between
// the calculator, the page copy, and a neighbouring page.
//
// Rates benchmarked Aug 2026 against national market data, then set to roughly
// 55-65% of it for West Tennessee. Remote support is held at $25/hr
// deliberately as the accessible entry point.

const J7_PRICING = {

    // ---------- 3D printing / fabrication ----------
    print: {
        setupFee: 5.00,       // once per order, not per part
        orderMinimum: 10.00,
        // Marginal tiers: each band applies only to the grams that fall in it,
        // so the rate tapers smoothly instead of jumping at a boundary.
        tiers: [
            { upTo: 100, rate: 0.035 },
            { upTo: 500, rate: 0.022 },
            { upTo: 1000, rate: 0.015 },
            { upTo: Infinity, rate: 0.012 }
        ],
        quality: { draft: 0.7, standard: 1.0, high: 1.5 },
        waste: { minimal: 0.03, supports: 0.10, multicolor: 0.25 },
        filamentPerKg: {
            pla: 26, petg: 32, abs: 35, tpu: 43,
            pc: 58, pa6: 69, pa12: 89, cf: 95, gf: 84
        }
    },

    // ---------- Hourly labour ----------
    labor: {
        remote: 25,      // held low on purpose - the way people first reach him
        simple: 45,      // mounting, basic on-site
        network: 60,     // switches, VLANs, structured cabling
        smartHome: 60,
        complex: 85      // rack builds, difficult runs, troubleshooting
    },

    minimums: {
        remoteHours: 0.5,   // 30-minute minimum, billed in 30-min increments
        onsiteHours: 2      // 2-hour minimum for any site visit
    },

    // ---------- Per-unit install pricing, with volume breaks ----------
    // Banded: the whole order is priced at the rate for the band it lands in,
    // which is how customers compare quotes. Bands are checked for
    // monotonicity by scripts/verify-pricing.js - a discount must never make a
    // larger order cost less in total.
    perUnit: {
        camera: [
            { upTo: 2, each: 75 },
            { upTo: 5, each: 65 },
            { upTo: Infinity, each: 55 }
        ],
        accessPoint: [
            { upTo: 2, each: 125 },
            { upTo: 5, each: 105 },
            { upTo: Infinity, each: 90 }
        ],
        smartDevice: [
            { upTo: 5, each: 45 },
            { upTo: 10, each: 38 },
            { upTo: Infinity, each: 35 }
        ]
    },

    // ---------- Project pricing ----------
    homeAssistantBase: 150,              // hub, config, dashboards, handover
    networkDesign: { base: 150, perNode: 50 },  // 1 node = $200 ... 13 = $800
    networkAudit: 150,

    // ---------- Other fabrication services ----------
    // These were quoted only in page copy with no entry here, which is how
    // they drift. The fabrication page also claimed they were "quoted
    // separately" a hundred lines above listing firm rates for them.
    cadPerHour: 75,
    cadFlatRange: [50, 150],
    laserPerSqIn: 0.08,
    laserSetup: 25,
    postProcessRange: [25, 75],

    // ---------- Modifiers ----------
    travel: [
        { maxMiles: 25, fee: 0 },
        { maxMiles: 50, fee: 15 },
        { maxMiles: 75, fee: 30 },
        { maxMiles: 100, fee: 50 }
    ],
    rush: { standard: 1.0, rush48: 1.5, urgent24: 2.0 }
};


// ---------- Shared helpers ----------

/** Marginal tier cost: each band charges only the units falling inside it. */
function j7TieredCost(quantity, tiers) {
    let cost = 0;
    let remaining = quantity;
    let previousCap = 0;
    for (const tier of tiers) {
        if (remaining <= 0) break;
        const inBand = Math.min(remaining, tier.upTo - previousCap);
        cost += inBand * tier.rate;
        remaining -= inBand;
        previousCap = tier.upTo;
    }
    return cost;
}

/** Banded per-unit cost: whole order priced at the band's rate. */
function j7UnitCost(quantity, bands) {
    if (quantity <= 0) return 0;
    for (const band of bands) {
        if (quantity <= band.upTo) return quantity * band.each;
    }
    return quantity * bands[bands.length - 1].each;
}

/** The per-unit rate that applies at a given quantity, for display. */
function j7UnitRate(quantity, bands) {
    for (const band of bands) {
        if (quantity <= band.upTo) return band.each;
    }
    return bands[bands.length - 1].each;
}

function j7Money(value) {
    return '$' + value.toFixed(2);
}

/**
 * Overwrite any [data-price] element with the live value from J7_PRICING, so
 * the visible tables cannot drift from what the calculators actually charge.
 * Markup: <span data-price="labor.simple" data-price-format="hourly">$45/hr</span>
 */
function j7SyncPricingLabels() {
    document.querySelectorAll('[data-price]').forEach(el => {
        const value = el.dataset.price
            .split('.')
            .reduce((obj, key) => (obj == null ? obj : obj[key]), J7_PRICING);
        if (value == null || typeof value === 'object') return;

        switch (el.dataset.priceFormat) {
            case 'hourly':  el.textContent = '$' + value + '/hr'; break;
            case 'each':    el.textContent = '$' + value + ' each'; break;
            case 'gram':    el.textContent = '$' + value.toFixed(3) + '/g'; break;
            case 'percent': el.textContent = '+' + Math.round(value * 100) + '%'; break;
            case 'plain':   el.textContent = String(value); break;
            default:        el.textContent = j7Money(value);
        }
    });
}


/**
 * Hand an estimate to the contact form.
 *
 * All three calculators used to produce a full itemised breakdown and then
 * throw it away — the visitor retyped it into a textarea from memory, or
 * gave up. This stashes it for the contact page to pick up.
 */
function j7SendEstimate(serviceValue, headline, lines) {
    try {
        sessionStorage.setItem('j7Estimate', JSON.stringify({
            service: serviceValue,
            headline: headline,
            lines: lines,
            page: document.title,
            at: Date.now()
        }));
    } catch (e) {
        /* private mode: fall through, the form still works by hand */
    }
    window.location.href = '/#contact';
}

// Towns inside (and just outside) the 100-mile service radius, with the road
// distance from Milan and the travel fee that falls out of the tiers above.
//
// Distances are road miles, not straight-line. Four were checked against real
// driving distances (Jackson 27, Dyersburg 40, Union City 46, Paris 38); the
// rest are great-circle scaled by 1.30, which is above the worst ratio those
// four showed (1.27). The bias is deliberate: over-stating a travel fee and
// then charging less is a good surprise, while quoting "free" and then adding
// $15 is exactly the hidden fee this business advertises against.
//
// fee: -1 means beyond the radius — quote individually.
const J7_SERVICE_AREA = [
        { town: "Milan",         miles:   0, fee: 0 },
        { town: "Atwood",        miles:   8, fee: 0 },
        { town: "Medina",        miles:  10, fee: 0 },
        { town: "Bradford",      miles:  14, fee: 0 },
        { town: "Humboldt",      miles:  14, fee: 0 },
        { town: "Trenton",       miles:  14, fee: 0 },
        { town: "Greenfield",    miles:  21, fee: 0 },
        { town: "Dyer",          miles:  22, fee: 0 },
        { town: "Huntingdon",    miles:  25, fee: 0 },
        { town: "Rutherford",    miles:  25, fee: 0 },
        { town: "Jackson",       miles:  27, fee: 15 },
        { town: "McKenzie",      miles:  27, fee: 15 },
        { town: "Alamo",         miles:  29, fee: 15 },
        { town: "Gleason",       miles:  29, fee: 15 },
        { town: "Sharon",        miles:  29, fee: 15 },
        { town: "Bells",         miles:  30, fee: 15 },
        { town: "Kenton",        miles:  31, fee: 15 },
        { town: "Dresden",       miles:  33, fee: 15 },
        { town: "Maury City",    miles:  35, fee: 15 },
        { town: "Lexington",     miles:  36, fee: 15 },
        { town: "Paris",         miles:  38, fee: 15 },
        { town: "Martin",        miles:  39, fee: 15 },
        { town: "Dyersburg",     miles:  40, fee: 15 },
        { town: "Newbern",       miles:  41, fee: 15 },
        { town: "Henderson",     miles:  44, fee: 15 },
        { town: "Obion",         miles:  44, fee: 15 },
        { town: "Halls",         miles:  46, fee: 15 },
        { town: "Union City",    miles:  46, fee: 15 },
        { town: "Brownsville",   miles:  47, fee: 15 },
        { town: "Troy",          miles:  48, fee: 15 },
        { town: "Camden",        miles:  50, fee: 15 },
        { town: "Parsons",       miles:  52, fee: 30 },
        { town: "Fulton, KY",    miles:  53, fee: 30 },
        { town: "Ripley",        miles:  58, fee: 30 },
        { town: "Bolivar",       miles:  62, fee: 30 },
        { town: "Tiptonville",   miles:  67, fee: 30 },
        { town: "Selmer",        miles:  68, fee: 30 },
        { town: "Murray, KY",    miles:  70, fee: 30 },
        { town: "Covington",     miles:  72, fee: 30 },
        { town: "Waverly",       miles:  72, fee: 30 },
        { town: "Savannah",      miles:  73, fee: 30 },
        { town: "Dickson",       miles: 101, fee: -1 },
        { town: "Paducah, KY",   miles: 105, fee: -1 },
        { town: "Clarksville",   miles: 115, fee: -1 },
        { town: "Memphis",       miles: 117, fee: -1 },
        { town: "Nashville",     miles: 145, fee: -1 }
];

function j7LookupTown(query) {
    const q = String(query || '').toLowerCase().replace(/[^a-z ]/g, '').trim();
    if (!q) return null;
    const norm = t => t.town.toLowerCase().replace(/[^a-z ]/g, '');
    return J7_SERVICE_AREA.find(t => norm(t) === q)
        || J7_SERVICE_AREA.find(t => norm(t).startsWith(q))
        || J7_SERVICE_AREA.find(t => norm(t).indexOf(q) !== -1)
        || null;
}

// Guarded so scripts/verify-pricing.js can require this file under Node.
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', j7SyncPricingLabels);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { J7_PRICING, j7TieredCost, j7UnitCost, j7UnitRate,
                       J7_SERVICE_AREA, j7LookupTown };
}
