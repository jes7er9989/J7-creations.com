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
    const MAX_TURNS = 24;              // matches the cap the function enforces
    const GREETING =
        'Ask me what something costs, how Thomas works, or where to find ' +
        'anything on the site. I can work out an estimate and send it over.';

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
            if (parsed && parsed.headline && Array.isArray(parsed.lines)) {
                estimate = parsed;
            }
        } catch (e) {
            /* malformed block: drop it rather than showing raw JSON */
        }
        return { text: text.replace(match[0], '').trim(), estimate: estimate };
    }

    function sendToForm(estimate) {
        // pricing.js is only loaded on the four pages that have a calculator,
        // so the widget cannot rely on j7SendEstimate being there — and the
        // FAQ and About pages are exactly where a pricing conversation tends
        // to start. Falling back to a bare /#contact would drop the estimate
        // on the floor on those pages, so write the same payload by hand.
        // Shape and key belong to j7SendEstimate in js/pricing.js.
        if (typeof j7SendEstimate === 'function') {
            j7SendEstimate(estimate.service || 'other', estimate.headline,
                           estimate.lines, 'assistant');
            return;
        }
        try {
            sessionStorage.setItem('j7Estimate', JSON.stringify({
                service: estimate.service || 'other',
                headline: estimate.headline,
                lines: estimate.lines,
                page: document.title,
                source: 'assistant',
                at: Date.now()
            }));
        } catch (e) {
            /* private mode: the form still works by hand */
        }
        window.location.href = '/#contact';
    }

    // ---------------------------------------------------------------------
    // Rendering
    // ---------------------------------------------------------------------

    function bubble(role, text, estimate) {
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
            button.textContent = 'Send this to Thomas';
            button.addEventListener('click', () => sendToForm(estimate));
            wrap.appendChild(button);
        }
        return wrap;
    }

    function render() {
        els.log.innerHTML = '';

        if (!log.length) {
            els.log.appendChild(bubble('assistant', GREETING, null));
        }
        log.forEach(m => {
            const parsed = m.role === 'assistant'
                ? extractEstimate(m.content)
                : { text: m.content, estimate: null };
            if (parsed.text || parsed.estimate) {
                els.log.appendChild(bubble(m.role, parsed.text, parsed.estimate));
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
                    aria-controls="chat-panel" aria-label="Ask about pricing">
                <span class="chat-launcher__icon" aria-hidden="true">💬</span>
                <span class="chat-launcher__label">Ask about pricing</span>
            </button>
            <div class="chat-panel panel" id="chat-panel" role="dialog"
                 aria-label="Ask about pricing" hidden>
                <div class="chat-head">
                    <div>
                        <strong>Ask about pricing</strong>
                        <p class="chat-note">Answers come from the same rates as the
                        calculators. Thomas confirms anything before work starts.</p>
                    </div>
                    <button type="button" class="chat-close" aria-label="Close">×</button>
                </div>
                <div class="chat-log" role="log" aria-live="polite"></div>
                <form class="chat-form">
                    <label class="sr-only" for="chat-input">Your question</label>
                    <input id="chat-input" class="chat-input" type="text"
                           autocomplete="off" maxlength="2000"
                           placeholder="What would four cameras cost?">
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

    function toggle(next) {
        open = next;
        els.panel.hidden = !open;
        els.root.classList.toggle('chat-root--open', open);
        els.launcher.setAttribute('aria-expanded', String(open));
        if (open) {
            render();
            els.input.focus();
        } else {
            els.launcher.focus();
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        load();
        build();
        // A conversation carried across a page load reopens itself, since the
        // visitor did not close it — they followed a link they were given.
        if (log.length) toggle(true);
    });
})();
