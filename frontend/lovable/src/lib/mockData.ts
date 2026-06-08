export interface Patient {
  id: string;
  name: string;
  symptom: string;
  triage: 1 | 2 | 3 | 4 | 5;
  arrivedAt: number;
  age?: number;
  status?: string;
  assignedHospitalId?: string | null;
  priority?: number;
  pickupLat?: number | null;
  pickupLng?: number | null;
}

export interface QueuedPatient {
  id: string;
  name: string;
  score: number;
  triage?: 1 | 2 | 3 | 4 | 5;
  status?: string;
}

export type HospitalKind = "public" | "private";

export interface Hospital {
  id: string;
  name: string;
  kind: HospitalKind;
  capacity: number;
  queue: QueuedPatient[];
  x: number;
  y: number;
  lat: number;
  lng: number;
  availableBeds?: number;
  waitTimeMins?: number;
}

const NAMES = [
  "A. Morales",
  "K. Tanaka",
  "J. Park",
  "S. Okafor",
  "L. Romano",
  "E. Singh",
  "M. Dubois",
  "R. Hassan",
  "T. Nguyen",
  "C. Becker",
  "I. Petrov",
  "O. Adeyemi",
];
const SYMPTOMS = [
  "Chest pain",
  "Lacerations",
  "Respiratory distress",
  "Cardiac arrest",
  "Severe fracture",
  "Stroke symptoms",
  "Sepsis suspect",
  "Head trauma",
  "Allergic reaction",
  "Burns",
];

export function randomPatient(): Patient {
  return {
    id: crypto.randomUUID(),
    name: NAMES[Math.floor(Math.random() * NAMES.length)],
    symptom: SYMPTOMS[Math.floor(Math.random() * SYMPTOMS.length)],
    triage: (Math.floor(Math.random() * 5) + 1) as Patient["triage"],
    arrivedAt: Date.now(),
  };
}

export const HOSPITALS: Hospital[] = [
  {
    id: "H-1",
    name: "Chris Hani Baragwanath Academic Hospital",
    kind: "public",
    capacity: 32,
    queue: seedQueue(22),
    x: 8,
    y: 18,
    lat: -26.2614,
    lng: 27.9389,
    availableBeds: 10,
    waitTimeMins: 110,
  },
  {
    id: "H-2",
    name: "Charlotte Maxeke Johannesburg Academic Hospital",
    kind: "public",
    capacity: 26,
    queue: seedQueue(16),
    x: 18,
    y: 32,
    lat: -26.1773,
    lng: 28.0451,
    availableBeds: 10,
    waitTimeMins: 80,
  },
  {
    id: "H-3",
    name: "Helen Joseph Hospital",
    kind: "public",
    capacity: 20,
    queue: seedQueue(12),
    x: 15,
    y: 29,
    lat: -26.1745,
    lng: 28.0107,
    availableBeds: 8,
    waitTimeMins: 60,
  },
  {
    id: "H-4",
    name: "Rahima Moosa Mother and Child Hospital",
    kind: "public",
    capacity: 18,
    queue: seedQueue(10),
    x: 14,
    y: 27,
    lat: -26.1791,
    lng: 27.9942,
    availableBeds: 8,
    waitTimeMins: 50,
  },
  {
    id: "H-5",
    name: "Netcare Milpark Hospital",
    kind: "private",
    capacity: 16,
    queue: seedQueue(8),
    x: 16,
    y: 30,
    lat: -26.182,
    lng: 28.0241,
    availableBeds: 8,
    waitTimeMins: 40,
  },
  {
    id: "H-6",
    name: "Mediclinic Morningside",
    kind: "private",
    capacity: 16,
    queue: seedQueue(7),
    x: 24,
    y: 42,
    lat: -26.0726,
    lng: 28.0561,
    availableBeds: 9,
    waitTimeMins: 35,
  },
];

export function randomJhbCoord(): { lat: number; lng: number } {
  return {
    lat: -26.2041 + (Math.random() - 0.5) * 0.18,
    lng: 28.0473 + (Math.random() - 0.5) * 0.22,
  };
}

export function randomGridCoord(): { x: number; y: number } {
  return {
    x: 6 + Math.random() * 24,
    y: 16 + Math.random() * 30,
  };
}

function seedQueue(n: number): QueuedPatient[] {
  return Array.from({ length: n }, () => ({
    id: crypto.randomUUID(),
    name: NAMES[Math.floor(Math.random() * NAMES.length)],
    score: Math.round(Math.random() * 90 + 10),
  })).sort((a, b) => b.score - a.score);
}

export function shuffleQueue(q: QueuedPatient[]): QueuedPatient[] {
  return [...q]
    .map((p) => ({
      ...p,
      score: Math.max(1, Math.min(100, p.score + Math.round((Math.random() - 0.5) * 30))),
    }))
    .sort((a, b) => b.score - a.score);
}
