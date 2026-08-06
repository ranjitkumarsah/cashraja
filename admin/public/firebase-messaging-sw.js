/* Firebase Cloud Messaging service worker for web push (background messages).
   Served at the site root so its scope covers the whole app. The config below
   is the public web Firebase config (safe to ship). */
importScripts('https://www.gstatic.com/firebasejs/12.17.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.17.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBIyEizgC-NB2r9LHKv8JFYx_czUzD8I10',
  authDomain: 'cashraja-prod.firebaseapp.com',
  projectId: 'cashraja-prod',
  storageBucket: 'cashraja-prod.firebasestorage.app',
  messagingSenderId: '60588979841',
  appId: '1:60588979841:web:8515fceb3b0dbe11afff80',
});

const messaging = firebase.messaging();

// Show a notification when a push arrives while the app is in the background.
messaging.onBackgroundMessage((payload) => {
  const n = (payload && payload.notification) || {};
  self.registration.showNotification(n.title || 'Cash Raja', {
    body: n.body || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: (payload && payload.data) || {},
  });
});

// Focus/open the app when a notification is clicked.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      return clients.openWindow('/home');
    }),
  );
});
