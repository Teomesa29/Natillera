from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Usuario, Ahorro, Prestamo, Movimiento

router = APIRouter(prefix="/api", tags=["dashboard"])

def validar_usuario(db: Session, usuario_id: int) -> Usuario:
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    return usuario

@router.get("/dashboard/{usuario_id}")  # <- sin response_model por ahora
def obtener_dashboard(usuario_id: int, db: Session = Depends(get_db)):
    usuario = validar_usuario(db, usuario_id)

    ahorro = db.query(Ahorro).filter(Ahorro.usuario_id == usuario_id).first()
    prestamos = db.query(Prestamo).filter(Prestamo.usuario_id == usuario_id).all()
    total_prestado = sum((p.monto or 0) for p in prestamos)

    # últimos movimientos
    movimientos = (
        db.query(Movimiento)
        .filter(Movimiento.usuario_id == usuario_id)
        .order_by(Movimiento.fecha.desc())
        .limit(6)
        .all()
    )

    return {
        "ahorro_mensual": ahorro.ahorro_mensual if ahorro else 0,
        "total_ahorrado": ahorro.total_ahorrado if ahorro else 0,
        "porcentaje_interes": float(ahorro.porcentaje_interes) if ahorro else 8.5,
        "interes_ganado": float(ahorro.interes_ganado) if ahorro else 0.0,

        "socios_total": db.query(Usuario).count(),
        "total_prestado": total_prestado,
        "numero_polla": usuario.polla,

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
