import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
from models import Sale, Product


def get_monthly_sales(db: Session, product_id: int = None) -> pd.DataFrame:
    """
    Pulls sales data from DB and groups by month.
    If product_id given → forecast for one product.
    If None → forecast across all products (total demand).
    """
    query = db.query(
        func.strftime("%Y-%m", Sale.sale_time).label("month"),  # group by year-month
        func.sum(Sale.quantity).label("total_qty")
    )

    if product_id:
        query = query.filter(Sale.product_id == product_id)

    results = (
        query
        .group_by(func.strftime("%Y-%m", Sale.sale_time))
        .order_by(func.strftime("%Y-%m", Sale.sale_time))
        .all()
    )

    if not results:
        return pd.DataFrame(columns=["month", "total_qty"])

    df = pd.DataFrame(results, columns=["month", "total_qty"])
    df["total_qty"] = df["total_qty"].astype(float)
    return df


def forecast_demand(db: Session, months_ahead: int = 4, product_id: int = None) -> list:
    """
    Uses Linear Regression on past monthly sales to predict future demand.
    
    How it works:
        X = month number (1, 2, 3 ... n)   ← the feature
        Y = units sold that month           ← what we're predicting
        
        LinearRegression finds the best straight line through the data:
        Y = slope * X + intercept
        
        Then we plug in future month numbers to get predictions.
    
    Returns a list of dicts: [{ month, actual, predicted }, ...]
    """
    df = get_monthly_sales(db, product_id)

    if len(df) < 2:
        # Not enough data to train — return empty
        return []

    # X = index (month number), Y = units sold
    X = np.array(range(len(df))).reshape(-1, 1)
    Y = df["total_qty"].values

    # Train the model
    model = LinearRegression()
    model.fit(X, Y)

    # Build historical data points (actual values)
    history = []
    for i, row in df.iterrows():
        history.append({
            "month": row["month"],
            "actual": int(row["total_qty"]),
            "predicted": None
        })

    # Predict future months
    last_month_str = df["month"].iloc[-1]
    last_date = datetime.strptime(last_month_str, "%Y-%m")

    predictions = []
    for i in range(1, months_ahead + 1):
        future_x = np.array([[len(df) + i - 1]])
        predicted_qty = max(0, round(model.predict(future_x)[0]))

        # Get the future month label
        future_date = last_date + timedelta(days=30 * i)
        future_month = future_date.strftime("%Y-%m")
        month_label = future_date.strftime("%b")  # e.g. "Apr"

        predictions.append({
            "month": month_label,
            "actual": None,
            "predicted": int(predicted_qty)
        })

    # Format historical months as short names too
    for item in history:
        try:
            dt = datetime.strptime(item["month"], "%Y-%m")
            item["month"] = dt.strftime("%b")
        except:
            pass

    return history + predictions


def calculate_daily_velocity_from_db(db: Session, product_id: int, days: int = 30) -> float:
    """
    Calculates average units sold per day for a product over recent N days.
    Used for ROP calculation.
    """
    since = datetime.now() - timedelta(days=days)

    result = (
        db.query(func.sum(Sale.quantity))
        .filter(Sale.product_id == product_id)
        .filter(Sale.sale_time >= since)
        .scalar()
    )

    total_sold = result or 0
    return round(total_sold / days, 2)


def get_peak_hours(db: Session) -> list:
    """
    Analyzes what hours of the day have the most sales.
    Used for the Peak Sales Analysis chart in Analytics page.
    """
    results = (
        db.query(
            func.strftime("%H", Sale.sale_time).label("hour"),
            func.sum(Sale.quantity).label("total_qty")
        )
        .group_by(func.strftime("%H", Sale.sale_time))
        .order_by(func.strftime("%H", Sale.sale_time))
        .all()
    )

    peak_data = []
    for row in results:
        hour_int = int(row.hour)
        # Convert 24h to 12h label
        if hour_int == 0:
            label = "12am"
        elif hour_int < 12:
            label = f"{hour_int}am"
        elif hour_int == 12:
            label = "12pm"
        else:
            label = f"{hour_int - 12}pm"

        peak_data.append({
            "hour": label,
            "sales": int(row.total_qty)
        })

    return peak_data
