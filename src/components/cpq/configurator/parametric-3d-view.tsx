import type { ItemConfig } from "@/lib/cpq/types";
import { buildGeometry } from "@/lib/cpq/geometry";

export function Parametric3DView({ config }: { config: ItemConfig }) {
  const geometry = buildGeometry(config);
  const scale = Math.min(210 / geometry.width, 210 / geometry.height);
  return (
    <div className="relative aspect-square overflow-hidden rounded-md bg-slate-950/95" aria-label="Parametrische 3D-weergave">
      <div className="absolute inset-0 grid place-items-center [perspective:700px]">
        <div className="relative [transform:rotateX(8deg)_rotateY(-18deg)_rotateZ(1deg)] [transform-style:preserve-3d]" style={{ width: geometry.width * scale, height: geometry.height * scale }}>
          <div className="absolute inset-0 border-[10px] border-slate-300/90 bg-sky-200/50 shadow-[18px_18px_0_rgba(15,23,42,0.5)]" />
          {geometry.parts.filter((part) => part.kind === "glass").map((part) => (
            <div
              key={part.id}
              className="absolute border border-cyan-100/80 bg-cyan-200/45"
              style={{ left: part.x * scale, top: part.y * scale, width: part.w * scale, height: part.h * scale }}
            />
          ))}
          {geometry.parts.filter((part) => part.kind === "mullion").map((part) => (
            <div
              key={part.id}
              className="absolute bg-slate-400"
              style={{ left: part.x * scale, top: part.y * scale, width: part.w * scale, height: part.h * scale }}
            />
          ))}
        </div>
      </div>
      <div className="absolute bottom-2 left-2 rounded bg-black/45 px-2 py-1 text-[11px] text-white">
        {config.width_mm} × {config.height_mm} mm · parametrisch
      </div>
    </div>
  );
}
