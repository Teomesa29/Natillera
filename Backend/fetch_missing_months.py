from datetime import date, datetime, timedelta
import requests
from app.database import SessionLocal
from app.models.models import ResultadoLoteria
from app.services.polla_scheduler import last_friday_of_month, fetch_medellin_result

db = SessionLocal()

# We need to sync results for January (month 1), March (month 3), and May (month 5) of 2026.
months_to_sync = [1, 3, 5]
year = 2026

try:
    for m in months_to_sync:
        draw_date = last_friday_of_month(year, m)
        print(f"Syncing month {m} ({draw_date})...")
        
        # Check if already exists
        exists = db.query(ResultadoLoteria).filter(
            ResultadoLoteria.slug == "medellin",
            ResultadoLoteria.date == draw_date
        ).first()
        
        if exists:
            print(f"Result for {draw_date} already exists: {exists.result}")
            continue
            
        try:
            res = fetch_medellin_result(draw_date)
            print(f"Fetched result for {draw_date}: {res}")
            
            nuevo = ResultadoLoteria(
                slug="medellin",
                lottery="MEDELLIN",
                date=draw_date,
                result=res["result"],
                series=res.get("series"),
                fetched_at=datetime.now()
            )
            db.add(nuevo)
            db.commit()
            print(f"Successfully saved {draw_date} result: {res['result']}")
        except Exception as ex:
            db.rollback()
            print(f"Error fetching/saving result for {draw_date}: {ex}")
            
except Exception as e:
    print(f"An error occurred: {e}")
finally:
    db.close()
