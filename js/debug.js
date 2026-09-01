/* ============================================================================
   THE EVENT READOUT. Off unless the URL asks for it.

     ?debug=1        show it
     ?debug=0        hide it again, and forget the choice

   WHY THIS EXISTS. On 6 August 2026 a wishlist event was not reaching Dengage,
   and answering "did my click actually send anything" took the best part of an
   hour of reading table row counts in the panel. It could not be answered from
   the storefront at all, because a demo that sends nothing looks exactly like a
   demo that sends everything.

   It also could not be answered from the panel, and that is the part worth
   understanding: the six ecommerce tables are shared with the other properties on
   this account and carry no column identifying which demo a row came from, so
   "newest row" is a fact about eight properties rather than about this one. The
   page is the only place that knows what THIS demo just sent. So the readout
   belongs here.

   IT IS NOT A SECOND CALLER OF window.dengage, and that is deliberate.
   js/dengageEvents.js announces every send on a namespaced custom event and this
   listens for it. The guard's event-single-source check refuses an SDK call from
   anywhere else, and wrapping window.dengage to observe it would route around
   exactly the rule that keeps a demo's writes auditable. Handoff 5.3.

   It shows what the site SENT, not what Dengage STORED. An entry means the call
   was made with that payload. Handoff 12.5 still applies: a send is not a stored
   row, and the panel is still where you confirm the row.

   AND IT WATCHES THE TRANSPORT, ADDED 7 AUGUST 2026, because the list above was
   not enough twice in one day. A content blocker on one device was dropping every
   request to the event host while permitting the push host, so the SDK loaded, the
   device registered, and not one event was stored. The event list showed all of
   them as sent, because from inside the page a request that is blocked before it
   leaves looks exactly like one that succeeded.

   So fetch, XHR and sendBeacon are observed, and any request to a dengage.com host
   is listed with its host and its outcome. That is NOT the rule above being bent:
   the rule is about who may CALL the SDK, and reading the transport calls nothing.
   It does mean the SDK's own traffic now appears too, subscription and session
   requests included, and that is the point. One host answering while the one next
   to it fails is the signature worth seeing, and it cannot be seen any other way
   on a phone, where there is no network panel at all.
   ========================================================================== */
(function (window, document) {
    'use strict';

    var PARAM = 'debug';
    var MAX_ROWS = 40;          /* enough for a whole call, bounded so a long
                                   session cannot grow the DOM without limit */

    function slug() {
        return window.DEMO_SLUG || (window.DEMO_CONFIG && window.DEMO_CONFIG.slug) || 'demo';
    }

    /* Namespaced, because all demos share one origin and two open at once must not
       read each other's preference. Non-negotiable 6. */
    function storeKey() { return 'dps:' + slug() + ':debug'; }
    function eventName() { return 'dps:' + slug() + ':event'; }
    function minKey() { return 'dps:' + slug() + ':debugmin'; }
    function readJson(key, fallback) {
        try {
            var raw = window.sessionStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (err) { return fallback; }
    }
    function messageName() { return 'dps:' + slug() + ':confirmation'; }

    function wanted() {
        var value = null;
        try {
            value = new URLSearchParams(window.location.search).get(PARAM);
        } catch (err) { value = null; }

        /* An explicit choice in the URL wins and is remembered, so it survives
           clicking through to a product page. Without that it would switch itself
           off on the first navigation, which is the moment it is most wanted. */
        if (value === '1' || value === 'true' || value === 'on') {
            try { window.sessionStorage.setItem(storeKey(), '1'); } catch (err) { /* private mode */ }
            return true;
        }
        if (value === '0' || value === 'false' || value === 'off') {
            try { window.sessionStorage.removeItem(storeKey()); } catch (err) { /* private mode */ }
            return false;
        }
        try {
            return window.sessionStorage.getItem(storeKey()) === '1';
        } catch (err) {
            return false;
        }
    }

    if (!wanted()) return;

    /* ------------------------------------------------------------------ */

    var rows = [];
    var panel = null;
    var list = null;
    var countEl = null;

    function esc(text) {
        return String(text === null || text === undefined ? '' : text)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function clock(at) {
        var d = new Date(at);
        function two(n) { return (n < 10 ? '0' : '') + n; }
        return two(d.getHours()) + ':' + two(d.getMinutes()) + ':' + two(d.getSeconds());
    }

    /* The table each action writes, so the readout answers "and where does that
       land" without a second lookup. Kept in step with CLAUDE.md 1b. */
    var TABLES = {
        'pageView': 'page_view_events',
        'ec:addToCart': 'shopping_cart_events',
        'ec:removeFromCart': 'shopping_cart_events',
        'ec:deleteCart': 'shopping_cart_events',
        'ec:beginCheckout': 'shopping_cart_events',
        'ec:order': 'order_events + order_events_detail',
        'ec:cancelOrder': 'order_events',
        'ec:addToWishlist': 'wishlist_events',
        'ec:removeFromWishlist': 'wishlist_events',
        'ec:search': 'search_events',
        'lead:walk_in': 'ni_lead_events',
        'lead:test_drive_booked': 'ni_lead_events',
        'lead:test_drive_done': 'ni_lead_events',
        'lead:no_show': 'ni_lead_events',
        'lead:quote_issued': 'ni_lead_events',
        'lead:call_outcome': 'ni_lead_events',
        'lead:whatsapp_intent': 'ni_lead_events',
        'lead:vehicle_sold': 'ni_lead_events',
        'lead:brochure': 'ni_lead_events',
        'lead:finance_intent': 'ni_lead_events',
        'lead:register_interest': 'ni_lead_events'
    };

    /* ------------------------------------------------------------------ */
    /* The transport                                                       */

    function isDengage(url) {
        return String(url || '').indexOf('dengage.com') !== -1;
    }

    function hostOf(url) {
        try { return new URL(String(url), window.location.href).host; }
        catch (err) { return String(url).split('/')[2] || String(url); }
    }
    function pathOf(url) {
        try { return new URL(String(url), window.location.href).pathname; }
        catch (err) { return ''; }
    }

    /* status 0 means it never got an answer, which on a phone is almost always a
       blocker or a DNS filter rather than an outage. The reason is carried through
       so the readout can say which. */
    function net(method, url, status, reason, at) {
        add({
            kind: 'net',
            method: method,
            host: hostOf(url),
            path: pathOf(url),
            status: status,
            reason: reason || '',
            at: at || Date.now()
        });
    }

    /* Installed as early as this file runs, which is before js/boot.js fires the
       first pageView. The SDK loads async and later, so its own traffic is caught
       too. Every wrapper passes the original through untouched and never swallows
       an error: a readout is not allowed to change what the page does. */
    function watchTransport() {
        var originalFetch = window.fetch;
        if (typeof originalFetch === 'function') {
            window.fetch = function (input, init) {
                var url = '';
                try { url = typeof input === 'string' ? input : (input && input.url) || ''; }
                catch (err) { url = ''; }
                if (!isDengage(url)) return originalFetch.apply(this, arguments);
                var method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
                var at = Date.now();
                return originalFetch.apply(this, arguments).then(function (response) {
                    net(method, url, response.status, '', at);
                    return response;
                }, function (err) {
                    net(method, url, 0, (err && err.message) || 'no response', at);
                    throw err;
                });
            };
        }

        var XHR = window.XMLHttpRequest;
        if (XHR && XHR.prototype && XHR.prototype.send && XHR.prototype.open) {
            var open = XHR.prototype.open;
            var send = XHR.prototype.send;
            XHR.prototype.open = function (method, url) {
                this.__dpsMethod = String(method || 'GET').toUpperCase();
                this.__dpsUrl = String(url || '');
                return open.apply(this, arguments);
            };
            XHR.prototype.send = function () {
                var self = this;
                if (isDengage(self.__dpsUrl)) {
                    var at = Date.now();
                    self.addEventListener('load', function () {
                        net(self.__dpsMethod, self.__dpsUrl, self.status, '', at);
                    });
                    self.addEventListener('error', function () {
                        net(self.__dpsMethod, self.__dpsUrl, 0, 'no response', at);
                    });
                    self.addEventListener('timeout', function () {
                        net(self.__dpsMethod, self.__dpsUrl, 0, 'timed out', at);
                    });
                }
                return send.apply(this, arguments);
            };
        }

        /* sendBeacon returns false when the browser refuses to queue it, which a
           blocker does, and that false is the only signal it ever gives. */
        var nav = window.navigator;
        if (nav && typeof nav.sendBeacon === 'function') {
            var beacon = nav.sendBeacon.bind(nav);
            nav.sendBeacon = function (url) {
                var queued = beacon.apply(nav, arguments);
                if (isDengage(url)) {
                    net('BEACON', url, queued ? 204 : 0, queued ? '' : 'refused by the browser');
                }
                return queued;
            };
        }
    }

    watchTransport();

    /* ------------------------------------------------------------------ */

    function build() {
        panel = document.createElement('aside');
        panel.id = 'dps-debug';
        panel.setAttribute('aria-label', 'Dengage event readout');
        panel.innerHTML =
            '<div class="dps-debug-head">' +
              '<strong>Events and traffic</strong>' +
              '<span id="dps-debug-count">0</span>' +
              '<button type="button" data-debug-min title="Collapse to the title bar">&minus;</button>' +
              '<button type="button" data-debug-copy title="Copy all as JSON">Copy</button>' +
              '<button type="button" data-debug-clear title="Clear the list">Clear</button>' +
              '<button type="button" data-debug-close title="Hide. Add ?debug=1 to bring it back">&times;</button>' +
            '</div>' +
            '<ol id="dps-debug-list"></ol>' +
            '<p class="dps-debug-foot">What this page sent, and every request to a ' +
            'dengage.com host. An accepted request is still not a stored row: ' +
            'confirm in Data Space.</p>';
        document.body.appendChild(panel);
        list = panel.querySelector('#dps-debug-list');
        countEl = panel.querySelector('#dps-debug-count');
        if (panel.classList.contains('dps-debug-min')) {
            panel.querySelector('[data-debug-min]').innerHTML = '&plus;';
        }

        /* Collapsed by preference, kept per demo so one open readout does not
           collapse the other. It sits over the page it is reporting on, and on
           a laptop it covers the very control somebody is about to press. */
        if (readJson(minKey(), false)) panel.classList.add('dps-debug-min');

        panel.addEventListener('click', function (event) {
            var t = event.target;
            if (t.hasAttribute && t.hasAttribute('data-debug-min')) {
                var closed = panel.classList.toggle('dps-debug-min');
                try { window.sessionStorage.setItem(minKey(), JSON.stringify(closed)); }
                catch (err) { /* private mode */ }
                t.innerHTML = closed ? '&plus;' : '&minus;';
                return;
            }
            if (t.hasAttribute && t.hasAttribute('data-debug-close')) {
                try { window.sessionStorage.removeItem(storeKey()); } catch (err) { /* private mode */ }
                panel.remove();
                return;
            }
            if (t.hasAttribute && t.hasAttribute('data-debug-clear')) {
                rows = [];
                render();
                return;
            }
            if (t.hasAttribute && t.hasAttribute('data-debug-copy')) {
                var text = JSON.stringify(rows, null, 2);
                if (window.navigator && window.navigator.clipboard) {
                    window.navigator.clipboard.writeText(text).then(function () {
                        t.textContent = 'Copied';
                        window.setTimeout(function () { t.textContent = 'Copy'; }, 1200);
                    }, function () { /* denied, nothing to do */ });
                }
            }
        });
    }

    /* Newest first. Somebody watching during a call is looking at the top of the
       list, and scrolling up to find what just happened is a small annoyance
       repeated every single press. Events and requests share one list, in time
       order, deliberately: correlating them by eye is the whole diagnosis, and
       pairing them up in code would be a guess, because the SDK decides when to
       send and may batch. */
    function add(row) {
        rows.unshift(row);
        if (rows.length > MAX_ROWS) rows.length = MAX_ROWS;
        render();
    }

    function renderEvent(row) {
        var table = TABLES[row.action] || '';
        return '<li' + (row.accepted ? '' : ' class="not-sent"') + '>' +
            '<div class="dps-debug-top">' +
              '<code>' + esc(row.action) + '</code>' +
              '<span class="dps-debug-time">' + esc(clock(row.at)) + '</span>' +
            '</div>' +
            (table ? '<div class="dps-debug-table">' + esc(table) + '</div>' : '') +
            (row.accepted
                ? '<div class="dps-debug-table">handed to the SDK. Look for the request below</div>'
                : '<div class="dps-debug-warn">not sent, no application on this page</div>') +
            '<pre>' + esc(JSON.stringify(row.payload)) + '</pre>' +
        '</li>';
    }

    function renderNet(row) {
        var ok = row.status >= 200 && row.status < 400;
        var outcome = row.status
            ? 'HTTP ' + row.status
            : 'no response' + (row.reason ? ', ' + row.reason : '');
        return '<li class="dps-net' + (ok ? '' : ' not-sent') + '">' +
            '<div class="dps-debug-top">' +
              '<code>' + esc(row.method + ' ' + row.host) + '</code>' +
              '<span class="dps-debug-time">' + esc(clock(row.at)) + '</span>' +
            '</div>' +
            '<div class="dps-debug-table">' + esc(row.path) + '</div>' +
            (ok
                ? '<div class="dps-debug-table">' + esc(outcome) + '. Accepted, which is not the same as stored</div>'
                : '<div class="dps-debug-warn">' + esc(outcome) +
                  '. Nothing reached Dengage. A content blocker or a DNS filter on this ' +
                  'device is the usual cause, and it can block one host while allowing ' +
                  'the next</div>') +
        '</li>';
    }

    /* The messages a moment earned, and what Dengage answered for each channel.
       This one is not a send from the page: it is the page asking Dengage to
       send, and Dengage's own reply coming back. So it is the only row here
       that reports something the platform said rather than something the
       browser did, which is exactly what makes it worth showing on a call. */
    function renderMessage(row) {
        function channel(label, outcome) {
            var good = outcome === 'sent' || outcome === 'sent to this device by token';
            return '<div class="' + (good ? 'dps-debug-table' : 'dps-debug-warn') + '">' +
                esc(label + ': ' + outcome) + '</div>';
        }
        return '<li class="dps-net">' +
            '<div class="dps-debug-top">' +
              '<code>message: ' + esc(row.moment) + '</code>' +
              '<span class="dps-debug-time">' + esc(clock(row.at)) + '</span>' +
            '</div>' +
            channel('email', row.email) +
            channel('push', row.push) +
            (row.personalized && row.personalized.length
                ? '<pre>' + esc(row.personalized.join(', ')) + '</pre>'
                : '') +
        '</li>';
    }

    function render() {
        if (!list) return;
        list.innerHTML = rows.map(function (row) {
            if (row.kind === 'net') return renderNet(row);
            if (row.kind === 'message') return renderMessage(row);
            return renderEvent(row);
        }).join('');
        if (countEl) countEl.textContent = String(rows.length);
    }

    window.addEventListener(eventName(), function (event) {
        var detail = event.detail || {};
        add({
            kind: 'event',
            action: detail.action,
            payload: detail.payload,
            /* `accepted`, because that is all the emitter can know. See the note on
               announceSent in js/dengageEvents.js. */
            accepted: !!detail.accepted,
            at: detail.at || Date.now()
        });
    });

    /* js/site.js announces what came back from the message function. Reading it
       here calls nothing: the ask has already happened and this is its reply. */
    document.addEventListener(messageName(), function (event) {
        var d = event.detail || {};
        if (!d.moment) return;
        add({
            kind: 'message',
            moment: d.moment,
            email: d.email || 'no answer',
            push: d.push || 'no answer',
            personalized: d.personalized || [],
            at: Date.now()
        });
    });

    if (document.body) build();
    else document.addEventListener('DOMContentLoaded', build);
})(window, document);
