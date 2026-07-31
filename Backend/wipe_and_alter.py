from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    print("Altering table to add 'observaciones' column if it doesn't exist...")
    # Add observaciones column to usuarios table
    db.execute(text("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS observaciones VARCHAR;"))
    db.commit()
    print("Column 'observaciones' added successfully.")
    
    print("Clearing all financial transactions (movimientos, prestamos, reset ahorros)...")
    # Delete all movements
    db.execute(text("DELETE FROM movimientos;"))
    # Delete all loans
    db.execute(text("DELETE FROM prestamos;"))
    # Reset savings total and interest to zero
    db.execute(text("UPDATE ahorros SET total_ahorrado = 0, interes_ganado = 0.0;"))
    db.commit()
    print("Financial data wiped successfully.")
    
    print("Synchronizing database sequences...")
    # Sync sequences
    tables = ["usuarios", "ahorros", "prestamos", "movimientos", "resultados_loteria"]
    for table in tables:
        query = f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), COALESCE(max(id), 0) + 1, false) FROM {table}"
        db.execute(text(query))
    db.commit()
    print("Sequences synchronized successfully.")
    
    print("Database reset completed successfully!")
except Exception as e:
    db.rollback()
    import traceback
    traceback.print_exc()
finally:
    db.close()
