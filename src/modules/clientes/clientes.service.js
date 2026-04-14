/* ================================================================
   SINERGIA REA — clientes.service.js
   Responsabilidad: Acceso a datos de clientes con campos SAT.
   SRP: Solo maneja clientes. No toca UI ni declaraciones.

   Extiende el sistema existente: los clientes del caché __DB_CACHE
   ahora pueden incluir: regimenFiscal, giro, razonSocial.

   Para NO romper el código existente, este servicio trabaja sobre
   el mismo window.__DB_CACHE que ya usa app.js.
   ================================================================ */

/**
 * Retorna todos los clientes del caché global.
 * Alias limpio de window.dbGet('clients').
 *
 * @returns {Object[]} Array de clientes
 */
export function obtenerClientes() {
  return window.dbGet('clients') || [];
}

/**
 * Filtra clientes por código de régimen fiscal.
 * Ejemplo: obtenerClientesPorRegimen('626') → lista RESICO
 *
 * @param {string} clave - Clave del régimen (ej: '626', '605')
 * @returns {Object[]}
 */
export function obtenerClientesPorRegimen(clave) {
  const todos = obtenerClientes();
  return todos.filter(c => {
    // Soporte para régimen como string o como array (cliente con 2 regímenes)
    if (Array.isArray(c.regimenFiscal)) {
      return c.regimenFiscal.includes(clave);
    }
    return c.regimenFiscal === clave;
  });
}

/**
 * Retorna el nombre de un cliente por su ID.
 * @param {string} id
 * @returns {string}
 */
export function getNombreCliente(id) {
  const c = obtenerClientes().find(x => x.id === id);
  return c?.name || c?.nombre || 'Desconocido';
}

/**
 * Retorna el nombre del régimen fiscal por su clave.
 * Busca en el catálogo global window.REGIMENES_SAT.
 *
 * @param {string} clave - "626"
 * @returns {string} Nombre del régimen o la clave si no se encuentra
 */
export function getNombreRegimen(clave) {
  const r = (window.REGIMENES_SAT || []).find(x => x.clave === clave);
  return r ? `${r.clave} — ${r.nombre}` : clave;
}

/**
 * Retorna el nombre del giro empresarial por su ID.
 * @param {string} giroId
 * @returns {string}
 */
export function getNombreGiro(giroId) {
  const g = (window.GIROS_EMPRESARIALES || []).find(x => x.id === giroId);
  return g ? `${g.nombre} (IVA: ${g.iva})` : giroId;
}

/**
 * Crea un nuevo cliente con campos SAT.
 * Delega a window.dbCreate que maneja Firestore + caché.
 *
 * @param {Object} datos
 * @param {string} datos.name          - Nombre del cliente
 * @param {string} datos.businessName  - Razón social
 * @param {string} datos.regimenFiscal - Clave "626", "605", etc.
 * @param {string} datos.giro          - ID de giro empresarial
 * @param {string} [datos.phone]
 * @param {string} [datos.email]
 * @param {string} [datos.status]      - "active" | "inactive"
 * @returns {Promise<Object>} Cliente creado con id
 */
export async function crearCliente(datos) {
  return window.dbCreate('clients', {
    name:          datos.name,
    businessName:  datos.businessName  || '',
    regimenFiscal: datos.regimenFiscal || '',
    giro:          datos.giro          || '',
    phone:         datos.phone         || '',
    email:         datos.email         || '',
    status:        datos.status        || 'active'
  });
}

/**
 * Actualiza un cliente existente.
 * @param {string} id
 * @param {Object} cambios
 * @returns {Promise<void>}
 */
export async function actualizarCliente(id, cambios) {
  return window.dbUpdate('clients', id, cambios);
}

/**
 * Elimina un cliente y todos sus registros relacionados en cascada.
 * Usa window.deleteClientCascade que ya maneja el batch en Firestore.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function eliminarCliente(id) {
  return window.deleteClientCascade(id);
}
