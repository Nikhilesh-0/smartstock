from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from models import Product, PurchaseOrder
from services.optimizer import suggest_order_quantity
from routes.auth import get_current_user
from models import User

router = APIRouter(prefix="/orders", tags=["Purchase Orders"])


class OrderStatusUpdate(BaseModel):
    status: str   # pending / ordered / received


@router.get("/suggestions")
def get_order_suggestions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns auto-generated purchase order suggestions for all
    low/critical stock products. Frontend Alerts page table uses this.
    """
    # Get all low and critical products
    products = db.query(Product).filter(
        Product.status.in_(["low", "critical"])
    ).all()

    suggestions = []
    for p in products:
        qty = suggest_order_quantity(p.stock, p.optimal_stock, p.eoq or 0)
        suggestions.append({
            "product_id":      p.id,
            "product_name":    p.name,
            "sku":             p.sku,
            "supplier":        p.supplier,
            "current_stock":   p.stock,
            "reorder_level":   p.reorder_level,
            "eoq":             p.eoq,
            "suggested_qty":   qty,
            "estimated_cost":  round(qty * p.price, 2),
            "status":          p.status
        })

    return suggestions


@router.post("/place/{product_id}")
def place_order(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Creates a purchase order record for a product.
    Called when user clicks 'Place Order' on Alerts page.
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    qty  = suggest_order_quantity(product.stock, product.optimal_stock, product.eoq or 0)
    cost = round(qty * product.price, 2)

    order = PurchaseOrder(
        product_id=product_id,
        quantity=qty,
        estimated_cost=cost,
        status="pending"
    )
    db.add(order)
    db.commit()
    db.refresh(order)

    return {
        "message":      f"Purchase order created for {product.name}",
        "order_id":     order.id,
        "quantity":     qty,
        "estimated_cost": cost
    }


@router.get("/")
def get_all_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns all purchase orders with their status."""
    orders = db.query(PurchaseOrder).order_by(PurchaseOrder.created_at.desc()).all()
    return [
        {
            "order_id":       o.id,
            "product_name":   o.product.name if o.product else "",
            "sku":            o.product.sku if o.product else "",
            "quantity":       o.quantity,
            "estimated_cost": o.estimated_cost,
            "status":         o.status,
            "created_at":     str(o.created_at)
        }
        for o in orders
    ]


@router.put("/{order_id}/status")
def update_order_status(
    order_id: int,
    data: OrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Updates order status: pending → ordered → received.
    When status becomes 'received', stock is automatically increased.
    """
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    old_status = order.status
    order.status = data.status

    # When order is marked as received → add stock to product
    if data.status == "received" and old_status != "received":
        product = db.query(Product).filter(Product.id == order.product_id).first()
        if product:
            product.stock += order.quantity
            db.commit()
            return {"message": f"Order received. Stock updated: +{order.quantity} units for {product.name}"}

    db.commit()
    return {"message": f"Order status updated to '{data.status}'"}
