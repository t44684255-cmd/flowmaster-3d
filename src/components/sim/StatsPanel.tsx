import { ChevronDown, ChevronUp, Activity } from "lucide-react";
import { compact, type SimStats } from "@/lib/simulation";

function Stat({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-sm">
        <span className={accent ? "text-primary" : "text-foreground"}>{value}</span>
        <span className="ml-1 text-[10px] text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

export function StatsPanel({
  stats,
  history,
  open,
  onToggle,
  status,
}: {
  stats: SimStats;
  history: number[];
  open: boolean;
  onToggle: () => void;
  status: string;
}) {
  const max = Math.max(1, ...history);

  return (
    <div className="pointer-events-auto absolute bottom-4 right-4 w-[19rem] max-w-[calc(100%-2rem)] rounded-lg border border-border bg-card/90 shadow-2xl backdrop-blur">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2.5"
      >
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
          <Activity className="h-4 w-4 text-primary" />
          Live statistics
        </span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase text-muted-foreground">
            {status}
          </span>
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-border p-3">
          <div>
            <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>Breach hydrograph</span>
              <span className="font-mono">{compact(stats.peakDischarge)} m³/s</span>
            </div>
            <div className="flex h-14 items-end gap-[2px]">
              {history.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-primary/70"
                  style={{ height: `${Math.max(2, (h / max) * 100)}%` }}
                />
              ))}
              {history.length === 0 && (
                <div className="w-full text-center font-mono text-[10px] text-muted-foreground">
                  awaiting run
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Stat
              label="Discharge"
              value={compact(stats.peakDischarge)}
              unit="m³/s"
              accent
            />
            <Stat label="Front velocity" value={stats.frontVelocity.toFixed(2)} unit="m/s" />
            <Stat label="Max depth" value={stats.maxDepth.toFixed(2)} unit="m" />
            <Stat label="Inundated" value={stats.inundatedArea.toFixed(2)} unit="km²" />
            <Stat label="Released" value={stats.releasedVolume.toFixed(1)} unit="Mm³" />
            <Stat label="Travel" value={stats.travelDistance.toFixed(2)} unit="km" />
            <Stat label="Froude" value={stats.froude.toFixed(2)} unit="—" />
            <Stat label="Wet cells" value={compact(stats.cellsWet, 2)} unit="cells" />
          </div>

          <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
            Arrival {stats.arrivalTime.toFixed(1)} min · Re {compact(stats.reynolds)} · crest{" "}
            {stats.crestElevation || "—"} m · values are simulated demo output
          </p>
        </div>
      )}
    </div>
  );
}
