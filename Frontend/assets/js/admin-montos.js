const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const API = window.API_BASE || localStorage.getItem("API_BASE") || (isLocal ? "http://127.0.0.1:8000" : "https://natillera.onrender.com");

// Anti-recarga por submits accidentales
window.addEventListener("submit", (e) => e.preventDefault(), true);

function authHeaders() {
    const token = localStorage.getItem("access_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path, options = {}) {
    const res = await fetch(`${API}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
            ...authHeaders(),
        },
    });

    let data = null;
    try { data = await res.json(); } catch { /* ignore */ }

    if (!res.ok) {
        const msg = (data && (data.detail || data.mensaje))
            ? (data.detail || data.mensaje)
            : `Error HTTP ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

function formatearMoneda(valor) {
    const n = Number(valor || 0);
    return `$${n.toLocaleString("es-CO")} COP`;
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

function toTimeSafe(fechaISO) {
    const d = new Date(fechaISO);
    const t = d.getTime();
    return Number.isNaN(t) ? 0 : t;
}

function ordenarMovimientosDesc(movs) {
    return [...(movs || [])].sort((a, b) => {
        const pa = parseMesDescripcion(a.descripcion);
        const pb = parseMesDescripcion(b.descripcion);
        if (pa && pb) {
            const va = pa.year * 12 + pa.mesIndex;
            const vb = pb.year * 12 + pb.mesIndex;
            return vb - va;
        }
        if (pa && !pb) return -1;
        if (!pa && pb) return 1;

        return toTimeSafe(b.fecha) - toTimeSafe(a.fecha);
    });
}

function renderCharts(pagadosAporte, pendientesAporte, pagadosPolla, pendientesPolla) {
    const totalAporte = (pagadosAporte + pendientesAporte) || 12;
    const totalPolla = (pagadosPolla + pendientesPolla) || 12;

    const pctAporte = Math.round((pagadosAporte / totalAporte) * 100);
    const pctPolla = Math.round((pagadosPolla / totalPolla) * 100);

    const fillAporte = document.getElementById("adminAporteFill");
    const labelAporte = document.getElementById("adminAporteLabel");
    if (fillAporte && labelAporte) {
        fillAporte.style.width = `${pctAporte}%`;
        labelAporte.textContent = `${pagadosAporte} de ${totalAporte} meses pagados (${pctAporte}%)`;
    }

    const fillPolla = document.getElementById("adminPollaFill");
    const labelPolla = document.getElementById("adminPollaLabel");
    if (fillPolla && labelPolla) {
        fillPolla.style.width = `${pctPolla}%`;
        labelPolla.textContent = `${pagadosPolla} de ${totalPolla} meses pagados (${pctPolla}%)`;
    }
}

function llenarSelectMesesInteligente(movs) {
    const selectAporte = document.getElementById("selectMesAporte");
    const selectPolla = document.getElementById("selectMesPolla");
    if (!selectAporte || !selectPolla) return;

    selectAporte.innerHTML = "";
    selectPolla.innerHTML = "";

    const aportados = new Set();
    const pollas = new Set();

    for (const m of (movs || [])) {
        if (String(m.tipo || "").toLowerCase().includes("aporte")) {
            const p = parseMesDescripcion(m.descripcion);
            if (p) aportados.add(`${p.year}-${p.mesIndex}`);
        }
        if (String(m.tipo || "").toLowerCase().includes("polla")) {
            const p = parseMesDescripcion(m.descripcion);
            if (p) pollas.add(`${p.year}-${p.mesIndex}`);
        }
    }

    const now = new Date();
    // Asumimos que la natillera corre en el año actual
    const startYear = now.getFullYear();
    
    let faltanAportes = 0;
    let faltanPollas = 0;
    let totalMeses = 12;

    for (let i = 0; i < 12; i++) {
        const key = `${startYear}-${i}`;
        
        if (!aportados.has(key)) {
            const opt = document.createElement("option");
            opt.value = `${MESES[i]}|${startYear}`;
            opt.textContent = `${MESES[i]} ${startYear}`;
            selectAporte.appendChild(opt);
            faltanAportes++;
        }
        
        if (!pollas.has(key)) {
            const opt = document.createElement("option");
            opt.value = `${MESES[i]}|${startYear}`;
            opt.textContent = `${MESES[i]} ${startYear}`;
            selectPolla.appendChild(opt);
            faltanPollas++;
        }
    }

    if (selectAporte.options.length === 0) {
        selectAporte.innerHTML = `<option value="" disabled selected>Todo pagado 🎉</option>`;
    }
    if (selectPolla.options.length === 0) {
        selectPolla.innerHTML = `<option value="" disabled selected>Todo pagado 🎉</option>`;
    }

    renderCharts(totalMeses - faltanAportes, faltanAportes, totalMeses - faltanPollas, faltanPollas);
    return totalMeses - faltanAportes; // Para cálculos
}

function calcularSaldoConInteres(aporteMensual, mesesAportados, tasaMensualPct) {
    let saldo = 0;
    for (let i = 0; i < mesesAportados; i++) {
        saldo = (saldo + aporteMensual) * (1 + (tasaMensualPct / 100));
    }
    const totalAportado = aporteMensual * mesesAportados;
    const intereses = saldo - totalAportado;
    return { totalAportado, totalAhorrado: saldo, intereses };
}

function mostrarMensaje(texto, esError = false) {
    const el = document.getElementById("mensaje");
    if (!el) return;

    el.textContent = texto;
    el.style.display = "block";
    el.style.padding = "15px 20px";
    el.style.marginTop = "20px";
    el.style.borderRadius = "12px";
    el.style.fontWeight = "600";
    el.style.background = esError ? "#fff1f2" : "#ecfdf5";
    el.style.color = esError ? "#e11d48" : "#059669";
    el.style.boxShadow = "0 4px 15px rgba(0,0,0,0.05)";
    el.style.transition = "all 0.3s ease";

    clearTimeout(el._timer);
    el._timer = setTimeout(() => {
        el.style.opacity = "0";
        setTimeout(() => el.style.display = "none", 300);
        el.style.opacity = "1";
    }, 4000);
}

function renderHistorial(movs, nombreSocio = "") {
    const cont = document.getElementById("historialAdmin");
    if (!cont) return;

    const ordenados = ordenarMovimientosDesc(movs);

    if (!Array.isArray(ordenados) || ordenados.length === 0) {
        cont.innerHTML = `<div class="sin-prestamos"><p>Aún no hay movimientos.</p></div>`;
        return;
    }

    cont.innerHTML = ordenados.slice(0, 5).map(m => {
        const fecha = (m.fecha || "").slice(0, 10) || "-";
        const detalle = m.descripcion || m.tipo || "-";
        const esEgreso = Number(m.monto || 0) < 0 || String(m.categoria || "").toLowerCase() === "egreso" || detalle.toLowerCase().includes("descuento") || detalle.toLowerCase().includes("penalizac");
        
        let iconHtml = '';
        if (esEgreso) {
            iconHtml = `<div class="movimiento-icono" style="width: 40px; height: 40px; border-radius: 12px; background: #ffe4e6; color: #e11d48;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg></div>`;
        } else if (detalle.toLowerCase().includes("aporte")) {
            iconHtml = `<div class="movimiento-icono ingreso" style="width: 40px; height: 40px; border-radius: 12px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="7" y1="8" x2="7" y2="12" /><line x1="12" y1="8" x2="12" y2="12" /></svg></div>`;
        } else if (detalle.toLowerCase().includes("polla")) {
            iconHtml = `<div class="movimiento-icono" style="width: 40px; height: 40px; border-radius: 12px; background: #fce7f3; color: #ec4899;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4l3 3"></path></svg></div>`;
        } else {
            iconHtml = `<div class="movimiento-icono interes" style="width: 40px; height: 40px; border-radius: 12px;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg></div>`;
        }

        const montoAbs = Math.abs(Number(m.monto || 0));
        const montoTexto = esEgreso ? `-$${montoAbs.toLocaleString("es-CO")} COP` : formatearMoneda(m.monto);
        const socioTag = nombreSocio ? `<span style="font-weight: 700; color: #4f46e5;">[${nombreSocio}]</span> ` : '';

        return `
      <div class="movimiento" style="margin-bottom: 10px;">
        <div class="movimiento-info">
            ${iconHtml}
            <div class="movimiento-detalle">
                <p class="movimiento-titulo" style="font-size: 0.95rem;">${socioTag}${detalle}</p>
                <p class="movimiento-fecha">${fecha}</p>
            </div>
        </div>
        <div class="movimiento-monto ${esEgreso ? 'negativo' : 'positivo'}" style="${esEgreso ? 'color: #e11d48; font-weight: 700;' : 'font-size: 1.1rem;'}">${montoTexto}</div>
      </div>
    `;
    }).join("");
}

let listaUsuariosGlobal = [];

async function cargarUsuarios() {
    const select = document.getElementById("selectUsuario");
    listaUsuariosGlobal = await apiFetch("/api/usuarios");

    select.innerHTML = "";
    listaUsuariosGlobal.forEach(u => {
        const opt = document.createElement("option");
        opt.value = String(u.id);
        opt.textContent = u.nombre;
        select.appendChild(opt);
    });

    return listaUsuariosGlobal;
}

let pieChartAportesObj = null;
let pieChartPollasObj = null;

function renderMiniPieCharts(totalPagosAporte, totalPagosPolla, totalEsperado) {
    const ctxAportes = document.getElementById("miniPieAportesCanvas");
    const ctxPollas = document.getElementById("miniPiePollasCanvas");
    if (!ctxAportes || !ctxPollas || !window.Chart) return;

    const pctAportes = totalEsperado > 0 ? Math.round((totalPagosAporte / totalEsperado) * 100) : 0;
    const pctPollas = totalEsperado > 0 ? Math.round((totalPagosPolla / totalEsperado) * 100) : 0;

    const elTextoAporte = document.getElementById("miniPieAportesTexto");
    const elSubAporte = document.getElementById("miniPieAportesSub");
    if (elTextoAporte) elTextoAporte.textContent = `${pctAportes}%`;
    if (elSubAporte) elSubAporte.textContent = `${totalPagosAporte} de ${totalEsperado} pagos globales`;

    const elTextoPolla = document.getElementById("miniPiePollasTexto");
    const elSubPolla = document.getElementById("miniPiePollasSub");
    if (elTextoPolla) elTextoPolla.textContent = `${pctPollas}%`;
    if (elSubPolla) elSubPolla.textContent = `${totalPagosPolla} de ${totalEsperado} pagos globales`;

    if (pieChartAportesObj) pieChartAportesObj.destroy();
    pieChartAportesObj = new Chart(ctxAportes, {
        type: 'doughnut',
        data: {
            labels: ['Pagado', 'Pendiente'],
            datasets: [{
                data: [totalPagosAporte, Math.max(0, totalEsperado - totalPagosAporte)],
                backgroundColor: ['#4f46e5', '#e2e8f0'],
                borderWidth: 0
            }]
        },
        options: {
            cutout: '72%',
            plugins: { legend: { display: false }, tooltip: { enabled: true } },
            responsive: true,
            maintainAspectRatio: false
        }
    });

    if (pieChartPollasObj) pieChartPollasObj.destroy();
    pieChartPollasObj = new Chart(ctxPollas, {
        type: 'doughnut',
        data: {
            labels: ['Pagado', 'Pendiente'],
            datasets: [{
                data: [totalPagosPolla, Math.max(0, totalEsperado - totalPagosPolla)],
                backgroundColor: ['#ec4899', '#e2e8f0'],
                borderWidth: 0
            }]
        },
        options: {
            cutout: '72%',
            plugins: { legend: { display: false }, tooltip: { enabled: true } },
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

async function cargarMatrizPagos() {
    const bodyHabito = document.getElementById("bodyHabitoPagos");
    const bodyMatriz = document.getElementById("bodyMatrizPagos");
    const footMatriz = document.getElementById("footMatrizPagos");

    try {
        const data = await apiFetch("/api/admin/matriz_pagos");
        const usuarios = data.usuarios || [];

        if (usuarios.length === 0) {
            if (bodyHabito) bodyHabito.innerHTML = `<tr><td colspan="14" style="text-align:center; padding: 20px; color: var(--text-muted);">No hay socios registrados.</td></tr>`;
            if (bodyMatriz) bodyMatriz.innerHTML = `<tr><td colspan="14" style="text-align:center; padding: 20px; color: var(--text-muted);">No hay socios registrados.</td></tr>`;
            return;
        }

        let globalAportesCount = 0;
        let globalPollasCount = 0;
        const totalEsperadoGlobal = usuarios.length * 12;

        // 1. Rellenar Hábito de Pago (Bloques de colores estilo Datacrédito)
        if (bodyHabito) {
            bodyHabito.innerHTML = usuarios.map(u => {
                let trHtml = `
                    <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                        <td style="padding: 12px; font-weight: 700; color: var(--text-main); position: sticky; left: 0; background: white; z-index: 1;">
                            ${u.nombre} <span style="font-size: 0.75rem; color: #ec4899; font-weight: 800;">(#${String(u.polla_numero || 0).padStart(2, '0')})</span>
                        </td>
                `;

                for (let m = 0; m < 12; m++) {
                    const pago = u.pagos_meses[m];
                    let bgBox = '#e2e8f0'; // Pendiente / Sin información
                    let titleText = 'Sin pago registrado';

                    if (pago.aporte) globalAportesCount++;
                    if (pago.polla) globalPollasCount++;

                    if (pago.tiene_ajuste) {
                        bgBox = '#f97316'; // Ajuste / Descuento (Naranja)
                        titleText = `Ajuste/Descuento: ${pago.motivo_ajuste || "Ajuste registrado"}`;
                    } else if (pago.aporte && pago.polla) {
                        bgBox = '#10b981'; // Al día (Verde Datacrédito)
                        titleText = 'Al día (Aporte + Polla)';
                    } else if (pago.aporte) {
                        bgBox = '#3b82f6'; // Solo Aporte (Azul)
                        titleText = 'Aporte pagado (Polla pendiente)';
                    } else if (pago.polla) {
                        bgBox = '#ec4899'; // Solo Polla (Rosa)
                        titleText = 'Polla pagada (Aporte pendiente)';
                    }

                    const nombreLimpio = String(u.nombre || "").replace(/"/g, '&quot;');
                    trHtml += `
                        <td style="padding: 8px 4px; text-align: center;">
                            <div class="celda-mes-interactiva" data-usuario-id="${u.usuario_id}" data-nombre="${nombreLimpio}" data-mes-idx="${m}" data-mes-nombre="${MESES[m]}" data-tiene-aporte="${pago.aporte ? 'true' : 'false'}" data-tiene-polla="${pago.polla ? 'true' : 'false'}" data-monto-aporte="${pago.monto_aporte || u.ahorro_mensual || 0}" title="${titleText} (Haz clic para modificar o editar cuota)" style="width: 28px; height: 28px; background: ${bgBox}; border-radius: 6px; margin: 0 auto; cursor: pointer; transition: transform 0.15s ease;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'"></div>
                        </td>
                    `;
                }

                // Detectar meses pendientes para recordatorio
                const mesActualIdx = new Date().getMonth();
                let tienePendiente = false;
                for (let m = 0; m <= mesActualIdx; m++) {
                    if (!u.pagos_meses[m].aporte || !u.pagos_meses[m].polla) {
                        tienePendiente = true;
                        break;
                    }
                }

                let btnWppHtml = '';
                if (tienePendiente) {
                    let numTel = String(u.telefono || "").replace(/\D/g, "");
                    if (numTel && !numTel.startsWith("57") && numTel.length === 10) {
                        numTel = "57" + numTel;
                    }
                    const msgWpp = encodeURIComponent(`Hola ${u.nombre}, ¡espero te encuentres muy bien! 👋 Te escribo para recordarte amablemente tu pago pendiente de la Natillera. Quedamos atentos, ¡muchas gracias!`);
                    const wppUrl = numTel ? `https://wa.me/${numTel}?text=${msgWpp}` : `https://wa.me/?text=${msgWpp}`;
                    btnWppHtml = `<a href="${wppUrl}" target="_blank" title="Enviar recordatorio por WhatsApp" style="display: inline-flex; align-items: center; justify-content: center; background: #25d366; color: white; border-radius: 8px; padding: 6px 10px; text-decoration: none; font-size: 0.8rem; font-weight: 700; gap: 4px; transition: transform 0.2s ease;" onmouseover="this.style.transform='scale(1.08)'" onmouseout="this.style.transform='scale(1)'">💬 Cobrar</a>`;
                } else {
                    btnWppHtml = `<span style="color: #10b981; font-weight: 700; font-size: 0.8rem;">🌟 Al día</span>`;
                }

                trHtml += `
                        <td style="padding: 12px; text-align: right; font-weight: 800; color: #10b981;">
                            ${formatearMoneda(u.total_ahorrado)}
                        </td>
                        <td style="padding: 12px; text-align: center;">
                            ${btnWppHtml}
                        </td>
                    </tr>
                `;
                return trHtml;
            }).join("");
        }

        // 2. Rellenar Matriz General de Pagos (Original con emojis 🟢 🎲 ❌ y totales por mes)
        if (bodyMatriz && footMatriz) {
            bodyMatriz.innerHTML = usuarios.map(u => {
                let trHtml = `
                    <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                        <td style="padding: 12px; font-weight: 700; color: var(--text-main); position: sticky; left: 0; background: white; z-index: 1;">
                            ${u.nombre} <span style="font-size: 0.75rem; color: #ec4899; font-weight: 800;">(#${String(u.polla_numero || 0).padStart(2, '0')})</span>
                        </td>
                `;

                for (let m = 0; m < 12; m++) {
                    const pago = u.pagos_meses[m];
                    let cellContent = '<span style="color: #cbd5e1;">❌</span>';
                    let cellBg = '';
                    let titleInfo = `${u.nombre} - ${MESES[m]}`;
                    const nombreSafe = String(u.nombre || "").replace(/'/g, "\\'");

                    if (pago.tiene_ajuste) {
                        const montoFormated = pago.monto_aporte !== 0 ? `<br><span style="font-size: 0.72rem; font-weight: 700; color: #ea580c;">$${Math.round(pago.monto_aporte/1000)}k</span>` : '';
                        cellContent = `⚠️${montoFormated}`;
                        cellBg = 'background: rgba(249, 115, 22, 0.15); border: 1px solid #fdba74;';
                        titleInfo += `\n⚠️ Ajuste/Descuento: ${pago.motivo_ajuste || "Sin detalle"}`;
                    } else if (pago.aporte && pago.polla) {
                        const montoTexto = pago.monto_aporte > 0 ? `<br><span style="font-size: 0.72rem; font-weight: 700; color: #059669;">$${Math.round(pago.monto_aporte/1000)}k</span>` : '';
                        cellContent = `🟢🎲${montoTexto}`;
                        cellBg = 'background: rgba(16, 185, 129, 0.12);';
                    } else if (pago.aporte) {
                        const montoTexto = pago.monto_aporte > 0 ? `<br><span style="font-size: 0.72rem; font-weight: 700; color: #059669;">$${Math.round(pago.monto_aporte/1000)}k</span>` : '';
                        cellContent = `🟢${montoTexto}`;
                        cellBg = 'background: rgba(16, 185, 129, 0.08);';
                    } else if (pago.polla) {
                        cellContent = `🎲`;
                        cellBg = 'background: rgba(236, 72, 153, 0.08);';
                    }

                    const nombreLimpio = String(u.nombre || "").replace(/"/g, '&quot;');
                    trHtml += `
                        <td class="celda-mes-interactiva" data-usuario-id="${u.usuario_id}" data-nombre="${nombreLimpio}" data-mes-idx="${m}" data-mes-nombre="${MESES[m]}" data-tiene-aporte="${pago.aporte ? 'true' : 'false'}" data-tiene-polla="${pago.polla ? 'true' : 'false'}" data-monto-aporte="${pago.monto_aporte || u.ahorro_mensual || 0}" title="${titleInfo} (Clic para gestionar o editar cuota)" style="padding: 8px 4px; text-align: center; font-size: 0.95rem; cursor: pointer; ${cellBg} transition: transform 0.15s ease;" onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'">
                            ${cellContent}
                        </td>
                    `;
                }

                trHtml += `
                        <td style="padding: 12px; text-align: right; font-weight: 800; color: #10b981;">
                            ${formatearMoneda(u.total_ahorrado)}
                        </td>
                    </tr>
                `;
                return trHtml;
            }).join("");

            const totalesMes = data.totales_por_mes || [];
            let footHtml = `
                <tr style="color: var(--text-main);">
                    <td style="padding: 14px 12px; text-align: left; position: sticky; left: 0; background: #f8fafc; z-index: 1;">TOTALES MES</td>
            `;

            for (let m = 0; m < 12; m++) {
                footHtml += `<td style="padding: 10px 4px; text-align: center; font-size: 0.75rem; color: var(--text-muted);">$${Math.round((totalesMes[m] || 0)/1000)}k</td>`;
            }

            footHtml += `
                    <td style="padding: 14px 12px; text-align: right; color: #4f46e5; font-size: 1rem;">
                        ${formatearMoneda(data.gran_total_acumulado)}
                    </td>
                </tr>
            `;
            footMatriz.innerHTML = footHtml;
        }

        // 3. Renderizar KPI Fondo Global Admin y Mini Pie Charts
        const elFondoGlobal = document.getElementById("kpiFondoGlobalAdmin");
        if (elFondoGlobal) elFondoGlobal.textContent = formatearMoneda(data.gran_total_acumulado);

        renderMiniPieCharts(globalAportesCount, globalPollasCount, totalEsperadoGlobal);

    } catch (err) {
        console.error("Error cargando matriz de pagos:", err);
    }
}

async function cargarUsuario(usuarioId) {
    const [ahorro, movs] = await Promise.all([
        apiFetch(`/api/ahorros/${usuarioId}`),
        apiFetch(`/api/movimientos/${usuarioId}?limit=200`)
    ]);

    // Actualizar campo de observaciones
    const userFound = listaUsuariosGlobal.find(u => u.id === usuarioId);
    const txtObs = document.getElementById("txtObservaciones");
    if (txtObs) {
        txtObs.value = userFound?.observaciones || "";
    }

    const inputAporte = document.getElementById("aporteMensual");
    if (inputAporte) inputAporte.value = Number(ahorro.ahorro_mensual || 0);

    llenarSelectMesesInteligente(movs);
    renderHistorial(movs, userFound?.nombre || "");

    return { ahorro, movs };
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const select = document.getElementById("selectUsuario");
        const btnGuardar = document.getElementById("btnGuardarConfig");
        const btnAporte = document.getElementById("btnRegistrarAporte");
        const btnPolla = document.getElementById("btnRegistrarPolla");
        const btnReset = document.getElementById("btnResetSocio");
        const btnGuardarObs = document.getElementById("btnGuardarObs");
        const btnAplicarAjuste = document.getElementById("btnAplicarAjuste");
        const btnAplicarDescuentoPolla = document.getElementById("btnAplicarDescuentoPolla");

        // Delegación de eventos segura para abrir el modal de mes al hacer clic en celdas
        document.addEventListener("click", (e) => {
            const celda = e.target.closest(".celda-mes-interactiva");
            if (celda) {
                const usuarioId = Number(celda.dataset.usuarioId);
                const nombreSocio = celda.dataset.nombre;
                const mesIdx = Number(celda.dataset.mesIdx);
                const nombreMes = celda.dataset.mesNombre;
                const tieneAporte = celda.dataset.tieneAporte === "true";
                const tienePolla = celda.dataset.tienePolla === "true";
                const montoActual = Number(celda.dataset.montoAporte || 0);

                togglePagoMesModal(usuarioId, nombreSocio, mesIdx, nombreMes, tieneAporte, tienePolla, montoActual);
            }
        });
        const [usuarios] = await Promise.all([
            cargarUsuarios(),
            cargarMatrizPagos()
        ]);

        const selectedId = select.value ? Number(select.value) : (usuarios.length > 0 ? usuarios[0].id : null);
        if (selectedId) {
            cargarUsuario(selectedId); // Carga asíncrona no bloqueante
        }

        select.addEventListener("change", async (e) => {
            e.preventDefault();
            await cargarUsuario(Number(select.value));
        });

        // ✅ Guardar config (PUT)
        btnGuardar.addEventListener("click", async (e) => {
            e.preventDefault();
            const usuarioId = Number(select.value);
            const ahorro_mensual = Number(document.getElementById("aporteMensual")?.value || 0);

            btnGuardar.disabled = true;
            try {
                await apiFetch(`/api/ahorros/${usuarioId}`, {
                    method: "PUT",
                    body: JSON.stringify({ usuario_id: usuarioId, ahorro_mensual, porcentaje_interes: 0 }),
                });
                await cargarUsuario(usuarioId);
                mostrarMensaje("✅ Configuración guardada", false);
            } catch (err) {
                mostrarMensaje(`❌ ${err.message}`, true);
            } finally {
                btnGuardar.disabled = false;
            }
        });

        // ✅ Guardar observaciones (PUT)
        if (btnGuardarObs) {
            btnGuardarObs.addEventListener("click", async (e) => {
                e.preventDefault();
                const usuarioId = Number(select.value);
                const observaciones = document.getElementById("txtObservaciones")?.value || "";

                btnGuardarObs.disabled = true;
                try {
                    await apiFetch(`/api/usuarios/${usuarioId}/observaciones`, {
                        method: "PUT",
                        body: JSON.stringify({ observaciones })
                    });
                    // Actualizar memoria local
                    const uLocal = listaUsuariosGlobal.find(u => u.id === usuarioId);
                    if (uLocal) uLocal.observaciones = observaciones;

                    mostrarMensaje("✅ Observaciones guardadas correctamente", false);
                } catch (err) {
                    mostrarMensaje(`❌ ${err.message}`, true);
                } finally {
                    btnGuardarObs.disabled = false;
                }
            });
        }

        // ✅ Registrar Penalización Fija por Mora (-$10.000)
        if (btnAplicarAjuste) {
            btnAplicarAjuste.addEventListener("click", async (e) => {
                e.preventDefault();
                const usuarioId = Number(select.value);
                btnAplicarAjuste.disabled = true;

                try {
                    const r = await apiFetch(`/api/ahorros/${usuarioId}/registrar_ajuste`, {
                        method: "POST",
                        body: JSON.stringify({
                            usuario_id: usuarioId,
                            tipo: "Penalización por Mora",
                            monto: -10000,
                            descripcion: "Descuento por mora"
                        })
                    });
                    await Promise.all([
                        cargarUsuario(usuarioId),
                        cargarMatrizPagos()
                    ]);
                    mostrarMensaje(`✅ ${r?.mensaje || "Descuento de -$10.000 por mora aplicado"}`, false);
                } catch (err) {
                    mostrarMensaje(`❌ ${err.message}`, true);
                } finally {
                    btnAplicarAjuste.disabled = false;
                }
            });
        }

        // ✅ Registrar Descuento Fijo por Polla Ganada (-$10.000)
        if (btnAplicarDescuentoPolla) {
            btnAplicarDescuentoPolla.addEventListener("click", async (e) => {
                e.preventDefault();
                const usuarioId = Number(select.value);
                btnAplicarDescuentoPolla.disabled = true;

                try {
                    const r = await apiFetch(`/api/ahorros/${usuarioId}/registrar_ajuste`, {
                        method: "POST",
                        body: JSON.stringify({
                            usuario_id: usuarioId,
                            tipo: "Descuento por Polla",
                            monto: -10000,
                            descripcion: "Descuento por polla ganada"
                        })
                    });
                    await Promise.all([
                        cargarUsuario(usuarioId),
                        cargarMatrizPagos()
                    ]);
                    mostrarMensaje(`✅ ${r?.mensaje || "Descuento de -$10.000 por polla ganada aplicado"}`, false);
                } catch (err) {
                    mostrarMensaje(`❌ ${err.message}`, true);
                } finally {
                    btnAplicarDescuentoPolla.disabled = false;
                }
            });
        }

        // ✅ Registrar Aporte (POST)
        btnAporte.addEventListener("click", async (e) => {
            e.preventDefault();
            const usuarioId = Number(select.value);
            btnAporte.disabled = true;

            try {
                const selectMes = document.getElementById("selectMesAporte");
                if (!selectMes.value || selectMes.options[selectMes.selectedIndex].disabled) {
                    mostrarMensaje("Selecciona un mes de aporte válido", true);
                    btnAporte.disabled = false;
                    return;
                }

                const [mes, anio] = selectMes.value.split("|");

                const r = await apiFetch(`/api/ahorros/${usuarioId}/registrar_aporte`, {
                    method: "POST",
                    body: JSON.stringify({ mes, anio: Number(anio) })
                });
                await Promise.all([
                    cargarUsuario(usuarioId),
                    cargarMatrizPagos()
                ]);
                mostrarMensaje(`✅ ${r?.mensaje || "Aporte registrado"}`, false);
            } catch (err) {
                mostrarMensaje(`❌ ${err.message}`, true);
            } finally {
                btnAporte.disabled = false;
            }
        });
        
        // ✅ Registrar Polla (POST)
        btnPolla.addEventListener("click", async (e) => {
            e.preventDefault();
            const usuarioId = Number(select.value);
            btnPolla.disabled = true;

            try {
                const selectMes = document.getElementById("selectMesPolla");
                if (!selectMes.value || selectMes.options[selectMes.selectedIndex].disabled) {
                    mostrarMensaje("Selecciona un mes de polla válido", true);
                    btnPolla.disabled = false;
                    return;
                }

                const [mes, anio] = selectMes.value.split("|");

                const r = await apiFetch(`/api/ahorros/${usuarioId}/registrar_polla`, {
                    method: "POST",
                    body: JSON.stringify({ mes, anio: Number(anio) })
                });
                await Promise.all([
                    cargarUsuario(usuarioId),
                    cargarMatrizPagos()
                ]);
                mostrarMensaje(`✅ ${r?.mensaje || "Pago Polla registrado"}`, false);
            } catch (err) {
                mostrarMensaje(`❌ ${err.message}`, true);
            } finally {
                btnPolla.disabled = false;
            }
        });

        // ✅ Reset socio (DELETE)
        btnReset.addEventListener("click", async (e) => {
            e.preventDefault();
            const usuarioId = Number(select.value);
            btnReset.disabled = true;

            try {
                await apiFetch(`/api/admin/reset_socio/${usuarioId}`, { method: "DELETE" });
                await cargarUsuario(usuarioId);
                mostrarMensaje("🧹 Usuario reseteado", false);
            } catch (err) {
                mostrarMensaje(`❌ ${err.message}`, true);
            } finally {
                btnReset.disabled = false;
            }
        });

    } catch (err) {
        console.error(err);
        mostrarMensaje(`❌ ${err.message || err}`, true);
    }
});

let modalPagoState = null;

function togglePagoMesModal(usuarioId, nombreSocio, mesIdx, nombreMes, tieneAporte = false, tienePolla = false, montoActual = 0) {
    modalPagoState = { usuarioId, nombreSocio, mesIdx, nombreMes, anio: 2026, tieneAporte, tienePolla, montoActual };
    const modal = document.getElementById("modalPagoMes");
    const titulo = document.getElementById("modalPagoMesTitulo");
    const sub = document.getElementById("modalPagoMesSub");
    const inputMonto = document.getElementById("inputMontoCuotaModal");

    const btnRegAporte = document.getElementById("btnModalRegAporte");
    const btnRegPolla = document.getElementById("btnModalRegPolla");
    const btnDelAporte = document.getElementById("btnModalDelAporte");

    if (titulo) titulo.textContent = `${nombreSocio}`;
    if (sub) sub.textContent = `Mes de ${nombreMes} 2026`;
    if (inputMonto) inputMonto.value = Number(montoActual || 0);

    // Control inteligente de opciones según el estado actual del pago
    if (btnRegAporte) btnRegAporte.style.display = tieneAporte ? "none" : "flex";
    if (btnRegPolla) btnRegPolla.style.display = tienePolla ? "none" : "flex";
    if (btnDelAporte) btnDelAporte.style.display = (tieneAporte || tienePolla) ? "flex" : "none";

    if (modal) {
        modal.style.display = "flex";
    }
}

function cerrarModalPagoMes() {
    const modal = document.getElementById("modalPagoMes");
    if (modal) modal.style.display = "none";
    modalPagoState = null;
}

async function guardarMontoCuotaPersonalizado() {
    if (!modalPagoState) return;
    const { usuarioId, nombreMes, anio } = modalPagoState;
    const nuevoMonto = Number(document.getElementById("inputMontoCuotaModal")?.value || 0);

    if (nuevoMonto < 0) {
        mostrarMensaje("El monto de la cuota no puede ser negativo", true);
        return;
    }

    cerrarModalPagoMes();

    try {
        const r = await apiFetch(`/api/ahorros/${usuarioId}/registrar_ajuste`, {
            method: "POST",
            body: JSON.stringify({
                usuario_id: usuarioId,
                tipo: "Aporte Personalizado",
                monto: nuevoMonto,
                descripcion: `Aporte (${nombreMes} ${anio})`
            })
        });
        mostrarMensaje(`✅ Cuota de ${nombreMes} actualizada a ${formatearMoneda(nuevoMonto)}`, false);
        await Promise.all([
            cargarMatrizPagos(),
            cargarUsuario(usuarioId)
        ]);
    } catch (err) {
        mostrarMensaje(`❌ ${err.message}`, true);
    }
}

async function ejecutarAccionPagoMes(tipo, accion) {
    if (!modalPagoState) return;
    const { usuarioId, nombreMes, anio } = modalPagoState;
    cerrarModalPagoMes();

    const payload = { usuario_id: usuarioId, mes: nombreMes, anio, tipo, accion };

    try {
        const r = await apiFetch(`/api/admin/modificar_pago_mes`, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        mostrarMensaje(`✅ ${r.mensaje || "Pago actualizado"}`, false);
        // Refresco rápido paralelo de la matriz y el socio seleccionado
        await Promise.all([
            cargarMatrizPagos(),
            cargarUsuario(usuarioId)
        ]);
    } catch (err) {
        mostrarMensaje(`❌ ${err.message}`, true);
    }
}

