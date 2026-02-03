const API = localStorage.getItem("API_BASE") || "http://127.0.0.1:8000";

function authHeaders() {
    const token = localStorage.getItem("access_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path, options = {}) {
    const res = await fetch(`${API}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
            ...authHeaders(),
        },
    });

    let data = null;
    try { data = await res.json(); } catch { }

    if (!res.ok) {
        const msg = (data && (data.detail || data.mensaje))
            ? (data.detail || data.mensaje)
            : `Error HTTP ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

function hoyISO() {
    return new Date().toISOString().slice(0, 10);
}

function formatearMoneda(v) {
    return `$${Number(v || 0).toLocaleString("es-CO")} COP`;
}

function mostrarMensaje(txt, esError = false) {
    const el = document.getElementById("mensaje");
    if (!el) return;
    el.textContent = txt;
    el.style.color = esError ? "#d63031" : "var(--text-main)";
}

function fmtFecha(iso) {
    if (!iso) return "-";
    return String(iso).slice(0, 10);
}

function normalizarPrestamo(p) {
    const monto = Number(p.monto || 0);
    const total = Number(p.total || 0);
    const plazo = Number(p.plazo || 0);

    // 👇 VIENE DEL BACKEND
    const total_pagado = Number(p.total_pagado || 0);
    const saldo = (p.saldo_pendiente !== undefined && p.saldo_pendiente !== null)
        ? Number(p.saldo_pendiente)
        : Math.max(0, total - total_pagado);

    // 👇 cuotas pagadas VIENEN DENTRO del plan
    const cuotas_pagadas = Number(
        p.plan_pagos?.cuotas_pagadas ??
        p.plan_pagos?.cuotas?.filter(c => c.pagada).length ??
        0
    );

    const estado = (String(p.estado || "").toLowerCase() === "pagado" || saldo <= 0)
        ? "pagado"
        : "pendiente";

    return {
        ...p,
        monto,
        total,
        plazo,
        total_pagado,
        saldo,
        cuotas_pagadas,
        estado
    };
}


function sumarMesesISO(fechaISO, meses) {
    const [y, m, d] = String(fechaISO || hoyISO()).split("-").map(Number);
    const date = new Date(y, (m - 1) + meses, d);
    const yy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
}

function cuotaMensual(total, plazo) {
    if (!plazo || plazo <= 0) return total;
    return total / plazo;
}

function chipEstado(estado) {
    return estado === "pagado"
        ? `<span class="chip chip-pagado">PAGADO</span>`
        : `<span class="chip chip-pendiente">PENDIENTE</span>`;
}

function clasePrestamo(estado) {
    return estado === "pagado" ? "prestamo-pagado" : "prestamo-pendiente";
}

async function cargarUsuarios() {
    const select = document.getElementById("selectUsuario");
    const usuarios = await apiFetch("/api/usuarios");

    select.innerHTML = "";
    usuarios.forEach(u => {
        const opt = document.createElement("option");
        opt.value = String(u.id);
        opt.textContent = `${u.nombre} (@${u.usuario}) - ${u.rol}`;
        select.appendChild(opt);
    });

    return usuarios;
}

async function listarPrestamos(usuarioId) {
    const list = await apiFetch(`/api/prestamos/${usuarioId}`);
    return (list || []).map(normalizarPrestamo);
}

function elegirPrestamoActivo(prestamos) {
    // “Activo” = último pendiente con saldo > 0
    const pendientes = (prestamos || []).filter(p => p.estado === "pendiente" && Number(p.saldo) > 0);
    if (pendientes.length) return pendientes[pendientes.length - 1];

    // si no hay pendientes, el último préstamo (o null)
    return (prestamos && prestamos.length) ? prestamos[prestamos.length - 1] : null;
}

function renderPrestamos(prestamos, cont) {
    if (!prestamos || prestamos.length === 0) {
        cont.innerHTML = `<div class="sin-prestamos"><p>Este socio no tiene préstamos.</p></div>`;
        return;
    }

    cont.innerHTML = prestamos.slice().reverse().map(p => {
        const cuota = cuotaMensual(p.total, p.plazo);
        const puedePagar = (p.estado !== "pagado") && (p.cuotas_pagadas < p.plazo);

        return `
      <div class="prestamo-item ${clasePrestamo(p.estado)}" data-id="${p.id}">
        <div><strong>ID</strong><br>#${p.id}</div>
        <div><strong>Fecha</strong><br>${fmtFecha(p.fecha_prestamo || p.fecha)}</div>
        <div><strong>Monto</strong><br><span class="valor">${formatearMoneda(p.monto)}</span></div>

        <div><strong>Total</strong><br><span class="valor">${formatearMoneda(p.total)}</span></div>
        <div><strong>Saldo</strong><br><span class="valor">${formatearMoneda(p.saldo)}</span></div>
        <div><strong>Cuotas</strong><br>${p.cuotas_pagadas}/${p.plazo} (${formatearMoneda(cuota)})</div>

        <div><strong>Pagado</strong><br>${chipEstado(p.estado)}</div>

        <div class="acciones-prestamo">
        ${p.estado === "pagado"
                ? `<span class="prestamo-ok">✔ Préstamo saldado</span>`
                : `
                <button type="button" class="btn-secundario btnPagarCuota">
                Pagar 1 cuota
                </button>
                <button type="button" class="btn-admin btnPagarTotal">
                Pagar total
                </button>
            `
            }
        </div>

      </div>
    `;
    }).join("");
}

function renderPlanPagos(prestamo, cont) {
    if (!prestamo || !prestamo.plan_pagos) {
        cont.innerHTML = `<div class="sin-prestamos"><p>No hay plan de pagos disponible.</p></div>`;
        return;
    }

    const plan = prestamo.plan_pagos;
    const cuota = Number(plan.cuota || 0);

    cont.innerHTML = `
      <p>
        <strong>Préstamo:</strong> #${prestamo.id} |
        <strong>Total:</strong> ${formatearMoneda(prestamo.total)} |
        <strong>Saldo:</strong> ${formatearMoneda(prestamo.saldo)} |
        <strong>Cuota:</strong> ${formatearMoneda(cuota)}
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
          ${plan.cuotas.map(c => `
            <tr class="${c.pagada ? "cuota-pagada" : "cuota-pendiente"}">
              <td>${c.n}</td>
              <td>${fmtFecha(c.fecha)}</td>
              <td class="valor">${formatearMoneda(c.cuota)}</td>
              <td>${c.pagada ? "✅ Pagada" : "⏳ Pendiente"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
}


document.addEventListener("DOMContentLoaded", async () => {
    try {
        await cargarUsuarios();

        const select = document.getElementById("selectUsuario");
        const listaPrestamosEl = document.getElementById("listaPrestamos");
        const planPagosEl = document.getElementById("planPagos");

        async function refrescarTodo() {
            const usuarioId = Number(select.value);
            const prestamos = await listarPrestamos(usuarioId);

            renderPrestamos(prestamos, listaPrestamosEl);

            const activo = elegirPrestamoActivo(prestamos);
            renderPlanPagos(activo, planPagosEl);
        }

        await refrescarTodo();

        select.addEventListener("change", async (e) => {
            e.preventDefault();
            await refrescarTodo();
            mostrarMensaje("📋 Préstamos actualizados", false);
        });

        document.getElementById("btnVerPrestamos").addEventListener("click", async (e) => {
            e.preventDefault();
            await refrescarTodo();
            mostrarMensaje("📋 Préstamos actualizados", false);
        });

        // Crear préstamo (usa tu endpoint actual)
        document.getElementById("btnCrearPrestamo").addEventListener("click", async (e) => {
            e.preventDefault();

            const usuarioId = Number(select.value);
            const monto = Number(document.getElementById("monto").value || 0);
            const interesMensual = Number(document.getElementById("interes").value || 0);
            const plazo = Number(document.getElementById("plazo").value || 0);

            if (monto <= 0) return mostrarMensaje("⚠️ Ingresa un monto válido.", true);
            if (interesMensual < 0) return mostrarMensaje("⚠️ Interés inválido.", true);
            if (plazo <= 0) return mostrarMensaje("⚠️ Plazo inválido.", true);

            const interesTotal = monto * (interesMensual / 100) * plazo;
            const total = monto + interesTotal;

            const hoy = new Date();
            const venc = new Date(hoy.getFullYear(), hoy.getMonth() + plazo, hoy.getDate());

            try {
                await apiFetch("/api/crear_prestamo", {
                    method: "POST",
                    body: JSON.stringify({
                        usuario_id: usuarioId,
                        monto,
                        fecha_vencimiento: venc.toISOString(),
                        intereses: interesTotal,
                        total,
                        plazo,
                        estado: "pendiente"
                    })
                });

                mostrarMensaje("✅ Préstamo creado", false);
                await refrescarTodo();
            } catch (err) {
                console.error(err);
                mostrarMensaje(`❌ ${err.message}`, true);
            }
        });

        // Delegación: pagar cuota / pagar total
        document.addEventListener("click", async (e) => {
            const btnTotal = e.target.closest?.(".btnPagarTotal");
            const btnCuota = e.target.closest?.(".btnPagarCuota");

            if (!btnTotal && !btnCuota) return;

            // ✅ evita cualquier comportamiento raro
            e.preventDefault();
            e.stopPropagation();

            // ✅ encuentra la tarjeta del préstamo sí o sí
            const card = e.target.closest?.(".prestamo-item[data-id]");
            if (!card) {
                console.warn("No encontré .prestamo-item[data-id] para este botón");
                return;
            }

            const prestamoId = Number(card.dataset.id);
            console.log("CLICK pago:", btnTotal ? "TOTAL" : "CUOTA", "prestamoId:", prestamoId);

            try {
                if (btnTotal) {
                    if (!confirm(`¿Quieres pagar el total del prestamo con ID ${prestamoId}?`)) return;

                    btnTotal.disabled = true;
                    const r = await apiFetch(`/api/prestamos/${prestamoId}/pagar_total`, { method: "POST" });
                    mostrarMensaje(r.mensaje || "✅ Pagado total", false);
                    await refrescarTodo();
                    btnTotal.disabled = false;
                    return;
                }

                if (btnCuota) {
                    if (!confirm(`¿Quieres pagar 1 cuota del préstamo con ID ${prestamoId}?`)) return;

                    btnCuota.disabled = true;
                    const r = await apiFetch(`/api/prestamos/${prestamoId}/pagar_cuota`, { method: "POST" });
                    mostrarMensaje(r.mensaje || "✅ Cuota pagada", false);
                    await refrescarTodo();
                    btnCuota.disabled = false;
                    return;
                }
            } catch (err) {
                console.error(err);
                mostrarMensaje(`❌ ${err.message || "Error pagando el préstamo"}`, true);
                if (btnTotal) btnTotal.disabled = false;
                if (btnCuota) btnCuota.disabled = false;
            }
        });


    } catch (err) {
        console.error(err);
        mostrarMensaje(`❌ ${err.message || err}`, true);
    }
});
