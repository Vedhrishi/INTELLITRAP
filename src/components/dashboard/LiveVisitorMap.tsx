import { useMemo, useState } from "react";
import {
  APILoadingStatus,
  APIProvider,
  Circle,
  InfoWindow,
  Map,
  Marker,
  useApiLoadingStatus,
} from "@vis.gl/react-google-maps";
import { AlertTriangle, Copy, Radio, ShieldCheck } from "lucide-react";
import { RISK_COLOR, isOnline, type RiskLevel, type Visitor } from "@/lib/tracking/dashboard-data";
import { cn } from "@/lib/utils";

const HYDERABAD = { lat: 17.385, lng: 78.4867 };
const DEFAULT_CENTER = { lat: 20.5937, lng: 78.9629 };
const MAPS_KEY = import.meta.env["VITE_GOOGLE_MAPS_KEY"] as string | undefined;

type FilterKey = "all" | "online" | "high" | "india";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "online", label: "Online Now" },
  { key: "high", label: "High Risk" },
  { key: "india", label: "India Only" },
];

const LEGEND: { level: RiskLevel; label: string }[] = [
  { level: "low", label: "Low risk" },
  { level: "medium", label: "Medium risk" },
  { level: "high", label: "High risk" },
  { level: "critical", label: "Critical risk" },
];

function riskColor(visitor: Visitor): string {
  return RISK_COLOR[(visitor.risk_level as RiskLevel) ?? "low"] ?? RISK_COLOR.low;
}

/** Circle marker drawn as an inline SVG data URI so no map ID / advanced markers are required. */
function dotIcon(color: string, size: number, opacity: number): string {
  const half = size / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${half}" cy="${half}" r="${half - 2}" fill="${color}" fill-opacity="${opacity}" stroke="rgba(0,0,0,0.45)" stroke-width="2"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function shieldIcon(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="#3b82f6" fill-opacity="0.12" stroke="#3b82f6" stroke-opacity="0.55" stroke-width="1.5"/><circle cx="18" cy="18" r="6" fill="#3b82f6" fill-opacity="0.85"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function ProtectedZone() {
  return (
    <>
      <Circle
        center={HYDERABAD}
        radius={45000}
        strokeColor="#3b82f6"
        strokeOpacity={0.5}
        strokeWeight={1.5}
        fillColor="#3b82f6"
        fillOpacity={0.08}
        clickable={false}
      />
      <Marker
        position={HYDERABAD}
        title="Hyderabad — protected zone"
        clickable={false}
        icon={{ url: shieldIcon() }}
      />
    </>
  );
}

function VisitorMarker({
  visitor,
  onSelect,
}: {
  visitor: Visitor;
  onSelect: (visitor: Visitor) => void;
}) {
  const color = riskColor(visitor);
  const online = isOnline(visitor);

  return (
    <Marker
      position={{ lat: Number(visitor.latitude), lng: Number(visitor.longitude) }}
      title={`${visitor.ip_address} · ${visitor.city ?? "Unknown"}`}
      onClick={() => onSelect(visitor)}
      zIndex={online ? 2 : 1}
      icon={{ url: dotIcon(color, online ? 20 : 14, online ? 1 : 0.5) }}
    />
  );
}

function GeoBadge({
  children,
  tone = "blue",
}: {
  children: string;
  tone?: "blue" | "red" | "amber";
}) {
  const tones = {
    blue: "border-[#3b82f6]/40 text-[#93c5fd] bg-[#3b82f6]/10",
    red: "border-red-500/40 text-red-300 bg-red-500/10",
    amber: "border-amber-500/40 text-amber-300 bg-amber-500/10",
  } as const;
  return (
    <span
      className={cn("rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase", tones[tone])}
    >
      {children}
    </span>
  );
}

function VisitorInfo({ visitor, onOpenProfile }: { visitor: Visitor; onOpenProfile: () => void }) {
  const color = riskColor(visitor);
  return (
    <div
      className="min-w-[220px] rounded-xl border border-[#334155] bg-[#1e293b] p-4"
      style={{ fontFamily: "Inter, ui-sans-serif, system-ui" }}
    >
      <p className="font-mono text-sm font-bold text-white">{visitor.ip_address}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {visitor.country_code ? <GeoBadge>{visitor.country_code}</GeoBadge> : null}
        {visitor.city ? <GeoBadge>{visitor.city.slice(0, 3).toUpperCase()}</GeoBadge> : null}
        {visitor.is_proxy ? <GeoBadge tone="red">PROXY</GeoBadge> : null}
        {visitor.is_hosting ? <GeoBadge tone="amber">DC</GeoBadge> : null}
      </div>
      <p className="mt-2 text-xs text-[#94a3b8]">
        {visitor.city ?? "Unknown"}
        {visitor.region ? `, ${visitor.region}` : ""}
      </p>
      <p className="text-xs text-[#64748b]">{visitor.isp ?? "Unknown network"}</p>
      <p className="mt-1 text-xs text-[#cbd5e1]">
        {visitor.browser ?? "Unknown"} on {visitor.os ?? "Unknown"}
      </p>
      <p className="text-xs text-[#64748b]">
        {visitor.device_type ?? "desktop"} · {visitor.page_views} pages ·{" "}
        {visitor.time_on_site_seconds ?? 0}s
      </p>
      <div className="mt-3 flex items-center gap-2">
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
          style={{ background: `${color}22`, color }}
        >
          {visitor.risk_level} {visitor.risk_score}
        </span>
        <span className="rounded border border-[#334155] px-1.5 py-0.5 text-[10px] uppercase text-[#94a3b8]">
          {visitor.access_decision ?? "granted"}
        </span>
      </div>
      <button
        type="button"
        onClick={onOpenProfile}
        className="mt-3 cursor-pointer text-xs text-[#3b82f6] hover:underline"
      >
        Click to view full profile →
      </button>
    </div>
  );
}

function Legend() {
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 rounded-xl border border-[#334155] bg-[#0f172a]/90 px-4 py-3 backdrop-blur-sm">
      <div className="space-y-1.5">
        {LEGEND.map((row) => (
          <div key={row.level} className="flex items-center gap-2 text-[11px] text-[#cbd5e1]">
            <span className="size-2.5 rounded-full" style={{ background: RISK_COLOR[row.level] }} />
            {row.label}
          </div>
        ))}
        <div className="flex items-center gap-2 text-[11px] text-[#cbd5e1]">
          <ShieldCheck className="size-3 text-[#3b82f6]" />
          Protected Zone
        </div>
      </div>
      <p className="mt-2 text-[10px] text-[#64748b]">Solid = online · Faded = session ended</p>
    </div>
  );
}

function EmptyOverlay() {
  const url = typeof window === "undefined" ? "" : window.location.origin;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
      <div className="mx-auto max-w-xs rounded-xl bg-[#0f172a]/90 p-6 text-center backdrop-blur">
        <Radio className="mx-auto size-7 animate-pulse text-[#3b82f6]" />
        <p className="mt-3 font-semibold text-white">No visitors tracked yet</p>
        <p className="mt-1 text-xs text-[#94a3b8]">
          Open your URL on your phone using mobile data.
        </p>
        <p className="text-xs text-[#64748b]">You appear on the map within seconds.</p>
        <div className="mt-3 flex items-center justify-center gap-2">
          <span className="font-mono text-xs text-[#cbd5e1]">{url}/share</span>
          <Copy className="size-3 text-[#64748b]" />
        </div>
      </div>
    </div>
  );
}

function LoadFailure() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0b1220] p-6 text-center">
      <AlertTriangle className="size-7 text-amber-400" />
      <p className="text-sm font-semibold text-white">Map could not load</p>
      <p className="max-w-sm text-xs text-[#94a3b8]">
        Google rejected the request for this key. Enable the Maps JavaScript API and add this
        site&apos;s domain to the key&apos;s HTTP referrer allowlist.
      </p>
    </div>
  );
}

function MapCanvas({
  visitors,
  onSelect,
}: {
  visitors: Visitor[];
  onSelect: (visitor: Visitor) => void;
}) {
  const status = useApiLoadingStatus();
  const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return <LoadFailure />;
  }

  return (
    <Map
      defaultCenter={DEFAULT_CENTER}
      defaultZoom={5}
      colorScheme="DARK"
      gestureHandling="greedy"
      disableDefaultUI={false}
      style={{ width: "100%", height: "100%" }}
    >
      <ProtectedZone />
      {visitors.map((visitor) => (
        <VisitorMarker key={visitor.id} visitor={visitor} onSelect={setSelectedVisitor} />
      ))}
      {selectedVisitor &&
      selectedVisitor.latitude !== null &&
      selectedVisitor.longitude !== null ? (
        <InfoWindow
          position={{
            lat: Number(selectedVisitor.latitude),
            lng: Number(selectedVisitor.longitude),
          }}
          onCloseClick={() => setSelectedVisitor(null)}
          headerDisabled
        >
          <VisitorInfo
            visitor={selectedVisitor}
            onOpenProfile={() => {
              onSelect(selectedVisitor);
              setSelectedVisitor(null);
            }}
          />
        </InfoWindow>
      ) : null}
    </Map>
  );
}

export default function LiveVisitorMap({
  visitors,
  onSelect,
  height = 420,
}: {
  visitors: Visitor[];
  onSelect: (visitor: Visitor) => void;
  height?: number;
}) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = useMemo(() => {
    const placed = visitors.filter((v) => v.latitude !== null && v.longitude !== null);
    switch (filter) {
      case "online":
        return placed.filter(isOnline);
      case "high":
        return placed.filter((v) => v.risk_level === "high" || v.risk_level === "critical");
      case "india":
        return placed.filter((v) => v.country_code === "IN");
      default:
        return placed;
    }
  }, [visitors, filter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-end gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              filter === item.key
                ? "bg-[#3b82f6] text-white"
                : "border border-[#334155] bg-[#1e293b] text-[#94a3b8] hover:text-white",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="relative overflow-hidden rounded-xl border border-border" style={{ height }}>
        {MAPS_KEY ? (
          <APIProvider apiKey={MAPS_KEY}>
            <MapCanvas visitors={filtered} onSelect={onSelect} />
          </APIProvider>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-[#0b1220] p-6 text-center">
            <ShieldCheck className="size-7 text-[#3b82f6]" />
            <p className="text-sm font-semibold text-white">Google Maps key missing</p>
            <p className="max-w-xs text-xs text-[#94a3b8]">
              Add <span className="font-mono">VITE_GOOGLE_MAPS_KEY</span> to your environment to
              render the live visitor map.
            </p>
          </div>
        )}
        <Legend />
        {filtered.length === 0 ? <EmptyOverlay /> : null}
      </div>
    </div>
  );
}
