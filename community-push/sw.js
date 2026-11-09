/*
 * Daaem Community Push Service Worker
 * Separate from Webpushr notifications.
 */

self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'داعم المواهب للقرآن الكريم';

  const options = {
    body: payload.body || 'لديك إشعار جديد من المجتمع.',
    icon: payload.icon || '/-/icons/icon-192.png',
    badge: payload.badge || '/-/icons/icon-192.png',
    tag: payload.tag || 'daaem-community-notification',
    renotify: Boolean(payload.renotify),
    data: {
      url: payload.url || '/-/messages.html',
      notificationType: payload.type || 'community'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const requestedUrl =
    event.notification.data && event.notification.data.url;

  let targetUrl = '/-/messages.html';

  try {
    const candidate = new URL(
      requestedUrl || targetUrl,
      self.location.origin
    );

    if (candidate.origin === self.location.origin) {
      targetUrl = candidate.href;
    }
  } catch (_) {}

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    });

    for (const client of windows) {
      if (
        new URL(client.url).origin === self.location.origin &&
        'focus' in client
      ) {
        await client.navigate(targetUrl);
        return client.focus();
      }
    }

    if (self.clients.openWindow) {
      return self.clients.openWindow(targetUrl);
    }
  })());
});
