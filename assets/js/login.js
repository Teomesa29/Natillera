const API = window.API_BASE || "http://127.0.0.1:8000";

const formulario = document.querySelector('.login-form');
const mensajeDiv = document.getElementById('mensaje');

function mostrarMensaje(texto, tipo = 'error') {
    mensajeDiv.textContent = texto;
    mensajeDiv.className = tipo === 'error' ? 'mensaje-error' : 'mensaje-exito';
    mensajeDiv.classList.add('mostrar');
    setTimeout(() => mensajeDiv.classList.remove('mostrar'), 4000);
}

async function hacerLogin(usuario, password) {
    const res = await fetch(`${API}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Error login");

    // ✅ NUEVO: token + sesión “vieja” (para que el dashboard no rebote)
    localStorage.setItem("access_token", data.access_token);

    localStorage.setItem("sesionActiva", "true"); // tu dashboard espera esto
    localStorage.setItem("usuarioActivo", data.usuario.usuario); // o el username
    localStorage.setItem("nombreUsuario", data.usuario.nombre);
    localStorage.setItem("rolUsuario", data.usuario.rol);

    // opcional pero útil: guardar usuario completo
    localStorage.setItem("usuario", JSON.stringify(data.usuario));

    return data.usuario;
}

formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const usuario = document.getElementById("usuario").value.toLowerCase().trim();
    const password = document.getElementById("password").value;

    if (!usuario || !password) {
        mostrarMensaje("Por favor, completa todos los campos");
        return;
    }

    try {
        await hacerLogin(usuario, password);
        mostrarMensaje("¡Bienvenido! Redirigiendo...", "exito");
        setTimeout(() => {
            window.location.href = "pages/dashboard.html";
        }, 500);
    } catch (e) {
        mostrarMensaje(e.message || "Error login");
    }
});
