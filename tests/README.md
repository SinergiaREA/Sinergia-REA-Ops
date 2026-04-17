# 🧪 Tests FCM — Sinergia REA

Este directorio contiene pruebas manuales para verificar que las notificaciones push (FCM) funcionan correctamente.

## 📋 Contenido

- **fcm-manual-tests.js** — Suite de pruebas que se pueden ejecutar en la consola del navegador

## 🚀 Cómo ejecutar los tests

### Método 1: Verificación Rápida (Recomendado)

1. Inicia sesión en la app
2. Abre la consola del navegador: **F12**
3. Ve a la pestaña **Console**
4. Pega y ejecuta:
   ```javascript
   window.__FCM_Tests.quickCheck()
   ```

Este comando mostrará un resumen rápido del estado:
```
✅ Usuario autenticado
✅ FCM inicializado
✅ Token generado
✅ Permisos concedidos
✅ UID disponible

✅ TODO OK — FCM ACTIVO Y FUNCIONAL
```

### Método 2: Suite Completa

Para un análisis más profundo, ejecuta:
```javascript
window.__FCM_Tests.runAll()
```

Esto ejecutará:
1. ✅ Verificar usuario autenticado
2. ✅ Estado general de FCM
3. ✅ Permisos de notificación
4. ✅ Service Worker status
5. ✅ Logs detallados
6. ✅ Conexión a Firestore

### Método 3: Tests Individuales

Puedes ejecutar cada test por separado:

```javascript
// Ver estado general
window.__FCM_Tests.status()

// Ver permisos del navegador
window.__FCM_Tests.permissions()

// Ver Service Workers activos
window.__FCM_Tests.serviceWorker()

// Ver logs de FCM
window.__FCM_Tests.logs()

// Verificar token en Firestore
window.__FCM_Tests.firestore()

// Ver usuario autenticado
window.__FCM_Tests.user()
```

## 📊 Interpretando los Resultados

### ✅ Estados Exitosos

```
✅ Estado: ACTIVE
✅ Token generado: abc123def456...
✅ Permisos: granted
✅ Service Worker: activated
```

**Significado:** FCM está completamente funcional. Las notificaciones se entregarán normalmente.

### ⚠️ Estados de Advertencia

```
⚠️ Estado: PERMISSION_DENIED
```

**Significado:** El usuario rechazó los permisos de notificación.

**Solución:** 
1. Ve a Configuración del navegador
2. Busca Sinergia REA
3. Cambia Notificaciones a "Permitir"
4. Recarga la app

### ❌ Estados de Error

```
❌ Estado: TOKEN_ERROR
❌ Error: Registration failed - push service error
```

**Significado:** Hay un problema en la comunicación con Firebase.

**Soluciones:**
1. Verifica que estés en HTTPS (FCM solo funciona en HTTPS)
2. Abre la consola (F12) y busca mensajes "[FCM]" para más detalles
3. Comprueba que Firebase Console tenga API FCM V1 habilitada
4. Recarga la página (Ctrl+F5)

## 🔍 Debugging Avanzado

### Panel Visual (Solo para Admin)

Si eres usuario admin, aparecerá un botón "🔍 FCM" en la barra superior que abrirá un panel visual con:
- Estado actual de FCM
- Token generado
- UID del usuario
- Registro cronológico de eventos

### Consola del Navegador

Todos los eventos de FCM se registran con el prefijo `[FCM]`. Para verlos todos:

1. Abre F12 → Console
2. Filtra por: `[FCM]`

Verás líneas como:
```
[FCM] ✓ Navegador soporta SW y Notifications
[FCM] ✓ Service Worker registrado
[FCM] Esperando a que SW esté ACTIVO...
[FCM] ✓ Service Worker ACTIVATED
[FCM] Solicitando permiso de notificaciones...
[FCM] ✓ Token obtenido: abc123def456...
[FCM] ✓ Token guardado en Firestore para UID: xyz789
```

## 🎯 Checklist de Verificación

Antes de considerar que FCM está completamente funcional:

- [ ] `quickCheck()` muestra todo verde
- [ ] El botón "🔍 FCM" aparece en la barra (admin)
- [ ] Abres el panel y ves estado "✅ ACTIVO"
- [ ] Token está guardado en Firestore
- [ ] Consulta "/fcm_tokens/{uid}" en Firebase Console y ves tu token
- [ ] El navegador tiene permisos de notificación concedidos
- [ ] Pruebas enviando una notificación desde Firebase Console

## 📱 Prueba Final: Enviar Notificación de Prueba

1. Desde Firebase Console:
   - Ve a **Cloud Messaging**
   - Haz clic en **Enviar tu primer mensaje**
   - Llena:
     - Título: "Test FCM"
     - Contenido: "¡Funciona!"
     - Usuario: Selecciona por token o UID
   - Haz clic en **Enviar**

2. Deberías recibir la notificación en:
   - **App abierta:** Notificación nativa del sistema
   - **App minimizada/cerrada:** Notificación del Service Worker

## 🐛 Problemas Comunes

| Problema | Causa | Solución |
|----------|-------|----------|
| `PERMISSION_DENIED` | Usuario rechazó | Ver permisos en Configuración |
| `TOKEN_ERROR: Registration failed` | SW no está activo | Esperar 10s, luego recargar |
| `TOKEN_NULL` | VAPID Key incorrecta | Verificar Firebase Console |
| Sin notificaciones en background | SW no registrado | Recargar la app |
| Notificaciones en foreground solo | `onMessage()` no conectado | Ver firebase-config.js |

## 🔗 Archivos Relacionados

- [firebase-config.js](../firebase-config.js) — Configuración de FCM
- [firebase-messaging-sw.js](../firebase-messaging-sw.js) — Service Worker
- [app.js](../app.js) — Panel de debugging visual
- [index.html](../index.html) — Manifest y estructura

## 📞 Soporte

Si los tests muestran errores:

1. Abre la Consola (F12)
2. Ejecuta: `window.__FCM_DEBUG`
3. Revisa el array de `logs` para ver qué falló exactamente
4. Comparte los logs con el equipo de desarrollo
