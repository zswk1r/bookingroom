from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app import models, schemas
from app.security import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["Authentication"])
@router.post("/register", response_model=schemas.UserResponse)
async def register(user_in: schemas.UserCreate, db: AsyncSession = Depends(get_db)):
    query = select(models.User).where(models.User.email == user_in.email)
    existing_user = (await db.execute(query)).scalar_one_or_none()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    new_user = models.User(
        email=user_in.email,
        hashed_password=hash_password(user_in.password)
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user
@router.post("/login", response_model=schemas.Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    query = select(models.User).where(models.User.email == form_data.username)
    user = (await db.execute(query)).scalar_one_or_none()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    access_token = create_access_token(user_id=user.id)
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "role": user.role
    }