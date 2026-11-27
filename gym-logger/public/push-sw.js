// Lastes inn i service workeren (importScripts). Viser «pausen er over»-varselet fra serveren.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : 'Repgrade' };
  }
  event.waitUntil(
    (async () => {
      // Er appen åpen og synlig, piper den selv: vis varselet uten lyd så det ikke blir dobbelt.
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const visible = wins.some((w) => w.visibilityState === 'visible');
      await self.registration.showNotification(data.title || 'Repgrade', {
        body: data.body || '',
        tag: data.tag || 'rest',
        renotify: true,
        silent: visible,
        vibrate: [200, 100, 200, 100, 400],
        icon: 'icon-192.png',
        badge: 'icon-192.png',
        data: { url: './#/workout' },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const url = new URL(event.notification.data?.url || './', self.registration.scope).href;
      for (const w of wins) {
        if ('focus' in w) {
          await w.focus();
          if ('navigate' in w) await w.navigate(url).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
