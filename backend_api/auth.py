# auth.py

from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr

# --- Configuration ---
SECRET_KEY = "your-secret-key"  # Replace with a strong, unique key in a real app (e.g., from env var)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

# --- Mock User Database ---
# In a real app, this would come from your database (e.g., MongoDB users collection)
# For mock purposes, we define users with roles here.
# Passwords are "testpassword" for all mock users.
MOCK_USERS_DB: Dict[str, Dict[str, Any]] = {
    "admin": {
        "username": "admin",
        "email": "admin@example.com",
        "full_name": "Admin User",
        "hashed_password": pwd_context.hash("testpassword"),
        "disabled": False,
        "role": "admin" # admin, auditor, user
    },
    "auditor": {
        "username": "auditor",
        "email": "auditor@example.com",
        "full_name": "Auditor User",
        "hashed_password": pwd_context.hash("testpassword"),
        "disabled": False,
        "role": "auditor"
    },
    "user1": {
        "username": "user1",
        "email": "user1@example.com",
        "full_name": "Regular User One",
        "hashed_password": pwd_context.hash("testpassword"),
        "disabled": False,
        "role": "user"
    },
    "user2": {
        "username": "user2",
        "email": "user2@example.com",
        "full_name": "Regular User Two",
        "hashed_password": pwd_context.hash("testpassword"),
        "disabled": False,
        "role": "user"
    }
}

# --- Pydantic Models ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class User(BaseModel):
    username: str
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    disabled: Optional[bool] = None
    role: str # Added role

class UserInDB(User):
    hashed_password: str

# --- Utility Functions ---
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def get_user(username: str) -> Optional[UserInDB]:
    if username in MOCK_USERS_DB:
        user_dict = MOCK_USERS_DB[username]
        return UserInDB(**user_dict)
    return None

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# --- Dependency for getting current user ---
async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    
    user_data = get_user(username=token_data.username)
    if user_data is None:
        raise credentials_exception
    return User(**user_data.model_dump()) # Return User model with role

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.disabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
    return current_user

# --- Authentication Router (to be included in main.py) ---
# This part would typically be in a separate router file (e.g., routers/auth.py)
# For simplicity in this project structure, it can be defined here and imported or directly added to main app.

from fastapi import APIRouter

auth_router = APIRouter(
    prefix="/api/v1/auth",
    tags=["Authentication"]
)

@auth_router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = get_user(form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@auth_router.get("/users/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user

