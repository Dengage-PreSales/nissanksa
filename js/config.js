/* ============================================================================
   The demo's identity, loaded as a plain script in the head so it exists
   before any module that reads it. There is no fetched config file in this
   build: baking the values removes the async failure class, and
   hasApplication() in js/dengageEvents.js is true from the first moment.

   THIS FILE IS THE ONE PLACE THE DENGAGE ACCOUNT IS SET. It also starts the
   SDK, at the end of the file, so changing accounts is a two line edit here
   and nothing else. No page carries the account id, so no rebuild is needed.
   ========================================================================== */
window.DEMO_CONFIG = {
    slug: 'nissanksa',
    displayName: 'D-AUTO',
    locale: {
        language: (document.documentElement.getAttribute('lang') || 'en'),
        currency: 'SAR'
    },
    dengage: {
        /* ------------------------------------------------------------------
           REPLACE THESE TWO VALUES. They come from the Dengage panel, under
           Settings > Applications, on the web application whose Site URL is
           this demo's published origin. Until they are replaced the SDK does
           not load at all: the storefront works, and nothing Dengage fires.
           An account id of 0000 and an app guid starting with __ are both
           read as "not configured yet" and are checked in three places:
           hasApplication() in js/dengageEvents.js, the readout in
           js/debug.js, and the publish guard in tools/build-dist.py.
           ------------------------------------------------------------------ */
        accountId: '0000',
        appGuid: '__REPLACE_WITH_THE_NEW_APP_GUID__',

        /* The event name prefixes. scenarioPrefix belongs to the shared
           platform campaign library; brandPrefix belongs to the campaigns
           authored for this demo alone. js/panels.js applies one or the
           other per card. */
        scenarioPrefix: 'dengage_demo_',
        brandPrefix: 'dauto_demo_'
    },
    /* The lead relay is the demo's stand-in for a website backend: the lead
       forms post the typed details to it, it stores them in the ni_web_lead
       table and upserts the contact through the Dengage REST API once the
       API user exists. The URL is public the way any form action is public;
       the function validates and rate limits on its own side. An empty
       string turns the relay off and the forms lose nothing but the copy
       of the lead. See panel/README.md section 1a. */
    leadRelay: 'https://raextqlludkagdntyzwn.supabase.co/functions/v1/nissan-lead-relay',
    /* The messages a moment earns. The same function serves both demos and
       tells them apart by the brand each page sends, so the push content is
       shared and only the email bodies differ. panel/README.md section 12. */
    bookingConfirm: 'https://raextqlludkagdntyzwn.supabase.co/functions/v1/nissan-booking-confirm',

    /* The launcher's shared platform cards fire dengage_demo_ events that
       only the shared campaign library answers. In an account without that
       library they fire and nothing appears, so they are hidden by default
       and the launcher shows only what can act. Set this to true once those
       campaigns exist in the account above. js/panels.js reads it. */
    platformCards: false
};

/* ----------------------------------------------------------------------------
   Starting the SDK.

   This ran as an inline snippet in the head of all 47 generated pages, which
   meant changing accounts meant regenerating every page. It lives here now so
   the account is set in one file.

   Order in the head is load bearing: js/identity.js resolves the contact key
   synchronously and runs before this file, and both run before any stylesheet,
   because a pending stylesheet blocks every script after it and a blocked
   corporate network must never be able to stop the SDK from starting.
   -------------------------------------------------------------------------- */
(function (window, document) {
    var dn = window.DEMO_CONFIG.dengage;

    /* The queue stub exists whether or not the SDK loads, so a call from any
       module is harmless rather than a thrown error on an unconfigured site. */
    window.dengage = window.dengage || function () {
        (window.dengage.q = window.dengage.q || []).push(arguments);
    };

    var unset = !dn.appGuid || dn.appGuid.indexOf('__') === 0 ||
                !dn.accountId || dn.accountId === '0000';
    if (unset) {
        /* Deliberately quiet on the page and explicit in the console: a 404
           from the loader URL would look like a network fault rather than a
           value nobody has filled in yet. */
        dn.configured = false;
        if (window.console && window.console.info) {
            window.console.info(
                'Dengage is not configured for this build. Set accountId and ' +
                'appGuid in js/config.js. Everything else on this site works.');
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
