import type { ItemConfig } from "./types";

// Data-driven 2D demo geometry (millimetres). Kept separate from React so the
// same model can later be replaced by validated CAD output.

export type PartKind = "frame" | "sash" | "glass" | "mullion" | "threshold" | "shutter" | "vent";

export interface Part {
  id: string;
  kind: PartKind;
  x: number;
  y: number;
  w: number;
  h: number;
  section?: number;
}

export interface OpeningSymbol {
  section: number;
  /** polyline points in mm */
  lines: [number, number][][];
  label?: string;
  arrow?: { x1: number; y1: number; x2: number; y2: number };
}

export interface Geometry {
  width: number;
  height: number;
  /** extra height drawn above the frame (shutter box) */
  topExtra: number;
  parts: Part[];
  symbols: OpeningSymbol[];
}

/** DEMO profile depths for drawing only — not engineering values. */
const FRAME = 70;
const SASH = 60;
const MULLION = 80;
const SHUTTER_BOX = 180;
const VENT = 35;
const THRESHOLD = 30;

export function buildGeometry(cfg: ItemConfig): Geometry {
  const W = Math.max(200, cfg.width_mm || 0);
  const H = Math.max(200, cfg.height_mm || 0);
  const parts: Part[] = [];
  const symbols: OpeningSymbol[] = [];
  const hasShutter = Boolean(cfg.values?.["zonwering"] && cfg.values["zonwering"] !== "geen");
  const hasVent = Boolean(cfg.values?.["ventilatie"] && cfg.values["ventilatie"] !== "geen");
  const isDoor = cfg.family === "deur";
  const topExtra = hasShutter ? SHUTTER_BOX : 0;

  if (hasShutter) parts.push({ id: "shutter", kind: "shutter", x: 0, y: -SHUTTER_BOX, w: W, h: SHUTTER_BOX });
  parts.push({ id: "frame", kind: "frame", x: 0, y: 0, w: W, h: H });

  const innerTop = FRAME + (hasVent ? VENT : 0);
  const innerBottom = isDoor ? THRESHOLD : FRAME;
  if (hasVent) parts.push({ id: "vent", kind: "vent", x: FRAME, y: FRAME, w: W - 2 * FRAME, h: VENT });
  if (isDoor) parts.push({ id: "threshold", kind: "threshold", x: 0, y: H - THRESHOLD, w: W, h: THRESHOLD });

  const n = Math.max(1, cfg.sections?.length || 1);
  const innerW = W - 2 * FRAME - (n - 1) * MULLION;
  const secW = innerW / n;
  const innerH = H - innerTop - innerBottom;

  for (let i = 0; i < n; i++) {
    const x = FRAME + i * (secW + MULLION);
    const y = innerTop;
    if (i > 0) parts.push({ id: `mullion-${i}`, kind: "mullion", x: x - MULLION, y, w: MULLION, h: innerH });
    const s = cfg.sections?.[i] ?? { opening: "vast" };
    const opening = s.opening || "vast";
    const fixed = opening === "vast";
    const sashInset = fixed ? 0 : SASH;
    if (!fixed) parts.push({ id: `sash-${i}`, kind: "sash", x, y, w: secW, h: innerH, section: i });
    const gx = x + sashInset;
    const gy = y + sashInset;
    const gw = Math.max(10, secW - 2 * sashInset);
    const gh = Math.max(10, innerH - 2 * sashInset);
    parts.push({ id: `glass-${i}`, kind: "glass", x: gx, y: gy, w: gw, h: gh, section: i });

    const sym: OpeningSymbol = { section: i, lines: [] };
    const left = gx;
    const right = gx + gw;
    const top = gy;
    const bottom = gy + gh;
    const midY = gy + gh / 2;
    const midX = gx + gw / 2;
    const hingeLeft = (s.hinge ?? "links") === "links";
    const turn = (): [number, number][] =>
      hingeLeft
        ? [
            [left, top],
            [right, midY],
            [left, bottom],
          ]
        : [
            [right, top],
            [left, midY],
            [right, bottom],
          ];
    const tilt = (): [number, number][] => [
      [left, bottom],
      [midX, top],
      [right, bottom],
    ];
    if (opening === "draai" || opening === "deur_binnen" || opening === "deur_buiten") sym.lines.push(turn());
    if (opening === "kiep") sym.lines.push(tilt());
    if (opening === "draaikiep") sym.lines.push(turn(), tilt());
    if (opening === "deur_binnen") sym.label = "binnen";
    if (opening === "deur_buiten") sym.label = "buiten";
    if (opening === "schuif") {
      const dir = i === 0 ? 1 : -1;
      sym.arrow = { x1: midX - (dir * gw) / 4, y1: midY, x2: midX + (dir * gw) / 4, y2: midY };
    }
    if (fixed) sym.label = "vast";
    symbols.push(sym);
  }

  return { width: W, height: H, topExtra, parts, symbols };
}
