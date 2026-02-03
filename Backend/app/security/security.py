from datetime import datetime, timedelta, timezone
from jose import jwt
from passlib.context import CryptContext

# OJO: en producción esto va en variables de entorno (.env)
SECRET_KEY = "CLAVESECRETADELANATILLERAFAMILIAOSPINAYOTROS"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60


def create_access_token(user_id: int, rol: str, expires_minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)

    to_encode = {
        "sub": str(user_id),  # sujeto (id del usuario) en string
        "rol": rol,
        "exp": expire
    }

    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def hash_password(password: str) -> str:
    return pwd_context.hash(password)