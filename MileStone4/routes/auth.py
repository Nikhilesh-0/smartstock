from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from pydantic import BaseModel, EmailStr

from database import get_db
from models import User
from config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Password hashing — bcrypt converts plain password to a hash
# e.g. "mypassword" → "$2b$12$..." (can never be reversed)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Tells FastAPI where to get the token from (Authorization header)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# ─── PYDANTIC SCHEMAS ─────────────────────────────────────────────────────────
# These define what data the frontend sends / backend returns

class SignupRequest(BaseModel):
    name:     str
    email:    EmailStr
    password: str
    company:  str = ""
    role:     str = "staff"

class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user_name:    str
    user_role:    str

class UserResponse(BaseModel):
    id:    int
    name:  str
    email: str
    role:  str

    class Config:
        from_attributes = True


# ─── HELPERS ─────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict) -> str:
    """Creates a JWT token that expires after ACCESS_TOKEN_EXPIRE_MINUTES."""
    payload = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload.update({"exp": expire})
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """
    Dependency — any protected route includes this.
    FastAPI automatically extracts token, verifies it, returns the User.
    If token is missing or invalid → 401 Unauthorized.
    """
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"}
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_error
    except JWTError:
        raise credentials_error

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_error
    return user


# ─── ROUTES ──────────────────────────────────────────────────────────────────

@router.post("/signup", response_model=TokenResponse)
def signup(data: SignupRequest, db: Session = Depends(get_db)):
    """
    Frontend signup form calls this.
    Creates a new user and returns a JWT token immediately.
    """
    # Check email not already taken
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        name=data.name,
        email=data.email,
        hashed_password=hash_password(data.password),
        company=data.company,
        role=data.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": user.email})
    return TokenResponse(access_token=token, user_name=user.name, user_role=user.role)


@router.post("/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    Frontend login form calls this.
    Returns a JWT token if credentials are correct.
    The frontend stores this token and sends it with every future request.
    """
    user = db.query(User).filter(User.email == form.username).first()

    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    token = create_access_token({"sub": user.email})
    return TokenResponse(access_token=token, user_name=user.name, user_role=user.role)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Returns the currently logged-in user's info."""
    return current_user
