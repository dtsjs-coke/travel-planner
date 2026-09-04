import datetime as dt

from sqlalchemy import Column, ForeignKey, Integer
from sqlmodel import Field, SQLModel


class Trip(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    destination: str | None = None
    start_date: dt.date | None = None
    end_date: dt.date | None = None
    currency: str = "KRW"
    created_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
    updated_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)


class Day(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    trip_id: int = Field(
        sa_column=Column(Integer, ForeignKey("trip.id", ondelete="CASCADE"), nullable=False)
    )
    date: dt.date
    label: str | None = None
    sort_order: int = 0


class ItineraryItem(SQLModel, table=True):
    __tablename__ = "itinerary_item"

    id: int | None = Field(default=None, primary_key=True)
    day_id: int = Field(
        sa_column=Column(Integer, ForeignKey("day.id", ondelete="CASCADE"), nullable=False)
    )
    position: int = 0
    title: str
    category: str | None = None
    source: str = "manual"  # "google_places" | "manual"
    place_id: str | None = None
    address: str | None = None
    lat: float | None = None
    lng: float | None = None
    start_time: dt.time | None = None
    end_time: dt.time | None = None
    notes: str | None = None
    cost_amount: float | None = None
    cost_currency: str | None = None
    url: str | None = None
    created_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
    updated_at: dt.datetime = Field(default_factory=dt.datetime.utcnow)
