const API = "http://127.0.0.1:8000";

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

document.addEventListener("DOMContentLoaded", () => {
    if (!protegerAdmin()) return;

    const modal = setupModal();

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
