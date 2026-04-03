from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database import get_db
from services.forecast_model import forecast_demand, get_peak_hours, calculate_daily_velocity_from_db
from services.optimizer import calculate_eoq, calculate_rop
from routes.auth import get_current_user
from models import User

router = APIRouter(prefix="/analytics", tags=["Analytics"])


# ─── SCHEMAS ─────────────────────────────────────────────────────────────────

class EOQRequest(BaseModel):
    annual_demand:  float
    ordering_cost:  float
    holding_cost:   float
    lead_time_days: float
    daily_sales:    float
    safety_stock:   int = 0


# ─── ROUTES ──────────────────────────────────────────────────────────────────

@router.get("/forecast")
def get_forecast(
    product_id: int = None,
    months_ahead: int = 4,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns demand forecast using linear regression.
    Frontend Analytics page forecast chart uses this.
    
    If product_id → forecast for that specific product
    If no product_id → total demand forecast across all products
    """
    forecast = forecast_demand(db, months_ahead=months_ahead, product_id=product_id)

    if not forecast:
        return {
            "data": [],
            "message": "Not enough sales data to generate forecast. Add more sales records."
        }

    return {
        "data":    forecast,
        "model":   "Linear Regression",
        "message": f"Forecast for next {months_ahead} months"
    }


@router.get("/peak-hours")
def get_peak_hours_data(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns hourly sales distribution for peak hour analysis chart.
    Frontend Analytics page peak hours chart uses this.
    """
    data = get_peak_hours(db)
    return {"data": data}


@router.post("/calculate-eoq-rop")
def calculate_eoq_rop(
    data: EOQRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Takes inputs from the EOQ/ROP calculator on Analytics page
    and returns computed values.
    This is the server-side version of the frontend calculator.
    """
    eoq = calculate_eoq(data.annual_demand, data.ordering_cost, data.holding_cost)
    rop = calculate_rop(data.lead_time_days, data.daily_sales, data.safety_stock)

    return {
        "eoq": eoq,
        "rop": rop,
        "interpretation": {
            "eoq": f"Order {eoq} units each time you reorder",
            "rop": f"Place a new order when stock hits {rop} units"
        }
    }


@router.get("/velocity/{product_id}")
def get_product_velocity(
    product_id: int,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns average daily sales velocity for a product.
    Used to auto-calculate ROP for that product.
    """
    velocity = calculate_daily_velocity_from_db(db, product_id, days)
    return {
        "product_id":    product_id,
        "daily_velocity": velocity,
        "period_days":   days,
        "message":       f"Selling ~{velocity} units/day on average over last {days} days"
    }
