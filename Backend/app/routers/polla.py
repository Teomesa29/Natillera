from datetime import date, timedelta, datetime
import requests
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Usuario, ResultadoLoteria

router = APIRouter(prefix="/api", tags=["Polla"])

API_EXTERNA = "https://api-resultadosloterias.com/api/results"

def last_friday_of_month(year: int, month: int) -> date:
    # último día del mes
    if month == 12:
        last_day = date(year, 12, 31)
    else:
        last_day = date(year, month + 1, 1) - timedelta(days=1)

    # weekday(): lunes=0 ... viernes=4
    offset = (last_day.weekday() - 4) % 7
    return last_day - timedelta(days=offset)

def prev_month_year_month(d: date) -> tuple[int, int]:
    if d.month == 1:
        return d.year - 1, 12
    return d.year, d.month - 1

def fetch_medellin_result(draw_date: date) -> dict:
    url = f"{API_EXTERNA}/{draw_date.isoformat()}"
    r = requests.get(url, timeout=20)
    r.raise_for_status()
    data = r.json()

    if not isinstance(data, list):
        raise RuntimeError("Respuesta inesperada de API externa")

    med = next((x for x in data if x.get("slug") == "medellin" or x.get("lottery") == "MEDELLIN"), None)
    if not med:
        raise RuntimeError(f"No hay resultado MEDELLIN para {draw_date.isoformat()}")

    return {
        "lottery": med.get("lottery") or "MEDELLIN",
        "slug": med.get("slug") or "medellin",
        "date": med.get("date") or draw_date.isoformat(),
        "result": str(med.get("result") or ""),
        "series": str(med.get("series") or "") if med.get("series") is not None else None,
    }

def get_or_fetch_last_result(db: Session) -> ResultadoLoteria | None:
    """
    Devuelve el último resultado disponible.
    Si no hay nada en DB, intenta traer el del mes pasado (último viernes) desde la API y lo guarda.
    """
    ultimo = (
        db.query(ResultadoLoteria)
        .filter(ResultadoLoteria.slug == "medellin")
        .order_by(ResultadoLoteria.date.desc())
        .first()
    )
    if ultimo:
        return ultimo

    # Fallback: mes pasado
    today = date.today()
    y, m = prev_month_year_month(today)
    draw_date = last_friday_of_month(y, m)

    try:
        med = fetch_medellin_result(draw_date)
    except Exception:
        return None

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
    return nuevo

@router.get("/polla/estado/{usuario_id}")
def estado_polla(usuario_id: int, db: Session = Depends(get_db)):
    user = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.polla is None:
        raise HTTPException(status_code=400, detail="Este usuario no tiene número de polla asignado")

    ultimo = get_or_fetch_last_result(db)
    if not ultimo:
        return {
            "usuario_id": user.id,
            "polla": user.polla,
            "hay_resultado": False,
            "mensaje": "No hay resultado disponible todavía."
        }

    # ✅ Regla B: últimos 2 dígitos
    res2 = str(ultimo.result)[-2:].zfill(2)
    polla2 = str(user.polla)[-2:].zfill(2)
    gano = (res2 == polla2)

    return {
        "usuario_id": user.id,
        "polla": user.polla,
        "hay_resultado": True,
        "fecha_sorteo": ultimo.date.isoformat(),
        "resultado": ultimo.result,
        "serie": ultimo.series,
        "gano": gano,
        "comparacion": {"resultado_2": res2, "polla_2": polla2},
        # Este mensaje es el que quieres ver:
        "mensaje": (f"Número ganador del mes pasado: {res2}. ¡Ganaste!"
                    if gano
                    else f"Número ganador del mes pasado: {res2}. No ganaste.")
    }
