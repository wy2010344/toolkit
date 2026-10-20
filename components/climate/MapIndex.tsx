/**
 * 城市地图索引。
 *
 * 底图可在「街道 / 交通」「地形 / 等高线」「卫星影像」之间切换,均为免 key、免注册的公开瓦片;
 * 并可叠加行政区域边界:云南取到州市一级,川黔渝粤只取省界,数据来自阿里 DataV GeoAtlas。
 *
 * 本组件由 ClimateApp 通过 next/dynamic(ssr: false) 加载,因为 Leaflet 依赖 window。
 */
"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CityId } from "@/lib/climate/types";
import { cn } from "@/components/ui";

/** 地图上的一枚城市点位。 */
export interface MapPoint {
  id: CityId;
  name: string;
  region: string;
  lat: number;
  lon: number;
  elevation: number;
  janMean: number;
  julMean: number;
  color: string;
}

type BaseKey = "street" | "terrain" | "satellite";

/**
 * 底图瓦片,均为免 key 公开服务。
 * 说明:OpenStreetMap 官方瓦片(tile.openstreetmap.org)与 Wikimedia、CartoCDN 在本机网络下不可达
 * (TCP 443 连接超时),故街道底图改用 OSM 德国镜像;地形与卫星底图取自 Esri 公开的
 * ArcGIS Online 服务(无需 key,直接可用),地形图自带晕渲、卫星为真彩色影像。
 */
const BASEMAPS: Record<BaseKey, { label: string; url: string; attr: string; maxZoom: number }> = {
  street: {
    label: "街道 / 交通",
    url: "https://tile.openstreetmap.de/{z}/{x}/{y}.png",
    attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 贡献者',
    maxZoom: 19,
  },
  terrain: {
    label: "地形 / 等高线",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attr: '地形底图 &copy; <a href="https://www.esri.com/">Esri</a> World Topo Map',
    maxZoom: 19,
  },
  satellite: {
    label: "卫星影像",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attr: '影像 &copy; <a href="https://www.esri.com/">Esri</a> World Imagery',
    maxZoom: 19,
  },
};
const BASE_KEYS = Object.keys(BASEMAPS) as BaseKey[];

/** 行政区域边界数据源:云南用 _full 取到州市,其余省份只要省界。 */
const ADMIN_FILES = [
  { code: "530000", full: true },
  { code: "510000", full: false },
  { code: "520000", full: false },
  { code: "500000", full: false },
  { code: "440000", full: false },
];

const ADMIN_STYLE: L.PathOptions = {
  color: "#5f7396",
  weight: 1,
  opacity: 0.8,
  fillColor: "#5f7396",
  fillOpacity: 0.05,
};

/** 用 divIcon 自绘圆点,避免 Leaflet 默认图标在打包后的路径问题。 */
function markerIcon(color: string, selected: boolean) {
  const size = selected ? 16 : 12;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html:
      `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;` +
      `background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.45)` +
      `${selected ? ",0 0 0 2px rgba(20,20,20,.6)" : ""}"></span>`,
  });
}

function popupHtml(p: MapPoint) {
  return (
    `<div style="font-size:12px;line-height:1.6">` +
    `<span style="font-weight:600">${p.name}</span>` +
    `<span style="opacity:.6"> · ${p.region}</span><br/>` +
    `海拔 ${p.elevation} m<br/>` +
    `1 月均温 ${p.janMean.toFixed(1)} ℃ · 7 月均温 ${p.julMean.toFixed(1)} ℃` +
    `</div>`
  );
}

export function MapIndex({
  points,
  selectedId,
  onSelect,
}: {
  points: MapPoint[];
  selectedId: CityId;
  onSelect: (id: CityId) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseRef = useRef<Record<BaseKey, L.TileLayer> | null>(null);
  const markerRef = useRef<L.LayerGroup | null>(null);
  const adminRef = useRef<L.LayerGroup | null>(null);
  const fittedRef = useRef(false);

  const [base, setBase] = useState<BaseKey>("street");
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminState, setAdminState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  // ① 建图(只执行一次)
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    // 必须给出初始中心与缩放:Leaflet 只有 setView 之后才会把 _loaded 置为 true,
    // 否则后续 addLayer 的 whenReady 回调永远不会执行,瓦片与标记都挂不上去。
    const map = L.map(box, {
      center: [25.5, 102.3],
      zoom: 6,
      zoomControl: true,
      attributionControl: true,
    });
    mapRef.current = map;
    const layers = {} as Record<BaseKey, L.TileLayer>;
    BASE_KEYS.forEach((k) => {
      layers[k] = L.tileLayer(BASEMAPS[k].url, { attribution: BASEMAPS[k].attr, maxZoom: BASEMAPS[k].maxZoom });
    });
    baseRef.current = layers;
    layers.street.addTo(map);
    markerRef.current = L.layerGroup().addTo(map);
    adminRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      baseRef.current = null;
      markerRef.current = null;
      adminRef.current = null;
    };
  }, []);

  // ② 底图切换
  useEffect(() => {
    const map = mapRef.current;
    const layers = baseRef.current;
    if (!map || !layers) return;
    BASE_KEYS.forEach((k) => {
      if (k !== base && map.hasLayer(layers[k])) map.removeLayer(layers[k]);
    });
    if (!map.hasLayer(layers[base])) layers[base].addTo(map);
  }, [base]);

  // ③ 点位(顺带负责首次定位视野)
  useEffect(() => {
    const group = markerRef.current;
    const map = mapRef.current;
    if (!group || !map) return;
    group.clearLayers();
    points.forEach((p) => {
      L.marker([p.lat, p.lon], { icon: markerIcon(p.color, p.id === selectedId), title: p.name })
        .bindPopup(popupHtml(p), { closeButton: false, offset: [0, -4] })
        .on("click", () => onSelect(p.id))
        .addTo(group);
    });

    if (fittedRef.current) return;
    // 等容器完成布局后再定位,避免首帧尺寸为 0。
    // 不要在 cleanup 里 cancel:StrictMode 下第一次 effect 的清理会把它取消,而第二次
    // effect 又因 fittedRef 提前返回,地图就会一直没有视野(瓦片与标记都不渲染)。
    requestAnimationFrame(() => {
      const m = mapRef.current;
      if (!m || m !== map || fittedRef.current) return; // 已重建或已定位则跳过
      fittedRef.current = true;
      m.invalidateSize();
      m.fitBounds(
        L.latLngBounds(points.map((p) => [p.lat, p.lon] as [number, number])),
        { padding: [36, 36] },
      );
    });
  }, [points, selectedId, onSelect]);

  // ④ 行政区域(首次打开时才拉取,拉过就缓存)
  useEffect(() => {
    const group = adminRef.current;
    if (!group) return;
    if (!showAdmin) {
      group.clearLayers();
      return;
    }
    if (group.getLayers().length > 0) return;

    let cancelled = false;
    setAdminState("loading");
    void (async () => {
      try {
        const files = await Promise.all(
          ADMIN_FILES.map(async (f) => {
            const url = `https://geo.datav.aliyun.com/areas_v3/bound/${f.code}${f.full ? "_full" : ""}.json`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`${f.code}: HTTP ${res.status}`);
            return (await res.json()) as Parameters<typeof L.geoJSON>[0];
          }),
        );
        if (cancelled || !adminRef.current) return;
        files.forEach((fc) => L.geoJSON(fc, { style: ADMIN_STYLE, interactive: false }).addTo(adminRef.current!));
        setAdminState("ready");
      } catch {
        if (!cancelled) setAdminState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showAdmin]);

  return (
    <div className="relative h-full w-full">
      <div ref={boxRef} className="h-full w-full" />
      <div className="pointer-events-none absolute right-3 top-3 z-[1100] w-52">
        <div className="pointer-events-auto rounded-xl border border-line bg-surface/95 p-3 shadow-sm backdrop-blur">
          <div className="text-[11px] font-medium text-ink">底图</div>
          <div className="mt-1.5 flex flex-col gap-0.5">
            {BASE_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setBase(k)}
                className={cn(
                  "rounded-[5px] px-2 py-1 text-left text-[12px] font-medium transition-colors",
                  base === k ? "bg-ink text-white" : "text-muted hover:bg-surface-mute hover:text-ink",
                )}
              >
                {BASEMAPS[k].label}
              </button>
            ))}
          </div>

          <div className="mt-3 text-[11px] font-medium text-ink">叠加</div>
          <button
            type="button"
            onClick={() => setShowAdmin((v) => !v)}
            className="mt-1.5 flex w-full items-center gap-2 rounded-[6px] px-1 py-1 text-left transition-colors hover:bg-surface-mute"
          >
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border",
                showAdmin ? "border-transparent bg-ink text-white" : "border-line-strong",
              )}
            >
              {showAdmin && (
                <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2.2}>
                  <path d="M2.5 6.2l2.2 2.2 4.8-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
            <span className="text-[12px] text-ink">行政区域边界</span>
            {adminState === "loading" && <span className="ml-auto text-[10px] text-faint">加载中…</span>}
            {adminState === "error" && <span className="ml-auto text-[10px] text-acc-orange-fg">失败</span>}
          </button>

          <p className="mt-2 text-[10px] leading-relaxed text-faint">
            底图与边界均为免 key 公开服务,地形底图自带晕渲;点击点位可在侧栏定位该城市。
          </p>
        </div>
      </div>
    </div>
  );
}
