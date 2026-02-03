from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from Backend.schemas.database import Base
from datetime import datetime

class Usuario(Base):
    __tablename__ = "usuarios"
    
    id = Column(Integer, primary_key=True, index=True)
    usuario = Column(String, unique=True, index=True)
    password_hash = Column(String)
    nombre = Column(String)
    telefono = Column(String, unique=True, nullable=True)
    email = Column(String, unique=True, nullable=True)
    activo = Column(Boolean, default=True)
    fecha_registro = Column(DateTime, default=datetime.now)
    numero_polla = Column(String, unique=True, nullable=True)

    # Relaciones
    ahorros = relationship("Ahorro", back_populates="usuario_rel")
    prestamos = relationship("Prestamo", back_populates="usuario_rel")
    movimientos = relationship("Movimiento", back_populates="usuario_rel")


class Ahorro(Base):
    __tablename__ = "ahorros"
    
    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    ahorro_mensual = Column(Float)
    total_ahorrado = Column(Float)
    porcentaje_interes = Column(Float, default=8.5)
    interes_ganado = Column(Float, default=0.0)
    ultima_actualizacion = Column(DateTime, default=datetime.now)
    
    # Relación
    usuario_rel = relationship("Usuario", back_populates="ahorros")


class Prestamo(Base):
    __tablename__ = "prestamos"
    
    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    monto = Column(Float)
    fecha_prestamo = Column(DateTime, default=datetime.now)
    fecha_vencimiento = Column(DateTime)
    intereses = Column(Float)
    total = Column(Float)
    estado = Column(String)  # activo, pagado, vencido
    
    # Relación
    usuario_rel = relationship("Usuario", back_populates="prestamos")


class Movimiento(Base):
    __tablename__ = "movimientos"
    
    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    tipo = Column(String)  # Aporte Mensual, Rendimiento, Préstamo, etc.
    monto = Column(Float)
    fecha = Column(DateTime, default=datetime.now)
    categoria = Column(String)  # ingreso, interes, prestamo, premio
    descripcion = Column(String, nullable=True)
    
    # Relación
    usuario_rel = relationship("Usuario", back_populates="movimientos")