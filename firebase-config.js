/* ================================================================
   SINERGIA REA — firebase-config.js
   Integración con Firebase Firestore (base de datos en la nube)
   Proyecto: sinergiareaops
   ================================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ── Configuración del proyecto ── */
const firebaseConfig = {
  apiKey:            "AIzaSyDW7e5W8AfPOyr9Yxs-oQjiK3Pr96EhuQ0",
  authDomain:        "sinergiareaops.firebaseapp.com",
  projectId:         "sinergiareaops",
  storageBucket:     "sinergiareaops.firebasestorage.app",
  messagingSenderId: "183145068777",
  appId:             "1:183145068777:web:2d00873eb660edfac29878"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

/* ================================================================
   CACHÉ EN MEMORIA
   Todos los datos se cargan UNA vez desde Firestore al arrancar.
   Las funciones dbGet() del app.js leen de aquí (sin cambios).
   Las escrituras van directo a Firestore y actualizan el caché.
   ================================================================ */
window.__DB_CACHE = {
  clients:      [],
  tasks:        [],
  absences:     [],
  appointments: [],
  meta: {
    lastMonthCheck: new Date().getMonth(),
    lastLogin:      new Date().toISOString()
  }
};

/* ================================================================
   CARGA INICIAL — trae todos los datos desde Firestore
   ================================================================ */
async function loadAllFromFirestore() {
  const collections = ['clients', 'tasks', 'absences', 'appointments'];

  await Promise.all(collections.map(async (col) => {
    const snapshot = await getDocs(collection(db, col));
    window.__DB_CACHE[col] = snapshot.docs.map(d => {
      const data = d.data();
      // Convertir Timestamps de Firestore a ISO strings
      Object.keys(data).forEach(k => {
        if (data[k] && typeof data[k].toDate === 'function') {
          data[k] = data[k].toDate().toISOString();
        }
      });
      return { ...data, id: d.id };
    });
  }));

  // Recuperar meta desde localStorage (no necesita estar en Firestore)
  const savedMeta = localStorage.getItem('sinergia_rea_meta');
  if (savedMeta) {
    window.__DB_CACHE.meta = JSON.parse(savedMeta);
  }

  console.log('[Firebase] Datos cargados:', {
    clients:      window.__DB_CACHE.clients.length,
    tasks:        window.__DB_CACHE.tasks.length,
    absences:     window.__DB_CACHE.absences.length,
    appointments: window.__DB_CACHE.appointments.length
  });
}

/* ================================================================
   CRUD — operaciones que van a Firestore + actualizan caché
   Estas funciones REEMPLAZAN las del app.js via window.*
   ================================================================ */

/* GET — lee del caché en memoria (síncrono, igual que antes) */
window.dbGet = function(entity) {
  return window.__DB_CACHE[entity] || [];
};

/* GET DB completo (usado por checkMonthChange y deleteClient cascade) */
window.getDB = function() {
  return window.__DB_CACHE;
};

/* SAVE DB — solo guarda meta en localStorage */
window.saveDB = function(dbObj) {
  if (dbObj && dbObj.meta) {
    window.__DB_CACHE.meta = dbObj.meta;
    localStorage.setItem('sinergia_rea_meta', JSON.stringify(dbObj.meta));
  }
};

/* CREATE — agrega a Firestore y al caché */
window.dbCreate = async function(entity, obj) {
  obj.createdAt = new Date().toISOString();

  // Limpiar campos undefined para que Firestore no falle
  const clean = {};
  Object.keys(obj).forEach(k => {
    if (obj[k] !== undefined) clean[k] = obj[k];
  });

  try {
    const docRef = await addDoc(collection(db, entity), clean);
    const newObj = { ...clean, id: docRef.id };
    window.__DB_CACHE[entity].push(newObj);
    return newObj;
  } catch (e) {
    console.error('[Firebase] Error creando en', entity, e);
    Swal.fire('Error', 'No se pudo guardar. Verifica tu conexión.', 'error');
    throw e;
  }
};

/* UPDATE — actualiza en Firestore y en el caché */
window.dbUpdate = async function(entity, id, changes) {
  // Limpiar campos undefined y null de Firestore
  const clean = {};
  Object.keys(changes).forEach(k => {
    if (changes[k] !== undefined) clean[k] = changes[k] !== null ? changes[k] : '';
  });

  try {
    await updateDoc(doc(db, entity, id), clean);
    const idx = window.__DB_CACHE[entity].findIndex(x => x.id === id);
    if (idx !== -1) {
      window.__DB_CACHE[entity][idx] = { ...window.__DB_CACHE[entity][idx], ...changes };
    }
  } catch (e) {
    console.error('[Firebase] Error actualizando en', entity, id, e);
    Swal.fire('Error', 'No se pudo actualizar. Verifica tu conexión.', 'error');
    throw e;
  }
};

/* DELETE — elimina de Firestore y del caché */
window.dbDelete = async function(entity, id) {
  try {
    await deleteDoc(doc(db, entity, id));
    window.__DB_CACHE[entity] = window.__DB_CACHE[entity].filter(x => x.id !== id);
  } catch (e) {
    console.error('[Firebase] Error eliminando en', entity, id, e);
    Swal.fire('Error', 'No se pudo eliminar. Verifica tu conexión.', 'error');
    throw e;
  }
};

/* ================================================================
   DELETE EN CASCADA — elimina cliente + todos sus registros
   Reemplaza la lógica manual del deleteClient() en app.js
   ================================================================ */
window.deleteClientCascade = async function(clientId) {
  const batch = writeBatch(db);
  const cols  = ['tasks', 'absences', 'appointments'];

  // Agregar todas las eliminaciones relacionadas al batch
  cols.forEach(col => {
    window.__DB_CACHE[col]
      .filter(x => x.clientId === clientId)
      .forEach(x => batch.delete(doc(db, col, x.id)));
  });

  // Eliminar el cliente mismo
  batch.delete(doc(db, 'clients', clientId));

  await batch.commit();

  // Actualizar caché
  cols.forEach(col => {
    window.__DB_CACHE[col] = window.__DB_CACHE[col].filter(x => x.clientId !== clientId);
  });
  window.__DB_CACHE.clients = window.__DB_CACHE.clients.filter(x => x.id !== clientId);
};

/* ================================================================
   MIGRACIÓN DESDE localStorage → Firestore
   Se ejecuta UNA sola vez si hay datos locales guardados.
   ================================================================ */
async function migrateIfNeeded() {
  const local = localStorage.getItem('sinergia_rea_db');
  if (!local) return false;

  let parsed;
  try { parsed = JSON.parse(local); } catch { return false; }

  const cols = ['clients', 'tasks', 'absences', 'appointments'];
  const total = cols.reduce((s, c) => s + (parsed[c]?.length || 0), 0);
  if (!total) return false;

  const { isConfirmed } = await Swal.fire({
    title: '🔄 Migrar datos existentes',
    html:  `<div style="font-size:14px;color:#4a5080;line-height:1.8">
              Tienes datos guardados localmente.<br>
              <strong style="color:#0f1f6b">¿Quieres subirlos a la nube?</strong><br>
              <small>(${total} registros encontrados)</small>
            </div>`,
    icon:             'info',
    showCancelButton:  true,
    confirmButtonText: '✅ Sí, migrar a Firebase',
    cancelButtonText:  'No, empezar limpio'
  });

  if (!isConfirmed) {
    localStorage.removeItem('sinergia_rea_db');
    return false;
  }

  Swal.fire({
    title:             'Migrando datos...',
    html:              'Por favor espera, esto solo toma unos segundos.',
    allowOutsideClick: false,
    didOpen:           () => Swal.showLoading()
  });

  for (const col of cols) {
    for (const item of (parsed[col] || [])) {
      const { id, ...rest } = item; // Firestore genera su propio ID
      const clean = {};
      Object.keys(rest).forEach(k => { if (rest[k] !== undefined && rest[k] !== null) clean[k] = rest[k]; });
      try {
        const docRef = await addDoc(collection(db, col), clean);
        window.__DB_CACHE[col].push({ ...clean, id: docRef.id });
      } catch(e) { console.warn('Error migrando item:', e); }
    }
  }

  localStorage.removeItem('sinergia_rea_db');
  Swal.fire('✅ ¡Migración completada!', 'Tus datos ahora están en la nube 🚀', 'success');
  return true;
}

/* ================================================================
   PANTALLA DE CARGA — muestra mientras conecta a Firebase
   ================================================================ */
function showLoadingScreen() {
  const div = document.createElement('div');
  div.id = 'firebase-loading';
  div.style.cssText = `
    position:fixed; inset:0; z-index:9999;
    background:linear-gradient(135deg,#070e30,#0b1640);
    display:flex; flex-direction:column;
    align-items:center; justify-content:center; gap:20px;
  `;
  div.innerHTML = `
    <div style="font-family:'DM Serif Display',serif;font-size:28px;color:#f5a623;
                text-shadow:0 0 20px rgba(245,166,35,0.4)">
      Sinergia <span style="color:#fff">REA</span>
    </div>
    <div style="width:48px;height:48px;border:3px solid rgba(245,166,35,0.2);
                border-top-color:#f5a623;border-radius:50%;animation:spin .8s linear infinite"></div>
    <div style="font-size:13px;color:rgba(180,200,255,0.6);font-family:sans-serif;font-weight:600">
      Conectando con Firebase...
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
  document.body.appendChild(div);
}

function hideLoadingScreen() {
  const el = document.getElementById('firebase-loading');
  if (el) {
    el.style.transition = 'opacity 0.4s ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 400);
  }
}

/* ================================================================
   BOOTSTRAP — punto de entrada, llamado desde index.html
   ================================================================ */
window.firebaseBootstrap = async function() {
  showLoadingScreen();

  try {
    // 1. Intentar migrar datos locales primero
    const migrated = await migrateIfNeeded();

    // 2. Si no hubo migración, cargar datos desde Firestore
    if (!migrated) {
      await loadAllFromFirestore();
    }

    // 3. Ocultar pantalla de carga e iniciar app
    hideLoadingScreen();

    // 4. Llamar al init() del app.js
    if (typeof init === 'function') {
      init();
    }

  } catch (e) {
    console.error('[Firebase] Error de conexión:', e);
    hideLoadingScreen();
    Swal.fire({
      icon:  'error',
      title: 'Error de conexión',
      html:  `<div style="font-size:13px">
                No se pudo conectar a Firebase.<br>
                <strong>Verifica:</strong><br>
                1. Tu conexión a internet<br>
                2. Que Firestore esté activo en la consola<br>
                3. Las reglas de seguridad (modo prueba)
              </div>`,
      confirmButtonText: 'Reintentar'
    }).then(() => window.location.reload());
  }
};
