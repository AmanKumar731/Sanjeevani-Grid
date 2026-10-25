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

export type HospitalKind = "public" | "private" | "local";

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

const INDIAN_NAMES = [
  "Rajesh Sharma",
  "Pooja Verma",
  "Mohammad Arif",
  "Aarav Gupta",
  "Sunita Devi",
  "Gurpreet Singh",
  "Priya Nair",
  "Amit Patel",
  "Deepak Kumar",
  "Meera Joshi",
  "Vikram Rao",
  "Ananya Sen",
  "Rohan Malhotra",
  "Kavita Mehra",
];

const EMERGENCY_SYMPTOMS = [
  "Severe chest pain and diaphoresis",
  "Deep lacerations and vehicular trauma",
  "Acute respiratory distress and stridor",
  "Suspected cardiac arrest",
  "Open tibial compound fracture",
  "Acute stroke symptoms & facial droop",
  "Severe sepsis & high fever",
  "Blunt head trauma after collision",
  "Acute anaphylactic reaction",
  "Second-degree burns requiring trauma care",
];

export function randomPatient(): Patient {
  return {
    id: crypto.randomUUID(),
    name: INDIAN_NAMES[Math.floor(Math.random() * INDIAN_NAMES.length)],
    symptom: EMERGENCY_SYMPTOMS[Math.floor(Math.random() * EMERGENCY_SYMPTOMS.length)],
    triage: (Math.floor(Math.random() * 5) + 1) as Patient["triage"],
    arrivedAt: Date.now(),
    age: Math.floor(Math.random() * 65) + 10,
  };
}

export const HOSPITALS: Hospital[] = [
  // --- GOVERNMENT / CENTRAL PUBLIC ACADEMIC HOSPITALS ---
  {
    id: "H-1",
    name: "AIIMS New Delhi (All India Institute of Medical Sciences)",
    kind: "public",
    capacity: 50,
    queue: seedQueue(14),
    x: 14.0,
    y: 18.0,
    lat: 28.5672,
    lng: 77.2100,
    availableBeds: 48,
    waitTimeMins: 25,
  },
  {
    id: "H-2",
    name: "Safdarjung Hospital & VMMC",
    kind: "public",
    capacity: 44,
    queue: seedQueue(12),
    x: 13.5,
    y: 18.5,
    lat: 28.5700,
    lng: 77.2065,
    availableBeds: 40,
    waitTimeMins: 20,
  },
  {
    id: "H-3",
    name: "Dr. Ram Manohar Lohia (RML) Hospital",
    kind: "public",
    capacity: 36,
    queue: seedQueue(10),
    x: 13.0,
    y: 24.0,
    lat: 28.6247,
    lng: 77.2008,
    availableBeds: 32,
    waitTimeMins: 18,
  },
  {
    id: "H-4",
    name: "Lok Nayak Hospital (LNJP / MAMC)",
    kind: "public",
    capacity: 38,
    queue: seedQueue(11),
    x: 17.0,
    y: 25.5,
    lat: 28.6369,
    lng: 77.2405,
    availableBeds: 35,
    waitTimeMins: 22,
  },
  {
    id: "H-5",
    name: "Guru Teg Bahadur (GTB) Hospital",
    kind: "public",
    capacity: 34,
    queue: seedQueue(9),
    x: 24.0,
    y: 30.0,
    lat: 28.6833,
    lng: 77.3117,
    availableBeds: 30,
    waitTimeMins: 16,
  },

  // --- PRIVATE SUPER-SPECIALTY & TRAUMA CENTERS ---
  {
    id: "H-6",
    name: "Max Super Speciality Hospital, Saket",
    kind: "private",
    capacity: 28,
    queue: seedQueue(6),
    x: 14.5,
    y: 14.0,
    lat: 28.5276,
    lng: 77.2120,
    availableBeds: 26,
    waitTimeMins: 12,
  },
  {
    id: "H-7",
    name: "Fortis Escorts Heart Institute, Okhla",
    kind: "private",
    capacity: 24,
    queue: seedQueue(5),
    x: 21.0,
    y: 17.5,
    lat: 28.5606,
    lng: 77.2762,
    availableBeds: 22,
    waitTimeMins: 10,
  },
  {
    id: "H-8",
    name: "Indraprastha Apollo Hospital, Sarita Vihar",
    kind: "private",
    capacity: 30,
    queue: seedQueue(7),
    x: 21.5,
    y: 15.5,
    lat: 28.5414,
    lng: 77.2831,
    availableBeds: 28,
    waitTimeMins: 14,
  },
  {
    id: "H-9",
    name: "Sir Ganga Ram Hospital, Rajinder Nagar",
    kind: "private",
    capacity: 26,
    queue: seedQueue(5),
    x: 12.0,
    y: 25.5,
    lat: 28.6385,
    lng: 77.1895,
    availableBeds: 24,
    waitTimeMins: 11,
  },

  // --- LOCAL / COMMUNITY & MUNICIPAL HOSPITALS ---
  {
    id: "H-10",
    name: "Deen Dayal Upadhyay (DDU) Hospital, Hari Nagar",
    kind: "local",
    capacity: 22,
    queue: seedQueue(5),
    x: 4.5,
    y: 24.5,
    lat: 28.6280,
    lng: 77.1122,
    availableBeds: 20,
    waitTimeMins: 15,
  },
  {
    id: "H-11",
    name: "Sanjay Gandhi Memorial Hospital, Mangolpuri",
    kind: "local",
    capacity: 20,
    queue: seedQueue(4),
    x: 3.0,
    y: 31.0,
    lat: 28.6975,
    lng: 77.0945,
    availableBeds: 18,
    waitTimeMins: 12,
  },
  {
    id: "H-12",
    name: "Acharya Shree Bhikshu Government Hospital, Moti Nagar",
    kind: "local",
    capacity: 18,
    queue: seedQueue(3),
    x: 7.5,
    y: 27.5,
    lat: 28.6575,
    lng: 77.1425,
    availableBeds: 17,
    waitTimeMins: 10,
  },
  {
    id: "H-13",
    name: "Lal Bahadur Shastri Hospital, Khichripur",
    kind: "local",
    capacity: 18,
    queue: seedQueue(4),
    x: 24.5,
    y: 23.5,
    lat: 28.6200,
    lng: 77.3150,
    availableBeds: 16,
    waitTimeMins: 12,
  },
];

export function randomDelhiCoord(): { lat: number; lng: number } {
  return {
    lat: 28.6139 + (Math.random() - 0.5) * 0.16,
    lng: 77.2090 + (Math.random() - 0.5) * 0.20,
  };
}

export const randomJhbCoord = randomDelhiCoord;

export function randomGridCoord(): { x: number; y: number } {
  return {
    x: 3 + Math.random() * 22,
    y: 12 + Math.random() * 22,
  };
}

function seedQueue(n: number): QueuedPatient[] {
  return Array.from({ length: n }, () => ({
    id: crypto.randomUUID(),
    name: INDIAN_NAMES[Math.floor(Math.random() * INDIAN_NAMES.length)],
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
