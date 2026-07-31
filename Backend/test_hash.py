from app.database import SessionLocal
from app.models.models import Usuario
from app.security.security import hash_password, verify_password

db = SessionLocal()
user = db.query(Usuario).filter(Usuario.usuario == 'teomesa').first()

if user:
    # Intenta verificar la actual
    try:
        is_valid = verify_password('2901', user.password)
        print(f"¿Verifica 2901 actual?: {is_valid}")
    except Exception as e:
        print(f"Error verificando: {e}")
        
    print(f"Hash actual en DB: {user.password}")
    
    # Resetea a 2901
    nuevo_hash = hash_password('2901')
    user.password = nuevo_hash
    db.commit()
    print(f"Contraseña de teomesa reseteada a 2901 con nuevo hash: {nuevo_hash}")
else:
    print("Usuario no encontrado")

db.close()
