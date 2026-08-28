/* ============================================================================
   The demo's identity, loaded as a plain script so it exists before any module
   that reads it. There is no fetched config file in this build: baking the
   values removes the async failure class, and hasApplication() in
   js/dengageEvents.js is true from the first moment.

   accountId and appGuid are the shared Dengage presales web application. They
   are public by design: the SDK loader URL carrying both ships in the HTML of
   every page that uses Dengage. scenarioPrefix must stay dengage_demo_
   because the shared panel campaigns listen for exactly those event names;
   the Nissan-specific one-off campaigns use the nissan_demo_ prefix, which
   js/panels.js applies per card, and every one of those campaigns carries a
   display rule scoped to /nissanksa/ so they never appear on another demo
   sharing this application.
   ========================================================================== */
window.DEMO_CONFIG = {
    slug: 'nissanksa',
    displayName: 'Nissan KSA x Dengage demo',
    locale: {
        language: (document.documentElement.getAttribute('lang') || 'en'),
        currency: 'SAR'
    },
    dengage: {
        accountId: '28',
        appGuid: '99d9b8fb-0c62-5a85-3e43-2402554d93a5',
        scenarioPrefix: 'dengage_demo_',
        brandPrefix: 'nissan_demo_'
    }
};
