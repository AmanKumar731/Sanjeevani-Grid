import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Hospital } from "@/lib/mockData";
import {
  Building2,
  CheckCircle2,
  Clock,
  Compass,
  Info,
  Layers,
  Sparkles,
  Users,
} from "lucide-react";
import { triageBadgeInfo } from "./InflowColumn";

interface OutflowColumnProps {
  hospitals: Hospital[];
  selectedHospitalId?: string | null;
  onSelectHospital?: (hospitalId: string | null) => void;
}

function HospitalCard({
  h,
  isSelected,
  onSelect,
}: {
  h: Hospital;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [showQueueDetails, setShowQueueDetails] = useState(true);

  const avail = h.availableBeds ?? Math.max(0, h.capacity - h.queue.length);
  const used = h.capacity - avail;
  const pct = Math.min(100, Math.round((used / h.capacity) * 100));
  const atCap = pct >= 90;
  const isPrivate = h.kind === "private";

  const statusTheme = atCap
    ? {
        badge: "bg-rose-100 text-rose-800 border-rose-300",
        bar: "bg-rose-600",
        label: "Critical Load",
      }
    : pct >= 65
      ? {
          badge: "bg-amber-100 text-amber-800 border-amber-300",
          bar: "bg-amber-500",
          label: "Moderate Load",
        }
      : {
          badge: "bg-emerald-100 text-emerald-800 border-emerald-300",
          bar: "bg-emerald-500",
          label: "Normal Capacity",
        };

  return (
    <div
      className={`rounded-xl border transition-all overflow-hidden bg-white shadow-sm ${
        isSelected
          ? "border-tech-blue ring-2 ring-tech-blue/20 shadow-md"
          : "border-slate-200 hover:border-slate-300 hover:shadow"
      }`}
    >
      {/* Hospital Top Bar */}
      <div className="p-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  isPrivate
                    ? "bg-purple-100 text-purple-700 border border-purple-200"
                    : h.kind === "local"
                      ? "bg-teal-100 text-teal-700 border border-teal-200"
                      : "bg-blue-100 text-blue-700 border border-blue-200"
                }`}
              >
                {isPrivate
                  ? "Private Super-Specialty"
                  : h.kind === "local"
                    ? "Local Community"
                    : "Government Academic"}
              </span>
              <span
                className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusTheme.badge}`}
              >
                {statusTheme.label}
              </span>
            </div>
            <h4 className="font-display font-semibold text-sm text-foreground leading-snug">
              {h.name}
            </h4>
          </div>

          <button
            type="button"
            onClick={onSelect}
            className={`shrink-0 p-1.5 rounded-lg border text-xs transition-colors ${
              isSelected
                ? "bg-tech-blue text-white border-tech-blue"
                : "bg-white text-slate-600 border-slate-200 hover:text-tech-blue hover:bg-blue-50"
            }`}
            title="Focus this hospital on map"
          >
            <Compass className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Capacity Bar & Numbers */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium text-slate-700 flex items-center gap-1">
              <span>Beds Available:</span>
              <strong className="text-slate-900 text-sm tabular-nums">
                {avail}
              </strong>{" "}
              <span className="text-muted-foreground text-[11px]">/ {h.capacity} total</span>
            </span>
            <span className="text-xs font-semibold tabular-nums text-slate-700">
              {pct}% occupied
            </span>
          </div>

          <div className="h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200/50">
            <motion.div
              className={`h-full rounded-full ${statusTheme.bar}`}
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
        </div>

        {/* Metrics Subrow */}
        <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-600 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-tech-blue" />
            <span>
              Queue: <strong className="text-slate-900">{h.queue.length}</strong> patients
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>
              Est. ER Wait:{" "}
              <strong className="text-slate-900">
                ~{Math.round(h.waitTimeMins ?? h.queue.length * 5)} min
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Priority Queued Patients List */}
      <div className="p-2.5 bg-slate-50/50">
        <div className="flex items-center justify-between mb-1.5 px-1">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-tech-blue" />
            <span>Dynamic Priority Queue (APQH Reordered)</span>
          </div>
          <button
            type="button"
            onClick={() => setShowQueueDetails(!showQueueDetails)}
            className="text-[10px] text-muted-foreground hover:text-foreground font-medium"
          >
            {showQueueDetails ? "Collapse" : `Expand (${h.queue.length})`}
          </button>
        </div>

        {showQueueDetails && (
          <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-0.5">
            {h.queue.length === 0 ? (
              <div className="py-4 text-center text-xs text-muted-foreground bg-white rounded-lg border border-dashed border-slate-200">
                <CheckCircle2 className="w-4 h-4 mx-auto mb-1 text-emerald-500" />
                <span>No wait list. Open beds available for direct admission.</span>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {h.queue.map((p, idx) => {
                  const triage = p.triage ? triageBadgeInfo(p.triage) : null;
                  return (
                    <motion.div
                      key={p.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200/80 hover:border-slate-300 text-xs shadow-2xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Rank Badge */}
                        <span className="grid place-items-center w-5 h-5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-700 shrink-0">
                          #{idx + 1}
                        </span>

                        <div className="truncate">
                          <span className="font-semibold text-slate-800 truncate block">
                            {p.name}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {triage && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${triage.bg}`}
                          >
                            {triage.short}
                          </span>
                        )}

                        <span
                          className="px-1.5 py-0.5 rounded bg-blue-50 text-[10px] font-bold tabular-nums text-tech-blue border border-blue-200"
                          title="Dynamic APQH Priority Score: Calculated using triage severity, wait elapsed time, and deterioration risk"
                        >
                          Score {p.score}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function OutflowColumn({
  hospitals,
  selectedHospitalId,
  onSelectHospital,
}: OutflowColumnProps) {
  const [filterMode, setFilterMode] = useState<"all" | "available" | "busy">("all");

  const filteredHospitals = useMemo(() => {
    return hospitals.filter((h) => {
      const avail = h.availableBeds ?? Math.max(0, h.capacity - h.queue.length);
      const used = h.capacity - avail;
      const pct = Math.min(100, Math.round((used / h.capacity) * 100));

      if (filterMode === "available") return pct < 70;
      if (filterMode === "busy") return pct >= 70;
      return true;
    });
  }, [hospitals, filterMode]);

  const totalBeds = useMemo(
    () => hospitals.reduce((sum, h) => sum + h.capacity, 0),
    [hospitals],
  );

  const availableBeds = useMemo(
    () =>
      hospitals.reduce(
        (sum, h) => sum + (h.availableBeds ?? Math.max(0, h.capacity - h.queue.length)),
        0,
      ),
    [hospitals],
  );

  return (
    <div className="flex flex-col h-full rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      {/* Header */}
      <header className="px-4 py-3 border-b border-border bg-slate-50/70">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-purple-100 text-purple-700">
              <Building2 className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-display font-semibold text-sm text-foreground">
                Outflow · Hospital Capacity & Priority Queues
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Live hospital bed occupancy & explainable APQH queue management
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-semibold text-slate-800">
              {availableBeds} / {totalBeds} Beds Free
            </div>
            <div className="text-[10px] text-muted-foreground">
              {Math.round(((totalBeds - availableBeds) / totalBeds) * 100)}% Network Load
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-200/60 border border-slate-200 text-[10px] font-medium">
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={`px-2 py-1 rounded-md transition-all ${
                filterMode === "all"
                  ? "bg-white text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Units ({hospitals.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("available")}
              className={`px-2 py-1 rounded-md transition-all ${
                filterMode === "available"
                  ? "bg-emerald-600 text-white shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              High Bed Availability
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("busy")}
              className={`px-2 py-1 rounded-md transition-all ${
                filterMode === "busy"
                  ? "bg-amber-600 text-white shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              High Queue Load
            </button>
          </div>

          {selectedHospitalId && (
            <button
              type="button"
              onClick={() => onSelectHospital && onSelectHospital(null)}
              className="text-[11px] text-tech-blue font-semibold hover:underline"
            >
              Reset selection
            </button>
          )}
        </div>
      </header>

      {/* Hospital Cards Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {filteredHospitals.map((h) => (
          <HospitalCard
            key={h.id}
            h={h}
            isSelected={selectedHospitalId === h.id}
            onSelect={() =>
              onSelectHospital &&
              onSelectHospital(selectedHospitalId === h.id ? null : h.id)
            }
          />
        ))}
      </div>
    </div>
  );
}
