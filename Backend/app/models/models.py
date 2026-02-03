from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime, date

class Usuario(Base):
    __tablename__ = "usuarios"
    
    id = Column(Integer, primary_key=True, index=True)
    usuario = Column(String, unique=True, index=True)
    password = Column(String, nullable=False)
    nombre = Column(String)
    telefono = Column(String, unique=True, nullable=True)
    polla = Column(Integer, unique=True, nullable=True)
    email = Column(String, unique=True, nullable=True)
    activo = Column(Boolean, default=True)
    fecha_registro = Column(DateTime, default=datetime.now)
    rol = Column(String, nullable=False)

    # Relaciones
    ahorros = relationship("Ahorro", back_populates="usuario_rel")
    prestamos = relationship("Prestamo", back_populates="usuario_rel")
    movimientos = relationship("Movimiento", back_populates="usuario_rel")


class Ahorro(Base):
    __tablename__ = "ahorros"
    
    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    ahorro_mensual = Column(Integer)
    total_ahorrado = Column(Integer)
    porcentaje_interes = Column(Float, default=8.5)
    interes_ganado = Column(Float, default=0.0)
    ultima_actualizacion = Column(DateTime, default=datetime.now)
    
    # Relación
    usuario_rel = relationship("Usuario", back_populates="ahorros")


class Prestamo(Base):
    __tablename__ = "prestamos"
    
    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    monto = Column(Integer  )
    fecha_prestamo = Column(DateTime, default=datetime.now)
    fecha_vencimiento = Column(DateTime)
    intereses = Column(Float)
    total = Column(Float)
    plazo = Column(Integer)  # en meses
    estado = Column(String, default = "pendiente")  # pendiente, pagado
    saldo = Column(Integer, default=0)               # cuánto falta por pagar
    cuotas_pagadas = Column(Integer, default=0)    # cuántas cuotas ya pagó
    
    # Relación
    usuario_rel = relationship("Usuario", back_populates="prestamos")


class Movimiento(Base):
    __tablename__ = "movimientos"
    
    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"))
    tipo = Column(String)  # Aporte Mensual, Rendimiento, Préstamo, etc.
    monto = Column(Integer)
    fecha = Column(DateTime, default=datetime.now)
    categoria = Column(String)  # ingreso, interes, prestamo, premio
    descripcion = Column(String, nullable=True)
    
    # Relación
    usuario_rel = relationship("Usuario", back_populates="movimientos")

class ResultadoLoteria(Base):
    __tablename__ = "resultados_loteria"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, index=True)          # "medellin"
    lottery = Column(String)                   # "MEDELLIN"
    date = Column(DateTime, index=True)            # 2026-01-30
    result = Column(String)                    # "7506"
    series = Column(String, nullable=True)     # "118"
    fetched_at = Column(DateTime, default=datetime.now)

    __table_args__ = (
        UniqueConstraint("slug", "date", name="uq_slug_date"),
    )