from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app import models, schemas
from app.dependencies import require_admin, get_current_user
from datetime import datetime
from sqlalchemy.exc import IntegrityError

router = APIRouter(prefix = "/rooms", tags = ["Rooms"])
@router.post("/", response_model = schemas.RoomResponse, status_code = status.HTTP_201_CREATED)
async def create_room(
    room_in: schemas.RoomCreate,
    db: AsyncSession = Depends(get_db),
    admin_user: models.User = Depends(require_admin)
):
    new_room = models.Room(
        name = room_in.name,
        capacity = room_in.capacity,
        equipment = room_in.equipment,
        floor = room_in.floor 
    )
    db.add(new_room)
    await db.commit()
    await db.refresh(new_room)
    return new_room
@router.get("/", response_model = list[schemas.RoomResponse])
async def get_rooms(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    querry = select(models.Room)
    result = await db.execute(querry)
    rooms = result.scalars().all()
    return rooms
@router.get("/recommend", response_model=list[schemas.RoomResponse])
async def recommend_rooms(
    participants: int,
    start: datetime,
    end: datetime,
    equipment: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    busy_rooms_query = (
        select(models.Booking.room_id)
        .where(
            models.Booking.start_time < end,
            models.Booking.end_time > start
        )
        .subquery()
    )
    query = select(models.Room).where(
        models.Room.id.not_in(select(busy_rooms_query.c.room_id)),
        models.Room.capacity >= participants
    )
    if equipment:
        query = query.where(models.Room.equipment.ilike(f"%{equipment}%"))
    query = query.order_by(models.Room.capacity.asc())

    result = await db.execute(query)
    return result.scalars().all()
@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_room(
    room_id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: models.User = Depends(require_admin)
):
    room = await db.get(models.Room, room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    try:
        await db.delete(room)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Нельзя удалить комнату, так как на неё есть активные бронирования. Сначала отмените их."
        )
    return None