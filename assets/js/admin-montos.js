function apiBase() {
    return window.API_BASE || "http://127.0.0.1:8000";
}

// Anti-recarga por submits accidentales
window.addEventListener("submit", (e) => e.preventDefault(), true);

function authHeaders() {
    const token = localStorage.getItem("access_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
}


async function apiFetch(path, options = {}) {
    const res = await fetch(`${apiBase()}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
            ...authHeaders(),
        },
    });

    let data = null;
    try { data = await res.json(); } catch { /* ignore */ }

    if (!res.ok) {
        const msg = (data && (data.detail || data.mensaje))
            ? (data.detail || data.mensaje)
            : `Error HTTP ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

function formatearMoneda(valor) {
    const n = Number(valor || 0);
    return `$${n.toLocaleString("es-CO")} COP`;
}

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function parseMesDescripcion(desc) {
    const m = String(desc || "").match(/\((Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s+(\d{4})\)/i);
    if (!m) return null;

    const mesNombre = m[1];
    const year = Number(m[2]);
    const mesIndex = MESES.findIndex(x => x.toLowerCase() === mesNombre.toLowerCase());
    if (mesIndex < 0) return null;

    return { mesIndex, year };
}

function toTimeSafe(fechaISO) {
    const d = new Date(fechaISO);
    const t = d.getTime();
    return Number.isNaN(t) ? 0 : t;
}

function ordenarMovimientosDesc(movs) {
    return [...(movs || [])].sort((a, b) => {
        const pa = parseMesDescripcion(a.descripcion);
        const pb = parseMesDescripcion(b.descripcion);
        if (pa && pb) {
            const va = pa.year * 12 + pa.mesIndex;
            const vb = pb.year * 12 + pb.mesIndex;
            return vb - va;
        }
        if (pa && !pb) return -1;
        if (!pa && pb) return 1;

        return toTimeSafe(b.fecha) - toTimeSafe(a.fecha);
    });
}

function uniqueMesesAportados(movs) {
    const set = new Set();
    for (const m of (movs || [])) {
        if (!String(m.tipo || "").toLowerCase().includes("aporte")) continue;

        const p = parseMesDescripcion(m.descripcion);
        if (p) {
            set.add(`${p.year}-${String(p.mesIndex + 1).padStart(2, "0")}`);
            continue;
        }

        const f = String(m.fecha || "").slice(0, 7);
        if (f) set.add(f);
    }
    return set.size;
}

function nextMesTextoFromMovs(movs) {
    const ordenados = ordenarMovimientosDesc(movs);

    const aportes = ordenados.filter(m => String(m.tipo || "").toLowerCase().includes("aporte"));
    if (aportes.length === 0) {
        const now = new Date();
        return `${MESES[now.getMonth()]} ${now.getFullYear()}`;
    }

    const last = aportes[0];

    const parsed = parseMesDescripcion(last.descripcion);
    if (parsed) {
        let mi = parsed.mesIndex + 1;
        let y = parsed.year;
        if (mi > 11) { mi = 0; y += 1; }
        return `${MESES[mi]} ${y}`;
    }

    const d = new Date(last.fecha);
    if (!Number.isNaN(d.getTime())) {
        d.setMonth(d.getMonth() + 1);
        return `${MESES[d.getMonth()]} ${d.getFullYear()}`;
    }

    const now = new Date();
    return `${MESES[now.getMonth()]} ${now.getFullYear()}`;
}

function calcularSaldoConInteres(aporteMensual, mesesAportados, tasaMensualPct) {
    let saldo = 0;
    for (let i = 0; i < mesesAportados; i++) {
        saldo = (saldo + aporteMensual) * (1 + (tasaMensualPct / 100));
    }
    const totalAportado = aporteMensual * mesesAportados;
    const intereses = saldo - totalAportado;
    return { totalAportado, totalAhorrado: saldo, intereses };
}

function mostrarMensaje(texto, esError = false) {
    const el = document.getElementById("mensaje");
    if (!el) return;

    el.textContent = texto;
    el.style.display = "block";
    el.style.padding = "12px 16px";
    el.style.marginTop = "15px";
    el.style.borderRadius = "8px";
    el.style.fontWeight = "600";
    el.style.background = esError ? "#ffe0e0" : "#e6fff3";
    el.style.color = esError ? "#b00020" : "#0a6b3d";

    // que se quite solo después de 4s
    clearTimeout(el._timer);
    el._timer = setTimeout(() => {
        el.style.display = "none";
    }, 4000);
}


function renderHistorial(movs) {
    const cont = document.getElementById("historialAdmin");
    if (!cont) return;

    const ordenados = ordenarMovimientosDesc(movs);

    if (!Array.isArray(ordenados) || ordenados.length === 0) {
        cont.innerHTML = `<div class="sin-prestamos"><p>Aún no hay movimientos.</p></div>`;
        return;
    }

    cont.innerHTML = ordenados.slice(0, 20).map(m => {
        const fecha = (m.fecha || "").slice(0, 10) || "-";
        const detalle = m.descripcion || m.tipo || "-";
        return `
      <div class="mov-admin">
        <div>${fecha}</div>
        <div>${detalle}</div>
        <div class="monto">${formatearMoneda(m.monto)}</div>
      </div>
    `;
    }).join("");
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

async function cargarUsuario(usuarioId) {
    const ahorro = await apiFetch(`/api/ahorros/${usuarioId}`);
    const movs = await apiFetch(`/api/movimientos/${usuarioId}?limit=200`);

    document.getElementById("aporteMensual").value = Number(ahorro.ahorro_mensual || 0);
    document.getElementById("tasaMensual").value = Number(ahorro.porcentaje_interes || 0);

    const mesSig = nextMesTextoFromMovs(movs);
    document.getElementById("mesSiguiente").value = mesSig;
    document.getElementById("btnRegistrarAporte").textContent = `Registrar aporte de: ${mesSig}`;

    const aporteMensual = Number(ahorro.ahorro_mensual || 0);
    const tasaPct = Number(ahorro.porcentaje_interes || 0);

    const mesesAportados = uniqueMesesAportados(movs);
    const r = calcularSaldoConInteres(aporteMensual, mesesAportados, tasaPct);

    document.getElementById("previewTotalAportado").textContent = formatearMoneda(r.totalAportado);
    document.getElementById("previewTotalAhorrado").textContent = formatearMoneda(r.totalAhorrado);
    document.getElementById("previewIntereses").textContent = formatearMoneda(r.intereses);

    renderHistorial(movs);

    return { ahorro, movs };
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await cargarUsuarios();

        const select = document.getElementById("selectUsuario");
        const btnGuardar = document.getElementById("btnGuardarConfig");
        const btnAporte = document.getElementById("btnRegistrarAporte");
        const btnReset = document.getElementById("btnResetSocio");

        // ✅ defensivo
        if (!select) throw new Error("No existe #selectUsuario en el HTML");
        if (!btnGuardar) throw new Error("No existe #btnGuardarConfig en el HTML");
        if (!btnAporte) throw new Error("No existe #btnRegistrarAporte en el HTML");
        if (!btnReset) throw new Error("No existe #btnResetSocio en el HTML");

        // ✅ fuerza type="button" por si algún botón quedó raro
        [btnGuardar, btnAporte, btnReset].forEach(b => {
            if (!b.getAttribute("type")) b.setAttribute("type", "button");
        });

        if (!select.value) return;

        await cargarUsuario(Number(select.value));

        // Cambio de usuario
        select.addEventListener("change", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await cargarUsuario(Number(select.value));
        });

        // ✅ BOTÓN 1: Guardar config (PUT)
        btnGuardar.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const usuarioId = Number(select.value);
            const ahorro_mensual = Number(document.getElementById("aporteMensual")?.value || 0);
            const porcentaje_interes = Number(document.getElementById("tasaMensual")?.value || 0);

            btnGuardar.disabled = true;

            try {
                await apiFetch(`/api/ahorros/${usuarioId}`, {
                    method: "PUT",
                    body: JSON.stringify({ usuario_id: usuarioId, ahorro_mensual, porcentaje_interes }),
                });

                await cargarUsuario(usuarioId);
                mostrarMensaje("✅ Configuración guardada", false);
            } catch (err) {
                console.error(err);
                mostrarMensaje(`❌ ${err.message || "No se pudo guardar la configuración"}`, true);
            } finally {
                btnGuardar.disabled = false;
            }
        });

        // ✅ BOTÓN 2: Registrar aporte (POST)
        btnAporte.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const usuarioId = Number(select.value);

            // ✅ botón real, aunque hayas clickeado un <span> dentro
            const btn = e.currentTarget;
            btn.disabled = true;

            try {
                const r = await apiFetch(`/api/ahorros/${usuarioId}/registrar_aporte`, { method: "POST" });
                await cargarUsuario(usuarioId);
                mostrarMensaje(`✅ ${r?.mensaje || "Aporte registrado"}`, false);
            } catch (err) {
                console.error(err);
                mostrarMensaje(`❌ ${err.message || "No se pudo registrar el aporte"}`, true);
            } finally {
                btn.disabled = false;
            }
        });

        // ✅ BOTÓN 3: Reset socio (DELETE)
        btnReset.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const usuarioId = Number(select.value);
            btnReset.disabled = true;

            try {
                await apiFetch(`/api/admin/reset_socio/${usuarioId}`, { method: "DELETE" });
                await cargarUsuario(usuarioId);
                mostrarMensaje("🧹 Usuario reseteado", false);
            } catch (err) {
                console.error(err);
                mostrarMensaje(`❌ ${err.message || "No se pudo resetear el usuario"}`, true);
            } finally {
                btnReset.disabled = false;
            }
        });

    } catch (err) {
        console.error(err);
        mostrarMensaje(`❌ ${err.message || err}`, true);
    }
});
