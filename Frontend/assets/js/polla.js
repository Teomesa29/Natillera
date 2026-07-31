const API = window.API_BASE || localStorage.getItem("API_BASE") || ((window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") ? "http://127.0.0.1:8000" : "https://natillera.onrender.com");

async function apiFetch(path, options = {}) {
    const token = localStorage.getItem("access_token");
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API}${path}`, { ...options, headers });
    let data = null;
    try { data = await res.json(); } catch {}
    
    if (!res.ok) throw new Error(data?.detail || data?.mensaje || "Error en la petición");
    return data;
}

function renderSocios(usuarios) {
    const contenedor = document.getElementById("listaSocios");
    if (!usuarios || usuarios.length === 0) {
        contenedor.innerHTML = "<p>No hay socios registrados.</p>";
        return;
    }

    // Filtrar los que tienen polla asignada y ordenar por número
    const activos = usuarios.filter(u => u.polla != null).sort((a, b) => {
        const pa = Number(String(a.polla).slice(-2)) || 0;
        const pb = Number(String(b.polla).slice(-2)) || 0;
        return pa - pb;
    });
    
    contenedor.innerHTML = activos.map(u => {
        const numFormat = String(u.polla).padStart(2, '0');
        return `
        <div class="polla-item">
            <span><strong>${u.nombre || u.usuario}</strong></span>
            <span class="numero-polla">${numFormat}</span>
        </div>
    `}).join("");
}

function renderHistorial(historial, usuarios) {
    const contenedor = document.getElementById("historialPolla");
    if (!historial || historial.length === 0) {
        contenedor.innerHTML = "<p>Aún no hay resultados registrados.</p>";
        return;
    }

    // Mapear números a nombres para encontrar al ganador
    const mapSocios = {};
    usuarios.forEach(u => {
        if (u.polla != null) {
            const ultimos2 = String(u.polla).slice(-2).padStart(2, '0');
            mapSocios[ultimos2] = u.nombre || u.usuario;
        }
    });

    contenedor.innerHTML = historial.map(r => {
        const fecha = r.date ? r.date.slice(0, 10) : "";
        const ganadorSocio = mapSocios[r.ganador];
        const ganadorBadge = ganadorSocio 
            ? `<span class="ganador-badge">🏆 Ganó: ${ganadorSocio}</span>` 
            : `<span class="ganador-badge" style="background: #f1f5f9; color: #64748b; border: 1px solid rgba(100,116,139,0.15)">Nadie ganó</span>`;

        return `
        <div class="polla-item" style="align-items: center; padding: 16px 0;">
            <div>
                <strong style="color: var(--text-main); font-size: 1.05rem;">${fecha}</strong><br>
                <small style="color: var(--text-muted); font-weight: 500;">${r.lottery} (Serie ${r.series || "N/A"})</small>
            </div>
            <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                <span style="font-weight: 800; color: var(--text-main); font-size: 1.25rem; letter-spacing: -0.01em;">${r.result}</span>
                <small style="color: var(--text-muted); font-weight: 600;">Terminación: <strong style="color: var(--color-pollas); font-weight: 800;">${r.ganador}</strong></small>
                ${ganadorBadge}
            </div>
        </div>
    `}).join("");
}

async function cargarDatos() {
    try {
        const [usuarios, historial] = await Promise.all([
            apiFetch("/api/usuarios"),
            apiFetch("/api/polla/historial")
        ]);
        
        renderSocios(usuarios);
        renderHistorial(historial, usuarios);
    } catch (err) {
        console.error(err);
        const contS = document.getElementById("listaSocios");
        const contH = document.getElementById("historialPolla");
        if (contS) contS.innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
        if (contH) contH.innerHTML = `<p style="color:red">Error: ${err.message}</p>`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    if (!localStorage.getItem("access_token")) {
        window.location.href = "../index.html";
        return;
    }
    cargarDatos();

    const btnCerrar = document.getElementById("btnCerrarSesion");
    if (btnCerrar) {
        btnCerrar.addEventListener("click", () => {
            localStorage.clear();
            window.location.href = "../index.html";
        });
    }
});
