const API = "http://127.0.0.1:8000";

function formatearMoneda(valor) {
    return `$${Number(valor || 0).toLocaleString("es-CO")} COP`;
}

function isoToDate(iso) {
    if (!iso) return "-";
    try {
        return new Date(iso).toISOString().slice(0, 10);
    } catch {
        return "-";
    }
}

function setEstadoBadge(estado) {
    const estadoBadge = document.getElementById("estadoPrestamo");
    if (!estadoBadge) return;

    const est = (estado || "").toLowerCase();

    if (est === "vencido") {
        estadoBadge.textContent = "Vencido";
        estadoBadge.style.background = "linear-gradient(135deg, #d63031 0%, #e17055 100%)";
    } else if (est === "activo") {
        estadoBadge.textContent = "Activo";
        estadoBadge.style.background = "linear-gradient(135deg, #00b894 0%, #2ecc71 100%)";
    } else if (est === "pagado") {
        estadoBadge.textContent = "Pagado";
        estadoBadge.style.background = "linear-gradient(135deg, #0984e3 0%, #74b9ff 100%)";
    } else {
        estadoBadge.textContent = estado || "Sin préstamo";
        estadoBadge.style.background = "linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)";
    }
}

function getUsuarioSesion() {
    const sesionActiva = localStorage.getItem("sesionActiva");
    const usuarioStr = localStorage.getItem("usuario"); // <- objeto del back
    if (!sesionActiva || !usuarioStr) return null;

    try {
        return JSON.parse(usuarioStr);
    } catch {
        return null;
    }
}

function verificarSesion() {
    const usuario = getUsuarioSesion();
    if (!usuario) {
        window.location.href = "../index.html";
        return null;
    }
    return usuario;
}

function mostrarSinPrestamoActual() {
    document.getElementById("montoPrestado").textContent = "$0 COP";
    document.getElementById("fechaPrestamo").textContent = "Sin préstamo activo";
    document.getElementById("fechaVencimiento").textContent = "-";
    document.getElementById("interesesAcumulados").textContent = "$0 COP";
    document.getElementById("totalPagar").textContent = "$0 COP";
    setEstadoBadge("Sin préstamo");
}

function mostrarSinPrestamos() {
    mostrarSinPrestamoActual();
    const hist = document.getElementById("historialPrestamos");
    if (hist) {
        hist.innerHTML = `
      <div class="sin-prestamos">
        <p>No tienes historial de préstamos</p>
      </div>
    `;
    }
}

function renderPrestamoActual(prestamoActual) {
    document.getElementById("montoPrestado").textContent = formatearMoneda(prestamoActual.monto);
    document.getElementById("fechaPrestamo").textContent = isoToDate(prestamoActual.fecha_prestamo);
    document.getElementById("fechaVencimiento").textContent = isoToDate(prestamoActual.fecha_vencimiento);

    // Si el backend envía saldo_pendiente, lo usamos. Si no, cae al total normal.
    const saldo = (prestamoActual.saldo_pendiente != null)
        ? prestamoActual.saldo_pendiente
        : prestamoActual.total;

    document.getElementById("interesesAcumulados").textContent = formatearMoneda(prestamoActual.intereses);
    document.getElementById("totalPagar").textContent = formatearMoneda(saldo);

    setEstadoBadge(prestamoActual.estado);
}


function renderPlanPagosSocio(plan) {
    const cont = document.getElementById("planPagosSocio");
    if (!cont) return;

    if (!plan || !Array.isArray(plan.cuotas) || plan.cuotas.length === 0) {
        cont.innerHTML = `<div class="sin-prestamos"><p>No hay préstamo activo para mostrar plan de pagos.</p></div>`;
        return;
    }

    // Si el backend manda cuotas_pagadas mejor; si no, lo calculamos
    const pagadas = Number(plan.cuotas_pagadas ?? plan.cuotas.filter(c => c.pagada).length);
    const totales = Number(plan.cuotas_totales ?? plan.cuotas.length);

    cont.innerHTML = `
    <p>
      <strong>Cuotas:</strong> ${pagadas}/${totales} |
      <strong>Total intereses:</strong> ${formatearMoneda(plan.interes_total)} |
      <strong>Total a pagar:</strong> ${formatearMoneda(plan.total)} |
      <strong>Cuota mensual:</strong> ${formatearMoneda(plan.cuota)}
    </p>

    <table class="tabla-pagos">
      <thead>
        <tr>
          <th>#</th>
          <th>Fecha de pago</th>
          <th>Cuota</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        ${plan.cuotas.map(c => {
        const esPagada = !!c.pagada;
        const texto = esPagada ? "Pagada" : "Pendiente";
        const clase = esPagada ? "pagada" : "pendiente";

        return `
            <tr>
              <td>${c.n}</td>
              <td>${isoToDate(c.fecha)}</td>
              <td class="valor">${formatearMoneda(c.cuota)}</td>
              <td>
                <span class="pill-estado ${clase}">${texto}</span>
              </td>
            </tr>
          `;
    }).join("")}
      </tbody>
    </table>
  `;
}



function cargarHistorialPrestamos(historial) {
    const contenedor = document.getElementById("historialPrestamos");
    if (!contenedor) return;

    contenedor.innerHTML = "";

    historial.forEach((prestamo) => {
        const estadoClass = (prestamo.estado || "pagado").toLowerCase();
        const estadoTexto =
            (prestamo.estado || "pagado").charAt(0).toUpperCase() + (prestamo.estado || "pagado").slice(1);

        const html = `
      <div class="prestamo-item">
        <div class="prestamo-fecha">${isoToDate(prestamo.fecha_prestamo)}</div>
        <div class="prestamo-monto-item">${formatearMoneda(prestamo.monto)}</div>
        <div class="prestamo-estado">
          <span class="badge-estado ${estadoClass}">${estadoTexto}</span>
        </div>
      </div>
    `;
        contenedor.innerHTML += html;
    });
}

// =====================
// API
// =====================
async function fetchPrestamos(usuario_id) {
    const token = localStorage.getItem("access_token"); // si lo usas
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const res = await fetch(`${API}/api/prestamos/${usuario_id}`, { headers });
    const data = await res.json();

    if (!res.ok) throw new Error(data.detail || "Error consultando préstamos");
    return data; // lista
}

// =====================
// Control principal
// =====================
async function cargarDatosPrestamosDesdeDB() {
    const usuario = verificarSesion();
    if (!usuario) return;

    let prestamos = [];
    try {
        prestamos = await fetchPrestamos(usuario.id);
    } catch (e) {
        console.error(e);
        mostrarSinPrestamos();
        return;
    }

    if (!Array.isArray(prestamos) || prestamos.length === 0) {
        mostrarSinPrestamos();
        return;
    }

    // Prestamo actual: preferir "activo"; si no hay, tomar el más reciente
    const activos = prestamos.filter((p) => (p.estado || "").toLowerCase() === "activo");
    const prestamoActual = activos.length > 0 ? activos[0] : prestamos[0];

    renderPrestamoActual(prestamoActual);
    renderPlanPagosSocio(prestamoActual.plan_pagos);

    // Historial = todos menos el actual
    const historial = prestamos.filter((p) => p.id !== prestamoActual.id);
    if (historial.length > 0) cargarHistorialPrestamos(historial);
    else {
        const cont = document.getElementById("historialPrestamos");
        if (cont) {
            cont.innerHTML = `
        <div class="sin-prestamos">
          <p>No tienes historial de préstamos</p>
        </div>
      `;
        }
    }
}

function cerrarSesion() {
    localStorage.removeItem("sesionActiva");
    localStorage.removeItem("usuarioActivo");
    localStorage.removeItem("nombreUsuario");
    localStorage.removeItem("rolUsuario");
    localStorage.removeItem("usuario");
    localStorage.removeItem("access_token");
    window.location.href = "../index.html";
}

cargarDatosPrestamosDesdeDB();

const btnCerrarSesion = document.getElementById("btnCerrarSesion");
if (btnCerrarSesion) btnCerrarSesion.addEventListener("click", cerrarSesion);

console.log("Página de préstamos cargada correctamente (DB)");
