/* ============================================================================
   THE ONLY MODULE IN A DEMO THAT TALKS TO DENGAGE.

   Handoff 1.3, 15a. CLAUDE.md 1b. Guard check: event-single-source.

   Nothing else calls dengage('ec:...'), dengage('pageView') or
   dengage('sendDeviceEvent'). CI refuses it. That is not a style preference,
   it is the whole of how one rule can cover every call site.

   WHY IT MATTERS MORE THAN IT LOOKS.

   Demos write the six standard ecommerce tables, the same ones five live demo
   sites and two mobile apps write. Columns cannot be added to them and rows
   cannot be deleted from them, so anything written is permanent and has to be
   identifiable by what is already there.

   What makes a demo's rows findable is pageView. The SDK fills page_url and
   session_id on the row by itself, confirmed in Phase 0, and session_id is the
   only join between page_view_events and the other five tables. So:

     a demo's page views are found by page_url containing its slug
       -> those rows give the exact session_id list
         -> those session_ids find its cart, order, wishlist and search rows

   A page that never fires pageView writes rows belonging to no identifiable
   demo, in tables nobody can clean up. That is why pageview() is called on
   every page, before anything else, and why the guard checks every page loads
   this file.

   THE OMISSION RULE, which lives here and only here.

   Never send a price, a discount or a stock count that the scrape did not
   produce. Number(null) is 0 in JavaScript, and 0 in stock_count announces
   every product out of stock, poisoning every back-in-stock segment. That bug
   has shipped twice on the reference build. compact() below drops the key
   instead, and money() refuses to invent a number.

   Handoff 1.8. The reference build's productCatalog.js gets this wrong in the
   opposite direction, normalising an unreadable price to 0.
   ========================================================================== */
(function (window, document) {
    'use strict';

    /* Read at call time. boot.js sets window.DEMO_CONFIG after every module
       script has been evaluated, so capturing it here would freeze the empty
       default and quietly send the wrong scenario prefix. */
    function config() { return window.DEMO_CONFIG || {}; }

    /* window.DEMO_SLUG, resolved synchronously in the head by js/identity.js, is
       the single source. config().slug agrees with it and boot.js verifies that,
       but it arrives later, so anything namespaced must not wait for it. */
    function slug() { return window.DEMO_SLUG || config().slug || 'demo'; }

    /* ------------------------------------------------------------------ */
    /* Payload hygiene                                                     */

    /* Drops every key whose value is null, undefined, an empty string or NaN.
       This is the mechanism behind "omit rather than fabricate": a builder that
       leaves unit_price as null and hands it to the SDK sends a zero, because
       that is what the value becomes on the way out. Dropping the key is what
       actually keeps the column empty. */
    function compact(payload) {
        var out = {};
        Object.keys(payload || {}).forEach(function (key) {
            var value = payload[key];
            if (value === null || value === undefined || value === '') return;
            if (typeof value === 'number' && !isFinite(value)) return;
            out[key] = value;
        });
        return out;
    }

    /* Returns a real number, or undefined so compact() removes it. Never 0 as a
       stand-in for "unknown". A genuine zero price is passed through, because a
       free item is a fact rather than a gap. */
    function money(value) {
        if (value === null || value === undefined || value === '') return undefined;
        var n = Number(value);
        return isFinite(n) ? n : undefined;
    }

    /* Whole units. Same rule: unknown is absent, not zero. */
    function count(value) {
        if (value === null || value === undefined || value === '') return undefined;
        var n = Number(value);
        return isFinite(n) ? Math.round(n) : undefined;
    }

    /* EVERY EVENT IS ANNOUNCED ON THE PAGE, so js/debug.js can show it without
       becoming a second caller of window.dengage. The guard's event-single-source
       check exists precisely to keep that from happening, so the readout listens
       for this rather than wrapping the SDK.

       Namespaced by slug like every other custom event, because two demos open in
       one browser share an origin. Non-negotiable 6. */
    /* THE FLAG IS `accepted`, NOT `delivered`, AND THE DIFFERENCE COST TWO
       DIAGNOSES. All this function can honestly report is that window.dengage was
       a function and did not throw, which is true before any network request is
       made. On 7 August 2026 a content blocker was dropping every event request on
       one device, and the readout said delivered for all of them, because from
       here that is indistinguishable from a stored row.

       Whether a request left the browser is a question about the transport, so
       js/debug.js watches the transport for it. Do not widen this flag to mean
       delivery: it cannot know, and a flag that overstates what it knows is worse
       than no flag. */
    function announceSent(action, body, accepted) {
        var name = 'dps:' + slug() + ':event';
        try {
            window.dispatchEvent(new CustomEvent(name, {
                detail: { action: action, payload: body, accepted: !!accepted, at: Date.now() }
            }));
        } catch (err) { /* a readout is never allowed to break a demo */ }
    }

    function send(action, payload) {
        var body = compact(payload);
        if (typeof window.dengage !== 'function') {
            /* No SDK on the page, which is the normal state when the template
               is served locally without an application configured. Log the
               shape so it stays reviewable. */
            if (window.console) console.log('[dengage dry] ' + action, body);
            announceSent(action, body, false);
            return body;
        }
        try {
            window.dengage(action, body);
            announceSent(action, body, true);
        } catch (err) {
            if (window.console) console.error('[dengage] ' + action + ' failed', err);
            announceSent(action, body, false);
        }
        return body;
    }

    /* ------------------------------------------------------------------ */
    /* Cart line shape                                                     */

    /* Every cart and order call carries cartItems: the current contents, not a
       delta. The SDK derives cart totals and abandonment from it, so sending
       only the changed line makes both wrong. */
    function cartItems(lines) {
        return (lines || []).map(function (line) {
            return compact({
                product_id: String(line.id),
                product_variant_id: line.variantId ? String(line.variantId) : String(line.id),
                quantity: count(line.quantity) || 1,
                unit_price: money(line.price),
                discounted_price: money(line.discountedPrice !== undefined ? line.discountedPrice : line.price)
            });
        });
    }

    /* ------------------------------------------------------------------ */
    /* Page views                                                          */

    /* page_type uses the documented vocabulary: home, category, product, cart,
       checkout, promotion, pricing, login, logout, other. It is free text in
       practice, proved in Phase 0 when 'probe' was accepted, but staying inside
       the documented set is what keeps segmentation on page_type meaningful for
       everyone else sharing the table. */
    var PAGE_TYPES = ['home', 'category', 'product', 'cart', 'checkout',
                      'promotion', 'pricing', 'login', 'logout', 'other'];

    function pageview(pageType, detail) {
        var type = PAGE_TYPES.indexOf(pageType) === -1 ? 'other' : pageType;
        detail = detail || {};
        return send('pageView', {
            page_type: type,
            category_path: detail.categoryPath,
            product_id: detail.productId,
            price: money(detail.price),
            discounted_price: money(detail.discountedPrice),
            stock_count: count(detail.stockCount),
            promotion_id: detail.promotionId
        });
    }

    /* ------------------------------------------------------------------ */
    /* Cart                                                                */

    function addToCart(line, lines) {
        return send('ec:addToCart', {
            product_id: String(line.id),
            product_variant_id: line.variantId ? String(line.variantId) : String(line.id),
            quantity: count(line.quantity) || 1,
            unit_price: money(line.price),
            discounted_price: money(line.discountedPrice !== undefined ? line.discountedPrice : line.price),
            cartItems: cartItems(lines)
        });
    }

    function removeFromCart(line, lines) {
        return send('ec:removeFromCart', {
            product_id: String(line.id),
            product_variant_id: line.variantId ? String(line.variantId) : String(line.id),
            quantity: count(line.quantity) || 1,
            unit_price: money(line.price),
            discounted_price: money(line.discountedPrice !== undefined ? line.discountedPrice : line.price),
            cartItems: cartItems(lines)
        });
    }

    function deleteCart() {
        return send('ec:deleteCart', {});
    }

    function beginCheckout(lines) {
        return send('ec:beginCheckout', { cartItems: cartItems(lines) });
    }

    /* payment_method uses the documented values only: credit_card, debit_card,
       mobile_payment, bank_transfer, prepaid_card, crypto, cod, online_payment,
       other. Anything else and the order reads oddly in the panel. */
    function order(details, lines) {
        return send('ec:order', {
            order_id: String(details.orderId),
            item_count: count(details.itemCount),
            total_amount: money(details.totalAmount),
            discounted_price: money(details.discountedTotal !== undefined
                ? details.discountedTotal : details.totalAmount),
            payment_method: details.paymentMethod || 'credit_card',
            coupon_code: details.couponCode,
            cartItems: cartItems(lines)
        });
    }

    /* ------------------------------------------------------------------ */
    /* Search                                                              */

    /* Fires once per SETTLED query, never per keystroke. The caller is
       responsible for the settling; this only records. Firing per keystroke
       records "m", "ma", "mar", "mars", and the table ends up describing typing
       rather than intent. Handoff 5.3. */
    function search(term, resultCount, filters) {
        return send('ec:search', {
            keywords: String(term || ''),
            result_count: count(resultCount) || 0,
            filters: filters
        });
    }

    /* ------------------------------------------------------------------ */
    /* Wishlist                                                            */

    /* WISHLIST ROWS ARE WRITTEN WITH sendDeviceEvent, and every other family on
       this page uses its ec: call. That difference is deliberate, so read this
       before simplifying it back.

       sendDeviceEvent is the SDK's documented way to write a named event table with
       the payload untouched, and it is the same mechanism the reference build's own
       wishlist module has always used. Writing this row that way lets one place own
       every field it carries, which is what wishlistRow() below is.

       Same endpoint, same table, same fields, same device and session as the ec:
       route, so the stored row is the same shape either way and the campaigns keyed
       on list_name are unaffected.

       WHAT IT COSTS. Nothing fills a field in on your behalf here, so the row goes
       out exactly as written. Add a wishlist field and add it to wishlistRow().

       HOW A CHANGE HERE IS VERIFIED. Against a row in the table, never against a
       green test. CLAUDE.md 4: an HTTP 200 from the event endpoint means accepted,
       not stored. factory/checks/tools.mjs pins this row field by field so a change
       is visible; the table is what makes it true. */

    var LISTS = ['favorites', 'shopping_list', 'price_drop_alert', 'back_in_stock_alert'];

    /* The wishlist vocabulary for event_type, alongside the cart's add_to_cart
       and remove_from_cart. Taken from the SDK rather than chosen here. */
    var WISHLIST_ADD = 'add';
    var WISHLIST_REMOVE = 'remove';

    /* Every row carries one, and it is the row's identity rather than a
       diagnostic, so it is generated the way the SDK generates its own. */
    function eventId() {
        try {
            if (window.crypto && typeof window.crypto.randomUUID === 'function') {
                return window.crypto.randomUUID();
            }
        } catch (err) { /* fall through to the pattern below */ }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (ch) {
            var n = Math.random() * 16 | 0;
            return (ch === 'x' ? n : (n & 3 | 8)).toString(16);
        });
    }

    /* The documented wishlist fields, in one place, so adding one is a single
       edit and forgetting one is visible. Anything not listed here is dropped by
       compact() before the row is written, exactly as it is for every other
       event, so the omission rule at the top of this file still holds. */
    /* THE FULL SET OF FIELDS A WISHLIST ROW CARRIES, which is why it is one
       function. Three of them are outside the documented payload: event_id,
       event_type and is_used. All three are set here, and all three are required
       for the row to be stored, confirmed against stored rows on 6 August 2026
       rather than inferred.

       Two fields are deliberately NOT sent, also confirmed the same way rather than
       assumed: expire_date makes no difference to a stored row, and prices store
       identically whether sent as numbers or as two-decimal strings, so the numbers
       the catalogue already holds are sent unchanged.

       is_used is false for both add and remove: it describes an entry that has not
       been consumed, and a demo has nothing that would consume one.

       Do not drop a field here to tidy the row. CLAUDE.md 4 applies: the page and
       the ?debug=1 readout will look identical, and the table is where the loss
       shows. */
    function wishlistRow(eventType, fields) {
        var row = compact(fields);
        row.event_id = eventId();
        row.event_type = eventType;
        row.list_name = row.list_name || 'favorites';
        row.is_used = false;
        return row;
    }

    /* Writes the row and reports it, so ?debug=1 shows wishlist events in the
       same readout and the same shape as everything else. sendWishlist mirrors
       send() rather than reusing it because the table name is an argument here
       and there is no ec: action to report, so the readout is given the ec: name
       the row corresponds to. */
    function sendWishlist(action, eventType, fields) {
        var row = wishlistRow(eventType, fields);
        if (typeof window.dengage !== 'function') {
            if (window.console) console.log('[dengage dry] ' + action, row);
            announceSent(action, row, false);
            return row;
        }
        try {
            window.dengage('sendDeviceEvent', 'wishlist_events', row);
            announceSent(action, row, true);
        } catch (err) {
            if (window.console) console.error('[dengage] ' + action + ' failed', err);
            announceSent(action, row, false);
        }
        return row;
    }

    function wishlistList(name) {
        return LISTS.indexOf(name) === -1 ? 'favorites' : name;
    }

    /* product_variant_id FALLS BACK TO THE PRODUCT ID, exactly as the cart does.
       Corrected 6 August 2026, and this is the one defect this file has shipped.

       It used to resolve to undefined when a product had no variant, and compact()
       then dropped the key, so every wishlist event this repository has ever sent
       went out without it. The cart and order calls have always fallen back to the
       product id, so they carried it and landed. Three tables working and one not,
       from the same module and the same send(), was that one line.

       The demo catalogue has no variants at all, so this was never intermittent:
       it was every wishlist event, always. A product that is its own only variant
       is a fact rather than a gap, which is why a fallback is right here and an
       omission is not. Non-negotiable 5 is about never INVENTING a number; the
       product's own id is not invented.

       Kept as a fallback rather than pushed onto the caller, so a generated demo
       whose catalogue DOES carry variants still sends the real variant id. */
    function variantOf(product) {
        return product.variantId ? String(product.variantId) : String(product.id);
    }

    function addToWishlist(product, listName) {
        return sendWishlist('ec:addToWishlist', WISHLIST_ADD, {
            list_name: wishlistList(listName),
            product_id: String(product.id),
            product_variant_id: variantOf(product),
            price: money(product.price),
            discounted_price: money(product.discountedPrice !== undefined
                ? product.discountedPrice : product.price),
            stock_count: count(product.stockCount)
        });
    }

    function removeFromWishlist(product, listName) {
        return sendWishlist('ec:removeFromWishlist', WISHLIST_REMOVE, {
            list_name: wishlistList(listName),
            product_id: String(product.id),
            product_variant_id: variantOf(product)
        });
    }

    /* ------------------------------------------------------------------ */
    /* Lead events                                                          */

    /* THE PRE-PURCHASE MOMENTS WITH NO STANDARD COLUMN go to one custom Data
       Space table, ni_lead_events, written with sendDeviceEvent exactly as the
       wishlist rows above are. The standard funnel is untouched: pageView and
       the ec: calls still carry the browsing, booking and search story on the
       six shared tables. This table carries only the fields those tables have
       no column for: the lead's stage (walk_in, test_drive_booked, no_show,
       quote_issued, call_outcome, whatsapp_intent, vehicle_sold, brochure,
       finance_intent, register_interest), the model, the city, the purchase
       horizon the visitor stated, the source, and the branch.

       The table does not exist until it is created in the panel; panel/README
       carries the exact definition. Until then every send is visible in
       ?debug=1 and accepted by the endpoint, and the row is simply not stored,
       which the runbook's verification step is there to catch. Nothing here
       ever deletes or alters what another demo wrote. */
    /* survey_response carries an on-site answer: the Lincoln demo's survey
       card writes it, and the note field holds the answer as chosen. */
    var LEAD_STAGES = ['walk_in', 'test_drive_booked', 'test_drive_done',
                       'no_show', 'quote_issued', 'call_outcome',
                       'whatsapp_intent', 'vehicle_sold', 'brochure',
                       'finance_intent', 'register_interest', 'survey_response'];

    function leadEvent(stage, fields) {
        if (LEAD_STAGES.indexOf(stage) === -1) {
            if (window.console) console.warn('[dengage] unknown lead stage ' + stage);
            return null;
        }
        var row = compact(fields || {});
        row.event_id = eventId();
        row.event_type = stage;
        row.is_used = false;
        var action = 'lead:' + stage;
        if (typeof window.dengage !== 'function') {
            if (window.console) console.log('[dengage dry] ' + action, row);
            announceSent(action, row, false);
            return row;
        }
        try {
            window.dengage('sendDeviceEvent', 'ni_lead_events', row);
            announceSent(action, row, true);
        } catch (err) {
            if (window.console) console.error('[dengage] ' + action + ' failed', err);
            announceSent(action, row, false);
        }
        return row;
    }

    /* ------------------------------------------------------------------ */
    /* Identity                                                            */

    /* Attaches this device to a contact key. One of only two methods the Web
       SDK documents, alongside sendDeviceEvent.

       THIS IS IDENTIFICATION, NOT AUTHENTICATION, and the difference matters
       enough to state here rather than in the UI alone.

       There is no lookup. The SDK cannot ask whether a contact exists, so a
       page cannot verify a key before using it, and there is no "not found"
       response to handle. An unknown key does not fail: it CREATES that
       contact. That is exactly how ddemo-phase0-probe-1 came into being during
       Phase 0, from nothing but a ?ck= parameter.

       The consequence is that a typo mints a junk contact in an account shared
       with five live demo sites. Hence the shape check at the call site in
       js/storefront.js: anything that is not DPS-<slug>-<something> is
       refused before it reaches this function. That keeps stray contacts inside
       the namespace the 90 day purge can find.

       Handoff 1.7, 6.2. */
    function setContactKey(key) {
        if (!key) return false;
        if (typeof window.dengage !== 'function') {
            if (window.console) console.log('[dengage dry] setContactKey ' + key);
            return true;
        }
        try {
            /* A bare string, not a payload object. compact() is deliberately not
               used here: this is the one call whose argument is not a set of
               columns. */
            window.dengage('setContactKey', key);
        } catch (err) {
            if (window.console) console.error('[dengage] setContactKey failed', err);
            return false;
        }
        if (window.console) console.log('[dengage] setContactKey ' + key);
        return true;
    }

    /* ------------------------------------------------------------------ */
    /* On-site scenarios                                                   */

    /* Fires a scenario BOTH WAYS, because the panel does not offer the same
       trigger for every template. Handoff 5.1, 12.1, 12.13.

       The SDK supports five trigger types, and three of them are "an event with
       this name": DATA_LAYER_EVENT, CUSTOM_EVENT and DENGAGE_EVENT. All three
       read the name from the same triggerSettings.eventName field, and the panel
       describes all three as "Event name". They differ only in where the SDK
       listens:

         DATA_LAYER_EVENT   it wraps window.dataLayer.push and watches for
                            { event: <name> }
         CUSTOM_EVENT       window.addEventListener(<name>)
         DENGAGE_EVENT      window.addEventListener(<name>), same handler

       Some templates do not offer Data Layer Event at all, Typeform among them.
       A card that only pushed to the data layer was therefore dead for those,
       and dead in the worst way: nothing errors and the widget simply never
       appears, so it looks like a broken demo rather than a trigger mismatch.
       Handoff 12.6.

       So both signals go out on every press, carrying the same name. A campaign
       has exactly one trigger, so exactly one of the two is ever listened for and
       the other is discarded by the browser at no cost. The only way to see a
       widget twice is two campaigns sharing one event name, which
       factory/panel/live-campaigns.sh already reports as its nastiest case. */
    /* WHICH CARDS CREATE A CONTACT, which is not the same as which cards have a
       form. A survey and an NPS card post tags, and tags attach to whatever the
       device already is, so they never mint anything. Only the subscription form
       creates a contact. */
    var CAPTURES_A_CONTACT = {
        'subscription-popup': true,
        /* The two brand one-off capture cards, fired under the dauto_demo_
           prefix by js/panels.js. Both carry a data-dn-form-id form, so the
           engine reads the device record at submit time exactly as the shared
           subscription popup does, and the same sf_ key trap applies. */
        'arrival-alert': true,
        'newsletter-capture': true
    };

    /* GIVE A CAPTURE FORM A CONTACT KEY BEFORE IT CAN BE SUBMITTED, because if it
       does not have one the engine invents its own and the invented one carries no
       DPS- marker.

       Observed on a stored contact, 10 August 2026: a subscription submitted by an
       anonymous visitor arrived keyed sf_ followed by a uuid. The engine's own
       submit handler reads the device record, finds no contact key, mints that one,
       and only then posts the form. So the contact exists and is correct in every
       other respect, and nothing looking for the DPS- marker will ever find it.

       THE TIMING IS THE WHOLE POINT, and it is why this sits here rather than
       anywhere nearer the form. The engine reads the device record at submit time,
       so a key set while the visitor is still typing has long since landed. The two
       tempting alternatives both fail: reacting to the confirmation is too late,
       because the key was minted before the post, and listening for the submit
       message races the engine's own listener for that same message.

       THE NUMBER IS A TIMESTAMP RATHER THAN A COUNTER, deliberately. Low numbers
       are the ones a pre-sales person types into the account panel during a call,
       so minting DPS-1 here would quietly adopt the contact they are already
       demonstrating as and file a stranger's consent against it. */
    function identifyBeforeCapture(slug) {
        if (!CAPTURES_A_CONTACT[slug]) return;

        /* mintKey is checked rather than assumed. A TypeError here would happen
           inside the launcher's click handler and take the whole card down, so the
           worst case is an sf_ contact rather than a button that does nothing. */
        var identity = window.DemoIdentity;
        if (!identity || identity.contactKey) return;
        if (typeof identity.mintKey !== 'function') return;

        var key = identity.mintKey(Date.now());
        if (!setContactKey(key)) return;
        identity.contactKey = key;

        /* The same storage identity.js reads, so a reload keeps this contact and
           the SDK initializes with the key already attached. Namespaced by slug by
           construction, because storageKey is. */
        try {
            window.sessionStorage.setItem(identity.storageKey, key);
        } catch (err) { /* private mode */ }

        /* A PAGE VIEW AFTER IDENTIFYING, and here it is load bearing rather than a
           nicety. page_view_events is the only route from a slug back to a demo's
           rows, so a contact created without one owns cart and order rows that
           nothing can attribute to this demo. Same reason signIn sends one. */
        pageview('login');
    }

    /* prefix is optional. The shared platform cards fire under scenarioPrefix
       (dengage_demo_), which the shared panel campaigns listen for; the brand's
       one-off cards pass the brandPrefix (dauto_demo_) so the two sets can
       never collide with each other or with any other demo on this origin. */
    function scenario(slug, prefix) {
        var dengageConfig = config().dengage || {};
        var eventName = (prefix || dengageConfig.scenarioPrefix || 'dengage_demo_') + slug;

        /* Before the trigger, not after: the widget must not be able to appear
           until the visitor it will capture has a key. */
        identifyBeforeCapture(slug);

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: eventName, actionType: eventName });

        /* CustomEvent rather than Event, so a listener can read detail if one
           ever wants to, and constructed in a try because the SDK's own handler
           ignores the argument entirely and a demo must not break if a browser
           refuses the constructor. */
        try {
            window.dispatchEvent(new CustomEvent(eventName, { detail: { slug: slug } }));
        } catch (err) {
            try {
                var legacy = document.createEvent('Event');
                legacy.initEvent(eventName, false, false);
                window.dispatchEvent(legacy);
            } catch (ignored) { /* the data layer push above still went out */ }
        }

        if (window.console) console.log('[scenario] ' + eventName + ' (dataLayer and window event)');
        return eventName;
    }

    /* ------------------------------------------------------------------ */
    /* Web push                                                            */

    /* THE ONLY THREE PUSH CALLS, and they live here for the same reason every
       other SDK call does: js/dengageEvents.js is the single audited surface and
       the guard refuses window.dengage anywhere else.

       WHAT A PAGE CAN AND CANNOT DO. It can ask the browser for permission and
       hand the resulting token to Dengage, which is what subscribes the device.
       It cannot SEND a push: that is a campaign or a journey in the panel. So the
       launcher's button subscribes, and the notification itself arrives because a
       journey is listening for an event. Handoff 8.

       The prompt is a browser dialog, so it can only be raised from a real user
       gesture. Calling it on page load is ignored by the browser and, worse,
       Chrome counts a dismissed prompt against the origin, so a demo that asked
       unprompted could poison push for every later call on that machine. */
    function pushSupported() {
        if (typeof window.dengage !== 'function') return false;
        try { window.dengage('isPushNotificationsSupported'); return true; }
        catch (err) { return false; }
    }

    function pushStatus() {
        if (typeof window.dengage !== 'function') {
            if (window.console) console.log('[dengage dry] getNotificationPermission');
            return null;
        }
        try { return window.dengage('getNotificationPermission'); }
        catch (err) {
            if (window.console) console.error('[dengage] getNotificationPermission failed', err);
            return null;
        }
    }

    /* Raise the browser's own permission dialog. Native rather than the custom
       prompt, because the custom one is a panel authored creative and this button
       exists to show the browser level subscription, not another popup. */
    function pushPrompt() {
        if (typeof window.dengage !== 'function') {
            if (window.console) console.log('[dengage dry] showNativePrompt');
            return false;
        }
        try {
            window.dengage('showNativePrompt');
            /* The token appears once the browser has granted permission and the
               SDK has posted its subscription, both of which happen after this
               returns, so the cache is refreshed rather than read. */
            rememberToken();
            return true;
        }
        catch (err) {
            if (window.console) console.error('[dengage] showNativePrompt failed', err);
            return false;
        }
    }

    /* THE PUSH TOKEN, HELD RATHER THAN ASKED FOR AT THE MOMENT IT IS NEEDED.

       Dengage binds a token to whichever contact key posted the subscription. A
       visitor who allows notifications before they fill in a form subscribes
       with no key at all, and naming the key afterwards with setContactKey does
       not move the binding: a push addressed to that key answers "no device
       subscribed for this contact" while the device sits there holding a
       perfectly good token. Addressing the token directly is the way through,
       and the message function already prefers the contact and falls back to
       the token.

       That fallback never fired, because getToken is callback style: a caller
       that reads its variable on the next line reads null every time, and the
       page sent no token at all. So the token is fetched when it can be and
       kept here, where a send can read it synchronously. Retried because it
       resolves to nothing until permission is granted, which can be minutes
       after the page loaded. */
    var cachedToken = null;
    function rememberToken() {
        if (typeof window.dengage !== 'function') return;
        try {
            window.dengage('getToken', function (token) {
                if (token) cachedToken = String(token);
            });
        } catch (err) { /* the SDK has no getter here */ }
    }
    function deviceToken() { return cachedToken; }

    /* Ask often until there is a token, then keep asking slowly, and never
       stop. Two different things are being covered.

       Before permission: the token does not exist until the visitor grants it,
       which is usually well after the page loaded, so one attempt at boot
       answers nothing on exactly the visits that matter. Every three seconds
       until it appears.

       After permission: a subscription can be replaced while the page is still
       open, and this used to cache the first token it saw and stop asking
       forever. A send addressed to a token that has since been replaced is
       still answered HTTP 200 by Dengage, so a stale one produced a message
       reported as sent that reached nobody, with nothing on screen to say so.
       Every thirty seconds keeps what is cached the same as what the browser
       holds, and costs one local call. */
    function watchToken() {
        rememberToken();
        var timer = window.setInterval(function () {
            rememberToken();
            if (cachedToken) {
                window.clearInterval(timer);
                window.setInterval(rememberToken, 30000);
            }
        }, 3000);
    }
    watchToken();

    /* ------------------------------------------------------------------ */
    /* App Inbox                                                           */

    /* THE INBOX IS HEADLESS. Dengage serves the messages and records what
       happened to them; the list, the styling and the empty state are this
       repository's job. There is no panel template that draws an inbox, so
       unlike the other on-site capabilities there is nothing to configure into
       existence: if this code is not here, the demo has no inbox.

       HOW IT IS SERVED, which is what the UI has to stay compatible with:

         dengage('InboxMessageProvider', limit)  returns a provider object
           provider.getMessages(limit)  -> Promise of an array of messages
           provider.onImpression(id)    -> the message was shown
           provider.onOpen(id)          -> the message was opened
           provider.onClick(id, button) -> a button inside it was pressed
           provider.onDelete(id)        -> the message was removed

       getMessages reads the inbox for THIS DEVICE, and the device id is
       required: the provider rejects without one. So an inbox call before the
       SDK has registered a visitor fails rather than returning an empty list,
       and the two states have to be told apart in the UI. inboxMessages()
       resolves with a status rather than throwing, so the drawer can say
       "still starting up" instead of "no messages", which are different facts.

       Push permission is NOT required. A device id exists from the moment the
       SDK initializes, so the inbox works for an anonymous visitor who has
       never seen a permission prompt. That is worth knowing on a call: the
       inbox is the way to show messaging without asking anyone to subscribe.

       The four reporting calls take the message id the provider itself
       returned. The provider looks the id up in the list it last fetched and
       silently does nothing if it is unknown, so reporting against a stale id
       is safe but pointless. Always report from the list currently on screen.

       ON DELETE, deliberately not wired by default. onDelete removes the
       message from the inbox Dengage holds for that device, and that is a
       delete against a shared account, which CLAUDE.md 1a says is never made
       without written approval for that specific object. Dismissing in the UI
       therefore hides the message locally and reports nothing. Setting
       dengage.inboxReportDelete to true in demo.config.json turns the real
       call on, and that is a decision for Salil rather than a default. */
    var INBOX_LIMIT = 20;
    var inbox = null;

    /* Resolved lazily and re-tried, never cached at load. The SDK replaces the
       queue stub with its own dispatcher when it finishes loading, and only the
       dispatcher can return a value: a call made against the stub is queued and
       replayed later, by which time its return value is gone. So asking for the
       provider too early yields nothing useful, and asking again a moment later
       is the whole fix. Validating the shape rather than probing for SDK
       internals is what makes that check survive an SDK update. */
    function inboxProvider() {
        if (inbox) return inbox;
        if (typeof window.dengage !== 'function') return null;
        var provider;
        try { provider = window.dengage('InboxMessageProvider', INBOX_LIMIT); }
        catch (err) {
            if (window.console) console.error('[dengage] InboxMessageProvider failed', err);
            return null;
        }
        if (!provider || typeof provider.getMessages !== 'function') return null;
        inbox = provider;
        return inbox;
    }

    /* Always resolves, never rejects. status is one of:
         'ok'         the inbox was read, list holds what Dengage returned
         'starting'   the SDK is loading, or has no device id yet
         'dry'        this page has no application, so it never will connect
         'error'      Dengage answered with an error, carried in reason

       THE TEST FOR 'dry' IS THE APPLICATION, NOT window.dengage, and getting that
       wrong is what made this worth a comment. The bootstrap in the head installs
       the queue stub unconditionally, so window.dengage is a function on every
       page including the bare template. Testing for it therefore never reports
       'dry' and the template reports 'starting' forever: a drawer promising to
       connect to something it was never given the identity to reach.

       demo.config.json is the honest signal. A generated demo carries an appGuid
       and a template does not. */
    function hasApplication() {
        var dengageConfig = config().dengage || {};
        return !!(dengageConfig.appGuid && dengageConfig.appGuid.indexOf('__') !== 0);
    }

    function inboxMessages(limit) {
        if (typeof window.dengage !== 'function' || !hasApplication()) {
            if (window.console) console.log('[dengage dry] InboxMessageProvider.getMessages');
            return Promise.resolve({ status: 'dry', list: [] });
        }
        var provider = inboxProvider();
        if (!provider) return Promise.resolve({ status: 'starting', list: [] });
        var result;
        try { result = provider.getMessages(limit || INBOX_LIMIT); }
        catch (err) { return Promise.resolve({ status: 'starting', list: [] }); }
        if (!result || typeof result.then !== 'function') {
            return Promise.resolve({ status: 'starting', list: [] });
        }
        return result.then(function (list) {
            return { status: 'ok', list: Array.isArray(list) ? list : [] };
        }, function (reason) {
            /* Rejecting with nothing is how the provider reports a missing
               device id, which is a timing state rather than a failure. A
               reason means Dengage answered and said no. */
            if (reason === undefined || reason === null) {
                return { status: 'starting', list: [] };
            }
            if (window.console) console.warn('[dengage] inbox getMessages', reason);
            return { status: 'error', list: [], reason: String(reason) };
        });
    }

    function inboxReport(method, id, buttonId) {
        var provider = inboxProvider();
        if (!provider || typeof provider[method] !== 'function') {
            if (window.console) console.log('[dengage dry] inbox ' + method + ' ' + id);
            return false;
        }
        try {
            if (buttonId === undefined) provider[method](id);
            else provider[method](id, buttonId);
        } catch (err) {
            if (window.console) console.error('[dengage] inbox ' + method + ' failed', err);
            return false;
        }
        return true;
    }

    function inboxImpression(id) { return inboxReport('onImpression', id); }
    function inboxOpen(id) { return inboxReport('onOpen', id); }
    function inboxClick(id, buttonId) { return inboxReport('onClick', id, buttonId || 'cta'); }

    /* Only ever called when demo.config.json opts in. See the note above. */
    function inboxDelete(id) {
        var dengageConfig = config().dengage || {};
        if (!dengageConfig.inboxReportDelete) {
            if (window.console) {
                console.log('[dengage] inbox dismiss is local only. Set ' +
                    'dengage.inboxReportDelete to report it to Dengage.');
            }
            return false;
        }
        return inboxReport('onDelete', id);
    }

    /* ------------------------------------------------------------------ */
    /* Quick reference                                                     */

    /* The identifiers somebody on a call needs to paste into the panel: the
       device, the session, the push token and the contact.

       THE SDK'S GETTERS ARE CALLBACK STYLE, decoded from the bundle rather than
       guessed: the public action table registers getDeviceId and getToken as
       (callback) => ..., so each hands its value to a function rather than
       returning it. Both resolve asynchronously, and getToken resolves to nothing
       at all until the browser has granted notification permission, which is a
       state to display rather than an error.

       THERE IS NO getSessionId. The SDK keeps the session in its own storage and
       exposes no accessor for it, so it is the one value here read out of storage
       instead of asked for. That is fragile by nature, so it is wrapped and
       reported as unavailable rather than allowed to throw. If a future SDK
       renames the key, the panel shows a dash and nothing else breaks. */
    var SDK_SESSION_KEY = '_dn_sessions';

    function sdkSessionId() {
        try {
            var raw = window.localStorage.getItem(SDK_SESSION_KEY);
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            return (parsed && parsed.sessionId) ? String(parsed.sessionId) : null;
        } catch (err) {
            return null;
        }
    }

    /* Calls back with everything at once, so the panel renders in one pass rather
       than filling in field by field. Anything unavailable comes back null. */
    function reference(done) {
        var dengageConfig = config().dengage || {};
        var out = {
            contactKey: (window.DemoIdentity && window.DemoIdentity.contactKey) || null,
            sessionId: sdkSessionId(),
            deviceId: null,
            pushToken: null,
            appGuid: dengageConfig.appGuid || null,
            accountId: dengageConfig.accountId || null,
            slug: slug(),
            /* THE MOST USEFUL VALUE HERE, and the reason this row exists.

               No column identifies which demo an event row came from, so
               page_view_events.page_url is the only route back to a demo's rows,
               and session_id on that row is the only join to the other five
               tables. CLAUDE.md 1b. This is the exact string to filter page_url
               on.

               The query string is stripped deliberately. Anyone reading this is
               probably on ?debug=1, and filtering page_url on a value carrying
               that would match only the page views recorded while debugging. */
            demoUrl: (function () {
                try {
                    return window.location.origin + window.location.pathname;
                } catch (err) {
                    return null;
                }
            }())
        };

        if (typeof window.dengage !== 'function') {
            done(out);
            return;
        }

        /* Two independent callbacks, either of which may never fire if the SDK is
           still starting. A short timer settles it either way, because a panel
           that waits forever for a token the browser has not granted looks broken
           when it is merely honest. */
        var settled = false;
        var pending = 2;
        function finish() {
            if (settled) return;
            settled = true;
            done(out);
        }
        function one() { pending -= 1; if (pending <= 0) finish(); }

        window.setTimeout(finish, 1200);

        try {
            window.dengage('getDeviceId', function (id) {
                if (id) out.deviceId = String(id);
                one();
            });
        } catch (err) { one(); }

        try {
            window.dengage('getToken', function (token) {
                if (token) out.pushToken = String(token);
                one();
            });
        } catch (err) { one(); }
    }

    /* ------------------------------------------------------------------ */

    window.DengageEvents = {
        pageview: pageview,
        reference: reference,
        addToCart: addToCart,
        removeFromCart: removeFromCart,
        deleteCart: deleteCart,
        beginCheckout: beginCheckout,
        order: order,
        search: search,
        addToWishlist: addToWishlist,
        removeFromWishlist: removeFromWishlist,
        leadEvent: leadEvent,
        setContactKey: setContactKey,
        scenario: scenario,
        pushSupported: pushSupported,
        pushStatus: pushStatus,
        pushPrompt: pushPrompt,
        deviceToken: deviceToken,
        inboxMessages: inboxMessages,
        inboxImpression: inboxImpression,
        inboxOpen: inboxOpen,
        inboxClick: inboxClick,
        inboxDelete: inboxDelete,
        /* Exposed for the event panel and the smoke test, which both need to
           show or assert the exact shape without duplicating these rules. */
        compact: compact,
        money: money,
        count: count,
        slug: slug
    };
})(window, document);
