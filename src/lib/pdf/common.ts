import type { jsPDF } from "jspdf";
import { buildGeometry } from "@/lib/cpq/geometry";
import type { ItemConfig } from "@/lib/cpq/types";

// Browser-only PDF helpers. Loaded with dynamic import() so jsPDF never runs during SSR.

export const DEMO_BANNER = "DEMO – fictieve gegevens. Geen geldige offerte of productiedocument.";
export const SUPPLIER = { name: "Demo Schrijnwerk NV", line: "Voorbeeldstraat 1 · 9000 Gent · BE 0000.000.000 (fictief)" };

/** jsPDF's standard fonts use WinAnsi: normalise characters it cannot encode. */
export function pdfText(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/\u2212/g, "-")
    .replace(/[\u2264]/g, "<=")
    .replace(/[\u2265]/g, ">=")
    .replace(/[\u2260]/g, "!=");
}

export function eurPdf(cents: number | null | undefined): string {
  if (cents == null) return "-";
  return pdfText(new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(cents / 100));
}

export function dateNl(d: string | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("nl-BE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function demoBanner(doc: jsPDF) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(254, 243, 199);
  doc.rect(0, 0, w, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(120, 80, 0);
  doc.text(pdfText(DEMO_BANNER), w / 2, 4.6, { align: "center" });
  doc.setTextColor(20, 24, 28);
  doc.setFont("helvetica", "normal");
}

export function footer(doc: jsPDF, left: string) {
  const pages = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    demoBanner(doc);
    doc.setFontSize(7.5);
    doc.setTextColor(110, 115, 120);
    doc.text(pdfText(left), 14, h - 8);
    doc.text(`Pagina ${i} / ${pages}`, w - 14, h - 8, { align: "right" });
    doc.setTextColor(20, 24, 28);
  }
}

/** Draws the demo 2D geometry (view from inside) scaled into a box, with overall dimensions. */
export function drawItem(doc: jsPDF, cfg: ItemConfig, x: number, y: number, w: number, h: number, withDims = true) {
  const g = buildGeometry(cfg);
  const margin = withDims ? 8 : 1;
  const totalH = g.height + g.topExtra;
  const s = Math.min((w - margin * 2) / g.width, (h - margin * 2) / totalH);
  const ox = x + (w - g.width * s) / 2;
  const oy = y + (h - totalH * s) / 2 + g.topExtra * s;
  const order = ["frame", "shutter", "threshold", "sash", "glass", "vent", "mullion"];
  doc.setLineWidth(0.2);
  doc.setDrawColor(30, 41, 48);
  for (const p of [...g.parts].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))) {
    if (p.kind === "glass") doc.setFillColor(220, 236, 240);
    else if (p.kind === "shutter") doc.setFillColor(225, 225, 222);
    else if (p.kind === "vent") doc.setFillColor(210, 214, 216);
    else doc.setFillColor(255, 255, 255);
    doc.rect(ox + p.x * s, oy + p.y * s, p.w * s, p.h * s, "FD");
  }
  doc.setLineDashPattern([1, 0.8], 0);
  for (const sym of g.symbols) {
    for (const pts of sym.lines) {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]!;
        const b = pts[i]!;
        doc.line(ox + a[0] * s, oy + a[1] * s, ox + b[0] * s, oy + b[1] * s);
      }
    }
  }
  doc.setLineDashPattern([], 0);
  if (sym_arrows(g)) {
    for (const sym of g.symbols) {
      if (!sym.arrow) continue;
      const a = sym.arrow;
      doc.line(ox + a.x1 * s, oy + a.y1 * s, ox + a.x2 * s, oy + a.y2 * s);
    }
  }
  if (withDims) {
    doc.setFontSize(7);
    doc.setTextColor(60, 66, 72);
    const by = oy + g.height * s + 4;
    doc.line(ox, by, ox + g.width * s, by);
    doc.line(ox, by - 1, ox, by + 1);
    doc.line(ox + g.width * s, by - 1, ox + g.width * s, by + 1);
    doc.text(`${cfg.width_mm} mm`, ox + (g.width * s) / 2, by + 3.2, { align: "center" });
    const rx = ox + g.width * s + 4;
    doc.line(rx, oy, rx, oy + g.height * s);
    doc.line(rx - 1, oy, rx + 1, oy);
    doc.line(rx - 1, oy + g.height * s, rx + 1, oy + g.height * s);
    doc.text(`${cfg.height_mm} mm`, rx + 1.5, oy + (g.height * s) / 2, { angle: 90, align: "center" });
    doc.setTextColor(20, 24, 28);
  }
}

function sym_arrows(g: ReturnType<typeof buildGeometry>) {
  return g.symbols.some((s) => s.arrow);
}

export async function newDoc() {
  const [{ jsPDF }, autoTable] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  return { doc, autoTable: autoTable.default };
}
