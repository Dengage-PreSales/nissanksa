/* ============================================================================
   The demo's identity, loaded as a plain script so it exists before any module
   that reads it. There is no fetched config file in this build: baking the
   values removes the async failure class, and hasApplication() in
   js/dengageEvents.js is true from the first moment.

   accountId and appGuid are the shared Dengage presales web application,
   public by design: the SDK loader URL carrying both ships in the HTML of
   every page that uses Dengage.

   brandPrefix stays nissan_demo_ ON PURPOSE, and it is the reason this demo
   needed zero panel work: those one-off campaigns already exist, each scoped
   by a display rule to URLs containing /nissanksa/, and this demo lives at
   /nissanksa/lincoln/, so the same rule matches. The launcher in js/panels.js
   offers only the campaigns whose copy is brand neutral.
   ========================================================================== */
window.DEMO_CONFIG = {
    slug: 'lincoln',
    displayName: 'Lincoln KSA x Dengage demo',
    locale: {
        language: (document.documentElement.getAttribute('lang') || 'en'),
        currency: 'SAR'
    },
    dengage: {
        accountId: '28',
        appGuid: '99d9b8fb-0c62-5a85-3e43-2402554d93a5',
        scenarioPrefix: 'dengage_demo_',
        brandPrefix: 'nissan_demo_'
    },
    /* The lead relay is the demo's stand-in for a website backend: the lead
       forms post the typed details to it, it stores them in the ni_web_lead
       table and upserts the contact through the Dengage REST API. Shared
       with the Nissan demo; the page_url on every lead says which storefront
       it came from. See panel/README.md section 1a. */
    leadRelay: 'https://raextqlludkagdntyzwn.supabase.co/functions/v1/nissan-lead-relay',
    /* The confirmation the booking earns: this endpoint asks Dengage to send
       the transactional email and push, both from panel content. */
    bookingConfirm: 'https://raextqlludkagdntyzwn.supabase.co/functions/v1/nissan-booking-confirm'
};
