from app.database import SessionLocal
from app.models.models import ResultadoLoteria

db = SessionLocal()
try:
    results = db.query(ResultadoLoteria).order_by(ResultadoLoteria.date.asc()).all()
    print("LOTTERY RESULTS IN DB:")
    for r in results:
        print(f"ID: {r.id}, Slug: {r.slug}, Lottery: {r.lottery}, Date: {r.date}, Result: {r.result}, Series: {r.series}")
finally:
    db.close()
