import { HOSPITALS, Hospital, HospitalKind, Patient, QueuedPatient } from "@/lib/mockData";

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
);
export const WS_URL =
  import.meta.env.VITE_WS_URL || `${API_BASE_URL.replace(/^http/, "ws")}/ws/dashboard`;

export interface BackendPatient {
  id: string;
  name: string;
  age: number;
  primary_symptom: string;
  triage_level: 1 | 2 | 3 | 4 | 5;
  arrival_time: string;
  current_priority: number;
  status: string;
  assigned_hospital_id?: string | null;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
}

export interface BackendHospital {
  id: string;
  name: string;
  kind: HospitalKind;
  location_x: number;
  location_y: number;
  lat: number;
  lng: number;
  total_beds: number;
  available_beds: number;
  current_wait_time_mins: number;
  active_queue_length: number;
}

export interface GridStateResponse {
  hospitals: BackendHospital[];
  queues: Record<string, BackendPatient[]>;
  patients: BackendPatient[];
  generated_at: string;
}

export interface IntakePayload {
  name: string;
  age: number;
  primary_symptom: string;
  patient_x?: number;
  patient_y?: number;
  pickup_lat?: number;
  pickup_lng?: number;
}

function fallbackHospital(id: string) {
  return HOSPITALS.find((hospital) => hospital.id === id);
}

export function mapBackendPatient(patient: BackendPatient): Patient {
  return {
    id: patient.id,
    name: patient.name,
    symptom: patient.primary_symptom,
    triage: patient.triage_level,
    arrivedAt: Date.parse(patient.arrival_time) || Date.now(),
    age: patient.age,
    status: patient.status,
    assignedHospitalId: patient.assigned_hospital_id ?? null,
    priority: patient.current_priority,
    pickupLat: patient.pickup_lat ?? null,
    pickupLng: patient.pickup_lng ?? null,
  };
}

export function mapBackendQueuedPatient(patient: BackendPatient): QueuedPatient {
  return {
    id: patient.id,
    name: patient.name,
    score: Math.round(patient.current_priority || patient.triage_level * 20),
    triage: patient.triage_level,
    status: patient.status,
  };
}

export function mapBackendHospital(
  hospital: BackendHospital,
  queue: BackendPatient[] = [],
): Hospital {
  const fallback = fallbackHospital(hospital.id);
  return {
    id: hospital.id,
    name: hospital.name,
    kind: hospital.kind || fallback?.kind || "public",
    capacity: hospital.total_beds,
    queue: queue.map(mapBackendQueuedPatient),
    x: hospital.location_x,
    y: hospital.location_y,
    lat: hospital.lat || fallback?.lat || -26.2041,
    lng: hospital.lng || fallback?.lng || 28.0473,
    availableBeds: hospital.available_beds,
    waitTimeMins: hospital.current_wait_time_mins,
  };
}

export async function fetchGridState(): Promise<GridStateResponse> {
  const response = await fetch(`${API_BASE_URL}/grid/state`);
  if (!response.ok) throw new Error(`PulseGrid API returned ${response.status}`);
  return response.json();
}

export async function intakePatient(payload: IntakePayload): Promise<BackendPatient> {
  const response = await fetch(`${API_BASE_URL}/patients/intake`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Patient intake failed with status ${response.status}`);
  return response.json();
}

export async function simulatePatientIntake(): Promise<BackendPatient> {
  const response = await fetch(`${API_BASE_URL}/simulation/intake`, { method: "POST" });
  if (!response.ok) throw new Error(`Simulation intake failed with status ${response.status}`);
  return response.json();
}

export async function askAura(
  messages: { role: "user" | "assistant" | "system"; content: string }[],
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Aura request failed with status ${response.status}`);
  }
  const data = await response.json();
  return data.reply;
}
