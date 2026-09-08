import {
  Compass,
  Crosshair,
  Grid2x2,
  Minus,
  Mountain,
  Plus,
  Sparkles,
  Waves,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface Layers {
  wireframe: boolean;
  contours: boolean;
  flowLines: boolean;
  particles: boolean;
  reservoir: boolean;
}

function IconButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`grid h-9 w-9 place-items-center rounded-md border border-border transition-colors ${
        active
          ? "bg-primary/20 text-primary"
          : "bg-card/85 text-muted-foreground hover:text-foreground"
      } backdrop-blur`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function MapControls({
  layers,
  onToggle,
  onCommand,
  hasDam,
}: {
  layers: Layers;
  onToggle: (k: keyof Layers) => void;
  onCommand: (t: "reset" | "top" | "zoom-in" | "zoom-out" | "focus") => void;
  hasDam: boolean;
}) {
  return (
    <>
      <div className="pointer-events-auto absolute right-4 top-4 flex flex-col gap-1.5">
        <IconButton icon={Plus} label="Zoom in" onClick={() => onCommand("zoom-in")} />
        <IconButton icon={Minus} label="Zoom out" onClick={() => onCommand("zoom-out")} />
        <IconButton icon={Compass} label="Reset view" onClick={() => onCommand("reset")} />
        <IconButton icon={Mountain} label="Top-down view" onClick={() => onCommand("top")} />
        {hasDam && (
          <IconButton
            icon={Crosshair}
            label="Focus dam"
            onClick={() => onCommand("focus")}
          />
        )}
      </div>

      <div className="pointer-events-auto absolute left-4 top-4 flex flex-col gap-1.5">
        <IconButton
          icon={Grid2x2}
          label="Wireframe mesh"
          active={layers.wireframe}
          onClick={() => onToggle("wireframe")}
        />
        <IconButton
          icon={Mountain}
          label="Contour bands"
          active={layers.contours}
          onClick={() => onToggle("contours")}
        />
        <IconButton
          icon={Waves}
          label="Flow lines"
          active={layers.flowLines}
          onClick={() => onToggle("flowLines")}
        />
        <IconButton
          icon={Sparkles}
          label="Water particles"
          active={layers.particles}
          onClick={() => onToggle("particles")}
        />
      </div>
    </>
  );
}
