const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const API = window.API_BASE || localStorage.getItem("API_BASE") || (isLocal ? "http://127.0.0.1:8000" : "https://natillera.onrender.com");

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

// Modal Logic
const forgotModal = document.getElementById('forgotModal');
const btnForgot = document.getElementById('btnForgot');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnSubmitForgot = document.getElementById('btnSubmitForgot');
const forgotMessage = document.getElementById('forgotMessage');

btnForgot.addEventListener('click', () => {
    forgotModal.classList.remove('hidden');
});

btnCloseModal.addEventListener('click', () => {
    forgotModal.classList.add('hidden');
});

// Cerrar al hacer clic fuera
forgotModal.addEventListener('click', (e) => {
    if (e.target === forgotModal) {
        forgotModal.classList.add('hidden');
    }
});

let resetStep = 1;

btnSubmitForgot.addEventListener('click', async () => {
    const email = document.getElementById('forgotEmail').value.trim();
    const phone = document.getElementById('forgotPhone').value.trim();
    const newPasswordGroup = document.getElementById('newPasswordGroup');
    const newPasswordInput = document.getElementById('forgotNewPassword');

    if (resetStep === 1) {
        if (!email || !phone) {
            forgotMessage.textContent = 'Por favor ingresa correo y celular.';
            forgotMessage.className = 'mensaje-error mostrar';
            setTimeout(() => forgotMessage.classList.remove('mostrar'), 3000);
            return;
        }

        // Mostrar el campo de contraseña
        newPasswordGroup.classList.remove('hidden');
        btnSubmitForgot.querySelector('span').textContent = "Confirmar Nueva Contraseña";
        resetStep = 2;

    } else if (resetStep === 2) {
        const newPassword = newPasswordInput.value;
        if (!newPassword || newPassword.length < 4) {
            forgotMessage.textContent = 'La contraseña debe tener al menos 4 caracteres.';
            forgotMessage.className = 'mensaje-error mostrar';
            setTimeout(() => forgotMessage.classList.remove('mostrar'), 3000);
            return;
        }

        try {
            btnSubmitForgot.querySelector('span').textContent = "Enviando...";
            const res = await fetch(`${API}/api/recuperar-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email, celular: phone, nueva_password: newPassword }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Error al actualizar contraseña");

            forgotMessage.textContent = '¡Contraseña actualizada exitosamente!';
            forgotMessage.className = 'mensaje-exito mostrar';
            
            setTimeout(() => {
                forgotModal.classList.add('hidden');
                // Resetear form
                resetStep = 1;
                newPasswordGroup.classList.add('hidden');
                btnSubmitForgot.querySelector('span').textContent = "Actualizar Contraseña";
                document.getElementById('forgotEmail').value = '';
                document.getElementById('forgotPhone').value = '';
                newPasswordInput.value = '';
                forgotMessage.classList.remove('mostrar');
                forgotMessage.className = 'mensaje-error';
            }, 2500);

        } catch (e) {
            forgotMessage.textContent = e.message || "Error al restablecer contraseña";
            forgotMessage.className = 'mensaje-error mostrar';
            btnSubmitForgot.querySelector('span').textContent = "Confirmar Nueva Contraseña";
        }
    }
});

// ==========================================
// ANIMACIÓN INTERACTIVA DE ESTRELLAS (CANVAS)
// ==========================================
const canvas = document.getElementById('starfield');
const ctx = canvas.getContext('2d');

let stars = [];
let mouse = { x: 0, y: 0 };
let isClicking = false;

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

class Star {
    constructor() {
        this.reset();
        // Dispersión inicial aleatoria
        this.z = Math.random() * canvas.width;
    }

    reset() {
        this.x = (Math.random() - 0.5) * canvas.width * 2;
        this.y = (Math.random() - 0.5) * canvas.height * 2;
        this.z = canvas.width;
        this.speed = Math.random() * 2 + 0.5;
        this.color = `hsla(${220 + Math.random() * 60}, 100%, ${80 + Math.random() * 20}%, ${0.5 + Math.random() * 0.5})`;
    }

    update() {
        // Al hacer clic, las estrellas aceleran estilo "Warp Speed"
        let currentSpeed = isClicking ? this.speed * 8 : this.speed;
        this.z -= currentSpeed;

        if (this.z <= 0) {
            this.reset();
        }
    }

    draw() {
        // Proyección 3D a 2D
        let x = (this.x / this.z) * canvas.width + canvas.width / 2;
        let y = (this.y / this.z) * canvas.height + canvas.height / 2;
        
        let radius = Math.max(0, (1 - this.z / canvas.width) * 2);

        // Efecto de interacción con el ratón
        let dx = x - mouse.x;
        let dy = y - mouse.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 100) {
            // Alejar levemente las estrellas del cursor
            x += (dx / dist) * 10;
            y += (dy / dist) * 10;
            radius *= 2;
            ctx.shadowBlur = 15;
            ctx.shadowColor = this.color;
        } else {
            ctx.shadowBlur = 0;
        }

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}

for (let i = 0; i < 400; i++) {
    stars.push(new Star());
}

// Eventos de interacción
window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});
window.addEventListener('mousedown', () => isClicking = true);
window.addEventListener('mouseup', () => isClicking = false);
window.addEventListener('touchstart', (e) => {
    mouse.x = e.touches[0].clientX;
    mouse.y = e.touches[0].clientY;
    isClicking = true;
});
window.addEventListener('touchend', () => isClicking = false);

function animate() {
    // Rastro para dar efecto de movimiento rápido
    ctx.fillStyle = 'rgba(10, 5, 20, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    stars.forEach(star => {
        star.update();
        star.draw();
    });
    requestAnimationFrame(animate);
}

animate();

// =========================================================================
// CHROMA KEY ENGINE EN TIEMPO REAL (EXTRACCIÓN DE FONDO VERDE DE CERDITO.MP4)
// =========================================================================
(function initChromaKey() {
    const video = document.getElementById('videoPiggy');
    const canvasPiggy = document.getElementById('canvasPiggy');

    if (!video || !canvasPiggy) return;

    const ctxPiggy = canvasPiggy.getContext('2d', { willReadFrequently: true });

    function processFrame() {
        if (!video.paused && !video.ended) {
            if (canvasPiggy.width !== video.videoWidth && video.videoWidth > 0) {
                canvasPiggy.width = video.videoWidth;
                canvasPiggy.height = video.videoHeight;
            }

            if (canvasPiggy.width > 0) {
                ctxPiggy.drawImage(video, 0, 0, canvasPiggy.width, canvasPiggy.height);
                const frame = ctxPiggy.getImageData(0, 0, canvasPiggy.width, canvasPiggy.height);
                const data = frame.data;
                const len = data.length;

                // Optimización ultra rápida iterando de 4 en 4 bytes
                for (let i = 0; i < len; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];

                    // Si la componente verde es muy brillante y dominante, hacer transparente
                    if (g > 95 && g > r * 1.3 && g > b * 1.3) {
                        data[i + 3] = 0;
                    }
                }
                ctxPiggy.putImageData(frame, 0, 0);
            }
        }
        requestAnimationFrame(processFrame);
    }

    const startPlay = () => {
        video.play().then(() => {
            processFrame();
        }).catch(err => {
            console.log("Autoplay:", err);
        });
    };

    video.addEventListener('play', () => {
        processFrame();
    });

    video.addEventListener('canplay', startPlay);
    video.addEventListener('loadeddata', startPlay);

    if (video.readyState >= 2) {
        startPlay();
    }
})();
