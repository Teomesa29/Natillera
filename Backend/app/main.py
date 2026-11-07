from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.database import SessionLocal, engine, Base
from app.services.polla_scheduler import sync_medellin_if_last_friday
from app.routers.crear_usuario import router as crear_usuario_router
from app.routers.auth import router as auth_router
from app.routers.Finanzas import aplicar_interes_mensual_automatico, router as finanzas_router
from app.routers.dashboard import router as dashboard_router
from app.routers.prestamos import router as prestamos_router
from app.routers.polla import router as polla_router

Base.metadata.create_all(bind=engine)

app = FastAPI(title="API Natillera")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://teomesa29.github.io",
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://localhost:3000",
    ],
    allow_origin_regex=r"https?://.*\.github\.io|https?://(localhost|127\.0\.0\.1)(:[0-9]+)?",
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

from datetime import datetime
from app.models.models import Prestamo, Movimiento, Ahorro

def sincronizar_prestamos_ahorros_historicos():
    """
    Sincroniza préstamos creados previamente cuyo monto no fue descontado
    del total ahorrado del socio (por ejemplo el préstamo del usuario 5).
    """
    db = SessionLocal()
    try:
        prestamos = db.query(Prestamo).all()
        for p in prestamos:
            ahorro = db.query(Ahorro).filter(Ahorro.usuario_id == p.usuario_id).first()
            if not ahorro:
                continue

            movs = db.query(Movimiento).filter(Movimiento.usuario_id == p.usuario_id).all()
            aportes = sum(m.monto for m in movs if m.tipo in ["Aporte Mensual", "Interés Mensual", "Abono Ahorro"])
            descuentos = sum(abs(m.monto) for m in movs if m.tipo == "Descuento Ahorro")
            
            tag = f"[prestamo_id:{p.id}]"
            pagos_prestamo = sum(m.monto for m in movs if m.tipo == "Pago Préstamo" and tag in (m.descripcion or ""))

            total_esperado_sin_prestamo = aportes - descuentos

            if ahorro.total_ahorrado == total_esperado_sin_prestamo and (p.monto or 0) > 0:
                print(f"[SYNC] Corrigiendo ahorro de usuario {p.usuario_id}: descontando préstamo #{p.id} de {p.monto}")
                ahorro.total_ahorrado = max(0, total_esperado_sin_prestamo - int(p.monto or 0) + int(pagos_prestamo))
                ahorro.ultima_actualizacion = datetime.now()
                db.commit()
    except Exception as e:
        db.rollback()
        print(f"[SYNC][ERROR] Error sincronizando préstamos con ahorros: {e}")
    finally:
        db.close()

@app.on_event("startup")
def on_startup():
    sincronizar_prestamos_ahorros_historicos()

@app.get("/")
def root():
    return {"status": "ok", "service": "API Natillera"}


# =========================================================
# 🔥 SCHEDULER GLOBAL
# =========================================================
scheduler = BackgroundScheduler(timezone="America/Bogota")


# -------------------------
# JOB 1: Interés mensual
# -------------------------
scheduler.add_job(
    aplicar_interes_mensual_automatico,
    CronTrigger(day=1, hour=5, minute=5),
    id="interes_mensual",
    replace_existing=True
)


# -------------------------
# JOB 2: Sync Polla
# -------------------------
def job_sync_polla():
    db = SessionLocal()
    try:
        r = sync_medellin_if_last_friday(db)
        print("[PollaJob]", r)
    except Exception as e:
        print("[PollaJob][ERROR]", str(e))
    finally:
        db.close()


# Intento principal la noche del sorteo (11:30 PM)
scheduler.add_job(
    job_sync_polla,
    CronTrigger(hour=23, minute=30),
    id="sync_polla_medellin_2330",
    replace_existing=True
)

# Reintentos continuos cada 4 horas durante todo el día por si la API se demora en publicar
scheduler.add_job(
    job_sync_polla,
    CronTrigger(hour="*/4", minute=15),
    id="sync_polla_medellin_interval",
    replace_existing=True
)




# =========================================================
# EVENTOS FASTAPI
# =========================================================
@app.on_event("startup")
def start_scheduler():
    if not scheduler.running:
        scheduler.start()
        print("Scheduler iniciado correctamente")


@app.on_event("shutdown")
def shutdown_scheduler():
    scheduler.shutdown()
    print("Scheduler detenido")


@app.api_route("/health", methods=["GET", "HEAD"])
def health():
    return Response(status_code=200)