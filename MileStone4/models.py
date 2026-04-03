from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base


# ─── ENUMS ────────────────────────────────────────────────────────────────────

class StockStatus(str, enum.Enum):
    optimal   = "optimal"
    low       = "low"
    critical  = "critical"
    overstock = "overstock"

class UserRole(str, enum.Enum):
    admin = "admin"
    staff = "staff"


# ─── TABLES ───────────────────────────────────────────────────────────────────

class User(Base):
    """
    Stores login credentials.
    Password is always stored hashed — never plain text.
    """
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String, nullable=False)
    email         = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role          = Column(Enum(UserRole), default=UserRole.staff)
    company       = Column(String, nullable=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())


class Product(Base):
    """
    Core inventory item.
    Maps directly to what your UpdatedCode.py had, but adds
    SKU, EOQ, and status fields the frontend expects.
    """
    __tablename__ = "products"

    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String, nullable=False)
    sku           = Column(String, unique=True, index=True, nullable=False)
    category      = Column(String, nullable=False)
    price         = Column(Float, nullable=False)          # unit cost
    supplier      = Column(String, nullable=False)
    stock         = Column(Integer, nullable=False, default=0)
    reorder_level = Column(Integer, nullable=False)        # ROP threshold
    optimal_stock = Column(Integer, nullable=False)        # target max stock
    eoq           = Column(Integer, nullable=True)         # calculated by backend
    status        = Column(Enum(StockStatus), default=StockStatus.optimal)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), onupdate=func.now())

    # One product can have many sales
    sales = relationship("Sale", back_populates="product")


class Sale(Base):
    """
    Every sale transaction.
    Same as your UpdatedCode.py sales table but with total_amount added.
    """
    __tablename__ = "sales"

    sale_id      = Column(Integer, primary_key=True, index=True)
    product_id   = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity     = Column(Integer, nullable=False)
    total_amount = Column(Float, nullable=False)           # quantity × price at time of sale
    sale_time    = Column(DateTime(timezone=True), server_default=func.now())

    # Link back to product
    product = relationship("Product", back_populates="sales")


class PurchaseOrder(Base):
    """
    Auto-generated order suggestions based on EOQ/ROP.
    Created when stock drops below reorder_level.
    """
    __tablename__ = "purchase_orders"

    id           = Column(Integer, primary_key=True, index=True)
    product_id   = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity     = Column(Integer, nullable=False)         # EOQ quantity to order
    estimated_cost = Column(Float, nullable=False)
    status       = Column(String, default="pending")       # pending / ordered / received
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product")
