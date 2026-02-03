from fastapi import APIRouter, status, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from dateutil.relativedelta import relativedelta

from app.schemas.schemas import PrestamoCreate, AhorroCreate
from app.database import get_db
from app.models.models import Prestamo, Movimiento, Ahorro, Usuario
import re
from datetime import datetime
from dateutil.relativedelta import relativedelta

router = APIRouter(prefix="/api", tags=["Finanzas"])


# -----------------------
# Utils
# -----------------------
MESES_ES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]

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
    ultimo = (
        db.query(Movimiento)
        .filter(Movimiento.usuario_id == usuario_id, Movimiento.tipo == "Aporte Mensual")
        .order_by(Movimiento.id.desc())
        .first()
    )

    if not ultimo:
        # primer aporte: mes actual
        base = datetime.now()
    else:
        parsed = parse_mes_desde_descripcion(ultimo.descripcion or "")
        if parsed:
            mes_index, year = parsed
            # ✅ aquí estaba el error: hay que pasar al siguiente mes
            base = datetime(year, mes_index + 1, 1) + relativedelta(months=1)
        else:
            # fallback: fecha real + 1 mes
            base = (ultimo.fecha or datetime.now()) + relativedelta(months=1)

    mes = MESES_ES[base.month - 1]
    return f"{mes} {base.year}"

# -----------------------
# Ahorros (montos)
# -----------------------
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

    return {"mensaje": "Configuración guardada", "ahorro": {
        "id": ahorro.id,
        "usuario_id": ahorro.usuario_id,
        "ahorro_mensual": ahorro.ahorro_mensual,
        "total_ahorrado": ahorro.total_ahorrado,
        "porcentaje_interes": float(ahorro.porcentaje_interes),
        "interes_ganado": float(ahorro.interes_ganado),
        "ultima_actualizacion": ahorro.ultima_actualizacion.isoformat() if ahorro.ultima_actualizacion else None
    }}


@router.post("/ahorros/{usuario_id}/registrar_aporte")
def registrar_aporte(usuario_id: int, db: Session = Depends(get_db)):
    validar_usuario(db, usuario_id)
    ahorro = obtener_o_crear_ahorro(db, usuario_id)

    aporte = int(ahorro.ahorro_mensual or 0)
    if aporte <= 0:
        raise HTTPException(status_code=400, detail="Define un ahorro_mensual válido antes de registrar el aporte")

    tasa = float(ahorro.porcentaje_interes or 0) / 100.0

    total_antes = float(ahorro.total_ahorrado or 0)
    total_despues = (total_antes + aporte) * (1 + tasa)

    ahorro.total_ahorrado = int(round(total_despues))
    ahorro.interes_ganado = float(ahorro.total_ahorrado - (total_antes + aporte)) + float(ahorro.interes_ganado or 0)
    ahorro.ultima_actualizacion = datetime.now()

    mes_texto = siguiente_mes_texto_desde_movimientos(db, usuario_id)

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
    db.refresh(ahorro)

    return {
        "mensaje": f"Aporte registrado ({mes_texto})",
        "ahorro": {
            "ahorro_mensual": ahorro.ahorro_mensual,
            "total_ahorrado": ahorro.total_ahorrado,
            "porcentaje_interes": float(ahorro.porcentaje_interes),
            "interes_ganado": float(ahorro.interes_ganado),
        }
    }

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
        saldo=payload.total,        # ✅ CLAVE
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

    return {"mensaje": "Préstamo creado", "prestamo": {
        "id": nuevo_prestamo.id,
        "usuario_id": nuevo_prestamo.usuario_id,
        "monto": nuevo_prestamo.monto,
        "fecha_prestamo": nuevo_prestamo.fecha_prestamo.isoformat() if nuevo_prestamo.fecha_prestamo else None,
        "fecha_vencimiento": nuevo_prestamo.fecha_vencimiento.isoformat() if nuevo_prestamo.fecha_vencimiento else None,
        "intereses": nuevo_prestamo.intereses,
        "total": nuevo_prestamo.total,
        "estado": nuevo_prestamo.estado,
        "plazo": nuevo_prestamo.plazo
    }}


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
