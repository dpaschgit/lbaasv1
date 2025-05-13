from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, List
from pydantic import BaseModel # Import BaseModel

# --- Configuration ---
SECRET_KEY = "your-secret-key-for-jwt"  # Replace with a strong, random key in production
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")

auth_router = APIRouter(
    prefix="/api/v1/auth",
    tags=["Authentication"]
)

# --- User Model (simplified) ---
class User(BaseModel): # Inherit from BaseModel
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    disabled: bool = False
    role: str = "user"

class UserInDB(User):
    hashed_password: str

# --- Helper Functions ---
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

# --- Mock User Database ---
MOCK_USERS_DB: Dict[str, UserInDB] = {}

def initialize_mock_users():
    users_to_create = {
        "user1": {"password": "user1", "role": "user", "email": "user1@example.com", "full_name": "User One"},
        "user2": {"password": "user2", "role": "user", "email": "user2@example.com", "full_name": "User Two"},
        "admin": {"password": "admin", "role": "admin", "email": "admin@example.com", "full_name": "Admin User"},
        "auditor": {"password": "auditor", "role": "auditor", "email": "auditor@example.com", "full_name": "Auditor User"}
    }
    for username, details in users_to_create.items():
        hashed_password = get_password_hash(details["password"])
        MOCK_USERS_DB[username] = UserInDB(
            username=username, 
            hashed_password=hashed_password, 
            email=details["email"], 
            full_name=details["full_name"], 
            role=details["role"]
        )
    print("Mock users initialized with dynamically generated password hashes.")

initialize_mock_users()

def get_user(username: str) -> Optional[UserInDB]:
    return MOCK_USERS_DB.get(username)

def authenticate_user(username: str, password: str) -> Optional[UserInDB]:
    user = get_user(username)
    if not user or not verify_password(password, user.hashed_password):
        return None
    if user.disabled:
        return None
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: Optional[str] = payload.get("sub")
        if username is None:
            raise credentials_exception
        # Add role to token payload if needed, or fetch from user object
        user_role: Optional[str] = payload.get("role") 
    except JWTError:
        raise credentials_exception
    user_in_db = get_user(username)
    if user_in_db is None:
        raise credentials_exception
    return User(username=user_in_db.username, email=user_in_db.email, full_name=user_in_db.full_name, disabled=user_in_db.disabled, role=user_in_db.role)

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.disabled:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
    return current_user

# --- Authentication Endpoints ---
@auth_router.post("/token", summary="Create access token for user")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@auth_router.get("/users/me", response_model=User, summary="Get current authenticated user details")
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user

