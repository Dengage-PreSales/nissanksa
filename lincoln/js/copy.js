/* ============================================================================
   Strings for the Dengage demo controls, in both site languages. The replica's
   own page copy is baked into each HTML file, because the page IS the content;
   these strings belong to the launcher, the inbox drawer, the event panel and
   the booking modal, which are shared across every page. The Arabic column
   ships ready for the Arabic mirror even though this build publishes English
   only: the html lang attribute is the source of truth and is read at call
   time, never captured at module scope.
   ========================================================================== */
(function (window, document) {
    'use strict';

    var STRINGS = {
        en: {
            launcherOpen: 'Dengage demo',
            launcherTitle: 'Dengage scenarios',
            launcherIntro: 'Fire any experience on this page, live. Everything lands in the Dengage panel as it happens.',
            launcherReset: 'Reset widget display state',
            groupBrand: 'Lincoln scenarios',
            groupOnsite: 'On-site messaging',
            groupAbTest: 'A/B testing',
            groupGame: 'Gamification',
            groupInline: 'Inline personalization',
            groupPush: 'Web push',
            groupInbox: 'App inbox',
            groupEvents: 'Data events',
            inlineElsewhere: 'Renders on another page of this demo',
            gestureExitIntent: 'Move the pointer up and out of the page to trigger it',
            gestureScrollDepth: 'Scroll down the page to trigger it',
            drawnHere: 'Lincoln creative, drawn by this demo',
            alsoExitIntent: 'Lincoln creative, also on exit intent',
            alsoScrollDepth: 'Lincoln creative, also on scroll',
            actionPushPrompt: 'Raises the browser permission prompt',
            actionInboxOpen: 'Opens the message drawer',
            setupNote: 'Whatever it captures reaches Dengage through the usual events and relay',
            quickRef: 'Quick reference',
            refDevice: 'Device id',
            refSession: 'Session id',
            refToken: 'Push token',
            refContact: 'Contact key',
            refPageUrl: 'Demo page URL',
            refAccount: 'Account',
            refApp: 'Application',
            refNone: 'not available yet',
            refCopy: 'Copy',
            refCopied: 'Copied',
            eventsTitle: 'Storefront events',
            eventsIntro: 'Send a real ecommerce event to Dengage, exactly as the site itself does.',
            eventSend: 'Send event',
            inboxTitle: 'Lincoln updates',
            inboxJustNow: 'just now',
            inboxMinutes: '{n} min ago',
            inboxHours: '{n} h ago',
            inboxUnread: '{n} unread',
            inboxNoSdk: 'This page is not connected to a Dengage application.',
            inboxStarting: 'Connecting to your inbox. Press Refresh in a moment.',
            inboxError: 'Dengage could not return this inbox. The console has the reason.',
            inboxEmpty: 'No messages yet.',
            inboxEmptyHint: 'Send one from a Dengage campaign or journey, then press Refresh.',
            inboxUntitled: 'Untitled message',
            inboxOpen: 'Open',
            inboxDismiss: 'Dismiss',
            inboxRefresh: 'Refresh',
            close: 'Close',
            testDrive: 'Book a Test Drive',
            tdChooseTrim: 'Choose your grade',
            tdYourDetails: 'Your details',
            tdName: 'Full name',
            tdMobile: 'Mobile number',
            tdCity: 'City',
            tdHorizon: 'When do you plan to buy?',
            tdHorizonSoon: 'Within 1 month',
            tdHorizonMid: 'From 1 to 3 months',
            tdHorizonLater: 'More than 3 months',
            tdSubmit: 'Confirm booking',
            tdThanks: 'Your test drive request is in. A confirmation is on its way, and our team will call to agree the time.',
            tdContinue: 'Continue',
            brochureSaved: 'Noted. Your interest in the {model} brochure is on your demo profile.',
            waNote: 'WhatsApp runs on Value First’s channel. Its intent signals land on this profile in real time; the dealer cockpit fires one.',
            postSale: 'Ownership and service journeys are a later phase. This demonstration covers the pre-purchase lifecycle.',
            notPart: 'This link is outside the scope of this demo.'
        },
        ar: {
            launcherOpen: 'عرض دنقيج',
            launcherTitle: 'سيناريوهات دنقيج',
            launcherIntro: 'شغّل أي تجربة على هذه الصفحة مباشرة. كل شيء يصل إلى لوحة دنقيج لحظة حدوثه.',
            launcherReset: 'إعادة تعيين حالة الودجات',
            groupBrand: 'سيناريوهات لينكولن',
            groupOnsite: 'رسائل الموقع',
            groupAbTest: 'اختبار A/B',
            groupGame: 'التلعيب',
            groupInline: 'تخصيص مدمج',
            groupPush: 'إشعارات الويب',
            groupInbox: 'صندوق الرسائل',
            groupEvents: 'أحداث البيانات',
            inlineElsewhere: 'يظهر في صفحة أخرى من هذا العرض',
            gestureExitIntent: 'حرّك المؤشر خارج الصفحة من الأعلى لتشغيله',
            gestureScrollDepth: 'مرّر إلى أسفل الصفحة لتشغيله',
            drawnHere: 'محتوى لينكولن معروض من هذا العرض التوضيحي',
            alsoExitIntent: 'محتوى لينكولن، ويظهر أيضاً عند مغادرة الصفحة',
            alsoScrollDepth: 'محتوى لينكولن، ويظهر أيضاً عند التمرير',
            actionPushPrompt: 'يعرض طلب إذن الإشعارات في المتصفح',
            actionInboxOpen: 'يفتح درج الرسائل',
            setupNote: 'كل ما يُجمع هنا يصل إلى دنجيج عبر الأحداث والوسيط المعتادين',
            quickRef: 'مرجع سريع',
            refDevice: 'معرّف الجهاز',
            refSession: 'معرّف الجلسة',
            refToken: 'رمز الإشعارات',
            refContact: 'مفتاح جهة الاتصال',
            refPageUrl: 'رابط صفحة العرض',
            refAccount: 'الحساب',
            refApp: 'التطبيق',
            refNone: 'غير متوفر بعد',
            refCopy: 'نسخ',
            refCopied: 'تم النسخ',
            eventsTitle: 'أحداث المتجر',
            eventsIntro: 'أرسل حدث تجارة إلكترونية حقيقياً إلى دنقيج، تماماً كما يفعل الموقع نفسه.',
            eventSend: 'إرسال الحدث',
            inboxTitle: 'تحديثات لينكولن',
            inboxJustNow: 'الآن',
            inboxMinutes: 'قبل {n} دقيقة',
            inboxHours: 'قبل {n} ساعة',
            inboxUnread: '{n} غير مقروءة',
            inboxNoSdk: 'هذه الصفحة غير متصلة بتطبيق دنقيج.',
            inboxStarting: 'جارٍ الاتصال بصندوق الوارد. اضغط تحديث بعد لحظات.',
            inboxError: 'تعذر على دنقيج إرجاع صندوق الوارد. التفاصيل في وحدة التحكم.',
            inboxEmpty: 'لا توجد رسائل بعد.',
            inboxEmptyHint: 'أرسل رسالة من حملة أو رحلة في دنقيج ثم اضغط تحديث.',
            inboxUntitled: 'رسالة بلا عنوان',
            inboxOpen: 'فتح',
            inboxDismiss: 'إخفاء',
            inboxRefresh: 'تحديث',
            close: 'إغلاق',
            testDrive: 'احجز تجربة قيادة',
            tdChooseTrim: 'اختر الفئة',
            tdYourDetails: 'بياناتك',
            tdName: 'الاسم الكامل',
            tdMobile: 'رقم الجوال',
            tdCity: 'المدينة',
            tdHorizon: 'متى تخطط للشراء؟',
            tdHorizonSoon: 'خلال شهر',
            tdHorizonMid: 'من شهر إلى 3 أشهر',
            tdHorizonLater: 'أكثر من 3 أشهر',
            tdSubmit: 'تأكيد الحجز',
            tdThanks: 'تم استلام طلب تجربة القيادة. التأكيد في طريقه إليك، وسيتصل بك فريقنا للاتفاق على الموعد.',
            tdContinue: 'متابعة',
            brochureSaved: 'تم التسجيل. اهتمامك بكتيب {model} أصبح على ملفك في هذا العرض.',
            waNote: 'واتساب يعمل عبر قناة Value First. إشاراته تصل إلى هذا الملف مباشرة، ولوحة الوكيل ترسل واحدة.',
            postSale: 'رحلات ما بعد البيع والصيانة مرحلة لاحقة. هذا العرض يغطي مرحلة ما قبل الشراء.',
            notPart: 'هذا الرابط خارج نطاق هذا العرض.'
        }
    };

    function table() {
        var lang = (document.documentElement.getAttribute('lang') || 'en').indexOf('ar') === 0 ? 'ar' : 'en';
        return STRINGS[lang] || STRINGS.en;
    }

    window.SiteCopy = {
        table: table,
        t: function (key, vars) {
            var value = table()[key];
            if (value === undefined) value = STRINGS.en[key];
            if (value === undefined) return key;
            Object.keys(vars || {}).forEach(function (name) {
                value = value.replace('{' + name + '}', vars[name]);
            });
            return value;
        }
    };
})(window, document);
