import {
  Droplets,
  Gauge,
  MapPin,
  Ruler,
  CloudRain,
  Timer,
  Grid3x3,
  SlidersHorizontal,
  Waves,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DEFAULT_PARAMS, type SimParams } from "@/lib/simulation";
import { formatLat, formatLon, landCover, type GeoPoint } from "@/lib/geo";
import type { Layers } from "./MapControls";

interface FieldProps {
  icon: LucideIcon;
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

function Field({
  icon: Icon,
  label,
  unit,
  value,
  min,
  max,
  step,
  onChange,
  disabled,
}: FieldProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={disabled ? "opacity-50" : undefined}>
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <Icon className="h-3.5 w-3.5 text-primary/80" />
          {label}
        </label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
            }}
            className="w-16 rounded border border-border bg-input/40 px-1.5 py-0.5 text-right font-mono text-[11px] text-foreground outline-none focus:border-primary"
          />
          <span className="w-9 font-mono text-[10px] text-muted-foreground">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="sim-range mt-2 w-full"
        style={{ ["--pct" as string]: `${pct}%` }}
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
    >
      {label}
      <span
        className={`relative h-4 w-7 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-background transition-all ${
            checked ? "left-3.5" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

interface Props {
  params: SimParams;
  onParams: (p: Partial<SimParams>) => void;
  dam: GeoPoint | null;
  layers: Layers;
  onToggleLayer: (k: keyof Layers) => void;
  locked: boolean;
}

export function ControlPanel({
  params,
  onParams,
  dam,
  layers,
  onToggleLayer,
  locked,
}: Props) {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 overflow-y-auto border-border bg-card/70 p-4 lg:w-80 lg:border-r">
      <section>
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground">
          <MapPin className="h-4 w-4 text-primary" />
          Dam site
        </h2>
        {dam ? (
          <dl className="mt-2 space-y-1 rounded-md border border-border bg-background/40 p-2.5 font-mono text-[11px]">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Latitude</dt>
              <dd>{formatLat(dam.lat)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Longitude</dt>
              <dd>{formatLon(dam.lon)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Crest elev.</dt>
              <dd>{dam.height.toFixed(0)} m</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Slope</dt>
              <dd>{dam.slope.toFixed(1)}°</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Cover</dt>
              <dd>{landCover(dam.height)}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 rounded-md border border-dashed border-border p-3 text-[11px] leading-relaxed text-muted-foreground">
            Click anywhere on the map to sample a point, then choose{" "}
            <span className="text-foreground">Use as dam location</span>.
          </p>
        )}
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          Simulation parameters
        </h2>
        <div className="mt-3 space-y-4">
          <Field
            icon={Droplets}
            label="Reservoir volume"
            unit="Mm³"
            value={params.reservoirVolume}
            min={1}
            max={250}
            step={0.5}
            onChange={(v) => onParams({ reservoirVolume: v })}
          />
          <Field
            icon={Waves}
            label="Breach width"
            unit="m"
            value={params.breachWidth}
            min={5}
            max={400}
            step={1}
            onChange={(v) => onParams({ breachWidth: v })}
          />
          <Field
            icon={CloudRain}
            label="Rainfall"
            unit="mm/h"
            value={params.rainfall}
            min={0}
            max={120}
            step={1}
            onChange={(v) => onParams({ rainfall: v })}
          />
          <Field
            icon={Gauge}
            label="Manning n"
            unit=""
            value={params.roughness}
            min={0.012}
            max={0.12}
            step={0.001}
            onChange={(v) => onParams({ roughness: v })}
          />
          <Field
            icon={Timer}
            label="Duration"
            unit="min"
            value={params.duration}
            min={15}
            max={480}
            step={5}
            onChange={(v) => onParams({ duration: v })}
            disabled={locked}
          />
          <Field
            icon={Grid3x3}
            label="Grid resolution"
            unit="m"
            value={params.resolution}
            min={5}
            max={100}
            step={5}
            onChange={(v) => onParams({ resolution: v })}
            disabled={locked}
          />
        </div>
        <button
          onClick={() => onParams(DEFAULT_PARAMS)}
          className="mt-3 w-full rounded-md border border-border py-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Restore demo defaults
        </button>
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground">
          <Ruler className="h-4 w-4 text-primary" />
          Visualisation
        </h2>
        <div className="mt-1.5">
          <Toggle
            label="Terrain wireframe"
            checked={layers.wireframe}
            onChange={() => onToggleLayer("wireframe")}
          />
          <Toggle
            label="Elevation contours"
            checked={layers.contours}
            onChange={() => onToggleLayer("contours")}
          />
          <Toggle
            label="Flow lines"
            checked={layers.flowLines}
            onChange={() => onToggleLayer("flowLines")}
          />
          <Toggle
            label="Water particles"
            checked={layers.particles}
            onChange={() => onToggleLayer("particles")}
          />
          <Toggle
            label="Reservoir surface"
            checked={layers.reservoir}
            onChange={() => onToggleLayer("reservoir")}
          />
        </div>
      </section>
    </aside>
  );
}
