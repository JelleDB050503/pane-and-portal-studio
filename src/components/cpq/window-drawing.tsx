import { useMemo } from "react";
import { buildGeometry, type PartKind } from "@/lib/cpq/geometry";
import type { ItemConfig } from "@/lib/cpq/types";
import { cn } from "@/lib/utils";

export const PART_LABEL: Record<PartKind, string> = {
  frame: "Kader",
  sash: "Vleugel",
  glass: "Beglazing",
  mullion: "Tussenstijl",
  threshold: "Dorpel",
  shutter: "Rolluikkast",
  vent: "Ventilatierooster",
};

interface Props {
  config: ItemConfig;
  highlight?: string | null;
  onHover?: (kind: PartKind | null) => void;
  className?: string;
  showDimensions?: boolean;
}

/** Data-driven 2D demo drawing (view from inside). Geometry comes from lib/cpq/geometry. */
export function WindowDrawing({ config, highlight, onHover, className, showDimensions = true }: Props) {
  const g = useMemo(() => buildGeometry(config), [config]);
  const size = Math.max(g.width, g.height + g.topExtra);
  const pad = size * 0.14;
  const fs = size / 28;
  const sw = size / 320;
  const vb = `${-pad} ${-pad - g.topExtra} ${g.width + pad * 2} ${g.height + g.topExtra + pad * 2}`;
  const n = Math.max(1, config.sections.length);
  const secW = config.width_mm / n;

  const isHi = (kind: PartKind) => highlight === kind;
  const fillFor = (kind: PartKind) =>
    kind === "glass" ? "var(--color-glass)" : kind === "shutter" ? "var(--color-muted)" : kind === "vent" ? "var(--color-secondary)" : "var(--color-card)";

  const ordered = [...g.parts].sort((a, b) => order(a.kind) - order(b.kind));

  return (
    <svg viewBox={vb} className={cn("h-full w-full", className)} role="img" aria-label={`Tekening ${config.width_mm} × ${config.height_mm} mm`}>
      <defs>
        <pattern id="hatch" width={size / 60} height={size / 60} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2={size / 60} stroke="var(--color-border)" strokeWidth={sw} />
        </pattern>
      </defs>
      {ordered.map((p) => (
        <rect
          key={p.id}
          x={p.x}
          y={p.y}
          width={p.w}
          height={p.h}
          fill={p.kind === "shutter" ? "url(#hatch)" : fillFor(p.kind)}
          stroke={isHi(p.kind) ? "var(--color-highlight)" : "var(--color-drawing)"}
          strokeWidth={isHi(p.kind) ? sw * 4 : sw}
          onMouseEnter={onHover ? () => onHover(p.kind) : undefined}
          onMouseLeave={onHover ? () => onHover(null) : undefined}
        >
          <title>{PART_LABEL[p.kind]}</title>
        </rect>
      ))}
      {g.symbols.map((s) => (
        <g key={s.section} pointerEvents="none">
          {s.lines.map((pts, i) => (
            <polyline
              key={i}
              points={pts.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="none"
              stroke="var(--color-drawing)"
              strokeWidth={sw}
              strokeDasharray={`${sw * 6} ${sw * 4}`}
            />
          ))}
          {s.arrow && (
            <g stroke="var(--color-drawing)" strokeWidth={sw * 2} fill="none">
              <line x1={s.arrow.x1} y1={s.arrow.y1} x2={s.arrow.x2} y2={s.arrow.y2} />
              <polyline
                points={`${s.arrow.x2 - Math.sign(s.arrow.x2 - s.arrow.x1) * fs},${s.arrow.y2 - fs / 2} ${s.arrow.x2},${s.arrow.y2} ${s.arrow.x2 - Math.sign(s.arrow.x2 - s.arrow.x1) * fs},${s.arrow.y2 + fs / 2}`}
              />
            </g>
          )}
          {s.label && (
            <text
              x={70 + s.section * secW + secW / 2 - 70 / n}
              y={g.height / 2}
              fontSize={fs * 0.8}
              textAnchor="middle"
              fill="var(--color-muted-foreground)"
              fontFamily="var(--font-mono)"
            >
              {s.label}
            </text>
          )}
        </g>
      ))}
      {showDimensions && (
        <g fontFamily="var(--font-mono)" fontSize={fs} fill="var(--color-foreground)" stroke="var(--color-muted-foreground)" strokeWidth={sw}>
          {/* overall width (bottom) */}
          <DimLine x1={0} y1={g.height + pad * 0.5} x2={g.width} y2={g.height + pad * 0.5} label={`${config.width_mm}`} fs={fs} />
          {/* overall height (right) */}
          <DimLine x1={g.width + pad * 0.5} y1={0} x2={g.width + pad * 0.5} y2={g.height} label={`${config.height_mm}`} fs={fs} vertical />
          {/* section widths (top) */}
          {n > 1 &&
            config.sections.map((_, i) => (
              <DimLine
                key={i}
                x1={i * secW}
                y1={-g.topExtra - pad * 0.45}
                x2={(i + 1) * secW}
                y2={-g.topExtra - pad * 0.45}
                label={`${Math.round(secW)}`}
                fs={fs * 0.8}
              />
            ))}
        </g>
      )}
    </svg>
  );
}

function order(kind: PartKind) {
  return ["shutter", "frame", "threshold", "vent", "mullion", "sash", "glass"].indexOf(kind);
}

function DimLine({ x1, y1, x2, y2, label, fs, vertical }: { x1: number; y1: number; x2: number; y2: number; label: string; fs: number; vertical?: boolean }) {
  const t = fs * 0.5;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      {vertical ? (
        <>
          <line x1={x1 - t} y1={y1} x2={x1 + t} y2={y1} />
          <line x1={x2 - t} y1={y2} x2={x2 + t} y2={y2} />
          <text x={x1 + fs * 0.6} y={(y1 + y2) / 2} stroke="none" dominantBaseline="middle" transform={`rotate(90 ${x1 + fs * 0.6} ${(y1 + y2) / 2})`} textAnchor="middle">
            {label}
          </text>
        </>
      ) : (
        <>
          <line x1={x1} y1={y1 - t} x2={x1} y2={y1 + t} />
          <line x1={x2} y1={y2 - t} x2={x2} y2={y2 + t} />
          <text x={(x1 + x2) / 2} y={y1 - fs * 0.4} stroke="none" textAnchor="middle">
            {label}
          </text>
        </>
      )}
    </g>
  );
}
