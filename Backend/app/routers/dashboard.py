from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import re
from datetime import datetime

from app.database import get_db
from app.models.models import Usuario, Ahorro, Prestamo, Movimiento, ResultadoLoteria

router = APIRouter(prefix="/api", tags=["dashboard"])

def validar_usuario(db: Session, usuario_id: int) -> Usuario:
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    return usuario

def calcular_acumulado_polla(db: Session) -> float:
    # 1. Obtener todos los pagos de polla
    movs = db.query(Movimiento).filter(Movimiento.tipo == "Pago Polla").all()
    
    # Organizar pagos por (mes_index, año)
    meses_nombres = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    
    pagos_por_mes = {} # {(año, mes_index): monto_total}
    for m in movs:
        match = re.search(r'\((Enero|Febrero|Marzo|Abril|Mayo|Junio|Julio|Agosto|Septiembre|Octubre|Noviembre|Diciembre)\s+(\d{4})\)', m.descripcion or "")
        if match:
            mes_nombre = match.group(1)
            anio = int(match.group(2))
            mes_index = meses_nombres.index(mes_nombre)
            key = (anio, mes_index)
            pagos_por_mes[key] = pagos_por_mes.get(key, 0) + (m.monto or 0)

    # 2. Obtener todos los resultados de lotería ordenados
    resultados = db.query(ResultadoLoteria).filter(ResultadoLoteria.slug == "medellin").order_by(ResultadoLoteria.date.asc()).all()
    res_por_mes = {} # {(año, mes_index): ResultadoLoteria}
    for r in resultados:
        res_por_mes[(r.date.year, r.date.month - 1)] = r

    # 3. Obtener todos los usuarios con polla activa
    usuarios = db.query(Usuario).filter(Usuario.polla != None).all()

    # 4. Simular mes a mes desde el inicio (año 2026) hasta el mes actual
    now = datetime.now()
    anio_actual = now.year
    mes_actual = now.month - 1
    
    acumulado = 0.0
    
    for anio in range(2026, anio_actual + 1):
        start_month = 0
        end_month = mes_actual if anio == anio_actual else 11
        for mes_idx in range(start_month, end_month + 1):
            key = (anio, mes_idx)
            monto_mes = pagos_por_mes.get(key, 0)
            acumulado += monto_mes
            
            # Verificar si hubo sorteo y ganador este mes
            if key in res_por_mes:
                draw = res_por_mes[key]
                res_2 = str(draw.result)[-2:].zfill(2) if draw.result else None
                
                if res_2:
                    # Encontrar si alguien ganó
                    ganador = None
                    for u in usuarios:
                        u_polla_2 = str(u.polla)[-2:].zfill(2)
                        if u_polla_2 == res_2:
                            ganador = u
                            break
                    
                    if ganador:
                        # Si alguien ganó, se lleva el acumulado de ese momento y se reinicia
                        acumulado = 0.0
                        
    return acumulable_total if (acumulable_total := acumulado) >= 0 else 0.0

@router.get("/dashboard/{usuario_id}")
def obtener_dashboard(usuario_id: int, db: Session = Depends(get_db)):
    usuario = validar_usuario(db, usuario_id)

    ahorro = db.query(Ahorro).filter(Ahorro.usuario_id == usuario_id).first()
    prestamos = db.query(Prestamo).filter(Prestamo.usuario_id == usuario_id).all()
    total_prestado = sum((p.monto or 0) for p in prestamos)
    
    polla_acumulado = calcular_acumulado_polla(db)

    # últimos movimientos
    movimientos = (
        db.query(Movimiento)
        .filter(Movimiento.usuario_id == usuario_id)
        .order_by(Movimiento.fecha.desc())
        .limit(6)
        .all()
    )

    ahorros_todos = db.query(Ahorro).all()
    total_ahorrado_global = sum((a.total_ahorrado or 0) for a in ahorros_todos)

    return {
        "ahorro_mensual": ahorro.ahorro_mensual if ahorro else 0,
        "total_ahorrado": ahorro.total_ahorrado if ahorro else 0,
        "porcentaje_interes": float(ahorro.porcentaje_interes) if ahorro else 8.5,
        "interes_ganado": float(ahorro.interes_ganado) if ahorro else 0.0,

        "socios_total": db.query(Usuario).count(),
        "total_prestado": total_prestado,
        "numero_polla": usuario.polla,
        "polla_acumulado": polla_acumulado,
        "observaciones": usuario.observaciones,
        "total_ahorrado_global": total_ahorrado_global,

        "historial": [
            {
                "id": m.id,
                "tipo": m.tipo,
                "monto": float(m.monto),
                "categoria": m.categoria,
                "descripcion": m.descripcion,
                "fecha": m.fecha.isoformat() if m.fecha else None,
            }
            for m in movimientos
        ],
    }

