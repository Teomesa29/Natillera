from datetime import date, timedelta, datetime
import requests
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.models.models import Usuario, ResultadoLoteria

router = APIRouter(prefix="/api", tags=["Polla"])

API_EXTERNA = "https://api-resultadosloterias.com/api/results"

def last_friday_of_month(year: int, month: int) -> date:
    if month == 12:
        last_day = date(year, 12, 31)
    else:
        last_day = date(year, month + 1, 1) - timedelta(days=1)

    offset = (last_day.weekday() - 4) % 7
    return last_day - timedelta(days=offset)

def prev_month_year_month(d: date) -> tuple[int, int]:
    if d.month == 1:
        return d.year - 1, 12
    return d.year, d.month - 1

def fetch_medellin_result(draw_date: date) -> dict:
    url = f"{API_EXTERNA}/{draw_date.isoformat()}"
    r = requests.get(url, timeout=3)
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
        "date": med.get("date") or draw_date.isoformat(),
        "result": str(med.get("result") or ""),
        "series": str(med.get("series") or "") if med.get("series") is not None else None,
    }

def task_sync_today_lottery():
    """
    Tarea asíncrona de segundo plano (Background Task) para no bloquear la respuesta HTTP del usuario.
    """
    db = SessionLocal()
    try:
        today = date.today()
        ultimo_viernes_mes_actual = last_friday_of_month(today.year, today.month)
        
        if today >= ultimo_viernes_mes_actual:
            draw_date = ultimo_viernes_mes_actual
        else:
            prev_y, prev_m = prev_month_year_month(today)
            draw_date = last_friday_of_month(prev_y, prev_m)
        
        existente = db.query(ResultadoLoteria).filter(
            ResultadoLoteria.slug == "medellin",
            ResultadoLoteria.date == draw_date
        ).first()

        if not existente:
            med = fetch_medellin_result(draw_date)
            if med and med.get("result"):
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
    except Exception as e:
        print(f"[Segundo Plano] Sorteo ({date.today()}) aún no disponible en API externa: {e}")
    finally:
        db.close()


def get_or_fetch_last_result(db: Session, background_tasks: BackgroundTasks | None = None) -> ResultadoLoteria | None:
    if background_tasks:
        background_tasks.add_task(task_sync_today_lottery)

    return (
        db.query(ResultadoLoteria)
        .filter(ResultadoLoteria.slug == "medellin")
        .order_by(ResultadoLoteria.date.desc())
        .first()
    )

@router.get("/polla/estado/{usuario_id}")
def estado_polla(usuario_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user.polla is None:
        raise HTTPException(status_code=400, detail="Este usuario no tiene número de polla asignado")

    ultimo = get_or_fetch_last_result(db, background_tasks)
    if not ultimo:
        return {
            "usuario_id": user.id,
            "polla": user.polla,
            "hay_resultado": False,
            "mensaje": "No hay resultado disponible todavía."
        }

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
        "mensaje": (f"Número ganador del mes pasado: {res2}. ¡Ganaste!"
                    if gano
                    else f"Número ganador del mes pasado: {res2}. No ganaste.")
    }

@router.get("/polla/historial")
def historial_polla(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    background_tasks.add_task(task_sync_today_lottery)
    
    resultados = db.query(ResultadoLoteria).order_by(ResultadoLoteria.date.desc()).all()
    return [
        {
            "id": r.id,
            "lottery": r.lottery,
            "date": r.date.isoformat(),
            "result": r.result,
            "series": r.series,
            "ganador": str(r.result)[-2:].zfill(2) if r.result else ""
        }
        for r in resultados
    ]
