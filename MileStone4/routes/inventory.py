from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from database import get_db
from models import Product, Sale, StockStatus
from services.optimizer import calculate_eoq, get_stock_status
from services.alerts import check_product_alert
from routes.auth import get_current_user
from models import User

router = APIRouter(prefix="/inventory", tags=["Inventory"])


# ─── SCHEMAS ─────────────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    name:          str
    sku:           str
    category:      str
    price:         float
    supplier:      str
    stock:         int
    reorder_level: int
    optimal_stock: int

class ProductUpdate(BaseModel):
    stock:         Optional[int]   = None
    price:         Optional[float] = None
    reorder_level: Optional[int]   = None
    optimal_stock: Optional[int]   = None
    supplier:      Optional[str]   = None

class SaleCreate(BaseModel):
    product_id: int
    quantity:   int


# ─── PRODUCT ROUTES ──────────────────────────────────────────────────────────

@router.get("/products")
def get_all_products(
    status: Optional[str] = None,          # filter by status e.g. ?status=low
    category: Optional[str] = None,        # filter by category
    search: Optional[str] = None,          # search by name or SKU
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns all products. Supports filtering and search.
    Frontend Products page, Dashboard table, and Alerts page all use this.
    """
    query = db.query(Product)

    if status:
        query = query.filter(Product.status == status)
    if category:
        query = query.filter(Product.category == category)
    if search:
        query = query.filter(
            Product.name.ilike(f"%{search}%") |
            Product.sku.ilike(f"%{search}%")
        )

    products = query.all()

    # Recalculate status for each product before returning
    result = []
    for p in products:
        current_status = get_stock_status(p.stock, p.reorder_level, p.optimal_stock)
        p.status = current_status
        result.append({
            "id":            p.id,
            "name":          p.name,
            "sku":           p.sku,
            "category":      p.category,
            "price":         p.price,
            "supplier":      p.supplier,
            "stock":         p.stock,
            "reorder_level": p.reorder_level,
            "optimal_stock": p.optimal_stock,
            "eoq":           p.eoq,
            "status":        current_status,
            "created_at":    str(p.created_at)
        })

    db.commit()
    return result


@router.post("/products", status_code=201)
def add_product(
    data: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Adds a new product. Frontend 'Add Product' modal calls this.
    Auto-calculates EOQ using default ordering/holding cost assumptions.
    """
    # Check SKU is unique
    existing = db.query(Product).filter(Product.sku == data.sku).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"SKU '{data.sku}' already exists")

    # Auto-calculate EOQ with reasonable defaults
    # Ordering cost: $50, Holding cost: 20% of unit price per year
    annual_demand = data.stock * 12   # rough estimate from initial stock
    ordering_cost = 50
    holding_cost  = data.price * 0.20
    eoq = calculate_eoq(annual_demand, ordering_cost, holding_cost)

    # Determine initial status
    status = get_stock_status(data.stock, data.reorder_level, data.optimal_stock)

    product = Product(
        name=data.name,
        sku=data.sku,
        category=data.category,
        price=data.price,
        supplier=data.supplier,
        stock=data.stock,
        reorder_level=data.reorder_level,
        optimal_stock=data.optimal_stock,
        eoq=eoq,
        status=status
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    return {"message": "Product added successfully", "product_id": product.id, "eoq": eoq}


@router.put("/products/{product_id}")
def update_product(
    product_id: int,
    data: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Updates product fields. Frontend update stock / edit product uses this."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if data.stock         is not None: product.stock         = data.stock
    if data.price         is not None: product.price         = data.price
    if data.reorder_level is not None: product.reorder_level = data.reorder_level
    if data.optimal_stock is not None: product.optimal_stock = data.optimal_stock
    if data.supplier      is not None: product.supplier      = data.supplier

    # Recalculate status after update
    product.status = get_stock_status(product.stock, product.reorder_level, product.optimal_stock)

    db.commit()
    return {"message": "Product updated successfully"}


@router.delete("/products/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Deletes a product. Admin only in production."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    db.delete(product)
    db.commit()
    return {"message": "Product deleted successfully"}


# ─── SALES ROUTES ────────────────────────────────────────────────────────────

@router.post("/sales")
def record_sale(
    data: SaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Records a sale. Same logic as UpdatedCode.py record_sale()
    but now as an API endpoint with transaction safety.
    
    After recording: automatically checks if stock fell below ROP
    and returns an alert if needed.
    """
    try:
        # Step 1: Get product
        product = db.query(Product).filter(Product.id == data.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        # Step 2: Check stock
        if data.quantity > product.stock:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough stock. Available: {product.stock}, Requested: {data.quantity}"
            )

        # Step 3: Deduct stock
        product.stock -= data.quantity

        # Step 4: Record sale
        sale = Sale(
            product_id=data.product_id,
            quantity=data.quantity,
            total_amount=round(data.quantity * product.price, 2),
            sale_time=datetime.now()
        )
        db.add(sale)
        db.commit()

        # Step 5: Check if alert should be triggered
        alert = check_product_alert(db, data.product_id)

        return {
            "message":      "Sale recorded successfully",
            "sale_id":      sale.sale_id,
            "remaining_stock": product.stock,
            "alert":        alert
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Transaction failed: {str(e)}")


@router.get("/sales")
def get_sales_history(
    limit: int = 50,
    product_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns sales history. Frontend Sales page uses this."""
    query = db.query(Sale)

    if product_id:
        query = query.filter(Sale.product_id == product_id)

    sales = query.order_by(Sale.sale_time.desc()).limit(limit).all()

    return [
        {
            "sale_id":      s.sale_id,
            "product_id":   s.product_id,
            "product_name": s.product.name if s.product else "Unknown",
            "sku":          s.product.sku if s.product else "",
            "quantity":     s.quantity,
            "total_amount": s.total_amount,
            "sale_time":    str(s.sale_time)
        }
        for s in sales
    ]


@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns KPI numbers for the Dashboard stats cards.
    Total SKUs, Stock Value, Low Stock count etc.
    """
    total_skus   = db.query(func.count(Product.id)).scalar()
    stock_value  = db.query(func.sum(Product.stock * Product.price)).scalar() or 0
    low_count    = db.query(func.count(Product.id)).filter(
                       Product.status.in_(["low", "critical"])
                   ).scalar()
    total_sales  = db.query(func.sum(Sale.total_amount)).scalar() or 0

    return {
        "total_skus":   total_skus,
        "stock_value":  round(stock_value, 2),
        "low_alerts":   low_count,
        "total_revenue": round(total_sales, 2)
    }
