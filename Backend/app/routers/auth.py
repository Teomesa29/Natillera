from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Usuario
from app.schemas.schemas import UsuarioLogin, RecuperarPassword
from app.security.security import verify_password, create_access_token, hash_password
import logging

router = APIRouter(prefix="/api", tags=["Auth"])
logger = logging.getLogger("uvicorn.error")

@router.post("/login")
def login(payload: UsuarioLogin, db: Session = Depends(get_db)):
    user = db.query(Usuario).filter(Usuario.usuario == payload.usuario).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas"
        )
    
    if not user.activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo"
        )

    is_valid = verify_password(payload.password, user.password)
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas"
        )

    token = create_access_token(user.id, user.rol)

    return {
        "access_token": token,
        "usuario": {
            "id": user.id,
            "usuario": user.usuario,
            "nombre": user.nombre,
            "rol": user.rol,
            "activo": user.activo
        }
    }

@router.post("/recuperar-password")
def recuperar_password(payload: RecuperarPassword, db: Session = Depends(get_db)):
    # Buscar al usuario por correo y celular
    user = db.query(Usuario).filter(Usuario.email == payload.email, Usuario.telefono == payload.celular).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró un usuario con ese correo y celular"
        )
        
    if not user.activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo"
        )
        
    # Encriptar y actualizar la contraseña
    user.password = hash_password(payload.nueva_password)
    db.commit()
    
    return {"message": "Contraseña actualizada exitosamente"}
