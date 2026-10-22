from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from app.database import get_db
from app import models, schemas
from app.dependencies import get_current_user, require_admin

router = APIRouter(prefix="/bookings", tags=["Bookings"])

@router.post("/", response_model=schemas.BookingResponse, status_code=status.HTTP_201_CREATED)
async def create_booking(
    booking_in: schemas.BookingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if booking_in.start_time >= booking_in.end_time:
        raise HTTPException(status_code=400, detail="End time must be after start time")

    new_booking = models.Booking(
        room_id=booking_in.room_id,
        user_id=current_user.id,
        start_time=booking_in.start_time,
        end_time=booking_in.end_time,
        participants=booking_in.participants
    )
    
    db.add(new_booking)
    
    try:
        await db.commit()
        await db.refresh(new_booking)
        query = select(models.Booking).options(selectinload(models.Booking.room)).where(models.Booking.id == new_booking.id)
        result = await db.execute(query)
        new_booking = result.scalar_one()
        
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Это время уже занято другой бронью!"
        )
        
    return new_booking

@router.get("/my", response_model=list[schemas.BookingResponse])
async def get_my_bookings(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = (
        select(models.Booking)
        .options(selectinload(models.Booking.room)) 
        .where(models.Booking.user_id == current_user.id)
    )
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/all", response_model=list[schemas.BookingResponse])
async def get_all_bookings(
    db: AsyncSession = Depends(get_db),
    admin_user: models.User = Depends(require_admin)
):
    query = (
        select(models.Booking)
        .options(selectinload(models.Booking.room))
        .order_by(models.Booking.start_time.asc())
    )
    result = await db.execute(query)
    return result.scalars().all()

@router.delete("/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_booking(
    booking_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = select(models.Booking).where(models.Booking.id == booking_id)
    booking = (await db.execute(query)).scalar_one_or_none()

    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if current_user.role != "admin" and booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this booking")

    await db.delete(booking)
    await db.commit()
    return None