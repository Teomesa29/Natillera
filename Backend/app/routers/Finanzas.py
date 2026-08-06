from fastapi import APIRouter, status, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from dateutil.relativedelta import relativedelta
import calendar
import re

from app.schemas.schemas import PrestamoCreate, AhorroCreate, AporteMensualPayload, AjusteManualPayload
from app.database import SessionLocal, get_db
from app.models.models import Prestamo, Movimiento, Ahorro, Usuario


router = APIRouter(prefix="/api", tags=["Finanzas"])


MESES_ES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]


# =========================================================
# 🔥 FUNCIÓN CENTRAL DE CÁLCULO DE INTERÉS (ÚNICA)
# =========================================================
def calcular_interes_mes(db: Session, year: int, month: int):

    dias_del_mes = calendar.monthrange(year, month)[1]
    nombre_mes = MESES_ES[month - 1]

    ahorros = db.query(Ahorro).all()

    for ahorro in ahorros:

        # 🔒 Evitar duplicación mensual
        ya_existe = db.query(Movimiento).filter(
            Movimiento.usuario_id == ahorro.usuario_id,
            Movimiento.tipo == "Interés Mensual",
            Movimiento.descripcion == f"Interés aplicado ({nombre_mes} {year})"
        ).first()

        if ya_existe:
            continue

        tasa_mensual = float(ahorro.porcentaje_interes or 0) / 100.0

        movimientos_mes = (
            db.query(Movimiento)
            .filter(
                Movimiento.usuario_id == ahorro.usuario_id,
                Movimiento.tipo == "Aporte Mensual",
                Movimiento.fecha >= datetime(year, month, 1),
                Movimiento.fecha <= datetime(year, month, dias_del_mes)
            )
            .all()
        )

        interes_total_mes = 0

        for mov in movimientos_mes:
            dia_aporte = mov.fecha.day
            dias_activos = dias_del_mes - dia_aporte + 1
            interes = mov.monto * tasa_mensual * (dias_activos / dias_del_mes)
            interes_total_mes += interes

        if interes_total_mes > 0:

            interes_redondeado = int(round(interes_total_mes))

            ahorro.total_ahorrado = int((ahorro.total_ahorrado or 0) + interes_redondeado)
            ahorro.interes_ganado = float((ahorro.interes_ganado or 0) + interes_redondeado)
            ahorro.ultima_actualizacion = datetime.now()

            mov_interes = Movimiento(
                usuario_id=ahorro.usuario_id,
                tipo="Interés Mensual",
                monto=interes_redondeado,
                fecha=datetime.now(),
                categoria="ingreso",
                descripcion=f"Interés aplicado ({nombre_mes} {year})"
            )

            db.add(mov_interes)


# =========================================================
# 🔁 FUNCIÓN AUTOMÁTICA (para scheduler)
# =========================================================
def aplicar_interes_mensual_automatico():

    db: Session = SessionLocal()

    try:
        hoy = datetime.now()

        if hoy.day != 1:
            return

        mes_anterior = hoy - relativedelta(months=1)

        calcular_interes_mes(
            db,
            mes_anterior.year,
            mes_anterior.month
        )

        db.commit()

    finally:
        db.close()


# =========================================================
# UTILIDADES
# =========================================================
def parse_mes_desde_descripcion(desc: str):
    m = re.search(
        r"\((Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s+(\d{4})\)",
        desc or "",
        re.I
    )
    if not m:
        return None

    mes_nombre = m.group(1)
    year = int(m.group(2))
    mes_index = next((i for i, x in enumerate(MESES_ES) if x.lower() == mes_nombre.lower()), -1)

    if mes_index < 0:
        return None

    return (mes_index, year)


def validar_usuario(db: Session, usuario_id: int) -> Usuario:
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    return usuario


def obtener_o_crear_ahorro(db: Session, usuario_id: int) -> Ahorro:
    ahorro = db.query(Ahorro).filter(Ahorro.usuario_id == usuario_id).first()
    if ahorro:
        return ahorro

    ahorro = Ahorro(
        usuario_id=usuario_id,
        ahorro_mensual=0,
        total_ahorrado=0,
        porcentaje_interes=8.5,
        interes_ganado=0.0,
        ultima_actualizacion=datetime.now()
    )
    db.add(ahorro)
    db.flush()
    db.refresh(ahorro)
    return ahorro


def siguiente_mes_texto_desde_movimientos(db: Session, usuario_id: int) -> str:
    movs = (
        db.query(Movimiento)
        .filter(Movimiento.usuario_id == usuario_id, Movimiento.tipo == "Aporte Mensual")
        .all()
    )

    now = datetime.now()
    year_actual = now.year

    if not movs:
        return f"Enero {year_actual}"

    max_mes_index = -1
    max_year = year_actual

    for mov in movs:
        parsed = parse_mes_desde_descripcion(mov.descripcion or "")
        if parsed:
            mes_index, y = parsed
            val = y * 12 + mes_index
            current_max = max_year * 12 + max_mes_index
            if val > current_max or max_mes_index == -1:
                max_mes_index = mes_index
                max_year = y

    if max_mes_index == -1:
        return f"Enero {year_actual}"

    siguiente_mes_idx = (max_mes_index + 1) % 12
    siguiente_year = max_year + ((max_mes_index + 1) // 12)

    return f"{MESES_ES[siguiente_mes_idx]} {siguiente_year}"



# =========================================================
# ENDPOINT MANUAL INTERÉS
# =========================================================
@router.post("/ahorros/aplicar_interes_mensual")
def aplicar_interes_mensual(db: Session = Depends(get_db)):

    hoy = datetime.now()

    if hoy.day != 1:
        raise HTTPException(
            status_code=400,
            detail="El interés solo puede aplicarse el día 1 de cada mes"
        )

    mes_anterior = hoy - relativedelta(months=1)

    calcular_interes_mes(
        db,
        mes_anterior.year,
        mes_anterior.month
    )

    db.commit()

    return {"mensaje": "Interés mensual aplicado correctamente"}


# =========================================================
# AHORROS
# =========================================================
@router.get("/ahorros/{usuario_id}")
def obtener_ahorro(usuario_id: int, db: Session = Depends(get_db)):
    validar_usuario(db, usuario_id)
    ahorro = obtener_o_crear_ahorro(db, usuario_id)

    return {
        "id": ahorro.id,
        "usuario_id": ahorro.usuario_id,
        "ahorro_mensual": ahorro.ahorro_mensual or 0,
        "total_ahorrado": ahorro.total_ahorrado or 0,
        "porcentaje_interes": float(ahorro.porcentaje_interes or 0),
        "interes_ganado": float(ahorro.interes_ganado or 0),
        "ultima_actualizacion": ahorro.ultima_actualizacion.isoformat() if ahorro.ultima_actualizacion else None
    }


@router.put("/ahorros/{usuario_id}")
def actualizar_config_ahorro(usuario_id: int, payload: AhorroCreate, db: Session = Depends(get_db)):

    validar_usuario(db, usuario_id)
    ahorro = obtener_o_crear_ahorro(db, usuario_id)

    ahorro.ahorro_mensual = int(payload.ahorro_mensual)
    ahorro.porcentaje_interes = float(payload.porcentaje_interes)
    ahorro.ultima_actualizacion = datetime.now()

    db.commit()
    db.refresh(ahorro)

    return {"mensaje": "Configuración guardada correctamente"}


@router.post("/ahorros/{usuario_id}/registrar_aporte")
def registrar_aporte(usuario_id: int, payload: AporteMensualPayload, db: Session = Depends(get_db)):

    validar_usuario(db, usuario_id)
    ahorro = obtener_o_crear_ahorro(db, usuario_id)

    aporte = int(ahorro.ahorro_mensual or 0)

    if aporte <= 0:
        raise HTTPException(
            status_code=400,
            detail="Define un ahorro_mensual válido antes de registrar el aporte"
        )

    ahorro.total_ahorrado = int((ahorro.total_ahorrado or 0) + aporte)
    ahorro.ultima_actualizacion = datetime.now()

    mes_texto = f"{payload.mes} {payload.anio}"

    mov = Movimiento(
        usuario_id=usuario_id,
        tipo="Aporte Mensual",
        monto=aporte,
        fecha=datetime.now(),
        categoria="ingreso",
        descripcion=f"Aporte mensual registrado ({mes_texto})"
    )

    db.add(mov)
    db.commit()

    return {"mensaje": f"Aporte registrado ({mes_texto})"}

@router.post("/ahorros/{usuario_id}/registrar_polla")
def registrar_polla(usuario_id: int, payload: AporteMensualPayload, db: Session = Depends(get_db)):
    validar_usuario(db, usuario_id)
    
    # Monto fijo de la polla: 10000 COP
    monto_polla = 10000
    mes_texto = f"{payload.mes} {payload.anio}"
    
    mov = Movimiento(
        usuario_id=usuario_id,
        tipo="Pago Polla",
        monto=monto_polla,
        fecha=datetime.now(),
        categoria="ingreso",
        descripcion=f"Pago de Polla registrado ({mes_texto})"
    )
    
    db.add(mov)
    db.commit()
    
    return {"mensaje": f"Pago de Polla registrado ({mes_texto})"}


@router.post("/admin/modificar_pago_mes")
def modificar_pago_mes(payload: dict, db: Session = Depends(get_db)):
    usuario_id = int(payload.get("usuario_id", 0))
    mes_nombre = payload.get("mes")
    anio = int(payload.get("anio", 2026))
    tipo_pago = payload.get("tipo") # "aporte" o "polla"
    accion = payload.get("accion") # "registrar" o "eliminar"

    validar_usuario(db, usuario_id)
    ahorro = obtener_o_crear_ahorro(db, usuario_id)

    mes_desc_pattern = f"({mes_nombre} {anio})"

    # Buscar movimientos existentes de ese tipo y mes
    movs = db.query(Movimiento).filter(
        Movimiento.usuario_id == usuario_id,
        Movimiento.descripcion.like(f"%{mes_desc_pattern}%")
    ).all()

    mov_encontrado = None
    for m in movs:
        if tipo_pago == "aporte" and "aporte" in (m.tipo or "").lower():
            mov_encontrado = m
            break
        elif tipo_pago == "polla" and "polla" in (m.tipo or "").lower():
            mov_encontrado = m
            break

    if accion == "eliminar":
        movs_a_borrar = [m for m in movs if "polla" not in (m.tipo or "").lower() and "polla" not in (m.descripcion or "").lower()]
        if movs_a_borrar:
            for m in movs_a_borrar:
                if (m.monto or 0) > 0 and ("aporte" in (m.tipo or "").lower() or "aporte" in (m.descripcion or "").lower()):
                    ahorro.total_ahorrado = max(0, int((ahorro.total_ahorrado or 0) - m.monto))
                db.delete(m)
            db.commit()
            return {"mensaje": f"Cuota Aporte de {mes_nombre} eliminada (se conserva la Polla si existía)"}
        return {"mensaje": "No se encontró registro de cuota aporte para eliminar en este mes"}
    elif accion == "actualizar_monto":
        nuevo_monto = int(payload.get("monto", 0))
        # Buscar todos los movimientos de aporte del mes (excluyendo polla)
        movs_aporte = [m for m in movs if "polla" not in (m.tipo or "").lower() and "polla" not in (m.descripcion or "").lower()]
        
        monto_actual = sum(int(m.monto or 0) for m in movs_aporte)
        diferencia = nuevo_monto - monto_actual

        if movs_aporte:
            # Si existen movimientos, actualizamos el primero con el monto total deseado y eliminamos los extra
            movs_aporte[0].monto = nuevo_monto
            movs_aporte[0].tipo = "Aporte Mensual"
            movs_aporte[0].descripcion = f"Aporte mensual registrado ({mes_nombre} {anio})"
            for extra in movs_aporte[1:]:
                db.delete(extra)
        else:
            # Si no existía, se crea un movimiento con el monto especificado
            mov = Movimiento(
                usuario_id=usuario_id,
                tipo="Aporte Mensual",
                monto=nuevo_monto,
                fecha=datetime.now(),
                categoria="ingreso",
                descripcion=f"Aporte mensual registrado ({mes_nombre} {anio})"
            )
            db.add(mov)

        # Ajustar el total ahorrado acumulado en base a la diferencia de este mes
        ahorro.total_ahorrado = max(0, int((ahorro.total_ahorrado or 0) + diferencia))
        ahorro.ultima_actualizacion = datetime.now()
        db.commit()
        return {"mensaje": f"Cuota de {mes_nombre} actualizada a ${nuevo_monto:,} COP"}
    else: # registrar
        if not mov_encontrado:
            monto = int(ahorro.ahorro_mensual or 0) if tipo_pago == "aporte" else 10000
            if tipo_pago == "aporte":
                ahorro.total_ahorrado = int((ahorro.total_ahorrado or 0) + monto)
            
            tipo_mov = "Aporte Mensual" if tipo_pago == "aporte" else "Pago Polla"
            desc = f"Aporte mensual registrado ({mes_nombre} {anio})" if tipo_pago == "aporte" else f"Pago de Polla registrado ({mes_nombre} {anio})"
            
            mov = Movimiento(
                usuario_id=usuario_id,
                tipo=tipo_mov,
                monto=monto,
                fecha=datetime.now(),
                categoria="ingreso",
                descripcion=desc
            )
            db.add(mov)
            db.commit()
            return {"mensaje": f"Pago de {tipo_pago} de {mes_nombre} registrado"}
        return {"mensaje": "El pago ya estaba registrado"}


# =========================================================
# MOVIMIENTOS
# =========================================================
@router.get("/movimientos/{usuario_id}")
def listar_movimientos(usuario_id: int, limit: int = 50, db: Session = Depends(get_db)):

    validar_usuario(db, usuario_id)

    movs = (
        db.query(Movimiento)
        .filter(Movimiento.usuario_id == usuario_id)
        .order_by(Movimiento.fecha.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": m.id,
            "tipo": m.tipo,
            "monto": float(m.monto or 0),
            "categoria": m.categoria,
            "descripcion": m.descripcion,
            "fecha": m.fecha.isoformat() if m.fecha else None
        }
        for m in movs
    ]


# =========================================================
# PRÉSTAMOS
# =========================================================
@router.post("/crear_prestamo", status_code=status.HTTP_201_CREATED)
def crear_prestamo(payload: PrestamoCreate, db: Session = Depends(get_db)):

    validar_usuario(db, payload.usuario_id)

    nuevo_prestamo = Prestamo(
        usuario_id=payload.usuario_id,
        monto=payload.monto,
        fecha_vencimiento=payload.fecha_vencimiento,
        intereses=payload.intereses,
        total=payload.total,
        estado=payload.estado,
        plazo=payload.plazo,
        saldo=payload.total,
        cuotas_pagadas=0
    )

    db.add(nuevo_prestamo)
    db.commit()
    db.refresh(nuevo_prestamo)

    mov = Movimiento(
        usuario_id=payload.usuario_id,
        tipo="Préstamo",
        monto=int(payload.monto),
        fecha=datetime.now(),
        categoria="prestamo",
        descripcion=f"Préstamo creado (plazo {payload.plazo} meses)"
    )

    db.add(mov)
    db.commit()

    return {"mensaje": "Préstamo creado correctamente"}


# =========================================================
# ADMIN RESET
# =========================================================
@router.delete("/admin/reset_socio/{usuario_id}")
def resetear_usuario(usuario_id: int, db: Session = Depends(get_db)):

    user = validar_usuario(db, usuario_id)

    db.query(Prestamo).filter(Prestamo.usuario_id == usuario_id).delete()
    db.query(Movimiento).filter(Movimiento.usuario_id == usuario_id).delete()

    ahorro = db.query(Ahorro).filter(Ahorro.usuario_id == usuario_id).first()
    if ahorro:
        ahorro.total_ahorrado = 0
        ahorro.interes_ganado = 0.0
        ahorro.ultima_actualizacion = datetime.now()

    db.commit()

    return {"mensaje": f"Usuario reseteado: {user.usuario} (rol: {user.rol})"}


def ultimo_mes_pagado_texto_desde_movimientos(db: Session, usuario_id: int) -> str:
    movs = (
        db.query(Movimiento)
        .filter(Movimiento.usuario_id == usuario_id, Movimiento.tipo == "Aporte Mensual")
        .all()
    )

    now = datetime.now()
    year_actual = now.year

    if not movs:
        return f"Enero {year_actual}"

    max_mes_index = -1
    max_year = year_actual

    for mov in movs:
        parsed = parse_mes_desde_descripcion(mov.descripcion or "")
        if parsed:
            mes_index, y = parsed
            val = y * 12 + mes_index
            current_max = max_year * 12 + max_mes_index
            if val > current_max or max_mes_index == -1:
                max_mes_index = mes_index
                max_year = y

    if max_mes_index == -1:
        return f"Enero {year_actual}"

    return f"{MESES_ES[max_mes_index]} {max_year}"


# =========================================================
# AJUSTES Y DESCUENTOS MANUALES
# =========================================================
@router.post("/ahorros/{usuario_id}/registrar_ajuste")
def registrar_ajuste_manual(usuario_id: int, payload: AjusteManualPayload, db: Session = Depends(get_db)):
    validar_usuario(db, usuario_id)
    ahorro = obtener_o_crear_ahorro(db, usuario_id)

    monto = int(payload.monto)
    nuevo_total = int((ahorro.total_ahorrado or 0) + monto)
    if nuevo_total < 0:
        nuevo_total = 0
    ahorro.total_ahorrado = nuevo_total
    ahorro.ultima_actualizacion = datetime.now()

    categoria = "egreso" if monto < 0 else "ingreso"
    tipo = payload.tipo or ("Descuento Ahorro" if monto < 0 else "Abono Ahorro")
    
    # Detectar el último mes que efectivamente tiene pago el socio para asociar el descuento
    mes_patron = ""
    parsed = parse_mes_desde_descripcion(payload.descripcion or "")
    if not parsed:
        mes_texto = ultimo_mes_pagado_texto_desde_movimientos(db, usuario_id)
        mes_patron = f" ({mes_texto})"
    
    descripcion = f"{payload.descripcion or 'Ajuste manual'}{mes_patron}"

    mov = Movimiento(
        usuario_id=usuario_id,
        tipo=tipo,
        monto=monto,
        fecha=datetime.now(),
        categoria=categoria,
        descripcion=descripcion
    )

    db.add(mov)
    db.commit()

    return {"mensaje": f"Ajuste registrado correctamente ({tipo})"}


# =========================================================
# MATRIZ GENERAL DE PAGOS POR MESES (ADMIN)
# =========================================================
@router.get("/admin/matriz_pagos")
def obtener_matriz_pagos(anio: int = 2026, db: Session = Depends(get_db)):
    usuarios = db.query(Usuario).order_by(Usuario.nombre.asc()).all()
    ahorros_map = {a.usuario_id: a for a in db.query(Ahorro).all()}
    movimientos_todos = db.query(Movimiento).all()

    movs_por_usuario = {}
    for m in movimientos_todos:
        movs_por_usuario.setdefault(m.usuario_id, []).append(m)

    matriz = []
    totales_por_mes = {m: 0 for m in range(12)}
    gran_total_acumulado = 0

    for u in usuarios:
        ahorro = ahorros_map.get(u.id)
        movs = movs_por_usuario.get(u.id, [])

        pagos_meses = {}
        for m in range(12):
            pagos_meses[m] = {
                "aporte": False,
                "monto_aporte": 0,
                "polla": False,
                "monto_polla": 0,
                "total_mes": 0,
                "tiene_ajuste": False,
                "motivo_ajuste": ""
            }

        for mov in movs:
            parsed = parse_mes_desde_descripcion(mov.descripcion or "")
            if parsed:
                mes_idx, y = parsed
                if y == anio and 0 <= mes_idx <= 11:
                    tipo_lower = (mov.tipo or "").lower()
                    desc_lower = (mov.descripcion or "").lower()

                    if "descuento" in tipo_lower or "penalizac" in tipo_lower or "ajuste" in tipo_lower or "descuento" in desc_lower or "penalizac" in desc_lower or "mora" in desc_lower:
                        pagos_meses[mes_idx]["tiene_ajuste"] = True
                        pagos_meses[mes_idx]["motivo_ajuste"] = mov.descripcion or mov.tipo
                        pagos_meses[mes_idx]["monto_aporte"] += int(mov.monto or 0)
                        pagos_meses[mes_idx]["total_mes"] += int(mov.monto or 0)
                    elif "aporte" in tipo_lower:
                        pagos_meses[mes_idx]["aporte"] = True
                        pagos_meses[mes_idx]["monto_aporte"] += int(mov.monto or 0)
                        pagos_meses[mes_idx]["total_mes"] += int(mov.monto or 0)
                    elif "polla" in tipo_lower:
                        pagos_meses[mes_idx]["polla"] = True
                        pagos_meses[mes_idx]["monto_polla"] += int(mov.monto or 0)

        for m_idx in range(12):
            totales_por_mes[m_idx] += pagos_meses[m_idx]["total_mes"]

        total_usuario = int(ahorro.total_ahorrado) if (ahorro and ahorro.total_ahorrado) else 0
        gran_total_acumulado += total_usuario

        matriz.append({
            "usuario_id": u.id,
            "nombre": u.nombre,
            "usuario": u.usuario,
            "telefono": u.telefono,
            "polla_numero": u.polla,
            "ahorro_mensual": ahorro.ahorro_mensual if ahorro else 0,
            "pagos_meses": pagos_meses,
            "total_ahorrado": total_usuario,
            "observaciones": u.observaciones
        })

    return {
        "anio": anio,
        "meses": MESES_ES,
        "usuarios": matriz,
        "totales_por_mes": [totales_por_mes[i] for i in range(12)],
        "gran_total_acumulado": gran_total_acumulado
    }
