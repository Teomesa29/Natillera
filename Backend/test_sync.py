from app.database import SessionLocal
from app.services.polla_scheduler import sync_medellin_if_last_friday

db = SessionLocal()
try:
    res = sync_medellin_if_last_friday(db)
    print("Result of sync:", res)
except Exception as e:
    import traceback
    print("Exception during sync:")
    traceback.print_exc()
finally:
    db.close()
