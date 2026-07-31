const API = window.API_BASE || localStorage.getItem("API_BASE") || "http://127.0.0.1:8000";

/* ------------------ Modal ------------------ */
function setupModal() {
    const overlay = document.getElementById("modalOverlay");
    const titleEl = document.getElementById("modalTitle");
    const textEl = document.getElementById("modalText");
    const iconEl = document.getElementById("modalIcon");
    const btnOk = document.getElementById("btnModalOk");

    if (!overlay || !titleEl || !textEl || !iconEl || !btnOk) return null;

    function show({ title, text, ok = true }) {
        titleEl.textContent = title;
        textEl.textContent = text;
        iconEl.textContent = ok ? "✅" : "❌";

        const modal = overlay.querySelector(".modal");
        if (modal) {
            modal.style.borderTopColor = ok ? "var(--color-mis-ahorros)" : "var(--color-prestamos)";
        }
        iconEl.style.background = ok ? "rgba(0,184,148,.14)" : "rgba(214,48,49,.12)";

        overlay.classList.remove("hidden");
        overlay.setAttribute("aria-hidden", "false");
    }

    function close() {
        overlay.classList.add("hidden");
        overlay.setAttribute("aria-hidden", "true");
    }

    btnOk.addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") close();
    });

    return { show, close };
}

function getUsuarioSesion() {
    try {
        return JSON.parse(localStorage.getItem("usuario") || "null");
    } catch {
        return null;
    }
}

function protegerAdmin() {
    const sesion = localStorage.getItem("sesionActiva");
    const user = getUsuarioSesion();
    if (!sesion || !user) {
        window.location.href = "../index.html";
        return false;
    }
    if (user.rol !== "admin") {
        window.location.href = "./dashboard.html";
        return false;
    }
    return true;
}

function cerrarSesion() {
    localStorage.removeItem("sesionActiva");
    localStorage.removeItem("usuario");
    localStorage.removeItem("access_token");
    window.location.href = "../index.html";
}

/* ------------------ API ------------------ */
async function crearUsuario(payload) {
    const token = localStorage.getItem("access_token");
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API}/api/crear_usuario`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
    });

    let data = {};
    try {
        data = await res.json();
    } catch {
    }

    if (!res.ok) throw new Error(data.detail || "Error creando usuario");
    return data;
}

async function cargarTablaUsuarios() {
    const body = document.getElementById("bodyListaUsuarios");
    if (!body) return;

    try {
        const token = localStorage.getItem("access_token");
        const headers = token ? { "Authorization": `Bearer ${token}` } : {};
        const res = await fetch(`${API}/api/usuarios`, { headers });
        const usuarios = await res.json();

        if (!Array.isArray(usuarios) || usuarios.length === 0) {
            body.innerHTML = `<tr><td colspan="6" style="padding: 15px; text-align: center; color: var(--text-muted);">No hay socios registrados.</td></tr>`;
            return;
        }

        body.innerHTML = usuarios.map(u => `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 12px; font-weight: 700; color: var(--text-main);">${u.nombre}</td>
                <td style="padding: 12px; color: var(--text-muted);">${u.usuario}</td>
                <td style="padding: 12px;">${u.telefono || '-'}</td>
                <td style="padding: 12px; font-weight: 800; color: #ec4899;">#${String(u.polla || 0).padStart(2, '0')}</td>
                <td style="padding: 12px;"><span style="background: ${u.rol === 'admin' ? '#e0e7ff' : '#f1f5f9'}; color: ${u.rol === 'admin' ? '#4f46e5' : '#64748b'}; padding: 4px 10px; border-radius: 999px; font-weight: 700; font-size: 0.8rem;">${u.rol.toUpperCase()}</span></td>
                <td style="padding: 12px; text-align: center;">
                    <button class="btn-peligro-sm" onclick="eliminarUsuarioId(${u.id}, '${u.nombre}')" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 0.8rem;">🗑️ Eliminar</button>
                </td>
            </tr>
        `).join("");
    } catch (err) {
        console.error("Error cargando usuarios:", err);
    }
}

async function eliminarUsuarioId(id, nombre) {
    if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente al socio "${nombre}"? Se borrarán sus ahorros, movimientos y préstamos.`)) return;

    try {
        const token = localStorage.getItem("access_token");
        const headers = token ? { "Authorization": `Bearer ${token}` } : {};
        const res = await fetch(`${API}/api/usuarios/${id}`, {
            method: "DELETE",
            headers
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Error al eliminar usuario");

        alert(`✅ ${data.mensaje}`);
        await cargarTablaUsuarios();
    } catch (err) {
        alert(`❌ ${err.message}`);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    if (!protegerAdmin()) return;

    const modal = setupModal();
    cargarTablaUsuarios();

    // ✅ Cerrar sesión
    const btnCerrar = document.getElementById("btnCerrarSesion");
    if (btnCerrar) btnCerrar.addEventListener("click", cerrarSesion);

    const form = document.getElementById("formCrearUsuario");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const payload = {
            usuario: document.getElementById("usuario").value.toLowerCase().trim(),
            nombre: document.getElementById("nombre").value.trim(),
            telefono: document.getElementById("telefono").value.trim() || null,
            polla: document.getElementById("polla").value.trim() || null,
            email: document.getElementById("email").value.trim() || null,
            password: document.getElementById("password").value,
            rol: document.getElementById("rol").value,
            ahorro_mensual: Number(document.getElementById("ahorro_mensual").value || 0),
            porcentaje_interes: Number(document.getElementById("porcentaje_interes").value || 8.5),
        };

        try {
            const r = await crearUsuario(payload);

            // ✅ Modal éxito
            if (modal) {
                modal.show({
                    title: "Usuario creado",
                    text: `Se creó el usuario: ${r.usuario.usuario}`,
                    ok: true,
                });
            } else {
                alert(`Usuario creado: ${r.usuario.usuario}`);
            }

            form.reset();
            document.getElementById("ahorro_mensual").value = 0;
            document.getElementById("porcentaje_interes").value = 8.5;
            document.getElementById("rol").value = "socio";

            await cargarTablaUsuarios();
        } catch (err) {
            console.error(err);

            // ✅ Modal error
            if (modal) {
                modal.show({
                    title: "Error creando usuario",
                    text: err.message || "No se pudo crear el usuario.",
                    ok: false,
                });
            } else {
                alert(err.message || "Error creando usuario");
            }
        }
    });
});
