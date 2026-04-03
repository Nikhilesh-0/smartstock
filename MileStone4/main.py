from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
import models

from routes import auth, inventory, forecast, purchase_orders

# Creates all DB tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SmartStock API",
    description="Inventory Optimization Backend — EOQ, ROP, Demand Forecasting",
    version="1.0.0"
)

# CORS — allows React (port 5173) to talk to FastAPI (port 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all route groups
app.include_router(auth.router)
app.include_router(inventory.router)
app.include_router(forecast.router)
app.include_router(purchase_orders.router)

@app.get("/")
def root():
    return {"app": "SmartStock API", "status": "running", "docs": "http://localhost:8000/docs"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
