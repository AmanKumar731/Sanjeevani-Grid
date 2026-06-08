import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchGridState,
  mapBackendHospital,
  mapBackendPatient,
  simulatePatientIntake,
  WS_URL,
} from "@/lib/api";
import {
  HOSPITALS,
  Hospital,
  Patient,
  randomJhbCoord,
  randomPatient,
  shuffleQueue,
} from "@/lib/mockData";

type ConnState = "connecting" | "live" | "mock";

export interface RouteEvent {
  id: string;
  fromLat: number;
  fromLng: number;
  hospitalId: string;
  createdAt: number;
}

function uniqueNewestPatients(patients: Patient[]) {
  const byId = new Map<string, Patient>();
  patients.forEach((patient) => byId.set(patient.id, patient));
  return Array.from(byId.values())
    .sort((a, b) => b.arrivedAt - a.arrivedAt)
    .slice(0, 30);
}

export function useLiveGrid() {
  const [patients, setPatients] = useState<Patient[]>(() =>
    Array.from({ length: 4 }, () => randomPatient()),
  );
  const [hospitals, setHospitals] = useState<Hospital[]>(HOSPITALS);
  const [routes, setRoutes] = useState<RouteEvent[]>([]);
  const [conn, setConn] = useState<ConnState>("connecting");
  const [isSimulating, setIsSimulating] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const addRouteForPatient = useCallback((patient: Patient) => {
    const hospitalId =
      patient.assignedHospitalId || HOSPITALS[Math.floor(Math.random() * HOSPITALS.length)].id;
    const pickup =
      patient.pickupLat && patient.pickupLng
        ? { lat: patient.pickupLat, lng: patient.pickupLng }
        : randomJhbCoord();

    setRoutes((current) =>
      [
        ...current,
        {
          id: crypto.randomUUID(),
          fromLat: pickup.lat,
          fromLng: pickup.lng,
          hospitalId,
          createdAt: Date.now(),
        },
      ].slice(-8),
    );
  }, []);

  const pushPatient = useCallback(
    (patient: Patient, withRoute = true) => {
      setPatients((current) => uniqueNewestPatients([patient, ...current]));
      if (withRoute) addRouteForPatient(patient);
    },
    [addRouteForPatient],
  );

  const syncGrid = useCallback(async () => {
    const state = await fetchGridState();
    const mappedHospitals = state.hospitals.map((hospital) =>
      mapBackendHospital(hospital, state.queues[hospital.id] || []),
    );
    const mappedPatients = Object.values(state.queues).flat().map(mapBackendPatient);

    setHospitals(mappedHospitals);
    if (mappedPatients.length > 0) {
      setPatients(uniqueNewestPatients(mappedPatients));
    }
    setConn("live");
  }, []);

  const reshuffleMock = useCallback(() => {
    setHospitals((currentHospitals) =>
      currentHospitals.map((hospital) => ({
        ...hospital,
        queue: shuffleQueue(
          Math.random() > 0.7
            ? [
                ...hospital.queue,
                {
                  id: crypto.randomUUID(),
                  name: "New Intake",
                  score: Math.round(Math.random() * 100),
                },
              ]
            : hospital.queue,
        ).slice(0, hospital.capacity),
      })),
    );
  }, []);

  const simulateIntake = useCallback(async () => {
    setIsSimulating(true);
    try {
      const backendPatient = await simulatePatientIntake();
      const patient = mapBackendPatient(backendPatient);
      pushPatient(patient);
      await syncGrid();
    } catch (error) {
      console.error("PulseGrid simulation failed", error);
      setConn("mock");
      pushPatient(randomPatient());
      reshuffleMock();
    } finally {
      setIsSimulating(false);
    }
  }, [pushPatient, reshuffleMock, syncGrid]);

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;

    syncGrid().catch(() => {
      if (!cancelled) setConn("mock");
    });

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      timeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN && !cancelled) {
          setConn("mock");
          ws.close();
        }
      }, 1800);

      ws.onopen = () => {
        if (!cancelled) setConn("live");
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.event === "NEW_PATIENT" && message.data) {
            pushPatient(mapBackendPatient(message.data));
          }
          if (message.event === "NETWORK_UPDATE") {
            if (message.data?.hospitals && message.data?.queues) {
              const mappedHospitals = message.data.hospitals.map(
                (hospital: Parameters<typeof mapBackendHospital>[0]) =>
                  mapBackendHospital(hospital, message.data.queues[hospital.id] || []),
              );
              const mappedPatients = Object.values(message.data.queues)
                .flat()
                .map((patient) =>
                  mapBackendPatient(patient as Parameters<typeof mapBackendPatient>[0]),
                );
              setHospitals(mappedHospitals);
              if (mappedPatients.length > 0) setPatients(uniqueNewestPatients(mappedPatients));
            } else {
              syncGrid().catch(() => setConn("mock"));
            }
          }
        } catch (error) {
          console.error("Invalid dashboard event", error);
        }
      };

      ws.onerror = () => {
        if (!cancelled) setConn("mock");
      };
      ws.onclose = () => {
        if (!cancelled) setConn((current) => (current === "live" ? "mock" : current));
      };
    } catch {
      setConn("mock");
    }

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      wsRef.current?.close();
    };
  }, [pushPatient, syncGrid]);

  useEffect(() => {
    if (conn === "live") return;
    const patientTimer = setInterval(() => pushPatient(randomPatient()), 3500);
    const queueTimer = setInterval(() => reshuffleMock(), 4200);
    return () => {
      clearInterval(patientTimer);
      clearInterval(queueTimer);
    };
  }, [conn, pushPatient, reshuffleMock]);

  useEffect(() => {
    const timer = setInterval(() => {
      setRoutes((current) => current.filter((route) => Date.now() - route.createdAt < 9000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return { patients, hospitals, routes, conn, simulateIntake, isSimulating };
}
