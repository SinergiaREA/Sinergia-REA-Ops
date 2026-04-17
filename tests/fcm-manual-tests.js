/**
 * ================================================================
 * SINERGIA REA — Manual Tests para FCM (Firebase Cloud Messaging)
 * ================================================================
 * 
 * Para ejecutar estas pruebas:
 * 1. Abre la app en el navegador
 * 2. Inicia sesión con una cuenta autorizada
 * 3. Abre la consola del navegador (F12)
 * 4. Copia y pega las funciones de prueba una por una
 * 5. Llama a la función como: testFCMStatus()
 * 
 * Las pruebas verifican:
 * - Estado de FCM
 * - Token generado correctamente
 * - Permisos de notificaciones
 * - Service Worker activo
 * - Conexión a Firestore
 */

/**
 * TEST 1: Verificar estado general de FCM
 */
function testFCMStatus() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('TEST 1: Estado General de FCM');
  console.log('═══════════════════════════════════════════════════════');
  
  const debug = window.__FCM_DEBUG;
  
  if (!debug) {
    console.error('❌ No se encontró window.__FCM_DEBUG — FCM aún no se ha inicializado');
    return;
  }
  
  const status = debug.status || 'UNKNOWN';
  const statusEmoji = {
    'ACTIVE': '✅',
    'ERROR': '❌',
    'PERMISSION_DENIED': '⚠️',
    'TOKEN_ERROR': '❌',
    'TOKEN_NULL': '⚠️',
    'BROWSER_NOT_SUPPORTED': '❌'
  };
  
  console.log(`${statusEmoji[status] || '❓'} Estado: ${status}`);
  console.log(`📊 Logs registrados: ${(debug.logs || []).length}`);
  
  if (debug.token) {
    console.log(`✅ Token generado: ${debug.token.substring(0, 30)}...`);
  } else {
    console.log('❌ Sin token FCM');
  }
  
  if (debug.uid) {
    console.log(`✅ UID del usuario: ${debug.uid}`);
  } else {
    console.log('⚠️ Sin UID — verifica que estés autenticado');
  }
  
  if (debug.error) {
    console.error(`⚠️ Error registrado: ${debug.error}`);
  }
  
  console.log('═══════════════════════════════════════════════════════\n');
  
  return debug;
}

/**
 * TEST 2: Verificar permisos de notificación
 */
async function testNotificationPermission() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('TEST 2: Permisos de Notificación del Navegador');
  console.log('═══════════════════════════════════════════════════════');
  
  if (!('Notification' in window)) {
    console.error('❌ Este navegador no soporta Notifications API');
    return;
  }
  
  const permission = Notification.permission;
  const permissionEmoji = {
    'granted': '✅',
    'denied': '❌',
    'default': '❓'
  };
  
  console.log(`${permissionEmoji[permission] || '❓'} Permiso actual: ${permission}`);
  
  if (permission === 'granted') {
    console.log('✅ Las notificaciones están HABILITADAS');
  } else if (permission === 'denied') {
    console.log('❌ Las notificaciones están BLOQUEADAS');
    console.log('   Para habilitarlas: Configuración del navegador → Sinergia REA → Notificaciones');
  } else {
    console.log('❓ El usuario aún no ha decidido');
    console.log('   Respuesta esperada en el próximo login');
  }
  
  console.log('═══════════════════════════════════════════════════════\n');
  
  return permission;
}

/**
 * TEST 3: Verificar Service Worker
 */
async function testServiceWorker() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('TEST 3: Service Worker (SW)');
  console.log('═══════════════════════════════════════════════════════');
  
  if (!('serviceWorker' in navigator)) {
    console.error('❌ Este navegador no soporta Service Workers');
    return;
  }
  
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    console.log(`📊 Service Workers registrados: ${registrations.length}`);
    
    registrations.forEach((reg, i) => {
      const state = reg.active?.state || reg.waiting?.state || reg.installing?.state || 'unknown';
      console.log(`  [${i + 1}] Scope: ${reg.scope}`);
      console.log(`      Estado: ${state}`);
      
      if (state === 'activated') {
        console.log(`      ✅ ACTIVO y listo`);
      } else if (state === 'activating') {
        console.log(`      ⏳ Activándose...`);
      } else if (state === 'installed') {
        console.log(`      ⏳ Instalado, esperando activación`);
      } else if (state === 'installing') {
        console.log(`      ⏳ Instalando...`);
      }
    });
    
    // Verificar específicamente firebase-messaging-sw.js
    const fcmReg = registrations.find(r => r.scope.includes('firebase-messaging'));
    if (fcmReg) {
      console.log(`✅ Service Worker de FCM encontrado`);
    } else {
      console.warn('⚠️ Service Worker de FCM no encontrado — podría haber un problema');
    }
    
  } catch (err) {
    console.error(`❌ Error al obtener registros: ${err.message}`);
  }
  
  console.log('═══════════════════════════════════════════════════════\n');
}

/**
 * TEST 4: Ver logs detallados de FCM
 */
function testFCMLogs() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('TEST 4: Registro Detallado de FCM (últimos eventos)');
  console.log('═══════════════════════════════════════════════════════');
  
  const debug = window.__FCM_DEBUG;
  
  if (!debug || !debug.logs) {
    console.log('❌ No hay logs disponibles');
    return;
  }
  
  const logs = debug.logs || [];
  console.log(`📋 Total de eventos: ${logs.length}\n`);
  
  logs.forEach((log, i) => {
    const emoji = {
      'SUCCESS': '✅',
      'ERROR': '❌',
      'WARN': '⚠️',
      'INFO': 'ℹ️'
    };
    const time = new Date(log.timestamp).toLocaleTimeString('es-MX');
    console.log(`[${i + 1}] ${emoji[log.tipo] || '•'} ${log.tipo.padEnd(7)} | ${time} | ${log.msg}`);
  });
  
  console.log('\n═══════════════════════════════════════════════════════\n');
  
  return logs;
}

/**
 * TEST 5: Verificar conexión a Firestore (FCM tokens)
 */
async function testFirestoreConnection() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('TEST 5: Conexión a Firestore — Colección fcm_tokens');
  console.log('═══════════════════════════════════════════════════════');
  
  const uid = window.currentUser?.uid;
  if (!uid) {
    console.warn('⚠️ No estás autenticado — verifica que window.currentUser exista');
    return;
  }
  
  try {
    // Acceder a la instancia de Firestore
    const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    const db = window.__firebaseDb;
    
    if (!db) {
      console.error('❌ No se encontró instancia de Firestore (window.__firebaseDb)');
      return;
    }
    
    console.log(`🔍 Buscando token para UID: ${uid}`);
    const docRef = doc(db, 'fcm_tokens', uid);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log('✅ Documento encontrado en Firestore');
      console.log(`   Token: ${data.token?.substring(0, 30)}...${data.token?.substring(data.token.length - 10)}`);
      console.log(`   Email: ${data.email}`);
      console.log(`   Nombre: ${data.nombre}`);
      console.log(`   Actualizado: ${new Date(data.updatedAt).toLocaleString('es-MX')}`);
    } else {
      console.warn('⚠️ Documento NO encontrado en Firestore');
      console.log('   Posibles causas:');
      console.log('   1. FCM aún no se ha inicializado');
      console.log('   2. Falta de permisos en Firestore Rules');
      console.log('   3. El token no se guardó correctamente');
    }
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
  }
  
  console.log('═══════════════════════════════════════════════════════\n');
}

/**
 * TEST 6: Verificar usuario autenticado
 */
function testCurrentUser() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('TEST 6: Usuario Autenticado');
  console.log('═══════════════════════════════════════════════════════');
  
  const user = window.currentUser;
  
  if (!user) {
    console.error('❌ No hay usuario autenticado (window.currentUser === null)');
    console.log('   Asegúrate de estar logueado en la app');
    return;
  }
  
  console.log('✅ Usuario autenticado:');
  console.log(`   UID: ${user.uid}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Nombre: ${user.nombre}`);
  console.log(`   Rol: ${user.rol}`);
  
  console.log('═══════════════════════════════════════════════════════\n');
  
  return user;
}

/**
 * TEST 7: Suite completa (ejecuta todos los tests)
 */
async function runAllTests() {
  console.log('\n\n');
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  SUITE COMPLETA DE TESTS — SINERGIA REA FCM           ║');
  console.log('║  Fecha: ' + new Date().toLocaleString('es-MX').padEnd(40) + '║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');
  
  testCurrentUser();
  testFCMStatus();
  await testNotificationPermission();
  await testServiceWorker();
  testFCMLogs();
  await testFirestoreConnection();
  
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║  FIN DE TESTS                                         ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');
}

/**
 * TEST 8: Mostrar resumen rápido
 */
function quickCheck() {
  console.log('\n🔍 VERIFICACIÓN RÁPIDA DE FCM\n');
  
  const debug = window.__FCM_DEBUG || {};
  const user = window.currentUser;
  const permission = Notification?.permission || 'unknown';
  
  const checks = [
    { label: 'Usuario autenticado', pass: !!user, value: user?.nombre || 'NO' },
    { label: 'FCM inicializado', pass: debug.status === 'ACTIVE', value: debug.status || 'NO' },
    { label: 'Token generado', pass: !!debug.token, value: debug.token ? '✓' : 'NO' },
    { label: 'Permisos concedidos', pass: permission === 'granted', value: permission },
    { label: 'UID disponible', pass: !!debug.uid, value: debug.uid || 'NO' }
  ];
  
  checks.forEach(check => {
    const emoji = check.pass ? '✅' : '❌';
    console.log(`${emoji} ${check.label.padEnd(25)}: ${check.value}`);
  });
  
  const allPass = checks.every(c => c.pass);
  console.log('\n' + (allPass ? '✅ TODO OK — FCM ACTIVO Y FUNCIONAL' : '⚠️  PROBLEMAS DETECTADOS — Ver logs arriba'));
  console.log('');
  
  return allPass;
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTAR PARA USO EN CONSOLA
// ═══════════════════════════════════════════════════════════════════

window.__FCM_Tests = {
  status: testFCMStatus,
  permissions: testNotificationPermission,
  serviceWorker: testServiceWorker,
  logs: testFCMLogs,
  firestore: testFirestoreConnection,
  user: testCurrentUser,
  runAll: runAllTests,
  quickCheck: quickCheck
};

console.log('\n✅ Funciones de prueba cargadas. Úsalas así:');
console.log('   window.__FCM_Tests.quickCheck()       — Verificación rápida');
console.log('   window.__FCM_Tests.runAll()          — Suite completa');
console.log('   window.__FCM_Tests.status()          — Estado de FCM');
console.log('   window.__FCM_Tests.logs()            — Ver logs');
console.log('   window.__FCM_Tests.firestore()       — Verificar Firestore');
console.log('\n');
