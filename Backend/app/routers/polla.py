from datetime import date, timedelta, datetime
import requests
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.models.models import Usuario, ResultadoLoteria

router = APIRouter(prefix="/api", tags=["Polla"])


from app.services.polla_scheduler import last_friday_of_month, sync_medellin_if_last_friday, fetch_medellin_result

def task_sync_today_lottery():
    """
    Tarea asíncrona de segundo plano (Background Task) para no bloquear la respuesta HTTP del usuario.
    """
    db = SessionLocal()
    try:
        r = sync_medellin_if_last_friday(db)
        print("[PollaBackgroundTask]", r)
    except Exception as e:
        print(f"[Segundo Plano] Error al sincronizar lotería: {e}")
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
