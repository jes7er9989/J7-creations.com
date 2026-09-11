// J7 Creations — the site assistant.
//
// Answers pricing and business questions from the numbers in pricing.js, and
// hands a finished estimate to the contact form. It talks to /api/chat, which
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
    const MAX_TURNS = 24;              // matches the cap the function enforces
    const GREETING =
        'Ask about any of the services, how Thomas works, what something ' +
        'costs, or where to find anything on the site. If it turns into a ' +
        'quote, I can send it straight over.';

    let log = [];                      // [{role, content}]
    let open = false;
    let busy = false;
    let els = {};

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
    // block. It never reaches the screen: it becomes a button that fills in
    // the contact form, using the same sessionStorage handoff the three
    // calculators already use.
    // ---------------------------------------------------------------------

    function extractEstimate(text) {
        const match = text.match(/```j7-estimate\s*([\s\S]*?)```/);
        if (!match) return { text: text, estimate: null };

        let estimate = null;
        try {
            const parsed = JSON.parse(match[1].trim());
            // headline is optional: a conversation can hand over as a plain
            // enquiry when the first checks did not fix it and there is no
            // figure yet.
            if (parsed && (parsed.headline || parsed.notes)) {
                estimate = parsed;
            }
        } catch (e) {
            /* malformed block: drop it rather than showing raw JSON */
        }
        return { text: text.replace(match[0], '').trim(), estimate: estimate };
    }

    // A question with a few likely answers ends with a j7-choices block. It
    // becomes a row of buttons, so a visitor on a phone can tap an answer
    // instead of typing one. They can still type anything they like.
    function extractChoices(text) {
        const match = text.match(/```j7-choices\s*([\s\S]*?)```/);
        if (!match) return { text: text, choices: null };

        let choices = null;
        try {
            const parsed = JSON.parse(match[1].trim());
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
        return { text: text.replace(match[0], '').trim(), choices: choices };
    }

    function sendToForm(estimate) {
        // pricing.js is only loaded on the four pages that have a calculator,
        // so the widget cannot rely on j7SendEstimate being there — and the
        // FAQ and About pages are exactly where a pricing conversation tends
        // to start. Falling back to a bare /#contact would drop the estimate
        // on the floor on those pages, so write the same payload by hand.
        // Shape and key belong to j7SendEstimate in js/pricing.js.
        //
        // Budget, timeline and town ride along so the form's own fields are
        // filled in, not only mentioned inside the message.
        const budget = Number(String(estimate.budget == null ? '' : estimate.budget)
            .replace(/[^0-9.]/g, ''));
        const details = {
            budget: budget > 0 ? budget : null,
            timeline: estimate.timeline || null,
            town: estimate.town || null
        };

        // The form is what they asked for, so the panel does not reopen over
        // it on the next page.
        try {
            sessionStorage.setItem(OPEN_KEY, '0');
        } catch (e) {
            /* private mode: nothing to remember */
        }

        if (typeof j7SendEstimate === 'function') {
            j7SendEstimate(estimate.service || 'other', estimate.headline,
                           estimate.lines, 'assistant', estimate.notes, details);
            return;
        }
        try {
            sessionStorage.setItem('j7Estimate', JSON.stringify(Object.assign({
                service: estimate.service || 'other',
                headline: estimate.headline,
                lines: estimate.lines,
                notes: estimate.notes || null,
                page: document.title,
                source: 'assistant',
                at: Date.now()
            }, details)));
        } catch (e) {
            /* private mode: the form still works by hand */
        }
        window.location.href = '/#contact';
    }

    // ---------------------------------------------------------------------
    // Rendering
    // ---------------------------------------------------------------------

    function bubble(role, text, estimate, choices) {
        const wrap = document.createElement('div');
        wrap.className = 'chat-msg chat-msg--' + role;

        const body = document.createElement('div');
        body.className = 'chat-bubble';
        // textContent, never innerHTML: this string came back from a model
        // and passes through a text box the visitor controls.
        body.textContent = text;
        wrap.appendChild(body);

        if (estimate) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'btn btn-primary chat-handoff';
            button.textContent = estimate.headline
                ? 'Send this to Thomas'
                : 'Send this to Thomas to look at';
            button.addEventListener('click', () => sendToForm(estimate));
            wrap.appendChild(button);
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
                els.log.appendChild(bubble(m.role, parsed.text, parsed.estimate, parsed.choices));
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
        let data = null;
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: log.slice(-MAX_TURNS) })
            });
            data = await response.json().catch(() => null);
        } catch (e) {
            data = null;
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
