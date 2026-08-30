/* ============================================================================
   The Lincoln storefront's own behavior layer.

   Unlike the Nissan replica, this capture keeps the source site's original
   JavaScript alive, so menus, carousels and field validation are the site's
   own. This module adds only what the demo needs on top:

     the funnel        model picked                 ->  ec:addToCart
                       details entered              ->  ec:beginCheckout
                       the booking is submitted     ->  ec:order, plus the
                                                        test_drive_booked lead
     typed details    every lead form also posts what was typed to the lead
                      relay, which upserts the contact server side
     interception     the source forms post to /leads/submit on the real
                      dealer's backend; a capture phase listener stops that
                      cold, so nothing this demo does ever reaches Naghi

   Event emission stays in js/dengageEvents.js alone; this file only calls it.
   ========================================================================== */
(function (window, document) {
    'use strict';

    var $ = function (sel, root) { return (root || document).querySelector(sel); };
    var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

    var slug = window.DEMO_SLUG || 'lincoln';
    var TD_KEY = 'dps:' + slug + ':td';

    function readJson(key, fallback) {
        try {
            var raw = window.localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (err) { return fallback; }
    }
    function writeJson(key, value) {
        try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (err) { /* private mode */ }
    }

    function t(key, vars) {
        return (window.SiteCopy && window.SiteCopy.t) ? window.SiteCopy.t(key, vars) : key;
    }

    /* ------------------------------------------------------------------ */
    /* Overlays: the launcher, inbox drawer and event panel                */

    function openOverlay(sel) {
        closeOverlays();
        var el = $(sel);
        if (el) el.classList.add('open');
    }
    function closeOverlays() {
        $$('.dps-drawer.open, .dps-modal.open').forEach(function (el) { el.classList.remove('open'); });
    }
    function wireOverlays() {
        document.addEventListener('click', function (event) {
            var opener = event.target.closest ? event.target.closest('[data-open]') : null;
            if (opener) {
                event.preventDefault();
                openOverlay(opener.getAttribute('data-open'));
                return;
            }
            var closer = event.target.closest ? event.target.closest('[data-close]') : null;
            if (closer) { event.preventDefault(); closeOverlays(); return; }
            if (event.target.id === 'scrim') closeOverlays();
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') closeOverlays();
        });
    }

    /* ------------------------------------------------------------------ */
    /* Funnel state                                                        */

    function pending() { return readJson(TD_KEY, null); }
    function setPending(line) {
        if (line) writeJson(TD_KEY, line);
        else try { window.localStorage.removeItem(TD_KEY); } catch (err) { /* noop */ }
    }
    function cartLines() {
        var line = pending();
        return line ? [line] : [];
    }

    function mintIdentity() {
        var identity = window.DemoIdentity;
        if (identity && !identity.contactKey && typeof identity.mintKey === 'function') {
            var key = identity.mintKey(Date.now());
            if (window.DengageEvents.setContactKey(key)) {
                identity.contactKey = key;
                try { window.sessionStorage.setItem(identity.storageKey, key); } catch (err) { /* noop */ }
            }
        }
    }

    /* The source forms gate submission on a privacy consent checkbox; its
       state is the truth the consent flag records. A form without one is a
       direct request to be contacted. */
    function consentGiven(form) {
        var box = form.querySelector('input[name="privacyconsent"], input[name="allOptIn"]');
        return box ? !!box.checked : true;
    }

    /* The typed details' path onto the contact card. The Web SDK deliberately
       cannot write contact fields from a page, so each lead form also posts
       what was typed to the lead relay, the demo's stand-in for a website
       backend, which upserts the contact server side through the Dengage REST
       API. Fire and forget: the SDK events never depend on it, and a missing
       relay costs only the server side copy. panel/README.md section 1a. */
    function relayLead(form, fields) {
        var url = (window.DEMO_CONFIG || {}).leadRelay;
        if (!url || typeof window.fetch !== 'function') return;
        function val(name) {
            var el = form.querySelector('[name="' + name + '"]');
            var v = el && el.value ? el.value.trim() : '';
            if (!v || /^select/i.test(v)) return undefined;
            return v;
        }
        var params = null;
        try { params = new URLSearchParams(window.location.search); } catch (err) { /* old browser */ }
        var body = {
            contact_key: (window.DemoIdentity || {}).contactKey,
            name: val('firstname'),
            surname: val('lastname'),
            email: val('email'),
            gsm: val('mobile'),
            city: val('city'),
            page_url: window.location.href,
            utm_source: params ? params.get('utm_source') || undefined : undefined,
            utm_medium: params ? params.get('utm_medium') || undefined : undefined,
            utm_campaign: params ? params.get('utm_campaign') || undefined : undefined,
            marketing_consent: consentGiven(form)
        };
        for (var k in fields) { if (fields[k] !== undefined) body[k] = fields[k]; }
        try {
            window.fetch(url, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body),
                keepalive: true
            })['catch'](function () { /* the lead's SDK trail is unaffected */ });
        } catch (err) { /* no fetch, no relay */ }
    }

    /* ------------------------------------------------------------------ */
    /* Mandatory fields: the demo owns validation the moment it owns submit */

    function firstMissingRequired(form) {
        var fields = $$('[required], [aria-required="true"]', form);
        for (var i = 0; i < fields.length; i++) {
            var el = fields[i];
            if (el.offsetParent === null && el.type !== 'hidden') continue;
            if (el.type === 'hidden') continue;
            if (el.type === 'checkbox' && !el.checked) return el;
            if (el.checkValidity && !el.checkValidity()) return el;
            if (!el.value || /^select/i.test(el.value)) return el;
        }
        return null;
    }
    function demandRequired(form) {
        var missing = firstMissingRequired(form);
        if (!missing) return false;
        if (missing.reportValidity) missing.reportValidity();
        else missing.focus();
        return true;
    }

    function success(form, message) {
        var note = document.createElement('div');
        note.className = 'dps-form-done';
        note.textContent = message;
        form.replaceWith(note);
        note.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function toast(message) {
        var note = $('#dps-toast');
        if (!note) {
            note = document.createElement('div');
            note.id = 'dps-toast';
            document.body.appendChild(note);
        }
        note.textContent = message;
        note.classList.add('show');
        window.setTimeout(function () { note.classList.remove('show'); }, 2600);
    }

    /* ------------------------------------------------------------------ */
    /* The lead forms. One capture phase listener owns every submit so the
       source site's own AJAX (posting to the dealer's real backend) never
       runs, and each page's form feeds the funnel it belongs to.           */

    function harvest(form) {
        function pick(name) {
            var el = form.querySelector('[name="' + name + '"]');
            var v = el && el.value ? el.value.trim() : '';
            if (!v || /^select/i.test(v)) return undefined;
            return v;
        }
        var modelName = pick('model');
        return {
            car: modelName ? window.Catalog.get(modelName.toLowerCase()) : null,
            city: pick('city'),
            branch: pick('branch'),
            plan: pick('purchaseplan'),
            payment: pick('paymenttype')
        };
    }

    var lastPickId = null;
    function pickCar(car) {
        if (!car || car.id === lastPickId) return;
        lastPickId = car.id;
        var line = { id: car.id, quantity: 1, price: car.price };
        setPending(line);
        window.DengageEvents.addToCart(line, cartLines());
    }

    function wireFunnelSignals() {
        var modelSelect = $('form[action*="leads/submit"] select[name="model"]');
        if (modelSelect) {
            var params = null;
            try { params = new URLSearchParams(window.location.search); } catch (err) { /* old browser */ }
            var preset = params && (params.get('model') || params.get('vehicle'));
            if (preset) {
                $$('option', modelSelect).forEach(function (o) {
                    if (o.value.toLowerCase() === preset.toLowerCase()) modelSelect.value = o.value;
                });
                var car0 = window.Catalog.get((modelSelect.value || '').toLowerCase());
                if (car0) pickCar(car0);
            }
            modelSelect.addEventListener('change', function () {
                /* A browser autofill preview can flip this select and revert
                   a moment later; only a choice still standing counts. */
                window.setTimeout(function () {
                    var car = window.Catalog.get((modelSelect.value || '').toLowerCase());
                    if (car) pickCar(car);
                }, 150);
            });
        }

        if (window.location.pathname.indexOf('forms/testdrive') !== -1) {
            var begun = false;
            document.addEventListener('input', function (e) {
                if (begun) return;
                var name = e.target && e.target.name;
                if (name === 'firstname' || name === 'lastname' || name === 'email' || name === 'mobile') {
                    begun = true;
                    var line = pending();
                    window.DengageEvents.beginCheckout(line ? [line] : []);
                }
            });
        }
    }

    function submitBooking(form) {
        var f = harvest(form);
        if (!f.car) {
            toast('Choose a model first.');
            var sel = form.querySelector('select[name="model"]');
            if (sel) sel.focus();
            return;
        }
        if (demandRequired(form)) return;
        mintIdentity();
        relayLead(form, { form: 'booking', model: f.car.id, purchase_horizon: f.plan });
        var line = pending() || { id: f.car.id, quantity: 1, price: f.car.price };
        window.DengageEvents.order({
            orderId: 'DPS-' + slug + '-td-' + Date.now(),
            itemCount: 1,
            paymentMethod: 'other'
        }, [line]);
        window.DengageEvents.leadEvent('test_drive_booked', {
            model: f.car.id, city: f.city, branch: f.branch,
            purchase_horizon: f.plan, source: 'website'
        });
        if (f.payment === 'Finance') {
            window.DengageEvents.leadEvent('finance_intent', { model: f.car.id, source: 'website' });
        }
        setPending(null);
        success(form, t('tdThanks'));
    }

    function submitQuote(form) {
        if (demandRequired(form)) return;
        var f = harvest(form);
        mintIdentity();
        relayLead(form, { form: 'quote', model: f.car ? f.car.id : undefined, purchase_horizon: f.plan });
        if (f.car) window.DengageEvents.addToCart({ id: f.car.id, quantity: 1, price: f.car.price }, cartLines());
        window.DengageEvents.leadEvent('quote_issued', {
            model: f.car ? f.car.id : undefined, city: f.city, branch: f.branch,
            purchase_horizon: f.plan, source: 'website', note: 'online quote request'
        });
        if (f.payment === 'Finance') {
            window.DengageEvents.leadEvent('finance_intent', { model: f.car ? f.car.id : undefined, source: 'website' });
        }
        success(form, 'Your quote request is in. It is on your profile, and the follow-up journey takes it from here.');
    }

    function submitBrochure(form) {
        if (demandRequired(form)) return;
        var f = harvest(form);
        mintIdentity();
        relayLead(form, { form: 'register_interest', model: f.car ? f.car.id : undefined });
        window.DengageEvents.leadEvent('brochure', {
            model: f.car ? f.car.id : undefined, source: 'website'
        });
        success(form, 'Noted. The specification documents on this page are yours to open, and your interest is on your profile.');
    }

    function submitContact(form) {
        if (demandRequired(form)) return;
        var f = harvest(form);
        mintIdentity();
        relayLead(form, { form: 'register_interest', model: f.car ? f.car.id : undefined });
        window.DengageEvents.leadEvent('register_interest', {
            model: f.car ? f.car.id : undefined, city: f.city, source: 'website', note: 'contact form'
        });
        success(form, 'Thank you. Your message is on your profile and our team will be in touch.');
    }

    function interceptLeadForms() {
        document.addEventListener('submit', function (event) {
            var form = event.target;
            if (!form || !form.getAttribute) return;
            var action = form.getAttribute('action') || '';
            if (action.indexOf('leads/submit') === -1 && !form.querySelector('[name="endpointPath"]')) return;
            event.preventDefault();
            if (event.stopImmediatePropagation) event.stopImmediatePropagation();
            var path = window.location.pathname;
            if (path.indexOf('forms/testdrive') !== -1) return submitBooking(form);
            if (path.indexOf('forms/quote') !== -1) return submitQuote(form);
            if (path.indexOf('download-specifications') !== -1) return submitBrochure(form);
            return submitContact(form);
        }, true);

        /* The source markup validates through its own library; the demo owns
           submit, so it owns the mandatory field check too. */
        $$('form[action*="leads/submit"]').forEach(function (form) {
            form.setAttribute('novalidate', '');
        });
    }

    /* Ownership and service journeys are a later phase; any link that
       survived generation is answered honestly rather than left dead. */
    function guardScope() {
        document.addEventListener('click', function (event) {
            var a = event.target.closest ? event.target.closest('a[href*="/owners"]') : null;
            if (a) { event.preventDefault(); toast(t('postSale')); }
        });
    }

    /* ------------------------------------------------------------------ */
    /* The shared popup creatives ask the host page for its theme. Answer
       with Lincoln's, read from the site's own stylesheet palette.        */

    var THEME = {
        primary: '#324047', onPrimary: '#ffffff', accent: '#b45f1a',
        ink: '#1c1f21', muted: '#4f4c43', surface: '#ffffff', page: '#f5f4f2',
        line: '#dcdcd8', tint: '#f0efec', radius: '2px',
        brandText: '#324047', shadow: '0 12px 32px rgba(20,26,30,.22)',
        displayFont: '"ProximaNova", "Segoe UI", Arial, sans-serif',
        bodyFont: '"ProximaNova", "Segoe UI", Arial, sans-serif'
    };
    function answerThemeRequests() {
        window.addEventListener('message', function (event) {
            if (!event.data || event.data.dnTheme !== 'request') return;
            if (!event.source) return;
            try { event.source.postMessage({ dnTheme: 'reply', theme: THEME }, '*'); }
            catch (err) { /* a frame that has already gone is not an error */ }
        });
    }

    /* ------------------------------------------------------------------ */
    /* Boot                                                                */

    function pageviewDetail() {
        var body = document.body;
        return {
            productId: body.getAttribute('data-product-id') || undefined,
            price: body.getAttribute('data-price') || undefined,
            categoryPath: body.getAttribute('data-category-path') || undefined,
            promotionId: body.getAttribute('data-promotion-id') || undefined
        };
    }

    function hideBrokenImages() {
        document.addEventListener('error', function (event) {
            var el = event.target;
            if (el && el.tagName === 'IMG') el.style.visibility = 'hidden';
        }, true);
        $$('img').forEach(function (img) {
            var src = img.getAttribute('src') || '';
            if (/\.svg(\?|$)/i.test(src)) return;
            if (img.complete && img.naturalWidth === 0 && src) {
                img.style.visibility = 'hidden';
            }
        });
    }

    function boot() {
        /* FIRST, before anything else on the page: the page view is the only
           thing that makes this demo's rows findable in the shared tables. */
        window.DengageEvents.pageview(
            document.body.getAttribute('data-page-type') || 'other', pageviewDetail());

        if (window.Panels) window.Panels.init();
        if (window.Slots) window.Slots.init();
        if (window.Inbox) window.Inbox.boot();
    }

    window.Storefront = {
        t: t,
        openOverlay: openOverlay,
        closeOverlays: closeOverlays,
        boot: boot
    };
    window.Site = {
        cartLines: cartLines,
        saved: function () { return []; },
        toast: toast,
        mintIdentity: mintIdentity
    };

    wireOverlays();
    interceptLeadForms();
    wireFunnelSignals();
    guardScope();
    answerThemeRequests();
    hideBrokenImages();

    function bootOnce() {
        if (window.__dpsBooted) return;
        window.__dpsBooted = true;
        boot();
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootOnce);
    } else {
        bootOnce();
    }
})(window, document);
