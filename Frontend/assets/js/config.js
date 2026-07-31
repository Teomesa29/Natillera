const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
window.API_BASE = window.API_BASE || localStorage.getItem("API_BASE") || (isLocal ? "http://127.0.0.1:8000" : "https://natillera.onrender.com");
