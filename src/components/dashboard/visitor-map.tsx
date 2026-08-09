import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { RISK_COLOR, isOnline, type RiskLevel, type Visitor } from "@/lib/tracking/dashboard-data";

// Keyless raster basemap (OpenStreetMap tiles) — no API token required.
const STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#0b1220" } },
    {
      id: "osm",
      type: "raster",
      source: "osm",
      paint: { "raster-opacity": 0.55, "raster-saturation": -0.6, "raster-contrast": 0.1 },
    },
  ],
};

function markerElement(visitor: Visitor): HTMLDivElement {
  const level = (visitor.risk_level as RiskLevel) ?? "low";
  const color = RISK_COLOR[level] ?? RISK_COLOR.low;
  const online = isOnline(visitor);

  const wrapper = document.createElement("div");
  wrapper.style.position = "relative";
  wrapper.style.width = "14px";
  wrapper.style.height = "14px";
  wrapper.setAttribute("aria-label", `Visitor from ${visitor.city ?? "unknown city"}`);

  if (online) {
    const pulse = document.createElement("span");
    pulse.className = "visitor-pulse";
    pulse.style.cssText = `position:absolute;inset:0;border-radius:9999px;background:${color};`;
    wrapper.appendChild(pulse);
  }

  const dot = document.createElement("span");
  dot.style.cssText = `position:absolute;inset:3px;border-radius:9999px;background:${color};box-shadow:0 0 10px ${color};border:1px solid rgba(255,255,255,0.6);`;
  wrapper.appendChild(dot);

  return wrapper;
}

export default function VisitorMap({
  visitors,
  onSelect,
}: {
  visitors: Visitor[];
  onSelect: (visitor: Visitor) => void;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (!container.current || map.current) return;
    map.current = new maplibregl.Map({
      container: container.current,
      style: STYLE,
      center: [20, 20],
      zoom: 1.4,
      attributionControl: { compact: true },
    });
    map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    for (const marker of markers.current) marker.remove();
    markers.current = [];

    for (const visitor of visitors) {
      if (visitor.longitude === null || visitor.latitude === null) continue;
      const marker = new maplibregl.Marker({ element: markerElement(visitor) })
        .setLngLat([Number(visitor.longitude), Number(visitor.latitude)])
        .setPopup(
          new maplibregl.Popup({ offset: 14, closeButton: false }).setHTML(
            `<div style="font-family:inherit;font-size:11px;line-height:1.5">
               <strong>${visitor.city ?? "Unknown"}, ${visitor.country ?? ""}</strong><br/>
               ${visitor.ip_address}<br/>risk ${visitor.risk_score} · ${visitor.risk_level}
             </div>`,
          ),
        )
        .addTo(instance);
      marker.getElement().addEventListener("click", () => onSelect(visitor));
      markers.current.push(marker);
    }
  }, [visitors, onSelect]);

  return <div ref={container} className="h-[420px] w-full overflow-hidden rounded-xl" />;
}
