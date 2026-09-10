/* ============================================================================
   The demo's identity, loaded as a plain script in the head so it exists
   before any module that reads it. There is no fetched config file in this
   build: baking the values removes the async failure class, and
   hasApplication() in js/dengageEvents.js is true from the first moment.

   THIS FILE IS THE ONE PLACE THE DENGAGE ACCOUNT IS SET FOR THIS DEMO. It
   also starts the SDK, at the end of the file, so changing accounts is a two
   line edit here and nothing else. No page carries the account id.

   brandPrefix is shared with the storefront at the origin root ON PURPOSE,
   and it is the reason this demo needs no panel work of its own: those one
   off campaigns are authored once and their display rule covers this path
   too. The launcher in js/panels.js offers only the campaigns whose copy is
   brand neutral.
   ========================================================================== */
window.DEMO_CONFIG = {
    slug: 'lincoln',
    displayName: 'D-AUTO Lincoln',
    locale: {
        language: (document.documentElement.getAttribute('lang') || 'en'),
        currency: 'SAR'
    },
    dengage: {
        /* ------------------------------------------------------------------
           REPLACE THESE TWO VALUES, with the same pair used at the origin
           root. They come from the Dengage panel, under Settings >
           Applications, on the web application whose Site URL is this demo's
           published origin. Until they are replaced the SDK does not load at
           all: the storefront works, and nothing Dengage fires.
           ------------------------------------------------------------------ */
        accountId: '0000',
        appGuid: '__REPLACE_WITH_THE_NEW_APP_GUID__',

        scenarioPrefix: 'dengage_demo_',
        brandPrefix: 'dauto_demo_'
    },
    /* The lead relay is the demo's stand-in for a website backend: the lead
       forms post the typed details to it, it stores them in the ni_web_lead
       table and upserts the contact through the Dengage REST API. Shared
       with the storefront at the origin root; the page_url on every lead
       says which storefront it came from. See panel/README.md section 1a. */
    leadRelay: 'https://raextqlludkagdntyzwn.supabase.co/functions/v1/nissan-lead-relay',
    /* The confirmation the booking earns: this endpoint asks Dengage to send
       the transactional email and push, both from panel content. */
    bookingConfirm: 'https://raextqlludkagdntyzwn.supabase.co/functions/v1/nissan-booking-confirm',

    /* The launcher's shared platform cards fire dengage_demo_ events that
       only the shared campaign library answers. In an account without that
       library they fire and nothing appears, so they are hidden by default
       and the launcher shows only what can act. Set this to true once those
       campaigns exist in the account above. js/panels.js reads it. */
    platformCards: false
};

/* ----------------------------------------------------------------------------
   Starting the SDK. Identical to the storefront at the origin root, and
   deliberately duplicated rather than shared: the two demos are separate
   sites that happen to live in one repository, and a shared bootstrap would
   make it possible to point one at an account and forget the other.

   Order in the head is load bearing: js/identity.js resolves the contact key
   synchronously and runs before this file, and both run before any stylesheet,
   because a pending stylesheet blocks every script after it and a blocked
   corporate network must never be able to stop the SDK from starting.
   -------------------------------------------------------------------------- */
(function (window, document) {
    var dn = window.DEMO_CONFIG.dengage;

    window.dengage = window.dengage || function () {
        (window.dengage.q = window.dengage.q || []).push(arguments);
    };

    var unset = !dn.appGuid || dn.appGuid.indexOf('__') === 0 ||
                !dn.accountId || dn.accountId === '0000';
    if (unset) {
        dn.configured = false;
        if (window.console && window.console.info) {
            window.console.info(
                'Dengage is not configured for this build. Set accountId and ' +
                'appGuid in lincoln/js/config.js. Everything else works.');
        }
        return;
    }

    dn.configured = true;
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://pcdn.dengage.com/p/push/' + dn.accountId + '/' +
                 dn.appGuid + '/dengage_sdk_loader.js';
    document.getElementsByTagName('head')[0].appendChild(script);
    window.__dnInit ? window.dengage('initialize', window.__dnInit)
                    : window.dengage('initialize');
})(window, document);
