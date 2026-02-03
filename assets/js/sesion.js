const API = window.API_BASE || "http://127.0.0.1:8000";

function cerrarSesion() {
    localStorage.removeItem("sesionActiva");
    localStorage.removeItem("usuario");
    localStorage.removeItem("access_token");
    window.location.href = "../index.html";
}

document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("btnCerrarSesion");
    if (btn) btn.addEventListener("click", cerrarSesion);
});
