from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Dict, List, Optional
import asyncio
import json
import os
import random
import uuid

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.core.queue_manager import sort_patient_queue
from app.core.routing import find_best_hospital
from app.core.triage_logic import rule_based_explainable_inference
from app.models.schemas import ChatRequest, Hospital, Patient, PatientCreate

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
CORS_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ORIGINS", FRONTEND_ORIGIN).split(",") if origin.strip()]


# ==========================================
# WEBSOCKET MANAGER (Real-Time Comm Link)
# ==========================================
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        """Push JSON state updates to connected frontend dashboards."""
        payload = json.dumps(message, default=str)
        for connection in list(self.active_connections):
            try:
                await connection.send_text(payload)
            except Exception:
                self.disconnect(connection)


manager = ConnectionManager()


# ==========================================
# IN-MEMORY DATABASE (The Grid)
# ==========================================
db_hospitals: Dict[str, Hospital] = {
    "H-1": Hospital(
        id="H-1",
        name="Chris Hani Baragwanath Academic Hospital",
        kind="public",
        location_x=8.0,
        location_y=18.0,
        lat=-26.2614,
        lng=27.9389,
        total_beds=32,
        available_beds=32,
    ),
    "H-2": Hospital(
        id="H-2",
        name="Charlotte Maxeke Johannesburg Academic Hospital",
        kind="public",
        location_x=18.0,
        location_y=32.0,
        lat=-26.1773,
        lng=28.0451,
        total_beds=26,
        available_beds=26,
    ),
    "H-3": Hospital(
        id="H-3",
        name="Helen Joseph Hospital",
        kind="public",
        location_x=15.0,
        location_y=29.0,
        lat=-26.1745,
        lng=28.0107,
        total_beds=20,
        available_beds=20,
    ),
    "H-4": Hospital(
        id="H-4",
        name="Rahima Moosa Mother and Child Hospital",
        kind="public",
        location_x=14.0,
        location_y=27.0,
        lat=-26.1791,
        lng=27.9942,
        total_beds=18,
        available_beds=18,
    ),
    "H-5": Hospital(
        id="H-5",
        name="Netcare Milpark Hospital",
        kind="private",
        location_x=16.0,
        location_y=30.0,
        lat=-26.1820,
        lng=28.0241,
        total_beds=16,
        available_beds=16,
    ),
    "H-6": Hospital(
        id="H-6",
        name="Mediclinic Morningside",
        kind="private",
        location_x=24.0,
        location_y=42.0,
        lat=-26.0726,
        lng=28.0561,
        total_beds=16,
        available_beds=16,
    ),
}

db_patients: Dict[str, Patient] = {}
hospital_queues: Dict[str, List[Patient]] = {hospital_id: [] for hospital_id in db_hospitals}

DEMO_PATIENTS = [
    {"name": "A. Morales", "age": 58, "primary_symptom": "severe chest pain and sweating"},
    {"name": "K. Tanaka", "age": 34, "primary_symptom": "laceration with bleeding"},
    {"name": "J. Park", "age": 72, "primary_symptom": "slurred speech and numbness"},
    {"name": "S. Okafor", "age": 5, "primary_symptom": "wheezing and difficulty breathing"},
    {"name": "L. Romano", "age": 29, "primary_symptom": "broken arm after fall"},
    {"name": "E. Singh", "age": 41, "primary_symptom": "mild cough and fever"},
    {"name": "M. Dubois", "age": 63, "primary_symptom": "head injury after collision"},
    {"name": "R. Hassan", "age": 26, "primary_symptom": "vomiting and dehydration"},
]


def _random_jhb_pickup() -> dict:
    return {
        "pickup_lat": -26.2041 + (random.random() - 0.5) * 0.18,
        "pickup_lng": 28.0473 + (random.random() - 0.5) * 0.22,
        "patient_x": random.uniform(6.0, 30.0),
        "patient_y": random.uniform(16.0, 46.0),
    }


def _grid_state() -> dict:
    queues = {
        hospital_id: [patient.model_dump(mode="json") for patient in sort_patient_queue(queue)]
        for hospital_id, queue in hospital_queues.items()
    }
    return {
        "hospitals": [hospital.model_dump(mode="json") for hospital in db_hospitals.values()],
        "queues": queues,
        "patients": [patient.model_dump(mode="json") for patient in db_patients.values()],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


async def _create_patient_record(patient_data: PatientCreate) -> Patient:
    triage_level = rule_based_explainable_inference(patient_data)

    patient_x = patient_data.patient_x if patient_data.patient_x is not None else 0.0
    patient_y = patient_data.patient_y if patient_data.patient_y is not None else 0.0
    best_hospital = find_best_hospital(patient_x, patient_y, triage_level, list(db_hospitals.values()))

    if not best_hospital:
        raise HTTPException(status_code=503, detail="Grid overload. No safe route available.")

    new_patient = Patient(
        id=f"P-{uuid.uuid4().hex[:6].upper()}",
        name=patient_data.name,
        age=patient_data.age,
        primary_symptom=patient_data.primary_symptom,
        triage_level=triage_level,
        arrival_time=datetime.now(timezone.utc),
        status="EN_ROUTE",
        assigned_hospital_id=best_hospital.id,
        pickup_lat=patient_data.pickup_lat,
        pickup_lng=patient_data.pickup_lng,
    )

    db_patients[new_patient.id] = new_patient
    hospital_queues[best_hospital.id].append(new_patient)
    best_hospital.available_beds = max(0, best_hospital.available_beds - 1)
    best_hospital.active_queue_length = len(hospital_queues[best_hospital.id])
    best_hospital.current_wait_time_mins = float(best_hospital.active_queue_length * 5.0)

    await manager.broadcast({"event": "NEW_PATIENT", "data": new_patient.model_dump(mode="json")})
    await manager.broadcast({"event": "NETWORK_UPDATE", "data": _grid_state()})

    return new_patient


# ==========================================
# EVENT-DRIVEN DISCRETE SIMULATION ENGINE
# ==========================================
async def network_lifecycle_loop():
    """
    PulseGrid heartbeat. It re-sorts queues, simulates ambulance arrivals,
    processes discharges, and broadcasts state changes to the dashboard.
    """
    while True:
        await asyncio.sleep(2)

        state_changed = False

        for hospital_id, hospital in db_hospitals.items():
            queue = hospital_queues[hospital_id]
            if not queue:
                hospital.active_queue_length = 0
                hospital.current_wait_time_mins = 0.0
                continue

            optimized_queue = sort_patient_queue(queue)
            hospital_queues[hospital_id] = optimized_queue

            for patient in list(optimized_queue):
                if patient.status == "EN_ROUTE" and random.random() < 0.6:
                    patient.status = "WAITING"
                    state_changed = True

                elif patient.status == "WAITING" and random.random() < 0.15:
                    patient.status = "TREATED"
                    hospital.available_beds = min(hospital.total_beds, hospital.available_beds + 1)
                    hospital_queues[hospital_id].remove(patient)
                    state_changed = True
                    break

            hospital.active_queue_length = len(hospital_queues[hospital_id])
            hospital.current_wait_time_mins = float(hospital.active_queue_length * 5.0)

        if state_changed:
            await manager.broadcast({"event": "NETWORK_UPDATE", "data": _grid_state()})


# ==========================================
# APP INITIALIZATION
# ==========================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(network_lifecycle_loop())
    yield
    task.cancel()


app = FastAPI(title="PulseGrid AI API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS else ["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==========================================
# API & WEBSOCKET ENDPOINTS
# ==========================================
@app.get("/")
def read_root():
    return {"status": "online", "system": "PulseGrid AI API Engine Active"}


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "pulsegrid-api"}


@app.websocket("/ws/dashboard")
async def websocket_endpoint(websocket: WebSocket):
    """Live portal for the React dashboard."""
    await manager.connect(websocket)
    await websocket.send_text(json.dumps({"event": "NETWORK_UPDATE", "data": _grid_state()}))
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.post("/patients/intake", response_model=Patient)
async def intake_patient(patient_data: PatientCreate, patient_x: Optional[float] = None, patient_y: Optional[float] = None):
    if patient_x is not None:
        patient_data.patient_x = patient_x
    if patient_y is not None:
        patient_data.patient_y = patient_y
    return await _create_patient_record(patient_data)


@app.post("/simulation/intake", response_model=Patient)
async def simulate_patient_intake():
    payload = {**random.choice(DEMO_PATIENTS), **_random_jhb_pickup()}
    return await _create_patient_record(PatientCreate(**payload))


@app.get("/grid/state")
def get_grid_state():
    return _grid_state()


@app.get("/hospitals/", response_model=List[Hospital])
def get_hospitals():
    return list(db_hospitals.values())


@app.get("/hospitals/{hospital_id}/queue", response_model=List[Patient])
def get_hospital_queue(hospital_id: str):
    if hospital_id not in hospital_queues:
        raise HTTPException(status_code=404, detail="Hospital ID not recognized.")
    return sort_patient_queue(hospital_queues[hospital_id])


# ==========================================
# AI CHATBOT ENDPOINT (Powered by OpenRouter)
# ==========================================
@app.post("/chat")
async def chat_with_pulsegrid_ai(request: ChatRequest):
    """Secure proxy between the React frontend and OpenRouter."""
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="OpenRouter API key is missing from the server environment.")

    system_prompt = {
        "role": "system",
        "content": (
            "You are the PulseGrid AI Command Assistant. You help emergency dispatchers "
            "monitor hospital congestion, explain triage logic, and verify ambulance routing. "
            "Be concise, professional, and highly technical."
        ),
    }
    messages = [system_prompt] + [msg.model_dump() for msg in request.messages]

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "HTTP-Referer": FRONTEND_ORIGIN,
        "X-Title": "PulseGrid AI",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json={
                    "model": os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini"),
                    "messages": messages,
                },
                timeout=20.0,
            )
            response.raise_for_status()
            data = response.json()
            return {"reply": data["choices"][0]["message"]["content"]}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"OpenRouter connection failed: {str(e)}")