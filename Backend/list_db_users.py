from app.database import SessionLocal
from app.models.models import Usuario

db = SessionLocal()
try:
    usuarios = db.query(Usuario).all()
    for u in usuarios:
        print(f"ID: {u.id}, User: {u.usuario}, Name: {u.nombre}, Telefono: {u.telefono}, Polla: {u.polla}, Email: {u.email}, Activo: {u.activo}, Rol: {u.rol}")
finally:
    db.close()
