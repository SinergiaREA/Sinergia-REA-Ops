/* ================================================================
   SINERGIA REA — firebase-messaging-sw.js v2.0
   Service Worker para Firebase Cloud Messaging (FCM)
   Recibe notificaciones push aunque la app esté cerrada/en background.

   ⚠️  SEGURIDAD:
   - Solo procesa mensajes de Firebase (origen verificado por FCM).
   - No expone datos sensibles en el payload de la notificación.
   - El token FCM se almacena únicamente en Firestore bajo el UID del
     usuario autenticado, nunca en localStorage ni en texto plano.
   ================================================================ */

console.log('[SW] Iniciando Service Worker...');

try {
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
  console.log('[SW] ✓ firebase-app-compat.js cargado');
} catch(e) {
  console.error('[SW] ✗ Error cargando firebase-app-compat.js:', e);
}

try {
  importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');
  console.log('[SW] ✓ firebase-messaging-compat.js cargado');
} catch(e) {
  console.error('[SW] ✗ Error cargando firebase-messaging-compat.js:', e);
}

/* ── Configuración Firebase (igual que firebase-config.js) ── */
let messaging;
try {
  firebase.initializeApp({
    apiKey:            'AIzaSyDW7e5W8AfPOyr9Yxs-oQjiK3Pr96EhuQ0',
    authDomain:        'sinergiareaops.firebaseapp.com',
    projectId:         'sinergiareaops',
    storageBucket:     'sinergiareaops.firebasestorage.app',
    messagingSenderId: '183145068777',
    appId:             '1:183145068777:web:2d00873eb660edfac29878'
  });
  console.log('[SW] ✓ Firebase inicializado');
  
  messaging = firebase.messaging();
  console.log('[SW] ✓ Messaging obtenido');
} catch(e) {
  console.error('[SW] ✗ Error inicializando Firebase:', e);
}

/* ── Evento de instalación del SW ── */
self.addEventListener('install', event => {
  console.log('[SW] install event - Service Worker instalándose...');
  self.skipWaiting();
});

/* ── Evento de activación del SW ── */
self.addEventListener('activate', event => {
  console.log('[SW] activate event - Service Worker activándose...');
  self.clients.claim();
});

/* ── Notificaciones en background (app cerrada o minimizada) ── */
if (messaging) {
  messaging.onBackgroundMessage(payload => {
    console.log('[SW] 📩 Notificación en background recibida:', payload);

    const { title = '🔔 Sinergia REA', body = 'Tienes una alerta pendiente' }
      = payload.notification || {};

    /* Validación mínima: ignorar payloads sin título (posible spam) */
    if (!title) {
      console.warn('[SW] ⚠️ Notificación sin título - ignorada');
      return;
    }

    try {
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
      console.log('[SW] ✓ Notificación mostrada:', title);
    } catch(e) {
      console.error('[SW] ✗ Error mostrando notificación:', e);
    }
  });
} else {
  console.error('[SW] ✗ Messaging no está disponible - onBackgroundMessage no se suscribió');
}

/* ── Al hacer clic en la notificación → abrir/enfocar la app ── */
self.addEventListener('notificationclick', event => {
  console.log('[SW] notificationclick event:', event.action);
  event.notification.close();

  if (event.action === 'dismiss') {
    console.log('[SW] Notificación descartada por usuario');
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        console.log(`[SW] ${list.length} cliente(s) encontrado(s)`);
        
        /* Si ya hay una ventana de la app abierta → enfocarla */
        for (const client of list) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            console.log('[SW] ✓ Enfocando ventana existente');
            return client.focus();
          }
        }
        
        /* Si no → abrir nueva ventana */
        if (clients.openWindow) {
          console.log('[SW] ✓ Abriendo nueva ventana');
          return clients.openWindow('/');
        }
      })
      .catch(err => {
        console.error('[SW] ✗ Error en notificationclick:', err);
      })
  );
});

/* ── Health check - responder a mensajes de la app ── */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SW_HEALTH_CHECK') {
    console.log('[SW] Health check recibido desde la app');
    event.ports[0].postMessage({ status: 'OK', timestamp: Date.now() });
  }
});

console.log('[SW] ✅ Service Worker listo - todos los event listeners activos');
