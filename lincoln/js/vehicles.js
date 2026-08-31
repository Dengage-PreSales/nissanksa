/* ============================================================================
   The vehicle catalogue of the demo, read from the same source the pages were
   built from: en.lincoln.mynaghi.com as captured on 30 August 2026. The three
   models are the site's own line-up; it publishes no prices, so none exist
   here, and a null price is omitted from every event payload while a
   fabricated one would poison the data it lands in.

   The read API mirrors the demo factory's Catalog surface so js/panels.js
   works unchanged: all, get, effectivePrice, search, escapeAttr.
   ========================================================================== */
(function (window, document) {
    'use strict';

    var MODELS = [
        /* The source site publishes no prices on its model pages, so none
           are carried here: a null price is omitted from every event
           payload, while a fabricated one would poison the data it lands
           in. Ids match the option values on the site's own lead forms,
           lowercased. */
        { id: 'corsair',   name: { en: 'Corsair',   ar: 'كورسير' },    category: 'SUV', price: null, pdp: true, seats: 5 },
        { id: 'aviator',   name: { en: 'Aviator',   ar: 'أفياتور' },   category: 'SUV', price: null, pdp: true, seats: 7 },
        { id: 'navigator', name: { en: 'Navigator', ar: 'نافيجيتور' }, category: 'SUV', price: null, pdp: true, seats: 8 }
    ];

    /* One signature side shot per model, the site's own photography,
       downloaded and committed by tools/download-assets.py and given a
       stable name by tools/build-pages.py. */
    var ART = {
        'corsair':   'assets/cms/storage/lincoln_common/home-page/CORSAIR_L.jpg',
        'aviator':   'assets/cms/storage/lincoln_common/offers/june-26/thumb/Aviator_June_Thumb.webp',
        'navigator': 'assets/cms/storage/lincoln_common/home-page/new-navigator.avif'
    };

    function lang() {
        return (document.documentElement.getAttribute('lang') || 'en').indexOf('ar') === 0 ? 'ar' : 'en';
    }

    function decorate(model) {
        if (!model) return null;
        return {
            id: model.id,
            name: model.name[lang()] || model.name.en,
            nameEn: model.name.en,
            nameAr: model.name.ar,
            category: model.category,
            categoryPath: 'Vehicles>' + model.category,
            price: model.price,
            /* The seat count the source site publishes on its own range page,
               carried so a message can name it. Never a figure this demo
               invented. */
            seats: model.seats || null,
            image: ART[model.id] || null,
            cutout: null,
            pdp: !!model.pdp,
            path: model.path || model.id
        };
    }

    window.Catalog = {
        all: function () { return MODELS.map(decorate); },
        get: function (id) {
            for (var i = 0; i < MODELS.length; i++) {
                if (MODELS[i].id === id || MODELS[i].path === id) return decorate(MODELS[i]);
            }
            return null;
        },
        effectivePrice: function (model) {
            return model && model.price !== null && model.price !== undefined ? model.price : null;
        },
        search: function (term) {
            var q = String(term || '').toLowerCase().trim();
            if (!q) return [];
            return MODELS.filter(function (m) {
                return m.id.indexOf(q) !== -1 ||
                    m.name.en.toLowerCase().indexOf(q) !== -1 ||
                    m.name.ar.indexOf(q) !== -1 ||
                    m.category.toLowerCase().indexOf(q) !== -1;
            }).map(decorate);
        },
        escapeAttr: function (value) {
            return String(value === null || value === undefined ? '' : value)
                .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
                .replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
    };
})(window, document);
