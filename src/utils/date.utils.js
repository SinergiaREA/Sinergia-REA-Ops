/* ================================================================
   SINERGIA REA — date.utils.js
   Responsabilidad: Utilidades de fechas para lógica SAT.
   SRP: Solo maneja cálculos de fechas. No toca UI ni Firebase.

   Regla contable clave:
     Se trabaja el mes ANTERIOR al mes actual.
     Ejemplo: si hoy es abril → se declara marzo (2026-03)
   ================================================================ */

/** Nombres de meses en español, índice 0 = Enero */
export const MONTHS_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

/**
 * Retorna el periodo SAT activo según la fecha actual.
 * Regla contable: se trabaja el mes anterior.
 * Ejemplo: si hoy = abril 2026 → retorna "2026-03"
 *
 * @returns {string} Periodo en formato "YYYY-MM"
 */
export function obtenerPeriodoActual() {
  const hoy = new Date();
  // getMonth() → 0-11. Abril = 3.
  // El mes a declarar es el anterior: abril(3) → marzo(2) → mes=3 en 1-12
  let mes  = hoy.getMonth();       // 0-indexed. Usamos este como "mes a declarar" (es el anterior en 1-indexed)
  let anio = hoy.getFullYear();

  // Si estamos en enero (mes=0), el mes anterior es diciembre del año anterior
  if (mes === 0) {
    mes  = 12;
    anio = anio - 1;
  }
  // En cualquier otro mes, el "mes a declarar" es getMonth() (que en 1-indexed es getMonth())
  // Ejemplo: abril → getMonth()=3 → declaramos mes 3 = marzo ✓

  return `${anio}-${String(mes).padStart(2, '0')}`;
}

/**
 * Convierte un string "YYYY-MM" a un label legible.
 * Ejemplo: "2026-03" → "Marzo 2026"
 *
 * @param {string} periodo - "YYYY-MM"
 * @returns {string} Nombre legible
 */
export function periodoLabel(periodo) {
  if (!periodo) return '—';
  const [anio, mes] = periodo.split('-');
  return `${MONTHS_ES[parseInt(mes, 10) - 1]} ${anio}`;
}

/**
 * Genera el periodo siguiente a uno dado.
 * Ejemplo: "2026-03" → "2026-04"
 *
 * @param {string} periodo - "YYYY-MM"
 * @returns {string} Siguiente periodo "YYYY-MM"
 */
export function siguientePeriodo(periodo) {
  const [anio, mes] = periodo.split('-').map(Number);
  if (mes === 12) return `${anio + 1}-01`;
  return `${anio}-${String(mes + 1).padStart(2, '0')}`;
}

/**
 * Compara dos periodos. Retorna true si a es anterior a b.
 * @param {string} a - "YYYY-MM"
 * @param {string} b - "YYYY-MM"
 * @returns {boolean}
 */
export function periodoAnterior(a, b) {
  return a < b; // Funciona porque el formato "YYYY-MM" es lexicográficamente ordenable
}

/**
 * Formatea una fecha ISO a texto corto en español.
 * @param {string|Date} dateStr
 * @returns {string} "15 mar. 2026" o "—"
 */
export function fmtFecha(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

/**
 * Retorna un timestamp ISO de ahora.
 * @returns {string} ISO string
 */
export function ahora() {
  return new Date().toISOString();
}
