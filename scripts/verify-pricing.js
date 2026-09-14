// Verifies every J7 price model is sane. Run: node scripts/verify-pricing.js
//
// The rule this exists to enforce: a bigger job must never cost less than a
// smaller one. The original estimators broke that rule in three separate
// places, and it is invisible until a customer finds it.

const { J7_PRICING, j7TieredCost, j7UnitCost, j7PrintEstimate, j7SwapTimeFactor,
        j7ShippingEstimate, j7DeliveryEstimate,
        j7OnsiteHours, J7_ONSITE_TASKS, J7_REMOTE_SCOPES } = require('../js/pricing.js');

const fs = require('fs');
const path = require('path');

let failures = 0;
function check(label, condition, detail) {
    if (condition) {
        console.log(`  PASS  ${label}`);
    } else {
        console.log(`  FAIL  ${label}${detail ? ' -- ' + detail : ''}`);
        failures++;
    }
}

function sweep(label, priceAt, from, to, step = 1) {
    let previous = -Infinity;
    let firstDrop = null;
    for (let n = from; n <= to; n += step) {
        const price = priceAt(n);
        if (price < previous - 1e-9 && firstDrop === null) {
            firstDrop = { at: n, price, previous };
        }
        previous = price;
    }
    check(
        `${label} never decreases as the job grows`,
        firstDrop === null,
        firstDrop && `at ${firstDrop.at}: ${firstDrop.previous.toFixed(2)} -> ${firstDrop.price.toFixed(2)}`
    );
}

// ---------- 3D printing ----------
const P = J7_PRICING.print;

// The same function the calculator uses, so a check here is a check there.
function printTotal(grams, pricePerKg = P.filamentPerKg.pla, quality = 1.0,
                   qty = 1, waste = P.waste.minimal, rush = 1.0, colors = 1, second = null) {
    return j7PrintEstimate({ grams, qty, pricePerKg, quality,
                             supportWaste: waste, rush, colors, second }).total;
}

console.log('\n3D PRINTING');
sweep('print price', g => printTotal(g), 1, 3000);
sweep('print price (high quality)', g => printTotal(g, 95, 1.5), 1, 3000);
sweep('print price by quantity', q => printTotal(50, 26, 1.0, q), 1, 200);
check('urgent 24hr is exactly double standard',
    Math.abs(printTotal(200, 32, 1, 1, 0.03, 2.0) - 2 * printTotal(200, 32, 1, 1, 0.03, 1.0)) < 1e-9);
check('order minimum floors tiny jobs', printTotal(5) === P.orderMinimum);
check('1kg PLA lands near $52', Math.abs(printTotal(1000) - 51.58) < 0.5,
    `got ${printTotal(1000).toFixed(2)}`);

// Multicolor and mixed materials
{
  const MIN = P.waste.minimal;
  const multi = (colors, second = null, grams = 200) => printTotal(grams, 26, 1, 1, MIN, 1, colors, second);
  sweep('print price by color count', c => multi(c), 1, P.maxFilaments);
  check('2 colors cost more than 1', multi(2) > multi(1));
  check('one color is priced exactly as before multicolor existed',
      Math.abs(multi(1, null, 1000) - 51.58) < 0.5);
  check('purge bands cover every filament count up to the maximum',
      Array.from({ length: P.maxFilaments }, (_, i) => i + 1).every(n => P.purge.some(b => n <= b.upTo)));
  check('swap time is capped at the maximum', Math.abs(j7SwapTimeFactor(P.maxFilaments) - (1 + P.swapTimeCap)) < 1e-9);
  check('asking for more colors than the printers hold is priced at the maximum',
      Math.abs(multi(P.maxFilaments + 4) - multi(P.maxFilaments)) < 1e-9);
  check('a second material counts as a second filament',
      Math.abs(multi(1, { pricePerKg: 26, share: 0.25 }) - multi(2)) < 1e-9);
  check('a pricier second material raises the price',
      multi(1, { pricePerKg: 95, share: 0.5 }) > multi(1, { pricePerKg: 26, share: 0.5 }));
  sweep('PLA + carbon fiber price by CF share', s => multi(1, { pricePerKg: 95, share: s / 100 }), 1, 90);
  check('rush doubles a multicolor job exactly',
      Math.abs(printTotal(200, 32, 1, 1, MIN, 2.0, 4) - 2 * printTotal(200, 32, 1, 1, MIN, 1.0, 4)) < 1e-9);
}

// ---------- Per-unit installs ----------
console.log('\nPER-UNIT INSTALLS');
for (const [name, bands] of Object.entries(J7_PRICING.perUnit)) {
    sweep(`${name} total`, n => j7UnitCost(n, bands), 1, 60);
}

// ---------- Network design ----------
console.log('\nNETWORK DESIGN');
const ND = J7_PRICING.networkDesign;
const designCost = nodes => ND.base + ND.perNode * nodes;
sweep('network design', designCost, 1, 40);
check('1 node matches the advertised $95 floor', designCost(1) === 95);
check('13 nodes matches the advertised $515 ceiling', designCost(13) === 515);
// The old fee was reverse-engineered to fit a range and implied 2.7 hours of
// design for a single-AP plan. Assert the hours instead of the endpoints, so
// the next rate change has to stay defensible rather than merely tidy.
{
  const hrs = n => designCost(n) / J7_PRICING.cadPerHour;
  check('a 1-AP design is under 2 hours of work', hrs(1) < 2);
  check('a 13-AP design is between 5 and 9 hours', hrs(13) > 5 && hrs(13) < 9);
}

// --- cable runs -------------------------------------------------------------
// Market in 2026 is $125-300 a drop typical; a rural solo operator should sit
// at or under the low end. Bands must also stay in order.
{
  const D = J7_PRICING.cableDrop;
  ['easy','standard','difficult'].forEach(k => check('cable drop band ' + k + ' exists', !!D[k]));
  check('easy is cheaper than standard', D.easy.price < D.standard.price);
  check('standard is cheaper than difficult', D.standard.price < D.difficult.price);
  check('standard drop sits at or under the $125 market low', D.standard.price <= 125);
  check('difficult drop stays under the $300 market typical ceiling', D.difficult.price < 300);
  // Each band should pay for its own labour at the network rate plus materials.
  ['easy','standard','difficult'].forEach(k => {
    const labourOnly = D[k].hours * J7_PRICING.labor.network;
    check(k + ' drop covers its labour ($' + D[k].price + ' vs $' + labourOnly.toFixed(0) + ')',
          D[k].price > labourOnly);
  });
}

// ---------- Labour ----------
console.log('\nLABOUR');
const L = J7_PRICING.labor;
check('remote held at the $25 entry rate', L.remote === 25);
check('rates increase with difficulty',
    L.remote <= L.simple && L.simple < L.network && L.network <= L.smartHome && L.smartHome < L.complex);
check('on-site simple clears the TN employee wage of $30.21/hr', L.simple > 30.21);

function onsite(rate, hours, travelFee = 0, rush = 1.0) {
    return (rate * Math.max(hours, J7_PRICING.minimums.onsiteHours) + travelFee) * rush;
}
sweep('on-site labour by hours', h => onsite(L.simple, h), 0.5, 40, 0.5);
check('travel fee is additive, not multiplied by rush',
    onsite(L.simple, 4, 30, 1.0) === L.simple * 4 + 30);

// ---------- Travel and payment ----------
console.log('\nTRAVEL AND PAYMENT');
{
  const T = J7_PRICING.travel;
  const { J7_SERVICE_AREA, j7TravelFee } = require('../js/pricing.js');
  check('travel is free inside the first band', T[0].fee === 0);
  check('travel bands rise with distance',
      T.every((b, i) => i === 0 || (b.maxMiles > T[i - 1].maxMiles && b.fee > T[i - 1].fee)));
  check('every town\'s fee comes from its miles',
      J7_SERVICE_AREA.every(t => t.fee === j7TravelFee(t.miles)));
  check('towns past the last band are quoted individually',
      J7_SERVICE_AREA.filter(t => t.miles > T[T.length - 1].maxMiles).every(t => t.fee === -1));
  // The travel dropdowns are literal HTML. Hold them to pricing.js.
  const root = path.join(__dirname, '..');
  const fees = T.map(b => String(b.fee)).sort().join(',');
  [['pages/services-it.html', 'it-travel'], ['pages/services-installation.html', 'install-distance']].forEach(([file, id]) => {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    const sel = (html.match(new RegExp('<select id="' + id + '"[\\s\\S]*?</select>')) || [''])[0];
    const vals = [...sel.matchAll(/value="(\d+)"/g)].map(m => m[1]).sort().join(',');
    check(file + ' travel dropdown matches pricing.js', vals === fees, 'page ' + vals + ' vs ' + fees);
  });
  const D = J7_PRICING.deposit;
  check('deposit share is a real fraction', D.share > 0 && D.share < 1);
  const faq = fs.readFileSync(path.join(root, 'pages/faq.html'), 'utf8');
  check('FAQ states the deposit threshold from pricing.js (both copies)',
      faq.split('Jobs over $' + D.over + ' take a ' + Math.round(D.share * 100) + '% deposit').length === 3);
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  check('homepage no longer offers invoicing', !/invoice|Net 7/i.test(home));
}

// ---------- Shipping and delivery ----------
console.log('\nSHIPPING AND DELIVERY');
{
  const S = J7_PRICING.shipping;
  const ship = (o) => j7ShippingEstimate(Object.assign(
      { gramsPerPart: 200, quantity: 1, region: 'near', speed: 'ground' }, o));
  sweep('shipping by weight (no size given)', g => ship({ gramsPerPart: g }).cost || 0, 20, 8000, 20);
  sweep('shipping by part size', c => ship({ dimsCm: [c, c * 0.6, c * 0.4] }).cost || 0, 2, 60);
  const box = { dimsCm: [30, 20, 15], gramsPerPart: 1500 };
  check('farther never costs less (near <= mid <= far)',
      ship({ ...box, region: 'near' }).cost <= ship({ ...box, region: 'mid' }).cost
      && ship({ ...box, region: 'mid' }).cost <= ship({ ...box, region: 'far' }).cost);
  check('faster never costs less (ground <= 2-day <= overnight)',
      ship({ ...box, speed: 'ground' }).cost <= ship({ ...box, speed: 'twoDay' }).cost
      && ship({ ...box, speed: 'twoDay' }).cost <= ship({ ...box, speed: 'overnight' }).cost);
  check('delicate packing never costs less', ship({ ...box, delicate: true }).cost >= ship(box).cost);
  check('a signature adds at least its fee', ship({ ...box, signature: true }).cost - ship(box).cost >= S.signature);
  const tiny = ship({ dimsCm: [5, 3, 1], gramsPerPart: 15 });
  check('a light part ships USPS Ground Advantage', tiny.method === 'usps', JSON.stringify(tiny));
  check('the Ground Advantage estimate includes the buffer',
      tiny.cost === Math.ceil(S.groundAdvantage.near * (1 + S.buffer)));
  check('Ground Advantage is never used at a pound or more',
      ship({ dimsCm: [12, 9, 8], gramsPerPart: 700 }).method !== 'usps');
  check('Ground Advantage rises with distance',
      S.groundAdvantage.near <= S.groundAdvantage.mid && S.groundAdvantage.mid <= S.groundAdvantage.far);
  const plate = ship({ dimsCm: [18, 10, 0.3], gramsPerPart: 500 });
  check('a flat part over a pound uses the small flat-rate box',
      plate.method === 'flat' && /Small/.test(plate.carrier), JSON.stringify(plate));
  check('the small flat-rate estimate includes the buffer',
      plate.cost === Math.ceil(S.flatRate[0].price * (1 + S.buffer)));
  check('USPS services are never used for 2-day or overnight',
      ship({ dimsCm: [5, 3, 1], gramsPerPart: 15, speed: 'twoDay' }).method === 'ground');
  check('Alaska, Hawaii and abroad are quoted', ship({ region: 'quote' }).quote === true);
  check('over the billable weight limit is quoted', ship({ gramsPerPart: 40000, dimsCm: [40, 40, 40] }).quote === true);
  check('oversize is quoted', ship({ dimsCm: [130, 10, 10] }).quote === true);
  const B = J7_PRICING.delivery.bands;
  check('delivery bands rise with distance',
      B.every((b, i) => i === 0 || (b.maxMiles > B[i - 1].maxMiles && b.fee > B[i - 1].fee)));
  check('delivery inside the first band costs the first fee', j7DeliveryEstimate(5).cost === B[0].fee);
  check('delivery past the last band is arranged, not priced', j7DeliveryEstimate(B[B.length - 1].maxMiles + 1).quote === true);
  const root = path.join(__dirname, '..');
  const faq = fs.readFileSync(path.join(root, 'pages/faq.html'), 'utf8');
  check('FAQ states the delivery limit from pricing.js (both copies)',
      faq.split('Within ' + B[B.length - 1].maxMiles + ' miles of Milan I can hand-deliver').length === 3);
  const fab = fs.readFileSync(path.join(root, 'pages/services-fabrication.html'), 'utf8');
  check('fabrication page offers no pickup', !/pick ?up locally|shipping\/pickup/i.test(fab));
  check('fabrication page states the delivery limit from pricing.js', fab.includes('within ' + B[B.length - 1].maxMiles + ' miles of Milan'));
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  check('homepage no longer says shipping is included', !/shipping included/i.test(home));
}

// ---------- Market sanity ----------
console.log('\nMARKET POSITION (should sit under national rates)');
const marketFloor = { camera: 80, accessPoint: 265, itHourly: 60 };
check('camera stays under the $80 market floor', j7UnitCost(1, J7_PRICING.perUnit.camera) < marketFloor.camera);
check('access point stays under the $265 market floor', j7UnitCost(1, J7_PRICING.perUnit.accessPoint) < marketFloor.accessPoint);
check('complex hourly stays above remote but under $150 national ceiling',
    L.complex > L.remote && L.complex < 150);

// --- nozzle -----------------------------------------------------------------
// Machine time must fall as the nozzle widens: a 0.8 lays material about twice
// as fast as a 0.4, so the same gram of plastic takes half the machine time.
{
  const N = J7_PRICING.print.nozzleTime;
  const sizes = ['0.2', '0.4', '0.6', '0.8'];
  sizes.forEach(k => {
    check('nozzle ' + k + ' mm has a time factor', N[k] !== undefined);
  });
  check('0.4 mm is the reference at 1.0 (prices unchanged)', N['0.4'] === 1.0);
  for (let i = 1; i < sizes.length; i++) {
    check('a wider nozzle is quicker per gram: ' + sizes[i] + ' < ' + sizes[i - 1],
          N[sizes[i]] < N[sizes[i - 1]]);
  }
  // And the whole point: a job must not get cheaper by asking for FINER work.
  const grams = 200;
  const base = j7TieredCost(grams, J7_PRICING.print.tiers);
  check('a 0.2 mm job costs more machine time than the same grams at 0.4 mm',
        base * N['0.2'] > base * N['0.4']);
  check('a 0.8 mm job costs less machine time than the same grams at 0.4 mm',
        base * N['0.8'] < base * N['0.4']);
}

// ---------- Comparison table ----------
console.log('\nOLD vs NEW');
function oldPrint(g, perKg, feePerGram) {
    const filament = (perKg / 1000) * g;
    let service = feePerGram * g;
    if (g < 50) service = 5 + 0.05 * g;
    return filament + service;
}
const rows = [
    ['PLA 100g', 100, 26], ['PETG 200g', 200, 32],
    ['PLA 500g', 500, 26], ['PLA 1kg', 1000, 26], ['ABS 2kg', 2000, 35]
];
for (const [label, g, perKg] of rows) {
    const o = oldPrint(g, perKg, 0.065);
    const n = printTotal(g, perKg);
    const pct = ((n - o) / o * 100).toFixed(0);
    console.log(`  ${label.padEnd(12)} $${o.toFixed(2).padStart(7)} -> $${n.toFixed(2).padStart(7)}  (${pct > 0 ? '+' : ''}${pct}%)`);
}

console.log('\nOLD vs NEW - installs (old model billed 30 min per item)');
const oldInstall = (n, rate) => rate * Math.max(n * 0.5, 2);
for (const n of [1, 2, 4, 6, 10]) {
    const o = oldInstall(n, 35);
    const nu = j7UnitCost(n, J7_PRICING.perUnit.camera);
    console.log(`  ${String(n).padStart(2)} cameras   $${o.toFixed(2).padStart(7)} -> $${nu.toFixed(2).padStart(7)}`);
}

// --- derived hours ----------------------------------------------------------
// Customers were being asked to estimate hours, which is the one thing they
// cannot know. Hours now come from the job; these guard that the arithmetic
// stays sane and never rewards a harder job with a cheaper price.
{
  const easy = j7OnsiteHours('mount', 4, 'Drywall', 'Ground level');
  const hard = j7OnsiteHours('mount', 4, 'Brick or block', 'Roof or very high');
  check('mounting on drywall at ground level is the cheapest case', easy.hours < hard.hours);
  check('brick and height raise the hours, not lower them', hard.hours > easy.hours * 1.5);
  check('more pieces means more hours',
        j7OnsiteHours('mount', 8, 'Drywall', 'Ground level').hours >
        j7OnsiteHours('mount', 4, 'Drywall', 'Ground level').hours);
  // 2 mounts on brick above ground is 1.5 x 1.4 x 1.25 = 2.625 hours, exactly
  // half a quarter. Floating point stores it as 2.62499..., which used to round
  // DOWN and bill 2.5 h / $112.50. Found in the 13 Sep 2026 live sweep.
  const mid = j7OnsiteHours('mount', 2, 'Brick or block', 'Above ground level');
  check('an exact half-quarter rounds up: 2 mounts on brick above ground is 2.75 h, $123.75',
        mid.hours === 2.75 && mid.hours * J7_PRICING.labor[mid.rate] === 123.75);
  // A rack is one job with a tail, not N separate racks.
  const r1 = j7OnsiteHours('rack', 1, 'Drywall', 'Ground level').hours;
  const r3 = j7OnsiteHours('rack', 3, 'Drywall', 'Ground level').hours;
  check('a second rack unit costs less than the first', (r3 - r1) / 2 < r1);
  check('every on-site task maps to a real labour rate',
        J7_ONSITE_TASKS.every(t => typeof J7_PRICING.labor[t.rate] === 'number'));
  check('remote scopes are ordered smallest to largest',
        J7_REMOTE_SCOPES.every((s, i, a) => i === 0 || s.hours > a[i-1].hours));
  check('the shortest remote scope still meets the 30-minute minimum',
        J7_REMOTE_SCOPES[0].hours >= J7_PRICING.minimums.remoteHours);
}

// --- printers ----------------------------------------------------------------
// Two Bambu Lab H2D (Thomas, 13 Sep 2026); figures from Bambu's spec sheet.
// The build plate used to be a 350 mm cube, which told customers a 340 mm part
// would fit in one piece when it would not.
console.log('\nPRINTERS (Bambu Lab H2D)');
{
  const { J7_PRINTERS, J7_BUILD_PLATE_MM, j7FitsBuildPlate, J7_NOZZLES, j7NozzleCanPrint } = require('../js/pricing.js');
  const F = J7_PRICING.print.filamentPerKg;
  check('build plate is the H2D single-nozzle volume, 325 x 320 x 325 mm', J7_BUILD_PLATE_MM.join('x') === '325x320x325');
  check('the dual-nozzle volume is never larger than the single-nozzle one',
        J7_PRINTERS.buildMm.dualNozzle.every((d, i) => d <= J7_PRINTERS.buildMm.singleNozzle[i]));
  check('a 320 mm part fits the plate', j7FitsBuildPlate([320, 100, 50]));
  check('a 330 mm part does not fit in one piece', !j7FitsBuildPlate([330, 100, 50]));
  check('the AMS units hold exactly the filaments the calculator allows',
        J7_PRINTERS.ams.units * J7_PRINTERS.ams.slotsEach === J7_PRICING.print.maxFilaments);
  check('every nozzle offered has a time factor and a hardened flag',
        J7_NOZZLES.every(n => J7_PRICING.print.nozzleTime[String(n.mm)] !== undefined && typeof n.hardened === 'boolean'));
  check('only the 0.2 mm nozzle is not hardened', J7_NOZZLES.filter(n => !n.hardened).map(n => n.mm).join() === '0.2');
  check('carbon and glass fibre cannot go through the 0.2 mm', !j7NozzleCanPrint(0.2, F.cf) && !j7NozzleCanPrint('0.2', F.gf));
  check('carbon fibre can go through the hardened 0.4 mm', j7NozzleCanPrint('0.4', F.cf));
  check('PLA can go through every nozzle', J7_NOZZLES.every(n => j7NozzleCanPrint(n.mm, F.pla)));
  check('each abrasive filament has a unique price, so the dropdown value identifies it',
        J7_PRINTERS.abrasive.every(k => Object.values(F).filter(v => v === F[k]).length === 1));
  check('one printer has the 10 W laser', J7_PRINTERS.laser.printers === 1 && J7_PRINTERS.laser.watts === 10);
  const fab = fs.readFileSync(path.join(__dirname, '..', 'pages/services-fabrication.html'), 'utf8');
  check('the fabrication estimator warns about fibre filament in the 0.2 mm nozzle', fab.includes('j7NozzleCanPrint('));
}

// --- the chat's send card ----------------------------------------------------
// "Send this to Thomas" delivers straight from the chat, so js/chat.js repeats
// three things from the contact form in index.html. If they drift, an enquiry
// goes to a dead Formspree form, or arrives with a timeline or service the
// CRM does not know.
console.log('\nCHAT SEND CARD');
{
  const chat = fs.readFileSync(path.join(__dirname, '..', 'js/chat.js'), 'utf8');
  const home = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const selectValues = id => {
    const m = home.match(new RegExp('<select id="' + id + '"[\\s\\S]*?</select>'));
    return m ? [...m[0].matchAll(/<option value="([^"]+)"/g)].map(x => x[1]) : [];
  };
  const block = name => (chat.match(new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\];')) || ['', ''])[1];
  const formAction = (home.match(/<form id="contact-form"[^>]*action="([^"]+)"/) || [])[1];
  const chatAction = (chat.match(/const FORMSPREE = '([^']+)'/) || [])[1];
  check('the chat sends to the same Formspree form as the contact form',
        !!formAction && formAction === chatAction);
  const chatTimelines = [...block('TIMELINES').matchAll(/\['([^']+)'/g)].map(x => x[1]);
  check('the send card offers exactly the contact form timelines',
        chatTimelines.length > 0 && chatTimelines.join() === selectValues('timeline').join());
  const chatServices = [...block('SERVICES').matchAll(/'([^']+)'/g)].map(x => x[1]);
  check('the send card knows exactly the contact form services',
        chatServices.length > 0 && chatServices.join() === selectValues('service').join());
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}\n`);
process.exit(failures === 0 ? 0 : 1);
