import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Header } from "@/components/sim/Header";
import { ControlPanel } from "@/components/sim/ControlPanel";
import { StatsPanel } from "@/components/sim/StatsPanel";
import { Timeline } from "@/components/sim/Timeline";
import { MapControls, type Layers } from "@/components/sim/MapControls";
import { Scene, type ViewCommand } from "@/components/sim/Scene";
import type { Marker } from "@/components/sim/DamMarker";
import { flowNetwork, heightAt } from "@/lib/terrain";
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
          "Interactive 3D dam-breach and water flow simulator: place a dam on mountainous terrain, run flood routing, and read live hydraulic statistics.",
      },
      { property: "og:title", content: "3D Water Flow Simulator" },
      {
        property: "og:description",
        content:
          "Place a dam on 3D mountainous terrain and watch simulated flood water route downhill with live hydraulic statistics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SimulatorPage,
});

const DEFAULT_DAM: Marker = { x: -14, z: -22, y: heightAt(-14, -22) };

function SimulatorPage() {
  const [params, setParams] = useState<SimParams>(DEFAULT_PARAMS);
  const [dam, setDam] = useState<Marker | null>(DEFAULT_DAM);
  const [selected, setSelected] = useState<Marker | null>(null);
  const [status, setStatus] = useState<SimStatus>("idle");
  const [minutes, setMinutes] = useState(0);
  const [speed, setSpeed] = useState<Speed>(1);
  const [statsOpen, setStatsOpen] = useState(true);
  const [nav, setNav] = useState("Simulation");
  const [history, setHistory] = useState<number[]>([]);
  const [command, setCommand] = useState<ViewCommand>({ type: "reset", n: 0 });
  const [layers, setLayers] = useState<Layers>({
    wireframe: false,
    contours: true,
    flowLines: true,
    particles: true,
    reservoir: true,
  });

  const network = useMemo(
    () => (dam ? flowNetwork(dam.x, dam.z) : []),
    [dam],
  );

  const progress = params.duration > 0 ? minutes / params.duration : 0;
  const stats = useMemo(
    () => computeStats(params, progress, dam, network),
    [params, progress, dam, network],
  );

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
        // 1 real second = 1 simulated minute at 1x
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

  const handlePick = useCallback(
    (p: Marker) => setSelected({ x: p.x, y: p.y, z: p.z }),
    [],
  );

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
          <Scene
            network={network}
            progress={progress}
            running={status === "running"}
            speed={speed}
            dam={dam}
            selected={selected}
            layers={layers}
            command={command}
            onPick={handlePick}
            onUseAsDam={useAsDam}
            onClosePopup={() => setSelected(null)}
          />

          <div className="pointer-events-none absolute inset-0">
            <MapControls
              layers={layers}
              onToggle={(k) => setLayers((l) => ({ ...l, [k]: !l[k] }))}
              onCommand={(t) => setCommand((c) => ({ type: t, n: c.n + 1 }))}
              hasDam={!!dam}
            />

            <div className="pointer-events-none absolute bottom-4 left-4 rounded-md border border-border bg-card/85 px-3 py-2 font-mono text-[10px] leading-relaxed text-muted-foreground backdrop-blur">
              <div className="text-foreground">Alpine Valley · synthetic DEM</div>
              <div>
                grid {params.resolution} m · vertical exag. 1.4× · click terrain to sample
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
