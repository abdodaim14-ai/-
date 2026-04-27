const CACHE_NAME = 'hemma-cache-v1';
const assetsToCache = [
  "./",
  "./index.html",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
  "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap"
];

// رسائل تحفيزية خاصة بطلاب منصة هِمة
const hemmaMessages = [
    { t: "همة مؤمن 💪", b: "استمر يا بطل، تذكر أن القمة لا يصلها إلا أصحاب الهمم العالية." },
    { t: "وقت الدراسة 📚", b: "هل ألقيت نظرة على جدولك اليوم؟ تنظيم الوقت أول خطوات النجاح." },
    { t: "إنجاز جديد ✨", b: "شارك زملائك إنجازاً حققته اليوم في قسم التحديثات." },
    { t: "نصيحة هِمة 💡", b: "التركيز لمدة 25 دقيقة أفضل من المذاكرة لساعات مع التشتت." },
    { t: "رسالة لك 💌", b: "أنت ذكي، أنت مثابر، أنت بطل منصة هِمة.. انطلق!" }
];

// التثبيت وحفظ الملفات
self.addEventListener("install", e => {
    e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(assetsToCache)));
});

// التفعيل وتنظيف الملفات القديمة
self.addEventListener("activate", e => {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
});

// العمل بدون إنترنت
self.addEventListener("fetch", e => {
    e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});

// نظام التنبيهات التحفيزي
function sendHemmaNotification() {
    const randomMsg = hemmaMessages[Math.floor(Math.random() * hemmaMessages.length)];
    
    const options = {
        body: randomMsg.b,
        icon: 'icons/icon-192x192.png',
        badge: 'icons/icon-192x192.png',
        vibrate: [200, 100, 200],
        tag: 'hemma-motivation',
        renotify: true,
        data: { url: '/' }
    };

    self.registration.showNotification(randomMsg.t, options);
}

// إرسال تنبيه تحفيزي كل ساعة (أو حسب رغبتك)
setInterval(sendHemmaNotification, 3600000); 

// عند الضغط على التنبيه يفتح المنصة
self.addEventListener('notificationclick', e => {
    e.notification.close();
    e.waitUntil(clients.openWindow('/'));
});
