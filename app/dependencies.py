from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession 
from app.database import get_db
from app.config import settings
from app import models
from app.models import UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> models.User:
    credentials_exception = HTTPException(
        status_code = status.HTTP_401_UNAUTHORIZED,
        detail = "Could not validate credentials",
        headers = {"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms = [settings.ALGORITHM])
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = int(user_id_str)
    except JWTError:
        raise credentials_exception
    user = await db.get(models.User, user_id)
    if user is None:
        raise credentials_exception

    return user

def require_admin(user:models.User = Depends(get_current_user)) -> models.User:
    if user.role != UserRole.admin:
        raise HTTPException(
            status_code = status.HTTP_403_FORBIDDEN,
            detail = "Not enough permissions"
        )
    return user