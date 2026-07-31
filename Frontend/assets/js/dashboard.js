const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const API = window.API_BASE || localStorage.getItem("API_BASE") || (isLocal ? "http://127.0.0.1:8000" : "https://natillera.onrender.com");

function getUsuarioLocal() {
    try {
        return JSON.parse(localStorage.getItem("usuario") || "null");
    } catch {
        return null;
    }
}

function verificarSesion() {
    const sesionActiva = localStorage.getItem("sesionActiva");
    const token = localStorage.getItem("access_token");
    const usuario = getUsuarioLocal();

    if (!sesionActiva || !token || !usuario?.id) {
        console.log("No hay sesión/token/usuario.id. Redirigiendo al login...");
        window.location.href = "../index.html";
        return false;
    }

    // Mostrar nombre en título
    mostrarNombreUsuario(usuario.nombre || usuario.usuario);
    return true;
}

function mostrarNombreUsuario(nombre) {
    const titulo = document.querySelector(".container h1");
    if (titulo) titulo.textContent = `¡Hola ${nombre}! Esta es tu información de la natillera`;
}

function cerrarSesion() {
    localStorage.removeItem("sesionActiva");
    localStorage.removeItem("access_token");
    localStorage.removeItem("rolUsuario");
    localStorage.removeItem("usuario");
    window.location.href = "../index.html";
}

function activarUIAdmin() {
    const rol = localStorage.getItem("rolUsuario");

    const btnMontos = document.getElementById("btnAdminMontos");
    const btnPrestamo = document.getElementById("btnAdminPrestamo");
    const btnCrearUsuarios = document.getElementById("btnCrearUsuarios");
    const cardFondoGlobal = document.getElementById("fondo_total_natillera");

    if (rol === "admin") {
        if (btnMontos) {
            btnMontos.style.display = "inline-flex";
            btnMontos.onclick = () => window.location.href = "../pages/admin-montos.html";
        }
        if (btnPrestamo) {
            btnPrestamo.style.display = "inline-flex";
            btnPrestamo.onclick = () => window.location.href = "../pages/admin-prestamos.html";
        }
        if (btnCrearUsuarios) {
            btnCrearUsuarios.style.display = "inline-flex";
            btnCrearUsuarios.onclick = () => window.location.href = "../pages/crear-usuarios.html";
        }
        if (cardFondoGlobal) cardFondoGlobal.style.display = "block";
    } else {
        if (btnMontos) btnMontos.style.display = "none";
        if (btnPrestamo) btnPrestamo.style.display = "none";
        if (btnCrearUsuarios) btnCrearUsuarios.style.display = "none";
        if (cardFondoGlobal) cardFondoGlobal.style.display = "none";
    }
}

function formatearMoneda(valor) {
    const n = Number(valor || 0);
    return `$${n.toLocaleString("es-CO")} COP`;
}

function setText(selector, text) {
    const el = document.querySelector(selector);
    if (el) el.textContent = text;
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

let dashAporteChart = null;
let dashPollaChart = null;

function renderMatrizPersonal(movs) {
    const body = document.getElementById("bodyMatrizPersonal");
    if (!body) return;

    const currentYear = new Date().getFullYear();
    const mesesEstado = Array.from({ length: 12 }, () => ({
        aporte: false,
        polla: false,
        tieneAjuste: false,
        motivoAjuste: "",
        montoAporte: 0
    }));

    for (const m of (movs || [])) {
        const p = parseMesDescripcion(m.descripcion);
        if (p && p.year === currentYear && p.mesIndex >= 0 && p.mesIndex < 12) {
            const tipoLower = String(m.tipo || "").toLowerCase();
            const descLower = String(m.descripcion || "").toLowerCase();

            if (tipoLower.includes("descuento") || tipoLower.includes("penalizac") || tipoLower.includes("ajuste") || descLower.includes("descuento") || descLower.includes("penalizac") || descLower.includes("mora")) {
                mesesEstado[p.mesIndex].tieneAjuste = true;
                mesesEstado[p.mesIndex].motivoAjuste = m.descripcion || m.tipo;
                mesesEstado[p.mesIndex].montoAporte += Number(m.monto || 0);
            } else if (tipoLower.includes("aporte")) {
                mesesEstado[p.mesIndex].aporte = true;
                mesesEstado[p.mesIndex].montoAporte += Number(m.monto || 0);
            } else if (tipoLower.includes("polla")) {
                mesesEstado[p.mesIndex].polla = true;
            }
        }
    }

    let trHtml = '<tr style="border-bottom: 1px solid #f1f5f9;">';
    for (let m = 0; m < 12; m++) {
        const estado = mesesEstado[m];
        let cellContent = '<span style="color: #cbd5e1;">❌</span>';
        let cellBg = '';
        let titleInfo = `Mes de ${MESES[m]}`;

        if (estado.tieneAjuste) {
            const montoFormated = estado.montoAporte !== 0 ? `<br><span style="font-size: 0.72rem; font-weight: 700; color: #ea580c;">$${Math.round(estado.montoAporte/1000)}k</span>` : '';
            cellContent = `⚠️${montoFormated}`;
            cellBg = 'background: rgba(249, 115, 22, 0.15); border: 1px solid #fdba74;';
            titleInfo += `\n⚠️ Ajuste/Descuento: ${estado.motivoAjuste || "Sin detalle"}`;
        } else if (estado.aporte && estado.polla) {
            const montoTexto = estado.montoAporte > 0 ? `<br><span style="font-size: 0.72rem; font-weight: 700; color: #059669;">$${Math.round(estado.montoAporte/1000)}k</span>` : '';
            cellContent = `🟢🎲${montoTexto}`;
            cellBg = 'background: rgba(16, 185, 129, 0.12);';
            titleInfo += `\nAporte y Polla al día`;
        } else if (estado.aporte) {
            const montoTexto = estado.montoAporte > 0 ? `<br><span style="font-size: 0.72rem; font-weight: 700; color: #059669;">$${Math.round(estado.montoAporte/1000)}k</span>` : '';
            cellContent = `🟢${montoTexto}`;
            cellBg = 'background: rgba(16, 185, 129, 0.08);';
            titleInfo += `\nAporte al día (Polla pendiente)`;
        } else if (estado.polla) {
            cellContent = `🎲`;
            cellBg = 'background: rgba(236, 72, 153, 0.08);';
            titleInfo += `\nPolla pagada (Aporte pendiente)`;
        }

        trHtml += `
            <td title="${titleInfo}" style="padding: 12px 6px; text-align: center; font-size: 0.95rem; ${cellBg}">
                ${cellContent}
            </td>
        `;
    }
    trHtml += '</tr>';

    body.innerHTML = trHtml;
}

function renderDashboardCharts(movs) {
    const listMovs = Array.isArray(movs) ? movs : [];
    renderMatrizPersonal(listMovs);

    const aportados = new Set();
    const pollas = new Set();

    for (const m of listMovs) {
        if (String(m.tipo || "").toLowerCase().includes("aporte")) {
            const p = parseMesDescripcion(m.descripcion);
            if (p) aportados.add(`${p.year}-${p.mesIndex}`);
        }
        if (String(m.tipo || "").toLowerCase().includes("polla")) {
            const p = parseMesDescripcion(m.descripcion);
            if (p) pollas.add(`${p.year}-${p.mesIndex}`);
        }
    }

    const startYear = new Date().getFullYear();
    let pagadosAporte = 0;
    let pagadosPolla = 0;
    
    for (let i = 0; i < 12; i++) {
        const key = `${startYear}-${i}`;
        if (aportados.has(key)) pagadosAporte++;
        if (pollas.has(key)) pagadosPolla++;
    }

    const pctAporte = Math.round((pagadosAporte / 12) * 100);
    const pctPolla = Math.round((pagadosPolla / 12) * 100);

    const labelAporte = document.getElementById("aporteStatusLabel");
    const pctLabelAporte = document.getElementById("aporteStatusPct");
    if (labelAporte) labelAporte.textContent = `${pagadosAporte} de 12 meses`;
    if (pctLabelAporte) pctLabelAporte.textContent = `${pctAporte}% pagado`;

    const labelPolla = document.getElementById("pollaStatusLabel");
    const pctLabelPolla = document.getElementById("pollaStatusPct");
    if (labelPolla) labelPolla.textContent = `${pagadosPolla} de 12 meses`;
    if (pctLabelPolla) pctLabelPolla.textContent = `${pctPolla}% pagado`;

    const ctxAportes = document.getElementById("dashPieAportesCanvas");
    const ctxPollas = document.getElementById("dashPiePollaCanvas");

    if (ctxAportes && window.Chart) {
        if (dashAporteChart) dashAporteChart.destroy();
        dashAporteChart = new Chart(ctxAportes, {
            type: 'doughnut',
            data: {
                labels: ['Pagado', 'Pendiente'],
                datasets: [{
                    data: [pagadosAporte, 12 - pagadosAporte],
                    backgroundColor: ['#6366f1', '#e2e8f0'],
                    borderWidth: 0
                }]
            },
            options: {
                cutout: '70%',
                plugins: { legend: { display: false }, tooltip: { enabled: true } },
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    if (ctxPollas && window.Chart) {
        if (dashPollaChart) dashPollaChart.destroy();
        dashPollaChart = new Chart(ctxPollas, {
            type: 'doughnut',
            data: {
                labels: ['Pagado', 'Pendiente'],
                datasets: [{
                    data: [pagadosPolla, 12 - pagadosPolla],
                    backgroundColor: ['#ec4899', '#e2e8f0'],
                    borderWidth: 0
                }]
            },
            options: {
                cutout: '70%',
                plugins: { legend: { display: false }, tooltip: { enabled: true } },
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
}

async function cargarDashboard() {
    const usuario = getUsuarioLocal();
    const token = localStorage.getItem("access_token");

    const res = await fetch(`${API}/api/dashboard/${usuario.id}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
        },
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.detail || "Error cargando dashboard");
    }

    return data;
}

// -----------------------------
// Pintar dashboard con datos del BACK
// -----------------------------
function pintarTarjetas(data) {
    // Aporte mensual
    setText("#ahorro .valor p", formatearMoneda(data.ahorro_mensual));

    // Total ahorrado
    setText("#mis_ahorros .valor p", formatearMoneda(data.total_ahorrado));

    // Intereses
    setText("#interes .valor p", formatearMoneda(data.interes_ganado));

    // Socios totales
    setText("#socios .valor p", `${data.socios_total}`);

    // Préstamos
    setText("#Prestamos .valor p", formatearMoneda(data.total_prestado));

    // Polla acumulada etiqueta
    const lblPozo = document.getElementById("lblPozoPolla");
    if (lblPozo) lblPozo.textContent = `Pozo acumulado: ${formatearMoneda(data.polla_acumulado)}`;

    // Fondo Total Natillera (Global)
    setText("#fondo_total_natillera .valor p", formatearMoneda(data.total_ahorrado_global));

    // Observaciones del Admin
    const secObs = document.getElementById("seccionObservaciones");
    const txtObs = document.getElementById("textoObservaciones");
    if (secObs && txtObs) {
        if (data.observaciones && data.observaciones.trim() !== "") {
            txtObs.textContent = data.observaciones;
            secObs.style.display = "block";
        } else {
            secObs.style.display = "none";
        }
    }
}

async function cargarEstadoPolla(usuarioId) {
    const token = localStorage.getItem("access_token");
    const res = await fetch(`${API}/api/polla/estado/${usuarioId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error consultando estado de polla");
    return data;
}

function pintarPolla(estado) {
    const p = document.querySelector("#Pollas .valor p");
    if (!p) return;

    let html = `#${String(estado.polla).padStart(2, '0')}`;
    p.innerHTML = html;
}

function renderHistorial(data) {
    const contenedor = document.getElementById("historialDashboard");
    if (!contenedor) return;

    const historial = Array.isArray(data.historial) ? data.historial : [];

    if (historial.length === 0) {
        contenedor.innerHTML = `
      <div class="sin-prestamos">
        <p>Aún no tienes movimientos registrados.</p>
      </div>
    `;
        return;
    }

    contenedor.innerHTML = historial.map(m => {
        const esEgreso = Number(m.monto || 0) < 0 || String(m.categoria || "").toLowerCase() === "egreso" || String(m.descripcion || "").toLowerCase().includes("descuento") || String(m.descripcion || "").toLowerCase().includes("penalizac");
        const montoAbs = Math.abs(Number(m.monto || 0));
        const montoTexto = esEgreso ? `-$${montoAbs.toLocaleString("es-CO")} COP` : formatearMoneda(m.monto);
        const iconoColor = esEgreso ? 'background: #ffe4e6; color: #e11d48;' : '';
        const iconoSvg = esEgreso
            ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
            : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="7" y1="8" x2="7" y2="12" /><line x1="12" y1="8" x2="12" y2="12" /></svg>`;

        return `
    <div class="movimiento">
      <div class="movimiento-info">
        <div class="movimiento-icono ${esEgreso ? '' : 'ingreso'}" style="${iconoColor}">
          ${iconoSvg}
        </div>
      </div>

      <div style="flex:1">
        <div style="font-weight:600">&nbsp;${m.tipo || "Movimiento"}</div>
        <div style="font-size:12px;opacity:.8">&nbsp;${m.descripcion || ""}</div>
      </div>

      <div class="movimiento-monto ${esEgreso ? 'negativo' : 'positivo'}" style="${esEgreso ? 'color: #e11d48; font-weight:700;' : ''}">${montoTexto}</div>
    </div>
  `;
    }).join("");
}

function infoprestamo() {
    const btnInfoPrestamo = document.getElementById("btnInfoPrestamo"); // ✅ ahora sí existe
    if (btnInfoPrestamo) {
        btnInfoPrestamo.style.display = "inline-flex";
        btnInfoPrestamo.onclick = () => window.location.href = "../pages/prestamos.html";
    }
}

function iniciarCuentaRegresiva() {
    const elClock = document.getElementById("countdownClock");
    if (!elClock) return;

    function actualizar() {
        const ahora = new Date();
        const year = ahora.getFullYear();
        let target = new Date(year, 11, 7, 0, 0, 0); // 7 de Diciembre (mes 11 en JS)

        if (ahora > target) {
            target = new Date(year + 1, 11, 7, 0, 0, 0);
        }

        const diff = target.getTime() - ahora.getTime();

        const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
        const horas = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutos = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        elClock.textContent = `${dias}d ${horas}h ${minutos}m`;
    }

    actualizar();
    setInterval(actualizar, 60000);
}

async function init() {
    activarUIAdmin();
    infoprestamo();
    iniciarCuentaRegresiva();

    if (!verificarSesion()) return;

    try {
        const usuario = getUsuarioLocal();
        const token = localStorage.getItem("access_token");

        // Carga simultánea y ultra rápida en paralelo de todas las APIs del dashboard
        const [data, estadoPollaRes, movRes] = await Promise.allSettled([
            cargarDashboard(),
            cargarEstadoPolla(usuario.id),
            fetch(`${API}/api/movimientos/${usuario.id}?limit=200`, {
                headers: token ? { "Authorization": `Bearer ${token}` } : {}
            })
        ]);

        if (data.status === "fulfilled") {
            pintarTarjetas(data.value);
            renderHistorial(data.value);
            console.log("Dashboard cargado desde el back ✅", data.value);
        } else {
            throw data.reason;
        }

        if (estadoPollaRes.status === "fulfilled") {
            pintarPolla(estadoPollaRes.value);
        } else {
            console.error("Error cargando polla:", estadoPollaRes.reason);
            const p = document.querySelector("#Pollas .valor p");
            if (p) p.innerHTML = `<span style="font-size: 1rem; color: var(--text-muted);">(Sin número asignado)</span>`;
        }

        if (movRes.status === "fulfilled" && movRes.value.ok) {
            const movData = await movRes.value.json();
            renderDashboardCharts(movData);
        }
    } catch (err) {
        console.error(err);
        alert(err.message || "Error cargando dashboard");
    }

    const btnEstadoPolla = document.getElementById("btnEstadoPolla");
    if (btnEstadoPolla) btnEstadoPolla.addEventListener("click", () => window.location.href = "../pages/polla.html");

    const btnCerrarSesion = document.getElementById("btnCerrarSesion");
    if (btnCerrarSesion) btnCerrarSesion.addEventListener("click", cerrarSesion);
}

init();

