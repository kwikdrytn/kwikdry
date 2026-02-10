// Firebase messaging service worker
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBrzL_JHpcu2jbiVqey8mPGVm7sA8yzhf4",
  authDomain: "kwik-dry-dealership.firebaseapp.com",
  projectId: "kwik-dry-dealership",
  storageBucket: "kwik-dry-dealership.firebasestorage.app",
  messagingSenderId: "967103223283",
  appId: "1:967103223283:web:ab988c96e406d12c932e86",
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);

  const notificationType = payload.data?.type || '';
  const isInventory = notificationType.includes('stock') || notificationType.includes('inventory');

  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: notificationType || 'general',
    data: { ...payload.data, clickUrl: isInventory ? '/inventory' : '/checklists' },
    actions: [
      { action: 'open', title: isInventory ? 'View Inventory' : 'Open Checklists' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    const urlToOpen = event.notification.data?.clickUrl || '/dashboard';
    
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          for (const client of clientList) {
            if (client.url.includes(self.location.origin) && 'focus' in client) {
              client.navigate(urlToOpen);
              return client.focus();
            }
          }
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen);
          }
        })
    );
  }
});
