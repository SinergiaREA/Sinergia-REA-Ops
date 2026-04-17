/* ================================================================
   SINERGIA REA — declaraciones.ui.js  v3
   Cambios:
     - Estado "BAJA" renombrado a "EN ESPERA"
     - Tabla dividida: Pendientes arriba / Completos abajo (colapsable)
     - Botón Activar/Inactivar cliente por despacho
     - Botón "Agregar cliente RESICO" desde esta vista
     - Resumen bar actualizado con nuevos estados
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
let periodoActivo  = '';
let subvistaActiva = 'resico';

/* ── Caché en memoria ── */
let mapaDeclaraciones = {};

/* ── Lista activa fusionada (Firestore + Excel) ── */
let clientesActivos = [];

/* ── Estado local de activación por cliente (persistido en localStorage) ── */
function getEstadoClientes() {
  try { return JSON.parse(localStorage.getItem('sinergia_estado_clientes') || '{}'); }
  catch { return {}; }
}
function setEstadoCliente(id, status) {
  const m = getEstadoClientes();
  m[id] = status;
  localStorage.setItem('sinergia_estado_clientes', JSON.stringify(m));
}
function getClienteStatus(id) {
  return getEstadoClientes()[id] || 'active';
}

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
      <div style="display:flex;gap:8px;align-items:center;">
        <button class="btn-secondary" onclick="window.__decl_agregarClienteResico()" title="Agregar cliente RESICO">
          ➕ Nuevo cliente RESICO
        </button>
        <button class="btn-secondary" onclick="window.__decl_crearSiguientePeriodo()">
          📅 Nuevo periodo
        </button>
      </div>
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
        <button
          id="tab-reportes"
          class="decl-tab ${subvistaActiva === 'reportes' ? 'active' : ''}"
          onclick="window.__decl_cambiarTab('reportes')">
          📊 Completados & Inactivos
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

  // Si es la vista de reportes → mostrar completados e inactivos de ambos regímenes
  if (tipo === 'reportes') {
    await cargarReportes(contenedor);
    return;
  }

  const claveSAT      = tipo === 'resico' ? '626' : '605';
  const checksDef     = tipo === 'resico' ? CHECKS_RESICO : CHECKS_SUELDOS;
  const catalogoExcel = tipo === 'resico' ? CLIENTES_RESICO_EXCEL : CLIENTES_SUELDOS_EXCEL;

  const clientesFirestore = obtenerClientesPorRegimen(claveSAT);
  clientesActivos = fusionarClientes(clientesFirestore, catalogoExcel);
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

  // Calcular estado de cada cliente (incluyendo estado activo/inactivo del despacho)
  const filas = clientesActivos.map(c => {
    const decl         = mapaDeclaraciones[c.id] || {};
    const checks       = decl.checks || {};
    const clientStatus = getClienteStatus(c.id);
    const { estado, porcentaje } = calcularEstado(checks, checksDef, clientStatus);
    return { cliente: c, checks, estado, porcentaje, clientStatus };
  });

  contenedor.innerHTML = buildTablaHTML(filas, checksDef, tipo);
  renderResumenBar(filas, checksDef);
}

/* ================================================================
   TABLA HTML — con sección Completos separada
   ================================================================ */

function buildTablaHTML(filas, checksDef, tipo) {
  // Separar por grupo
  const pendientes = filas.filter(f => f.estado !== 'COMPLETO' && f.estado !== 'INACTIVO');
  const completos  = filas.filter(f => f.estado === 'COMPLETO');
  const inactivos  = filas.filter(f => f.estado === 'INACTIVO');

  const thChecks = checksDef.map(c =>
    `<th style="text-align:center;min-width:90px">${c.label}</th>`
  ).join('');

  function buildRows(lista) {
    return lista.map(({ cliente, checks, estado, porcentaje, clientStatus }) => {
      const meta     = estadoMeta(estado);
      const barColor = colorProgreso(porcentaje);
      const isInactive = clientStatus === 'inactive';

      const tdChecks = checksDef.map(c => `
        <td style="text-align:center;">
          <input
            type="checkbox"
            class="decl-check"
            data-cliente="${cliente.id}"
            data-check="${c.key}"
            data-tipo="${tipo}"
            ${checks[c.key] ? 'checked' : ''}
            ${isInactive ? 'disabled' : ''}
            onchange="window.__decl_onCheck(this)"
            title="${c.label}">`
      + `</td>`).join('');

      const fuenteBadge = cliente.fuente === 'excel'
        ? `<span style="
             font-size:9px;font-weight:700;letter-spacing:.5px;
             background:rgba(99,102,241,0.15);color:#6366f1;
             padding:1px 5px;border-radius:3px;margin-left:4px;
             vertical-align:middle">EXCEL</span>`
        : '';

      const rfcLine = cliente.rfc
        ? `<div style="font-size:10px;color:var(--text-muted);letter-spacing:.3px">${cliente.rfc}</div>`
        : '';

      const giroLine = cliente.giro
        ? `<div style="font-size:10px;color:var(--text-muted)">${cliente.giro}</div>`
        : '';

      // Botón activar/inactivar
      const toggleBtn = isInactive
        ? `<button onclick="window.__decl_toggleCliente('${cliente.id}', 'active')" title="Activar cliente" style="
             background:rgba(22,163,74,0.15);color:#16a34a;border:none;
             border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;margin-left:6px">
             ✅ Activar</button>`
        : `<button onclick="window.__decl_toggleCliente('${cliente.id}', 'inactive')" title="Marcar inactivo / se fue del despacho" style="
             background:rgba(107,114,128,0.12);color:#6b7280;border:none;
             border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer;margin-left:6px">
             🔴 Baja</button>`;

      return `
        <tr id="decl-row-${cliente.id}" style="${isInactive ? 'opacity:.5' : ''}">
          <td>
            <div style="font-weight:600;font-size:13px;display:flex;align-items:center;flex-wrap:wrap;gap:2px;">
              ${cliente.name || cliente.nombre}${fuenteBadge}
              ${toggleBtn}
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
              <span class="decl-pct-text" style="font-size:11px;font-weight:700;color:${barColor};min-width:30px">${porcentaje}%</span>
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
  }

  const tableHead = `
    <thead>
      <tr>
        <th>Cliente</th>
        ${thChecks}
        <th style="min-width:160px">Avance</th>
        <th>Estado</th>
      </tr>
    </thead>`;

  // Sección Pendientes
  let pendientesHTML = '';
  if (pendientes.length) {
    pendientesHTML = `
      <div style="margin-bottom:8px;font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;padding:4px 0">
        📋 Pendientes (${pendientes.length})
      </div>
      <div class="table-wrap">
        <table class="data-table">
          ${tableHead}
          <tbody>${buildRows(pendientes)}</tbody>
        </table>
      </div>`;
  }

  if (!pendientes.length) {
    // Si no hay pendientes, mostrar mensaje
    pendientesHTML = `
      <div class="empty-state">
        <div class="empty-icon">✅</div>
        <div class="empty-title">¡Sin pendientes!</div>
        <div class="empty-sub">Ve a la pestaña "Completados & Inactivos" para ver el histórico.</div>
      </div>`;
  }

  // Solo retornar pendientes (completos e inactivos están en la pestaña de Reportes)
  return pendientesHTML;
}

/* ================================================================
   VISTA DE REPORTES — Completados e Inactivos (ambos regímenes)
   ================================================================ */

async function cargarReportes(contenedor) {
  try {
    // Loaded ambos regímenes y sus declaraciones
    const clientesResico  = obtenerClientesPorRegimen('626');
    const clientesSueldos = obtenerClientesPorRegimen('605');
    
    const mapaRESICO  = await obtenerMapaDeclaraciones(periodoActivo, 'resico');
    const mapaSUELDOS = await obtenerMapaDeclaraciones(periodoActivo, 'sueldos');

    // Fusionar con catálogos Excel
    const actResico  = fusionarClientes(clientesResico, CLIENTES_RESICO_EXCEL);
    const actSueldos = fusionarClientes(clientesSueldos, CLIENTES_SUELDOS_EXCEL);

    // Combinar completados e inactivos
    const completados = [];
    const inactivos   = [];

    function procesarClientes(clientes, mapa, checksDef, tipo) {
      clientes.forEach(c => {
        const decl       = mapa[c.id] || {};
        const checks     = decl.checks || {};
        const clientStatus = getClienteStatus(c.id);
        const { estado, porcentaje } = calcularEstado(checks, checksDef, clientStatus);
        
        if (estado === 'COMPLETO') {
          completados.push({ cliente: c, checks, estado, porcentaje, clientStatus, tipo });
        } else if (estado === 'INACTIVO') {
          inactivos.push({ cliente: c, checks, estado, porcentaje, clientStatus, tipo });
        }
      });
    }

    procesarClientes(actResico, mapaRESICO, CHECKS_RESICO, 'resico');
    procesarClientes(actSueldos, mapaSUELDOS, CHECKS_SUELDOS, 'sueldos');

    // Ordenar por nombre
    completados.sort((a, b) => (a.cliente.name || a.cliente.nombre).localeCompare(b.cliente.name || b.cliente.nombre));
    inactivos.sort((a, b) => (a.cliente.name || a.cliente.nombre).localeCompare(b.cliente.name || b.cliente.nombre));

    // Construir HTML
    let html = '';

    // Sección COMPLETOS
    if (completados.length) {
      const tableHead = `
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Régimen</th>
            <th style="min-width:160px">Avance</th>
            <th>Estado</th>
          </tr>
        </thead>`;

      const tbody = completados.map(({ cliente, estado, porcentaje, tipo }) => {
        const meta     = estadoMeta(estado);
        const barColor = colorProgreso(porcentaje);
        const rfcLine  = cliente.rfc ? `<div style="font-size:10px;color:var(--text-muted);letter-spacing:.3px">${cliente.rfc}</div>` : '';
        const regimen  = tipo === 'resico' ? '🏛️ RESICO (626)' : '💼 Sueldos (605)';

        return `
          <tr>
            <td>
              <div style="font-weight:600;font-size:13px">${cliente.name || cliente.nombre}</div>
              ${rfcLine}
            </td>
            <td style="font-size:11px;color:var(--text-muted)">${regimen}</td>
            <td style="min-width:140px">
              <div style="display:flex;align-items:center;gap:8px;">
                <div style="flex:1;height:6px;background:rgba(26,35,126,0.1);border-radius:3px;overflow:hidden;">
                  <div style="width:${porcentaje}%;height:100%;background:${barColor};border-radius:3px;"></div>
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

      html += `
        <div style="margin-bottom:16px">
          <div style="margin-bottom:8px;font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;padding:4px 0">
            ✅ Completados (${completados.length})
          </div>
          <div class="table-wrap">
            <table class="data-table">${tableHead}<tbody>${tbody}</tbody></table>
          </div>
        </div>`;
    }

    // Sección INACTIVOS
    if (inactivos.length) {
      const tableHead = `
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Régimen</th>
            <th>Acción</th>
            <th>Estado</th>
          </tr>
        </thead>`;

      const tbody = inactivos.map(({ cliente, estado, tipo }) => {
        const meta     = estadoMeta(estado);
        const rfcLine  = cliente.rfc ? `<div style="font-size:10px;color:var(--text-muted);letter-spacing:.3px">${cliente.rfc}</div>` : '';
        const regimen  = tipo === 'resico' ? '🏛️ RESICO (626)' : '💼 Sueldos (605)';

        return `
          <tr style="opacity:.6">
            <td>
              <div style="font-weight:600;font-size:13px">${cliente.name || cliente.nombre}</div>
              ${rfcLine}
            </td>
            <td style="font-size:11px;color:var(--text-muted)">${regimen}</td>
            <td>
              <button onclick="window.__decl_toggleCliente('${cliente.id}', 'active')" title="Reactivar en despacho" style="
                background:rgba(22,163,74,0.15);color:#16a34a;border:none;
                border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;font-weight:700">
                ✅ Reactivar</button>
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

      html += `
        <div>
          <div style="margin-bottom:8px;font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;padding:4px 0">
            🔴 Inactivos (${inactivos.length})
          </div>
          <div class="table-wrap">
            <table class="data-table">${tableHead}<tbody>${tbody}</tbody></table>
          </div>
        </div>`;
    }

    if (!completados.length && !inactivos.length) {
      html = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <div class="empty-title">No hay registros</div>
          <div class="empty-sub">Todos los clientes tienen declaraciones pendientes.</div>
        </div>`;
    }

    contenedor.innerHTML = html;
    // Ocultar resumen bar en reportes
    const resumenEl = document.getElementById('decl-resumen-bar');
    if (resumenEl) resumenEl.innerHTML = '';

  } catch (err) {
    console.error('[declaraciones.ui] Error en reportes:', err);
    contenedor.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">Error al cargar reportes</div>
        <div class="empty-sub">${err.message}</div>
      </div>`;
  }
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
  const inactivos  = filas.filter(f => f.estado === 'INACTIVO').length;
  const pendientes = total - completos - inactivos;
  const activos    = total - inactivos;
  const pctGlobal  = activos > 0 ? Math.round((completos / activos) * 100) : 0;

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
        <span style="color:#6b7280;font-size:18px;font-weight:800">${inactivos}</span>
        <span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px">Inactivos</span>
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
  const cliente   = clientesActivos.find(c => c.id === clienteId);
  const nombreCliente = cliente ? (cliente.name || cliente.nombre) : clienteId;

  if (!mapaDeclaraciones[clienteId])        mapaDeclaraciones[clienteId] = { checks: {} };
  if (!mapaDeclaraciones[clienteId].checks) mapaDeclaraciones[clienteId].checks = {};
  
  const estadoAnterior = mapaDeclaraciones[clienteId].checks ? 
    Object.values(mapaDeclaraciones[clienteId].checks).filter(Boolean).length : 0;
  
  mapaDeclaraciones[clienteId].checks[checkKey] = el.checked;

  const checks = mapaDeclaraciones[clienteId].checks;
  const clientStatus = getClienteStatus(clienteId);
  const { estado, porcentaje } = calcularEstado(checks, checksDef, clientStatus);

  await guardarDeclaracion({
    clienteId, periodo: periodoActivo, tipo, checks, estado, porcentaje
  }).catch(err => {
    console.error('[declaraciones.ui] Error al guardar:', err);
    el.checked = !el.checked;
    mapaDeclaraciones[clienteId].checks[checkKey] = el.checked;
    window.toast && window.toast('Error al guardar. Intenta de nuevo.', 'error');
  });

  // Si quedó COMPLETO → mostrar alert y recargar tabla
  if (estado === 'COMPLETO') {
    // Mostrar alert sin bloquear (en background)
    Swal.fire({
      title: '✅ ¡Declaración Completada!',
      html: `<b>${nombreCliente}</b> ha sido marcado como completado.`,
      icon: 'success',
      timer: 7000,
      timerProgressBar: true,
      showConfirmButton: false,
      position: 'bottom-right',
      toast: true
    });
    // Recargar tabla para mostrar completos e inactivos
    await cargarSubvista(tipo);
  } else {
    // Recarga también si desmarca (para mover de completo a pendiente)
    if (!el.checked) {
      await cargarSubvista(tipo);
    } else {
      // Actualización liviana: solo la fila y resumen
      actualizarFilaDOM(clienteId, checks, estado, porcentaje, checksDef);
      const filas = clientesActivos.map(c => {
        const d  = mapaDeclaraciones[c.id] || {};
        const ch = d.checks || {};
        const cs = getClienteStatus(c.id);
        const { estado: est, porcentaje: pct } = calcularEstado(ch, checksDef, cs);
        return { estado: est, porcentaje: pct };
      });
      renderResumenBar(filas, checksDef);
    }
  }
};

/* ── Activar / Inactivar cliente en despacho ── */
window.__decl_toggleCliente = async function(clienteId, nuevoStatus) {
  const cliente = clientesActivos.find(c => c.id === clienteId);
  const nombre  = cliente ? (cliente.name || cliente.nombre) : clienteId;
  const msg = nuevoStatus === 'inactive'
    ? `¿Marcar a <b>${nombre}</b> como inactivo? (se fue del despacho)`
    : `¿Reactivar a <b>${nombre}</b> en el despacho?`;

  const r = await Swal.fire({
    title: nuevoStatus === 'inactive' ? '🔴 Inactivar cliente' : '✅ Reactivar cliente',
    html: msg,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: nuevoStatus === 'inactive' ? 'Sí, inactivar' : 'Sí, reactivar',
    cancelButtonText: 'Cancelar'
  });
  if (!r.isConfirmed) return;

  setEstadoCliente(clienteId, nuevoStatus);
  window.toast && window.toast(
    nuevoStatus === 'inactive' ? `${nombre} marcado como inactivo` : `${nombre} reactivado`,
    nuevoStatus === 'inactive' ? 'info' : 'success'
  );
  await cargarSubvista(subvistaActiva);
};

/* ── Agregar cliente RESICO nuevo ── */
window.__decl_agregarClienteResico = async function() {
  const { value: form } = await Swal.fire({
    title: '➕ Nuevo Cliente RESICO',
    html: `
      <div class="swal-form" style="text-align:left">
        <label>Nombre completo *</label>
        <input id="nr-name" placeholder="Nombre del contribuyente" style="width:100%;padding:8px;margin-bottom:8px;border-radius:6px;border:1px solid #ccc">
        <label>RFC *</label>
        <input id="nr-rfc" placeholder="Ej: RECJ7903097T9" style="width:100%;padding:8px;margin-bottom:8px;border-radius:6px;border:1px solid #ccc;text-transform:uppercase">
        <label>Giro / Actividad</label>
        <input id="nr-giro" placeholder="Ej: TAXISTA 0%, ABARROTES 16%" style="width:100%;padding:8px;margin-bottom:8px;border-radius:6px;border:1px solid #ccc">
        <label>Teléfono</label>
        <input id="nr-phone" placeholder="55 0000 0000" style="width:100%;padding:8px;border-radius:6px;border:1px solid #ccc">
      </div>`,
    confirmButtonText: 'Agregar cliente',
    showCancelButton: true,
    cancelButtonText: 'Cancelar',
    width: 480,
    preConfirm: () => {
      const name  = document.getElementById('nr-name')?.value.trim();
      const rfc   = document.getElementById('nr-rfc')?.value.trim().toUpperCase();
      const giro  = document.getElementById('nr-giro')?.value.trim();
      const phone = document.getElementById('nr-phone')?.value.trim();
      if (!name) { Swal.showValidationMessage('El nombre es obligatorio'); return false; }
      if (!rfc)  { Swal.showValidationMessage('El RFC es obligatorio');    return false; }
      // Verificar duplicado RFC
      const dup = clientesActivos.find(c => c.rfc === rfc);
      if (dup) { Swal.showValidationMessage(`Ya existe un cliente con RFC ${rfc}`); return false; }
      return { name, rfc, giro, phone };
    }
  });
  if (!form) return;

  // Intentar crear en Firestore si está disponible
  try {
    if (typeof window.crearCliente === 'function') {
      await window.crearCliente({
        name: form.name, rfc: form.rfc, giro: form.giro, phone: form.phone,
        regimenFiscal: '626', status: 'active'
      });
    } else {
      // Fallback: agregar al catálogo local en memoria
      const nuevoId = `local_${form.rfc}`;
      CLIENTES_RESICO_EXCEL.push({
        id: nuevoId, name: form.name, rfc: form.rfc, giro: form.giro,
        phone: form.phone, regimenFiscal: '626', fuente: 'local', baja: false
      });
    }
    window.toast && window.toast(`Cliente ${form.name} agregado`, 'success');
    await cargarSubvista(subvistaActiva);
  } catch (err) {
    console.error('[declaraciones.ui] Error al crear cliente:', err);
    Swal.fire('Error', 'No se pudo guardar el cliente. ' + err.message, 'error');
  }
};

function actualizarFilaDOM(clienteId, checks, estado, porcentaje, checksDef) {
  const row = document.getElementById(`decl-row-${clienteId}`);
  if (!row) return;

  const meta     = estadoMeta(estado);
  const barColor = colorProgreso(porcentaje);

  // Actualizar barra de progreso
  const fill = row.querySelector('.decl-progress-fill');
  if (fill) { fill.style.width = `${porcentaje}%`; fill.style.background = barColor; }

  // Actualizar el span del porcentaje
  const pctSpan = row.querySelector('.decl-pct-text');
  if (pctSpan) {
    pctSpan.textContent = `${porcentaje}%`;
    pctSpan.style.color = barColor;
  }

  // Actualizar badge de estado
  const badge = row.querySelector('.decl-badge-estado');
  if (badge) {
    badge.innerHTML     = `${meta.icon} ${estado}`;
    badge.style.color      = meta.color;
    badge.style.background = meta.bg;
  }

  row.style.opacity = estado === 'INACTIVO' ? '0.5' : '1';
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
