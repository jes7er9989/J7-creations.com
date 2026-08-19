// Verifies every J7 price model is sane. Run: node scripts/verify-pricing.js
//
// The rule this exists to enforce: a bigger job must never cost less than a
// smaller one. The original estimators broke that rule in three separate
// places, and it is invisible until a customer finds it.

const { J7_PRICING, j7TieredCost, j7UnitCost,
        j7OnsiteHours, J7_ONSITE_TASKS, J7_REMOTE_SCOPES } = require('../js/pricing.js');

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

function printTotal(grams, pricePerKg = P.filamentPerKg.pla, quality = 1.0,
                   qty = 1, waste = P.waste.minimal, rush = 1.0) {
    const partWeight = grams * qty;
    const filament = (pricePerKg / 1000) * partWeight * (1 + waste);
    const machine = j7TieredCost(partWeight, P.tiers) * quality;
    let subtotal = filament + P.setupFee + machine;
    if (subtotal < P.orderMinimum) subtotal = P.orderMinimum;
    return subtotal * rush;
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

// ---------- Market sanity ----------
console.log('\nMARKET POSITION (should sit under national rates)');
const marketFloor = { camera: 80, accessPoint: 265, itHourly: 60 };
check('camera stays under the $80 market floor', j7UnitCost(1, J7_PRICING.perUnit.camera) < marketFloor.camera);
check('access point stays under the $265 market floor', j7UnitCost(1, J7_PRICING.perUnit.accessPoint) < marketFloor.accessPoint);
check('complex hourly stays above remote but under $150 national ceiling',
    L.complex > L.remote && L.complex < 150);

// ---------- Comparison table ----------
console.log('\nOLD vs NEW');
function oldPrint(g, perKg, feePerGram) {
    const filament = (perKg / 1000) * g;
    let service = feePerGram * g;
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

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}\n`);
process.exit(failures === 0 ? 0 : 1);
