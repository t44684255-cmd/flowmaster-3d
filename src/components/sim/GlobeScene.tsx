/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, MapPin, RefreshCw } from "lucide-react";
import { loadCesium } from "@/lib/cesium-loader";
import { DAM_SITE, formatLat, formatLon, landCover, type GeoPoint } from "@/lib/geo";
import {
  buildFlowNetwork,
  buildHeightField,
  lineLengthMeters,
  slopeAtEN,
  type FlowLine,
  type HeightField,
} from "@/lib/geoflow";
import type { Layers } from "./MapControls";

export interface ViewCommand {
  type: "reset" | "top" | "zoom-in" | "zoom-out" | "focus";
  n: number;
}

interface Props {
  dam: GeoPoint | null;
  selected: GeoPoint | null;
  layers: Layers;
  progress: number;
  running: boolean;
  speed: number;
  command: ViewCommand;
  onPick: (p: GeoPoint) => void;
  onUseAsDam: () => void;
  onClosePopup: () => void;
  onNetwork: (longestMeters: number) => void;
}

type Phase = "loading" | "sampling" | "ready" | "error";

export function GlobeScene(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const cesiumRef = useRef<any>(null);
  const viewerRef = useRef<any>(null);
  const fieldRef = useRef<HeightField | null>(null);
  const linesRef = useRef<FlowLine[]>([]);
  const entitiesRef = useRef<any[]>([]);
  const clockRef = useRef(0);

  const state = useRef(props);
  state.current = props;

  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState("Loading global terrain and satellite imagery…");
  const [attempt, setAttempt] = useState(0);
  const [popupVisible, setPopupVisible] = useState(false);

  const { dam, selected, layers, progress, command } = props;
  const point = selected ?? null;

  /* ---------------- viewer bootstrap ---------------- */
  useEffect(() => {
    let cancelled = false;
    let viewer: any = null;
    let handler: any = null;

    (async () => {
      try {
        setPhase("loading");
        setMessage("Loading global terrain and satellite imagery…");
        const Cesium = await loadCesium();
        if (cancelled || !hostRef.current) return;
        cesiumRef.current = Cesium;

        let terrainProvider: any;
        try {
          terrainProvider = await Cesium.createWorldTerrainAsync({
            requestVertexNormals: true,
          });
        } catch {
          terrainProvider = new Cesium.EllipsoidTerrainProvider();
        }
        if (cancelled) return;

        viewer = new Cesium.Viewer(hostRef.current, {
          terrainProvider,
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
        });
        viewerRef.current = viewer;
        viewer.scene.globe.depthTestAgainstTerrain = true;
        viewer.scene.skyAtmosphere.show = true;
        viewer.scene.globe.enableLighting = false;
        viewer.cesiumWidget.creditContainer.style.display = "none";

        // Imagery: Ion world imagery, falling back to OpenStreetMap.
        try {
          const imagery = await Cesium.IonImageryProvider.fromAssetId(3);
          if (!cancelled) {
            viewer.imageryLayers.removeAll();
            viewer.imageryLayers.addImageryProvider(imagery);
          }
        } catch {
          try {
            viewer.imageryLayers.removeAll();
            viewer.imageryLayers.addImageryProvider(
              new Cesium.OpenStreetMapImageryProvider({
                url: "https://tile.openstreetmap.org/",
              }),
            );
          } catch {
            /* keep whatever base layer exists */
          }
        }
        if (cancelled) return;

        // Click-to-sample
        handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction(async (movement: any) => {
          const ray = viewer.camera.getPickRay(movement.position);
          const cart = ray ? viewer.scene.globe.pick(ray, viewer.scene) : null;
          if (!cart) return;
          const c = Cesium.Cartographic.fromCartesian(cart);
          const lon = Cesium.Math.toDegrees(c.longitude);
          const lat = Cesium.Math.toDegrees(c.latitude);
          const f = fieldRef.current;
          let slope = 0;
          if (f) {
            const e = (lon - f.lon0) * f.mLon;
            const n = (lat - f.lat0) * f.mLat;
            if (Math.abs(e) < f.half && Math.abs(n) < f.half) slope = slopeAtEN(f, e, n);
          }
          state.current.onPick({ lon, lat, height: c.height ?? 0, slope });
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // Popup follows the picked point on screen.
        viewer.scene.postRender.addEventListener(() => {
          const el = popupRef.current;
          const p = state.current.selected;
          if (!el || !p) return;
          const pos = Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.height + 40);
          const win =
            Cesium.SceneTransforms.worldToWindowCoordinates?.(viewer.scene, pos) ??
            Cesium.SceneTransforms.wgs84ToWindowCoordinates?.(viewer.scene, pos);
          if (!win) return;
          el.style.transform = `translate(-50%, -100%) translate(${win.x}px, ${win.y - 14}px)`;
        });

        // Per-frame animation clock for the flowing water.
        viewer.clock.onTick.addEventListener(() => {
          const s = state.current;
          if (s.running) clockRef.current += 0.016 * s.speed;
        });

        flyTo(Cesium, viewer, DAM_SITE.lon, DAM_SITE.lat, DAM_SITE.height, 0);
        setPhase("ready");
      } catch (err) {
        if (cancelled) return;
        setPhase("error");
        setMessage(
          err instanceof Error ? err.message : "The map could not be loaded right now.",
        );
      }
    })();

    return () => {
      cancelled = true;
      try {
        handler?.destroy();
        viewer?.destroy();
      } catch {
        /* ignore */
      }
      viewerRef.current = null;
      fieldRef.current = null;
    };
  }, [attempt]);

  /* ---------------- terrain sampling around the dam ---------------- */
  useEffect(() => {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!Cesium || !viewer || phase === "error" || phase === "loading" || !dam) return;
    let cancelled = false;
    (async () => {
      try {
        setPhase("sampling");
        setMessage("Sampling elevation around the dam site…");
        const f = await buildHeightField(
          Cesium,
          viewer.terrainProvider,
          dam.lon,
          dam.lat,
        );
        if (cancelled) return;
        fieldRef.current = f;
        const lines = buildFlowNetwork(f);
        linesRef.current = lines;
        const longest = lines.reduce((m, l) => Math.max(m, lineLengthMeters(l, f)), 0);
        state.current.onNetwork(longest);
        drawEntities();
        setPhase("ready");
      } catch {
        if (!cancelled) setPhase("ready");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dam?.lon, dam?.lat, attempt, phase === "loading"]);

  /* ---------------- entities ---------------- */
  const drawEntities = useCallback(() => {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!Cesium || !viewer) return;
    entitiesRef.current.forEach((e) => viewer.entities.remove(e));
    entitiesRef.current = [];
    const add = (e: any) => entitiesRef.current.push(viewer.entities.add(e));

    const d = state.current.dam;
    const lines = linesRef.current;

    lines.forEach((line, i) => {
      const cartesians = line.map((v) =>
        Cesium.Cartesian3.fromDegrees(v.lon, v.lat, v.height + 6),
      );
      add({
        polyline: {
          positions: new Cesium.CallbackProperty(() => {
            if (!state.current.layers.flowLines) return [];
            const p = Math.min(1, state.current.progress * 1.35);
            const n = Math.max(2, Math.floor(cartesians.length * p));
            return cartesians.slice(0, n);
          }, false),
          width: 2.2,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.28,
            color: Cesium.Color.fromCssColorString("#2fd4ff").withAlpha(0.9),
          }),
          clampToGround: false,
        },
      });

      add({
        position: new Cesium.CallbackProperty(() => {
          const s = state.current;
          if (!s.layers.particles || s.progress <= 0) return undefined;
          const head = Math.min(1, s.progress * 1.35);
          const phase01 = (clockRef.current * 0.22 + i / lines.length) % 1;
          const t = phase01 * head;
          const idx = Math.min(cartesians.length - 1, Math.floor(t * cartesians.length));
          return cartesians[idx];
        }, false),
        point: {
          pixelSize: 7,
          color: Cesium.Color.fromCssColorString("#8bf3ff"),
          outlineColor: Cesium.Color.fromCssColorString("#0a2e3c"),
          outlineWidth: 1,
        },
      });
    });

    if (d) {
      add({
        position: Cesium.Cartesian3.fromDegrees(d.lon, d.lat, d.height),
        ellipse: {
          semiMajorAxis: new Cesium.CallbackProperty(() => {
            const s = state.current;
            if (!s.layers.reservoir) return 0.1;
            const drained = 1 - Math.min(1, s.progress * 1.1);
            return 900 * (0.35 + drained * 0.65);
          }, false),
          semiMinorAxis: new Cesium.CallbackProperty(() => {
            const s = state.current;
            if (!s.layers.reservoir) return 0.1;
            const drained = 1 - Math.min(1, s.progress * 1.1);
            return 640 * (0.35 + drained * 0.65);
          }, false),
          height: d.height + 10,
          material: Cesium.Color.fromCssColorString("#0e7f9c").withAlpha(0.55),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString("#5fd4ff").withAlpha(0.8),
        },
      });
      add({
        position: Cesium.Cartesian3.fromDegrees(d.lon, d.lat, d.height + 30),
        billboard: undefined,
        point: {
          pixelSize: 12,
          color: Cesium.Color.fromCssColorString("#ff9f43"),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: "DAM",
          font: "600 11px ui-monospace, monospace",
          fillColor: Cesium.Color.WHITE,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString("#0b1520").withAlpha(0.85),
          pixelOffset: new Cesium.Cartesian2(0, -22),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
    }
  }, []);

  useEffect(() => {
    if (phase === "ready") drawEntities();
  }, [dam, phase, drawEntities]);

  /* ---------------- popup visibility ---------------- */
  useEffect(() => {
    setPopupVisible(!!point);
  }, [point]);

  /* ---------------- camera commands ---------------- */
  useEffect(() => {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!Cesium || !viewer || command.n === 0) return;
    const target = dam ?? selected;
    switch (command.type) {
      case "reset":
        flyTo(Cesium, viewer, DAM_SITE.lon, DAM_SITE.lat, DAM_SITE.height, 1.2);
        break;
      case "top":
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            (target ?? DAM_SITE).lon,
            (target ?? DAM_SITE).lat,
            18000,
          ),
          orientation: { heading: 0, pitch: -Cesium.Math.PI_OVER_TWO, roll: 0 },
          duration: 1.2,
        });
        break;
      case "zoom-in":
        viewer.camera.zoomIn(viewer.camera.positionCartographic.height * 0.35);
        break;
      case "zoom-out":
        viewer.camera.zoomOut(viewer.camera.positionCartographic.height * 0.5);
        break;
      case "focus":
        if (target) flyTo(Cesium, viewer, target.lon, target.lat, target.height, 1.4);
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command]);

  /* ---------------- layer visibility for imagery-independent bits ---------------- */
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.scene.globe.showWaterEffect = true;
    viewer.scene.globe.material = undefined;
  }, [layers.wireframe, layers.contours]);

  const busy = phase === "loading" || phase === "sampling";

  return (
    <div className="absolute inset-0">
      <div ref={hostRef} className="h-full w-full" />

      {point && popupVisible && (
        <div
          ref={popupRef}
          className="pointer-events-auto absolute left-0 top-0 z-20 w-60 rounded-lg border border-border bg-card/95 p-3 shadow-xl backdrop-blur"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              Terrain sample
            </div>
            <button
              onClick={props.onClosePopup}
              className="text-[11px] text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <dl className="mt-2 space-y-1 font-mono text-[10.5px]">
            <Row k="Latitude" v={formatLat(point.lat)} />
            <Row k="Longitude" v={formatLon(point.lon)} />
            <Row k="Elevation" v={`${point.height.toFixed(0)} m`} />
            <Row k="Slope" v={`${point.slope.toFixed(1)}°`} />
            <Row k="Cover" v={landCover(point.height)} />
          </dl>
          <button
            onClick={props.onUseAsDam}
            className="mt-2.5 w-full rounded-md bg-primary py-1.5 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Use as dam location
          </button>
        </div>
      )}

      {busy && (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card/90 px-8 py-6 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <div className="text-sm font-medium text-foreground">
              Preparing the 3D map
            </div>
            <div className="max-w-[16rem] text-[11px] leading-relaxed text-muted-foreground">
              {message}
            </div>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-background">
          <div className="flex max-w-sm flex-col items-center gap-3 rounded-xl border border-border bg-card/90 px-8 py-7 text-center">
            <AlertTriangle className="h-6 w-6 text-amber-400" />
            <div className="text-sm font-medium text-foreground">
              The 3D map couldn&apos;t load
            </div>
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">
              {message} Check your internet connection — the globe streams satellite
              imagery and elevation data.
            </p>
            <button
              onClick={() => setAttempt((a) => a + 1)}
              className="mt-1 flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-foreground">{v}</dd>
    </div>
  );
}

function flyTo(
  Cesium: any,
  viewer: any,
  lon: number,
  lat: number,
  height: number,
  duration: number,
) {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(lon - 0.045, lat - 0.05, height + 5200),
    orientation: {
      heading: Cesium.Math.toRadians(35),
      pitch: Cesium.Math.toRadians(-32),
      roll: 0,
    },
    duration,
  });
}
