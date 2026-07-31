# app/services/polla_scheduler.py
from datetime import date, datetime, timedelta
import requests
from sqlalchemy.orm import Session

from app.models.models import ResultadoLoteria

API_EXTERNA = "https://api-resultadosloterias.com/api/results"


def last_friday_of_month(year: int, month: int) -> date:
    if month == 12:
        last_day = date(year, 12, 31)
    else:
        last_day = date(year, month + 1, 1) - timedelta(days=1)

    # weekday(): lunes=0 ... viernes=4
    offset = (last_day.weekday() - 4) % 7
    return last_day - timedelta(days=offset)


def get_most_recent_last_friday(today: date) -> date:
    current_month_last_friday = last_friday_of_month(today.year, today.month)
    
    if today >= current_month_last_friday:
        return current_month_last_friday
    
    if today.month == 1:
        prev_year = today.year - 1
        prev_month = 12
    else:
        prev_year = today.year
        prev_month = today.month - 1
        
    return last_friday_of_month(prev_year, prev_month)


def fetch_medellin_result(draw_date: date) -> dict:
    url = f"{API_EXTERNA}/{draw_date.isoformat()}"
    r = requests.get(url, timeout=20)
    r.raise_for_status()

    res_json = r.json()
    if isinstance(res_json, dict):
        data = res_json.get("data", [])
    else:
        data = res_json

    if not isinstance(data, list):
        raise RuntimeError("Respuesta inesperada de API externa")

    med = next((x for x in data if x.get("slug") == "medellin" or x.get("lottery") == "MEDELLIN"), None)
    if not med:
        raise RuntimeError(f"No hay resultado MEDELLIN para {draw_date.isoformat()}")

    return {
        "lottery": med.get("lottery") or "MEDELLIN",
        "slug": med.get("slug") or "medellin",
        "date": med.get("date"),
        "result": str(med.get("result") or ""),
        "series": str(med.get("series") or "") if med.get("series") is not None else None,
    }



def sync_medellin_if_last_friday(db: Session) -> dict:
    today = date.today()
    draw_date = get_most_recent_last_friday(today)

    # Verificar si ya existe
    exists = (
        db.query(ResultadoLoteria)
        .filter(
            ResultadoLoteria.slug == "medellin",
            ResultadoLoteria.date == draw_date
        )
        .first()
    )

    if exists:
        return {
            "ran": True,
            "mensaje": "Ya estaba guardado",
            "date": exists.date.isoformat(),
            "result": exists.result
        }

    # Intentar traerlo
    try:
        med = fetch_medellin_result(draw_date)
    except Exception as e:
        return {
            "ran": False,
            "mensaje": f"Error consultando API: {str(e)}"
        }

    nuevo = ResultadoLoteria(
        slug="medellin",
        lottery="MEDELLIN",
        date=draw_date,
        result=med["result"],
        series=med.get("series"),
        fetched_at=datetime.now(),
    )

    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)

    return {
        "ran": True,
        "mensaje": "Resultado sincronizado correctamente",
        "date": nuevo.date.isoformat(),
        "result": nuevo.result
    }
