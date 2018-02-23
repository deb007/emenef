self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push Received.');
  var msg = event.data.text();
  console.log(msg);
  msg = JSON.parse(msg);
  console.log(msg);

  const title = msg.title;
  const options = {
    body: msg.body,
    icon: 'images/user-profile-bg.jpg',
    badge: 'images/office.jpg'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification click Received.');

  event.notification.close();

  event.waitUntil(
    clients.openWindow('https://emenef.glitch.me')
  );
});
