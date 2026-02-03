from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.models import Usuario
from app.schemas.schemas import UsuarioLogin
from app.security.security import verify_password, create_access_token

router = APIRouter(prefix="/api", tags=["Auth"])

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

    # OJO: en tu modelo el campo se llama "password" (hash guardado)
    if not verify_password(payload.password, user.password):
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
