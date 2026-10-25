import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type * as LType from "leaflet";
import { Hospital } from "@/lib/mockData";
import { RouteEvent } from "@/hooks/useLiveGrid";
import { Compass, Layers, MapPin } from "lucide-react";

// Center strictly on Delhi, India
const DELHI: [number, number] = [28.6139, 77.2090];

// Government Hospital Icon (Blue)
const HOSPITAL_SVG_PUBLIC = `
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0050D8" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 6v4"/><path d="M14 14h-4"/><path d="M14 18h-4"/><path d="M14 8h-4"/>
  <path d="M18 12h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h2"/>
  <path d="M18 22V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v18"/>
</svg>`;

// Private Hospital Icon (Purple)
const HOSPITAL_SVG_PRIVATE = `
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 6v4"/><path d="M14 14h-4"/><path d="M14 18h-4"/><path d="M14 8h-4"/>
  <path d="M18 12h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h2"/>
  <path d="M18 22V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v18"/>
</svg>`;

// Local Community Hospital Icon (Teal/Emerald)
const HOSPITAL_SVG_LOCAL = `
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0D9488" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="4" width="18" height="16" rx="2" />
  <path d="M12 8v8"/>
  <path d="M8 12h8"/>
</svg>`;

// Ambulance Icon (Red)
const AMBULANCE_SVG = `
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E11D48" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
  <path d="M10 10H6"/><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
  <path d="M19 18h2a1 1 0 0 0 1-1v-3.28a1 1 0 0 0-.684-.948l-1.923-.641a1 1 0 0 1-.578-.502l-1.539-3.076A1 1 0 0 0 16.382 8H14"/>
  <path d="M8 8v4"/><path d="M9 18h6"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>
</svg>`;

export interface LeafletMapProps {
  hospitals: Hospital[];
  routes: RouteEvent[];
  selectedHospitalId?: string | null;
  onSelectHospital?: (hospitalId: string | null) => void;
}

export function LeafletMap({
  hospitals,
  routes,
  selectedHospitalId,
  onSelectHospital,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LType.Map | null>(null);
  const LRef = useRef<typeof LType | null>(null);
  const tileLayerRef = useRef<LType.TileLayer | null>(null);
  const hospitalLayer = useRef<LType.LayerGroup | null>(null);
  const routeLayer = useRef<LType.LayerGroup | null>(null);
  const [mapStyle, setMapStyle] = useState<"osm" | "canvas">("osm");
  const [showLegend, setShowLegend] = useState(true);

  // Initialize Delhi Leaflet Map
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      LRef.current = L;

      // Fix default Leaflet icon paths
      delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current, {
        center: DELHI,
        zoom: 11,
        minZoom: 10,
        maxZoom: 18,
        zoomControl: false,
        attributionControl: false,
      });

      // Pure OpenStreetMap (No API key required)
      const tileUrl =
        mapStyle === "canvas"
          ? "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

      const tileLayer = L.tileLayer(tileUrl, {
        maxZoom: 19,
        subdomains: ["a", "b", "c"],
      }).addTo(map);

      tileLayerRef.current = tileLayer;

      L.control.zoom({ position: "bottomright" }).addTo(map);
      hospitalLayer.current = L.layerGroup().addTo(map);
      routeLayer.current = L.layerGroup().addTo(map);
      mapRef.current = map;

      setTimeout(() => map.invalidateSize(), 150);
      paintHospitals();
      paintRoutes();
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update map style when toggled
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const tileUrl =
      mapStyle === "canvas"
        ? "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

    const newTileLayer = L.tileLayer(tileUrl, {
      maxZoom: 19,
      subdomains: ["a", "b", "c"],
    }).addTo(map);

    tileLayerRef.current = newTileLayer;
    newTileLayer.bringToBack();
  }, [mapStyle]);

  // Center on selected hospital
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedHospitalId) return;
    const target = hospitals.find((h) => h.id === selectedHospitalId);
    if (target) {
      map.flyTo([target.lat, target.lng], 13.5, { duration: 1.2 });
    }
  }, [selectedHospitalId, hospitals]);

  const paintHospitals = () => {
    const L = LRef.current;
    if (!L || !hospitalLayer.current) return;
    hospitalLayer.current.clearLayers();

    hospitals.forEach((h) => {
      const isPrivate = h.kind === "private";
      const isLocal = h.kind === "local";
      const isSelected = selectedHospitalId === h.id;

      let ring = "rgba(0,80,216,0.25)";
      let border = isSelected ? "#0050D8" : "rgba(0,80,216,0.35)";
      let tag = "Government";
      let tagBg = "#E6F0FF";
      let tagFg = "#0050D8";
      let svg = HOSPITAL_SVG_PUBLIC;

      if (isPrivate) {
        ring = "rgba(124,58,237,0.25)";
        border = isSelected ? "#7C3AED" : "rgba(124,58,237,0.4)";
        tag = "Private Super-Specialty";
        tagBg = "#F3EAFE";
        tagFg = "#6D28D9";
        svg = HOSPITAL_SVG_PRIVATE;
      } else if (isLocal) {
        ring = "rgba(13,148,136,0.25)";
        border = isSelected ? "#0D9488" : "rgba(13,148,136,0.4)";
        tag = "Local Community";
        tagBg = "#CCFBF1";
        tagFg = "#0F766E";
        svg = HOSPITAL_SVG_LOCAL;
      }

      const avail = h.availableBeds ?? Math.max(0, h.capacity - h.queue.length);
      const used = h.capacity - avail;
      const pct = Math.min(100, Math.round((used / h.capacity) * 100));
      const statusColor = pct >= 85 ? "#E11D48" : pct >= 65 ? "#D97706" : "#059669";

      const icon = L.divIcon({
        className: "pulsegrid-hospital",
        html: `
          <div style="position:relative;width:44px;height:44px;cursor:pointer;">
            <span style="position:absolute;inset:0;border-radius:50%;background:${ring};animation:pgPing 2.8s ease-out infinite;"></span>
            <div style="position:relative;display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:#ffffff;box-shadow:0 10px 24px -8px rgba(0,26,64,0.45);border:2px solid ${border};">
              ${svg}
            </div>
            <div style="position:absolute;bottom:-4px;right:-4px;width:14px;height:14px;border-radius:50%;background:${statusColor};border:2px solid #fff;"></div>
          </div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });

      const marker = L.marker([h.lat, h.lng], { icon });

      // Click to focus and select hospital
      marker.on("click", () => {
        if (onSelectHospital) {
          onSelectHospital(h.id);
        }
      });

      // Hover Tooltip with details
      marker.bindTooltip(
        `<div style="font-family:Inter,sans-serif;min-width:190px;padding:3px;">
           <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px;">
             <span style="font-size:9px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;padding:2px 7px;border-radius:999px;background:${tagBg};color:${tagFg};">${tag}</span>
             <span style="font-size:10px;font-weight:600;color:${statusColor};">${pct}% Full</span>
           </div>
           <div style="font-size:12px;font-weight:700;color:#001A40;line-height:1.25;margin-bottom:4px;">${h.name}</div>
           <div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;color:#475569;border-top:1px solid #e2e8f0;padding-top:4px;">
             <span>Available Beds: <strong style="color:#001a40;">${avail}/${h.capacity}</strong></span>
             <span>ER Wait: <strong style="color:#001a40;">~${Math.round(h.waitTimeMins ?? h.queue.length * 5)}m</strong></span>
           </div>
         </div>`,
        { direction: "top", offset: [0, -22], opacity: 1 },
      );

      hospitalLayer.current!.addLayer(marker);
    });
  };

  const paintRoutes = () => {
    const L = LRef.current;
    if (!L || !routeLayer.current) return;
    routeLayer.current.clearLayers();

    routes.forEach((r) => {
      const h = hospitals.find((x) => x.id === r.hospitalId);
      if (!h) return;

      // Polyline connecting Delhi emergency pickup to assigned hospital
      const line = L.polyline(
        [
          [r.fromLat, r.fromLng],
          [h.lat, h.lng],
        ],
        {
          color: "#0050D8",
          weight: 3,
          opacity: 0.9,
          dashArray: "7 9",
          className: "pg-route-line",
        },
      );
      routeLayer.current!.addLayer(line);

      // Pulsing animated Ambulance Icon
      const ambulanceIcon = L.divIcon({
        className: "pulsegrid-ambulance",
        html: `
          <div style="position:relative;width:34px;height:34px;cursor:pointer;">
            <span style="position:absolute;inset:0;border-radius:50%;background:rgba(225,29,72,0.24);animation:pgPing 1.8s ease-out infinite;"></span>
            <div style="position:relative;display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:#ffffff;border:1.5px solid rgba(225,29,72,0.4);box-shadow:0 8px 18px -4px rgba(225,29,72,0.5);">
              ${AMBULANCE_SVG}
            </div>
          </div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const ambMarker = L.marker([r.fromLat, r.fromLng], { icon: ambulanceIcon });
      ambMarker.bindTooltip(
        `<div style="font-family:Inter,sans-serif;padding:3px 6px;">
          <div style="font-size:11px;font-weight:700;color:#E11D48;display:flex;align-items:center;gap:4px;">
            <span>🚑 CATS / 108 AMBULANCE EN ROUTE</span>
          </div>
          <div style="font-size:10px;color:#334155;margin-top:2px;">
            Emergency Unit heading to: <strong>${h.name}</strong>
          </div>
        </div>`,
        { direction: "top", offset: [0, -18], opacity: 1 },
      );

      routeLayer.current!.addLayer(ambMarker);
    });
  };

  useEffect(() => {
    paintHospitals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hospitals, selectedHospitalId]);

  useEffect(() => {
    paintRoutes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes, hospitals]);

  const handleRecenter = () => {
    if (mapRef.current) {
      mapRef.current.flyTo(DELHI, 11, { duration: 0.8 });
    }
  };

  return (
    <div className="relative w-full h-full">
      <style>{`
        @keyframes pgPing { 0%{transform:scale(1);opacity:.75} 80%{transform:scale(2.3);opacity:0} 100%{transform:scale(2.3);opacity:0} }
        .pg-route-line { animation: pgDash 1.2s linear infinite; }
        @keyframes pgDash { to { stroke-dashoffset: -32; } }
        .leaflet-container { background: #E9F0FA; font-family: Inter, sans-serif; }
        .leaflet-tooltip { 
          background: rgba(255,255,255,0.98); 
          border: 1px solid rgba(0,80,216,0.22); 
          box-shadow: 0 10px 25px -8px rgba(0,26,64,0.35); 
          border-radius: 12px; 
          padding: 8px 12px; 
        }
        .leaflet-tooltip-top:before { display: none; }
      `}</style>

      {/* Map DOM Container */}
      <div ref={containerRef} className="absolute inset-0 z-0" />

      {/* Quick Map Controls (Top Right Overlay) */}
      <div className="absolute top-3 right-3 z-[400] flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleRecenter}
          title="Recenter on Delhi, India"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/95 hover:bg-white text-slate-700 hover:text-foreground text-[11px] font-medium border border-border shadow-sm backdrop-blur transition-all cursor-pointer"
        >
          <Compass className="w-3.5 h-3.5 text-tech-blue" />
          <span>Center Delhi (NCR)</span>
        </button>

        <button
          type="button"
          onClick={() => setMapStyle((s) => (s === "osm" ? "canvas" : "osm"))}
          title="Toggle Map Style"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/95 hover:bg-white text-slate-700 hover:text-foreground text-[11px] font-medium border border-border shadow-sm backdrop-blur transition-all cursor-pointer"
        >
          <Layers className="w-3.5 h-3.5 text-tech-blue" />
          <span>{mapStyle === "osm" ? "Street Tiles (OSM)" : "Neutral Canvas"}</span>
        </button>
      </div>

      {/* Map Legend Overlay (Bottom Left) */}
      <div className="absolute bottom-3 left-3 z-[400]">
        <div className="bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-xl p-2.5 shadow-lg max-w-[310px]">
          <div className="flex items-center justify-between gap-3 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-tech-blue" /> Delhi Medical Grid Legend
            </span>
            <button
              type="button"
              onClick={() => setShowLegend(!showLegend)}
              className="text-[9px] text-slate-600 hover:text-slate-900 uppercase font-semibold cursor-pointer"
            >
              {showLegend ? "Hide" : "Show"}
            </button>
          </div>

          {showLegend && (
            <div className="space-y-1.5 text-[11px] text-slate-700 border-t border-slate-100 pt-1.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0050D8] inline-block shrink-0 shadow-sm" />
                <span>Government (AIIMS, Safdarjung, RML, LNJP, GTB)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#7C3AED] inline-block shrink-0 shadow-sm" />
                <span>Private Super-Specialty (Max, Fortis, Apollo, Ganga Ram)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0D9488] inline-block shrink-0 shadow-sm" />
                <span>Local Community (DDU, Sanjay Gandhi, Bhikshu, LBS)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E11D48] inline-block shrink-0 animate-pulse" />
                <span>CATS / 108 Emergency Ambulance En Route</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-0.5 border-t-2 border-dashed border-[#0050D8] inline-block shrink-0" />
                <span>Predictive Transit Corridor</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
