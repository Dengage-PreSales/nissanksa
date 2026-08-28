/* ============================================================================
   Resolves the contact key SYNCHRONOUSLY, in the head, before initialize runs.

   Handoff 6.2, and confirmed by observation in Phase 0: opening the probe with
   ?ck=ddemo-phase0-probe-1 created that contact and linked it to the device.

   ORDER MATTERS AND THIS IS WHY. The reference build initialized anonymously
   and then set the contact key up to five seconds later, by which point
   pageView had already gone out. Page views landed on the anonymous device
   profile and the contact card showed nothing. Dengage's own guidance is to
   pass the identifiers to initialize when you have them first, and here we
   always do, because this file is a blocking script above the SDK snippet.

   Resolution order, first hit wins:

     1. ?ck=<key> in the URL, then persisted for the session. This is how a
        pre-sales person demos as any contact without touching code.
     2. a key already stored for this demo in this browser
     3. nothing. The visitor stays anonymous.

   Anonymous is correct behaviour, not a bug to fix: window.__dnInit stays
   undefined and the SDK initializes with no contact key. Their events still
   land, because the row's key column is the device id rather than the contact
   key, which Phase 0 established.

   NEVER the reference build's own contact. Its identity.js maps one address to
   a contact on the core account, and anyone signing up on a generated demo
   with that address would attach their test traffic to it. That mapping is not
   carried over. Handoff 5.3 item 6, 6.2.

   Storage is namespaced by slug because every demo shares one origin, so two
   demos open in one browser must not adopt each other's contact.

   THIS FILE ALSO RESOLVES THE SLUG, for everything else, and that is not
   incidental. Handoff 1.6, CLAUDE.md non-negotiable 6.

   The slug is read from data-demo-slug on the html element, which the generator
   writes at build time, so it is available to the very first script on the page.
   It is published as window.DEMO_SLUG and every module that namespaces anything
   reads it from there. One resolution, one place, before anything else runs.

   THE BUG THIS SHAPE EXISTS TO PREVENT, found in a browser rather than a diff.
   The slug used to be read from the attribute in each module separately, while
   boot.js set that attribute asynchronously after fetching demo.config.json. So
   every module read it before it existed and fell back to the literal 'demo':

     dps:demo:ck    dps:demo:cart    dps:demo:wishlist

   for every demo the factory builds. Two demos open in one browser shared a
   cart, a wishlist and a contact. Nothing looked wrong in one tab, which is
   exactly why it survived review, and why the check for it now opens two.
   ========================================================================== */
(function (window) {
    'use strict';

    /* No fallback to a shared default. A missing attribute means the generator
       did not write it, and quietly namespacing everything under 'demo' is the
       failure above: silent, invisible in one tab, and it collides every demo
       with every other. Better to be loud and still functional. */
    var slug = document.documentElement.getAttribute('data-demo-slug');
    if (!slug) {
        slug = 'demo';
        if (window.console) {
            console.error('[demo] data-demo-slug is missing from the html element. ' +
                'Cart, wishlist and contact key are not namespaced, so this demo will ' +
                'collide with every other demo open in this browser.');
        }
    }
    window.DEMO_SLUG = slug;

    var STORE_KEY = 'dps:' + slug + ':ck';

    function read(store, key) {
        try { return store.getItem(key); } catch (err) { return null; }
    }
    function write(store, key, value) {
        try { store.setItem(key, value); } catch (err) { /* private mode */ }
    }

    function fromUrl() {
        var match = /[?&]ck=([^&#]+)/.exec(window.location.search);
        if (!match) return null;
        try { return decodeURIComponent(match[1]); } catch (err) { return match[1]; }
    }

    var key = fromUrl();
    if (key) {
        write(window.sessionStorage, STORE_KEY, key);
    } else {
        key = read(window.sessionStorage, STORE_KEY) || read(window.localStorage, STORE_KEY);
    }

    window.DemoIdentity = { contactKey: key || null, storageKey: STORE_KEY };

    /* Read by the SDK snippet immediately below this script, which passes it to
       initialize when it is present. Left undefined for an anonymous visitor, so
       that the initialize call shape is identical to the one the SDK documents
       for that case rather than one carrying an empty key.

       No example call is written out here on purpose. The guard allows a call to
       the SDK function only in js/dengageEvents.js, plus initialize in the page
       head, and it does not exempt comments: exempting them would mean parsing
       JavaScript in grep, and rewording a comment is cheaper than a parser. */
    if (key) window.__dnInit = { contactKey: key };

    /* Signing up inside a demo creates a contact with this shape, which is the
       marker a purge filters on. Handoff 1.7. */
    /* No slug in the contact key, deliberately. See the note on keyPrefix in
       js/storefront.js: storage is still namespaced by slug, so a second demo never
       adopts this identity even though the key itself is not demo specific. */
    window.DemoIdentity.mintKey = function (n) {
        return 'DPS-' + n;
    };
})(window);
