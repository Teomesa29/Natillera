const API = "http://127.0.0.1:8000";

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
    } else {
        if (btnMontos) btnMontos.style.display = "none";
        if (btnPrestamo) btnPrestamo.style.display = "none";
        if (btnCrearUsuarios) btnCrearUsuarios.style.display = "none";
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

    // Si tienes tarjetas extra en el HTML, puedes pintarlas así:
    setText("#socios .valor p", `${data.socios_total}`);

    setText("#Prestamos .valor p", formatearMoneda(data.total_prestado));

    setText("#Pollas .valor p", `${data.numero_polla ?? ""}`);
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

    if (!estado.hay_resultado) {
        p.textContent = `${estado.polla} (sin sorteo aún)`;
        return;
    }

    p.textContent = estado.gano
        ? `${estado.polla} ✅ Felicidades eres el ganador de la polla de este mes! con el número: ${estado.comparacion.resultado_2}`
        : `${estado.polla} ❌ No ganaste, el último número ganador fue el ${estado.comparacion.resultado_2}`;
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

    contenedor.innerHTML = historial.map(m => `
    <div class="movimiento">
      <div class="movimiento-info">
        <div class="movimiento-icono ingreso">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <line x1="7" y1="8" x2="7" y2="12" />
            <line x1="12" y1="8" x2="12" y2="12" />
          </svg>
        </div>
      </div>

      <div style="flex:1">
        <div style="font-weight:600">&nbsp;${m.tipo || "Movimiento"}</div>
        <div style="font-size:12px;opacity:.8">&nbsp;${m.descripcion || ""}</div>
      </div>

      <div class="movimiento-monto positivo">${formatearMoneda(m.monto)}</div>
    </div>
  `).join("");
}

function infoprestamo() {
    const btnInfoPrestamo = document.getElementById("btnInfoPrestamo"); // ✅ ahora sí existe
    if (btnInfoPrestamo) {
        btnInfoPrestamo.style.display = "inline-flex";
        btnInfoPrestamo.onclick = () => window.location.href = "../pages/prestamos.html";
    }
}

async function init() {
    activarUIAdmin();
    infoprestamo();

    if (!verificarSesion()) return;

    try {
        const data = await cargarDashboard();
        pintarTarjetas(data);
        renderHistorial(data);

        // ✅ Polla: aquí adentro, porque init() es async
        const usuario = getUsuarioLocal();
        const estado = await cargarEstadoPolla(usuario.id);
        pintarPolla(estado);

        console.log("Dashboard cargado desde el back ✅", data);
    } catch (err) {
        console.error(err);
        alert(err.message || "Error cargando dashboard");
    }

    const btnCerrarSesion = document.getElementById("btnCerrarSesion");
    if (btnCerrarSesion) btnCerrarSesion.addEventListener("click", cerrarSesion);
}

init();

