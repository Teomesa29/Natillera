from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from dateutil.relativedelta import relativedelta

from app.database import get_db
from app.models.models import Prestamo, Usuario, Movimiento

router = APIRouter(prefix="/api", tags=["prestamos"])

# -----------------------
# Helpers
# -----------------------
def _tag_prestamo(prestamo_id: int) -> str:
    # Tag para encontrar pagos asociados al préstamo en movimientos
    return f"[prestamo_id:{prestamo_id}]"

def _sum_pagos_prestamo(db: Session, usuario_id: int, prestamo_id: int) -> float:
    tag = _tag_prestamo(prestamo_id)
    pagos = (
        db.query(Movimiento)
        .filter(
            Movimiento.usuario_id == usuario_id,
            Movimiento.tipo == "Pago Préstamo",
            Movimiento.descripcion.ilike(f"%{tag}%")
        )
        .all()
    )
    return float(sum((m.monto or 0) for m in pagos))

def _list_pagos_prestamo(db: Session, usuario_id: int, prestamo_id: int):
    tag = _tag_prestamo(prestamo_id)
    return (
        db.query(Movimiento)
        .filter(
            Movimiento.usuario_id == usuario_id,
            Movimiento.tipo == "Pago Préstamo",
            Movimiento.descripcion.ilike(f"%{tag}%")
        )
        .order_by(Movimiento.fecha.asc())
        .all()
    )

def calcular_plan_pagos(monto: float, interes_total: float, plazo: int, fecha_inicio: datetime, pagos_movs):
    if not plazo or plazo <= 0:
        return None

    monto = float(monto or 0)
    interes_total = float(interes_total or 0)

    total = monto + interes_total
    cuota = total / plazo

    # Para marcar pagadas: por cantidad de pagos (1 pago = 1 cuota) O por monto acumulado
    pagos_movs = pagos_movs or []
    monto_pagado = float(sum((m.monto or 0) for m in pagos_movs))

    # Cuotas pagadas por monto (más robusto si pagan montos raros)
    cuotas_pagadas = int(monto_pagado // cuota) if cuota > 0 else 0
    if cuotas_pagadas > plazo:
        cuotas_pagadas = plazo

    cuotas = []
    for i in range(1, plazo + 1):
        pagada = i <= cuotas_pagadas
        fecha_pago = None

        # Si quieres fecha pago exacta por movimiento, usamos el movimiento i-1 (si existe)
        # Nota: si pagaron "monto acumulado" en un solo movimiento, esto no tendrá 1 fecha por cuota.
        mov = pagos_movs[i - 1] if (i - 1) < len(pagos_movs) else None
        if pagada and mov and mov.fecha:
            fecha_pago = mov.fecha.isoformat()

        cuotas.append({
            "n": i,
            "fecha": (fecha_inicio + relativedelta(months=i)).isoformat(),
            "cuota": round(cuota, 2),
            "pagada": pagada,
            "fecha_pago": fecha_pago
        })

    interes_mensual_pct = 0
    if monto > 0:
        interes_mensual_pct = round((interes_total / (monto * plazo)) * 100, 4) if interes_total else 0

    return {
        "interes_total": round(interes_total, 2),
        "total": round(total, 2),
        "cuota": round(cuota, 2),
        "interes_mensual_pct": interes_mensual_pct,
        "cuotas_pagadas": cuotas_pagadas,
        "cuotas_totales": plazo,
        "cuotas": cuotas,
    }

# -----------------------
# GET préstamos (con saldo y cuotas pagadas)
# -----------------------
@router.get("/prestamos/{usuario_id}")
def listar_prestamos(usuario_id: int, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    prestamos = (
        db.query(Prestamo)
        .filter(Prestamo.usuario_id == usuario_id)
        .order_by(Prestamo.fecha_prestamo.desc())
        .all()
    )

    respuesta = []
    for p in prestamos:
        total_original = float(p.total if p.total is not None else ((p.monto or 0) + (p.intereses or 0)))
        total_pagado = _sum_pagos_prestamo(db, usuario_id, p.id)
        saldo_pendiente = max(0.0, total_original - total_pagado)

        # Auto-actualizar estado si ya pagó todo
        if saldo_pendiente <= 0.0 and (p.estado or "").lower() != "pagado":
            p.estado = "pagado"
            db.commit()

        pagos_movs = _list_pagos_prestamo(db, usuario_id, p.id)

        plan = None
        if p.fecha_prestamo and p.plazo and p.plazo > 0:
            plan = calcular_plan_pagos(
                monto=float(p.monto or 0),
                interes_total=float(p.intereses or 0),
                plazo=int(p.plazo),
                fecha_inicio=p.fecha_prestamo,
                pagos_movs=pagos_movs
            )

        respuesta.append({
            "id": p.id,
            "monto": p.monto,
            "fecha_prestamo": p.fecha_prestamo.isoformat() if p.fecha_prestamo else None,
            "fecha_vencimiento": p.fecha_vencimiento.isoformat() if p.fecha_vencimiento else None,
            "intereses": float(p.intereses or 0),
            "total": total_original,
            "total_pagado": round(total_pagado, 2),
            "saldo_pendiente": round(saldo_pendiente, 2),
            "estado": p.estado,
            "plazo": p.plazo,
            "plan_pagos": plan,
        })

    return respuesta

# -----------------------
# POST registrar pago (para admin)
# -----------------------
@router.post("/prestamos/{prestamo_id}/registrar_pago")
def registrar_pago(prestamo_id: int, monto: int = 0, db: Session = Depends(get_db)):
    prestamo = db.query(Prestamo).filter(Prestamo.id == prestamo_id).first()
    if not prestamo:
        raise HTTPException(status_code=404, detail="Préstamo no encontrado")

    if (prestamo.estado or "").lower() == "pagado":
        raise HTTPException(status_code=400, detail="Este préstamo ya está pagado")

    total_original = float(prestamo.total if prestamo.total is not None else ((prestamo.monto or 0) + (prestamo.intereses or 0)))
    total_pagado = _sum_pagos_prestamo(db, prestamo.usuario_id, prestamo.id)
    saldo = max(0.0, total_original - total_pagado)

    if saldo <= 0:
        prestamo.estado = "pagado"
        db.commit()
        raise HTTPException(status_code=400, detail="Este préstamo ya quedó saldado")

    # Si no mandan monto, pagamos una cuota "teórica"
    if (not monto or monto <= 0) and prestamo.plazo and prestamo.plazo > 0:
        cuota = total_original / int(prestamo.plazo)
        monto = int(round(cuota))
    elif monto <= 0:
        raise HTTPException(status_code=400, detail="Monto inválido")

    # No permitir pagar más de lo que falta (para evitar saldo negativo)
    if monto > saldo:
        monto = int(round(saldo))

    tag = _tag_prestamo(prestamo.id)

    mov = Movimiento(
        usuario_id=prestamo.usuario_id,
        tipo="Pago Préstamo",
        monto=int(monto),
        fecha=datetime.now(),
        categoria="prestamo",
        descripcion=f"Pago de préstamo {tag}"
    )
    db.add(mov)

    # Si con este pago ya salda
    nuevo_total_pagado = total_pagado + float(monto)
    nuevo_saldo = max(0.0, total_original - nuevo_total_pagado)
    if nuevo_saldo <= 0:
        prestamo.estado = "pagado"

    db.commit()

    return {
        "mensaje": "Pago registrado",
        "prestamo_id": prestamo.id,
        "monto_pagado": monto,
        "saldo_pendiente": round(nuevo_saldo, 2),
        "estado": prestamo.estado
    }

@router.post("/prestamos/{prestamo_id}/pagar_cuota")
def pagar_cuota(prestamo_id: int, db: Session = Depends(get_db)):
    # Paga una cuota "por defecto" (monto=0 hace que el backend calcule la cuota)
    return registrar_pago(prestamo_id=prestamo_id, monto=0, db=db)
