/* ============================================================================
   The five inline slots, and the header clearance the first one needs.

   Handoff 5.2. Inline campaigns inject into the page's own flow at a target
   selector, so the targets have to exist even when empty.

     dn_inline_target_below_header      immediately after </header>
     dn_inline_target_below_hero        after the hero block, home page
     dn_inline_target_in_grid           inside the product grid
     dn_inline_target_pdp_below_price   product page, under the price block
     dn_inline_target_above_footer      immediately before <footer>
     dn_inline_target_reco              above the local rail, both pages, for
                                        Dengage's own recommendation widget. Its
                                        launcher card is parked, see js/panels.js.
                                        The slot stays: empty it has no height, and
                                        keeping it makes turning the card back on a
                                        one line change rather than markup edits

   THE CLEARANCE CANNOT BE A CONSTANT, which is the only subtle part here.

   dn_inline_target_below_header sits directly beneath a fixed header and would
   render behind it. The header's height is not fixed: it changes on scroll, and
   again when a Dengage top banner is pinned above it, which happens whenever
   the sticky-bar scenario fires. So this measures the header's actual bottom
   edge and publishes it as --dn-header-clearance on :root.

   The CSS carries a fallback value for the same variable, so if this module
   never runs the slot is merely lower than ideal rather than invisible.

   One more thing worth knowing about inline creatives, from handoff 12.3: they
   are NOT sandboxed, unlike popups and banners. The SDK puts their <style> in
   document.head and clones their HTML into the target, so their CSS leaks
   page-wide unless every selector is namespaced under its own root id. That is
   a rule for whoever authors the inline creatives, not for this file, but this
   is where someone will come looking.
   ========================================================================== */
(function (window, document) {
    'use strict';

    /* THE BANNER WANTS THE SAME PIXELS AS THE HEADER, AND UNTIL 7 AUGUST 2026 IT
       SIMPLY TOOK THEM. A Dengage top banner is fixed at the top of the viewport, the
       storefront header is fixed at the top of the viewport, and nothing moved either
       of them, so firing the sticky-bar scenario hid the header completely: no logo,
       no navigation, no cart. On a call that reads as the widget having broken the
       site.

       The note above this file and the transition on .site-header both say the header
       is expected to move when a banner pins. Nothing ever made it move. This is that
       missing half, and it is measured rather than assumed because the banner's height
       depends on how the copy wraps.

       FOUND BY SHAPE, NOT BY SELECTOR, because the engine's own class names are its
       to change and this file cannot see them. A banner is a direct child of body,
       fixed, touching the top edge, essentially full width, and short. Each of those
       conditions is doing work:

         the header itself matches every one of them, so it is excluded by identity
         a modal scrim is fixed and full width but as tall as the viewport, so the
           height ceiling excludes it
         the launcher button and the debug readout are anchored to the bottom, so the
           top test excludes them

       With no banner present this returns 0 and every rule below behaves exactly as
       it did before. */
    /* A CANDIDATE, TESTED BY SHAPE. Anything that is not our own, is pinned to the top
       of the viewport, is essentially full width and is short. */
    function looksLikeBanner(el, header) {
        if (!el || el === header || el.contains(header) || header.contains(el)) return false;
        var style = window.getComputedStyle(el);
        if (style.position !== 'fixed' || style.display === 'none') return false;
        if (style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
        var box = el.getBoundingClientRect();
        if (box.top > 2 || box.height <= 0 || box.height > 200) return false;
        return box.width >= window.innerWidth * 0.9;
    }

    /* TWO LEVELS DEEP, NOT ONE, AND THAT IS THE WHOLE POINT OF THIS FUNCTION. The
       first version of this looked only at direct children of body, which assumed the
       engine pins the banner element itself. If it wraps it, and a wrapper that is not
       itself fixed is entirely normal, the fixed element is a grandchild and the whole
       measurement silently returns zero: the header goes back to being covered and
       nothing reports why. Two levels covers a single wrapper, which is the shape
       worth defending against without walking the entire document.

       SEARCHED HERE, MEASURED ELSEWHERE. This runs on the mutation observer and on
       the bounded start-up ticks, not on scroll, because getComputedStyle on a list of
       elements during a scroll is exactly the kind of thing that makes a page feel
       heavy. measure() re-reads the found element's box instead, which is cheap. */
    function findBanner(header) {
        var children = document.body.children;
        for (var i = 0; i < children.length; i++) {
            var el = children[i];
            if (looksLikeBanner(el, header)) return el;
            var inner = el.children;
            for (var j = 0; j < inner.length; j++) {
                if (looksLikeBanner(inner[j], header)) return inner[j];
            }
        }
        return null;
    }

    /* Held between calls so a scroll does not pay for the search. Dropped the moment
       the element leaves the document, which is what a dismissed banner does. */
    var banner = null;

    /* A HEIGHT THE BAR REPORTED ABOUT ITSELF, which outranks anything measured from
       out here. Added 7 August 2026, after the shape test above was fixed twice and
       still left the header covered on the live site.

       WHY MEASURING FROM THE PAGE KEEPS FAILING. Every condition in looksLikeBanner is
       a guess about markup this file cannot see, and the height ceiling is the most
       fragile of them: if the engine renders the bar inside a full viewport iframe with
       a transparent body, then the element pinned at the top of the screen is 900px
       tall, not 60px. The ceiling rejects it, nothing moves, and the bar sits over the
       header exactly as before. From outside a cross origin frame there is no way to
       tell that iframe from a modal scrim, because the only difference is inside it.

       So the bar says. It is the one participant that knows its own height, it already
       has a channel to this page for the theme, and a number it sends needs no
       interpretation at all. The shape test stays as the fallback for the campaigns
       authored in the panel, which have no file here to add a reporter to.

       WHAT THIS TRUSTS. One field, coerced to a number and clamped to a plausible bar.
       It never reads a selector, a URL or a colour out of the message, and it cannot do
       anything with one but set a CSS length. An unclamped value would let a frame push
       the header off the top of the screen, which is the only harm available here, and
       the clamp is what removes it. */
    var reported = null;

    function readBannerReport(event) {
        if (!event.data || event.data.dnBanner !== 'height') return;
        var px = Number(event.data.px);
        if (!isFinite(px) || px < 0 || px > 240) return;
        reported = Math.round(px);
        measure();
    }

    function bannerBottom(header) {
        /* The report wins when there is one. A bar that has been dismissed sends zero
           before it goes, so this returns to the shape test rather than staying stuck
           at the last height it was told. */
        if (reported !== null && reported > 0) return reported;
        if (banner && !document.body.contains(banner)) banner = null;
        if (banner && !looksLikeBanner(banner, header)) banner = null;
        if (!banner) return 0;
        var box = banner.getBoundingClientRect();
        return Math.round(box.bottom);
    }

    /* Called where a banner may have appeared: the observer and the start-up ticks. */
    function rescan() {
        var header = document.querySelector('.site-header');
        if (!header) return;
        banner = findBanner(header);
        measure();
    }

    function measure() {
        var header = document.querySelector('.site-header');
        if (!header) return;

        /* Published before the header is measured, because the header's own position
           depends on it: the next line reads a box that this value has just moved. */
        document.documentElement.style.setProperty(
            '--dn-banner-height', bannerBottom(header) + 'px');

        var bottom = header.getBoundingClientRect().bottom;
        /* Clamp: a negative or absurd value means the header is mid-transition,
           and writing that would make the slot jump. */
        if (bottom < 0 || bottom > 400) return;
        document.documentElement.style.setProperty('--dn-header-clearance', Math.round(bottom) + 'px');
    }

    function init() {
        rescan();

        /* The header moves for three reasons and all three need remeasuring. */
        window.addEventListener('scroll', measure, { passive: true });
        window.addEventListener('resize', measure, { passive: true });

        /* Registered before anything can render, so a bar that reports its height the
           instant it appears is never talking to a page that is not listening. */
        window.addEventListener('message', readBannerReport);

        /* A Dengage banner pinned at the top pushes the header down. It arrives
           asynchronously, injected by the SDK, so nothing on the page fires an
           event we can listen for. Observing the DOM is the only reliable
           signal. */
        if (window.MutationObserver) {
            var observer = new MutationObserver(function () { rescan(); });
            /* subtree, because the banner may be added INSIDE a container the engine
               planted earlier rather than as a new child of body. A childList-only
               observer on body never fires for that. */
            observer.observe(document.body, { childList: true, subtree: true });
        }

        /* Belt and braces for the first second, while the SDK is still deciding
           what to render. Cheap, bounded, and it removes a class of "the slot is
           behind the header on first load" reports. */
        var ticks = 0;
        var timer = setInterval(function () {
            rescan();
            if (++ticks > 10) clearInterval(timer);
        }, 200);
    }

    /* rescan is exported too, so a page or a check can force a fresh look rather than
       waiting for the observer. */
    window.Slots = { init: init, measure: measure, rescan: rescan };
})(window, document);
