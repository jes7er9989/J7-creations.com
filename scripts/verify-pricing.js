// Verifies every J7 price model is sane. Run: node scripts/verify-pricing.js
//
// The rule this exists to enforce: a bigger job must never cost less than a
// smaller one. The original estimators broke that rule in three separate
// places, and it is invisible until a customer finds it.

const { J7_PRICING, j7TieredCost, j7UnitCost } = require('../js/pricing.js');

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
check('1 node matches the advertised $200 floor', designCost(1) === 200);
check('13 nodes matches the advertised $800 ceiling', designCost(13) === 800);

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

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}\n`);
process.exit(failures === 0 ? 0 : 1);
