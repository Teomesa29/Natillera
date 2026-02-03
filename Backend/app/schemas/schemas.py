from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, EmailStr

# Esquemas de Usuario
class UsuarioBase(BaseModel):
    usuario: str
    nombre: str
    telefono: str
    polla: int
    email: Optional[str] = None

class UsuarioCreate(UsuarioBase):
    password: str
    rol: str = Field(..., examples=["admin", "socio"])
    ahorro_mensual: int
    porcentaje_interes: float = 5  

class UsuarioLogin(BaseModel):
    usuario: str
    password: str

class UsuarioResponse(UsuarioBase):
    id: int
    activo: bool
    fecha_registro: datetime

class MovimientoCreate(BaseModel):
    usuario_id: int
    tipo: str
    monto: int
    categoria: str
    descripcion: Optional[str] = None
    fecha: Optional[datetime] = None

class AhorroCreate(BaseModel):
    usuario_id: int
    ahorro_mensual: int
    porcentaje_interes: float = 5  

class PrestamoCreate(BaseModel):
    usuario_id: int
    monto: int
    fecha_vencimiento: datetime
    intereses: float
    total: float
    estado: str
    plazo: int  # en meses

# Esquemas de Ahorro
class AhorroResponse(BaseModel):
    id: int
    ahorro_mensual: float
    total_ahorrado: float
    porcentaje_interes: float
    interes_ganado: float

# Esquemas de Préstamo
class PrestamoResponse(BaseModel):
    id: int
    monto: int
    fecha_prestamo: datetime
    fecha_vencimiento: datetime
    intereses: int
    total: int
    estado: str
    plazo: int

# Esquemas de Movimiento
class MovimientoResponse(BaseModel):
    id: int
    tipo: str
    monto: float
    fecha: datetime
    categoria: str
    descripcion: Optional[str]


# Esquema de respuesta completa del usuario
class DatosUsuarioCompleto(BaseModel):
    usuario: UsuarioResponse
    ahorro: Optional[AhorroResponse]
    prestamos: List[PrestamoResponse]
    movimientos: List[MovimientoResponse]