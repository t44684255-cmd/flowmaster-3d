import { Activity, Droplets, Globe2, Layers3, Save, Share2 } from "lucide-react";

const NAV = ["Simulation", "Terrain", "Hydrology", "Reports"] as const;

export function Header({
  active,
  onActive,
  status,
}: {
  active: string;
  onActive: (v: string) => void;
  status: string;
}) {
  return (
    <header className="z-30 flex h-14 shrink-0 items-center gap-4 border-b border-border bg-card/80 px-4 backdrop-blur">
      <div className="flex items-center gap-2.5">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/15 ring-1 ring-primary/40">
          <Droplets className="h-4.5 w-4.5 text-primary" />
        </div>
        <div className="leading-tight">
          <h1 className="text-sm font-semibold tracking-tight">3D Water Flow Simulator</h1>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Alpine Valley DEM · 25 m grid
          </p>
        </div>
      </div>

      <nav className="ml-4 hidden items-center gap-1 md:flex">
        {NAV.map((n) => (
          <button
            key={n}
            onClick={() => onActive(n)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              active === n
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {n}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <span className="hidden items-center gap-1.5 rounded-full border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground sm:inline-flex">
          <Activity className="h-3 w-3 text-primary" />
          {status}
        </span>
        <button className="hidden rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:text-foreground lg:block">
          <Layers3 className="h-4 w-4" />
        </button>
        <button className="hidden rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:text-foreground lg:block">
          <Globe2 className="h-4 w-4" />
        </button>
        <button className="hidden rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:text-foreground lg:block">
          <Save className="h-4 w-4" />
        </button>
        <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
          <Share2 className="h-3.5 w-3.5" />
          Export
        </button>
      </div>
    </header>
  );
}
