import { Clock, FastForward, Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { SPEEDS, formatClock, type SimStatus, type Speed } from "@/lib/simulation";

interface Props {
  minutes: number;
  duration: number;
  status: SimStatus;
  speed: Speed;
  onScrub: (m: number) => void;
  onSpeed: (s: Speed) => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onStep: (dir: -1 | 1) => void;
}

export function Timeline({
  minutes,
  duration,
  status,
  speed,
  onScrub,
  onSpeed,
  onStart,
  onPause,
  onReset,
  onStep,
}: Props) {
  const pct = duration > 0 ? (minutes / duration) * 100 : 0;
  const running = status === "running";

  return (
    <div className="z-20 shrink-0 border-t border-border bg-card/85 px-4 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={running ? onPause : onStart}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {running ? "Pause" : status === "paused" ? "Resume" : "Start simulation"}
        </button>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onStep(-1)}
            className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"
            aria-label="Step back"
          >
            <SkipBack className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onStep(1)}
            className="grid h-8 w-8 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"
            aria-label="Step forward"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
          <FastForward className="ml-1.5 h-3.5 w-3.5 text-muted-foreground" />
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => onSpeed(s)}
              className={`rounded px-2 py-1 font-mono text-[11px] transition-colors ${
                speed === s
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 font-mono text-xs">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span className="text-foreground">{formatClock(minutes)}</span>
          <span className="text-muted-foreground">/ {formatClock(duration)}</span>
        </div>
      </div>

      <div className="mt-3">
        <input
          type="range"
          min={0}
          max={duration}
          step={0.25}
          value={minutes}
          onChange={(e) => onScrub(Number(e.target.value))}
          aria-label="Simulation timeline"
          className="sim-range w-full"
          style={{ ["--pct" as string]: `${pct}%` }}
        />
        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i}>{Math.round((duration / 6) * i)}m</span>
          ))}
        </div>
      </div>
    </div>
  );
}
