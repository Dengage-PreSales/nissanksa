/* ============================================================================
   Build and reserve.

   WHY THIS PAGE EXISTS. BUILD YOUR <MODEL> and RESERVE ONLINE are the second
   and third most used actions on the source site, and this demo answered
   neither: both landed on the model grid. They are not decoration. Choosing a
   grade is the richest thing an automotive visitor ever tells a website,
   because it names the price they have talked themselves into, and reserving
   is the only place on a car site where the ecommerce abandonment mechanic
   applies to a purchase rather than to a form.

   WHAT IS REAL. Every grade, price, engine and feature on the page is the one
   Nissan Saudi Arabia publishes, read out of the captured pages at build time.
   Nothing here invents a figure: a grade the source prices at nothing renders
   without a price, and there is no options list, because the source publishes
   none and a made up sunroof at a made up price would be indistinguishable
   from a real one.

   EVENTS. Every send goes through js/dengageEvents.js, the single source, so
   this file names moments and never talks to the SDK.

     choose a grade      ec:addToCart at that grade's real price, and a
                         lead row of type configure carrying the grade
     open the form       ec:beginCheckout
     confirm             ec:order, order id DPS-nissanksa-res-<n>, and a
                         lead row of type reserve
   ========================================================================== */
(function (window, document) {
    'use strict';

    var PREFIX = 'DPS-nissanksa-res-';
    var BUILD_KEY = 'dps:nissanksa:build';
    var state = { model: null, trim: null, price: null, version: null };

    function $(sel, root) { return (root || document).querySelector(sel); }
    function $$(sel, root) {
        return Array.prototype.slice.call((root || document).querySelectorAll(sel));
    }
    function money(n) {
        return 'SAR ' + Number(n).toLocaleString('en-US');
    }
    function events() { return window.DengageEvents; }

    /* The cart line this build is, in the shape the events module wants. The
       price is the grade's published one, so an order total is a real figure
       rather than a starting price standing in for a configured car. */
    function line() {
        if (!state.model) return null;
        var car = window.Catalog && window.Catalog.get(state.model);
        var one = {
            id: state.model,
            variantId: state.model + ':' + slug(state.trim || ''),
            quantity: 1,
            name: car ? car.name : state.model
        };
        if (state.price) one.price = state.price;
        return one;
    }
    /* SV and SV+ are different grades at different prices, and stripping
       punctuation collapsed them onto one variant id, so the panel would have
       shown one car where the visitor configured two. The plus is spelled out
       before anything else is dropped. */
    function slug(text) {
        return String(text).toLowerCase()
            .replace(/\+/g, ' plus ')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }

    /* Bring something into view only when it is not already there.

       An unconditional smooth scroll moves the page under a pointer that is
       already aimed at a button, and the click lands on whatever slid into
       that spot. Caught with Reserve this build sending the browser to the
       test drive form, because Drive it first slid under the cursor mid
       animation. On a call that reads as the demo doing something random. */
    function reveal(el) {
        var box = el.getBoundingClientRect();
        var whole = box.top >= 0 && box.bottom <= (window.innerHeight || 0);
        if (whole) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /* ------------------------------------------------------------------ */

    function showModel(model) {
        state.model = model;
        state.trim = state.price = state.version = null;
        $$('[data-cfg-model]').forEach(function (chip) {
            var on = chip.getAttribute('data-cfg-model') === model;
            chip.classList.toggle('is-on', on);
            chip.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        $$('[data-cfg-pane]').forEach(function (pane) {
            pane.hidden = pane.getAttribute('data-cfg-pane') !== model;
        });
        $$('[data-cfg-trim]').forEach(function (b) { b.classList.remove('is-on'); });
        var empty = $('[data-cfg-empty]');
        if (empty) empty.hidden = true;
        var summary = $('[data-cfg-summary]');
        if (summary) summary.hidden = true;
        var form = $('[data-cfg-form]');
        if (form) form.hidden = true;
    }

    var chosen = null;

    function chooseTrim(button) {
        state.trim = button.getAttribute('data-trim-name');
        var raw = button.getAttribute('data-trim-price');
        state.price = raw ? Number(raw) : null;
        var version = $('.cfg-version', button);
        state.version = version ? version.textContent.trim() : null;

        $$('[data-cfg-trim]').forEach(function (b) { b.classList.toggle('is-on', b === button); });

        var car = window.Catalog && window.Catalog.get(state.model);
        var name = (car ? car.name : state.model);
        var built = $('[data-cfg-built-model]');
        if (built) built.textContent = name + ', ' + state.trim;
        var priceEl = $('[data-cfg-built-price]');
        if (priceEl) {
            priceEl.textContent = state.price
                ? money(state.price)
                : 'Nissan does not publish a price for this grade. The showroom confirms it.';
        }
        var summary = $('[data-cfg-summary]');
        if (summary) {
            summary.hidden = false;
            reveal(summary);
        }

        var one = line();
        /* Same rule as the booking form: swapping grade replaces the line, it
           does not add a second one. Without this, walking a prospect up the
           range on a call leaves a cart holding every grade they looked at. */
        if (chosen && chosen.variantId !== one.variantId) {
            events().removeFromCart(chosen, []);
        }
        chosen = one;
        events().addToCart(one, [one]);
        events().leadEvent('configure', {
            model: state.model, note: state.trim, source: 'website'
        });
        /* The rescue rule reads this: someone who built a car and left without
           reserving is the one this page can win back. */
        if (window.Site && window.Site.signal) window.Site.signal('configured', true);
        /* Kept so My Showroom can show the build back to whoever made it. A
           configured car that vanishes when the page does is the one piece of
           this visitor's history worth the most. */
        try {
            window.localStorage.setItem(BUILD_KEY, JSON.stringify({
                model: state.model, trim: state.trim, price: state.price, at: Date.now()
            }));
        } catch (err) { /* private mode */ }
    }

    function openForm() {
        var form = $('[data-cfg-form]');
        if (!form || !state.trim) return;
        form.hidden = false;
        var one = line();
        events().beginCheckout([one]);
        var first = $('input, select', form);
        if (first) first.focus();
        reveal(form);
    }

    function missing(form) {
        return $$('[required]', form).filter(function (el) { return !el.value; });
    }

    function confirm(form) {
        var gaps = missing(form);
        $$('[required]', form).forEach(function (el) {
            el.classList.toggle('is-missing', gaps.indexOf(el) !== -1);
        });
        if (gaps.length) {
            if (window.Site && window.Site.toast) {
                window.Site.toast('Please fill in the highlighted fields.');
            }
            gaps[0].focus();
            return;
        }

        if (window.Site && window.Site.mintIdentity) window.Site.mintIdentity();
        var value = function (name) {
            var el = form.querySelector('[name="' + name + '"]');
            return el && el.value ? el.value : undefined;
        };
        var city = value('City');
        var branch = value('Branch');

        if (window.Site && window.Site.relayLead) {
            window.Site.relayLead(form, {
                form: 'reserve', model: state.model, city: city
            });
        }

        var one = line();
        events().order({
            orderId: PREFIX + Date.now(),
            itemCount: 1,
            totalAmount: state.price || undefined,
            paymentMethod: 'other'
        }, [one]);
        events().leadEvent('reserve', {
            model: state.model, note: state.trim, city: city,
            branch: branch, source: 'website'
        });

        var car = window.Catalog && window.Catalog.get(state.model);
        if (window.Site && window.Site.confirmBooking) {
            window.Site.confirmBooking({
                model: car ? car.name : state.model,
                model_id: state.model,
                name: value('FirstName'), surname: value('LastName'),
                email: value('Email'), gsm: value('Phone'),
                city: city, branch: branch
            }, 'reserve');
        }
        if (window.Site && window.Site.signal) window.Site.signal('reserved', true);

        done(form, car ? car.name : state.model);
    }

    function done(form, name) {
        var panel = document.createElement('div');
        panel.className = 'cfg-done';
        panel.innerHTML =
            '<p class="cfg-done-head">Your ' + name + ' is held</p>' +
            '<p>We have your build and your showroom. The team will call to agree ' +
            'the paperwork, and the confirmation is already on its way.</p>';
        form.parentNode.replaceChild(panel, form);
        var go = $('[data-cfg-reserve]');
        if (go) go.hidden = true;
        reveal(panel);
    }

    /* ------------------------------------------------------------------ */

    function init() {
        if (!$('.cfg-page') || !events()) return;

        /* Say what has been wired, now that it has been. These are answered by
           one delegated handler, so without a mark on each control the
           everything-works census cannot tell them from dead buttons, and it
           reported all five model chips as dead. Stamped here rather than in
           the markup on purpose: if this module fails to load the controls
           really are dead, and the page should admit it. */
        $$('[data-cfg-model], [data-cfg-trim], [data-cfg-reserve]').forEach(function (el) {
            el.setAttribute('data-dps-wired', '1');
        });

        document.addEventListener('click', function (event) {
            var chip = event.target.closest && event.target.closest('[data-cfg-model]');
            if (chip) { showModel(chip.getAttribute('data-cfg-model')); return; }
            var trim = event.target.closest && event.target.closest('[data-cfg-trim]');
            if (trim) { chooseTrim(trim); return; }
            var go = event.target.closest && event.target.closest('[data-cfg-reserve]');
            if (go) { openForm(); return; }
        });

        var form = $('[data-cfg-form]');
        if (form) {
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                confirm(form);
            });
        }

        /* Arriving from a model page carries the car with it, so the visitor
           lands on the grades rather than on a chooser they already answered. */
        var wanted = null;
        try { wanted = new URLSearchParams(window.location.search).get('model'); } catch (err) { wanted = null; }
        if (wanted) {
            var car = window.Catalog && window.Catalog.get(wanted);
            var id = car ? car.id : String(wanted).toLowerCase();
            if ($('[data-cfg-pane="' + id + '"]')) showModel(id);
        }

        /* Drive it first keeps the chosen car. */
        var drive = $('[data-cfg-drive]');
        if (drive) {
            drive.addEventListener('click', function () {
                if (state.model) drive.href = drive.href.split('?')[0] + '?model=' + encodeURIComponent(state.model);
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else { init(); }
})(window, document);
