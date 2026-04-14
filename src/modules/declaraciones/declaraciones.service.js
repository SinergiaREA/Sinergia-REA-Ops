/* ================================================================
   SINERGIA REA — declaraciones.service.js
   Responsabilidad: Acceso a datos de declaraciones en Firestore.
   SRP: Solo lee y escribe en Firestore. No toca DOM ni calcula UI.

   Colección Firestore: "declaraciones"
   Subcolección de periodos: "periodos" (metadatos)

   Estructura de un documento declaracion:
   {
     clienteId:    string,     // ID del cliente en Firestore
     periodo:      string,     // "2026-03"
     tipo:         string,     // "resico" | "sueldos"
     checks:       object,     // { resumen, facturas, diotOvh, enEspera }
     estado:       string,     // "COMPLETO" | "PENDIENTE" | "BAJA"
     porcentaje:   number,     // 0-100
     updatedAt:    string,     // ISO timestamp
     updatedBy:    string,     // email del usuario
   }

   Estructura de un documento periodo:
   {
     periodo:      string,     // "2026-03"
     creadoEn:     string,     // ISO timestamp
     creadoPor:    string,     // email
   }
   ================================================================ */

import {
  getFirestore,
  collection, doc,
  getDocs, getDoc,
  setDoc, updateDoc,
  query, where,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

import { getEmailActual, getNombreActual } from '../../services/auth.service.js';
import { ahora } from '../../utils/date.utils.js';

/* ── Referencia a Firestore (usa la misma instancia de firebase.js) ── */
// Nota: firebase.js ya llama initializeApp y getFirestore.
// Accedemos a la instancia global expuesta por firebase.js via window.__firebaseApp
// Si no está disponible, la creamos lazy.

function getDB() {
  // firebase.js expone window.__firebaseDb para módulos externos
  if (window.__firebaseDb) return window.__firebaseDb;
  throw new Error('[declaraciones.service] Firestore no inicializado. Verifica firebase.js.');
}

/* ================================================================
   PERIODOS
   ================================================================ */

/**
 * Obtiene todos los periodos existentes en Firestore.
 * Ordenados cronológicamente (el formato YYYY-MM permite orden lexicográfico).
 *
 * @returns {Promise<string[]>} Array de periodos ["2026-03","2026-04",...]
 */
export async function obtenerPeriodos() {
  const snap = await getDocs(collection(getDB(), 'periodos'));
  const periodos = snap.docs.map(d => d.id).sort();  // doc ID = "2026-03"
  return periodos;
}

/**
 * Crea un periodo en Firestore si no existe.
 * Idempotente: llamarlo dos veces con el mismo periodo no crea duplicados.
 *
 * @param {string} periodo - "YYYY-MM"
 * @returns {Promise<void>}
 */
export async function crearPeriodoSiNoExiste(periodo) {
  const ref = doc(getDB(), 'periodos', periodo);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      periodo,
      creadoEn:  ahora(),
      creadoPor: getEmailActual()
    });
    console.log(`[declaraciones.service] Periodo creado: ${periodo}`);
  }
}

/* ================================================================
   DECLARACIONES
   ================================================================ */

/**
 * Construye el ID único de un documento de declaración.
 * Formato: "{clienteId}_{periodo}_{tipo}"
 * Ejemplo: "abc123_2026-03_resico"
 * Esto permite hacer upsert con setDoc sin buscar primero.
 *
 * @param {string} clienteId
 * @param {string} periodo
 * @param {string} tipo
 * @returns {string}
 */
export function buildDeclaracionId(clienteId, periodo, tipo) {
  return `${clienteId}_${periodo}_${tipo}`;
}

/**
 * Obtiene todas las declaraciones de un periodo específico.
 *
 * @param {string} periodo - "YYYY-MM"
 * @returns {Promise<Object[]>} Array de declaraciones
 */
export async function obtenerDeclaracionesPorPeriodo(periodo) {
  const q    = query(
    collection(getDB(), 'declaraciones'),
    where('periodo', '==', periodo)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), _docId: d.id }));
}

/**
 * Guarda (upsert) una declaración en Firestore.
 * Usa setDoc con merge:true → crea si no existe, actualiza si existe.
 * Agrega automáticamente updatedAt y updatedBy (auditoría).
 *
 * @param {string} clienteId  - ID del cliente
 * @param {string} periodo    - "YYYY-MM"
 * @param {string} tipo       - "resico" | "sueldos"
 * @param {Object} checks     - { resumen, facturas, diotOvh, enEspera }
 * @param {string} estado     - "COMPLETO" | "PENDIENTE" | "BAJA"
 * @param {number} porcentaje - 0-100
 * @returns {Promise<void>}
 */
export async function guardarDeclaracion({ clienteId, periodo, tipo, checks, estado, porcentaje }) {
  const docId  = buildDeclaracionId(clienteId, periodo, tipo);
  const ref    = doc(getDB(), 'declaraciones', docId);

  await setDoc(ref, {
    clienteId,
    periodo,
    tipo,
    checks,
    estado,
    porcentaje,
    updatedAt: ahora(),
    updatedBy: getEmailActual()   // Auditoría: quién hizo el último cambio
  }, { merge: true });
}

/**
 * Retorna el mapa de declaraciones indexado por clienteId para un periodo y tipo.
 * Formato: { "clienteId1": declaracionObj, "clienteId2": declaracionObj }
 * Útil para la UI: acceso O(1) por clienteId al renderizar la tabla.
 *
 * @param {string} periodo
 * @param {string} tipo    - "resico" | "sueldos"
 * @returns {Promise<Object>} Mapa clienteId → declaración
 */
export async function obtenerMapaDeclaraciones(periodo, tipo) {
  const todas = await obtenerDeclaracionesPorPeriodo(periodo);
  const mapa  = {};
  todas
    .filter(d => d.tipo === tipo)
    .forEach(d => { mapa[d.clienteId] = d; });
  return mapa;
}
