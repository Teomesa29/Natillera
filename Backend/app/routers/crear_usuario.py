from fastapi import APIRouter, status, Depends, HTTPException
from sqlalchemy.orm import Session
from app.schemas.schemas import UsuarioCreate
from app.database import get_db
from app.models.models import Usuario, Ahorro
from app.security.security import hash_password
from app.services.finanzas_service import crear_ahorro_inicial

router = APIRouter(prefix="/api", tags=["Usuarios"])

@router.post("/crear_usuario", status_code=status.HTTP_201_CREATED)
def crear_usuario(payload: UsuarioCreate, db: Session = Depends(get_db)):

    existe = db.query(Usuario).filter(Usuario.usuario == payload.usuario).first()
    if existe:
        raise HTTPException(status_code=409, detail="El usuario ya existe")

    password_hash = hash_password(payload.password)

    nuevo_usuario = Usuario(
        usuario=payload.usuario.lower().strip(),
        nombre=payload.nombre.strip(),
        telefono=payload.telefono,
        polla=payload.polla,
        email=payload.email,
        password=password_hash,
        rol=payload.rol
    )

    try:
        db.add(nuevo_usuario)
        db.flush()          # 👈 ya tienes nuevo_usuario.id sin commit
        db.refresh(nuevo_usuario)

        ahorro = crear_ahorro_inicial(
            db=db,
            usuario_id=nuevo_usuario.id,
            ahorro_mensual=payload.ahorro_mensual,
            porcentaje_interes=payload.porcentaje_interes
        )

        db.commit()
        db.refresh(nuevo_usuario)
        db.refresh(ahorro)

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creando usuario/ahorro: {str(e)}")

    return {"mensaje": "Usuario creado", "usuario": {"id": nuevo_usuario.id, "usuario": nuevo_usuario.usuario}, "ahorro": {"id": ahorro.id}}

from app.schemas.schemas import UsuarioCreate, UsuarioObservacionesUpdate

@router.get("/usuarios")
def listar_usuarios(db: Session = Depends(get_db)):
    usuarios = db.query(Usuario).order_by(Usuario.nombre.asc()).all()
    return [
        {
            "id": u.id,
            "usuario": u.usuario,
            "nombre": u.nombre,
            "telefono": u.telefono,
            "rol": u.rol,
            "activo": u.activo,
            "polla": u.polla,
            "observaciones": u.observaciones
        }
        for u in usuarios
    ]

@router.delete("/usuarios/{usuario_id}")
def eliminar_usuario(usuario_id: int, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    from app.models.models import Prestamo, Movimiento
    db.query(Prestamo).filter(Prestamo.usuario_id == usuario_id).delete()
    db.query(Movimiento).filter(Movimiento.usuario_id == usuario_id).delete()
    db.query(Ahorro).filter(Ahorro.usuario_id == usuario_id).delete()
    
    db.delete(usuario)
    db.commit()
    return {"mensaje": f"Usuario {usuario.nombre} eliminado correctamente"}

@router.put("/usuarios/{usuario_id}/observaciones")
def actualizar_observaciones(usuario_id: int, payload: UsuarioObservacionesUpdate, db: Session = Depends(get_db)):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    usuario.observaciones = payload.observaciones
    db.commit()
    db.refresh(usuario)
    return {"mensaje": "Observaciones actualizadas correctamente", "observaciones": usuario.observaciones}

