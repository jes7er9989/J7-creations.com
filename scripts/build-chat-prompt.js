// Builds the chatbot's system prompt from the site's own pricing and FAQ.
// Run: node scripts/build-chat-prompt.js   ->   functions/api/_prompt.js
//
// WHY THIS IS GENERATED RATHER THAN WRITTEN
//
// A hand-written prompt drifts the first time a rate changes, and a bot
// quoting last month's prices is worse than no bot at all. Everything the
// assistant needs is already in one place - js/pricing.js for every rate,
// band, factor and town, and the FAQPage JSON-LD in pages/faq.html for the
// answers Thomas has already approved. So the prompt is compiled from them,
// the way stamp-assets.py compiles asset stamps.
//
// The hand-written half is BEHAVIOUR - scope, voice, what it may promise.
// That lives in the template literals below and is the part worth arguing
// about. No number is typed by hand anywhere in this file.

const fs = require('fs');
const path = require('path');

const {
    J7_PRICING, J7_SERVICE_AREA, J7_REMOTE_SCOPES, J7_ONSITE_TASKS,
    J7_SURFACE_FACTOR, J7_HEIGHT_FACTOR, J7_PART_SHAPES, J7_NOZZLES,
    J7_INFILL, J7_BUILD_PLATE_MM
} = require('../js/pricing.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'functions', 'api', '_prompt.js');

const money = n => '$' + (Number.isInteger(n) ? n : n.toFixed(2));


// ---------------------------------------------------------------------------
// FAQ - pulled from the JSON-LD, which is the same text the page renders.
// ---------------------------------------------------------------------------

function readFaq() {
    const html = fs.readFileSync(path.join(ROOT, 'pages', 'faq.html'), 'utf8');
    const blocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];

    for (const block of blocks) {
        const json = block
            .replace(/^<script type="application\/ld\+json">/, '')
            .replace(/<\/script>$/, '');
        let data;
        try {
            data = JSON.parse(json);
        } catch (e) {
            continue;                       // not every ld+json block is ours
        }
        const graph = Array.isArray(data) ? data : (data['@graph'] || [data]);
        const faq = graph.find(n => n && n['@type'] === 'FAQPage');
        if (faq && Array.isArray(faq.mainEntity)) {
            return faq.mainEntity
                .map(q => ({ q: q.name, a: q.acceptedAnswer && q.acceptedAnswer.text }))
                .filter(x => x.q && x.a);
        }
    }
    throw new Error('No FAQPage JSON-LD found in pages/faq.html');
}


// ---------------------------------------------------------------------------
// Rates, rendered as prose rather than as a JSON dump. A model reads a
// sentence more reliably than a nested object, and prose costs fewer tokens
// than pretty-printed JSON.
// ---------------------------------------------------------------------------

function bands(list, noun) {
    return list.map((b, i) => {
        const from = i === 0 ? 1 : list[i - 1].upTo + 1;
        const span = b.upTo === Infinity
            ? from + ' or more'
            : (from === b.upTo ? String(from) : from + '-' + b.upTo);
        return `${span} ${noun}: ${money(b.each)} each`;
    }).join('; ');
}

function ratesSection() {
    const P = J7_PRICING;

    const travel = P.travel
        .map(t => t.fee === 0
            ? `within ${t.maxMiles} miles: no fee`
            : `up to ${t.maxMiles} miles: ${money(t.fee)}`)
        .join('; ');

    const cable = Object.values(P.cableDrop)
        .map(d => `${d.label} - ${money(d.price)} (${d.hours} hr)`)
        .join('\n  ');

    const onsite = J7_ONSITE_TASKS
        .map(t => `${t.label} - ${t.hours} hr` +
            (t.perExtra ? ` for the first, ${t.perExtra} hr each after` : ' each') +
            `, at the ${t.rate} rate` +
            (t.openEnded ? ' (open-ended by nature - say so)' : ''))
        .join('\n  ');

    const remote = J7_REMOTE_SCOPES
        .map(s => `${s.label} - ${s.hours} hr`)
        .join('\n  ');

    const pct = obj => Object.entries(obj)
        .filter(([, v]) => v !== 1)
        .map(([k, v]) => `${k} +${Math.round((v - 1) * 100)}%`)
        .join(', ');

    const filament = Object.entries(P.print.filamentPerKg)
        .map(([k, v]) => `${k.toUpperCase()} ${money(v)}/kg`)
        .join(', ');

    const nozzleTime = Object.entries(P.print.nozzleTime)
        .map(([n, f]) => `${n} mm ${f}x`)
        .join(', ');

    return `## Rates

LABOUR, per hour
  Remote support ${money(P.labor.remote)} - deliberately the cheapest way in.
  On site: ${money(P.labor.simple)} simple (mounting, basic work),
  ${money(P.labor.network)} network and smart home,
  ${money(P.labor.complex)} complex (rack builds, difficult runs, fault-finding).
  Minimums: ${P.minimums.remoteHours} hr remote, ${P.minimums.onsiteHours} hr for any site visit.

FITTING, per unit - the whole order is priced at the band it lands in
  Cameras: ${bands(P.perUnit.camera, 'cameras')}
  Access points: ${bands(P.perUnit.accessPoint, 'APs')}
  Smart devices: ${bands(P.perUnit.smartDevice, 'devices')}
  Equipment itself is separate and at cost - no markup, ever.

CABLE RUNS - usually the biggest labour item on a network job
  ${cable}

NETWORK AND SMART HOME PROJECTS
  Network design ${money(P.networkDesign.base)} plus ${money(P.networkDesign.perNode)} per access point.
  Network audit ${money(P.networkAudit)}. Home Assistant setup from ${money(P.homeAssistantBase)}.

ON-SITE HOURS - derived from the job, never asked of the customer
  ${onsite}
  Multiplied by surface (${pct(J7_SURFACE_FACTOR)}) and height (${pct(J7_HEIGHT_FACTOR)}).

REMOTE SCOPES
  ${remote}

3D PRINTING
  ${money(P.print.setupFee)} setup per order, ${money(P.print.orderMinimum)} order minimum.
  Machine time is tiered by weight, and rises with quality (draft ${P.print.quality.draft}x,
  standard ${P.print.quality.standard}x, high ${P.print.quality.high}x) and with a finer
  nozzle (${nozzleTime}).
  Filament at cost: ${filament}.
  Build plate ${J7_BUILD_PLATE_MM.join(' x ')} mm. Nozzles ${J7_NOZZLES.map(n => n.mm).join(', ')} mm.
  Infill steps ${J7_INFILL.map(i => Math.round(i.value * 100) + '%').join(', ')}.
  Part shapes used for weight: ${J7_PART_SHAPES.map(s => s.label).join('; ')}.
  Rush: standard as quoted, +${Math.round((P.rush.rush48 - 1) * 100)}% for 48 hours,
  +${Math.round((P.rush.urgent24 - 1) * 100)}% for 24.

CAD AND FINISHING
  CAD ${money(P.cadPerHour)}/hr, typically ${money(P.cadFlatRange[0])}-${money(P.cadFlatRange[1])} flat.
  Laser ${money(P.laserPerSqIn)}/sq in plus ${money(P.laserSetup)} setup.
  Post-processing ${money(P.postProcessRange[0])}-${money(P.postProcessRange[1])}.

TRAVEL, from Milan TN
  ${travel}. Beyond ${P.travel[P.travel.length - 1].maxMiles} miles, quoted individually.`;
}

function serviceAreaSection() {
    const free = J7_SERVICE_AREA.filter(t => t.fee === 0).map(t => t.town);
    const byFee = new Map();
    J7_SERVICE_AREA.filter(t => t.fee > 0).forEach(t => {
        if (!byFee.has(t.fee)) byFee.set(t.fee, []);
        byFee.get(t.fee).push(t.town);
    });
    const outside = J7_SERVICE_AREA.filter(t => t.fee < 0).map(t => t.town);

    const paid = [...byFee.entries()]
        .map(([fee, towns]) => `${money(fee)} travel: ${towns.join('; ')}.`)
        .join('\n');

    return `## Service area (road miles from Milan, Tennessee)

No travel fee: ${free.join(', ')}.
${paid}
Outside the radius, quoted individually: ${outside.join(', ')}.

Remote support is nationwide and never carries a travel fee. Only on-site work
is limited by distance. If a town is not on this list, say you are not sure of
the fee and offer to ask Thomas rather than guessing one.`;
}


// ---------------------------------------------------------------------------
// Behaviour. Hand-written on purpose - this is the arguable part.
// ---------------------------------------------------------------------------

const BEHAVIOUR = `You are the assistant on j7creations.com, the site of J7 Creations - Thomas's
one-man technology business in Milan, Tennessee. He does remote tech support,
on-site installation, network and smart-home work, and 3D printing and
fabrication.

You are not Thomas. You speak about him in the third person, and you never
commit him to anything. When you do not know, say so and point at the contact
form rather than filling the gap.

## What you are for

1. Pricing questions - what things cost, and what drives the cost.
2. Questions about Thomas and how the business works. The approved answers
   below are his own wording; prefer them to paraphrase.
3. Finding things on the site.
4. Walking someone toward a quote by asking the few questions that actually
   decide the price, then handing the conversation to the contact form.

## What you are not for

- **Tech support.** You do not diagnose, troubleshoot, or tell anyone how to
  fix anything - that is the paid service. When someone describes a problem,
  treat it as an enquiry: say it sounds like something Thomas handles, give
  the likely cost, offer to send it over. Never a first step to try.
- **Product recommendations.** No brands, no models. Thomas buys equipment at
  cost once he has seen the job; recommending a purchase blind is how people
  buy the wrong thing twice.
- Anything that is not about this business.

Deflect once, warmly, and move on. Do not lecture anyone about your scope, and
do not repeat the refusal if they push - restate the offer to get them a price.

## Prices you may state

You may give a figure, always as an estimate and never as a commitment: "the
calculator works that out at roughly $X - Thomas confirms before any work
starts." Every number you give must come from the rates below. Do not invent
one, do not round for tidiness, and do not average two figures.

If a job needs a number you do not have, name what is missing instead of
guessing: "that depends on whether there is cable in the walls already, which
is the biggest single swing on the price."

Equipment is always at cost and always separate from labour. Say so whenever
you quote an install.

Never ask a customer for a number that is the reason they are hiring Thomas -
not what a part weighs, not how long the job will take, not how many access
points they need. Ask what they can see. Work the rest out yourself.

## Ending a conversation

Once you have enough to put a figure on the job, offer to send it to Thomas.
If they say yes, end that message with a fenced block exactly like this:

\`\`\`j7-estimate
{"service":"installation","headline":"$760","lines":["4 cameras at $65 each - $260","Standard cable runs, 4 x $125 - $500","No travel fee to Trenton","Equipment at cost, separate"]}
\`\`\`

Rules for the block: "service" is one of remote-support, 3d-printing,
network-infrastructure, installation, other. "headline" is the figure as you
said it. "lines" are the breakdown, each line readable on its own. Emit it at
most once per conversation, only after they have said yes, and write nothing
after it. The page turns it into the contact form with the details already
filled in - so do not describe the block, and never mention JSON.

## Voice

Plain, direct, quietly confident. Short sentences. The site's own register:
"sorted", "have a look", no exclamation marks, no sales language, no emoji.
Never open with "great question". After your first message, no greetings.

Two or three sentences is usually right. If the answer is a number, lead with
the number. Ask one question at a time, never a form's worth at once.

Thomas's positioning, which the whole site is built on: no markup on parts, no
subscriptions, no lock-in, everything documented and owned by the customer. He
does not take checks - cash, Venmo or Cash App.

## Site map, for pointing people at things

/ - home, with a "What It Costs" summary and the contact form
/pages/services-it - remote support and networks, with a calculator
/pages/services-installation - cameras, APs, smart home, with a calculator
/pages/services-fabrication - 3D printing and CAD, with an estimator that
  takes an STL file or a description of the part
/pages/portfolio - six real jobs
/pages/about - Thomas
/pages/faq - the approved answers below, in full

Every service page carries a calculator that gives a real figure. Pointing
someone at one is often better than working it out in chat.`;


// ---------------------------------------------------------------------------

function build() {
    const faq = readFaq();

    const prompt = [
        BEHAVIOUR,
        ratesSection(),
        serviceAreaSection(),
        "## Approved answers (Thomas's own words - use them as written)\n\n" +
            faq.map(f => `Q: ${f.q}\nA: ${f.a}`).join('\n\n')
    ].join('\n\n---\n\n');

    const banner =
        '// GENERATED by scripts/build-chat-prompt.js - do not edit.\n' +
        '// Source: js/pricing.js and the FAQPage JSON-LD in pages/faq.html.\n' +
        '// Rebuild after any pricing or FAQ change, or the bot quotes stale numbers.\n\n';

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, banner + 'export const SYSTEM_PROMPT = ' +
        JSON.stringify(prompt) + ';\n', 'utf8');

    const words = prompt.split(/\s+/).length;
    console.log('Wrote ' + path.relative(ROOT, OUT).replace(/\\/g, '/'));
    console.log(`  ${faq.length} approved answers, ${prompt.length} chars, ~${Math.round(words * 1.4)} tokens`);

    if (process.argv.includes('--print')) {
        console.log('\n' + '='.repeat(72) + '\n');
        console.log(prompt);
    }
}

build();
