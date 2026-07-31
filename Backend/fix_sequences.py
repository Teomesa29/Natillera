from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    tables = ["usuarios", "ahorros", "prestamos", "movimientos", "resultados_loteria"]
    for table in tables:
        # Get the sequence name
        # Fix the sequence by setting it to the max id + 1
        query = f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), COALESCE(max(id), 0) + 1, false) FROM {table}"
        db.execute(text(query))
        print(f"Sequence for {table} synchronized.")
    db.commit()
    print("All sequences synchronized successfully!")
except Exception as e:
    db.rollback()
    import traceback
    traceback.print_exc()
finally:
    db.close()
