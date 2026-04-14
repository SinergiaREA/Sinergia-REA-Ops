/* ================================================================
   SINERGIA REA — clientes.ui.js
   Responsabilidad: Formulario extendido de clientes con campos SAT.
   SRP: Solo construye el HTML del formulario y lo entrega a app.js.

   ESTRATEGIA DE INTEGRACIÓN (sin romper app.js):
   Este módulo NO sobreescribe addClient() de app.js.
   En su lugar, expone window.__buildClienteFormHTML() que app.js
   puede llamar opcionalmente, o se puede usar como reemplazo completo.

   Para activar el formulario extendido en app.js, el patch en app.js
   sobreescribe addClient() llamando a addClienteExtendido() de este módulo.
   ================================================================ */

import { obtenerClientes, crearCliente, actualizarCliente, eliminarCliente }
  from './clientes.service.js';

/* ================================================================
   FORMULARIO EXTENDIDO DE CLIENTE
   ================================================================ */

/**
 * Construye el HTML del formulario de cliente con campos SAT.
 * Incluye: nombre, razón social, régimen fiscal, giro, teléfono, email, estado.
 *
 * @param {Object} prefill - Datos para edición (objeto cliente existente o {})
 * @returns {string} HTML del formulario para inyectar en Swal
 */
function buildFormHTML(prefill = {}) {
  /* ── Opciones de Régimen Fiscal ── */
  const optsRegimen = (window.REGIMENES_SAT || []).map(r =>
    `<option value="${r.clave}"
      ${prefill.regimenFiscal === r.clave ? 'selected' : ''}>
      ${r.clave} — ${r.nombre}
    </option>`
  ).join('');

  /* ── Opciones de Giro Empresarial ── */
  const optsGiro = (window.GIROS_EMPRESARIALES || []).map(g =>
    `<option value="${g.id}"
      ${prefill.giro === g.id ? 'selected' : ''}>
      ${g.nombre} (IVA: ${g.iva})
    </option>`
  ).join('');

  return `
    <div class="swal-form">

      <label>Nombre completo *</label>
      <input
        id="cl-name"
        value="${prefill.name || ''}"
        placeholder="Nombre del cliente o contribuyente">

      <label>Razón Social</label>
      <input
        id="cl-biz"
        value="${prefill.businessName || ''}"
        placeholder="Nombre fiscal registrado en el SAT">

      <!-- ── Campos SAT ── -->
      <label>Régimen Fiscal SAT</label>
      <select id="cl-regimen">
        <option value="">— Seleccionar régimen —</option>
        ${optsRegimen}
      </select>

      <label>Giro Empresarial</label>
      <select id="cl-giro">
        <option value="">— Seleccionar giro —</option>
        ${optsGiro}
      </select>
      <!-- Nota: para agregar un nuevo giro, usar el Catálogo de Giros -->

      <!-- ── Datos de contacto ── -->
      <div class="two-col">
        <div>
          <label>Teléfono</label>
          <input id="cl-phone" value="${prefill.phone || ''}" placeholder="55 0000 0000">
        </div>
        <div>
          <label>Email</label>
          <input id="cl-email" value="${prefill.email || ''}" placeholder="correo@ejemplo.com">
        </div>
      </div>

      <label>Estado</label>
      <select id="cl-status">
        <option value="active"   ${(prefill.status || 'active') === 'active'   ? 'selected' : ''}>● Activo</option>
        <option value="inactive" ${prefill.status === 'inactive'               ? 'selected' : ''}>○ Inactivo</option>
      </select>

    </div>`;
}

/**
 * Lee y valida los campos del formulario del modal Swal.
 * @param {string} [existingId] - ID del cliente que se está editando (para validar duplicados)
 * @returns {Object|false} Datos del formulario o false si hay error de validación
 */
function leerFormulario(existingId) {
  const name     = document.getElementById('cl-name')?.value.trim();
  const regimen  = document.getElementById('cl-regimen')?.value;
  const giro     = document.getElementById('cl-giro')?.value;

  // Validaciones
  if (!name) {
    Swal.showValidationMessage('El nombre del cliente es obligatorio');
    return false;
  }

  // Validar duplicados por nombre
  const clientes = obtenerClientes();
  const dup = clientes.find(c =>
    c.name?.toLowerCase() === name.toLowerCase() && c.id !== existingId
  );
  if (dup) {
    Swal.showValidationMessage('Ya existe un cliente con ese nombre');
    return false;
  }

  return {
    name,
    businessName:  document.getElementById('cl-biz')?.value.trim()   || '',
    regimenFiscal: regimen  || '',
    giro:          giro     || '',
    phone:         document.getElementById('cl-phone')?.value.trim() || '',
    email:         document.getElementById('cl-email')?.value.trim() || '',
    status:        document.getElementById('cl-status')?.value       || 'active'
  };
}

/* ================================================================
   FUNCIÓN PRINCIPAL — reemplaza addClient() de app.js
   Se expone en window para ser llamada desde app.js y desde HTML
   ================================================================ */

/**
 * Abre el modal para crear o editar un cliente (versión extendida con campos SAT).
 * Esta función REEMPLAZA window.addClient (definida en app.js) cuando este
 * módulo es importado. app.js continúa funcionando con su versión si este
 * módulo no se carga.
 *
 * @param {Object} prefill - Cliente existente para editar, o {} para crear
 */
window.addClienteExtendido = async function(prefill = {}) {
  const esEdicion = !!prefill.id;

  const { value: form } = await Swal.fire({
    title: esEdicion ? '✏️ Editar Cliente' : '👤 Nuevo Cliente',
    html:  buildFormHTML(prefill),
    confirmButtonText: esEdicion ? 'Guardar cambios' : 'Crear cliente',
    showCancelButton:  true,
    cancelButtonText:  'Cancelar',
    width:             560,
    preConfirm: () => leerFormulario(prefill.id)
  });

  if (!form) return;  // Usuario canceló

  try {
    if (esEdicion) {
      await actualizarCliente(prefill.id, form);
      window.toast?.('Cliente actualizado', 'success');
    } else {
      await crearCliente(form);
      window.toast?.('Cliente creado exitosamente', 'success');
    }

    // Refrescar UI existente de app.js
    if (typeof window.renderClients === 'function')           window.renderClients();
    if (typeof window.populateAllClientFilters === 'function') window.populateAllClientFilters();

  } catch (err) {
    console.error('[clientes.ui] Error al guardar:', err);
  }
};

/**
 * Elimina un cliente con confirmación.
 * Reemplaza window.deleteClient si este módulo está cargado.
 *
 * @param {string} id - ID del cliente a eliminar
 */
window.deleteClienteExtendido = async function(id) {
  const r = await Swal.fire({
    title:             '¿Eliminar cliente?',
    text:              'Se eliminarán también sus tareas, faltas, citas y declaraciones asociadas.',
    icon:              'warning',
    showCancelButton:  true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText:  'Cancelar'
  });

  if (!r.isConfirmed) return;

  try {
    await eliminarCliente(id);
    window.toast?.('Cliente eliminado', 'info');
    if (typeof window.renderClients === 'function')           window.renderClients();
    if (typeof window.populateAllClientFilters === 'function') window.populateAllClientFilters();
  } catch (err) {
    console.error('[clientes.ui] Error al eliminar:', err);
  }
};

/* ================================================================
   PARCHE SOBRE app.js
   Sobreescribimos las funciones globales de app.js con las versiones
   extendidas. Esto se hace DESPUÉS de que app.js cargó, de forma segura.
   app.js sigue intacto en disco — este módulo solo reemplaza en memoria.
   ================================================================ */

/**
 * Aplica el parche sobre las funciones de clientes de app.js.
 * Se llama desde el <script type="module"> en index.html después de
 * que tanto app.js como este módulo han cargado completamente.
 */
export function patchClientesFunctions() {
  // Guardar referencia a la función original por si se necesita restaurar
  window.__addClient_original    = window.addClient;
  window.__deleteClient_original = window.deleteClient;

  // Reemplazar con versiones extendidas (con campos SAT)
  window.addClient    = (prefill = {}) => window.addClienteExtendido(prefill);
  window.deleteClient = (id)           => window.deleteClienteExtendido(id);

  console.log('[clientes.ui] Formulario extendido SAT activado.');
}
