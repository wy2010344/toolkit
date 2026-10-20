/**
 * 城市地图索引。
 *
 * 底图(免 key 公开服务):
 *   ① 街道 / 交通 —— OSM 德国镜像(官方 tile.openstreetmap.org 在本机网络不可达);
 *   ② 地形 —— Esri World Terrain Base,只有高程着色与晕渲,没有路网标注;
 *   ③ 卫星影像 —— Esri World Imagery。
 * 叠加层(配置驱动,新增图层只需往 OVERLAYS 里加一项):
 *   ① 行政区域边界 —— 阿里 DataV GeoAtlas,云南取到州市一级,川黔渝粤只取省界;
 *   ② 地形晕渲 —— Esri World Hillshade,半透明叠在任意底图上;
 *   ③ 等高线 —— 300 / 500 / 1000 / 1500 / 2000 / 3000 m 间隔可多选,由 AWS Terrarium DEM 在本地用
 *      marching squares 生成(间隔越大线越粗);同时叠一层按高程分层设色的半透明填充,
 *      把两条等高线之间的区域涂成淡色块。
 *
 * 本组件由 ClimateApp 通过 next/dynamic(ssr: false) 加载,因为 Leaflet 依赖 window。
 */
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CityId } from "@/lib/climate/types";
import { cn } from "@/components/ui";
import { generateContours, generateElevationFill } from "@/lib/climate/contour";

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
 * (TCP 443 连接超时),故街道底图改用 OSM 德国镜像;地形与卫星取自 Esri 公开的 ArcGIS Online 服务。
 */
const BASEMAPS: Record<BaseKey, { label: string; url: string; attr: string; maxZoom: number }> = {
  street: {
    label: "街道 / 交通",
    url: "https://tile.openstreetmap.de/{z}/{x}/{y}.png",
    attr: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 贡献者',
    maxZoom: 19,
  },
  terrain: {
    label: "地形(高程着色)",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}",
    attr: '地形底图 &copy; <a href="https://www.esri.com/">Esri</a> World Terrain Base',
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

const HILLSHADE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}";
const HILLSHADE_ATTR = '晕渲 &copy; <a href="https://www.esri.com/">Esri</a> World Hillshade';

/** 叠加层清单:key 同时用于状态开关与图层分组。 */
type OverlayKey = "admin" | "hillshade" | "contour";
const OVERLAYS: Array<{ key: OverlayKey; label: string }> = [
  { key: "admin", label: "行政区域边界" },
  { key: "hillshade", label: "地形晕渲" },
  { key: "contour", label: "等高线" },
];

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

const CONTOUR_STYLE: L.PathOptions = {
  color: "#8a5a2b",
  weight: 1,
  opacity: 0.75,
  interactive: false,
};

/**
 * 各间隔的线型:间隔越大线越粗、越深,叠在一起也能看出是哪一档。
 * 同一个高程值只归给能整除它的最大间隔(由 contour.ts 决定),因此不会重复画线。
 */
const CONTOUR_STYLES: Record<number, L.PathOptions> = {
  300: { ...CONTOUR_STYLE, weight: 1, opacity: 0.5 },
  500: { ...CONTOUR_STYLE, weight: 1, opacity: 0.6 },
  1000: { ...CONTOUR_STYLE, weight: 1.4, opacity: 0.7 },
  1500: { ...CONTOUR_STYLE, weight: 1.7, opacity: 0.75 },
  2000: { ...CONTOUR_STYLE, weight: 2, opacity: 0.8 },
  3000: { ...CONTOUR_STYLE, weight: 2.4, opacity: 0.85 },
};

/** 等高线间隔(米):小间隔看局部起伏,大间隔看宏观地势;可多选。 */
const CONTOUR_INTERVALS = [300, 500, 1000, 1500, 2000, 3000] as const;
type ContourInterval = (typeof CONTOUR_INTERVALS)[number];
/** 低于这个缩放级别 DEM 太粗,等高线没有意义。 */
const CONTOUR_MIN_ZOOM = 8;
/** 分层设色填充单独占一个 pane,压在所有叠加层之下,只盖住底图。 */
const FILL_PANE = "elevFill";

type LoadState = "idle" | "loading" | "ready" | "error";

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

/** 叠加层前面的勾选框。 */
function CheckBox({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border",
        on ? "border-transparent bg-ink text-white" : "border-line-strong",
      )}
    >
      {on && (
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2.2}>
          <path d="M2.5 6.2l2.2 2.2 4.8-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
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
  const overlayRef = useRef<Record<OverlayKey, L.LayerGroup> | null>(null);
  const hillshadeRef = useRef<L.TileLayer | null>(null);
  const fittedRef = useRef(false);

  const [base, setBase] = useState<BaseKey>("street");
  const [enabled, setEnabled] = useState<Record<OverlayKey, boolean>>({
    admin: false,
    hillshade: false,
    contour: false,
  });
  const [adminState, setAdminState] = useState<LoadState>("idle");
  const [contourIntervals, setContourIntervals] = useState<ContourInterval[]>([300]);
  const [contourState, setContourState] = useState<LoadState | "zoom">("idle");

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

    // 分层设色填充要压在行政边界与等高线之下(它们同属 overlayPane,z-index 400),
    // 所以单开一个 350 的 pane,并关掉它的指针事件以免挡住下面对地图的拖拽。
    const fillPane = map.createPane(FILL_PANE);
    fillPane.style.zIndex = "350";
    fillPane.style.pointerEvents = "none";

    const layers = {} as Record<BaseKey, L.TileLayer>;
    BASE_KEYS.forEach((k) => {
      layers[k] = L.tileLayer(BASEMAPS[k].url, { attribution: BASEMAPS[k].attr, maxZoom: BASEMAPS[k].maxZoom });
    });
    baseRef.current = layers;
    layers.street.addTo(map);

    markerRef.current = L.layerGroup().addTo(map);
    overlayRef.current = {
      admin: L.layerGroup().addTo(map),
      hillshade: L.layerGroup().addTo(map),
      contour: L.layerGroup().addTo(map),
    };
    hillshadeRef.current = L.tileLayer(HILLSHADE_URL, {
      attribution: HILLSHADE_ATTR,
      opacity: 0.45,
      maxZoom: 19,
    });

    return () => {
      map.remove();
      mapRef.current = null;
      baseRef.current = null;
      markerRef.current = null;
      overlayRef.current = null;
      hillshadeRef.current = null;
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

  // ④ 行政区域边界(首次打开时才拉取,拉过就缓存)
  useEffect(() => {
    const group = overlayRef.current?.admin;
    if (!group) return;
    if (!enabled.admin) {
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
        if (cancelled || !overlayRef.current) return;
        files.forEach((fc) => L.geoJSON(fc, { style: ADMIN_STYLE, interactive: false }).addTo(overlayRef.current!.admin));
        setAdminState("ready");
      } catch {
        if (!cancelled) setAdminState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled.admin]);

  // ⑤ 地形晕渲(只是把同一份半透明瓦片叠上去,开关即挂载 / 卸载)
  useEffect(() => {
    const group = overlayRef.current?.hillshade;
    const layer = hillshadeRef.current;
    if (!group || !layer) return;
    group.clearLayers();
    if (enabled.hillshade) group.addLayer(layer);
  }, [enabled.hillshade]);

  // ⑥ 等高线(按当前视野现场生成,平移 / 缩放结束后重算)
  useEffect(() => {
    const map = mapRef.current;
    const group = overlayRef.current?.contour;
    if (!map || !group) return;
    if (!enabled.contour) {
      group.clearLayers();
      return;
    }

    let cancelled = false;
    let timer: number | undefined;

    const run = async () => {
      const z = Math.round(map.getZoom());
      if (z < CONTOUR_MIN_ZOOM) {
        group.clearLayers();
        setContourState("zoom");
        return;
      }
      setContourState("loading");
      try {
        const b = map.getBounds();
        const view = {
          bounds: { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() },
          zoom: Math.min(z, 12),
        };
        // 等高线与分层设色共用一份 DEM 栅格,并行取回;设色按选中最细的那档分色,
        // 因此色块的边界始终与最细的一圈线重合。
        const [levels, fill] = await Promise.all([
          generateContours({ ...view, intervals: contourIntervals }),
          generateElevationFill({ ...view, interval: Math.min(...contourIntervals) }),
        ]);
        if (cancelled) return;
        group.clearLayers();
        if (fill) {
          // 透明度已经烘进 PNG 的 alpha 通道,这里不再叠加 opacity。
          // imageOverlay 在「投影后的像素空间」里线性拉伸,因此与同样来自 Mercator 栅格的等高线严格对齐。
          L.imageOverlay(
            fill.dataUrl,
            [
              [fill.bounds.south, fill.bounds.west],
              [fill.bounds.north, fill.bounds.east],
            ],
            { pane: FILL_PANE, interactive: false },
          ).addTo(group);
        }
        levels.forEach((lv) => {
          // 每层合成一条 MultiPolyline(外层数组 = 多个线段),比逐段建 layer 少很多图层对象。
          // 直接用 L.polyline 而不走 GeoJSON:省去一次 [lon,lat] → [lat,lng] 的构造,类型也干净。
          const parts = lv.lines.map((line) => line.map(([lon, lat]): [number, number] => [lat, lon]));
          L.polyline(parts, CONTOUR_STYLES[lv.interval] ?? CONTOUR_STYLE).addTo(group);
        });
        setContourState("ready");
      } catch {
        if (!cancelled) setContourState("error");
      }
    };

    const onMoveEnd = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => void run(), 400);
    };

    void run();
    map.on("moveend zoomend", onMoveEnd);

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      map.off("moveend zoomend", onMoveEnd);
    };
  }, [enabled.contour, contourIntervals]);

  /** 切换叠加层;等高线关掉时顺手把状态归位(在 effect 里同步 setState 会被 lint 拦)。 */
  const toggleOverlay = (key: OverlayKey) => {
    const next = !enabled[key];
    setEnabled((s) => ({ ...s, [key]: next }));
    if (key === "contour" && !next) setContourState("idle");
  };

  /**
   * 切换某个等高线间隔(多选)。
   * 至少保留一个:一个都不选就既没有线、也没有分层设色;新增的档位按由小到大重排,
   * 让按钮高亮顺序与线宽顺序一致。
   */
  const toggleInterval = (iv: ContourInterval) => {
    setContourIntervals((prev) => {
      if (prev.includes(iv)) return prev.length > 1 ? prev.filter((v) => v !== iv) : prev;
      return CONTOUR_INTERVALS.filter((v) => v === iv || prev.includes(v));
    });
  };

  /** 叠加层右侧的状态提示。 */
  const statusOf = (key: OverlayKey): ReactNode => {
    const chip = (text: string, tone = "text-faint") => (
      <span className={cn("ml-auto text-[10px]", tone)}>{text}</span>
    );
    if (key === "admin") {
      if (adminState === "loading") return chip("加载中…");
      if (adminState === "error") return chip("失败", "text-acc-orange-fg");
    }
    if (key === "contour") {
      if (contourState === "loading") return chip("生成中…");
      if (contourState === "zoom") return chip(`需放大到 ${CONTOUR_MIN_ZOOM} 级`, "text-acc-orange-fg");
      if (contourState === "error") return chip("失败", "text-acc-orange-fg");
      if (contourState === "ready")
        return chip(contourIntervals.length === 1 ? `${contourIntervals[0]} m` : `${contourIntervals.length} 档`);
    }
    return null;
  };

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
          <div className="mt-1.5 flex flex-col gap-0.5">
            {OVERLAYS.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => toggleOverlay(o.key)}
                className="flex w-full items-center gap-2 rounded-[6px] px-1 py-1 text-left transition-colors hover:bg-surface-mute"
              >
                <CheckBox on={enabled[o.key]} />
                <span className="text-[12px] text-ink">{o.label}</span>
                {statusOf(o.key)}
              </button>
            ))}
          </div>

          {/* 等高线间隔只在图层打开时出现,不占常驻空间;可多选,6 个选项会自动换行 */}
          {enabled.contour && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-6">
              {CONTOUR_INTERVALS.map((iv) => (
                <button
                  key={iv}
                  type="button"
                  onClick={() => toggleInterval(iv)}
                  className={cn(
                    "rounded-[4px] px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                    contourIntervals.includes(iv)
                      ? "bg-ink text-white"
                      : "text-muted hover:bg-surface-mute hover:text-ink",
                  )}
                >
                  {iv} m
                </button>
              ))}
            </div>
          )}

          <p className="mt-2 text-[10px] leading-relaxed text-faint">
            底图、边界与晕渲均为免 key 公开服务;等高线按当前视野由 DEM 现场生成,可多选(间隔越大线越粗),
            设色按最细的那档分档,放大到 {CONTOUR_MIN_ZOOM} 级以上更准确。
          </p>
        </div>
      </div>
    </div>
  );
}
