const API = window.API_BASE || "http://127.0.0.1:8000";

function verificarSesion(rolRequerido = null) {
    const sesion = localStorage.getItem("sesionActiva");
    const rol = localStorage.getItem("rolUsuario");

    if (!sesion) {
        window.location.href = "../index.html";
        return;
    }

    if (rolRequerido && rol !== rolRequerido) {
        alert("No tienes permisos para acceder");
        window.location.href = "../pages/dashboard.html";
    }
}
