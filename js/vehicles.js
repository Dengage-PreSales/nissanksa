/* ============================================================================
   The vehicle catalogue of the demo, read from the same source the pages were
   built from: nissan-saudiarabia.com as captured on 28 August 2026. Every
   name and starting price below is the site's own figure from that capture;
   nothing here is invented. A model the site prices is priced identically
   here, and a model the site does not price (the Tekton, which is announced
   as coming soon) carries null rather than a made-up number, because a null
   price is omitted from every event payload while a fabricated one would
   poison the data it lands in.

   The read API mirrors the demo factory's Catalog surface so js/panels.js
   works unchanged: all, get, effectivePrice, search, escapeAttr.
   ========================================================================== */
(function (window, document) {
    'use strict';

    var MODELS = [
        { id: 'magnite',      name: { en: 'MAGNITE',       ar: 'ماجنايت' },        category: 'SUV',    price: 69999,  pdp: true },
        { id: 'kicks',        name: { en: 'KICKS',         ar: 'كيكس' },           category: 'SUV',    price: 89599,  pdp: true },
        { id: 'x-trail',      name: { en: 'X-TRAIL',       ar: 'إكس-تريل' },       category: 'SUV',    price: 104999, pdp: true },
        { id: 'x-terra',      name: { en: 'X-TERRA',       ar: 'إكس-تيرا' },       category: 'SUV',    price: 118999, pdp: true },
        { id: 'pathfinder',   name: { en: 'PATHFINDER',    ar: 'باثفايندر' },      category: 'SUV',    price: 164999, pdp: true },
        { id: 'patrol',       name: { en: 'PATROL',        ar: 'باترول' },         category: 'SUV',    price: 270999, pdp: true },
        { id: 'patrol-pro4x', name: { en: 'PATROL PRO-4X', ar: 'باترول برو-4إكس' }, category: 'SUV',   price: 380999, pdp: true },
        /* The NISMO lives on its own microsite upstream; this demo does not
           rebuild it, so its card routes to the Patrol page and pdp is false. */
        { id: 'patrol-nismo', name: { en: 'PATROL NISMO',  ar: 'باترول نيسمو' },   category: 'SUV',    price: 450999, pdp: false, path: 'patrol' },
        { id: 'altima',       name: { en: 'ALTIMA',        ar: 'ألتيما' },         category: 'Sedan',  price: 112700, pdp: true },
        { id: 'z',            name: { en: 'Z',             ar: 'زد' },             category: 'Sports', price: 261999, pdp: true },
        /* Announced as coming soon on the source site: no price exists yet,
           so none is carried. The page is a register-interest capture. */
        { id: 'tekton',       name: { en: 'TEKTON',        ar: 'تيكتون' },         category: 'SUV',    price: null,   pdp: true }
    ];

    /* One signature side shot per model, the site's own photography,
       downloaded and committed by tools/download-assets.py and given a
       stable name by tools/build-pages.py. */
    var ART = {
        'magnite':      'assets/img/side-magnite.jpg',
        'kicks':        'assets/img/side-kicks.jpg',
        'x-trail':      'assets/img/side-x-trail.jpg',
        'x-terra':      'assets/img/side-x-terra.jpg',
        'pathfinder':   'assets/img/side-pathfinder.jpg',
        'patrol':       'assets/img/side-patrol.webp',
        'patrol-pro4x': 'assets/img/side-patrol-pro4x.jpg',
        'patrol-nismo': 'assets/img/side-patrol-nismo.jpg',
        'altima':       'assets/img/side-altima.webp',
        'z':            'assets/img/side-z.webp',
        'tekton':       'assets/img/side-tekton.jpg'
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
