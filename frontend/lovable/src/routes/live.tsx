import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState, useEffect } from "react";
import {
  Activity,
  Ambulance,
  BedDouble,
  Building2,
  Clock,
  HeartPulse,
  HelpCircle,
  Lock,
  Pause,
  Play,
  PlusCircle,
  RefreshCw,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { InflowColumn, triageBadgeInfo } from "@/components/InflowColumn";
import { OutflowColumn } from "@/components/OutflowColumn";
import { useLiveGrid } from "@/hooks/useLiveGrid";
import { IntakePayload } from "@/lib/api";

const LeafletMap = lazy(() =>
  import("@/components/LeafletMap").then((m) => ({ default: m.LeafletMap })),
);

export const Route = createFileRoute("/live")({
  head: () => ({
    meta: [
      { title: "Delhi NCR Live Emergency Medical Grid — Sanjeevani Grid AI" },
      {
        name: "description",
        content:
          "Real-time emergency triage, predictive CATS/108 ambulance routing, hospital bed capacity and dynamic priority queues across Delhi NCR (Government, Private & Local Community Hospitals).",
      },
    ],
  }),
  component: LiveGrid,
});

const COMMON_SYMPTOM_PRESETS = [
  { label: "Cardiac Emergency (Connaught Place)", symptom: "Severe crushing chest pain radiating to left arm with diaphoresis", defaultSeverity: 5 },
  { label: "Acute Stroke / Hemiparesis (South Delhi)", symptom: "Sudden slurred speech, facial droop and right-sided limb weakness", defaultSeverity: 5 },
  { label: "Vehicular Trauma (Ring Road / AIIMS Flyover)", symptom: "High-speed collision with multiple blunt trauma and severe head injury", defaultSeverity: 4 },
  { label: "Pediatric Respiratory Distress (East Delhi)", symptom: "Acute severe asthma attack with stridor and oxygen desaturation", defaultSeverity: 4 },
  { label: "Compound Limb Fracture (West Delhi)", symptom: "Open tibial fracture with active bleeding after construction accident", defaultSeverity: 3 },
  { label: "Acute Sepsis & Dehydration (North Delhi)", symptom: "High 104F fever, severe dehydration and suspected septic shock", defaultSeverity: 2 },
];

function LiveGrid() {
  const {
    patients,
    hospitals,
    routes,
    conn,
    simulateIntake,
    dispatchCustomIntake,
    isSimulating,
  } = useLiveGrid();

  // Unit filter: 'all' | 'government' | 'private' | 'local'
  const [unitFilter, setUnitFilter] = useState<"all" | "government" | "private" | "local">("all");
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);

  // Auto-Simulation state
  const [autoSimulate, setAutoSimulate] = useState(false);

  // Custom Intake Dialog
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customAge, setCustomAge] = useState<number>(42);
  const [customSymptom, setCustomSymptom] = useState("");
  const [customSeverity, setCustomSeverity] = useState<number>(4);

  // Help & Architecture Info Modal
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Unit counts
  const govCount = useMemo(() => hospitals.filter((h) => h.kind === "public").length, [hospitals]);
  const privCount = useMemo(() => hospitals.filter((h) => h.kind === "private").length, [hospitals]);
  const localCount = useMemo(() => hospitals.filter((h) => h.kind === "local").length, [hospitals]);

  // Hospital Map Filter
  const visibleHospitals = useMemo(() => {
    if (unitFilter === "government") return hospitals.filter((h) => h.kind === "public");
    if (unitFilter === "private") return hospitals.filter((h) => h.kind === "private");
    if (unitFilter === "local") return hospitals.filter((h) => h.kind === "local");
    return hospitals;
  }, [hospitals, unitFilter]);

  const visibleIds = useMemo(() => new Set(visibleHospitals.map((h) => h.id)), [visibleHospitals]);
  const visibleRoutes = useMemo(
    () => routes.filter((r) => visibleIds.has(r.hospitalId)),
    [routes, visibleIds],
  );

  // Auto-simulation interval timer
  useEffect(() => {
    if (!autoSimulate) return;
    const interval = setInterval(async () => {
      const patient = await simulateIntake();
      if (patient) {
        const triage = triageBadgeInfo(patient.triage);
        toast.info(`🚑 Auto Intake: ${patient.name}`, {
          description: `${triage.label} · ${patient.symptom}`,
          duration: 3500,
        });
      }
    }, 7500);
    return () => clearInterval(interval);
  }, [autoSimulate, simulateIntake]);

  // Handle Quick Intake with rich toast feedback
  const handleQuickIntake = async () => {
    const patient = await simulateIntake();
    if (patient) {
      const triage = triageBadgeInfo(patient.triage);
      const hospital = hospitals.find((h) => h.id === patient.assignedHospitalId);
      toast.success(`Dispatched: ${patient.name}`, {
        description: `Triage ${triage.label} · Routed to ${hospital ? hospital.name : "Assigned Hospital"}`,
        duration: 4000,
      });
    }
  };

  // Handle Custom Dispatch submission
  const handleCustomDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customSymptom.trim()) {
      toast.error("Please provide both patient name and primary symptom");
      return;
    }

    const payload: IntakePayload = {
      name: customName.trim(),
      age: Number(customAge) || 35,
      primary_symptom: customSymptom.trim(),
    };

    setShowCustomModal(false);
    const patient = await dispatchCustomIntake(payload);
    if (patient) {
      const triage = triageBadgeInfo(patient.triage);
      const hospital = hospitals.find((h) => h.id === patient.assignedHospitalId);
      toast.success(`Custom Emergency Dispatched: ${patient.name}`, {
        description: `${triage.label} · Routed to ${hospital ? hospital.name : "Emergency Center"}`,
        duration: 4500,
      });
    }

    // Reset inputs
    setCustomName("");
    setCustomSymptom("");
  };

  // Operational KPI calculations
  const totalCapacity = useMemo(
    () => hospitals.reduce((acc, h) => acc + h.capacity, 0),
    [hospitals],
  );

  const availableBeds = useMemo(
    () =>
      hospitals.reduce(
        (acc, h) => acc + (h.availableBeds ?? Math.max(0, h.capacity - h.queue.length)),
        0,
      ),
    [hospitals],
  );

  const totalOccupied = totalCapacity - availableBeds;
  const occupancyPct = totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

  const criticalCount = useMemo(
    () => patients.filter((p) => p.triage >= 4).length,
    [patients],
  );

  const avgWaitMins = useMemo(() => {
    if (hospitals.length === 0) return 0;
    const sum = hospitals.reduce((acc, h) => acc + (h.waitTimeMins ?? h.queue.length * 5), 0);
    return Math.round(sum / hospitals.length);
  }, [hospitals]);

  return (
    <main className="flex-1 px-3 sm:px-6 py-5">
      <div className="mx-auto max-w-[1600px] space-y-4">
        {/* ========================================================= */}
        {/* TOP COMMAND HEADER & CONTROLS                             */}
        {/* ========================================================= */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/90 backdrop-blur-md border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-tech-blue/10 text-tech-blue border border-tech-blue/20">
                <HeartPulse className="w-3 h-3 text-tech-blue animate-pulse" />
                Emergency Command Center
              </span>
              <span className="text-[11px] text-muted-foreground font-medium">
                National Capital Territory of Delhi, India
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Delhi NCR Live Operations Grid
            </h1>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Intake Button */}
            <button
              type="button"
              onClick={handleQuickIntake}
              disabled={isSimulating}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-semibold uppercase tracking-wider hover:from-blue-700 hover:to-indigo-700 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              title="Generate an instant emergency patient and run predictive routing"
            >
              {isSimulating ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Activity className="w-3.5 h-3.5" />
              )}
              <span>Simulate Intake</span>
            </button>

            {/* Custom Intake Modal Trigger */}
            <button
              type="button"
              onClick={() => setShowCustomModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold uppercase tracking-wider shadow-2xs transition-all cursor-pointer"
              title="Create a custom patient with specific symptoms and severity"
            >
              <PlusCircle className="w-3.5 h-3.5 text-tech-blue" />
              <span>Custom Case</span>
            </button>

            {/* Auto-Simulation Toggle */}
            <button
              type="button"
              onClick={() => setAutoSimulate(!autoSimulate)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer border ${
                autoSimulate
                  ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
              title="Automatically simulate continuous emergency intakes every 7 seconds"
            >
              {autoSimulate ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Auto Feed Active</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-slate-600" />
                  <span>Auto Feed</span>
                </>
              )}
            </button>

            {/* Explainer Help Modal Button */}
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="inline-flex items-center gap-1 p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 shadow-2xs transition-all cursor-pointer"
              title="How does Sanjeevani Grid AI work?"
            >
              <HelpCircle className="w-4 h-4 text-tech-blue" />
            </button>

            {/* Live Backend Connection Indicator */}
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold uppercase tracking-wider shadow-2xs ${
                conn === "live"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : conn === "mock"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  conn === "live"
                    ? "bg-emerald-500 animate-ping"
                    : conn === "mock"
                      ? "bg-amber-500"
                      : "bg-slate-400"
                }`}
              />
              {conn === "live" ? "Backend Live" : conn === "mock" ? "Demo Mode" : "Connecting…"}
            </span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* OPERATIONAL KPI CARDS                                     */}
        {/* ========================================================= */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Card 1: Active Patients */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Active Patients
              </span>
              <Users className="w-4 h-4 text-tech-blue" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">
                {patients.length}
              </span>
              <span className="text-xs font-semibold text-rose-600">
                {criticalCount} Critical (L4-5)
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Live admissions across network
            </div>
          </div>

          {/* Card 2: En Route Ambulances */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Ambulances En Route
              </span>
              <Ambulance className="w-4 h-4 text-rose-600 animate-bounce" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">
                {visibleRoutes.length}
              </span>
              <span className="text-xs text-slate-600 font-medium">Dispatches</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Active predictive transit corridors
            </div>
          </div>

          {/* Card 3: Network Bed Capacity */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Available Beds
              </span>
              <BedDouble className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">
                {availableBeds}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                / {totalCapacity} ({occupancyPct}% full)
              </span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  occupancyPct >= 80 ? "bg-rose-500" : occupancyPct >= 60 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${occupancyPct}%` }}
              />
            </div>
          </div>

          {/* Card 4: Average Wait Time */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Average ER Wait
              </span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900 tabular-nums">
                ~{avgWaitMins}
              </span>
              <span className="text-xs font-semibold text-slate-600">Minutes</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Across all {hospitals.length} receiving hospitals
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* MAIN LIVE MAP SECTION                                     */}
        {/* ========================================================= */}
        <section className="relative h-[55vh] min-h-[460px] rounded-2xl border border-slate-200/90 bg-white shadow-card overflow-hidden">
          {/* Map Top Status Pill (Left) */}
          <div className="absolute top-3 left-3 z-[400] flex flex-wrap items-center gap-2 pointer-events-none">
            <div className="pointer-events-auto px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur-md text-xs font-bold text-slate-800 border border-slate-200/90 shadow-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Delhi NCR Emergency Dispatch Grid</span>
              <span className="text-slate-400 font-normal">|</span>
              <span className="text-slate-600 font-medium">
                {visibleRoutes.length} active routes · {visibleHospitals.length} receiving units
              </span>
            </div>
          </div>

          {/* Unit Classification Filter Tabs (Top Center/Right) */}
          <div className="absolute top-3 right-3 sm:right-48 z-[400]">
            <div className="inline-flex items-center p-1 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-sm text-xs font-semibold flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setUnitFilter("all")}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  unitFilter === "all"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All ({hospitals.length})
              </button>
              <button
                type="button"
                onClick={() => setUnitFilter("government")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  unitFilter === "government"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-blue-700"
                }`}
              >
                <Building2 className="w-3 h-3" /> Govt ({govCount})
              </button>
              <button
                type="button"
                onClick={() => setUnitFilter("private")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  unitFilter === "private"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-purple-700"
                }`}
              >
                <Lock className="w-3 h-3" /> Private ({privCount})
              </button>
              <button
                type="button"
                onClick={() => setUnitFilter("local")}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  unitFilter === "local"
                    ? "bg-teal-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-teal-700"
                }`}
              >
                <Building2 className="w-3 h-3" /> Local ({localCount})
              </button>
            </div>
          </div>

          {/* Clean Map Component */}
          <Suspense
            fallback={
              <div className="absolute inset-0 grid place-items-center bg-slate-50 text-sm text-slate-500">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-tech-blue" />
                  <span>Loading Delhi NCR GIS Vector Grid…</span>
                </div>
              </div>
            }
          >
            <LeafletMap
              hospitals={visibleHospitals}
              routes={visibleRoutes}
              selectedHospitalId={selectedHospitalId}
              onSelectHospital={(id) => setSelectedHospitalId(id)}
            />
          </Suspense>
        </section>

        {/* ========================================================= */}
        {/* LOWER SECTION: 50/50 INFLOW & OUTFLOW COLUMNS             */}
        {/* ========================================================= */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[460px] pb-6">
          <InflowColumn
            patients={patients}
            hospitals={hospitals}
            selectedHospitalId={selectedHospitalId}
            onSelectHospital={(id) => setSelectedHospitalId(id)}
          />
          <OutflowColumn
            hospitals={visibleHospitals}
            selectedHospitalId={selectedHospitalId}
            onSelectHospital={(id) => setSelectedHospitalId(id)}
          />
        </section>
      </div>

      {/* ========================================================= */}
      {/* CUSTOM INTAKE MODAL                                       */}
      {/* ========================================================= */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 relative">
            <button
              type="button"
              onClick={() => setShowCustomModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 rounded-xl bg-tech-blue/10 text-tech-blue">
                <PlusCircle className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  Dispatch Custom Emergency Intake
                </h3>
                <p className="text-xs text-muted-foreground">
                  Test the Manchester triage logic and predictive routing engine
                </p>
              </div>
            </div>

            <form onSubmit={handleCustomDispatch} className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Patient Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. T. Mokoena"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-tech-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Age
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="110"
                    required
                    value={customAge}
                    onChange={(e) => setCustomAge(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-tech-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Common Presets (Click to autofill)
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {COMMON_SYMPTOM_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setCustomSymptom(preset.symptom);
                        setCustomSeverity(preset.defaultSeverity);
                      }}
                      className="text-[11px] px-2.5 py-1 rounded-md bg-slate-100 hover:bg-blue-50 hover:text-tech-blue text-slate-700 border border-slate-200 transition-colors text-left"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary Symptom & Chief Complaint
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Describe emergency symptoms..."
                  value={customSymptom}
                  onChange={(e) => setCustomSymptom(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-tech-blue"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Assessed Severity Level: Level {customSeverity}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      customSeverity >= 4
                        ? "bg-rose-100 text-rose-700"
                        : customSeverity === 3
                          ? "bg-amber-100 text-amber-700"
                          : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {customSeverity === 5
                      ? "Immediate / Resuscitation"
                      : customSeverity === 4
                        ? "Very Urgent (<15m)"
                        : customSeverity === 3
                          ? "Urgent (<30m)"
                          : "Standard Care"}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={customSeverity}
                  onChange={(e) => setCustomSeverity(Number(e.target.value))}
                  className="w-full accent-tech-blue cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground px-0.5 mt-0.5">
                  <span>L1 Routine</span>
                  <span>L2 Standard</span>
                  <span>L3 Urgent</span>
                  <span>L4 Very Urgent</span>
                  <span>L5 Resuscitation</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSimulating}
                  className="px-5 py-2 rounded-xl bg-tech-blue hover:bg-tech-blue-deep text-white text-xs font-semibold uppercase tracking-wider shadow-sm transition-all cursor-pointer"
                >
                  {isSimulating ? "Routing…" : "Dispatch & Route Patient"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* EXPLAINER / HOW IT WORKS MODAL                            */}
      {/* ========================================================= */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowHelpModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <span className="p-2 rounded-xl bg-tech-blue/10 text-tech-blue">
                <Sparkles className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  How Sanjeevani Grid AI Works
                </h3>
                <p className="text-xs text-muted-foreground">
                  The three algorithms powering live medical network orchestration
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs text-slate-700 mt-4 leading-relaxed">
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/60">
                <h4 className="font-bold text-blue-950 text-sm mb-1">
                  1. Rule-Based Explainable Triage (MTS)
                </h4>
                <p>
                  Incoming patients are evaluated by symptom keywords, chief complaints, and age
                  vulnerability into 5 international Manchester Triage System tiers: L1 (Non-urgent),
                  L2 (Standard), L3 (Urgent), L4 (Very Urgent), and L5 (Immediate Resuscitation).
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200/60">
                <h4 className="font-bold text-purple-950 text-sm mb-1">
                  2. Predictive Transit-Time (PTT) Hospital Routing
                </h4>
                <p className="mb-2">
                  Patients are routed to the hospital with the lowest total expected time to care
                  using the predictive formula:
                </p>
                <div className="font-mono bg-white p-2 rounded border border-purple-200 text-purple-900 font-semibold text-[11px]">
                  PTT = Travel Time + Queue Wait + Deterioration Risk Factor
                </div>
                <p className="mt-2 text-[11px] text-slate-600">
                  Critical L4-L5 patients prioritize immediate trauma/ICU capability, while stable L1-L2
                  patients are load-balanced to prevent emergency department congestion.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/60">
                <h4 className="font-bold text-emerald-950 text-sm mb-1">
                  3. Dynamic APQH Priority Queues
                </h4>
                <p>
                  Hospital emergency queues are continuously re-sorted so patients do not wait in
                  static first-in-first-out lines. A deteriorating patient dynamically moves up the
                  priority ladder before permanent tissue damage occurs.
                </p>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="px-5 py-2 rounded-xl bg-tech-blue text-white text-xs font-semibold uppercase tracking-wider hover:bg-tech-blue-deep transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
