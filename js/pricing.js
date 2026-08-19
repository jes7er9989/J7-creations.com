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
    return {
        headline: '$' + Math.round(design + install) + ' - $' + Math.round((design + install) * 1.4),
        detail: 'Roughly ' + aps + ' access point' + (aps === 1 ? '' : 's') +
                ' for that size and construction. Design $' + design +
                ', fitting about $' + Math.round(install) +
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

// Guarded so scripts/verify-pricing.js can require this file under Node.
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', j7SyncPricingLabels);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { J7_PRICING, j7TieredCost, j7UnitCost, j7UnitRate,
                       J7_SERVICE_AREA, j7LookupTown,
                       J7_FILAMENT_DENSITY, J7_INFILL, J7_PART_SHAPES, J7_SIZE_REFS,
                       j7PrintedVolume, j7GramsFromMesh, j7GramsFromDescription,
                       j7ParseSTL, j7ParseOBJ, j7MeshStats,
                       J7_BUILD_PLATE_MM, j7FitsBuildPlate,
                       J7_NOZZLES, j7WallCm,
                       J7_INTAKE, j7EstimateAPs, j7BallparkNetwork,
                       j7BallparkInstall, j7BallparkRemote };
}
