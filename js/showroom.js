/* ============================================================================
   My Showroom, Compare, and Find your Nissan.

   WHY THESE THREE. The demo was audited against every internal link on the
   captured source site, counted rather than remembered, and these were the
   three most linked pre purchase surfaces it did not hold: My Showroom at 69
   links, which is the most linked pre purchase page on their entire site,
   Find your Nissan at 50, and Compare at 34. All three were routed to the
   model grid, which answers none of them.

   They matter more here than their link counts suggest, because each one is a
   place where the profile becomes visible:

     My Showroom      shows a visitor their own history back to them. Saved
                      cars, price watches, what they looked at and the car
                      they built. It is the customer facing half of the
                      contact card, drawn from the same signals the panel
                      segments on.
     Compare          two or three models side by side. Comparing is the
                      behaviour that separates a browser from a shortlist,
                      and it is a segment worth having.
     Find your Nissan asks what kind of car, what budget, and how soon. The
                      third answer is the purchase horizon, which is the
                      single most valuable pre purchase field there is, and
                      this asks an anonymous visitor for it before any form
                      has their name.

   Everything shown is real. The models, categories and prices come from the
   catalogue, which carries what the source site publishes. Nothing is scored,
   ranked or recommended by an invented weighting: a match is a match on the
   answers given, and when nothing matches the page says so.
   ========================================================================== */
(function (window, document) {
    'use strict';

    var WISH_KEY = 'dps:nissanksa:wishlist';
    var WATCH_KEY = 'dps:nissanksa:pricewatch';
    var VIEWS_KEY = 'dps:nissanksa:modelViews';
    var BUILD_KEY = 'dps:nissanksa:build';
    var VISITS_KEY = 'dps:nissanksa:visits';

    function $(sel, root) { return (root || document).querySelector(sel); }
    function $$(sel, root) {
        return Array.prototype.slice.call((root || document).querySelectorAll(sel));
    }
    function read(store, key, fallback) {
        try {
            var raw = window[store].getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (err) { return fallback; }
    }
    function money(n) { return 'SAR ' + Number(n).toLocaleString('en-US'); }
    function cars() { return (window.Catalog && window.Catalog.all) ? window.Catalog.all() : []; }
    function car(id) { return window.Catalog && window.Catalog.get ? window.Catalog.get(id) : null; }
    function rel() { return document.documentElement.getAttribute('data-rel-root') || ''; }
    function events() { return window.DengageEvents; }

    function esc(v) {
        return String(v === null || v === undefined ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    /* One card renderer, so a saved car, a match and a comparison column all
       look like the same object to a visitor, because they are. */
    function card(c, extra) {
        var href = rel() + 'vehicles/' + c.id + '/index.html';
        return '<a class="sr-card" href="' + href + '">' +
            (c.image ? '<img class="sr-shot" src="' + rel() + esc(c.image) + '" alt="' + esc(c.name) +
                       '" loading="lazy">' : '') +
            '<span class="sr-name">' + esc(c.name) + '</span>' +
            (c.price ? '<span class="sr-price">From ' + money(c.price) + '</span>'
                     : '<span class="sr-price sr-quiet">Price not published</span>') +
            '<span class="sr-cat">' + esc(c.category) + '</span>' +
            (extra || '') +
        '</a>';
    }

    /* ------------------------------------------------------------------ */
    /* My Showroom                                                         */

    function paintShowroom() {
        var host = $('[data-sr-showroom]');
        if (!host) return;

        var saved = read('localStorage', WISH_KEY, []) || [];
        var watched = read('localStorage', WATCH_KEY, []) || [];
        var viewed = read('sessionStorage', VIEWS_KEY, []) || [];
        var build = read('localStorage', BUILD_KEY, null);
        var visits = read('localStorage', VISITS_KEY, 0) || 0;
        var who = (window.DemoIdentity || {}).contactKey || null;

        var blocks = [];

        blocks.push('<div class="sr-who">' +
            '<p class="sr-wholine">' +
            (who ? 'This browser is known to Dengage as <b>' + esc(who) + '</b>.'
                 : 'Nobody knows your name yet, and everything below was still remembered.') +
            '</p>' +
            '<p class="sr-whonote">' +
            (visits > 1 ? 'Visit ' + visits + '. ' : '') +
            'Every item here is a real row in the CDP, not a browser bookmark.' +
            '</p></div>');

        if (build) {
            var b = car(build.model);
            blocks.push(section('The car you built',
                '<div class="sr-build">' +
                  '<p class="sr-buildname">' + esc(b ? b.name : build.model) +
                    (build.trim ? ', ' + esc(build.trim) : '') + '</p>' +
                  (build.price ? '<p class="sr-buildprice">' + money(build.price) + '</p>' : '') +
                  '<div class="sr-actions">' +
                    '<a class="sr-go" href="' + rel() + 'configure/index.html?model=' +
                      encodeURIComponent(build.model) + '">Pick it up where you left it</a>' +
                    '<button type="button" class="sr-alt sr-drop" data-sr-drop>Not this one</button>' +
                  '</div>' +
                '</div>'));
        }

        blocks.push(list('Cars you saved', saved,
            'Nothing saved yet. The heart on any model saves it here, and makes you part of an audience the showroom can reach.'));
        blocks.push(list('Prices you are watching', watched,
            'Not watching anything yet. Watch the price on a model page and a drop reaches you.'));
        blocks.push(list('Recently viewed', viewed.slice().reverse(),
            'Nothing viewed this session yet.'));

        host.innerHTML = blocks.join('');
    }

    function section(title, inner) {
        return '<section class="sr-block"><h2 class="sr-h">' + esc(title) + '</h2>' + inner + '</section>';
    }
    function list(title, ids, empty) {
        var found = ids.map(car).filter(Boolean);
        if (!found.length) return section(title, '<p class="sr-empty">' + esc(empty) + '</p>');
        return section(title, '<div class="sr-grid">' + found.map(function (c) { return card(c); }).join('') + '</div>');
    }

    /* ------------------------------------------------------------------ */
    /* Compare                                                             */

    var picked = [];

    function paintCompare() {
        var host = $('[data-sr-compare]');
        if (!host) return;
        $$('[data-sr-pick]').forEach(function (chip) {
            var on = picked.indexOf(chip.getAttribute('data-sr-pick')) !== -1;
            chip.classList.toggle('is-on', on);
            chip.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        if (picked.length < 2) {
            host.innerHTML = '<p class="sr-empty">Choose two or three models and they line up here.</p>';
            return;
        }
        var chosen = picked.map(car).filter(Boolean);
        var rows = [
            ['Starting price', function (c) { return c.price ? money(c.price) : 'Not published'; }],
            ['Body', function (c) { return c.category; }],
            ['Grades published', function (c) {
                var g = (window.Grades && window.Grades[c.id]) || [];
                return g.length ? String(g.length) : 'On the model page';
            }],
            ['Dearest grade', function (c) {
                var g = (window.Grades && window.Grades[c.id]) || [];
                var top = g.filter(function (t) { return t.price; })
                           .sort(function (a, b) { return b.price - a.price; })[0];
                return top ? top.name + ', ' + money(top.price) : 'Not published';
            }]
        ];
        host.innerHTML =
            '<div class="sr-cols">' + chosen.map(function (c) { return card(c); }).join('') + '</div>' +
            '<div class="sr-tablewrap"><table class="sr-table"><tbody>' +
            rows.map(function (r) {
                return '<tr><th scope="row">' + esc(r[0]) + '</th>' +
                    chosen.map(function (c) { return '<td>' + esc(r[1](c)) + '</td>'; }).join('') + '</tr>';
            }).join('') +
            '</tbody></table></div>' +
            '<div class="sr-actions">' +
              '<a class="sr-go" href="' + rel() + 'book-a-test-drive/index.html?model=' +
                encodeURIComponent(chosen[0].id) + '">Drive the ' + esc(chosen[0].name) + '</a>' +
              '<a class="sr-alt" href="' + rel() + 'configure/index.html?model=' +
                encodeURIComponent(chosen[0].id) + '">Build it</a>' +
            '</div>';

        events().leadEvent('compare', {
            model: chosen[0].id, note: chosen.map(function (c) { return c.name; }).join(' vs '),
            source: 'website'
        });
    }

    function togglePick(id) {
        var at = picked.indexOf(id);
        if (at !== -1) picked.splice(at, 1);
        else if (picked.length < 3) picked.push(id);
        else { picked.shift(); picked.push(id); }
        paintCompare();
    }

    /* ------------------------------------------------------------------ */
    /* Find your Nissan                                                    */

    var answers = { body: null, budget: null, horizon: null };

    function paintChooser() {
        var host = $('[data-sr-chooser]');
        if (!host) return;
        $$('[data-sr-answer]').forEach(function (b) {
            var q = b.getAttribute('data-sr-q');
            b.classList.toggle('is-on', answers[q] === b.getAttribute('data-sr-answer'));
        });
        if (!answers.body || !answers.budget || !answers.horizon) {
            host.innerHTML = '<p class="sr-empty">Answer all three and the range narrows to what fits.</p>';
            return;
        }
        var cap = Number(answers.budget);
        var fits = [], unpriced = [];
        cars().forEach(function (c) {
            if (answers.body !== 'any' && c.category !== answers.body) return;
            /* A car the source site has not priced cannot be matched on budget,
               and presenting one as fitting a ceiling it was never measured
               against is the kind of small lie a prospect notices. The Tekton
               is announced and not on sale, so it is named separately with the
               thing you can actually do about it. */
            if (!c.price) { unpriced.push(c); return; }
            if (cap && c.price > cap) return;
            fits.push(c);
        });
        var matches = fits;
        var aside = unpriced.length
            ? '<p class="sr-aside">' + unpriced.map(function (c) { return esc(c.name); }).join(' and ') +
              (unpriced.length > 1 ? ' are announced without prices' : ' is announced without a price') +
              ', so ' + (unpriced.length > 1 ? 'they are' : 'it is') + ' not matched on budget. ' +
              '<a href="' + rel() + 'vehicles/' + esc(unpriced[0].id) + '/index.html">Register your interest instead</a>.</p>'
            : '';
        host.innerHTML = matches.length
            ? '<p class="sr-count">' + matches.length + ' of the range fits.</p>' +
              '<div class="sr-grid">' + matches.map(function (c) { return card(c); }).join('') + '</div>' +
              '<div class="sr-actions">' +
                '<a class="sr-go" href="' + rel() + 'book-a-test-drive/index.html?model=' +
                  encodeURIComponent(matches[0].id) + '">Book a drive in the ' + esc(matches[0].name) + '</a>' +
              '</div>' + aside
            : '<p class="sr-empty">Nothing in the range fits all three answers. Widening the budget is the usual answer, and the showroom can talk through finance.</p>' + aside;

        /* The purchase horizon is the reason this page earns its place: it is
           the field the hot leads segment reads, asked of a visitor nobody has
           named yet. */
        events().leadEvent('chooser', {
            model: matches.length ? matches[0].id : undefined,
            note: answers.body + ', up to ' + money(cap),
            purchase_horizon: answers.horizon,
            source: 'website'
        });
    }

    /* ------------------------------------------------------------------ */

    function init() {
        if (!events()) return;
        var any = $('[data-sr-showroom], [data-sr-compare], [data-sr-chooser]');
        if (!any) return;

        /* Marked as wired once they are, so the everything works census can
           tell a delegated handler from a dead control. */
        $$('[data-sr-pick], [data-sr-answer], [data-sr-drop]').forEach(function (el) {
            el.setAttribute('data-dps-wired', '1');
        });

        document.addEventListener('click', function (event) {
            var drop = event.target.closest && event.target.closest('[data-sr-drop]');
            if (drop) {
                /* The one place a visitor genuinely empties a cart, which is
                   why deleteCart lives here and nowhere else. An order closes
                   a cart on its own; this is the other way it can end. */
                if (read('localStorage', BUILD_KEY, null)) {
                    /* The call takes no payload: emptying a cart says nothing
                       about what was in it, and the addToCart rows already do. */
                    events().deleteCart();
                    try { window.localStorage.removeItem(BUILD_KEY); } catch (err) { /* noop */ }
                }
                paintShowroom();
                return;
            }
            var pick = event.target.closest && event.target.closest('[data-sr-pick]');
            if (pick) { event.preventDefault(); togglePick(pick.getAttribute('data-sr-pick')); return; }
            var ans = event.target.closest && event.target.closest('[data-sr-answer]');
            if (ans) {
                event.preventDefault();
                answers[ans.getAttribute('data-sr-q')] = ans.getAttribute('data-sr-answer');
                paintChooser();
            }
        });

        paintShowroom();
        paintCompare();
        paintChooser();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }
})(window, document);
