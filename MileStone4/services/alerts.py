from sqlalchemy.orm import Session
from models import Product, StockStatus
from services.optimizer import get_stock_status, suggest_order_quantity


def get_all_alerts(db: Session) -> dict:
    """
    Scans all products and returns categorized alerts.
    This is what the Alerts page and Dashboard panel pulls from.
    
    Returns:
        {
            "critical":  [...],   products with stock < 25% of ROP
            "low":       [...],   products below ROP
            "overstock": [...]    products exceeding optimal by 20%
        }
    """
    products = db.query(Product).all()

    critical  = []
    low       = []
    overstock = []

    for p in products:
        status = get_stock_status(p.stock, p.reorder_level, p.optimal_stock)

        # Update the status in DB so frontend always gets fresh status
        p.status = status

        alert_data = {
            "id":            p.id,
            "name":          p.name,
            "sku":           p.sku,
            "category":      p.category,
            "current_stock": p.stock,
            "reorder_level": p.reorder_level,
            "optimal_stock": p.optimal_stock,
            "eoq":           p.eoq or 0,
            "unit_cost":     p.price,
            "supplier":      p.supplier,
            "status":        status,
            "suggested_order": suggest_order_quantity(p.stock, p.optimal_stock, p.eoq or 0),
            "estimated_cost":  round(suggest_order_quantity(p.stock, p.optimal_stock, p.eoq or 0) * p.price, 2)
        }

        if status == "critical":
            critical.append(alert_data)
        elif status == "low":
            low.append(alert_data)
        elif status == "overstock":
            overstock.append(alert_data)

    db.commit()  # save updated statuses

    return {
        "critical":       critical,
        "low":            low,
        "overstock":      overstock,
        "total_alerts":   len(critical) + len(low),
        "critical_count": len(critical),
        "low_count":      len(low),
        "overstock_count": len(overstock)
    }


def check_product_alert(db: Session, product_id: int) -> dict | None:
    """
    Checks a single product after a sale is recorded.
    Called automatically inside record_sale route.
    Returns alert data if stock is now low/critical, else None.
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        return None

    status = get_stock_status(product.stock, product.reorder_level, product.optimal_stock)
    product.status = status
    db.commit()

    if status in ("critical", "low"):
        return {
            "triggered": True,
            "product":   product.name,
            "sku":       product.sku,
            "status":    status,
            "stock":     product.stock,
            "reorder_level": product.reorder_level,
            "message":   f"⚠️ {product.name} is {status}! Stock: {product.stock} (ROP: {product.reorder_level})"
        }

    return {"triggered": False}
