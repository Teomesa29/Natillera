from sqlalchemy.orm import Session
from app.models.models import Ahorro

def crear_ahorro_inicial(
    db: Session,
    usuario_id: int,
    ahorro_mensual: int,
    porcentaje_interes: float = 8.5
) -> Ahorro:
    nuevo_ahorro = Ahorro(
        usuario_id=usuario_id,
        ahorro_mensual=ahorro_mensual,
        total_ahorrado=0.0,
        porcentaje_interes=porcentaje_interes,
        interes_ganado=0.0
    )
    db.add(nuevo_ahorro)
    db.flush()  # 👈 importante: genera el ID sin hacer commit todavía
    db.refresh(nuevo_ahorro)
    return nuevo_ahorro
