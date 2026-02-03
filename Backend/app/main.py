from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from app.models import models  
from app.database import SessionLocal
from app.services.polla_scheduler import sync_medellin_if_last_friday
from app.database import engine, Base
from app.routers.crear_usuario import router as crear_usuario_router
from app.routers.auth import router as auth_router
from app.routers.Finanzas import router as finanzas_router
from app.routers.dashboard import router as dashboard_router
from app.routers.prestamos import router as prestamos_router
from app.routers.polla import router as polla_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="API Natillera")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(crear_usuario_router)
app.include_router(auth_router)
app.include_router(finanzas_router)
app.include_router(dashboard_router)
app.include_router(prestamos_router)
app.include_router(polla_router)
@app.get("/")
def root():
    return {"status": "ok", "service": "API Natillera"}

# -------------------------
# Scheduler (APScheduler)
# -------------------------
scheduler = BackgroundScheduler(timezone="America/Bogota")

def job_sync_polla():
    db = SessionLocal()
    try:
        r = sync_medellin_if_last_friday(db)
        print("[PollaJob]", r)
    except Exception as e:
        print("[PollaJob][ERROR]", str(e))
    finally:
        db.close()

@app.on_event("startup")
def start_scheduler():
    # corre todos los días 22:10 (ajústalo)
    scheduler.add_job(
        job_sync_polla,
        CronTrigger(hour=22, minute=10),
        id="sync_polla_medellin",
        replace_existing=True,
    )
    scheduler.start()

@app.on_event("shutdown")
def shutdown_scheduler():
    scheduler.shutdown()
