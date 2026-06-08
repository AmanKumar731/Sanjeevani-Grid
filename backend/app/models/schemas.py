from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict


# --- PATIENT SCHEMAS ---
class PatientBase(BaseModel):
    name: str
    age: int
    primary_symptom: str


class PatientCreate(PatientBase):
    """Clean intake payload sent by the dashboard or dispatch client."""

    patient_x: Optional[float] = None
    patient_y: Optional[float] = None
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None


class Patient(PatientBase):
    id: str
    triage_level: int = Field(..., ge=1, le=5)
    arrival_time: datetime
    current_priority: float = 0.0
    status: str = "WAITING" # WAITING, EN_ROUTE, ADMITTED, DISCHARGED
    assigned_hospital_id: Optional[str] = None
    pickup_lat: Optional[float] = None
    pickup_lng: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


# --- HOSPITAL SCHEMAS ---
class Hospital(BaseModel):
    id: str
    name: str
    location_x: float
    location_y: float
    total_beds: int
    available_beds: int
    current_wait_time_mins: float = 0.0
    active_queue_length: int = 0 
    kind: str = "public"
    lat: float
    lng: float

    model_config = ConfigDict(from_attributes=True)


# --- AMBULANCE SCHEMAS ---
class Ambulance(BaseModel):
    id: str
    current_x: float
    current_y: float
    status: str = "IDLE"
    assigned_patient_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# --- CHATBOT SCHEMA ---
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]

