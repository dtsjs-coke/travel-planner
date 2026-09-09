from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth import router as auth_router
from app.config import settings
from app.routers.checklist import router as checklist_router
from app.routers.days import router as days_router
from app.routers.items import router as items_router
from app.routers.places import router as places_router
from app.routers.trips import router as trips_router

app = FastAPI(title="Travel Planner API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(trips_router)
app.include_router(days_router)
app.include_router(items_router)
app.include_router(checklist_router)
app.include_router(places_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
