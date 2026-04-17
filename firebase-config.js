/* ================================================================
   SINERGIA REA — firebase-config.js v3.0
   Firebase Auth + Firestore | 2 usuarios autorizados
   ================================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs,
  updateDoc, deleteDoc, doc, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getMessaging, getToken, onMessage
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";

const firebaseConfig = {
  apiKey:            "AIzaSyDW7e5W8AfPOyr9Yxs-oQjiK3Pr96EhuQ0",
  authDomain:        "sinergiareaops.firebaseapp.com",
  projectId:         "sinergiareaops",
  storageBucket:     "sinergiareaops.firebasestorage.app",
  messagingSenderId: "183145068777",
  appId:             "1:183145068777:web:2d00873eb660edfac29878"
};

const app       = initializeApp(firebaseConfig);
const db        = getFirestore(app);
const auth      = getAuth(app);
const messaging = getMessaging(app);

// ── Exponer la instancia de Firestore para módulos ES6 externos ──
// Los módulos en /src (declaraciones.service.js, etc.) la acceden
// via window.__firebaseDb sin necesidad de re-inicializar Firebase.
window.__firebaseDb = db;

/* Usuarios autorizados — emails creados en Firebase Auth Console */
const USUARIOS = {
  'esleiter@sinergiarea.com':  { nombre: 'Esleiter Ramiro',              rol: 'admin' },
  'angelica@sinergiarea.com':  { nombre: 'CP. Angelica Chagala Sixtega', rol: 'contadora' }
};

window.currentUser = null;

/* ─── CACHÉ EN MEMORIA ─── */
window.__DB_CACHE = {
  clients: [], tasks: [], absences: [], appointments: [],
  meta: { lastMonthCheck: new Date().getMonth(), lastLogin: new Date().toISOString() }
};

/* ─── CATÁLOGO REGÍMENES SAT ─── */
window.REGIMENES_SAT = [
  { clave:'601', nombre:'General de Ley Personas Morales' },
  { clave:'603', nombre:'Personas Morales con Fines no Lucrativos' },
  { clave:'605', nombre:'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { clave:'606', nombre:'Arrendamiento' },
  { clave:'607', nombre:'Régimen de Enajenación o Adquisición de Bienes' },
  { clave:'608', nombre:'Demás ingresos' },
  { clave:'610', nombre:'Residentes en el Extranjero sin EP en México' },
  { clave:'611', nombre:'Ingresos por Dividendos (socios y accionistas)' },
  { clave:'612', nombre:'Personas Físicas con Actividades Empresariales y Profesionales' },
  { clave:'614', nombre:'Ingresos por intereses' },
  { clave:'615', nombre:'Régimen de los ingresos por obtención de premios' },
  { clave:'616', nombre:'Sin obligaciones fiscales' },
  { clave:'620', nombre:'Sociedades Cooperativas de Producción' },
  { clave:'621', nombre:'Incorporación Fiscal' },
  { clave:'622', nombre:'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras' },
  { clave:'623', nombre:'Opcional para Grupos de Sociedades' },
  { clave:'624', nombre:'Coordinados' },
  { clave:'625', nombre:'Actividades Empresariales vía Plataformas Tecnológicas' },
  { clave:'626', nombre:'Régimen Simplificado de Confianza (RESICO)' }
];

/* ─── CATÁLOGO GIROS EMPRESARIALES ─── */
window.GIROS_EMPRESARIALES = [
  { id:'taxista',       nombre:'TAXISTA',                  iva:'0%' },
  { id:'herreria',      nombre:'HERRERÍA',                 iva:'16%' },
  { id:'asalariado',    nombre:'SUELDOS Y SALARIOS',       iva:'0%' },
  { id:'pensionado',    nombre:'JUBILADOS',                iva:'0%' },
  { id:'purificadora',  nombre:'PURIFICADORA DE AGUA',     iva:'0%' },
  { id:'reciclaje',     nombre:'RECICLAJE (CARTÓN/METAL)', iva:'16%' },
  { id:'vivero',        nombre:'VIVERO DE PLANTAS',        iva:'0%' },
  { id:'abarrotes',     nombre:'ABARROTES',                iva:'16% y 0%' },
  { id:'papeleria',     nombre:'PAPELERÍA',                iva:'16%' },
  { id:'abarrotes_pan', nombre:'ABARROTES Y PANADERÍA',    iva:'16% y 0%' },
  { id:'taller_mec',    nombre:'TALLER MECÁNICO',          iva:'16%' },
  { id:'pizzas',        nombre:'PIZZAS',                   iva:'16%' },
  { id:'restaurant',    nombre:'RESTAURANT BAR',           iva:'16%' },
  { id:'farmacia',      nombre:'FARMACIA',                 iva:'16% y 0%' },
  { id:'tortas',        nombre:'TORTAS / COMIDA',          iva:'16%' },
  { id:'agricultura',   nombre:'AGRICULTURA',              iva:'0%' },
  { id:'comercio_temp', nombre:'COMERCIO DE TEMPORADA',    iva:'16%' },
  { id:'soporte_tec',   nombre:'SOPORTE TÉCNICO',          iva:'16%' },
  { id:'mundo_verde',   nombre:'MUNDO VERDE / NATURISTA',  iva:'0%' },
  { id:'construccion',  nombre:'CONSTRUCCIÓN',             iva:'16%' },
  { id:'transporte',    nombre:'TRANSPORTE DE CARGA',      iva:'0%' },
  { id:'salon',         nombre:'SALÓN DE BELLEZA',         iva:'16%' },
  { id:'ropa',          nombre:'ROPA Y CALZADO',           iva:'16%' },
  { id:'medico',        nombre:'SERVICIOS MÉDICOS',        iva:'0%' },
  { id:'otro',          nombre:'OTRO',                     iva:'16%' }
];

/* ─── LOGIN SCREEN ─── */
function showLoginScreen() {
  const s = document.getElementById('sidebar');
  const m = document.querySelector('.main');
  if (s) s.style.display = 'none';
  if (m) m.style.display = 'none';
  if (document.getElementById('login-screen')) return;

  const div = document.createElement('div');
  div.id = 'login-screen';
  div.style.cssText = 'position:fixed;inset:0;z-index:9999;background:linear-gradient(135deg,#070e30 0%,#0b1640 60%,#0f1f6b 100%);display:flex;align-items:center;justify-content:center;font-family:Outfit,DM Sans,sans-serif;';
  div.innerHTML = `
    <div style="background:rgba(16,32,96,0.92);border:1px solid rgba(100,140,255,0.25);border-radius:20px;padding:44px 40px;width:100%;max-width:420px;box-shadow:0 24px 64px rgba(0,0,0,0.6);">
      <div style="text-align:center;margin-bottom:32px;">
        <div style="font-family:'DM Serif Display',serif;font-size:32px;color:#f5a623;text-shadow:0 0 20px rgba(245,166,35,0.4);line-height:1;">Sinergia <span style="color:#fff">REA</span></div>
        <div style="font-size:11px;color:#6880c8;letter-spacing:3px;text-transform:uppercase;margin-top:6px;font-weight:700;">Servicios Contables</div>
      </div>
      <div style="font-size:18px;font-weight:800;color:#fff;margin-bottom:4px;">Iniciar sesión</div>
      <div style="font-size:13px;color:#6880c8;margin-bottom:26px;font-weight:600;">Acceso exclusivo para personal autorizado</div>
      <div style="display:grid;gap:14px;">
        <div>
          <label style="font-size:10.5px;color:#6880c8;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;display:block;margin-bottom:6px;">Correo electrónico</label>
          <input id="login-email" type="email" placeholder="correo@sinergiareas.com"
            style="width:100%;background:#0b1640;border:1.5px solid rgba(100,140,255,0.3);border-radius:10px;padding:12px 16px;font-size:13px;color:#fff;outline:none;font-family:inherit;font-weight:600;"
            onkeydown="if(event.key==='Enter')doLogin()">
        </div>
        <div>
          <label style="font-size:10.5px;color:#6880c8;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;display:block;margin-bottom:6px;">Contraseña</label>
          <input id="login-pass" type="password" placeholder="••••••••"
            style="width:100%;background:#0b1640;border:1.5px solid rgba(100,140,255,0.3);border-radius:10px;padding:12px 16px;font-size:13px;color:#fff;outline:none;font-family:inherit;font-weight:600;"
            onkeydown="if(event.key==='Enter')doLogin()">
        </div>
        <div id="login-error" style="display:none;background:rgba(255,64,64,0.12);border:1px solid rgba(255,64,64,0.3);border-radius:8px;padding:10px 14px;font-size:12px;color:#ff4040;font-weight:700;"></div>
        <button id="login-btn" onclick="doLogin()"
          style="background:linear-gradient(135deg,#f5a623,#ff6b35);color:#fff;border:none;border-radius:10px;padding:13px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;margin-top:4px;box-shadow:0 4px 20px rgba(245,166,35,0.4);">
          Entrar al sistema →
        </button>
      </div>
      <div style="text-align:center;margin-top:24px;font-size:11px;color:rgba(100,140,255,0.4);font-weight:600;">🔒 Sistema privado — Solo personal autorizado</div>
    </div>`;
  document.body.appendChild(div);
  setTimeout(() => document.getElementById('login-email')?.focus(), 100);
}

window.doLogin = async function() {
  const email = document.getElementById('login-email')?.value?.trim();
  const pass  = document.getElementById('login-pass')?.value;
  const errEl = document.getElementById('login-error');
  const btn   = document.getElementById('login-btn');
  errEl.style.display = 'none';
  if (!email || !pass) { errEl.textContent='Ingresa tu correo y contraseña.'; errEl.style.display='block'; return; }
  btn.textContent = 'Verificando...'; btn.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch(e) {
    errEl.textContent = 'Credenciales incorrectas. Verifica e intenta de nuevo.';
    errEl.style.display = 'block';
    btn.textContent = 'Entrar al sistema →'; btn.disabled = false;
  }
};

window.doLogout = async function() {
  const { isConfirmed } = await Swal.fire({ title:'¿Cerrar sesión?', icon:'question', showCancelButton:true, confirmButtonText:'Sí, salir', cancelButtonText:'Cancelar' });
  if (isConfirmed) await signOut(auth);
};

/* ─── USER INFO TOPBAR ─── */
function renderUserInfo() {
  const el = document.getElementById('user-info-topbar');
  if (!el || !window.currentUser) return;
  const u = window.currentUser;
  const c = u.rol === 'admin' ? '#f5a623' : '#00d4ff';
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;">
      <div style="text-align:right;line-height:1.3;">
        <div style="font-size:12px;font-weight:800;color:#fff;white-space:nowrap;">${u.nombre.split(' ')[0]}</div>
        <div style="font-size:9.5px;font-weight:700;color:${c};text-transform:uppercase;letter-spacing:.7px;">${u.rol==='admin'?'Admin':'Contadora'}</div>
      </div>
      <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,${c},#0b1640);border:2px solid ${c};display:flex;align-items:center;justify-content:center;font-size:15px;" title="${u.nombre}">${u.rol==='admin'?'👨‍💼':'👩‍💼'}</div>
      <button onclick="doLogout()" style="background:rgba(255,64,64,0.15);border:1px solid rgba(255,64,64,0.3);color:#ff4040;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;">Salir</button>
    </div>`;
}

/* ─── FIRESTORE LOAD ─── */
async function loadAllFromFirestore() {
  const cols = ['clients','tasks','absences','appointments'];
  await Promise.all(cols.map(async col => {
    const snap = await getDocs(collection(db, col));
    window.__DB_CACHE[col] = snap.docs.map(d => {
      const data = d.data();
      Object.keys(data).forEach(k => { if (data[k]?.toDate) data[k] = data[k].toDate().toISOString(); });
      return { ...data, id: d.id };
    });
  }));
  const m = localStorage.getItem('sinergia_rea_meta');
  if (m) window.__DB_CACHE.meta = JSON.parse(m);
  console.log('[Firebase] Datos:', window.__DB_CACHE.clients.length,'clientes,', window.__DB_CACHE.tasks.length,'tareas');
}

/* ─── CRUD ─── */
window.dbGet = e => window.__DB_CACHE[e] || [];
window.getDB = () => window.__DB_CACHE;
window.saveDB = obj => { if(obj?.meta){ window.__DB_CACHE.meta=obj.meta; localStorage.setItem('sinergia_rea_meta',JSON.stringify(obj.meta)); } };

window.dbCreate = async function(entity, obj) {
  obj.createdAt = new Date().toISOString();
  obj.updatedBy = window.currentUser?.nombre || 'Sistema';
  obj.updatedAt = obj.createdAt;
  const clean = {}; Object.keys(obj).forEach(k => { if(obj[k]!==undefined) clean[k]=obj[k]; });
  try {
    const ref = await addDoc(collection(db, entity), clean);
    const n = { ...clean, id: ref.id };
    window.__DB_CACHE[entity].push(n); return n;
  } catch(e) { Swal.fire('Error','No se pudo guardar.','error'); throw e; }
};

window.dbUpdate = async function(entity, id, changes) {
  changes.updatedBy = window.currentUser?.nombre || 'Sistema';
  changes.updatedAt = new Date().toISOString();
  const clean = {}; Object.keys(changes).forEach(k => { if(changes[k]!==undefined) clean[k]=changes[k]!==null?changes[k]:''; });
  try {
    await updateDoc(doc(db, entity, id), clean);
    const i = window.__DB_CACHE[entity].findIndex(x => x.id===id);
    if(i!==-1) window.__DB_CACHE[entity][i] = { ...window.__DB_CACHE[entity][i], ...changes };
  } catch(e) { Swal.fire('Error','No se pudo actualizar.','error'); throw e; }
};

window.dbDelete = async function(entity, id) {
  try {
    await deleteDoc(doc(db, entity, id));
    window.__DB_CACHE[entity] = window.__DB_CACHE[entity].filter(x => x.id!==id);
  } catch(e) { Swal.fire('Error','No se pudo eliminar.','error'); throw e; }
};

window.deleteClientCascade = async function(clientId) {
  const batch = writeBatch(db);
  ['tasks','absences','appointments'].forEach(col => {
    window.__DB_CACHE[col].filter(x=>x.clientId===clientId).forEach(x=>batch.delete(doc(db,col,x.id)));
  });
  batch.delete(doc(db,'clients',clientId));
  await batch.commit();
  ['tasks','absences','appointments'].forEach(col => { window.__DB_CACHE[col]=window.__DB_CACHE[col].filter(x=>x.clientId!==clientId); });
  window.__DB_CACHE.clients = window.__DB_CACHE.clients.filter(x=>x.id!==clientId);
};

/* ─── LOADING ─── */
function showLoadingScreen(msg='Conectando...') {
  if(document.getElementById('firebase-loading')) return;
  const d=document.createElement('div'); d.id='firebase-loading';
  d.style.cssText='position:fixed;inset:0;z-index:9998;background:linear-gradient(135deg,#070e30,#0b1640);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;';
  d.innerHTML=`<div style="font-family:'DM Serif Display',serif;font-size:28px;color:#f5a623;">Sinergia <span style="color:#fff">REA</span></div><div style="width:48px;height:48px;border:3px solid rgba(245,166,35,0.2);border-top-color:#f5a623;border-radius:50%;animation:spin .8s linear infinite"></div><div style="font-size:13px;color:rgba(180,200,255,0.6);font-family:sans-serif;font-weight:600">${msg}</div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;
  document.body.appendChild(d);
}
function hideLoadingScreen() {
  const el=document.getElementById('firebase-loading');
  if(el){el.style.transition='opacity .4s';el.style.opacity='0';setTimeout(()=>el.remove(),400);}
}

/* ─── BOOTSTRAP ─── */
window.firebaseBootstrap = function() {
  showLoadingScreen('Verificando sesión...');
  onAuthStateChanged(auth, async user => {
    if (user) {
      const info = USUARIOS[user.email];
      if (!info) { await signOut(auth); hideLoadingScreen(); Swal.fire('Acceso denegado','Este correo no está autorizado.','error'); showLoginScreen(); return; }
      window.currentUser = { ...info, email: user.email, uid: user.uid };
      document.getElementById('login-screen')?.remove();
      const s=document.getElementById('sidebar'); const m=document.querySelector('.main');
      if(s) s.style.display=''; if(m) m.style.display='';
      showLoadingScreen('Cargando datos...');
      try {
        await loadAllFromFirestore();
        hideLoadingScreen(); renderUserInfo();
        if(typeof init==='function') init();
        /* ── Iniciar FCM push notifications ── */
        initFCM();
      } catch(e) {
        hideLoadingScreen();
        Swal.fire({icon:'error',title:'Error de conexión',html:'No se pudo conectar a Firestore.<br>Verifica las reglas de seguridad.',confirmButtonText:'Reintentar'}).then(()=>location.reload());
      }
    } else {
      hideLoadingScreen();
      document.getElementById('sidebar') && (document.getElementById('sidebar').style.display='none');
      document.querySelector('.main') && (document.querySelector('.main').style.display='none');
      showLoginScreen();
    }
  });
};

/* ================================================================
   FCM — Firebase Cloud Messaging
   Push notifications reales (app abierta, minimizada o cerrada).

   🔒 SEGURIDAD:
   - El token FCM se guarda en Firestore bajo /fcm_tokens/{uid}
     accesible SOLO por el usuario autenticado (Firestore Rules).
   - La VAPID Key es pública por diseño (no es un secreto).
   - Nunca se expone información sensible en el payload push.
   - Se registra el Service Worker SOLO desde el mismo origen.
   ================================================================ */

const FCM_VAPID_KEY = 'BFiq3KgzB5bV_6LhAY6I7t3YumlJ0djo7_R97iMuDZcr_XtXT39-Oxfskv-V7c0WArZLuFe_lgyi0WWaABNFWIo';

async function initFCM() {
  /* 1. Verificar soporte del navegador */
  if (!('serviceWorker' in navigator) || !('Notification' in window)) {
    console.warn('[FCM] Este navegador no soporta push notifications.');
    return;
  }

  try {
    /* 2. Registrar el Service Worker desde la raíz del proyecto */
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    });
    console.log('[FCM] Service Worker registrado:', swReg.scope);

    /* 3. Pedir permiso de notificaciones al usuario (solo 1 vez) */
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[FCM] Permiso de notificaciones denegado.');
      return;
    }

    /* 4. Obtener token FCM vinculado a este dispositivo */
    const token = await getToken(messaging, {
      vapidKey:            FCM_VAPID_KEY,
      serviceWorkerRegistration: swReg
    });

    if (!token) {
      console.warn('[FCM] No se pudo obtener token FCM.');
      return;
    }

    console.log('[FCM] Token obtenido:', token.substring(0, 20) + '...');

    /* 5. Guardar token en Firestore bajo el UID del usuario autenticado.
          Esto permite enviar notificaciones desde Firebase Console
          o Cloud Functions directamente a este dispositivo/usuario.
          🔒 Las Firestore Rules deben permitir write SOLO a auth.uid === uid */
    const uid = window.currentUser?.uid;
    if (uid) {
      await updateDoc(doc(db, 'fcm_tokens', uid), { token, updatedAt: new Date().toISOString() })
        .catch(async () => {
          /* Si el documento no existe aún, lo creamos */
          const { setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
          await setDoc(doc(db, 'fcm_tokens', uid), {
            token,
            email:     window.currentUser.email,
            nombre:    window.currentUser.nombre,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        });
      console.log('[FCM] Token guardado en Firestore para UID:', uid);
    }

    /* 6. Manejar notificaciones cuando la app está en PRIMER PLANO
          (el Service Worker las maneja cuando está en background) */
    onMessage(messaging, payload => {
      console.log('[FCM] Mensaje en foreground:', payload);

      const title = payload.notification?.title || '🔔 Sinergia REA';
      const body  = payload.notification?.body  || 'Tienes una alerta pendiente';

      /* Mostrar como notificación nativa del sistema si el permiso lo permite */
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/icon-192.png',
          tag:  'sinergia-rea-foreground'
        });
      }

      /* Además reproducir el sonido de advertencia existente en la app */
      if (typeof playAlertSound === 'function') {
        playAlertSound();
      }
    });

  } catch (err) {
    /* FCM no es crítico — si falla, el resto de la app sigue funcionando */
    console.error('[FCM] Error al inicializar:', err.message);
  }
}
