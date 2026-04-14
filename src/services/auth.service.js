/* ================================================================
   SINERGIA REA — auth.service.js
   Responsabilidad: Abstracción de Firebase Authentication.
   SRP: Solo maneja identidad y sesión. No toca UI ni datos.

   Expone funciones puras. La UI los llama, no al auth de Firebase
   directamente. Esto facilita migrar a otro proveedor si fuera necesario.
   ================================================================ */

/**
 * Retorna el usuario actualmente logueado.
 * Viene del objeto window.currentUser que inyecta firebase.js.
 *
 * @returns {{ nombre: string, email: string, rol: string, uid: string } | null}
 */
export function getUsuarioActual() {
  return window.currentUser || null;
}

/**
 * Retorna el email del usuario actual para auditoría.
 * @returns {string}
 */
export function getEmailActual() {
  return window.currentUser?.email || 'sistema';
}

/**
 * Retorna el nombre del usuario actual para auditoría.
 * @returns {string}
 */
export function getNombreActual() {
  return window.currentUser?.nombre || 'Sistema';
}

/**
 * Retorna true si hay un usuario autenticado.
 * @returns {boolean}
 */
export function estaAutenticado() {
  return !!window.currentUser;
}

/**
 * Retorna true si el usuario tiene rol de admin.
 * @returns {boolean}
 */
export function esAdmin() {
  return window.currentUser?.rol === 'admin';
}
