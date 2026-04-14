/* ================================================================
   SINERGIA REA — porcentaje.utils.js
   Responsabilidad: Calcular estado y porcentaje de declaraciones.
   SRP: Solo lógica de cálculo. No toca Firebase ni DOM.

   Reglas de negocio:
     - COMPLETO:   todos los checks marcados
     - EN ESPERA:  "enEspera" marcado (prioridad sobre COMPLETO)
     - INACTIVO:   cliente marcado como inactivo en el despacho
     - PENDIENTE:  cualquier otro caso
   ================================================================ */

/**
 * Definición de los 3 checks de una declaración.
 * Agregar o quitar checks aquí se propaga automáticamente.
 */
export const CHECKS_RESICO = [
  { key: 'resumen',   label: 'Resumen'     },
  { key: 'facturas',  label: 'Facturas'    },
  { key: 'diotOvh',   label: 'DIOT / OVH'  }
];

export const CHECKS_SUELDOS = [
  { key: 'resumen',   label: 'Resumen'     },
  { key: 'cfdi',      label: 'CFDI Nómina' },
  { key: 'imss',      label: 'IMSS / SUA'  }
];

/**
 * Calcula el estado y porcentaje de avance de una declaración.
 *
 * @param {Object} checks      - { resumen: bool, facturas: bool, diotOvh: bool, enEspera: bool }
 * @param {Array}  checksDef   - Array de definición de checks (CHECKS_RESICO o CHECKS_SUELDOS)
 * @param {string} [clienteStatus] - 'active' | 'inactive' — estado del cliente en el despacho
 * @returns {{ estado: string, porcentaje: number, completados: number, total: number }}
 */
export function calcularEstado(checks = {}, checksDef = CHECKS_RESICO, clienteStatus = 'active') {
  // Cliente inactivo en el despacho → siempre INACTIVO
  if (clienteStatus === 'inactive') {
    return { estado: 'INACTIVO', porcentaje: 0, completados: 0, total: checksDef.length };
  }

  const total       = checksDef.length;
  const completados = checksDef.filter(c => !!checks[c.key]).length;
  const porcentaje  = Math.round((completados / total) * 100);

  // Regla: Si está 100% completo → COMPLETO (prioridad sobre EN ESPERA)
  let estado = 'PENDIENTE';
  if (completados === total)      estado = 'COMPLETO';
  else if (checks.enEspera)       estado = 'EN ESPERA';

  return { estado, porcentaje, completados, total };
}

/**
 * Retorna la clase CSS y el color para el badge de estado.
 * @param {string} estado - 'COMPLETO' | 'PENDIENTE' | 'EN ESPERA' | 'INACTIVO'
 * @returns {{ cls: string, color: string, icon: string }}
 */
export function estadoMeta(estado) {
  switch (estado) {
    case 'COMPLETO':  return { cls: 'estado-completo',  color: '#16a34a', bg: 'rgba(22,163,74,0.12)',   icon: '✅' };
    case 'EN ESPERA': return { cls: 'estado-espera',    color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  icon: '⏸️' };
    case 'INACTIVO':  return { cls: 'estado-inactivo',  color: '#6b7280', bg: 'rgba(107,114,128,0.12)', icon: '🔴' };
    default:          return { cls: 'estado-pendiente', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: '⏳' };
  }
}

/**
 * Retorna el color de la barra de progreso según el porcentaje.
 * @param {number} pct - 0 a 100
 * @returns {string} Color CSS
 */
export function colorProgreso(pct) {
  if (pct === 100) return '#16a34a';  // verde
  if (pct >= 50)  return '#f59e0b';   // dorado
  return '#ef4444';                    // rojo
}
