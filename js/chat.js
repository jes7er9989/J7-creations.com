// J7 Creations — the site assistant.
//
// Answers pricing and business questions from the numbers in pricing.js, and
// sends a finished estimate straight to Thomas from a short card inside the
// chat (or hands it to the contact form, for anyone attaching files). It talks to /api/chat, which
// is the only server-side code in the project; the prompt and the API key
// both live there.
//
// The widget is built in JavaScript rather than added to seven HTML files, so
// there is one copy of it and nothing to keep in sync.
//
// Conversation state lives in sessionStorage. Every link on this site is a
// full page load, so without that the conversation would die the moment
// someone clicked through to the page they were being told about.

(function j7Chat() {
    'use strict';

    const STORE = 'j7ChatLog';
    // Whether the panel was open when the visitor left the page. Closed stays
    // closed: reopening it on every page load after someone shut it is the
    // widget following them around.
    const OPEN_KEY = 'j7ChatOpen';
    // EDIT HERE: the longest conversation allowed. Keep it equal to MAX_TURNS in functions/api/chat.js.
    const MAX_TURNS = 24;              // matches the cap the function enforces
    // EDIT HERE: the first message a visitor sees when the chat opens.
    const GREETING =
        'Ask about any of the services, how Thomas works, what something ' +
        'costs, or where to find anything on the site. If it turns into a ' +
        'quote, I can send it straight over.';

    // EDIT HERE (rarely): where "Send this to Thomas" delivers an enquiry. It
    // must be the same Formspree form as the contact form's action in
    // index.html; scripts/verify-pricing.js checks that the two match.
    const FORMSPREE = 'https://formspree.io/f/xzdypkbz';
    // EDIT HERE: the timeline choices in the send card, as [value, label]. The
    // values must be the same as the #timeline dropdown in index.html
    // (verify-pricing.js checks it), because the CRM only accepts those.
    const TIMELINES = [
        ['not-sure', 'Not sure yet, just exploring'],
        ['flexible', 'Flexible (1-2 weeks)'],
        ['soon', 'Soon (within 1 week)'],
        ['rush', 'RUSH (48 hours) - +50% fee'],
        ['urgent', 'URGENT (24 hours) - +100% fee']
    ];
    // The contact form's service values (verify-pricing.js checks these too).
    // Anything else the assistant sends goes in as "other", the same fallback
    // the contact form uses.
    const SERVICES = ['remote-support', '3d-printing', 'network-infrastructure',
                      'installation', 'custom-builds', 'other'];
    // Which estimates have already been sent in this tab, so the chat shows
    // "Sent" rather than offering to send the same thing twice.
    const SENT_KEY = 'j7ChatSent';

    let log = [];                      // [{role, content}]
    let open = false;
    let busy = false;
    let els = {};
    let card = null;                   // {key, values, status}: the open send card
    const sentHere = new Set();        // sent this page load, in case storage is blocked

    // ---------------------------------------------------------------------
    // State
    // ---------------------------------------------------------------------

    function load() {
        try {
            const raw = sessionStorage.getItem(STORE);
            const data = raw ? JSON.parse(raw) : null;
            log = Array.isArray(data) ? data.slice(-MAX_TURNS) : [];
        } catch (e) {
            log = [];
        }
    }

    function save() {
        try {
            sessionStorage.setItem(STORE, JSON.stringify(log.slice(-MAX_TURNS)));
        } catch (e) {
            /* private mode: the conversation just does not survive a click */
        }
    }

    // ---------------------------------------------------------------------
    // The estimate handoff
    //
    // The assistant ends a priced conversation with a fenced j7-estimate
    // block. It never reaches the screen: it becomes a "Send this to Thomas"
    // button, which opens a short send card in the chat. The card sends it by
    // the same route as the contact form: Formspree, then a copy to the CRM.
    // ---------------------------------------------------------------------

    // The prompt asks for fenced blocks, but a reply can drop the fences. A
    // fence-only match then shows the visitor raw JSON, and for an estimate
    // the send button silently never appears. So find the label, take the one
    // JSON object after it by counting braces, and swallow any fence around
    // it. Fixed here rather than only in the prompt: the prompt can drift,
    // the parser cannot.
    function findBlock(text, label) {
        const head = new RegExp('(?:`{3}\\s*)?' + label + '\\b[ \\t]*\\r?\\n?\\s*(?=\\{)');
        const m = head.exec(text);
        if (!m) return null;

        const start = m.index + m[0].length;
        let depth = 0, inString = false, escaped = false, end = -1;
        for (let i = start; i < text.length; i++) {
            const c = text[i];
            if (inString) {
                if (escaped) escaped = false;
                else if (c === '\\') escaped = true;
                else if (c === '"') inString = false;
            } else if (c === '"') {
                inString = true;
            } else if (c === '{') {
                depth++;
            } else if (c === '}' && --depth === 0) {
                end = i + 1;
                break;
            }
        }
        // Never closed (a reply cut off mid-block): drop everything from the
        // label on, so the half-written JSON is not shown either.
        if (end === -1) return { raw: text.slice(m.index), json: '' };

        const close = /^\s*`{3}/.exec(text.slice(end));
        return {
            raw: text.slice(m.index, close ? end + close[0].length : end),
            json: text.slice(start, end)
        };
    }

    function extractEstimate(text) {
        const block = findBlock(text, 'j7-estimate');
        if (!block) return { text: text, estimate: null };

        let estimate = null;
        try {
            const parsed = JSON.parse(block.json);
            // headline is optional: a conversation can hand over as a plain
            // enquiry when the first checks did not fix it and there is no
            // figure yet.
            if (parsed && (parsed.headline || parsed.notes)) {
                estimate = parsed;
            }
        } catch (e) {
            /* malformed block: drop it rather than showing raw JSON */
        }
        return { text: text.replace(block.raw, '').trim(), estimate: estimate };
    }

    // A question with a few likely answers ends with a j7-choices block. It
    // becomes a row of buttons, so a visitor on a phone can tap an answer
    // instead of typing one. They can still type anything they like.
    function extractChoices(text) {
        const block = findBlock(text, 'j7-choices');
        if (!block) return { text: text, choices: null };

        let choices = null;
        try {
            const parsed = JSON.parse(block.json);
            const options = Array.isArray(parsed && parsed.options)
                ? parsed.options.filter(o => typeof o === 'string' && o.trim()).slice(0, 6)
                : [];
            if (options.length) {
                choices = {
                    options: options,
                    suggested: options.indexOf(parsed.suggested) !== -1 ? parsed.suggested : null
                };
            }
        } catch (e) {
            /* malformed block: drop it, the question still reads on its own */
        }
        return { text: text.replace(block.raw, '').trim(), choices: choices };
    }

    function budgetNumber(value) {
        const n = Number(String(value == null ? '' : value).replace(/[^0-9.]/g, ''));
        return n > 0 ? n : null;
    }

    // The same bands as the contact form's budget dropdown (see
    // applyIncomingEstimate in js/app.js), so Formspree gets the same value.
    function budgetBand(n) {
        return n < 100 ? 'under-100'
            : n <= 300 ? '100-300'
            : n <= 500 ? '300-500'
            : n <= 1000 ? '500-1000'
            : '1000-plus';
    }

    // The full contact form, for anyone who wants to attach photos or files,
    // which the send card cannot carry. pricing.js is only loaded on the four
    // pages that have a calculator, so the widget cannot rely on
    // j7SendEstimate being there - and the FAQ and About pages are exactly
    // where a pricing conversation tends to start. Falling back to a bare
    // /#contact would drop the estimate on the floor on those pages, so write
    // the same payload by hand. Shape and key belong to j7SendEstimate in
    // js/pricing.js.
    //
    // Budget, timeline and town ride along so the form's own fields are
    // filled in, not only mentioned inside the message.
    function openFullForm(estimate) {
        const details = {
            budget: budgetNumber(estimate.budget),
            timeline: estimate.timeline || null,
            town: estimate.town || null
        };

        // Close the panel. On the homepage the form is on this same page, and
        // a chat left open on top of it hides the very form it just filled in.
        if (open) toggle(false, true);

        const payload = Object.assign({
            service: estimate.service || 'other',
            headline: estimate.headline,
            lines: estimate.lines,
            notes: estimate.notes || null,
            page: document.title,
            source: 'assistant',
            at: Date.now()
        }, details);

        // Already on the page with the form (the homepage): fill it in place.
        // Going to /#contact from here only changes the hash, nothing reloads,
        // and the form would stay empty, which is how it behaved until
        // 14 Sep 2026.
        if (document.getElementById('contact-form') && typeof window.j7ApplyEstimate === 'function') {
            window.j7ApplyEstimate(payload);
            return;
        }

        if (typeof j7SendEstimate === 'function') {
            j7SendEstimate(estimate.service || 'other', estimate.headline,
                           estimate.lines, 'assistant', estimate.notes, details);
            return;
        }
        try {
            sessionStorage.setItem('j7Estimate', JSON.stringify(payload));
        } catch (e) {
            /* private mode: the form still works by hand */
        }
        window.location.href = '/#contact';
    }

    // ---------------------------------------------------------------------
    // The send card
    //
    // "Send this to Thomas" used to drop the visitor onto a half-filled
    // contact form (Thomas, 14 Sep 2026: "not very client friendly"). Now it
    // opens this card inside the chat: the summary they can read and change,
    // and boxes for how to reach them. One tap sends it.
    //
    // Their name, email and phone are typed into the card, never into the
    // conversation, so they are never sent to the AI. The assistant is told
    // not to ask for them.
    // ---------------------------------------------------------------------

    // A short, stable id for one assistant message, so the card and the
    // "sent" state survive render(), which rebuilds the whole log each time.
    function messageKey(content) {
        let h = 0x811c9dc5;
        for (let i = 0; i < content.length; i++) {
            h = Math.imul(h ^ content.charCodeAt(i), 16777619) >>> 0;
        }
        return h.toString(36) + '.' + content.length;
    }

    function isSent(key) {
        if (sentHere.has(key)) return true;
        try {
            return JSON.parse(sessionStorage.getItem(SENT_KEY) || '[]').indexOf(key) !== -1;
        } catch (e) {
            return false;
        }
    }

    function markSent(key) {
        sentHere.add(key);
        try {
            const sent = JSON.parse(sessionStorage.getItem(SENT_KEY) || '[]');
            sessionStorage.setItem(SENT_KEY, JSON.stringify(sent.concat(key).slice(-20)));
        } catch (e) {
            /* storage blocked: sentHere still covers this page */
        }
    }

    function estimateMessage(estimate) {
        const data = Object.assign({}, estimate, { source: 'assistant' });
        if (typeof j7EstimateMessage === 'function') return j7EstimateMessage(data).trim();
        // js/app.js is on every page, so this is only a safety net.
        return [estimate.headline].concat(estimate.lines || [], estimate.notes || [])
            .filter(Boolean).join('\n');
    }

    // The conversation for the CRM, from memory rather than sessionStorage,
    // so it still arrives when the browser blocks storage. Estimate and
    // choice blocks are taken out: they arrive as structure already.
    function plainTranscript() {
        return log.slice(-MAX_TURNS).map(turn => ({
            role: turn.role === 'assistant' ? 'assistant' : 'visitor',
            text: turn.role === 'assistant'
                ? extractChoices(extractEstimate(turn.content).text).text
                : turn.content
        })).filter(turn => turn.text);
    }

    function buildSendCard(estimate, key) {
        const values = card.values;
        const form = document.createElement('form');
        form.className = 'chat-send-card';
        // Static markup only. Everything that came from the model or the
        // visitor is set through .value or .textContent below, never innerHTML.
        form.innerHTML = `
            <p class="chat-send-card__title">Send this to Thomas</p>
            <p class="chat-send-card__hint">Check the summary, add how to reach you, and
            press Send. It goes straight to Thomas.</p>
            <label class="chat-send-card__label" for="chat-send-message">What Thomas will read</label>
            <textarea id="chat-send-message" name="message" class="chat-input chat-send-card__message"
                      rows="6" maxlength="20000" required></textarea>
            <label class="chat-send-card__label" for="chat-send-name">Your name</label>
            <input id="chat-send-name" name="name" class="chat-input" type="text"
                   autocomplete="name" maxlength="200" required>
            <label class="chat-send-card__label" for="chat-send-email">Email</label>
            <input id="chat-send-email" name="email" class="chat-input" type="email"
                   autocomplete="email" maxlength="320" required>
            <label class="chat-send-card__label" for="chat-send-phone">Phone
                <span class="chat-send-card__optional">(optional)</span></label>
            <input id="chat-send-phone" name="phone" class="chat-input" type="tel"
                   autocomplete="tel" maxlength="60">
            <label class="chat-send-card__label" for="chat-send-location">Town or ZIP
                <span class="chat-send-card__optional">(optional)</span></label>
            <input id="chat-send-location" name="location" class="chat-input" type="text"
                   autocomplete="postal-code" maxlength="200">
            <label class="chat-send-card__label" for="chat-send-timeline">When do you need it?</label>
            <select id="chat-send-timeline" name="timeline" class="chat-input" required>
                <option value="">Choose one...</option>
            </select>
            <div class="chat-send-card__actions">
                <button type="submit" class="btn btn-primary chat-send-card__send">Send to Thomas</button>
                <button type="button" class="chat-send-card__cancel">Not now</button>
            </div>
            <p class="chat-send-card__status" role="status" aria-live="polite"></p>
            <p class="chat-send-card__small">Want to attach photos or files?
                <a href="/#contact" class="chat-send-card__full">Use the full contact form</a>.</p>`;

        const timeline = form.elements.namedItem('timeline');
        TIMELINES.forEach(([value, label]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            timeline.appendChild(option);
        });

        // First open: fill in what the conversation already knows. After
        // that, whatever the visitor typed wins, including across a re-render.
        if (values.message === undefined) {
            values.message = estimateMessage(estimate);
            values.location = estimate.town ? String(estimate.town).slice(0, 120) : '';
            values.timeline = TIMELINES.some(t => t[0] === estimate.timeline) ? estimate.timeline : '';
        }
        ['message', 'name', 'email', 'phone', 'location', 'timeline'].forEach(name => {
            const el = form.elements.namedItem(name);
            if (values[name] !== undefined) el.value = values[name];
            const keep = () => { values[name] = el.value; };
            el.addEventListener('input', keep);
            el.addEventListener('change', keep);
        });
        if (card.status) form.querySelector('.chat-send-card__status').textContent = card.status;

        form.querySelector('.chat-send-card__cancel').addEventListener('click', () => {
            card = null;
            render();
        });
        form.querySelector('.chat-send-card__full').addEventListener('click', e => {
            e.preventDefault();
            openFullForm(estimate);
        });
        form.addEventListener('submit', e => {
            e.preventDefault();
            submitSendCard(form, estimate, key);
        });
        return form;
    }

    async function submitSendCard(form, estimate, key) {
        if (!form.reportValidity()) return;
        const field = name => form.elements.namedItem(name).value.trim();
        const button = form.querySelector('.chat-send-card__send');
        const status = form.querySelector('.chat-send-card__status');
        button.disabled = true;
        button.textContent = 'Sending...';
        status.textContent = '';
        card.status = '';

        const service = SERVICES.indexOf(estimate.service) !== -1 ? estimate.service : 'other';
        const budget = budgetNumber(estimate.budget);
        const fields = {
            name: field('name'),
            email: field('email'),
            phone: field('phone'),
            location: field('location'),
            timeline: field('timeline'),
            message: field('message'),
            service: service,
            budget: budget,
            budgetBand: budget ? budgetBand(budget) : ''
        };

        // Formspree first, exactly as the contact form does: it is what emails
        // Thomas, and it uses the same field names so the email reads the same.
        const data = new FormData();
        data.append('name', fields.name);
        data.append('email', fields.email);
        if (fields.phone) data.append('phone', fields.phone);
        if (fields.location) data.append('location', fields.location);
        data.append('service', service);
        data.append('timeline', fields.timeline);
        if (fields.budgetBand) data.append('budget', fields.budgetBand);
        data.append('message', fields.message);
        data.append('sent_from', 'The chat on ' + window.location.pathname);

        let delivered = false;
        try {
            const response = await fetch(FORMSPREE, {
                method: 'POST',
                body: data,
                headers: { 'Accept': 'application/json' }
            });
            delivered = response.ok;
        } catch (e) {
            delivered = false;
        }

        if (!delivered) {
            // Keep everything they typed, and say what to do instead.
            card.status = 'That did not send. Please try again, or email t.i@j7creations.com.';
            status.textContent = card.status;
            button.disabled = false;
            button.textContent = 'Send to Thomas';
            return;
        }

        if (typeof j7Track === 'function') {
            j7Track('generate_lead', { service: service, page_path: window.location.pathname });
        }
        postToCrm(estimate, fields);
        markSent(key);
        card = null;
        render();
    }

    // A copy for the CRM, only after Formspree has accepted it and never
    // instead of it. The same payload shape as j7Beacon in js/app.js, with
    // channel "chatbot". Best effort: if app.js is missing or the endpoint is
    // down, Thomas still has the email.
    function postToCrm(estimate, fields) {
        const intake = window.j7Intake;
        if (!intake || typeof intake.post !== 'function') return;
        try {
            intake.post({
                channel: 'chatbot',
                name: fields.name,
                email: fields.email,
                phone: fields.phone || null,
                location: fields.location || null,
                service: fields.service,
                message: fields.message,
                budget: fields.budget,
                budget_band: fields.budgetBand || null,
                timeline: fields.timeline,
                intake: null,
                estimate: {
                    headline: estimate.headline || null,
                    lines: (estimate.lines || []).filter(Boolean),
                    notes: (estimate.notes || []).filter(Boolean),
                    source: 'assistant',
                    page: document.title,
                    service: estimate.service || null
                },
                transcript: plainTranscript(),
                attachment_count: 0,
                attachment_names: [],
                source_page: window.location.pathname,
                dedupe: intake.dedupeKey(fields.email, fields.message)
            });
        } catch (e) {
            /* the email already went; the CRM copy is best effort */
        }
    }

    // ---------------------------------------------------------------------
    // Rendering
    // ---------------------------------------------------------------------

    function bubble(role, text, estimate, choices, key) {
        const wrap = document.createElement('div');
        wrap.className = 'chat-msg chat-msg--' + role;

        // A reply that was nothing but the estimate block has no text left
        // once the block is taken out. An empty bubble is a grey bar that
        // means nothing, so only draw one when there is something to say.
        if (text) {
            const body = document.createElement('div');
            body.className = 'chat-bubble';
            // textContent, never innerHTML: this string came back from a model
            // and passes through a text box the visitor controls.
            body.textContent = text;
            wrap.appendChild(body);
        }

        if (estimate) {
            if (isSent(key)) {
                const done = document.createElement('div');
                done.className = 'chat-bubble chat-sent';
                done.textContent = 'Sent to Thomas. He usually replies within 2-4 hours ' +
                    'during business hours, and always within one business day.';
                wrap.appendChild(done);
            } else if (card && card.key === key) {
                wrap.classList.add('chat-msg--wide');
                wrap.appendChild(buildSendCard(estimate, key));
            } else {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'btn btn-primary chat-handoff';
                button.textContent = estimate.headline
                    ? 'Send this to Thomas'
                    : 'Send this to Thomas to look at';
                button.addEventListener('click', () => {
                    card = { key: key, values: {}, status: '' };
                    render();
                    const first = els.log.querySelector('.chat-send-card [name="name"]');
                    if (first) first.focus();
                });
                wrap.appendChild(button);
            }
        }

        if (choices) {
            const row = document.createElement('div');
            row.className = 'chat-choices';
            choices.options.forEach(option => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'chat-choice' +
                    (option === choices.suggested ? ' chat-choice--suggested' : '');
                chip.textContent = option;
                if (option === choices.suggested) {
                    const tag = document.createElement('span');
                    tag.className = 'chat-choice__tag';
                    tag.textContent = 'suggested';
                    chip.appendChild(tag);
                }
                chip.addEventListener('click', () => send(option));
                row.appendChild(chip);
            });
            wrap.appendChild(row);
        }
        return wrap;
    }

    function render() {
        els.log.innerHTML = '';

        if (!log.length) {
            els.log.appendChild(bubble('assistant', GREETING, null));
        }
        log.forEach((m, i) => {
            let parsed = { text: m.content, estimate: null, choices: null };
            if (m.role === 'assistant') {
                const est = extractEstimate(m.content);
                const ch = extractChoices(est.text);
                // Buttons only on the latest message. Once they have answered,
                // an old row of choices is clutter that can be misclicked.
                parsed = {
                    text: ch.text,
                    estimate: est.estimate,
                    choices: i === log.length - 1 && !busy ? ch.choices : null
                };
            }
            if (parsed.text || parsed.estimate) {
                els.log.appendChild(bubble(m.role, parsed.text, parsed.estimate, parsed.choices,
                                           messageKey(m.content)));
            }
        });

        if (busy) {
            const wait = document.createElement('div');
            wait.className = 'chat-msg chat-msg--assistant';
            wait.innerHTML = '<div class="chat-bubble chat-bubble--typing">' +
                             '<span></span><span></span><span></span></div>';
            els.log.appendChild(wait);
        }
        els.log.scrollTop = els.log.scrollHeight;
    }

    function showError(message) {
        const wrap = document.createElement('div');
        wrap.className = 'chat-msg chat-msg--assistant';
        const body = document.createElement('div');
        body.className = 'chat-bubble chat-bubble--error';
        body.textContent = message;
        wrap.appendChild(body);
        els.log.appendChild(wrap);
        els.log.scrollTop = els.log.scrollHeight;
    }

    // ---------------------------------------------------------------------
    // Talking to the function
    // ---------------------------------------------------------------------

    async function send(text) {
        if (busy || !text.trim()) return;

        log.push({ role: 'user', content: text.trim().slice(0, 2000) });
        save();
        busy = true;
        els.input.value = '';
        els.send.disabled = true;
        render();

        const FALLBACK = 'That did not go through. The contact form still works.';

        // Only the function's own wording is ever shown. A failure that never
        // reached it — a 404 from the static host, a dropped connection —
        // produces HTML or a TypeError, and neither says anything a visitor
        // can act on.
        const attempt = async () => {
            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messages: log.slice(-MAX_TURNS) })
                });
                return await response.json().catch(() => null);
            } catch (e) {
                return null;
            }
        };

        // One quiet retry when the reply never came from the function - a
        // dropped connection or an edge error page. Not when the function
        // answered with a reason (the hourly limit, not configured): asking
        // again would only get the same answer.
        let data = await attempt();
        if (!data) {
            await new Promise(resolve => setTimeout(resolve, 1200));
            data = await attempt();
        }

        if (!data || !data.reply) {
            // Take the unanswered message back out and hand it to the visitor
            // to resend. Left in place it would sit next to the message they
            // type next, and the API rejects two user turns in a row.
            const unsent = log.pop();
            save();
            busy = false;
            els.send.disabled = false;
            render();
            showError((data && data.error) || FALLBACK);
            if (unsent && !els.input.value) els.input.value = unsent.content;
            return;
        }

        busy = false;
        els.send.disabled = false;
        log.push({ role: 'assistant', content: data.reply });
        save();
        render();
        els.input.focus();
    }

    // ---------------------------------------------------------------------
    // The widget
    // ---------------------------------------------------------------------

    function build() {
        const root = document.createElement('div');
        root.className = 'chat-root';
        root.innerHTML = `
            <button type="button" class="chat-launcher" aria-expanded="false"
                    aria-controls="chat-panel" aria-label="Ask a question">
                <span class="chat-launcher__icon" aria-hidden="true">💬</span>
                <span class="chat-launcher__label">Ask a question</span>
            </button>
            <div class="chat-panel panel" id="chat-panel" role="dialog"
                 aria-label="Ask a question" hidden>
                <div class="chat-head">
                    <div>
                        <strong>Ask a question</strong>
                        <p class="chat-note">An AI assistant, not Thomas. Any figure
                        comes from the site's own rates, and he confirms it before
                        work starts. <a href="/pages/privacy#assistant">How chats are handled</a></p>
                    </div>
                    <button type="button" class="chat-close" aria-label="Close">×</button>
                </div>
                <div class="chat-log" role="log" aria-live="polite"></div>
                <form class="chat-form">
                    <label class="sr-only" for="chat-input">Your question</label>
                    <input id="chat-input" class="chat-input" type="text"
                           autocomplete="off" maxlength="2000"
                           placeholder="What do you need help with?">
                    <button type="submit" class="btn btn-primary chat-send">Send</button>
                </form>
            </div>`;
        document.body.appendChild(root);

        els = {
            root: root,
            launcher: root.querySelector('.chat-launcher'),
            panel: root.querySelector('.chat-panel'),
            close: root.querySelector('.chat-close'),
            log: root.querySelector('.chat-log'),
            form: root.querySelector('.chat-form'),
            input: root.querySelector('.chat-input'),
            send: root.querySelector('.chat-send')
        };

        els.launcher.addEventListener('click', () => toggle(!open));
        els.close.addEventListener('click', () => toggle(false));
        els.form.addEventListener('submit', e => {
            e.preventDefault();
            send(els.input.value);
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && open) toggle(false);
        });
    }

    function toggle(next, quiet) {
        open = next;
        try {
            sessionStorage.setItem(OPEN_KEY, open ? '1' : '0');
        } catch (e) {
            /* private mode: it just will not remember */
        }
        els.panel.hidden = !open;
        els.root.classList.toggle('chat-root--open', open);
        els.launcher.setAttribute('aria-expanded', String(open));
        if (open) {
            render();
            // Not on a page load: focusing the box then pops the keyboard up on
            // a phone before the visitor has done anything.
            if (!quiet) els.input.focus();
        } else if (!quiet) {
            els.launcher.focus();
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        load();
        build();
        // Reopen only if it was open when they left the page. Someone who
        // closed it is done looking at it, and it stays closed until they open
        // it again.
        let wasOpen = false;
        try {
            wasOpen = sessionStorage.getItem(OPEN_KEY) === '1';
        } catch (e) {
            wasOpen = false;
        }
        if (log.length && wasOpen) toggle(true, true);
    });
})();
