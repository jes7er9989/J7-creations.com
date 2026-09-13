// J7 Creations - Single source of truth for all service pricing.
//
// Every rate quoted anywhere on the site comes from this file. The visible
// pricing tables in the HTML carry the same numbers as literal text, so search
// crawlers and no-JS visitors still see real prices; syncPricingLabels() then
// overwrites them from here on load. That way a rate can never drift between
// the calculator, the page copy, and a neighbouring page.
//
// Rates benchmarked Aug 2026 and re-checked Sep 2026 against national market
// data. Installs, cable runs, network work, printing and builds sit at or
// below the national low end for West Tennessee; on-site hourly and CAD sit at
// market; laser is cheap and finishing is priced high, both on purpose.
// Remote support is held at $25/hr deliberately as the accessible entry point.

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

        // Machine time was charged purely per gram, which assumes grams and
        // hours track each other. Nozzle size breaks that badly: volumetric
        // flow is proportional to extrusion width, so a 0.8 lays material
        // about twice as fast as a 0.4. Left uncorrected, a big-nozzle job
        // billed MORE (more plastic in the walls) while taking HALF the time,
        // and a 0.2 job billed less while taking far longer.
        //
        // Calibrated so 0.4 is 1.0 — the common case is priced exactly as it
        // was before.
        nozzleTime: { '0.2': 2.0, '0.4': 1.0, '0.6': 0.67, '0.8': 0.5 },
        waste: { minimal: 0.03, supports: 0.10 },

        // Multicolor and mixed materials. Two AMS units, so up to 8 filaments
        // in one print. Every swap purges the old filament out of the nozzle,
        // so more filaments cost more plastic, and the printer stops for each
        // swap, so they cost more machine time. Thomas's calls, 11 Sep 2026.
        //
        // A second material counts as a filament: it goes through the same
        // swap and purge a second color does.
        maxFilaments: 8,
        purge: [                        // extra filament, by filaments in the print
            { upTo: 1, add: 0 },
            { upTo: 2, add: 0.20 },
            { upTo: 4, add: 0.35 },
            { upTo: 8, add: 0.50 }
        ],
        swapTimePerExtra: 0.15,         // machine time +15% per filament after the first
        swapTimeCap: 0.60,              // ...up to +60%
        secondMaterialShares: [0.10, 0.25, 0.50],
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
    // Rebased from hours rather than reverse-engineered to hit an advertised
    // $200-800 range. The old base charged $200 for a single-AP plan — 2.7
    // hours at the $75 design rate, for a job that is a look round and a
    // diagram. The shape was wrong at the small end, not just the number.
    //   1 AP $95 (1.3h) | 4 AP $200 (2.7h) | 8 AP $340 (4.5h) | 13 AP $515 (6.9h)
    networkDesign: { base: 60, perNode: 35 },
    networkAudit: 150,

    // Running the cable is the biggest labour item on a network job, and it
    // was priced nowhere — mentioned in the copy, absent from pricing.js and
    // from every calculator. The per-AP fitting price quietly looked like it
    // covered it, which made a fresh install underpriced and a job with
    // existing cable overpriced.
    //
    // Market (2026) is $125-300 a drop typical, $500-850 for hard retrofits,
    // with materials about $20-25 and labour 60-70% of the total. These are
    // that shape at the $60/hr network rate, sitting at or under the low end
    // of the range, which is where a rural solo operator should be.
    cableDrop: {
        easy:      { price: 80,  hours: 1.0,  label: 'Easy — open attic, basement or unfinished space' },
        standard:  { price: 125, hours: 1.75, label: 'Standard — finished wall, reasonable access' },
        difficult: { price: 205, hours: 3.0,  label: 'Difficult — two story, no attic, or conduit' }
    },

    // ---------- Other fabrication services ----------
    // These were quoted only in page copy with no entry here, which is how
    // they drift. The fabrication page also claimed they were "quoted
    // separately" a hundred lines above listing firm rates for them.
    // ---------- Custom builds ----------
    // Desktops, servers and NAS boxes. Parts are always at cost with receipts
    // shown, same as installation equipment - these are the labour only.
    //
    // Speccing the machine is the part that carries the expertise, and it is
    // also the part somebody can take away and order from elsewhere. So it
    // works like the free first hour on site: free when Thomas builds it,
    // otherwise a flat fee and the list is theirs. $75 matches the CAD rate,
    // because it is the same kind of work - paying for judgement, not hands.
    builds: {
        spec: 75,               // waived when the build is booked
        standard: 100,          // assembled, OS and drivers, stress tested
        complex: 250,           // custom cooling, sleeved cabling, case work
        server: 200             // RAID, OS, shares, users, remote access
    },

    cadPerHour: 75,
    cadFlatRange: [50, 150],
    laserPerSqIn: 0.08,
    laserSetup: 25,
    postProcessRange: [25, 75],

    // ---------- Modifiers ----------
    // Travel by road miles from Milan. Raised 12 Sep 2026 (Thomas's call): the
    // old $15 / $30 / $50 did not cover the vehicle - a 100-mile round trip is
    // about $70 at the IRS rate of 70 cents a mile, before the drive time.
    // These are roughly two-thirds of the IRS mileage beyond the free 25 miles.
    // Every town's fee in J7_SERVICE_AREA is worked out from these.
    travel: [
        { maxMiles: 25, fee: 0 },
        { maxMiles: 50, fee: 25 },
        { maxMiles: 75, fee: 45 },
        { maxMiles: 100, fee: 65 }
    ],
    rush: { standard: 1.0, rush48: 1.5, urgent24: 2.0 },

    // Payment: cash, Venmo or Cash App - no checks, no invoicing. Jobs over
    // $300 take a 50% deposit up front, which covers materials. (12 Sep 2026)
    deposit: { over: 300, share: 0.5 },

    // ---------- Shipping finished parts ----------
    // An ESTIMATE from the finished part's size and weight (Thomas, 12 Sep
    // 2026). There is no free shipping and no pickup.
    //
    // The customer sees every option in `services`, cheapest first, and picks
    // one. Thomas, 13 Sep 2026: offer every tier there is a real price for and
    // let the customer choose, so a patient customer is never pushed into
    // paying for air.
    //
    // `rates` is the carrier's own price for every pound from 1 to 50 lb, for
    // the dearest zone inside each region: near is zone 4, mid zone 6, far
    // zone 8. Nothing is interpolated.
    //   USPS: Notice 123, commercial prices, effective 12 Jul 2026.
    //   FedEx: Standard List Rates 2026 (updated 1 Jun 2026) and the 2026
    //     surcharge list.
    // UPS is not offered: its 2026 rate PDFs would not load, so there were no
    // real UPS prices to use.
    //
    // `buffer` is Thomas's margin for a label that costs more than estimated
    // (FedEx's rural Delivery Area Surcharge, for one). It is never shown or
    // mentioned to customers.
    //
    // Recheck every January and July. FedEx fuel moves weekly.
    shipping: {
        buffer: 0.10,
        fedex: {
            groundResidential: 6.45,    // FedEx Home Delivery residential surcharge
            expressResidential: 6.95,   // FedEx Express residential delivery charge
            groundFuel: 0.28,           // week of 14 Sep 2026
            expressFuel: 0.305,         // week of 14 Sep 2026
            signature: 7.60,            // Direct or Indirect Signature Required
            dimDivisor: 139,            // bills the greater of real weight and L x W x H / 139
            maxLengthPlusGirthIn: 130,  // oversize past this - left out rather than guessed
            maxSecondSideIn: 30         // additional handling past this - left out rather than guessed
        },
        usps: {
            signature: 4.15,            // Signature Confirmation, commercial
            dimDivisor: 166,
            dimOverCubicIn: 1728,       // volume only counts over a cubic foot
            maxLengthPlusGirthIn: 108,  // Priority Mail and Express stop here...
            oversizedUpToIn: 130,       // ...Ground Advantage charges its oversized price up to here
            // Nonstandard fees: longest side over 22 in, over 30 in, box over 2 cubic feet.
            long22: { groundAdvantage: 4.50, priority: 4.50, express: 4.50 },
            long30: { groundAdvantage: 10.00, priority: 21.00, express: 21.00 },
            over2CubicFt: { groundAdvantage: 21.00, priority: 35.00, express: 35.00 }
        },
        maxBillableLb: 50,          // heavier than this is quoted
        maxSideIn: 48,              // longer than this is quoted (oversize)
        // Padding each side of the part. Half an inch of bubble wrap is what a
        // small part actually gets - a full inch would push even a keyring
        // past the small flat-rate box's 1.5-inch depth.
        padIn: 0.5,
        delicatePadIn: 1.5,         //   ...or this, for delicate parts
        delicateMaterials: 3.00,    // extra packing material for delicate parts
        boxLbPerCubicIn: 0.0004,    // box and fill weight, by box volume
        boxBaseLb: 0.25,
        regions: [
            { id: 'near',  label: 'Tennessee, the South or Midwest (within about 600 miles, e.g. Atlanta, Chicago, Dallas)' },
            { id: 'mid',   label: 'The East Coast, Florida, Texas, the Plains or Rockies (about 600-1,400 miles)' },
            { id: 'far',   label: 'The West - Arizona, Utah, Idaho, Montana and beyond (over 1,400 miles)' },
            { id: 'quote', quote: true, label: 'Alaska, Hawaii or outside the US - I will quote it' }
        ],
        // Every way to send it. `rank` is speed, 1 fastest, for the "fastest" tag.
        services: [
            { id: 'uspsGround',        table: 'groundAdvantage',   carrier: 'usps',         rank: 5,   days: '2-5 business days',                label: 'USPS Ground Advantage' },
            { id: 'ground',            table: 'ground',            carrier: 'fedexGround',  rank: 4,   days: '1-5 business days',                label: 'FedEx Ground (Home Delivery)' },
            { id: 'priority',          table: 'priority',          carrier: 'usps',         rank: 3,   days: '1-3 business days',                label: 'USPS Priority Mail' },
            { id: 'saver',             table: 'saver',             carrier: 'fedexExpress', rank: 3,   days: '3 business days',                  label: 'FedEx Express Saver' },
            { id: 'twoDay',            table: 'twoDay',            carrier: 'fedexExpress', rank: 2,   days: '2 business days',                  label: 'FedEx 2Day' },
            { id: 'twoDayAM',          table: 'twoDayAM',          carrier: 'fedexExpress', rank: 1.9, days: '2 business days, by midday',       label: 'FedEx 2Day A.M.' },
            { id: 'express',           table: 'express',           carrier: 'usps',         rank: 1.5, days: '1-2 business days',                label: 'USPS Priority Mail Express' },
            { id: 'overnight',         table: 'overnight',         carrier: 'fedexExpress', rank: 1.2, days: 'Next business day, by evening',    label: 'FedEx Standard Overnight' },
            { id: 'priorityOvernight', table: 'priorityOvernight', carrier: 'fedexExpress', rank: 1.1, days: 'Next business day, by midday',     label: 'FedEx Priority Overnight' },
            { id: 'firstOvernight',    table: 'firstOvernight',    carrier: 'fedexExpress', rank: 1,   days: 'Next business day, early morning', label: 'FedEx First Overnight' }
        ],
        // Price for each billable pound, 1 to 50 lb: [0] is 1 lb, [49] is 50 lb.
        // FedEx figures are before residential and fuel.
        rates: {
            groundAdvantageUnderLb:   { near: 7.46,   mid: 7.86,   far: 8.40 },    // under a pound, any ounces
            groundAdvantageOversized: { near: 169.43, mid: 228.67, far: 288.23 },  // 108-130 in length plus girth
            expressHalfLb:            { near: 34.19,  mid: 40.99,  far: 47.63 },   // half a pound and under
            groundAdvantage: {
                near: [8.15, 8.51, 9.67, 10.65, 11.02, 11.55, 11.90, 12.43, 13.65, 14.44, 15.18, 15.89, 16.53, 17.13, 17.67, 17.94, 18.41, 18.94, 19.36, 19.66, 21.79, 24.07, 27.33, 31.62, 36.60,
                       39.07, 41.58, 42.85, 44.11, 45.34, 46.55, 47.73, 48.88, 50.04, 51.18, 52.25, 53.35, 54.44, 55.49, 56.54, 57.59, 58.59, 59.57, 60.54, 61.50, 62.42, 63.33, 64.22, 65.10, 65.96],
                mid:  [9.63, 11.58, 13.59, 15.16, 15.89, 16.89, 17.65, 18.34, 19.13, 19.94, 21.28, 22.20, 23.16, 24.14, 25.13, 26.09, 26.85, 27.70, 28.52, 30.32, 31.69, 36.73, 43.29, 51.28, 58.24,
                       61.73, 65.24, 67.49, 69.69, 71.88, 74.02, 76.13, 78.24, 80.30, 82.37, 84.33, 86.32, 88.31, 90.27, 92.17, 94.08, 95.94, 97.79, 99.60, 101.39, 103.17, 104.90, 106.61, 108.29, 109.94],
                far:  [10.67, 12.87, 15.75, 18.01, 19.19, 20.68, 21.83, 22.90, 24.09, 25.34, 27.37, 28.73, 30.11, 31.53, 32.91, 34.29, 35.42, 36.64, 37.84, 40.39, 43.01, 49.74, 58.41, 68.97, 78.19,
                       82.80, 87.46, 90.53, 93.58, 96.60, 99.57, 102.51, 105.42, 108.29, 111.16, 113.94, 116.74, 119.51, 122.25, 124.96, 127.62, 130.28, 132.88, 135.45, 138.01, 140.52, 143.00, 145.45, 147.88, 150.27]
            },
            priority: {
                near: [10.40, 10.79, 12.68, 14.96, 15.72, 16.46, 17.46, 17.97, 18.78, 19.62, 20.43, 21.25, 22.10, 22.96, 23.91, 24.68, 25.82, 27.17, 27.75, 28.29, 31.08, 33.89, 36.69, 39.50, 42.29,
                       45.15, 48.05, 49.51, 50.94, 52.38, 53.77, 55.14, 56.52, 57.83, 59.15, 60.45, 61.72, 62.96, 64.18, 65.39, 66.57, 67.73, 68.86, 69.98, 71.10, 72.15, 73.21, 74.23, 75.24, 76.23],
                mid:  [14.47, 15.34, 18.86, 24.51, 26.35, 28.16, 30.28, 31.50, 32.63, 33.74, 35.40, 36.76, 38.30, 40.02, 41.99, 44.19, 46.50, 49.26, 50.58, 53.02, 57.77, 62.52, 67.26, 72.01, 76.77,
                       83.72, 86.96, 89.12, 91.27, 93.40, 95.52, 97.62, 99.68, 101.78, 103.84, 105.79, 107.72, 109.60, 111.72, 113.78, 115.81, 117.69, 119.56, 121.38, 123.18, 124.98, 126.77, 128.52, 130.27, 132.04],
                far:  [15.22, 16.37, 20.57, 26.82, 29.18, 31.90, 34.97, 37.15, 39.25, 41.28, 44.05, 46.25, 48.54, 51.00, 53.60, 56.40, 59.22, 62.42, 64.47, 68.06, 76.40, 84.73, 93.06, 101.39, 109.73,
                       121.13, 123.92, 126.84, 129.43, 131.81, 134.30, 136.61, 139.03, 141.43, 143.67, 146.03, 148.36, 150.69, 152.99, 155.26, 157.59, 159.81, 161.95, 164.24, 166.47, 168.66, 170.87, 173.03, 175.15, 177.34]
            },
            express: {
                near: [39.05, 43.91, 48.77, 53.63, 58.54, 65.02, 71.50, 77.93, 84.41, 90.89, 96.34, 101.85, 107.36, 112.81, 118.37, 123.88, 129.33, 134.84, 140.35, 145.80, 151.91, 158.01, 164.06, 170.16, 176.26,
                       182.31, 188.36, 194.46, 200.56, 206.61, 212.66, 218.81, 224.86, 230.91, 237.06, 243.49, 249.65, 256.02, 262.44, 268.87, 277.24, 283.61, 289.88, 296.36, 302.35, 309.15, 315.36, 321.63, 328.05, 334.48],
                mid:  [48.77, 56.54, 64.32, 72.04, 79.82, 87.32, 94.83, 102.23, 109.79, 117.29, 122.75, 128.04, 133.49, 138.84, 144.29, 149.64, 155.09, 160.49, 165.89, 171.29, 177.83, 184.52, 191.16, 197.81, 204.45,
                       211.09, 217.73, 224.43, 230.96, 237.66, 244.25, 250.94, 257.58, 264.23, 270.81, 278.32, 285.72, 292.68, 299.49, 306.89, 316.77, 324.11, 331.35, 338.53, 345.71, 352.89, 360.18, 367.47, 374.98, 382.00],
                far:  [55.79, 63.94, 72.04, 80.19, 88.35, 96.77, 105.30, 113.73, 122.21, 130.68, 136.73, 142.78, 148.88, 154.93, 160.98, 167.08, 173.18, 179.18, 185.22, 191.33, 198.62, 205.85, 213.14, 220.32, 227.61,
                       234.85, 242.14, 249.38, 256.67, 263.90, 271.19, 278.43, 285.72, 292.95, 300.24, 308.24, 316.34, 324.17, 332.32, 340.31, 350.90, 358.89, 367.15, 375.03, 383.24, 391.23, 399.33, 407.38, 415.53, 423.58]
            },
            ground: {
                near: [13.26, 15.33, 15.99, 16.65, 17.06, 17.23, 17.68, 18.29, 18.38, 18.56, 19.35, 19.54, 19.77, 19.97, 20.25, 20.62, 20.84, 21.07, 22.21, 22.32, 23.29, 23.92, 24.68, 25.71, 25.83,
                       26.91, 27.45, 28.72, 28.98, 30.08, 30.69, 30.70, 32.08, 33.10, 34.19, 34.46, 34.82, 35.93, 37.47, 37.48, 38.57, 40.07, 40.13, 41.17, 41.18, 42.48, 43.17, 43.67, 43.68, 43.70],
                mid:  [14.47, 16.34, 17.49, 18.22, 19.26, 19.29, 19.63, 20.42, 20.86, 21.10, 22.27, 23.05, 23.76, 25.16, 26.54, 27.39, 28.56, 30.05, 30.94, 31.99, 32.99, 34.34, 35.63, 37.33, 38.41,
                       39.81, 41.42, 43.44, 44.68, 45.40, 46.28, 46.29, 49.21, 49.22, 50.06, 52.16, 52.39, 53.57, 56.01, 56.08, 58.42, 58.68, 61.87, 62.22, 62.25, 63.89, 64.76, 65.72, 66.21, 66.78],
                far:  [15.01, 17.37, 19.11, 20.48, 21.69, 21.70, 22.51, 23.50, 24.75, 26.38, 28.58, 29.92, 31.27, 34.01, 35.40, 37.16, 37.17, 40.08, 42.00, 43.52, 44.86, 46.39, 48.68, 51.47, 53.05,
                       55.25, 55.65, 58.32, 59.88, 61.78, 63.76, 64.46, 66.20, 69.37, 69.87, 72.61, 73.32, 74.69, 76.22, 76.24, 79.12, 79.52, 81.68, 82.53, 83.11, 85.32, 86.70, 88.07, 88.59, 89.83]
            },
            saver: {
                near: [24.83, 25.29, 28.07, 30.52, 32.19, 36.78, 39.75, 41.11, 43.87, 45.01, 49.64, 54.16, 55.31, 60.01, 62.69, 64.87, 67.57, 70.16, 72.60, 74.00, 76.44, 79.78, 85.09, 87.24, 90.13,
                       93.08, 96.60, 99.02, 101.88, 102.17, 105.14, 108.13, 112.55, 113.00, 116.27, 120.62, 121.07, 124.55, 126.84, 127.10, 130.55, 130.90, 137.16, 137.79, 140.67, 149.06, 149.91, 150.18, 150.38, 150.93],
                mid:  [35.69, 38.06, 44.25, 46.55, 52.83, 62.06, 65.49, 71.89, 74.23, 78.83, 87.41, 92.83, 94.90, 99.73, 105.14, 109.56, 113.96, 118.05, 122.02, 126.57, 132.60, 137.22, 142.87, 145.32, 151.74,
                       154.07, 158.12, 175.06, 180.23, 183.13, 192.46, 196.41, 202.13, 205.42, 205.78, 206.56, 222.09, 226.77, 232.13, 232.69, 237.75, 242.85, 247.74, 252.22, 252.68, 259.45, 260.31, 260.51, 260.74, 265.30],
                far:  [41.41, 48.10, 54.32, 62.15, 69.71, 79.28, 82.57, 90.17, 102.41, 110.41, 117.19, 123.83, 132.62, 139.49, 147.36, 152.45, 160.83, 166.28, 172.32, 177.95, 183.78, 190.65, 192.39, 193.27, 210.40,
                       216.82, 223.54, 230.74, 237.92, 244.73, 251.38, 254.70, 255.68, 275.09, 277.04, 286.38, 290.36, 290.93, 301.90, 309.81, 316.42, 326.40, 330.78, 331.55, 332.57, 352.96, 358.46, 365.06, 366.08, 371.20]
            },
            twoDay: {
                near: [29.44, 30.58, 32.39, 35.06, 38.11, 41.54, 45.06, 48.22, 52.09, 56.11, 57.88, 61.06, 64.28, 67.54, 70.83, 73.91, 77.11, 79.92, 82.29, 85.47, 88.68, 91.12, 94.39, 97.41, 99.27,
                       102.95, 105.57, 108.00, 111.19, 115.04, 118.15, 121.51, 124.89, 127.52, 130.27, 132.97, 136.19, 139.63, 141.99, 145.36, 147.06, 150.05, 152.34, 155.79, 158.06, 161.24, 163.93, 166.84, 167.23, 174.84],
                mid:  [42.80, 48.67, 55.20, 63.78, 71.24, 79.20, 89.08, 98.57, 102.68, 114.50, 123.60, 127.47, 141.84, 144.10, 158.49, 165.44, 172.90, 182.42, 186.64, 193.28, 193.95, 206.67, 214.14, 221.96, 229.18,
                       236.96, 244.99, 251.25, 258.02, 265.09, 271.15, 279.10, 286.59, 295.25, 304.12, 312.28, 320.77, 328.94, 336.91, 344.55, 352.34, 359.89, 368.36, 375.53, 382.37, 388.84, 389.54, 403.49, 410.35, 417.37],
                far:  [46.97, 56.12, 64.38, 73.29, 83.38, 89.10, 96.33, 110.69, 121.50, 131.44, 142.41, 143.51, 161.10, 162.86, 175.97, 183.44, 191.96, 195.35, 210.97, 217.78, 223.03, 231.67, 239.61, 242.14, 262.48,
                       269.72, 278.19, 284.92, 293.41, 300.84, 308.89, 316.34, 324.39, 332.37, 333.83, 342.45, 358.49, 368.27, 377.85, 386.20, 396.63, 406.59, 415.08, 423.25, 429.56, 438.83, 439.76, 443.26, 443.61, 444.32]
            },
            twoDayAM: {
                near: [36.38, 36.71, 38.87, 42.10, 46.77, 50.98, 55.31, 59.16, 63.94, 68.88, 69.82, 75.98, 77.14, 84.05, 88.13, 91.97, 95.95, 99.40, 102.38, 106.31, 110.30, 117.70, 121.95, 124.69, 125.84,
                       132.98, 137.54, 138.00, 140.97, 143.14, 146.99, 151.18, 160.74, 161.73, 162.03, 165.41, 165.79, 172.01, 172.64, 180.83, 182.92, 188.88, 193.09, 201.25, 208.07, 212.20, 212.64, 219.63, 220.36, 225.22],
                mid:  [48.76, 53.96, 61.99, 71.64, 80.00, 90.63, 100.09, 111.13, 122.71, 128.62, 130.72, 152.40, 159.34, 169.08, 181.36, 189.32, 194.22, 206.04, 213.59, 217.10, 229.03, 236.52, 245.06, 249.25, 262.25,
                       271.17, 280.37, 287.56, 289.81, 297.73, 310.30, 319.38, 327.92, 337.84, 341.60, 350.75, 360.25, 375.29, 385.54, 394.29, 403.20, 404.20, 412.68, 429.72, 437.55, 444.40, 445.22, 461.58, 469.57, 474.91],
                far:  [53.18, 63.18, 73.82, 84.01, 95.58, 104.71, 115.34, 126.90, 139.31, 149.63, 150.95, 174.52, 181.34, 187.00, 193.77, 201.96, 218.39, 223.77, 239.91, 241.53, 250.83, 269.84, 279.83, 284.53, 289.02,
                       307.90, 309.81, 313.71, 319.59, 323.72, 340.51, 342.22, 351.32, 380.31, 383.22, 388.35, 388.87, 390.46, 422.06, 425.23, 454.68, 465.47, 466.55, 467.68, 481.52, 491.41, 492.42, 493.97, 505.70, 515.57]
            },
            overnight: {
                near: [73.11, 84.09, 93.25, 100.08, 107.46, 118.45, 126.75, 133.85, 144.02, 145.23, 159.94, 168.75, 178.47, 187.55, 192.40, 201.46, 209.15, 215.44, 220.56, 226.22, 240.07, 246.27, 252.96, 253.63, 258.88,
                       275.07, 279.70, 287.78, 294.78, 298.30, 308.22, 314.93, 324.43, 331.77, 332.51, 346.47, 355.01, 360.90, 364.04, 364.72, 378.08, 383.19, 393.50, 400.41, 408.84, 415.72, 416.42, 416.72, 416.98, 418.15],
                mid:  [87.80, 100.71, 108.02, 121.26, 125.12, 141.47, 151.53, 161.75, 165.45, 167.74, 194.00, 203.47, 211.73, 219.93, 223.98, 235.63, 241.11, 246.41, 251.98, 253.54, 272.90, 274.84, 285.60, 288.27, 292.26,
                       317.04, 320.71, 323.05, 323.35, 327.92, 353.62, 360.63, 363.96, 368.11, 368.80, 382.41, 402.02, 408.80, 409.49, 410.69, 430.42, 436.91, 441.02, 452.98, 454.18, 470.59, 472.89, 473.12, 473.33, 475.41],
                far:  [99.65, 115.53, 126.28, 138.26, 141.30, 157.50, 169.88, 178.83, 192.12, 193.81, 213.80, 225.22, 236.08, 247.78, 256.08, 263.62, 269.24, 273.85, 283.56, 284.74, 304.67, 317.58, 318.88, 325.93, 330.30,
                       344.48, 360.78, 370.23, 372.29, 376.56, 387.63, 397.96, 410.68, 416.55, 420.62, 425.93, 444.90, 446.81, 450.83, 451.86, 472.32, 483.19, 504.66, 518.26, 519.63, 535.45, 537.63, 537.85, 538.19, 544.87]
            },
            priorityOvernight: {
                near: [85.63, 93.50, 103.55, 115.82, 120.37, 133.00, 138.94, 144.98, 150.14, 151.83, 185.22, 189.38, 193.63, 202.12, 205.64, 220.11, 232.39, 233.80, 234.07, 235.16, 256.54, 263.16, 270.45, 274.33, 288.54,
                       299.90, 301.54, 315.61, 322.81, 329.29, 337.27, 344.42, 350.06, 357.48, 358.25, 372.42, 381.10, 387.07, 393.77, 394.46, 408.18, 413.40, 423.98, 431.03, 435.75, 442.71, 443.42, 443.63, 443.84, 445.61],
                mid:  [99.68, 104.69, 124.94, 131.86, 133.09, 157.05, 163.51, 171.21, 171.99, 174.38, 221.76, 231.15, 232.10, 232.41, 233.87, 263.04, 265.97, 266.29, 266.53, 267.36, 283.70, 285.70, 308.75, 311.06, 317.11,
                       340.47, 342.82, 350.99, 351.81, 353.33, 383.50, 386.53, 393.42, 394.12, 394.82, 408.65, 428.55, 435.42, 436.11, 437.34, 461.53, 463.96, 472.41, 480.66, 481.51, 498.18, 500.44, 500.67, 500.89, 503.06],
                far:  [113.48, 129.96, 142.07, 154.60, 155.88, 180.72, 193.09, 199.10, 199.71, 201.47, 236.32, 241.29, 262.70, 264.85, 266.21, 293.14, 295.84, 296.12, 296.39, 297.86, 327.13, 338.23, 347.82, 354.83, 355.74,
                       373.47, 383.66, 399.85, 401.95, 402.71, 411.02, 424.42, 441.32, 443.31, 447.44, 456.93, 472.44, 474.00, 475.43, 483.51, 497.34, 515.64, 530.61, 546.37, 547.96, 569.16, 571.29, 571.63, 571.91, 573.56]
            },
            firstOvernight: {
                near: [116.63, 124.50, 134.55, 146.82, 151.37, 164.00, 169.94, 175.98, 181.14, 182.83, 216.22, 220.38, 224.63, 233.12, 236.64, 251.11, 263.39, 264.80, 265.07, 266.16, 287.54, 294.16, 301.45, 305.33, 319.54,
                       330.90, 332.54, 346.61, 353.81, 360.29, 368.27, 375.42, 381.06, 388.48, 389.25, 403.42, 412.10, 418.07, 424.77, 425.46, 439.18, 444.40, 454.98, 462.03, 466.75, 473.71, 474.42, 474.63, 474.84, 476.61],
                mid:  [130.68, 135.69, 155.94, 162.86, 164.09, 188.05, 194.51, 202.21, 202.99, 205.38, 252.76, 262.15, 263.10, 263.41, 264.87, 294.04, 296.97, 297.29, 297.53, 298.36, 314.70, 316.70, 339.75, 342.06, 348.11,
                       371.47, 373.82, 381.99, 382.81, 384.33, 414.50, 417.53, 424.42, 425.12, 425.82, 439.65, 459.55, 466.42, 467.11, 468.34, 492.53, 494.96, 503.41, 511.66, 512.51, 529.18, 531.44, 531.67, 531.89, 534.06],
                far:  [144.48, 160.96, 173.07, 185.60, 186.88, 211.72, 224.09, 230.10, 230.71, 232.47, 267.32, 272.29, 293.70, 295.85, 297.21, 324.14, 326.84, 327.12, 327.39, 328.86, 358.13, 369.23, 378.82, 385.83, 386.74,
                       404.47, 414.66, 430.85, 432.95, 433.71, 442.02, 455.42, 472.32, 474.31, 478.44, 487.93, 503.44, 505.00, 506.43, 514.51, 528.34, 546.64, 561.61, 577.37, 578.96, 600.16, 602.29, 602.63, 602.91, 604.56]
            }
        },
        // USPS Priority Mail flat-rate boxes, 2026 commercial prices, inside
        // dimensions in inches. Used for the Priority Mail option when the
        // packed part fits one and it is cheaper than Priority Mail by weight.
        flatRate: [
            { label: 'USPS Priority Mail Small Flat Rate Box',  inside: [8.44, 5.19, 1.5],   price: 12.10 },
            { label: 'USPS Priority Mail Medium Flat Rate Box', inside: [11, 8.5, 5.75],     price: 21.17 },
            { label: 'USPS Priority Mail Medium Flat Rate Box', inside: [13.75, 11.75, 3.25], price: 21.17 },
            { label: 'USPS Priority Mail Large Flat Rate Box',  inside: [12, 11.75, 5.75],   price: 31.00 }
        ]
    },

    // ---------- Hand delivery ----------
    // Instead of pickup, which Thomas does not offer. Priced like travel: about
    // two-thirds of the IRS mileage (70 cents) on the round trip at the far edge
    // of each band. Past the last band it needs arranging with Thomas, because
    // it may mean travel arrangements.
    delivery: {
        bands: [
            { maxMiles: 15, fee: 15 },
            { maxMiles: 30, fee: 30 },
            { maxMiles: 45, fee: 45 },
            { maxMiles: 60, fee: 60 }
        ]
    }
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

/** Filaments in a print, clamped to what the printers can actually load. */
function j7FilamentCount(filaments) {
    return Math.min(Math.max(1, Math.round(filaments) || 1), J7_PRICING.print.maxFilaments);
}

/** Extra filament burned on purge, by how many filaments the print uses. */
function j7PurgeWaste(filaments) {
    const n = j7FilamentCount(filaments);
    const band = J7_PRICING.print.purge.find(b => n <= b.upTo);
    return band ? band.add : 0;
}

/** Machine-time multiplier for filament swaps. */
function j7SwapTimeFactor(filaments) {
    const P = J7_PRICING.print;
    const extra = j7FilamentCount(filaments) - 1;
    return 1 + Math.min(extra * P.swapTimePerExtra, P.swapTimeCap);
}

/**
 * A whole 3D print estimate, in one place, so the calculator, the pricing
 * checks and the assistant's rates cannot work different sums.
 *
 * job: { grams (per part), qty, pricePerKg, quality, nozzleTime,
 *        supportWaste, colors, second: { pricePerKg, share } | null, rush }
 */
function j7PrintEstimate(job) {
    const P = J7_PRICING.print;
    const qty = Math.max(1, job.qty || 1);
    const printed = job.grams * qty;
    const second = job.second && job.second.share > 0 ? job.second : null;

    const filaments = j7FilamentCount(Math.max(job.colors || 1, second ? 2 : 1));
    const purge = j7PurgeWaste(filaments);
    const waste = (job.supportWaste == null ? P.waste.minimal : job.supportWaste) + purge;
    const bought = printed * (1 + waste);

    // Blended price per kg: the second material at its own price for its
    // share of the part, the main material for the rest.
    const share = second ? second.share : 0;
    const perKg = job.pricePerKg * (1 - share) + (second ? second.pricePerKg * share : 0);
    const filamentCost = (perKg / 1000) * bought;

    const swap = j7SwapTimeFactor(filaments);
    const machineCost = j7TieredCost(printed, P.tiers)
                      * (job.quality || 1) * (job.nozzleTime || 1) * swap;
    const serviceFee = P.setupFee + machineCost;

    // Order minimum before rush, so rush multiplies a real price
    let subtotal = filamentCost + serviceFee;
    const belowMinimum = subtotal < P.orderMinimum;
    if (belowMinimum) subtotal = P.orderMinimum;

    return {
        printed, filaments, purge, waste, bought, perKg, filamentCost,
        swap, machineCost, serviceFee, subtotal, belowMinimum,
        total: subtotal * (job.rush || 1)
    };
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
            // Whole-dollar figures. j7Money() would render a $100 build fee as
            // "$100.00", which reads like a checkout total rather than a price.
            case 'dollars': el.textContent = '$' + value; break;
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
function j7SendEstimate(serviceValue, headline, lines, source, notes, details) {
    try {
        sessionStorage.setItem('j7Estimate', JSON.stringify(Object.assign({
            service: serviceValue,
            headline: headline,
            lines: lines,
            // What the customer said, when the chat collected it. Saves them
            // retyping the problem they just finished explaining.
            notes: notes || null,
            page: document.title,
            // 'assistant' when the chat widget worked it out, absent when a
            // calculator did. The contact form says which, because "from the
            // FAQ page calculator" describes a page that has no calculator.
            source: source || 'calculator',
            at: Date.now()
        // Budget, timeline and town when the chat collected them, so the
        // contact form's own fields are filled in, not just the message.
        }, details || {})));
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
// a fee is exactly the hidden charge this business advertises against.
//
// Each town's fee is worked out from its miles and the travel bands in
// J7_PRICING, so changing a band changes every town. -1 means beyond the
// radius: quote individually.
const J7_SERVICE_AREA = [
        { town: "Milan",         miles:   0 },
        { town: "Atwood",        miles:   8 },
        { town: "Medina",        miles:  10 },
        { town: "Bradford",      miles:  14 },
        { town: "Humboldt",      miles:  14 },
        { town: "Trenton",       miles:  14 },
        { town: "Greenfield",    miles:  21 },
        { town: "Dyer",          miles:  22 },
        { town: "Huntingdon",    miles:  25 },
        { town: "Rutherford",    miles:  25 },
        { town: "Jackson",       miles:  27 },
        { town: "McKenzie",      miles:  27 },
        { town: "Alamo",         miles:  29 },
        { town: "Gleason",       miles:  29 },
        { town: "Sharon",        miles:  29 },
        { town: "Bells",         miles:  30 },
        { town: "Kenton",        miles:  31 },
        { town: "Dresden",       miles:  33 },
        { town: "Maury City",    miles:  35 },
        { town: "Lexington",     miles:  36 },
        { town: "Paris",         miles:  38 },
        { town: "Martin",        miles:  39 },
        { town: "Dyersburg",     miles:  40 },
        { town: "Newbern",       miles:  41 },
        { town: "Henderson",     miles:  44 },
        { town: "Obion",         miles:  44 },
        { town: "Halls",         miles:  46 },
        { town: "Union City",    miles:  46 },
        { town: "Brownsville",   miles:  47 },
        { town: "Troy",          miles:  48 },
        { town: "Camden",        miles:  50 },
        { town: "Parsons",       miles:  52 },
        { town: "Fulton, KY",    miles:  53 },
        { town: "Ripley",        miles:  58 },
        { town: "Bolivar",       miles:  62 },
        { town: "Tiptonville",   miles:  67 },
        { town: "Selmer",        miles:  68 },
        { town: "Murray, KY",    miles:  70 },
        { town: "Covington",     miles:  72 },
        { town: "Waverly",       miles:  72 },
        { town: "Savannah",      miles:  73 },
        { town: "Dickson",       miles: 101 },
        { town: "Paducah, KY",   miles: 105 },
        { town: "Clarksville",   miles: 115 },
        { town: "Memphis",       miles: 117 },
        { town: "Nashville",     miles: 145 }
];
J7_SERVICE_AREA.forEach(t => { t.fee = j7TravelFee(t.miles); });

/** Travel fee for a road distance from Milan, or -1 beyond the last band. */
function j7TravelFee(miles) {
    const band = J7_PRICING.travel.find(b => miles <= b.maxMiles);
    return band ? band.fee : -1;
}

/** "0-25mi free, 25-50mi $25, ..." for copy that lists the bands. */
function j7TravelSummary() {
    return J7_PRICING.travel.map((b, i) => {
        const from = i === 0 ? 0 : J7_PRICING.travel[i - 1].maxMiles;
        return from + '-' + b.maxMiles + 'mi ' + (b.fee ? '$' + b.fee : 'free');
    }).join(', ');
}

/**
 * Every shipping option for a print order, cheapest first.
 *
 * job: { dimsCm: [l, w, h] of one part (optional), gramsPerPart, quantity,
 *        region, delicate, signature }
 * Returns { quote, region, billableLb, options: [{ id, label, days, rank, cost }],
 * note }. Each `cost` includes the hidden buffer and is rounded up to the
 * whole dollar.
 */
function j7ShippingOptions(job) {
    const S = J7_PRICING.shipping;
    const region = S.regions.find(r => r.id === job.region) || S.regions[0];
    const qty = Math.max(1, Math.round(job.quantity) || 1);
    const grams = Math.max(1, job.gramsPerPart || 1) * qty;

    // Size of the parts, packed. Without measurements, assume a solid-ish
    // cube for the weight: printed parts are mostly air, so 35% fill at PLA
    // density. Several parts scale the single part's shape by the extra volume.
    let dims = Array.isArray(job.dimsCm) && job.dimsCm.every(d => d > 0)
        ? job.dimsCm.slice(0, 3)
        : Array(3).fill(Math.cbrt((job.gramsPerPart || 1) / 1.24 / 0.35));
    if (qty > 1) {
        const k = Math.cbrt(qty * 1.2);
        dims = dims.map(d => d * k);
    }
    const pad = job.delicate ? S.delicatePadIn : S.padIn;
    const box = dims.map(d => d / 2.54 + pad * 2).sort((a, b) => b - a);
    const volume = box[0] * box[1] * box[2];
    const actualLb = grams / 453.592 + S.boxBaseLb + volume * S.boxLbPerCubicIn;
    const lengthPlusGirth = box[0] + 2 * (box[1] + box[2]);
    const F = S.fedex;
    const U = S.usps;
    const R = S.rates;
    // FedEx always bills the greater of real and volume weight; USPS only once
    // the box is over a cubic foot. Both round up to the next pound.
    const fedexLb = Math.max(1, Math.ceil(Math.max(actualLb, volume / F.dimDivisor)));
    const overCubicFoot = volume > U.dimOverCubicIn;
    const uspsLb = Math.max(1, Math.ceil(overCubicFoot ? Math.max(actualLb, volume / U.dimDivisor) : actualLb));

    if (region.quote) {
        return { quote: true, region, options: [],
                 note: 'Shipping to Alaska, Hawaii or outside the US is quoted separately.' };
    }
    if (fedexLb > S.maxBillableLb || uspsLb > S.maxBillableLb || box[0] > S.maxSideIn) {
        return { quote: true, region, billableLb: fedexLb, options: [],
                 note: 'A package this big or heavy is quoted separately.' };
    }

    const id = region.id;
    const at = (table, lb) => R[table][id][lb - 1];
    const uspsFees = t => (box[0] > 30 ? U.long30[t] : box[0] > 22 ? U.long22[t] : 0)
                        + (volume > 2 * U.dimOverCubicIn ? U.over2CubicFt[t] : 0);
    const prices = {};

    // USPS. Ground Advantage takes a bigger box than Priority Mail, at its
    // oversized price.
    if (lengthPlusGirth <= U.oversizedUpToIn) {
        prices.uspsGround = (lengthPlusGirth > U.maxLengthPlusGirthIn ? R.groundAdvantageOversized[id]
            : actualLb < 1 && !overCubicFoot ? R.groundAdvantageUnderLb[id]
            : at('groundAdvantage', uspsLb)) + uspsFees('groundAdvantage');
    }
    let flatLabel = null;
    if (lengthPlusGirth <= U.maxLengthPlusGirthIn) {
        prices.priority = at('priority', uspsLb) + uspsFees('priority');
        // A flat-rate box when the packed part fits one and it is cheaper.
        const flat = S.flatRate
            .filter(f => { const inside = f.inside.slice().sort((a, b) => b - a);
                           return box.every((d, i) => d <= inside[i]); })
            .sort((a, b) => a.price - b.price)[0];
        if (flat && flat.price < prices.priority) {
            prices.priority = flat.price;
            flatLabel = flat.label;
        }
        prices.express = (actualLb <= 0.5 && !overCubicFoot ? R.expressHalfLb[id] : at('express', uspsLb))
            + uspsFees('express');
    }

    // FedEx, with residential delivery and fuel. A package that would draw
    // oversize or additional-handling charges is left out rather than guessed.
    if (lengthPlusGirth <= F.maxLengthPlusGirthIn && box[1] <= F.maxSecondSideIn) {
        prices.ground = (at('ground', fedexLb) + F.groundResidential) * (1 + F.groundFuel);
        S.services.filter(s => s.carrier === 'fedexExpress').forEach(s => {
            prices[s.id] = (at(s.table, fedexLb) + F.expressResidential) * (1 + F.expressFuel);
        });
    }

    const options = S.services.filter(s => prices[s.id] !== undefined).map(s => {
        const signature = job.signature ? (s.carrier === 'usps' ? U.signature : F.signature) : 0;
        const packing = job.delicate ? S.delicateMaterials : 0;
        return {
            id: s.id,
            label: s.id === 'priority' && flatLabel ? flatLabel : s.label,
            days: s.days,
            rank: s.rank,
            cost: Math.ceil((prices[s.id] + packing + signature) * (1 + S.buffer))
        };
    }).sort((a, b) => a.cost - b.cost || a.rank - b.rank);

    if (!options.length) {
        return { quote: true, region, billableLb: fedexLb, options: [],
                 note: 'A package this size is quoted separately.' };
    }
    return { quote: false, region, billableLb: fedexLb, options };
}

/**
 * Estimated shipping for a print order: the option the customer chose
 * (`job.service`), or the cheapest when they have not chosen.
 *
 * Returns { quote, cost, service, carrier, days, billableLb, options, summary,
 * note }.
 */
function j7ShippingEstimate(job) {
    const all = j7ShippingOptions(job);
    const extras = [job.delicate ? 'delicate' : null, job.signature ? 'signature' : null].filter(Boolean);
    const where = all.region.label.split(' (')[0];
    if (all.quote) {
        return { quote: true, billableLb: all.billableLb, options: [], note: all.note,
                 summary: [where].concat(extras).join(', ') };
    }
    const pick = all.options.find(o => o.id === job.service) || all.options[0];
    return {
        quote: false,
        cost: pick.cost,
        service: pick.id,
        carrier: pick.label,
        days: pick.days,
        billableLb: all.billableLb,
        options: all.options,
        summary: [where, pick.label + ' (' + pick.days + ')'].concat(extras).join(', '),
        note: 'Shipping estimate $' + pick.cost + ' (' + pick.label + ', ' + pick.days + ')'
    };
}

/** Hand-delivery fee for a distance from Milan, or a quote past the last band. */
function j7DeliveryEstimate(miles) {
    const bands = J7_PRICING.delivery.bands;
    const band = miles == null ? null : bands.find(b => miles <= b.maxMiles);
    if (!band) {
        return { quote: true, summary: 'hand delivery over ' + bands[bands.length - 1].maxMiles + ' miles',
                 note: 'Delivery over ' + bands[bands.length - 1].maxMiles + ' miles is arranged with me directly.' };
    }
    return { quote: false, cost: band.fee, summary: 'hand delivery within ' + band.maxMiles + ' miles',
             note: 'Hand delivery within ' + band.maxMiles + ' miles of Milan: $' + band.fee };
}

function j7LookupTown(query) {
    const q = String(query || '').toLowerCase().replace(/[^a-z ]/g, '').trim();
    if (!q) return null;
    const norm = t => t.town.toLowerCase().replace(/[^a-z ]/g, '');
    return J7_SERVICE_AREA.find(t => norm(t) === q)
        || J7_SERVICE_AREA.find(t => norm(t).startsWith(q))
        || J7_SERVICE_AREA.find(t => norm(t).indexOf(q) !== -1)
        || null;
}

// ===========================================================================
// PRINT WEIGHT ESTIMATION
//
// The calculator used to open with "Part Weight" and nothing else. A customer
// holding a broken bracket does not know what it weighs, has no scale, and has
// never sliced anything — so the first field was a dead end on the service
// that most needs the enquiry.
//
// Three ways in, in descending order of accuracy:
//   1. a 3D file      — exact mesh volume, what every real print service does
//   2. describe it    — bounding box x how solid that kind of part is
//   3. type the grams — for anyone who already sliced
//
// All three end in the same place: grams in the existing field.
// ===========================================================================

// Filament densities, g/cm3, keyed by the price-per-kg values the material
// dropdown already uses so the two never drift apart.
const J7_FILAMENT_DENSITY = {
    26: 1.24,  // PLA
    32: 1.27,  // PETG
    35: 1.05,  // ABS / ASA
    43: 1.21,  // TPU
    58: 1.20,  // PC
    69: 1.14,  // Nylon PA6
    89: 1.01,  // Nylon PA12 / PA11
    95: 1.15,  // Carbon fibre blend
    84: 1.30   // Glass fibre blend
};

// Five steps, described by what the part has to survive rather than by a
// number nobody outside the hobby recognises.
const J7_INFILL = [
    { value: 0.05, label: '5% — display piece, no load at all' },
    { value: 0.15, label: '15% — light duty, general purpose' },
    { value: 0.25, label: '25% — everyday functional part', preset: true },
    { value: 0.50, label: '50% — takes real load or impact' },
    { value: 0.75, label: '75% — heavy duty, close to solid' },
    { value: 1.00, label: '100% — solid, maximum strength' }
];

// occ   = how much of the bounding box is actually part
// shell = how much of THAT is perimeter wall rather than interior
// The split is what makes infill behave correctly: a 3 mm bracket is nearly
// all shell, so infill barely moves it; a solid block is nearly all interior,
// so infill dominates.
const J7_PART_SHAPES = [
    { id: 'thin',   occ: 0.07, shell: 0.90,
      label: 'Thin or open — bracket, clip, mount, stand' },
    { id: 'hollow', occ: 0.14, shell: 0.85,
      label: 'Hollow — box, case, cover, enclosure' },
    { id: 'normal', occ: 0.40, shell: 0.45,
      label: 'Normal — housing, knob, handle, body' },
    { id: 'solid',  occ: 0.75, shell: 0.25,
      label: 'Solid — gear, block, anything load-bearing' }
];

// Everyday objects, as a bounding box in cm, for people who will not reach for
// a tape measure.
const J7_SIZE_REFS = [
    { label: 'About the size of a golf ball',      dims: [4.3, 4.3, 4.3] },
    { label: 'About the size of a deck of cards',  dims: [9, 6.5, 2] },
    { label: 'About the size of a baseball',       dims: [7.5, 7.5, 7.5] },
    { label: 'About the size of a coffee mug',     dims: [12, 9, 10] },
    { label: 'About the size of a house brick',    dims: [20, 10, 6.5] },
    { label: 'About the size of a loaf of bread',  dims: [25, 12, 12] },
    { label: 'About the size of a shoebox',        dims: [33, 20, 12] }
];

// Nozzles on hand. Extrusion width runs about 1.125x the nozzle diameter at
// default settings, and 3 perimeters is typical — so the nozzle sets how thick
// the wall is, which on anything chunky is most of the material.
// Labelled by what the customer gets, not by the number.
const J7_NOZZLES = [
    { mm: 0.2, label: '0.2 mm — fine detail: small parts, lettering' },
    { mm: 0.4, label: '0.4 mm — standard: most parts', preset: true },
    { mm: 0.6, label: '0.6 mm — chunky: larger parts, thicker walls' },
    { mm: 0.8, label: '0.8 mm — coarse: big simple parts, fastest' }
];

const J7_PERIMETERS = 3;

// Wall thickness in cm for a given nozzle.
function j7WallCm(nozzleMm) {
    return (nozzleMm || 0.4) * 1.125 * J7_PERIMETERS / 10;
}

// Kept as the 0.4 mm default so existing callers behave unchanged.
const J7_WALL_CM = j7WallCm(0.4);

// Usable build volume in mm. One place, so changing printers is a one-line
// edit rather than a hunt through the UI code.
const J7_BUILD_PLATE_MM = [350, 350, 350];

// A part fits if it can be TURNED to fit, so compare sorted axes rather than
// checking each dimension against a single number. On a cubic plate the sort
// changes nothing; on a rectangular one it is the difference between a
// correct answer and a wrong one.
function j7FitsBuildPlate(dimsMm) {
    const part  = dimsMm.slice().sort((a, b) => a - b);
    const plate = J7_BUILD_PLATE_MM.slice().sort((a, b) => a - b);
    return part.every((d, i) => d <= plate[i] + 0.5);
}

// What actually comes off the printer: the shell, plus whatever fraction of
// the interior the infill fills. Capped, because on a thin part the shell is
// the entire part and there is no interior left to fill.
function j7PrintedVolume(solidCm3, areaCm2, infill, wallCm) {
    const shell = Math.min(areaCm2 * (wallCm || J7_WALL_CM), solidCm3);
    return shell + (solidCm3 - shell) * infill;
}

// Path 1: a real mesh. Volume and surface area are both measured, so this is
// as close as anything gets without running the slicer itself.
function j7GramsFromMesh(volumeCm3, areaCm2, infill, density, nozzleMm) {
    return j7PrintedVolume(volumeCm3, areaCm2, infill, j7WallCm(nozzleMm)) * density;
}

// Path 2: no mesh, so occupancy and shell fraction come from the shape the
// customer picked.
function j7GramsFromDescription(l, w, h, shapeId, infill, density, nozzleMm) {
    const s = J7_PART_SHAPES.find(x => x.id === shapeId);
    if (!s) return null;
    const solid = l * w * h * s.occ;
    // Shell fractions were calibrated at 0.4 mm; scale them with the wall and
    // cap at 1, since a part cannot be more than entirely wall.
    const shell = Math.min(1, s.shell * (j7WallCm(nozzleMm) / J7_WALL_CM));
    return solid * (shell + (1 - shell) * infill) * density;
}

// --- STL --------------------------------------------------------------------
// Signed tetrahedron sum for volume, triangle areas for surface. Runs on the
// visitor's machine; the file is never uploaded anywhere.
function j7ParseSTL(buffer) {
    const view = new DataView(buffer);
    let tris = [];

    // A binary STL is exactly 84 + 50n bytes. Checking the length is more
    // reliable than sniffing for the word "solid", which binary files can
    // legitimately start with.
    const nBinary = buffer.byteLength >= 84 ? view.getUint32(80, true) : 0;
    if (buffer.byteLength === 84 + nBinary * 50 && nBinary > 0) {
        for (let i = 0; i < nBinary; i++) {
            const o = 84 + i * 50;
            const v = [];
            for (let k = 0; k < 3; k++) {
                const p = o + 12 + k * 12;
                v.push([view.getFloat32(p, true),
                        view.getFloat32(p + 4, true),
                        view.getFloat32(p + 8, true)]);
            }
            tris.push(v);
        }
    } else {
        const text = new TextDecoder().decode(buffer);
        if (text.indexOf('facet') === -1) return null;
        const nums = text.match(/vertex\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)/g) || [];
        const verts = nums.map(l => l.trim().split(/\s+/).slice(1).map(Number));
        for (let i = 0; i + 2 < verts.length; i += 3) {
            tris.push([verts[i], verts[i + 1], verts[i + 2]]);
        }
    }
    return tris.length ? j7MeshStats(tris) : null;
}

// --- OBJ --------------------------------------------------------------------
function j7ParseOBJ(text) {
    const verts = [];
    const tris = [];
    text.split('\n').forEach(line => {
        const p = line.trim().split(/\s+/);
        if (p[0] === 'v') {
            verts.push([+p[1], +p[2], +p[3]]);
        } else if (p[0] === 'f' && p.length >= 4) {
            // Faces may be quads or n-gons; fan-triangulate them.
            const idx = p.slice(1).map(t => {
                const i = parseInt(t.split('/')[0], 10);
                return i < 0 ? verts.length + i : i - 1;
            });
            for (let i = 1; i + 1 < idx.length; i++) {
                if (verts[idx[0]] && verts[idx[i]] && verts[idx[i + 1]]) {
                    tris.push([verts[idx[0]], verts[idx[i]], verts[idx[i + 1]]]);
                }
            }
        }
    });
    return tris.length ? j7MeshStats(tris) : null;
}

// Volume, surface area and bounding box from a triangle soup. Units in the
// file are assumed to be mm, which is the convention for both formats.
function j7MeshStats(tris) {
    let vol = 0, area = 0;
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];

    for (const t of tris) {
        const [a, b, c] = t;
        // Signed volume of the tetrahedron from the origin to this face.
        vol += (a[0] * (b[1] * c[2] - b[2] * c[1])
              - a[1] * (b[0] * c[2] - b[2] * c[0])
              + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;

        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
        const cr = [u[1] * v[2] - u[2] * v[1],
                    u[2] * v[0] - u[0] * v[2],
                    u[0] * v[1] - u[1] * v[0]];
        area += Math.hypot(cr[0], cr[1], cr[2]) / 2;

        for (const p of t) {
            for (let k = 0; k < 3; k++) {
                if (p[k] < lo[k]) lo[k] = p[k];
                if (p[k] > hi[k]) hi[k] = p[k];
            }
        }
    }

    // A mesh wound inside-out gives a negative volume; the magnitude is still
    // right, so take it rather than rejecting the file.
    return {
        volumeCm3: Math.abs(vol) / 1000,
        areaCm2: area / 100,
        dimsMm: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]],
        triangles: tris.length
    };
}

// ===========================================================================
// INTAKE QUESTIONS
//
// The form used to show a checklist telling people what to have ready, then
// give them one free-text box. Most did not fill it in, so every enquiry cost
// an email asking the same five questions. These are those questions, as
// fields, and several of them are enough to price the job on the spot.
//
// Every field is optional. A blank one costs an email; a form too long to
// finish costs the whole enquiry.
// ===========================================================================

const J7_INTAKE = {
    'remote-support': {
        note: 'Answer these and I can usually tell you what it will cost before we speak.',
        fields: [
            { id: 'device', label: 'What is giving you trouble?', options: [
                'Windows PC or laptop', 'Mac', 'Phone or tablet', 'Printer',
                'Router / WiFi', 'Smart home device', 'Something else'] },
            { id: 'started', label: 'When did it start?', options: [
                'Today', 'This week', 'It has got worse gradually', 'It has always done this'] },
            // The one that decides whether remote support is even possible.
            { id: 'online', label: 'Can you still get online another way?',
              hint: 'A phone on mobile data counts. If nothing in the house can reach the internet, remote support will not work and we should book a visit instead.',
              options: ['Yes', 'No', 'Not sure'] }
        ]
    },

    'network-infrastructure': {
        note: 'These four give me enough to size the job and put a real number on it.',
        fields: [
            { id: 'property', label: 'Roughly how big is the property?', options: [
                'Under 1,500 sq ft', '1,500 - 3,000 sq ft', '3,000 - 5,000 sq ft',
                'Over 5,000 sq ft', 'A business or multiple buildings'] },
            { id: 'construction', label: 'What are the walls made of?',
              hint: 'Plaster, brick and metal stop WiFi far more than drywall, and that changes how many access points it takes.',
              options: ['Drywall / timber frame', 'Brick or block', 'Plaster and lath',
                        'Metal building', 'Not sure'] },
            { id: 'devices', label: 'Roughly how many devices connect?', options: [
                'Under 10', '10 - 25', '25 - 50', 'More than 50'] },
            { id: 'cabling', label: 'Is there network cable in the walls already?',
              hint: 'This is the biggest single swing on the price. Running new cable is most of the labor; reusing what is there costs nothing.',
              options: ['Yes, there are network points already', 'No, it is all wireless now',
                        'Some, but not where I need it', 'Not sure'] },
            { id: 'current', label: 'What equipment are you on now?', options: [
                'My own router', 'Whatever the provider supplied', 'A mesh system', 'Not sure'] },
            { id: 'goal', label: 'What are you trying to fix?', options: [
                'Dead zones / coverage', 'Speed', 'Security or isolating devices',
                'Smart home or automation', 'Several of these'] }
        ]
    },

    'installation': {
        note: 'Tell me what and how many, and the estimate below is a real one.',
        fields: [
            { id: 'install_what', label: 'What needs installing?', options: [
                'Security cameras', 'WiFi access points', 'Smart home devices',
                'TV or display', 'Network rack or cabling', 'Something else'] },
            { id: 'install_qty', label: 'How many?', type: 'number', min: 1, placeholder: 'e.g. 4' },
            { id: 'where', label: 'Indoor or outdoor?', options: ['Indoor', 'Outdoor', 'Both'] },
            { id: 'surface', label: 'What is it mounting to?',
              hint: 'Brick, block and metal take longer than drywall and need different fixings.',
              options: ['Drywall', 'Wood', 'Brick or block', 'Vinyl siding', 'Metal', 'Not sure'] },
            { id: 'power', label: 'Is there power where it is going?',
              options: ['Yes', 'No', 'Not sure'] },
            { id: 'height', label: 'How high up?', options: [
                'Ground level', 'Above ground level', 'Roof or very high'] }
        ]
    },

    '3d-printing': {
        note: 'For a figure to the penny, use the estimator on the 3D printing page — it takes a file or a description. These help me pick the right material.',
        fields: [
            { id: 'have_file', label: 'What have you got?', options: [
                'A 3D file I can attach', 'The broken part itself', 'Photos or a sketch',
                'Just an idea in my head'] },
            { id: 'environment', label: 'What does it have to survive?',
              hint: 'This picks the material. Sun and heat rule out PLA entirely.',
              options: ['Indoors, no stress', 'Outdoors / sunlight', 'Heat', 'Weight or load',
                        'It needs to flex', 'Not sure'] },
            { id: 'must_fit', label: 'Does it have to fit something existing?',
              options: ['Yes, and I can measure it', 'Yes, but I cannot measure it', 'No'] },
            { id: 'print_qty', label: 'How many do you need?', type: 'number', min: 1, placeholder: 'e.g. 1' }
        ]
    }
};

// --- ballparks --------------------------------------------------------------
// Deliberately ranges, not prices. Enough to tell someone whether they are in
// the right shop; never enough to hold Thomas to a number he has not seen.

// Access points needed, from floor area, nudged up by walls that block signal.
function j7EstimateAPs(property, construction) {
    const base = { 'Under 1,500 sq ft': 1, '1,500 - 3,000 sq ft': 2,
                   '3,000 - 5,000 sq ft': 3, 'Over 5,000 sq ft': 4 }[property];
    if (!base) return null;                       // business: needs a survey
    const hard = ['Brick or block', 'Plaster and lath', 'Metal building'];
    return base + (hard.indexOf(construction) !== -1 ? 1 : 0);
}

function j7BallparkNetwork(answers) {
    const aps = j7EstimateAPs(answers.property, answers.construction);
    if (!aps) return null;
    const design = J7_PRICING.networkDesign.base + J7_PRICING.networkDesign.perNode * aps;
    const install = j7UnitCost(aps, J7_PRICING.perUnit.accessPoint);

    // Whether cable already exists is the single biggest swing on a network
    // job, so the ballpark says so instead of hiding it inside a range.
    const cabled = answers.cabling === 'Yes, there are network points already';
    const drops = cabled ? 0 : aps;
    const dropCost = drops * J7_PRICING.cableDrop.standard.price;

    const low = design + install + dropCost;
    return {
        headline: '$' + Math.round(low) + ' - $' + Math.round(low * 1.35),
        detail: 'Roughly ' + aps + ' access point' + (aps === 1 ? '' : 's') +
                ' for that size and construction. Design $' + design +
                ', fitting about $' + Math.round(install) +
                (drops
                    ? ', plus ' + drops + ' cable run' + (drops === 1 ? '' : 's') +
                      ' at about $' + J7_PRICING.cableDrop.standard.price + ' each'
                    : '. No cable runs, since you already have points') +
                '. Equipment is separate, at cost.'
    };
}

function j7BallparkInstall(answers, travelFee) {
    const map = { 'Security cameras': 'camera', 'WiFi access points': 'accessPoint',
                  'Smart home devices': 'smartDevice' };
    const key = map[answers.install_what];
    const qty = parseInt(answers.install_qty, 10);
    if (!key || !qty || qty < 1) return null;
    const labour = j7UnitCost(qty, J7_PRICING.perUnit[key]);
    const fee = travelFee || 0;
    return {
        headline: '$' + Math.round(labour + fee),
        detail: qty + ' x ' + answers.install_what.toLowerCase() +
                ' at $' + Math.round(j7UnitRate(qty, J7_PRICING.perUnit[key])) + ' each' +
                (fee ? ', plus $' + fee + ' travel' : ', no travel fee') +
                '. Equipment is separate, at cost.'
    };
}

function j7BallparkRemote() {
    return {
        headline: '$25 - $50',
        detail: '$25 an hour with a 30-minute minimum. Most issues are done inside an hour, ' +
                'and if it turns out to need someone on site I will say so rather than run the clock.'
    };
}

// ===========================================================================
// HOURS ARE DERIVED, NOT ASKED
//
// Both calculators used to ask "estimated hours". A customer has no idea how
// long their job takes — knowing that is the thing they are hiring for — so
// the field was either guessed at or left blank, and either way the estimate
// was worthless. Same failure as asking for a part weight in grams.
//
// These describe the job in terms a customer can answer, and the hours fall
// out of it. Everything is visible in the breakdown so the arithmetic can be
// argued with rather than taken on faith.
// ===========================================================================

// Remote support. The scope a customer CAN judge is how big the problem feels,
// and that maps to time closely enough at this rate.
const J7_REMOTE_SCOPES = [
    { id: 'quick',  hours: 0.5, label: 'A quick question, or one setting to change' },
    { id: 'single', hours: 1.0, label: 'One device not behaving', preset: true },
    { id: 'multi',  hours: 1.5, label: 'Several devices, or it has been going on a while' },
    { id: 'setup',  hours: 2.0, label: 'Setting something up from scratch' }
];

// On-site work priced by the hour. Base hours are per item; the multipliers
// are what actually makes a job take longer than it looks.
const J7_ONSITE_TASKS = [
    { id: 'mount',       hours: 0.75, rate: 'simple',
      label: 'Mounting equipment — brackets, displays, enclosures' },
    { id: 'netgear',     hours: 1.0,  rate: 'network',
      label: 'Fitting network equipment — switch, router, patch panel' },
    { id: 'rack',        hours: 3.0,  rate: 'complex', perExtra: 0.5,
      label: 'Building or tidying a rack' },
    { id: 'troubleshoot', hours: 1.5, rate: 'complex', openEnded: true,
      label: 'Tracking down a fault' }
];

const J7_SURFACE_FACTOR = {
    'Drywall': 1.0, 'Wood': 1.0, 'Vinyl siding': 1.15,
    'Metal': 1.3, 'Brick or block': 1.4, 'Not sure': 1.0
};

const J7_HEIGHT_FACTOR = {
    'Ground level': 1.0, 'Above ground level': 1.25, 'Roof or very high': 1.5
};

/**
 * Hours for an on-site job, from what it is rather than from a guess.
 * Returns the hours and the factors that produced them, so the breakdown can
 * show its working.
 */
function j7OnsiteHours(taskId, qty, surface, height) {
    const task = J7_ONSITE_TASKS.find(t => t.id === taskId);
    if (!task) return null;
    const n = Math.max(1, parseInt(qty, 10) || 1);

    // A rack is one job with a per-unit tail, not N racks.
    const base = task.perExtra ? task.hours + task.perExtra * (n - 1) : task.hours * n;

    const sf = J7_SURFACE_FACTOR[surface] || 1;
    const hf = J7_HEIGHT_FACTOR[height] || 1;
    const raw = base * sf * hf;

    return {
        hours: Math.round(raw * 4) / 4,          // quarter-hour granularity
        rate: task.rate,
        openEnded: !!task.openEnded,
        why: [
            task.perExtra
                ? task.hours + ' hr for the first, ' + task.perExtra + ' hr each after'
                : task.hours + ' hr each x ' + n,
            sf !== 1 ? surface + ' adds ' + Math.round((sf - 1) * 100) + '%' : null,
            hf !== 1 ? height + ' adds ' + Math.round((hf - 1) * 100) + '%' : null
        ].filter(Boolean)
    };
}

// Guarded so scripts/verify-pricing.js can require this file under Node.
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', j7SyncPricingLabels);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { J7_PRICING, j7TieredCost, j7UnitCost, j7UnitRate,
                       j7PrintEstimate, j7PurgeWaste, j7SwapTimeFactor, j7FilamentCount,
                       J7_SERVICE_AREA, j7LookupTown, j7TravelFee, j7TravelSummary,
                       j7ShippingEstimate, j7ShippingOptions, j7DeliveryEstimate,
                       J7_FILAMENT_DENSITY, J7_INFILL, J7_PART_SHAPES, J7_SIZE_REFS,
                       j7PrintedVolume, j7GramsFromMesh, j7GramsFromDescription,
                       j7ParseSTL, j7ParseOBJ, j7MeshStats,
                       J7_BUILD_PLATE_MM, j7FitsBuildPlate,
                       J7_NOZZLES, j7WallCm,
                       J7_REMOTE_SCOPES, J7_ONSITE_TASKS, j7OnsiteHours,
                       J7_SURFACE_FACTOR, J7_HEIGHT_FACTOR,
                       J7_INTAKE, j7EstimateAPs, j7BallparkNetwork,
                       j7BallparkInstall, j7BallparkRemote };
}
