/* ============================================================================
   The Lincoln experiences, drawn by this demo, and the rules that decide when
   each one appears.

   Why these are not served from Dengage, unlike the shared platform library in
   the same launcher: the brand campaigns on this account were authored for the
   Nissan demo and carry Nissan model copy, which cannot be shown to a Lincoln
   audience. Rewriting them in the panel would change what the Nissan demo
   shows, so the demo owner's call on 31 August was to render the Lincoln set
   here and leave the account alone.

   What that costs, stated plainly: these are page creatives, so they do not
   prove the on-site messaging engine the way a served campaign does. The
   thirteen cards in the On-site messaging group still come from Dengage and
   are brand neutral by design, so the platform half of the story is shown with
   those.

   What stays real: everything they capture. An address typed into the
   newsletter card becomes a contact through the same relay the site forms use,
   every answer writes a row through the one events module, and the booking
   confirmation repeats back exactly what the visitor typed.

   None of them raises a nissan_demo_ data layer event, so nothing here can
   pull a Nissan campaign onto a Lincoln page, paused or live.

   TRIGGERING. Each creative carries a rule, and the rules run on page view, on
   dwell, on scroll and on exit intent, so the visitor meets them by browsing
   rather than by anyone clicking a launcher card. Every launcher card still
   fires its creative on demand, which is what a presenter needs mid-call.
   Three guards keep the set from feeling like spam: one creative on screen at
   a time, a cooldown between automatic appearances, and once per session for
   each rule, or once per visitor where the message only makes sense once.
   ========================================================================== */
(function (window, document) {
    'use strict';

    var HOST_ID = 'dps-lc-host';
    var SEEN_KEY = 'dps:lincoln:creativeSeen';
    var VISIT_KEY = 'dps:lincoln:visits';
    var MODELS_KEY = 'dps:lincoln:modelViews';
    var LAST_MODEL_KEY = 'dps:lincoln:lastModel';
    var ONCE_KEY = 'dps:lincoln:creativeOnce';
    var COOLDOWN_MS = 25000;
    var lastShownAt = 0;

    function rel() {
        return document.documentElement.getAttribute('data-rel-root') || '';
    }

    function esc(value) {
        return String(value === null || value === undefined ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function readJson(store, key, fallback) {
        try {
            var raw = window[store].getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (err) { return fallback; }
    }
    function writeJson(store, key, value) {
        try { window[store].setItem(key, JSON.stringify(value)); } catch (err) { /* private mode */ }
    }

    /* ------------------------------------------------------------------ */
    /* What the visitor has done so far                                    */

    function seen(slug) { return !!readJson('sessionStorage', SEEN_KEY, {})[slug]; }
    function markSeen(slug) {
        var all = readJson('sessionStorage', SEEN_KEY, {});
        all[slug] = Date.now();
        writeJson('sessionStorage', SEEN_KEY, all);
    }
    function seenEver(slug) { return !!readJson('localStorage', ONCE_KEY, {})[slug]; }
    function markSeenEver(slug) {
        var all = readJson('localStorage', ONCE_KEY, {});
        all[slug] = Date.now();
        writeJson('localStorage', ONCE_KEY, all);
    }

    function visits() { return readJson('localStorage', VISIT_KEY, 0) || 0; }
    function modelViews() { return readJson('sessionStorage', MODELS_KEY, []) || []; }

    function countVisit() {
        /* One visit per session, so a five page browse is not five visits. */
        try {
            if (!window.sessionStorage.getItem('dps:lincoln:visitCounted')) {
                window.sessionStorage.setItem('dps:lincoln:visitCounted', '1');
                writeJson('localStorage', VISIT_KEY, visits() + 1);
            }
        } catch (err) { /* private mode */ }
        var id = document.body.getAttribute('data-product-id');
        if (!id) return;
        var list = modelViews();
        if (list.indexOf(id) === -1) { list.push(id); writeJson('sessionStorage', MODELS_KEY, list); }
        writeJson('localStorage', LAST_MODEL_KEY, id);
    }

    function identified() { return !!(window.DemoIdentity || {}).contactKey; }
    function booked() { return !!readJson('sessionStorage', 'dps:lincoln:booked', false); }
    function financeSignal() { return !!readJson('sessionStorage', 'dps:lincoln:finance', false); }
    function bookingStarted() { return !!readJson('sessionStorage', 'dps:lincoln:started', false); }

    function page() {
        var path = window.location.pathname;
        if (/forms\/testdrive/.test(path)) return 'booking';
        if (/forms\/quote/.test(path)) return 'quote';
        if (/\/offers\//.test(path) || /\/offers\/?$/.test(path)) return 'offers';
        if (/\/vehicles\//.test(path)) return 'vehicle';
        if (/\/dealer\//.test(path)) return 'cockpit';
        if (/lincoln\/(index\.html)?$/.test(path)) return 'home';
        return 'other';
    }

    function currentModel() {
        var onPage = document.body.getAttribute('data-product-id');
        if (onPage) return onPage;
        return readJson('localStorage', LAST_MODEL_KEY, null) || 'navigator';
    }

    function modelName(id) {
        var car = window.Catalog && window.Catalog.get ? window.Catalog.get(id) : null;
        return car ? car.name : 'Lincoln';
    }

    /* ------------------------------------------------------------------ */
    /* Shape                                                               */

    function host() {
        var el = document.getElementById(HOST_ID);
        if (!el) {
            el = document.createElement('div');
            el.id = HOST_ID;
            document.body.appendChild(el);
        }
        return el;
    }

    function onScreen() {
        var el = document.getElementById(HOST_ID);
        return !!(el && el.innerHTML);
    }

    function close() {
        var el = document.getElementById(HOST_ID);
        if (el) { el.innerHTML = ''; el.removeAttribute('data-lc-slug'); }
        document.body.classList.remove('dps-lc-bar-open');
    }

    function card(inner, opts) {
        var o = opts || {};
        /* A bar sits at the edge of a page the visitor keeps reading, so it
           carries no scrim; only the modals dim what is behind them. */
        return (o.shape === 'bar' ? '' : '<div class="dps-lc-scrim" data-lc-close="1"></div>') +
            '<div class="dps-lc-panel dps-lc-' + (o.shape || 'modal') + '" role="dialog" aria-modal="true" ' +
                 'aria-label="' + esc(o.label || 'Lincoln') + '">' +
                '<button type="button" class="dps-lc-x" data-lc-close="1" aria-label="Close">&times;</button>' +
                inner +
            '</div>';
    }

    function body(title, text, actions, kicker) {
        return '<div class="dps-lc-body">' +
            (kicker ? '<span class="dps-lc-kicker">' + esc(kicker) + '</span>' : '') +
            '<h2>' + esc(title) + '</h2>' +
            '<p>' + esc(text) + '</p>' +
            (actions || '') +
        '</div>';
    }

    function cta(label, href) {
        return '<a class="dps-lc-cta" href="' + esc(href) + '">' + esc(label) + '</a>';
    }

    function dismiss(label) {
        return '<button type="button" class="dps-lc-quiet" data-lc-close="1">' + esc(label) + '</button>';
    }

    /* ------------------------------------------------------------------ */
    /* The creatives                                                       */

    var CREATIVES = {
        'test-drive-invite': function () {
            var id = currentModel();
            return card(body(
                'Take the ' + modelName(id) + ' out',
                'You have spent time with it here. The next step is the driver seat, at a Mohamed ' +
                'Yousuf Naghi Motors showroom, at a time that suits you.',
                '<div class="dps-lc-actions">' +
                    cta('Book a test drive', rel() + 'forms/testdrive/?model=' + encodeURIComponent(modelName(id))) +
                    dismiss('Maybe later') +
                '</div>',
                'Lincoln'
            ), { label: 'Test drive invitation' });
        },

        'test-drive-rescue': function () {
            return card(body(
                'Before you go',
                'Your test drive request is a minute from done, and what you have typed is still ' +
                'here. Finish it and the showroom team takes it from there.',
                '<div class="dps-lc-actions">' +
                    '<button type="button" class="dps-lc-cta" data-lc-close="1">Finish my booking</button>' +
                    dismiss('No thanks') +
                '</div>',
                'Almost there'
            ), { label: 'Test drive rescue' });
        },

        /* No figure appears here on purpose: this site publishes no prices, and
           the demo never invents one. */
        'finance-teaser': function () {
            return card(
                '<div class="dps-lc-bar-inner">' +
                    '<div><strong>Finance and lease options</strong>' +
                    '<span>Built around the model you choose, with the team at Mohamed Yousuf Naghi Motors.</span></div>' +
                    '<div class="dps-lc-actions">' +
                        '<a class="dps-lc-cta" href="' + rel() + 'forms/quote/" data-lc-finance="1">Ask about finance</a>' +
                        dismiss('Close') +
                    '</div>' +
                '</div>', { shape: 'bar', label: 'Finance options' });
        },

        'national-day': function () {
            return card(body(
                'National Day at Lincoln',
                'Saudi National Day falls on 23 September. Our showrooms mark it with a season of ' +
                'offers across the Lincoln range.',
                '<div class="dps-lc-actions">' +
                    cta('See the offers', rel() + 'offers/') +
                    dismiss('Not now') +
                '</div>',
                '23 September'
            ), { label: 'National Day' });
        },

        'ramadan-offer': function () {
            return card(body(
                'A season to arrive well',
                'Seasonal offers across the Navigator, the Aviator and the Corsair, at Mohamed ' +
                'Yousuf Naghi Motors showrooms across the Kingdom.',
                '<div class="dps-lc-actions">' +
                    cta('See the offers', rel() + 'offers/') +
                    dismiss('Not now') +
                '</div>',
                'Seasonal'
            ), { label: 'Seasonal offer' });
        },

        'newsletter-capture': function () {
            return card(
                '<form class="dps-lc-body dps-lc-form" data-lc-form="newsletter">' +
                    '<span class="dps-lc-kicker">Lincoln</span>' +
                    '<h2>News from the range, first</h2>' +
                    '<p>New arrivals, seasonal offers and showroom events from Mohamed Yousuf Naghi Motors.</p>' +
                    '<label class="dps-lc-field">' +
                        '<span>Email address</span>' +
                        '<input type="email" name="email" required autocomplete="email" placeholder="you@example.com">' +
                    '</label>' +
                    '<label class="dps-lc-check">' +
                        '<input type="checkbox" name="privacyconsent" required>' +
                        '<span>Yes, keep me posted about Lincoln models and offers.</span>' +
                    '</label>' +
                    '<div class="dps-lc-actions">' +
                        '<button type="submit" class="dps-lc-cta">Keep me posted</button>' +
                        dismiss('No thanks') +
                    '</div>' +
                '</form>', { label: 'Newsletter' });
        },

        'comeback-offer': function () {
            var id = currentModel();
            return card(body(
                'Welcome back',
                'The ' + modelName(id) + ' is where you left it, and so is the team that can put ' +
                'you behind the wheel of one.',
                '<div class="dps-lc-actions">' +
                    cta('Pick up where I left off', rel() + 'vehicles/' + id + '/') +
                    dismiss('Just browsing') +
                '</div>',
                'Good to see you again'
            ), { label: 'Welcome back' });
        },

        'shopping-survey': function () {
            var options = ['A test drive', 'Finance options', 'Pricing and availability', 'Still comparing models'];
            return card(
                '<form class="dps-lc-body dps-lc-form" data-lc-form="survey">' +
                    '<span class="dps-lc-kicker">One question</span>' +
                    '<h2>What would help you most right now?</h2>' +
                    '<p>Your answer reaches the showroom team with your profile.</p>' +
                    '<div class="dps-lc-choices">' +
                        options.map(function (o, i) {
                            return '<label class="dps-lc-choice">' +
                                '<input type="radio" name="answer" value="' + esc(o) + '"' +
                                (i === 0 ? ' required' : '') + '>' +
                                '<span>' + esc(o) + '</span>' +
                            '</label>';
                        }).join('') +
                    '</div>' +
                    '<div class="dps-lc-actions">' +
                        '<button type="submit" class="dps-lc-cta">Send my answer</button>' +
                        dismiss('Skip') +
                    '</div>' +
                '</form>', { label: 'Shopping survey' });
        },

        /* Event driven rather than rule driven: the booking writes it, and it
           repeats back exactly what was typed. Nothing here is invented, and a
           field the visitor left empty is left out rather than filled in. */
        'booking-confirmed': function (details) {
            var d = details || {};
            var rows = [
                ['Model', d.model],
                ['Name', [d.name, d.surname].filter(Boolean).join(' ')],
                ['Mobile', d.gsm],
                ['Email', d.email],
                ['City', d.city],
                ['Showroom', d.branch],
                ['Buying', d.horizon],
                ['Payment', d.payment]
            ].filter(function (r) { return r[1]; });
            var canAsk = typeof window.Notification === 'function' &&
                window.Notification.permission !== 'granted' &&
                window.DengageEvents && window.DengageEvents.pushSupported &&
                window.DengageEvents.pushSupported();
            var next = d.email
                ? 'A confirmation is on its way to ' + d.email + '.'
                : 'The showroom team has your request.';
            if (canAsk) next += ' Turn on notifications and the same confirmation arrives on this device.';
            else if (window.Notification && window.Notification.permission === 'granted') {
                next += ' A notification follows on this device.';
            }
            return card(
                '<div class="dps-lc-body">' +
                    '<span class="dps-lc-kicker">Test drive booked</span>' +
                    '<h2>Thank you' + (d.name ? ', ' + esc(d.name) : '') + '</h2>' +
                    '<p>' + esc(next) + '</p>' +
                    '<dl class="dps-lc-summary">' +
                        rows.map(function (r) {
                            return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>';
                        }).join('') +
                    '</dl>' +
                    '<div class="dps-lc-actions">' +
                        (canAsk
                            ? '<button type="button" class="dps-lc-cta" data-lc-push="1">Notify me too</button>'
                            : '') +
                        '<button type="button" class="dps-lc-quiet" data-lc-close="1">Done</button>' +
                    '</div>' +
                '</div>', { label: 'Booking confirmed' });
        }
    };

    /* ------------------------------------------------------------------ */

    var lastBooking = null;

    function show(slug, data, automatic) {
        if (slug === 'booking-confirmed' && data) lastBooking = data;
        var make = CREATIVES[slug];
        if (!make) return false;
        var el = host();
        el.innerHTML = make(data);
        el.setAttribute('data-lc-slug', slug);
        document.body.classList.toggle('dps-lc-bar-open', !!el.querySelector('.dps-lc-bar'));
        markSeen(slug);
        if (automatic) lastShownAt = Date.now();
        try {
            document.dispatchEvent(new CustomEvent('dps:lincoln:creative',
                { detail: { slug: slug, automatic: !!automatic } }));
        } catch (err) { /* old browser */ }
        return true;
    }

    /* ------------------------------------------------------------------ */
    /* The rules. Order is priority: the first one that fits wins, and only
       one runs per check.                                                  */

    var RULES = [
        {
            slug: 'test-drive-rescue', on: 'exit',
            fits: function () { return page() === 'booking' && bookingStarted() && !booked(); }
        },
        {
            slug: 'shopping-survey', on: 'scroll', depth: 0.6, dwell: 12000,
            fits: function () { return page() === 'vehicle' || page() === 'offers'; }
        },
        {
            slug: 'test-drive-invite', on: 'dwell', after: 18000,
            fits: function () {
                return page() === 'vehicle' && modelViews().length >= 2 && !booked();
            }
        },
        {
            slug: 'finance-teaser', on: 'dwell', after: 30000,
            fits: function () {
                return (page() === 'vehicle' || page() === 'offers') && financeSignal() && !booked();
            }
        },
        {
            slug: 'national-day', on: 'dwell', after: 9000,
            fits: function () { return page() === 'offers'; }
        },
        {
            slug: 'ramadan-offer', on: 'dwell', after: 12000,
            fits: function () { return page() === 'offers' && seen('national-day'); }
        },
        {
            slug: 'comeback-offer', on: 'dwell', after: 6000, once: 'session',
            fits: function () { return page() === 'home' && visits() >= 2 && !booked(); }
        },
        {
            slug: 'newsletter-capture', on: 'scroll', depth: 0.45, dwell: 20000, once: 'visitor',
            fits: function () {
                return (page() === 'home' || page() === 'other') && !identified();
            }
        }
    ];

    function eligible(rule) {
        if (seen(rule.slug)) return false;
        if (rule.once === 'visitor' && seenEver(rule.slug)) return false;
        if (onScreen()) return false;
        if (Date.now() - lastShownAt < COOLDOWN_MS) return false;
        return rule.fits();
    }

    function run(kind, context) {
        for (var i = 0; i < RULES.length; i++) {
            var rule = RULES[i];
            if (rule.on !== kind) continue;
            if (kind === 'scroll' && (context.depth < rule.depth || context.dwell < rule.dwell)) continue;
            /* A dwell rule waits out its own delay. Without this the three
               second sweep below shows the first eligible one after three
               seconds, whatever `after` says, and the invitation meant for a
               visitor who lingered arrives before they have read anything.
               Worse, it is once per session, so it is spent before the moment
               it was written for. */
            if (kind === 'dwell' && context.dwell < rule.after) continue;
            if (!eligible(rule)) continue;
            if (rule.once === 'visitor') markSeenEver(rule.slug);
            show(rule.slug, null, true);
            return true;
        }
        return false;
    }

    /* ------------------------------------------------------------------ */

    function thanks(form, message) {
        var wrap = document.createElement('div');
        wrap.className = 'dps-lc-body dps-lc-done';
        wrap.innerHTML = '<span class="dps-lc-kicker">Thank you</span>' +
            '<p>' + esc(message) + '</p>' +
            '<div class="dps-lc-actions"><button type="button" class="dps-lc-cta" data-lc-close="1">Close</button></div>';
        if (form.parentNode) form.parentNode.replaceChild(wrap, form);
    }

    function wire() {
        document.addEventListener('click', function (event) {
            var el = event.target;
            var fin = el.closest ? el.closest('[data-lc-finance]') : null;
            if (fin && window.DengageEvents) {
                window.DengageEvents.leadEvent('finance_intent', {
                    model: currentModel(), source: 'website', note: 'on-site finance card'
                });
            }
            var wantsPush = el.closest ? el.closest('[data-lc-push]') : null;
            if (wantsPush) {
                wantsPush.disabled = true;
                wantsPush.textContent = 'Asking your browser';
                if (window.Site && window.Site.mintIdentity) window.Site.mintIdentity();
                if (window.DengageEvents && window.DengageEvents.pushPrompt) {
                    window.DengageEvents.pushPrompt();
                }
                /* The subscription reaches Dengage a moment after the visitor
                   allows it. Only then can a push be addressed to this device,
                   so the confirmation is asked for a second time, once. */
                window.setTimeout(function () {
                    var granted = window.Notification && window.Notification.permission === 'granted';
                    wantsPush.textContent = granted ? 'On its way' : 'Notifications are blocked';
                    if (granted && lastBooking && window.Site && window.Site.confirmBooking) {
                        window.Site.confirmBooking(lastBooking);
                    }
                }, 4000);
                return;
            }
            if (el.closest && el.closest('[data-lc-close]')) { close(); return; }
        });

        document.addEventListener('submit', function (event) {
            var form = event.target;
            if (!form || !form.getAttribute) return;
            var kind = form.getAttribute('data-lc-form');
            if (!kind) return;
            event.preventDefault();
            if (event.stopImmediatePropagation) event.stopImmediatePropagation();

            if (kind === 'newsletter') {
                var email = form.querySelector('input[name="email"]');
                var consent = form.querySelector('input[name="privacyconsent"]');
                if (!email || !email.value || (email.checkValidity && !email.checkValidity())) {
                    if (email && email.reportValidity) email.reportValidity();
                    return;
                }
                if (consent && !consent.checked) {
                    if (consent.reportValidity) consent.reportValidity();
                    return;
                }
                if (window.Site && window.Site.mintIdentity) window.Site.mintIdentity();
                if (window.Site && window.Site.relayLead) {
                    window.Site.relayLead(form, { form: 'register_interest' });
                }
                if (window.DengageEvents) {
                    window.DengageEvents.leadEvent('register_interest', {
                        model: currentModel(), source: 'website', note: 'newsletter card'
                    });
                }
                if (window.Site && window.Site.confirmBooking) {
                    window.Site.confirmBooking({
                        model: modelName(currentModel()), model_id: currentModel(),
                        email: email.value.trim()
                    }, 'newsletter');
                }
                thanks(form, 'You are on the list, and your profile in Dengage now carries that consent.');
                return;
            }

            if (kind === 'survey') {
                var picked = form.querySelector('input[name="answer"]:checked');
                if (!picked) return;
                if (window.DengageEvents) {
                    window.DengageEvents.leadEvent('survey_response', {
                        model: currentModel(), source: 'website', note: picked.value
                    });
                }
                if (window.Site && window.Site.confirmBooking) {
                    window.Site.confirmBooking({
                        model: modelName(currentModel()), model_id: currentModel(),
                        purchase_horizon: picked.value
                    }, 'survey');
                }
                thanks(form, 'Your answer is on your profile, where a journey can act on it.');
                return;
            }
        }, true);

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') close();
        });

        /* Exit intent: the pointer leaves through the top of the window. */
        document.addEventListener('mouseout', function (event) {
            if (event.relatedTarget || event.clientY > 8) return;
            run('exit', {});
        });

        var opened = Date.now();
        var deepest = 0;
        window.addEventListener('scroll', function () {
            var height = document.documentElement.scrollHeight - window.innerHeight;
            if (height <= 0) return;
            var depth = (window.pageYOffset || document.documentElement.scrollTop) / height;
            if (depth <= deepest) return;
            deepest = depth;
            run('scroll', { depth: depth, dwell: Date.now() - opened });
        }, { passive: true });

        /* Dwell rules are checked on their own schedule rather than once, so a
           visitor who stays becomes eligible without touching anything. */
        window.setInterval(function () {
            run('dwell', { dwell: Date.now() - opened });
        }, 3000);
        RULES.filter(function (r) { return r.on === 'dwell'; }).forEach(function (r) {
            window.setTimeout(function () { run('dwell', { dwell: Date.now() - opened }); }, r.after + 200);
        });
    }

    countVisit();
    wire();

    window.LincolnCreatives = {
        show: function (slug, data) { return show(slug, data, false); },
        close: close,
        confirm: function (details) { return show('booking-confirmed', details, false); },
        slugs: Object.keys(CREATIVES)
    };
})(window, document);
