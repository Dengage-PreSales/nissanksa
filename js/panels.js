/* ============================================================================
   The scenario launcher and the event panel, adapted from the Dengage demo
   factory for the Nissan KSA demo site.

   TWO GROUPS OF TRIGGER CARDS, and the order is deliberate:

     1. Nissan scenarios fire nissan_demo_<slug> events. Each is a one-off
        campaign written for this demo, pasted into the panel from panel/ in
        this repository. The prefix is deliberately different from the shared
        set, and every one of those campaigns carries a display rule scoped to
        /nissanksa/, so they can never appear on any other demo sharing this
        Dengage application. All ten live in the pre-purchase lifecycle,
        deliberately: this demo ends at the moment the car is sold.

     2. The platform library fires the shared dengage_demo_<slug> campaigns
        that serve every factory demo. Slugs and prefix are untouched: renaming
        either silently kills the widget, because a missing campaign never
        errors, it simply never appears.

   The event panel keeps the factory's structural fix: there is no free-text
   table field anywhere. The operator picks an event from a fixed list, the
   event determines its table, and the card copy names that table truthfully,
   relabelled here in automotive terms because on this site "add to cart" IS
   selecting a car for a test drive.
   ========================================================================== */
(function (window, document) {
    'use strict';

    var $ = function (sel) { return document.querySelector(sel); };

    var SCENARIOS = [
        /* Nissan one-off campaigns, all pre-purchase. hy: true switches the
           fired prefix to the brand one. */
        { slug: 'test-drive-invite',  name: 'Test drive invite',  group: 'brand', local: true },
        { slug: 'test-drive-rescue',  name: 'Test drive rescue',  group: 'brand', local: true,
          also: 'alsoExitIntent' },
        { slug: 'finance-teaser',     name: 'Finance teaser',     group: 'brand', local: true },
        { slug: 'national-day',       name: 'National Day offer', group: 'brand', local: true },
        { slug: 'ramadan-offer',      name: 'Seasonal offer',     group: 'brand', local: true },
        { slug: 'tekton-launch-bar',  name: 'Tekton launch bar',  group: 'brand', local: true },
        { slug: 'arrival-alert',      name: 'Arrival alert',      group: 'brand', local: true },
        { slug: 'newsletter-capture', name: 'Newsletter capture', group: 'brand', local: true },
        { slug: 'comeback-offer',     name: 'Welcome back offer', group: 'brand', local: true },
        { slug: 'shopping-survey',    name: 'Shopping survey',    group: 'brand', local: true,
          also: 'alsoScrollDepth' },

        /* The shared platform library. Slugs must not change. */
        { slug: 'subscription-popup', name: 'Subscription',     group: 'onsite' },
        { slug: 'survey',             name: 'Survey',           group: 'onsite' },
        { slug: 'nps-popup',          name: 'NPS',              group: 'onsite' },
        { slug: 'image-popup',        name: 'Image popup',      group: 'onsite' },
        { slug: 'horizontal-popup',   name: 'Horizontal popup', group: 'onsite' },
        { slug: 'cta-image-popup',    name: 'CTA image popup',  group: 'onsite' },
        { slug: 'sticky-bar',         name: 'Sticky bar',       group: 'onsite' },
        { slug: 'image-bar',          name: 'Image bar',        group: 'onsite' },
        { slug: 'slide-in',           name: 'Slide in',         group: 'onsite' },
        { slug: 'vertical-popup',     name: 'Vertical popup',   group: 'onsite' },
        { slug: 'story',              name: 'Story',            group: 'onsite', panel: true },
        { slug: 'exit-intent',        name: 'Exit intent',      group: 'onsite',
          gesture: 'gestureExitIntent' },
        { slug: 'scroll-depth',       name: 'Scroll depth',     group: 'onsite',
          gesture: 'gestureScrollDepth' },

        { slug: 'ab-test',            name: 'A/B test',         group: 'abtest' },

        { slug: 'spin-to-win',        name: 'Spin to win',      group: 'game' },
        { slug: 'scratch-card',       name: 'Scratch card',     group: 'game' },
        { slug: 'countdown-to-win',   name: 'Countdown to win', group: 'game' },

        /* Inline renders into a slot in the page rather than over it. Three of
           the five slots exist on specific pages, and firing one elsewhere is
           refused rather than allowed to look like a failure. */
        { slug: 'inline-below-header',    name: 'Below header',    group: 'inline',
          target: 'dn_inline_target_below_header' },
        { slug: 'inline-below-hero',      name: 'Below hero',      group: 'inline',
          target: 'dn_inline_target_below_hero' },
        { slug: 'inline-in-grid',         name: 'In grid',         group: 'inline',
          target: 'dn_inline_target_in_grid' },
        { slug: 'inline-pdp-below-price', name: 'Below price',     group: 'inline',
          target: 'dn_inline_target_pdp_below_price' },
        { slug: 'inline-above-footer',    name: 'Above footer',    group: 'inline',
          target: 'dn_inline_target_above_footer' },

        /* Actions call the SDK rather than pushing an event. */
        { slug: 'web-push',       name: 'Web push',       group: 'push',
          action: 'push-prompt', actionCopy: 'actionPushPrompt' },
        { slug: 'inbox',          name: 'App inbox',      group: 'inbox',
          action: 'inbox-open', actionCopy: 'actionInboxOpen', target: 'inbox-body' },

        /* THE TWO PAGES THAT ARE NOT PART OF THE STOREFRONT, and why they are
           here rather than in the site menu. The cockpit stands in for a
           showroom tablet and the console reads Dengage's own row counts:
           neither belongs in a menu a prospect can open, so both were reached
           by typing a URL. That is fine on a laptop and hopeless on a phone
           halfway through a call, which is where this launcher already lives.
           They open in a new tab so the storefront keeps its place, its
           session and whatever the visitor has done so far. */
        { slug: 'dealer-cockpit', name: 'Dealer cockpit', group: 'presenter',
          action: 'go-dealer', actionCopy: 'actionGoDealer' },
        { slug: 'verify-console', name: 'Verification console', group: 'presenter',
          action: 'go-verify', actionCopy: 'actionGoVerify' }
    ];

    var GROUPS = [
        { id: 'brand', copy: 'groupBrand' },
        { id: 'onsite',  copy: 'groupOnsite' },
        { id: 'abtest',  copy: 'groupAbTest' },
        { id: 'game',    copy: 'groupGame' },
        { id: 'inline',  copy: 'groupInline' },
        { id: 'push',    copy: 'groupPush' },
        { id: 'inbox',   copy: 'groupInbox' },
        { id: 'presenter', copy: 'groupPresenter' }
    ];

    /* Fixed list, no free text anywhere. Each entry names the table it writes,
       and the automotive label says what the event means on THIS site. */
    var EVENTS = [
        { id: 'pageView',              label: 'Page view',                              table: 'page_view_events' },
        { id: 'ec:addToCart',          label: 'Car selected for booking (add to cart)', table: 'shopping_cart_events' },
        { id: 'ec:removeFromCart',     label: 'Car deselected (remove from cart)',      table: 'shopping_cart_events' },
        { id: 'ec:beginCheckout',      label: 'Booking form opened (begin checkout)',   table: 'shopping_cart_events' },
        { id: 'ec:order',              label: 'Test drive booked (order)',              table: 'order_events, order_events_detail' },
        { id: 'ec:search',             label: 'Model search',                           table: 'search_events' },
        { id: 'ec:addToWishlist',      label: 'Car saved (add to wishlist)',            table: 'wishlist_events' },
        { id: 'ec:removeFromWishlist', label: 'Saved car removed',                      table: 'wishlist_events' }
    ];

    var ALLOWED = EVENTS.map(function (e) { return e.id; });

    function log(message, detail) {
        var pane = $('#panel-log');
        if (!pane) return;
        var time = new Date().toTimeString().slice(0, 8);
        pane.textContent = time + '  ' + message +
            (detail ? '\n' + JSON.stringify(detail, null, 2) : '') +
            '\n\n' + pane.textContent;
    }

    function dcfg() { return (window.DEMO_CONFIG && window.DEMO_CONFIG.dengage) || {}; }
    function scenarioPrefix() { return dcfg().scenarioPrefix || 'dengage_demo_'; }
    function brandPrefix() { return dcfg().brandPrefix || 'nissan_demo_'; }
    /* True when this demo has been switched to the Dengage on-site campaigns
       with ?onsite=panel, so a brand card prints the event name it will raise
       rather than saying the demo draws it. */
    function panelMode() {
        return !!(window.NissanCreatives && window.NissanCreatives.source() === 'panel');
    }

    /* An iPhone or iPad running this in a browser tab rather than from the
       Home Screen. Every browser on iOS is Safari underneath, so the engine
       rather than the brand is what decides, and iPadOS reports itself as a
       Mac, which the touch point count gives away. Reading standalone tells us
       the Home Screen app is already open, where push does work. */
    function iosSafariTab() {
        var nav = window.navigator || {};
        var ios = /iPad|iPhone|iPod/.test(nav.platform || '') ||
                  (/Mac/.test(nav.platform || '') && (nav.maxTouchPoints || 0) > 1) ||
                  /iPad|iPhone|iPod/.test(nav.userAgent || '');
        if (!ios) return false;
        var installed = nav.standalone === true ||
            (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
        return !installed;
    }

    /* The brand cards carry the nissan_demo_ prefix whether they are drawn
       here or served from the panel, because that is the campaign name a
       reader would go looking for. Everything else is the shared library. */
    function prefixFor(spec) {
        return spec && (spec.hy || spec.local) ? brandPrefix() : scenarioPrefix();
    }

    function text(key) {
        return (window.Storefront && window.Storefront.t) ? window.Storefront.t(key) : key;
    }

    /* ------------------------------------------------------------------ */
    /* Launcher                                                            */

    function renderLauncher() {
        var host = $('#launcher-grid');
        if (!host) return;

        host.innerHTML = GROUPS.map(function (g) {
            var members = SCENARIOS.filter(function (s) { return s.group === g.id; });
            if (!members.length) return '';

            return '<h3 class="launcher-group">' + text(g.copy) +
                   ' <span>' + members.length + '</span></h3>' +
                members.map(function (s) {
                    if (s.gesture) {
                        return '<button type="button" class="scenario gesture" ' +
                                'data-gesture="' + s.slug + '">' +
                            '<span class="name">' + s.name + '</span>' +
                            '<span class="slug">' + text(s.gesture) + '</span>' +
                        '</button>';
                    }
                    if (s.action) {
                        return '<button type="button" class="scenario action" ' +
                                'data-action="' + s.action + '">' +
                            '<span class="name">' + s.name + '</span>' +
                            '<span class="slug">' + text(s.actionCopy) + '</span>' +
                        '</button>';
                    }
                    var here = !s.target || document.getElementById(s.target);
                    return '<button type="button" class="scenario' + (here ? '' : ' elsewhere') +
                            (s.local ? ' brand' : '') +
                            '" data-scenario="' + s.slug + '">' +
                        '<span class="name">' + s.name + '</span>' +
                        '<span class="slug">' +
                            (s.local
                                ? (panelMode()
                                    ? prefixFor(s) + s.slug
                                    : text(s.also ? s.also : 'drawnHere'))
                                : (here ? prefixFor(s) + s.slug : text('inlineElsewhere'))) +
                        '</span>' +
                    '</button>';
                }).join('');
        }).join('');
    }

    /* ------------------------------------------------------------------ */
    /* Quick reference                                                     */

    function esc(value) {
        return String(value === null || value === undefined ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    var REF_ROWS = [
        { key: 'deviceId',   copy: 'refDevice' },
        { key: 'sessionId',  copy: 'refSession' },
        { key: 'pushToken',  copy: 'refToken' },
        { key: 'contactKey', copy: 'refContact' },
        { key: 'demoUrl',    copy: 'refPageUrl' },
        { key: 'accountId',  copy: 'refAccount' },
        { key: 'appGuid',    copy: 'refApp' }
    ];

    function renderReference() {
        var host = $('#ref-grid');
        if (!host || !window.DengageEvents || !window.DengageEvents.reference) return;

        function paint(values) {
            host.innerHTML = REF_ROWS.map(function (row) {
                var value = values[row.key];
                var missing = !value;
                var shown = missing ? text('refNone') : String(value);
                return '<div class="ref-row' + (missing ? ' empty' : '') + '">' +
                    '<span class="ref-label">' + text(row.copy) + '</span>' +
                    '<code class="ref-value"' + (missing ? '' : ' title="' + esc(String(value)) + '"') +
                        '>' + esc(shown) + '</code>' +
                    (missing ? '' :
                      '<button type="button" class="ref-copy" data-ref-copy="' + esc(String(value)) + '" ' +
                      'aria-label="' + esc(text('refCopy')) + '">' +
                      text('refCopy') + '</button>') +
                '</div>';
            }).join('');
        }

        paint({});
        window.DengageEvents.reference(paint);
    }

    function wireReference() {
        var host = $('#ref-grid');
        if (!host) return;
        host.addEventListener('click', function (event) {
            var button = event.target.closest
                ? event.target.closest('[data-ref-copy]') : null;
            if (!button) return;
            var value = button.getAttribute('data-ref-copy');
            if (!window.navigator || !window.navigator.clipboard) {
                log('This browser did not offer a clipboard. Select the value instead.');
                return;
            }
            window.navigator.clipboard.writeText(value).then(function () {
                var was = button.textContent;
                button.textContent = text('refCopied');
                window.setTimeout(function () { button.textContent = was; }, 1200);
            }, function () {
                log('The browser refused the clipboard. Select the value instead.');
            });
        });
    }

    /* Clears only the SDK's own display-state keys, after naming them and
       asking a second time. The demo's own dps:<slug>: keys are never touched. */
    function wireReset() {
        var button = $('#reset-display');
        if (!button) return;
        var armed = null;

        button.addEventListener('click', function () {
            if (armed) {
                armed.forEach(function (pair) {
                    try { window[pair[0]].removeItem(pair[1]); } catch (err) { /* noop */ }
                });
                log('Cleared ' + armed.length + ' display state key(s)',
                    armed.map(function (p) { return p[0] + ': ' + p[1]; }));
                armed = null;
                button.textContent = text('launcherReset');
                button.className = 'btn btn-quiet btn-block';
                return;
            }

            var found = [];
            [['localStorage', window.localStorage], ['sessionStorage', window.sessionStorage]]
                .forEach(function (pair) {
                    try {
                        for (var i = 0; i < pair[1].length; i++) {
                            var key = pair[1].key(i);
                            if (/dengage|dn_|__dn|dnpush/i.test(key)) found.push([pair[0], key]);
                        }
                    } catch (err) { /* private mode */ }
                });

            if (!found.length) { log('Nothing to clear. No Dengage keys in storage.'); return; }

            armed = found;
            log('These ' + found.length + ' key(s) will be removed, and nothing else',
                found.map(function (p) { return p[0] + ': ' + p[1]; }));
            button.textContent = 'Confirm: remove ' + found.length + ' key(s)';
            button.className = 'btn btn-block';
        });
    }

    /* ------------------------------------------------------------------ */
    /* Event panel                                                         */

    function renderEventPanel() {
        var select = $('#event-select');
        if (!select) return;
        select.innerHTML = EVENTS.map(function (e) {
            return '<option value="' + e.id + '">' + e.label + '</option>';
        }).join('');
        describeEvent();
        select.addEventListener('change', describeEvent);
    }

    function describeEvent() {
        var select = $('#event-select');
        var note = $('#event-note');
        if (!select || !note) return;
        var chosen = EVENTS.filter(function (e) { return e.id === select.value; })[0];
        note.innerHTML = chosen
            ? 'Writes <code>' + chosen.table + '</code>.'
            : '';
    }

    /* Validation at the call site against the same fixed list the dropdown was
       built from. The sample vehicle is the PATROL, the flagship the site
       itself leads with. */
    function fire(eventId) {
        if (ALLOWED.indexOf(eventId) === -1) {
            log('Refused: ' + eventId + ' is not one of the storefront events', { allowed: ALLOWED });
            return false;
        }

        var car = window.Catalog.get('patrol') || window.Catalog.all()[0];
        var lines = (window.Site && window.Site.cartLines) ? window.Site.cartLines() : [];
        var events = window.DengageEvents;
        var sent;

        switch (eventId) {
            case 'pageView':
                sent = events.pageview(document.body.getAttribute('data-page-type') || 'other');
                break;
            case 'ec:addToCart':
                sent = events.addToCart({ id: car.id, quantity: 1, price: car.price }, lines);
                break;
            case 'ec:removeFromCart':
                sent = events.removeFromCart({ id: car.id, quantity: 1, price: car.price }, lines);
                break;
            case 'ec:beginCheckout':
                sent = events.beginCheckout(lines.length ? lines : [{ id: car.id, quantity: 1, price: car.price }]);
                break;
            case 'ec:order':
                sent = events.order({
                    orderId: 'DPS-' + events.slug() + '-panel-' + Date.now(),
                    itemCount: 1,
                    totalAmount: window.Catalog.effectivePrice(car),
                    paymentMethod: 'other'
                }, lines.length ? lines : [{ id: car.id, quantity: 1, price: car.price }]);
                break;
            case 'ec:search':
                sent = events.search(car.category,
                    window.Catalog.all().filter(function (m) { return m.category === car.category; }).length);
                break;
            case 'ec:addToWishlist':
                sent = events.addToWishlist({ id: car.id, price: car.price }, 'favorites');
                break;
            case 'ec:removeFromWishlist':
                sent = events.removeFromWishlist({ id: car.id }, 'favorites');
                break;
            default:
                return false;
        }

        log('Sent ' + eventId, sent);
        return true;
    }

    /* ------------------------------------------------------------------ */

    function init() {
        renderLauncher();
        renderEventPanel();
        wireReset();
        renderReference();
        wireReference();

        document.addEventListener('click', function (event) {
            var hint = event.target.closest ? event.target.closest('[data-gesture]') : null;
            if (hint) {
                var gslug = hint.getAttribute('data-gesture');
                var entry = SCENARIOS.filter(function (s) { return s.slug === gslug; })[0];
                log(scenarioPrefix() + gslug + ' is not fired from here. ' +
                    (entry ? text(entry.gesture) : ''));
                if (window.Storefront) window.Storefront.closeOverlays();
                return;
            }

            var act = event.target.closest ? event.target.closest('[data-action]') : null;
            if (act && act.getAttribute('data-action') === 'inbox-open') {
                if (window.Storefront) {
                    window.Storefront.closeOverlays();
                    window.Storefront.openOverlay('#inbox');
                }
                if (window.Inbox) {
                    window.Inbox.refresh().then(function (status) {
                        if (status === 'ok') {
                            log('Inbox read. ' + window.Inbox.unreadCount() +
                                ' unread of the messages Dengage holds for this device.');
                        } else if (status === 'starting') {
                            log('The inbox needs a device id, which the application ' +
                                'creates a moment after it loads. Press Refresh in the drawer.');
                        } else {
                            log('Dengage could not return this inbox. The console has the reason.');
                        }
                    });
                }
                return;
            }
            if (act === 'go-dealer' || act === 'go-verify') {
                var root = (document.documentElement.getAttribute('data-rel-root') !== null)
                    ? document.documentElement.getAttribute('data-rel-root')
                    : window.location.pathname.replace(/[^/]*$/, '');
                window.open(root + (act === 'go-dealer' ? 'dealer/' : 'verify/') + 'index.html',
                            '_blank', 'noopener');
                if (window.Storefront) window.Storefront.closeOverlays();
                return;
            }
            if (act) {
                var events = window.DengageEvents;
                /* THE IPHONE CASE, AND WHY IT GETS ITS OWN SENTENCE.
                   iOS delivers a web push only to a site the visitor added to
                   the Home Screen and opened from there. In a Safari tab the
                   permission call is simply not offered, so pressing this card
                   raised no dialog and printed nothing useful: on the one
                   device a prospect is holding, the demo looked broken. The
                   pages now declare a manifest so the Home Screen app exists;
                   this says how to get to it. Android needs none of this. */
                if (iosSafariTab()) {
                    log('On iPhone and iPad, a notification only reaches a site you have added ' +
                        'to the Home Screen. Press Share, then Add to Home Screen, open the demo ' +
                        'from that icon, and press this card again. Android needs none of this ' +
                        'and works in the browser as it is.');
                    return;
                }
                if (!events.pushSupported()) {
                    log('Web push is not available in this browser. It needs a secure ' +
                        'origin and a service worker, so it will not work from a file:// page.');
                    return;
                }
                log('Permission before asking: ' + (events.pushStatus() || 'unknown'));
                events.pushPrompt();
                setTimeout(function () {
                    log('Permission now: ' + (events.pushStatus() || 'unknown') +
                        '. Granted means the device is subscribed and a campaign or ' +
                        'journey in the panel can reach it.');
                }, 1500);
                if (window.Storefront) window.Storefront.closeOverlays();
                return;
            }

            var el = event.target.closest ? event.target.closest('[data-scenario]') : null;
            if (el) {
                var fired = el.getAttribute('data-scenario');
                var spec = SCENARIOS.filter(function (s) { return s.slug === fired; })[0];

                if (spec && spec.target && !document.getElementById(spec.target)) {
                    log(prefixFor(spec) + fired + ' renders into #' + spec.target +
                        ', which is not on this page. ' + text('inlineElsewhere'));
                    if (window.Storefront) window.Storefront.closeOverlays();
                    return;
                }

                if (spec && spec.local) {
                    /* One source or the other, never both, so what appears on
                       screen always has one explainable origin. ?onsite=panel
                       switches this demo to the Dengage campaigns; the default
                       draws the experience here, which is why the demo works
                       with nothing configured. */
                    var creatives = window.NissanCreatives;
                    if (creatives && creatives.source() === 'panel') {
                        var served = window.DengageEvents.scenario(fired, brandPrefix());
                        log('Fired ' + served + '. This demo is in panel mode, so the ' +
                            'on-site engine answers this card. ' + text('setupNote') +
                            '. Add ?onsite=local to draw it here instead.');
                        if (window.Storefront) window.Storefront.closeOverlays();
                        return;
                    }
                    var drew = creatives && creatives.show(fired);
                    log(drew
                        ? 'Showed the ' + spec.name + ' experience. ' + text('drawnHere') + '.'
                        : 'The ' + fired + ' creative is not on this page.');
                    if (window.Storefront) window.Storefront.closeOverlays();
                    return;
                }

                var name = window.DengageEvents.scenario(fired, spec && spec.hy ? brandPrefix() : undefined);
                log('Fired ' + name + '. ' +
                    (fired.indexOf('inline-') === 0
                        ? 'Inline content renders into its slot in the page rather than over it.'
                        : (spec && spec.hy
                            ? text('setupNote') + '.'
                            : 'If nothing appears, no campaign has that trigger name.')));
                if (window.Storefront) window.Storefront.closeOverlays();
                return;
            }
            if (event.target.id === 'event-send') {
                var select = $('#event-select');
                if (select) fire(select.value);
            }
        });
    }

    window.Panels = { init: init, SCENARIOS: SCENARIOS, GROUPS: GROUPS,
                      EVENTS: EVENTS, fire: fire };
})(window, document);
