import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Patient, Hospital } from "@/lib/mockData";
import {
  AlertCircle,
  Building2,
  Clock,
  Filter,
  Search,
  ShieldAlert,
  UserRound,
} from "lucide-react";

interface InflowColumnProps {
  patients: Patient[];
  hospitals?: Hospital[];
  selectedHospitalId?: string | null;
  onSelectHospital?: (hospitalId: string | null) => void;
}

export function triageBadgeInfo(level: number) {
  switch (level) {
    case 5:
      return {
        bg: "bg-rose-50 text-rose-700 border-rose-300",
        dot: "bg-rose-600",
        label: "L5 · Immediate (Resuscitation)",
        short: "L5 · Critical",
        barColor: "bg-rose-600",
      };
    case 4:
      return {
        bg: "bg-orange-50 text-orange-700 border-orange-300",
        dot: "bg-orange-600",
        label: "L4 · Very Urgent (<15m)",
        short: "L4 · Urgent",
        barColor: "bg-orange-500",
      };
    case 3:
      return {
        bg: "bg-amber-50 text-amber-700 border-amber-300",
        dot: "bg-amber-600",
        label: "L3 · Urgent (<30m)",
        short: "L3 · Watch",
        barColor: "bg-amber-500",
      };
    case 2:
      return {
        bg: "bg-blue-50 text-blue-700 border-blue-300",
        dot: "bg-blue-600",
        label: "L2 · Standard (<60m)",
        short: "L2 · Standard",
        barColor: "bg-blue-500",
      };
    default:
      return {
        bg: "bg-slate-50 text-slate-700 border-slate-300",
        dot: "bg-slate-500",
        label: "L1 · Non-Urgent (<120m)",
        short: "L1 · Routine",
        barColor: "bg-slate-400",
      };
  }
}

function formatStatus(status?: string) {
  if (!status) return { label: "Intake Recorded", icon: "📋", color: "text-slate-600" };
  const s = status.toUpperCase();
  if (s.includes("EN_ROUTE") || s.includes("ROUTE")) {
    return { label: "En Route in Ambulance", icon: "🚑", color: "text-rose-600 font-semibold" };
  }
  if (s.includes("WAITING") || s.includes("QUEUE")) {
    return { label: "In Hospital Queue", icon: "⏳", color: "text-amber-600 font-medium" };
  }
  if (s.includes("TREATED") || s.includes("CARE")) {
    return { label: "Being Treated", icon: "🩺", color: "text-emerald-600 font-medium" };
  }
  return { label: status.replace("_", " "), icon: "🏥", color: "text-slate-600" };
}

export function InflowColumn({
  patients,
  hospitals = [],
  selectedHospitalId,
  onSelectHospital,
}: InflowColumnProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [triageFilter, setTriageFilter] = useState<"all" | "critical" | "watch" | "standard">("all");

  const hospitalMap = useMemo(() => {
    const map = new Map<string, Hospital>();
    hospitals.forEach((h) => map.set(h.id, h));
    return map;
  }, [hospitals]);

  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      // Search filter
      const matchesSearch =
        searchTerm.trim() === "" ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.symptom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.assignedHospitalId && p.assignedHospitalId.toLowerCase().includes(searchTerm.toLowerCase()));

      // Triage filter
      let matchesTriage = true;
      if (triageFilter === "critical") matchesTriage = p.triage >= 4;
      else if (triageFilter === "watch") matchesTriage = p.triage === 3;
      else if (triageFilter === "standard") matchesTriage = p.triage <= 2;

      // Hospital focus filter
      let matchesHospital = true;
      if (selectedHospitalId) {
        matchesHospital = p.assignedHospitalId === selectedHospitalId;
      }

      return matchesSearch && matchesTriage && matchesHospital;
    });
  }, [patients, searchTerm, triageFilter, selectedHospitalId]);

  return (
    <div className="flex flex-col h-full rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      {/* Header */}
      <header className="px-4 py-3 border-b border-border bg-slate-50/70">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-tech-blue/10 text-tech-blue">
              <ShieldAlert className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-display font-semibold text-sm text-foreground">
                Inflow · Incoming Patients
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Real-time patient intake, Manchester triage scoring & AI routing
              </p>
            </div>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-white border border-border tabular-nums text-foreground">
            {filteredPatients.length} active
          </span>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search patient, symptom..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-white text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-tech-blue"
            />
          </div>

          {/* Triage Pills */}
          <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-200/60 border border-slate-200 text-[10px] font-medium shrink-0">
            <button
              type="button"
              onClick={() => setTriageFilter("all")}
              className={`px-2 py-1 rounded-md transition-all ${
                triageFilter === "all"
                  ? "bg-white text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setTriageFilter("critical")}
              className={`px-2 py-1 rounded-md transition-all ${
                triageFilter === "critical"
                  ? "bg-rose-600 text-white shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Critical (L4-5)
            </button>
            <button
              type="button"
              onClick={() => setTriageFilter("watch")}
              className={`px-2 py-1 rounded-md transition-all ${
                triageFilter === "watch"
                  ? "bg-amber-500 text-white shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Watch (L3)
            </button>
            <button
              type="button"
              onClick={() => setTriageFilter("standard")}
              className={`px-2 py-1 rounded-md transition-all ${
                triageFilter === "standard"
                  ? "bg-blue-600 text-white shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Standard (L1-2)
            </button>
          </div>
        </div>

        {/* Selected Hospital Filter Tag */}
        {selectedHospitalId && (
          <div className="mt-2 flex items-center justify-between text-[11px] px-2 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-900">
            <span>
              Showing patients routed to:{" "}
              <strong>{hospitalMap.get(selectedHospitalId)?.name || selectedHospitalId}</strong>
            </span>
            <button
              type="button"
              onClick={() => onSelectHospital && onSelectHospital(null)}
              className="text-xs text-blue-700 hover:text-blue-950 font-bold underline"
            >
              Clear filter
            </button>
          </div>
        )}
      </header>

      {/* Patient Cards Stream */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        <AnimatePresence initial={false}>
          {filteredPatients.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <UserRound className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-medium">No incoming patients matching filter.</p>
              <p className="text-[11px] text-muted-foreground/80 mt-1">
                Click "Simulate Intake" above to generate a new live case.
              </p>
            </div>
          ) : (
            filteredPatients.map((p) => {
              const triage = triageBadgeInfo(p.triage);
              const status = formatStatus(p.status);
              const hospital = p.assignedHospitalId
                ? hospitalMap.get(p.assignedHospitalId)
                : null;

              return (
                <motion.article
                  key={p.id}
                  layout
                  initial={{ opacity: 0, y: -16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ type: "spring", stiffness: 350, damping: 28 }}
                  className="rounded-xl border border-slate-200/90 bg-white p-3 hover:border-tech-blue/50 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start gap-3">
                    {/* User Avatar with Triage Color Indicator */}
                    <div className="relative shrink-0">
                      <div className="grid place-items-center w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-blue-50 transition-colors">
                        <UserRound className="w-5 h-5 text-slate-700 group-hover:text-tech-blue transition-colors" />
                      </div>
                      <span
                        className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${triage.dot}`}
                      />
                    </div>

                    {/* Patient Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-semibold text-sm text-foreground truncate">
                            {p.name}
                          </span>
                          {p.age && (
                            <span className="text-xs text-muted-foreground tabular-nums">
                              ({p.age}y)
                            </span>
                          )}
                        </div>

                        {/* Triage Level Badge */}
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-semibold shrink-0 ${triage.bg}`}
                          title={`Triage Level ${p.triage}: ${triage.label}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${triage.dot}`} />
                          {triage.label}
                        </span>
                      </div>

                      {/* Primary Symptom */}
                      <div className="text-xs font-medium text-slate-800 bg-slate-50 rounded px-2 py-1 mb-2 border border-slate-100">
                        {p.symptom}
                      </div>

                      {/* Route & Hospital Destination */}
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] pt-1 border-t border-slate-100">
                        <div className="flex items-center gap-1.5 text-slate-600 truncate">
                          <Building2 className="w-3.5 h-3.5 text-tech-blue shrink-0" />
                          <span className="truncate">
                            {hospital ? (
                              <button
                                type="button"
                                onClick={() => onSelectHospital && onSelectHospital(hospital.id)}
                                className="font-medium text-slate-900 hover:text-tech-blue hover:underline text-left"
                                title="Click to view hospital capacity"
                              >
                                {hospital.name}
                              </button>
                            ) : (
                              p.assignedHospitalId || "Routing in progress…"
                            )}
                          </span>
                        </div>

                        {/* Status */}
                        <div className={`flex items-center gap-1 ${status.color}`}>
                          <span>{status.icon}</span>
                          <span className="text-[10px] uppercase tracking-wider font-semibold">
                            {status.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.article>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
