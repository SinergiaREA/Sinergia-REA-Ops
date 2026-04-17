/* ================================================================
   SINERGIA REA — firebase-messaging-sw.js
   Service Worker para Firebase Cloud Messaging (FCM)
   Recibe notificaciones push aunque la app esté cerrada/en background.

   ⚠️  SEGURIDAD:
   - Solo procesa mensajes de Firebase (origen verificado por FCM).
   - No expone datos sensibles en el payload de la notificación.
   - El token FCM se almacena únicamente en Firestore bajo el UID del
     usuario autenticado, nunca en localStorage ni en texto plano.
   ================================================================ */

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

/* ── Configuración Firebase (igual que firebase-config.js) ── */
firebase.initializeApp({
  apiKey:            'AIzaSyDW7e5W8AfPOyr9Yxs-oQjiK3Pr96EhuQ0',
  authDomain:        'sinergiareaops.firebaseapp.com',
  projectId:         'sinergiareaops',
  storageBucket:     'sinergiareaops.firebasestorage.app',
  messagingSenderId: '183145068777',
  appId:             '1:183145068777:web:2d00873eb660edfac29878'
});

const messaging = firebase.messaging();

/* ── Notificaciones en background (app cerrada o minimizada) ── */
messaging.onBackgroundMessage(payload => {
  console.log('[SW] Notificación en background recibida:', payload);

  const { title = '🔔 Sinergia REA', body = 'Tienes una alerta pendiente' }
    = payload.notification || {};

  /* Validación mínima: ignorar payloads sin título (posible spam) */
  if (!title) return;

  self.registration.showNotification(title, {
    body,
    icon:  '/icon-192.png',   /* Ícono de la app */
    badge: '/icon-72.png',
    tag:   'sinergia-rea-alert',   /* Reemplaza notif anterior del mismo tag */
    renotify: true,
    data:  payload.data || {},
    actions: [
      { action: 'open',    title: '📋 Ver en app' },
      { action: 'dismiss', title: 'Cerrar'        }
    ]
  });
});

/* ── Al hacer clic en la notificación → abrir/enfocar la app ── */
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        /* Si ya hay una ventana de la app abierta → enfocarla */
        for (const client of list) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        /* Si no → abrir nueva ventana */
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});
