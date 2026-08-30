/* ============================================================================
   The App Inbox: a message centre inside the storefront.

   The one Dengage capability with no panel template behind it. Story, Product
   Box, Video Popup and the rest are drawn by the Visual Editor, so the panel
   builds them and a demo only has to fire a trigger. Nothing draws an inbox, so
   this file is the inbox. If it is missing, the demo has no inbox to show, which
   is exactly the gap it was written to close.

   WHAT IS OURS AND WHAT IS DENGAGE'S.

     Dengage holds the messages, one list per device, and records impressions,
     opens, clicks and deletions against them. All of that goes through
     js/dengageEvents.js, which is the only module allowed to call the SDK.

     This file draws the bell, the badge, the drawer and the message list, and
     decides what an empty inbox says.

   THE MESSAGE SHAPE IS DECIDED BY THE SERVER, NOT BY US, and that is the whole
   reason field reading here looks indirect. Every message is an object with an
   smsgId and a messageJson holding the payload that was sent. The payload is a
   push message, so its title and body arrive under the names the push side
   uses, and an inbox message composed in the panel can carry an image and a
   destination as well.

   Rather than commit to one spelling of each field and render blanks if the
   server uses another, pick() reads a short list of candidates at both levels.
   A demo that renders an untitled message on a call is worse than one that
   reads two extra keys. The raw first message is logged once per refresh, so
   the real shape is always one glance away in DevTools.

   READ STATE IS OURS. The provider reports an open to Dengage but exposes no
   "is read" flag to read back, so unread is tracked in localStorage under the
   slug, the same namespacing the cart and wishlist use. Two demos open in one
   browser keep separate inboxes. Handoff 5.4.
   ========================================================================== */
(function (window, document) {
    'use strict';

    function config() { return window.DEMO_CONFIG || {}; }
    /* This build's strings live in js/copy.js, keyed identically to the copy
       table this file was written against, so t() below reads unchanged. */
    function copy() { return (window.SiteCopy && window.SiteCopy.table()) || {}; }

    var $ = function (sel, root) { return (root || document).querySelector(sel); };

    function t(key, vars) {
        var text = copy()[key] || key;
        Object.keys(vars || {}).forEach(function (name) {
            text = text.replace('{' + name + '}', vars[name]);
        });
        return text;
    }

    var slug = window.DEMO_SLUG || 'demo';
    var READ_KEY = 'dps:' + slug + ':inbox-read';
    var HIDDEN_KEY = 'dps:' + slug + ':inbox-hidden';

    function read(key) {
        try {
            var raw = window.localStorage.getItem(key);
            var parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (err) { return []; }
    }

    function write(key, value) {
        try { window.localStorage.setItem(key, JSON.stringify(value)); }
        catch (err) { /* private mode, so read state lasts this session only */ }
    }

    var readIds = read(READ_KEY);
    var hiddenIds = read(HIDDEN_KEY);
    var messages = [];
    var state = 'starting';
    var reported = {};

    /* ------------------------------------------------------------------ */
    /* Reading a server shaped message                                     */

    /* Candidates are tried in order, at the top level of the message and then
       inside its messageJson. The first non-empty value wins. */
    function pick(message, names) {
        var sources = [message, message && message.messageJson, message && message.message_json];
        for (var s = 0; s < sources.length; s++) {
            var source = sources[s];
            if (!source || typeof source !== 'object') continue;
            for (var n = 0; n < names.length; n++) {
                var value = source[names[n]];
                if (value !== null && value !== undefined && value !== '') return value;
            }
        }
        return null;
    }

    function messageId(message) {
        var id = pick(message, ['smsgId', 'smsg_id', 'messageId', 'id']);
        return id === null ? null : String(id);
    }

    function messageTitle(message) {
        var value = pick(message, ['title', 'messageTitle', 'header', 'subject']);
        return value === null ? null : String(value);
    }

    function messageBody(message) {
        var value = pick(message, ['message', 'body', 'messageBody', 'text', 'content']);
        return value === null ? null : String(value);
    }

    /* Same scheme rule as the destination below. A panel field is data, and the
       only thing a demo should render from it is an image fetched over http. It
       also keeps the media in step with the rule the shared creatives follow:
       artwork is committed to this repository and served from the published
       origin, never inlined and never from somewhere else. */
    function messageMedia(message) {
        var value = pick(message, ['mediaUrl', 'media_url', 'media', 'image',
                                   'imageUrl', 'image_url', 'iconUrl', 'icon']);
        if (value === null) return null;
        var text = String(value);
        return /^https?:\/\//i.test(text) ? text : null;
    }

    /* Only http and https are followed. A message is authored in the panel and
       arrives as data, so treating whatever it carries as a live URL is how a
       javascript: destination would end up wired to a click. */
    function messageUrl(message) {
        var value = pick(message, ['targetUrl', 'target_url', 'url', 'link', 'deepLink']);
        if (value === null) return null;
        var text = String(value);
        return /^https?:\/\//i.test(text) ? text : null;
    }

    function messageDate(message) {
        var value = pick(message, ['sendDate', 'sentDate', 'receivedDate', 'createDate',
                                   'sent_time', 'sentTime', 'eventDate', 'date']);
        if (value === null) return null;
        var when = new Date(value);
        return isFinite(when.getTime()) ? when : null;
    }

    /* The panel can attach buttons to a message. Their shape varies with the
       template, so anything array like is read for a label and an id, and a
       button with no usable label is dropped rather than rendered blank. */
    function messageButtons(message) {
        var list = pick(message, ['actionButtons', 'action_buttons', 'buttons', 'actions']);
        if (!Array.isArray(list)) return [];
        return list.map(function (button, index) {
            if (!button || typeof button !== 'object') return null;
            var label = button.text || button.title || button.label || button.caption;
            if (!label) return null;
            return {
                id: String(button.id || button.buttonId || button.action || ('button-' + index)),
                label: String(label),
                url: /^https?:\/\//i.test(String(button.targetUrl || button.url || ''))
                    ? String(button.targetUrl || button.url) : null
            };
        }).filter(Boolean);
    }

    /* ------------------------------------------------------------------ */
    /* Rendering                                                           */

    function visible() {
        return messages.filter(function (message) {
            var id = messageId(message);
            return id !== null && hiddenIds.indexOf(id) === -1;
        });
    }

    function unreadCount() {
        return visible().filter(function (message) {
            return readIds.indexOf(messageId(message)) === -1;
        }).length;
    }

    function escapeText(value) {
        return window.Catalog && window.Catalog.escapeText
            ? window.Catalog.escapeText(value)
            : String(value === null || value === undefined ? '' : value)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
    }

    /* Short, and never a numeric date. toLocaleDateString gives "8/4/2026", which
       is the fourth of August to half the world and the eighth of April to the
       other half: an ambiguous date in a list where every other row is a relative
       time reads as a glitch. Day and short month is unambiguous in any locale and
       fits the column. */
    function stamp(when) {
        if (!when) return '';
        var mins = Math.round((Date.now() - when.getTime()) / 60000);
        if (mins < 1) return t('inboxJustNow');
        if (mins < 60) return t('inboxMinutes', { n: mins });
        if (mins < 60 * 24) return t('inboxHours', { n: Math.round(mins / 60) });
        try {
            return when.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
        } catch (err) {
            return t('inboxHours', { n: Math.round(mins / 60) });
        }
    }

    /* The empty state says which kind of empty it is. "No messages" when the
       SDK never started is a lie that costs a call: it reads as a broken inbox
       when the real answer is that nothing has been sent to this device yet. */
    function emptyBlock() {
        if (state === 'dry') {
            return '<p class="empty">' + t('inboxNoSdk') + '</p>';
        }
        if (state === 'starting') {
            return '<p class="empty">' + t('inboxStarting') + '</p>';
        }
        if (state === 'error') {
            return '<p class="empty">' + t('inboxError') + '</p>';
        }
        return '<p class="empty">' + t('inboxEmpty') + '</p>' +
               '<p class="empty-hint">' + t('inboxEmptyHint') + '</p>';
    }

    function messageBlock(message) {
        var id = messageId(message);
        var isRead = readIds.indexOf(id) !== -1;
        var title = messageTitle(message);
        var body = messageBody(message);
        var media = messageMedia(message);
        var url = messageUrl(message);
        var when = messageDate(message);
        var buttons = messageButtons(message);

        var html = '<article class="inbox-item' + (isRead ? ' read' : ' unread') +
                   '" data-inbox-id="' + escapeText(id) + '">';

        /* THE MEDIA COLUMN IS RESERVED OR IT IS NOT, for the whole list at once,
           decided in render() below. Per message it produced a ragged left edge
           down the drawer: the ones with an image indented and the ones without
           did not, which reads as a layout fault rather than as a mixed list. An
           empty placeholder keeps the text aligned when only some messages have
           an image, and no column at all is right when none of them do. */
        if (media) {
            html += '<div class="inbox-media"><img src="' + escapeText(media) +
                    '" alt="" loading="lazy"></div>';
        } else {
            html += '<div class="inbox-media empty"></div>';
        }

        html += '<div class="inbox-text">';
        html += '<div class="inbox-top">';
        /* The unread marker is a dot on the message rather than a rail beside it.
           A left border on consecutive unread items merges into one continuous
           line, so three unread messages read as one block and the count in the
           header disagrees with what is on screen. */
        html += '<h3>' + (isRead ? '' : '<span class="dot" aria-hidden="true"></span>') +
                escapeText(title || t('inboxUntitled')) + '</h3>';
        if (when) html += '<span class="inbox-when">' + escapeText(stamp(when)) + '</span>';
        html += '</div>';
        if (body) html += '<p>' + escapeText(body) + '</p>';

        html += '<div class="inbox-actions">';
        if (url) {
            /* A new tab, always. The demo is what is being screen shared, so
               following a message's destination in place would replace it with
               whatever the panel put in that field, mid call. Same reason the
               shared creatives never navigate. */
            html += '<a class="btn btn-small" href="' + escapeText(url) +
                    '" target="_blank" rel="noopener"' +
                    ' data-inbox-open="' + escapeText(id) + '">' + t('inboxOpen') + '</a>';
        }
        buttons.forEach(function (button) {
            html += '<button type="button" class="btn btn-small btn-quiet"' +
                    ' data-inbox-button="' + escapeText(button.id) + '"' +
                    ' data-inbox-id="' + escapeText(id) + '"' +
                    (button.url ? ' data-inbox-href="' + escapeText(button.url) + '"' : '') +
                    '>' + escapeText(button.label) + '</button>';
        });
        /* Always last and always on the same row as everything else. It used to
           wrap to its own line whenever a message carried buttons, so the one
           control that removes something moved position depending on the content
           above it. */
        html += '<button type="button" class="link-btn dismiss" data-inbox-dismiss="' +
                escapeText(id) + '">' + t('inboxDismiss') + '</button>';
        html += '</div>';

        html += '</div></article>';
        return html;
    }

    function render() {
        var body = $('#inbox-body');
        var list = visible();
        var n = unreadCount();

        if (body) {
            body.innerHTML = list.length
                ? list.map(messageBlock).join('')
                : emptyBlock();
            /* Decided once for the list, not per message. See messageBlock. */
            var anyMedia = list.some(function (message) { return !!messageMedia(message); });
            body.classList.toggle('with-media', anyMedia);
        }

        /* The drawer says how many are unread as well as the bell, because the
           bell is behind the open drawer while somebody is reading it. */
        var count = $('#inbox-count');
        if (count) {
            count.textContent = n ? t('inboxUnread', { n: n }) : '';
            count.hidden = n === 0;
        }

        var badge = $('#inbox-badge');
        if (badge) {
            badge.textContent = n;
            badge.hidden = n === 0;
        }

        hideBrokenMedia();

        /* An impression is reported once per message per page, when it is
           actually in the list on screen. Reporting on fetch instead would
           count messages nobody saw, and reporting on every render would count
           the same message once per refresh. */
        if (isOpen()) reportImpressions(list);
    }

    /* An image URL comes from a panel field, so it can be wrong in ways nothing
       here controls: a typo, an asset that was moved, a host that is unreachable
       from the room the call is in. The browser's answer to that is a broken
       image icon in a grey box, which on screen reads as the inbox failing
       rather than as one message with a bad link. So the whole media column is
       removed and the message renders as text, which is still the message. */
    function hideBrokenMedia() {
        var images = document.querySelectorAll('#inbox-body .inbox-media img');
        Array.prototype.forEach.call(images, function (img) {
            /* complete with no natural width means it already failed, which is
               the normal case for a cached failure: the error event fired before
               this listener could exist. */
            if (img.complete && img.naturalWidth === 0) { drop(img); return; }
            img.addEventListener('error', function () { drop(img); });
        });
        function drop(img) {
            var holder = img.parentNode;
            if (holder && holder.parentNode) holder.parentNode.removeChild(holder);
        }
    }

    function isOpen() {
        var drawer = $('#inbox');
        return !!(drawer && drawer.classList.contains('open'));
    }

    function reportImpressions(list) {
        list.forEach(function (message) {
            var id = messageId(message);
            if (!id || reported[id]) return;
            reported[id] = true;
            window.DengageEvents.inboxImpression(id);
        });
    }

    /* ------------------------------------------------------------------ */
    /* Refresh                                                             */

    var refreshing = false;

    function refresh() {
        if (refreshing) return Promise.resolve(state);
        refreshing = true;
        return window.DengageEvents.inboxMessages().then(function (result) {
            refreshing = false;
            state = result.status;
            messages = result.list;
            if (window.console && messages.length) {
                /* One raw message per refresh. The server decides the shape, so
                   this is the fastest way to see it on a call rather than
                   guessing from a rendered card. */
                console.log('[inbox] ' + messages.length + ' message(s), first raw:', messages[0]);
            }
            render();
            return state;
        }, function () {
            refreshing = false;
            state = 'error';
            render();
            return state;
        });
    }

    /* The SDK registers a visitor asynchronously, so the first read usually
       lands before there is a device id to read for. Rather than leave the
       badge wrong until someone opens the drawer, retry a few times with a
       widening gap and stop as soon as the inbox answers. Six tries over about
       thirty seconds covers a cold load on a slow connection without polling
       for the life of the page. */
    function settle(tries) {
        tries = tries || 0;
        return refresh().then(function (status) {
            if (status !== 'starting' || tries >= 5) return status;
            return new Promise(function (resolve) {
                window.setTimeout(function () { resolve(settle(tries + 1)); }, 1000 * (tries + 2));
            });
        });
    }

    /* ------------------------------------------------------------------ */
    /* Interaction                                                         */

    function markRead(id) {
        if (!id || readIds.indexOf(id) !== -1) return;
        readIds.push(id);
        write(READ_KEY, readIds);
    }

    function open(id) {
        markRead(id);
        window.DengageEvents.inboxOpen(id);
        render();
    }

    function click(id, buttonId) {
        markRead(id);
        window.DengageEvents.inboxClick(id, buttonId);
        render();
    }

    /* Local by default. See the note on onDelete in js/dengageEvents.js: a
       delete against a shared Dengage account is not something a demo does on
       its own. */
    function dismiss(id) {
        if (!id) return;
        if (hiddenIds.indexOf(id) === -1) {
            hiddenIds.push(id);
            write(HIDDEN_KEY, hiddenIds);
        }
        window.DengageEvents.inboxDelete(id);
        render();
    }

    function wire() {
        var body = $('#inbox-body');
        if (!body) return;

        body.addEventListener('click', function (event) {
            var el = event.target.closest
                ? event.target.closest('[data-inbox-open],[data-inbox-button],[data-inbox-dismiss]')
                : null;
            if (!el) return;

            if (el.hasAttribute('data-inbox-dismiss')) {
                event.preventDefault();
                dismiss(el.getAttribute('data-inbox-dismiss'));
                return;
            }
            if (el.hasAttribute('data-inbox-button')) {
                event.preventDefault();
                var buttonId = el.getAttribute('data-inbox-button');
                var owner = el.getAttribute('data-inbox-id');
                click(owner, buttonId);
                var href = el.getAttribute('data-inbox-href');
                if (href) window.open(href, '_blank', 'noopener');
                return;
            }
            /* The open affordance is a real link to a real destination, so the
               report goes out and navigation is left alone. */
            open(el.getAttribute('data-inbox-open'));
        });

        var refreshBtn = $('#inbox-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function () { refresh(); });
        }

        /* Opening the drawer is the moment messages are seen, so it is both when
           impressions become true and when a stale list is worth re-reading. */
        var trigger = document.querySelector('[data-open="#inbox"]');
        if (trigger) {
            trigger.addEventListener('click', function () {
                refresh();
            });
        }
    }

    function boot() {
        wire();
        render();
        settle();
    }

    window.Inbox = {
        boot: boot,
        /* The launcher opens the drawer itself and then calls this, because the
           two have to happen in that order: opening is what makes an impression
           true, and refresh reports impressions only when the drawer is open. */
        refresh: refresh,
        unreadCount: unreadCount,
        /* Exposed for factory/checks/inbox.js, which asserts the field reading
           against every spelling Dengage might serve without a live account. */
        parse: {
            id: messageId,
            title: messageTitle,
            body: messageBody,
            media: messageMedia,
            url: messageUrl,
            date: messageDate,
            buttons: messageButtons
        },
        keys: { read: READ_KEY, hidden: HIDDEN_KEY }
    };
})(window, document);
