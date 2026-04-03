from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import settings

# Create engine - connects Python to PostgreSQL
engine = create_engine(settings.DATABASE_URL)

# Each request gets its own DB session, closes after
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# All models inherit from this base
Base = declarative_base()

# Dependency - used in every route that needs DB
# FastAPI calls this automatically, gives a session, closes it when done
def get_db():
    db = SessionLocal()
    try:
        yield db          # give session to the route
    finally:
        db.close()        # always close, even if error occurs
