from pydantic import BaseModel, ConfigDict
class UserCreate(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int 
    email: str
    role: str
model_config = ConfigDict(from_attributes = True)

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str

from datetime import datetime
class RoomCreate(BaseModel): #комнаты
    name: str
    capacity: int
    equipment: str = ""
    floor: int = 1

class RoomResponse(BaseModel): #команаты
    id: int
    name: str
    capacity: int
    equipment: str
    floor: int = 1
    model_config = ConfigDict(from_attributes = True)

class BookingCreate(BaseModel): #бронь
    room_id: int
    start_time: datetime
    end_time: datetime
    participants: int

class BookingResponse(BaseModel): #бронь
    id: int
    room_id: int
    user_id: int
    start_time: datetime
    end_time: datetime
    participants: int
    room: RoomResponse | None = None
    model_config = ConfigDict(from_attributes = True)
    