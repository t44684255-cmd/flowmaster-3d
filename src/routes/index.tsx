import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "@/components/sim/Header";
import { ControlPanel } from "@/components/sim/ControlPanel";
import { StatsPanel } from "@/components/sim/StatsPanel";
import { Timeline } from "@/components/sim/Timeline";
import { MapControls, type Layers } from "@/components/sim/MapControls";
import { GlobeScene, type ViewCommand } from "@/components/sim/GlobeScene";
import { DAM_SITE, type GeoPoint } from "@/lib/geo";
import {
  DEFAULT_PARAMS,
  computeStats,
  type SimParams,
  type SimStatus,
  type Speed,
} from "@/lib/simulation";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "3D Water Flow Simulator — Dam Breach & Terrain Hydrology" },
      {
        name: "description",
        content:
          "Interactive 3D dam-breach and water flow simulator on a real satellite globe: place a dam on real terrain, run flood routing, and read live hydraulic statistics.",
      },
      { property: "og:title", content: "3D Water Flow Simulator" },
      {
        property: "og:description",
        content:
          "Place a dam on real 3D terrain and watch simulated flood water route downhill with live hydraulic statistics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SimulatorPage,
});

const DEFAULT_DAM: GeoPoint = {
  lon: DAM_SITE.lon,
  lat: DAM_SITE.lat,
  height: DAM_SITE.height,
  slope: 24,
};

function SimulatorPage() {
  const [params, setParams] = useState<SimParams>(DEFAULT_PARAMS);
  const [dam, setDam] = useState<GeoPoint | null>(DEFAULT_DAM);
  const [selected, setSelected] = useState<GeoPoint | null>(null);
  const [status, setStatus] = useState<SimStatus>("idle");
  const [minutes, setMinutes] = useState(0);
  const [speed, setSpeed] = useState<Speed>(1);
  const [statsOpen, setStatsOpen] = useState(true);
  const [nav, setNav] = useState("Simulation");
  const [history, setHistory] = useState<number[]>([]);
  const [longest, setLongest] = useState(0);
  const [command, setCommand] = useState<ViewCommand>({ type: "reset", n: 0 });
  const [layers, setLayers] = useState<Layers>({
    wireframe: false,
    contours: true,
    flowLines: true,
    particles: true,
    reservoir: true,
  });

  const progress = params.duration > 0 ? minutes / params.duration : 0;
  const stats = computeStats(params, progress, dam, longest);

  // Timeline clock
  const raf = useRef<number | null>(null);
  const last = useRef(0);
  useEffect(() => {
    if (status !== "running") return;
    last.current = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - last.current, 100) / 1000;
      last.current = now;
      setMinutes((m) => {
        const next = m + dt * speed;
        if (next >= params.duration) {
          setStatus("finished");
          return params.duration;
        }
        return next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [status, speed, params.duration]);

  // Hydrograph sampling
  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => {
      setHistory((h) => [...h.slice(-59), stats.peakDischarge]);
    }, 400);
    return () => clearInterval(id);
  }, [status, stats.peakDischarge]);

  const handlePick = useCallback((p: GeoPoint) => setSelected(p), []);

  const useAsDam = useCallback(() => {
    if (!selected) return;
    setDam(selected);
    setSelected(null);
    setMinutes(0);
    setHistory([]);
    setStatus("idle");
  }, [selected]);

  const start = () => {
    if (!dam) return;
    if (status === "finished") {
      setMinutes(0);
      setHistory([]);
    }
    setStatus("running");
  };
  const reset = () => {
    setStatus("idle");
    setMinutes(0);
    setHistory([]);
  };

  const statusLabel =
    status === "running"
      ? "Running"
      : status === "paused"
        ? "Paused"
        : status === "finished"
          ? "Complete"
          : "Ready";

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      <Header active={nav} onActive={setNav} status={statusLabel} />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <ControlPanel
          params={params}
          onParams={(p) => setParams((prev) => ({ ...prev, ...p }))}
          dam={dam}
          layers={layers}
          onToggleLayer={(k) => setLayers((l) => ({ ...l, [k]: !l[k] }))}
          locked={status === "running"}
        />

        <main className="relative min-h-[55vh] flex-1">
          <GlobeScene
            dam={dam}
            selected={selected}
            layers={layers}
            progress={progress}
            running={status === "running"}
            speed={speed}
            command={command}
            onPick={handlePick}
            onUseAsDam={useAsDam}
            onClosePopup={() => setSelected(null)}
            onNetwork={setLongest}
          />

          <div className="pointer-events-none absolute inset-0 z-10">
            <MapControls
              layers={layers}
              onToggle={(k) => setLayers((l) => ({ ...l, [k]: !l[k] }))}
              onCommand={(t) => setCommand((c) => ({ type: t, n: c.n + 1 }))}
              hasDam={!!dam}
            />

            <div className="pointer-events-none absolute bottom-4 left-4 rounded-md border border-border bg-card/85 px-3 py-2 font-mono text-[10px] leading-relaxed text-muted-foreground backdrop-blur">
              <div className="text-foreground">
                {DAM_SITE.name} · {DAM_SITE.region}
              </div>
              <div>
                Cesium World Terrain · satellite imagery · click the map to sample
              </div>
            </div>

            <StatsPanel
              stats={stats}
              history={history}
              open={statsOpen}
              onToggle={() => setStatsOpen((o) => !o)}
              status={statusLabel}
            />
          </div>
        </main>
      </div>

      <Timeline
        minutes={minutes}
        duration={params.duration}
        status={status}
        speed={speed}
        onScrub={(m) => {
          setMinutes(m);
          if (status === "running") setStatus("paused");
        }}
        onSpeed={setSpeed}
        onStart={start}
        onPause={() => setStatus("paused")}
        onReset={reset}
        onStep={(dir) =>
          setMinutes((m) => Math.max(0, Math.min(params.duration, m + dir * 5)))
        }
      />
    </div>
  );
}
