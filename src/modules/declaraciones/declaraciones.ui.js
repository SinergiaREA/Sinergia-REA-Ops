/* ================================================================
   SINERGIA REA — declaraciones.ui.js
   Responsabilidad: Renderizado de la vista "Declaraciones SAT".
   SRP: Solo manipula el DOM de la vista de declaraciones.
        No escribe en Firestore directamente (lo delega al service).

   CAMBIO v2: Integra el catálogo estático del Excel como fallback.
   Si Firestore no tiene clientes con regimenFiscal '626', se usan
   los 25 clientes del Excel fusionados con los de Firestore.
   ================================================================ */

import { obtenerClientesPorRegimen } from '../clientes/clientes.service.js';
import {
  obtenerPeriodos,
  crearPeriodoSiNoExiste,
  obtenerMapaDeclaraciones,
  guardarDeclaracion
} from './declaraciones.service.js';
import {
  CHECKS_RESICO,
  CHECKS_SUELDOS,
  calcularEstado,
  estadoMeta,
  colorProgreso
} from '../../utils/porcentaje.utils.js';
import { obtenerPeriodoActual, periodoLabel, siguientePeriodo } from '../../utils/date.utils.js';
import {
  CLIENTES_RESICO_EXCEL,
  CLIENTES_SUELDOS_EXCEL,
  fusionarClientes
} from './clientes-resico.catalog.js';

/* ── Estado local de la vista ── */
let periodoActivo  = '';          // "2026-03"
let subvistaActiva = 'resico';   // "resico" | "sueldos"

/* ── Caché en memoria para no recargar Firestore en cada checkbox ── */
let mapaDeclaraciones = {};      // { clienteId: declaracionObj }

/* ── Lista activa fusionada (Firestore + Excel) ── */
let clientesActivos = [];        // se rellena en cargarSubvista

/* ================================================================
   PUNTO DE ENTRADA
   ================================================================ */

export async function initDeclaracionesView() {
  const contenedor = document.getElementById('view-declaraciones');
  if (!contenedor) return;

  contenedor.innerHTML = buildLoader('Cargando declaraciones...');

  try {
    periodoActivo = obtenerPeriodoActual();
    await crearPeriodoSiNoExiste(periodoActivo);

    const periodos = await obtenerPeriodos();
    contenedor.innerHTML = buildVistaHTML(periodos);
    await cargarSubvista(subvistaActiva);

  } catch (err) {
    console.error('[declaraciones.ui] Error al inicializar:', err);
    contenedor.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">Error al cargar declaraciones</div>
        <div class="empty-sub">${err.message}</div>
      </div>`;
  }
}

/* ================================================================
   HTML PRINCIPAL
   ================================================================ */

function buildVistaHTML(periodos) {
  const opcionesPeriodo = periodos.map(p =>
    `<option value="${p}" ${p === periodoActivo ? 'selected' : ''}>${periodoLabel(p)}</option>`
  ).join('');

  return `
    <div class="section-header">
      <div>
        <div class="section-title">Declaraciones Mensuales SAT</div>
        <div class="section-subtitle">
          Control de avance por cliente y período · Régimen RESICO y Sueldos &amp; Salarios
        </div>
      </div>
      <button class="btn-secondary" onclick="window.__decl_crearSiguientePeriodo()">
        ＋ Nuevo periodo
      </button>
    </div>

    <div class="decl-toolbar">
      <div class="decl-periodo-wrap">
        <label class="decl-label">Período</label>
        <select
          id="decl-periodo-select"
          class="filter-select"
          onchange="window.__decl_cambiarPeriodo(this.value)">
          ${opcionesPeriodo}
        </select>
      </div>

      <div class="decl-tabs">
        <button
          id="tab-resico"
          class="decl-tab ${subvistaActiva === 'resico' ? 'active' : ''}"
          onclick="window.__decl_cambiarTab('resico')">
          🏛️ RESICO (626)
        </button>
        <button
          id="tab-sueldos"
          class="decl-tab ${subvistaActiva === 'sueldos' ? 'active' : ''}"
          onclick="window.__decl_cambiarTab('sueldos')">
          💼 Sueldos y Salarios (605)
        </button>
      </div>
    </div>

    <div id="decl-resumen-bar"></div>
    <div id="decl-tabla-container">${buildLoader('Cargando clientes...')}</div>
  `;
}

/* ================================================================
   CARGA DE TABLA — con fusión Excel + Firestore
   ================================================================ */

async function cargarSubvista(tipo) {
  const contenedor = document.getElementById('decl-tabla-container');
  if (!contenedor) return;
  contenedor.innerHTML = buildLoader('Cargando clientes...');

  const claveSAT  = tipo === 'resico' ? '626' : '605';
  const checksDef = tipo === 'resico' ? CHECKS_RESICO : CHECKS_SUELDOS;
  const catalogoExcel = tipo === 'resico' ? CLIENTES_RESICO_EXCEL : CLIENTES_SUELDOS_EXCEL;

  // 1. Clientes de Firestore con el régimen correcto
  const clientesFirestore = obtenerClientesPorRegimen(claveSAT);

  // 2. Fusionar con el catálogo Excel (sin duplicar por RFC)
  clientesActivos = fusionarClientes(clientesFirestore, catalogoExcel);

  // 3. Cargar declaraciones guardadas en Firestore para este periodo
  mapaDeclaraciones = await obtenerMapaDeclaraciones(periodoActivo, tipo);

  if (!clientesActivos.length) {
    contenedor.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👤</div>
        <div class="empty-title">Sin clientes con régimen ${claveSAT}</div>
        <div class="empty-sub">No hay clientes registrados para este régimen.</div>
      </div>`;
    renderResumenBar([], checksDef);
    return;
  }

  // 4. Construir filas calculando estado por cliente
  const filas = clientesActivos.map(c => {
    const decl   = mapaDeclaraciones[c.id] || {};
    const checks = decl.checks || {};
    const { estado, porcentaje } = calcularEstado(checks, checksDef);
    return { cliente: c, checks, estado, porcentaje };
  });

  contenedor.innerHTML = buildTablaHTML(filas, checksDef, tipo);
  renderResumenBar(filas, checksDef);
}

/* ================================================================
   TABLA HTML
   ================================================================ */

function buildTablaHTML(filas, checksDef, tipo) {
  const thChecks = checksDef.map(c =>
    `<th style="text-align:center;min-width:90px">${c.label}</th>`
  ).join('');

  const trRows = filas.map(({ cliente, checks, estado, porcentaje }) => {
    const meta     = estadoMeta(estado);
    const barColor = colorProgreso(porcentaje);

    const tdChecks = checksDef.map(c => `
      <td style="text-align:center;">
        <input
          type="checkbox"
          class="decl-check"
          data-cliente="${cliente.id}"
          data-check="${c.key}"
          data-tipo="${tipo}"
          ${checks[c.key] ? 'checked' : ''}
          onchange="window.__decl_onCheck(this)"
          title="${c.label}">
      </td>`
    ).join('');

    // Indicador de fuente: "EXCEL" badge si viene del catálogo
    const fuenteBadge = cliente.fuente === 'excel'
      ? `<span style="
           font-size:9px;font-weight:700;letter-spacing:.5px;
           background:rgba(99,102,241,0.15);color:#6366f1;
           padding:1px 5px;border-radius:3px;margin-left:4px;
           vertical-align:middle">EXCEL</span>`
      : '';

    // RFC subtítulo
    const rfcLine = cliente.rfc
      ? `<div style="font-size:10px;color:var(--text-muted);letter-spacing:.3px">${cliente.rfc}</div>`
      : '';

    // Giro subtítulo
    const giroLine = cliente.giro
      ? `<div style="font-size:10px;color:var(--text-muted)">${cliente.giro}</div>`
      : '';

    return `
      <tr id="decl-row-${cliente.id}" style="${estado === 'BAJA' ? 'opacity:.6' : ''}">
        <td>
          <div style="font-weight:600;font-size:13px">
            ${cliente.name || cliente.nombre}${fuenteBadge}
          </div>
          ${rfcLine}
          ${giroLine}
        </td>
        ${tdChecks}
        <td style="min-width:140px">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="flex:1;height:6px;background:rgba(26,35,126,0.1);border-radius:3px;overflow:hidden;">
              <div class="decl-progress-fill"
                style="width:${porcentaje}%;height:100%;background:${barColor};border-radius:3px;transition:width .3s;"></div>
            </div>
            <span style="font-size:11px;font-weight:700;color:${barColor};min-width:30px">${porcentaje}%</span>
          </div>
        </td>
        <td>
          <span class="decl-badge-estado" style="
            display:inline-flex;align-items:center;gap:4px;
            padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;
            background:${meta.bg};color:${meta.color};">
            ${meta.icon} ${estado}
          </span>
        </td>
      </tr>`;
  }).join('');

  return `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Cliente</th>
            ${thChecks}
            <th style="min-width:160px">Avance</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>${trRows}</tbody>
      </table>
    </div>`;
}

/* ================================================================
   RESUMEN BAR
   ================================================================ */

function renderResumenBar(filas, checksDef) {
  const el = document.getElementById('decl-resumen-bar');
  if (!el) return;
  if (!filas.length) { el.innerHTML = ''; return; }

  const total      = filas.length;
  const completos  = filas.filter(f => f.estado === 'COMPLETO').length;
  const bajas      = filas.filter(f => f.estado === 'BAJA').length;
  const pendientes = total - completos - bajas;
  const pctGlobal  = Math.round((completos / total) * 100);

  el.innerHTML = `
    <div class="decl-resumen-bar">
      <div class="decl-resumen-stat">
        <span style="color:#16a34a;font-size:18px;font-weight:800">${completos}</span>
        <span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">Completos</span>
      </div>
      <div class="decl-divider"></div>
      <div class="decl-resumen-stat">
        <span style="color:#f59e0b;font-size:18px;font-weight:800">${pendientes}</span>
        <span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">Pendientes</span>
      </div>
      <div class="decl-divider"></div>
      <div class="decl-resumen-stat">
        <span style="color:#6b7280;font-size:18px;font-weight:800">${bajas}</span>
        <span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">En espera</span>
      </div>
      <div class="decl-divider"></div>
      <div class="decl-resumen-stat" style="flex-direction:row;gap:10px;align-items:center;">
        <div style="flex:1;max-width:120px;height:8px;background:rgba(26,35,126,0.1);border-radius:4px;overflow:hidden;">
          <div style="width:${pctGlobal}%;height:100%;background:${colorProgreso(pctGlobal)};border-radius:4px;transition:width .4s;"></div>
        </div>
        <span style="font-size:15px;font-weight:800;color:var(--brand-navy)">${pctGlobal}% global</span>
      </div>
    </div>`;
}

/* ================================================================
   HANDLERS WINDOW.__
   ================================================================ */

window.__decl_onCheck = async function(el) {
  const clienteId = el.dataset.cliente;
  const checkKey  = el.dataset.check;
  const tipo      = el.dataset.tipo;
  const checksDef = tipo === 'resico' ? CHECKS_RESICO : CHECKS_SUELDOS;

  if (!mapaDeclaraciones[clienteId])        mapaDeclaraciones[clienteId] = { checks: {} };
  if (!mapaDeclaraciones[clienteId].checks) mapaDeclaraciones[clienteId].checks = {};
  mapaDeclaraciones[clienteId].checks[checkKey] = el.checked;

  const checks = mapaDeclaraciones[clienteId].checks;
  const { estado, porcentaje } = calcularEstado(checks, checksDef);

  // Guardar en Firestore (no bloqueante)
  guardarDeclaracion({
    clienteId, periodo: periodoActivo, tipo, checks, estado, porcentaje
  }).catch(err => {
    console.error('[declaraciones.ui] Error al guardar:', err);
    el.checked = !el.checked;
    mapaDeclaraciones[clienteId].checks[checkKey] = el.checked;
    window.toast && window.toast('Error al guardar. Intenta de nuevo.', 'error');
  });

  // Actualizar DOM inmediatamente
  actualizarFilaDOM(clienteId, checks, estado, porcentaje, checksDef);

  // Refrescar barra de resumen usando clientesActivos (ya incluye Excel)
  const filas = clientesActivos.map(c => {
    const d  = mapaDeclaraciones[c.id] || {};
    const ch = d.checks || {};
    const { estado: est, porcentaje: pct } = calcularEstado(ch, checksDef);
    return { estado: est, porcentaje: pct };
  });
  renderResumenBar(filas, checksDef);
};

function actualizarFilaDOM(clienteId, checks, estado, porcentaje, checksDef) {
  const row = document.getElementById(`decl-row-${clienteId}`);
  if (!row) return;

  const meta     = estadoMeta(estado);
  const barColor = colorProgreso(porcentaje);

  const fill = row.querySelector('.decl-progress-fill');
  if (fill) { fill.style.width = `${porcentaje}%`; fill.style.background = barColor; }

  const badge = row.querySelector('.decl-badge-estado');
  if (badge) {
    badge.textContent      = `${meta.icon} ${estado}`;
    badge.style.color      = meta.color;
    badge.style.background = meta.bg;
  }

  // Opacidad si pasa a BAJA
  row.style.opacity = estado === 'BAJA' ? '0.6' : '1';
}

window.__decl_cambiarPeriodo = async function(nuevoPeriodo) {
  periodoActivo = nuevoPeriodo;
  await cargarSubvista(subvistaActiva);
};

window.__decl_cambiarTab = async function(nuevoTipo) {
  subvistaActiva = nuevoTipo;
  document.querySelectorAll('.decl-tab').forEach(t => t.classList.remove('active'));
  const tabEl = document.getElementById(`tab-${nuevoTipo}`);
  if (tabEl) tabEl.classList.add('active');
  await cargarSubvista(nuevoTipo);
};

window.__decl_crearSiguientePeriodo = async function() {
  const periodos  = await obtenerPeriodos();
  const ultimo    = periodos.sort().pop() || periodoActivo;
  const siguiente = siguientePeriodo(ultimo);
  const actual    = obtenerPeriodoActual();

  if (siguiente > actual) {
    Swal.fire({
      icon:  'info',
      title: 'Sin periodo nuevo disponible',
      text:  `El próximo periodo (${periodoLabel(siguiente)}) aún no corresponde declarar.`
    });
    return;
  }

  await crearPeriodoSiNoExiste(siguiente);
  periodoActivo = siguiente;
  const periodosFinal = await obtenerPeriodos();
  const contenedor    = document.getElementById('view-declaraciones');
  if (contenedor) contenedor.innerHTML = buildVistaHTML(periodosFinal);
  const sel = document.getElementById('decl-periodo-select');
  if (sel) sel.value = siguiente;
  await cargarSubvista(subvistaActiva);
  window.toast && window.toast(`Período ${periodoLabel(siguiente)} creado`, 'success');
};

/* ================================================================
   HELPERS
   ================================================================ */

function buildLoader(msg = 'Cargando...') {
  return `
    <div class="empty-state" style="padding:48px">
      <div style="font-size:28px;margin-bottom:12px">⏳</div>
      <div style="font-size:14px;color:var(--text-muted)">${msg}</div>
    </div>`;
}

export { cargarSubvista };
