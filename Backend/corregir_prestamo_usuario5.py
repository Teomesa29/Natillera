from app.database import SessionLocal
from app.models.models import Prestamo, Movimiento, Ahorro, Usuario
from datetime import datetime

def corregir_usuario_5():
    db = SessionLocal()
    try:
        user = db.query(Usuario).filter(Usuario.id == 5).first()
        if not user:
            print("Usuario 5 no encontrado.")
            return

        ahorro = db.query(Ahorro).filter(Ahorro.usuario_id == 5).first()
        prestamo = db.query(Prestamo).filter(Prestamo.usuario_id == 5, Prestamo.id == 1).first()

        print(f"Usuario: {user.nombre} (ID: {user.id})")
        print(f"Total ahorrado actual: ${ahorro.total_ahorrado:,} COP")
        
        if prestamo:
            print(f"Préstamo ID #{prestamo.id}: Monto ${prestamo.monto:,} COP, Estado: {prestamo.estado}")
            
            # Sumar aportes del usuario
            movs = db.query(Movimiento).filter(Movimiento.usuario_id == 5).all()
            aportes = sum(m.monto for m in movs if m.tipo in ["Aporte Mensual", "Interés Mensual", "Abono Ahorro"])
            descuentos = sum(abs(m.monto) for m in movs if m.tipo == "Descuento Ahorro")
            pagos = sum(m.monto for m in movs if m.tipo == "Pago Préstamo" and f"[prestamo_id:{prestamo.id}]" in (m.descripcion or ""))

            total_esperado = (aportes - descuentos) - prestamo.monto + pagos

            print(f"Total aportes sin préstamo: ${aportes - descuentos:,} COP")
            print(f"Total pagos realizados del préstamo: ${pagos:,} COP")
            print(f"Nuevo total ahorrado ajustado: ${total_esperado:,} COP")

            ahorro.total_ahorrado = total_esperado
            ahorro.ultima_actualizacion = datetime.now()
            db.commit()
            print("✅ Saldo del usuario 5 corregido exitosamente en la base de datos.")
        else:
            print("No se encontró el préstamo para el usuario 5.")

    except Exception as e:
        db.rollback()
        print(f"Error al corregir saldo: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    corregir_usuario_5()
