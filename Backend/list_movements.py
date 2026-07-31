from app.database import SessionLocal
from app.models.models import Movimiento

db = SessionLocal()
try:
    movs = db.query(Movimiento).order_by(Movimiento.fecha.desc()).all()
    print("ALL MOVEMENTS:")
    for m in movs:
        print(f"ID: {m.id}, UserID: {m.usuario_id}, Tipo: {m.tipo}, Monto: {m.monto}, Categoria: {m.categoria}, Desc: {m.descripcion}, Fecha: {m.fecha}")
finally:
    db.close()
