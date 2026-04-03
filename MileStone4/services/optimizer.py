import math

# ─── EOQ ──────────────────────────────────────────────────────────────────────
# Economic Order Quantity — HOW MUCH to order
# Formula: EOQ = sqrt(2DS / H)
#   D = annual demand (units/year)
#   S = ordering cost per order ($)
#   H = holding/carrying cost per unit per year ($)

def calculate_eoq(annual_demand: float, ordering_cost: float, holding_cost: float) -> int:
    """
    Returns the optimal order quantity that minimizes total inventory cost.
    
    Example:
        annual_demand = 500 units
        ordering_cost = $50 per order
        holding_cost  = $2 per unit per year
        EOQ = sqrt(2 * 500 * 50 / 2) = sqrt(25000) = 158 units
    """
    if holding_cost <= 0 or annual_demand <= 0:
        return 0
    eoq = math.sqrt((2 * annual_demand * ordering_cost) / holding_cost)
    return round(eoq)


# ─── ROP ──────────────────────────────────────────────────────────────────────
# Reorder Point — WHEN to order
# Formula: ROP = (Lead Time × Daily Sales Velocity) + Safety Stock

def calculate_rop(lead_time_days: float, daily_sales_velocity: float, safety_stock: int = 0) -> int:
    """
    Returns the stock level at which a new order should be placed.
    
    Example:
        lead_time_days       = 7 days
        daily_sales_velocity = 15 units/day
        safety_stock         = 30 units
        ROP = (7 × 15) + 30 = 135 units
        
        → Place a new order when stock hits 135 units
    """
    rop = (lead_time_days * daily_sales_velocity) + safety_stock
    return round(rop)


# ─── DAILY SALES VELOCITY ─────────────────────────────────────────────────────
# Average units sold per day — used to calculate ROP

def calculate_daily_velocity(total_units_sold: int, days: int) -> float:
    """
    Returns average units sold per day over a given period.
    
    Example:
        total_units_sold = 450 over 30 days
        velocity = 450 / 30 = 15 units/day
    """
    if days <= 0:
        return 0.0
    return round(total_units_sold / days, 2)


# ─── STOCK STATUS ─────────────────────────────────────────────────────────────
# Determines a product's status based on current stock levels

def get_stock_status(stock: int, reorder_level: int, optimal_stock: int) -> str:
    """
    Returns one of: 'critical', 'low', 'optimal', 'overstock'
    
    Logic:
        critical  → stock is less than 25% of reorder level (urgent!)
        low       → stock is below reorder level
        overstock → stock exceeds optimal level by 20%
        optimal   → everything is fine
    """
    if stock < reorder_level * 0.25:
        return "critical"
    elif stock < reorder_level:
        return "low"
    elif stock > optimal_stock * 1.2:
        return "overstock"
    else:
        return "optimal"


# ─── PURCHASE ORDER SUGGESTION ────────────────────────────────────────────────

def suggest_order_quantity(current_stock: int, optimal_stock: int, eoq: int) -> int:
    """
    Suggests how many units to order right now.
    Uses EOQ as the base, but ensures we at least reach optimal stock.
    
    Example:
        current_stock = 12
        optimal_stock = 150
        eoq           = 95
        shortage      = 150 - 12 = 138
        → order max(95, 138) = 138 units
    """
    shortage = optimal_stock - current_stock
    return max(eoq, shortage)
