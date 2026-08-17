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

// Guarded so scripts/verify-pricing.js can require this file under Node.
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', j7SyncPricingLabels);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { J7_PRICING, j7TieredCost, j7UnitCost, j7UnitRate };
}
