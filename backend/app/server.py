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
from app.core.aura_brain import build_aura_system_prompt, generate_aura_expert_response

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
CORS_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ORIGINS", FRONTEND_ORIGIN).split(",") if origin.strip()]

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

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
# IN-MEMORY DATABASE (The Grid - Delhi NCR)
# ==========================================
db_hospitals: Dict[str, Hospital] = {
    # --- GOVERNMENT / PUBLIC ACADEMIC HOSPITALS ---
    "H-1": Hospital(
        id="H-1",
        name="AIIMS New Delhi (All India Institute of Medical Sciences)",
        kind="public",
        location_x=14.0,
        location_y=18.0,
        lat=28.5672,
        lng=77.2100,
        total_beds=50,
        available_beds=48,
    ),
    "H-2": Hospital(
        id="H-2",
        name="Safdarjung Hospital & VMMC",
        kind="public",
        location_x=13.5,
        location_y=18.5,
        lat=28.5700,
        lng=77.2065,
        total_beds=44,
        available_beds=40,
    ),
    "H-3": Hospital(
        id="H-3",
        name="Dr. Ram Manohar Lohia (RML) Hospital",
        kind="public",
        location_x=13.0,
        location_y=24.0,
        lat=28.6247,
        lng=77.2008,
        total_beds=36,
        available_beds=32,
    ),
    "H-4": Hospital(
        id="H-4",
        name="Lok Nayak Hospital (LNJP / MAMC)",
        kind="public",
        location_x=17.0,
        location_y=25.5,
        lat=28.6369,
        lng=77.2405,
        total_beds=38,
        available_beds=35,
    ),
    "H-5": Hospital(
        id="H-5",
        name="Guru Teg Bahadur (GTB) Hospital",
        kind="public",
        location_x=24.0,
        location_y=30.0,
        lat=28.6833,
        lng=77.3117,
        total_beds=34,
        available_beds=30,
    ),

    # --- PRIVATE SUPER-SPECIALTY & TRAUMA CENTERS ---
    "H-6": Hospital(
        id="H-6",
        name="Max Super Speciality Hospital, Saket",
        kind="private",
        location_x=14.5,
        location_y=14.0,
        lat=28.5276,
        lng=77.2120,
        total_beds=28,
        available_beds=26,
    ),
    "H-7": Hospital(
        id="H-7",
        name="Fortis Escorts Heart Institute, Okhla",
        kind="private",
        location_x=21.0,
        location_y=17.5,
        lat=28.5606,
        lng=77.2762,
        total_beds=24,
        available_beds=22,
    ),
    "H-8": Hospital(
        id="H-8",
        name="Indraprastha Apollo Hospital, Sarita Vihar",
        kind="private",
        location_x=21.5,
        location_y=15.5,
        lat=28.5414,
        lng=77.2831,
        total_beds=30,
        available_beds=28,
    ),
    "H-9": Hospital(
        id="H-9",
        name="Sir Ganga Ram Hospital, Rajinder Nagar",
        kind="private",
        location_x=12.0,
        location_y=25.5,
        lat=28.6385,
        lng=77.1895,
        total_beds=26,
        available_beds=24,
    ),

    # --- LOCAL / COMMUNITY & MUNICIPAL HOSPITALS ---
    "H-10": Hospital(
        id="H-10",
        name="Deen Dayal Upadhyay (DDU) Hospital, Hari Nagar",
        kind="local",
        location_x=4.5,
        location_y=24.5,
        lat=28.6280,
        lng=77.1122,
        total_beds=22,
        available_beds=20,
    ),
    "H-11": Hospital(
        id="H-11",
        name="Sanjay Gandhi Memorial Hospital, Mangolpuri",
        kind="local",
        location_x=3.0,
        location_y=31.0,
        lat=28.6975,
        lng=77.0945,
        total_beds=20,
        available_beds=18,
    ),
    "H-12": Hospital(
        id="H-12",
        name="Acharya Shree Bhikshu Government Hospital, Moti Nagar",
        kind="local",
        location_x=7.5,
        location_y=27.5,
        lat=28.6575,
        lng=77.1425,
        total_beds=18,
        available_beds=17,
    ),
    "H-13": Hospital(
        id="H-13",
        name="Lal Bahadur Shastri Hospital, Khichripur",
        kind="local",
        location_x=24.5,
        location_y=23.5,
        lat=28.6200,
        lng=77.3150,
        total_beds=18,
        available_beds=16,
    ),
}

db_patients: Dict[str, Patient] = {}
hospital_queues: Dict[str, List[Patient]] = {hospital_id: [] for hospital_id in db_hospitals}

DEMO_PATIENTS = [
    {"name": "Rajesh Sharma", "age": 54, "primary_symptom": "severe chest pain radiating to left arm and sweating"},
    {"name": "Pooja Verma", "age": 29, "primary_symptom": "deep laceration with active bleeding from road collision"},
    {"name": "Mohammad Arif", "age": 67, "primary_symptom": "sudden slurred speech, facial droop and right-side paralysis"},
    {"name": "Aarav Gupta", "age": 6, "primary_symptom": "acute asthma attack, wheezing and high respiratory distress"},
    {"name": "Sunita Devi", "age": 48, "primary_symptom": "compound leg fracture after fall from stairs"},
    {"name": "Gurpreet Singh", "age": 35, "primary_symptom": "severe head injury and concussion after vehicle collision"},
    {"name": "Priya Nair", "age": 22, "primary_symptom": "acute anaphylaxis with facial swelling and dyspnea"},
    {"name": "Amit Patel", "age": 41, "primary_symptom": "acute abdominal pain and persistent vomiting"},
    {"name": "Deepak Kumar", "age": 59, "primary_symptom": "unconscious with irregular pulse and high fever"},
    {"name": "Meera Joshi", "age": 31, "primary_symptom": "second-degree burn injuries requiring immediate trauma care"},
]


def _random_delhi_pickup() -> dict:
    lat = 28.6139 + (random.random() - 0.5) * 0.16
    lng = 77.2090 + (random.random() - 0.5) * 0.20
    return {
        "pickup_lat": lat,
        "pickup_lng": lng,
        "patient_x": (lng - 77.05) * 100.0,
        "patient_y": (lat - 28.45) * 100.0,
    }


def _random_jhb_pickup() -> dict:
    """Fallback alias for compatibility."""
    return _random_delhi_pickup()


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


app = FastAPI(title="Sanjeevani Grid AI API", version="1.0.0", lifespan=lifespan)
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
    return {"status": "online", "system": "Sanjeevani Grid AI API Engine Active"}


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
    payload = {**random.choice(DEMO_PATIENTS), **_random_delhi_pickup()}
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
async def chat_with_sanjeevani_ai(request: ChatRequest):
    """
    Intelligent Aura AI Endpoint.
    Uses OpenRouter with the comprehensive Delhi live system prompt if API key is valid,
    or our built-in Delhi Healthcare expert reasoning engine for instant, reliable answers.
    """
    user_query = ""
    for msg in reversed(request.messages):
        if msg.role == "user":
            user_query = msg.content
            break

    # If OpenRouter API key is configured, query the model
    if OPENROUTER_API_KEY and OPENROUTER_API_KEY.strip() and not OPENROUTER_API_KEY.startswith("your_"):
        system_prompt = {
            "role": "system",
            "content": build_aura_system_prompt(db_hospitals),
        }
        messages = [system_prompt] + [msg.model_dump() for msg in request.messages]
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "HTTP-Referer": FRONTEND_ORIGIN,
            "X-Title": "Sanjeevani Grid AI Delhi NCR",
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
                if response.status_code == 200:
                    data = response.json()
                    return {"reply": data["choices"][0]["message"]["content"]}
            except Exception:
                pass

    # Built-in Delhi Healthcare & PulseGrid Platform Expert Engine
    reply = generate_aura_expert_response(user_query, db_hospitals, hospital_queues, db_patients)
    return {"reply": reply}