from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.openapi.docs import get_swagger_ui_html
from app.config import settings
from app.database import engine
from app.routers import auth, rooms, bookings

app = FastAPI(
    title="RoomMate",
    docs_url=None, 
    version="1.0.0",
)
app.mount("/static", StaticFiles(directory="static"), name="static")
@app.get("/", include_in_schema=False)
async def serve_frontend():
    return FileResponse("static/index.html")
@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    return get_swagger_ui_html(
        openapi_url=app.openapi_url,
        title="RoomMate API"
    )
@app.get("/health", tags=["System"])
async def health():
    return {"status": "ok"}
app.include_router(auth.router)
app.include_router(rooms.router)
app.include_router(bookings.router)