import { matchesAll } from "./conditions";
import { valueLabel } from "./rules";
import type { Bom, BomNode, Catalog, Evaluation, Facts, QtyBasis } from "./types";

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Quantity per piece for a BOM basis. Pure geometry from the configuration — DEMO formulas. */
export function qtyForBasis(basis: QtyBasis, evaluation: Evaluation): number {
  const cfg = evaluation.config;
  const w = cfg.width_mm / 1000;
  const h = cfg.height_mm / 1000;
  const n = cfg.sections.length || 1;
  const open = cfg.sections.filter((s) => s.opening && s.opening !== "vast");
  switch (basis) {
    case "fixed":
    case "per_piece":
      return 1;
    case "perimeter_m":
      return 2 * (w + h);
    case "area_m2":
      return w * h;
    case "glass_area_m2":
      // demo: visible glass ≈ 80 % of the element area
      return w * h * 0.8;
    case "width_m":
      return w;
    case "height_m":
      return h;
    case "per_section":
      return n;
    case "per_opening_section":
      return open.length;
    case "sash_perimeter_m":
      return open.length * 2 * (w / n + h);
    case "mullion_m":
      return (n - 1) * h;
    default:
      return 0;
  }
}

/** Replace {field} placeholders with fact values, e.g. PRF-{system}-KADER -> PRF-PVC-70-KADER */
export function resolveTemplate(text: string, facts: Facts): string {
  return text.replace(/\{([a-z_]+)\}/g, (_, key: string) => {
    const v = facts[key];
    return Array.isArray(v) ? v.join("+") : v == null ? "" : String(v);
  });
}

function resolveDescription(text: string, facts: Facts, catalog: Catalog): string {
  return text.replace(/\{([a-z_]+)\}/g, (_, key: string) => {
    const v = facts[key];
    if (Array.isArray(v) || v == null) return String(v ?? "");
    return valueLabel(catalog, key, String(v));
  });
}

export function generateBom(catalog: Catalog, evaluation: Evaluation): Bom {
  const facts = evaluation.facts;
  const cfg = evaluation.config;
  const qty = Math.max(1, cfg.quantity || 1);

  const manufacturing: BomNode[] = [];
  const templates = catalog.bomTemplates.filter((t) => t.active).sort((a, b) => a.sort - b.sort);
  for (const t of templates) {
    if (!matchesAll(t.conditions, facts)) continue;
    const lines = catalog.bomLines
      .filter((l) => l.template_id === t.id && matchesAll(l.conditions, facts))
      .sort((a, b) => a.sort - b.sort)
      .map((l) => {
        const per = round3(qtyForBasis(l.qty_basis, evaluation) * Number(l.qty_factor || 1));
        const code = resolveTemplate(l.component_code, facts);
        return {
          component_code: code,
          description: resolveDescription(l.description, facts, catalog),
          qty_per_piece: per,
          qty_total: round3(per * qty),
          unit: l.unit,
          geometry_ref: l.geometry_ref ?? t.geometry_ref,
          unit_cost: catalog.costs ? (catalog.costs[code] ?? null) : null,
        };
      })
      .filter((l) => l.qty_per_piece > 0);
    if (lines.length) manufacturing.push({ code: t.code, name: t.name, geometry_ref: t.geometry_ref, lines });
  }

  const sales: Bom["sales"] = [];
  const add = (label: string, value: string, geometry_ref: string | null = null) => sales.push({ label, value, geometry_ref });
  add("Productfamilie", valueLabel(catalog, "family", cfg.family));
  add("Materiaal", valueLabel(catalog, "material", cfg.material), "frame");
  add("Systeem", valueLabel(catalog, "system", cfg.system), "frame");
  add("Buitenmaat", `${cfg.width_mm} × ${cfg.height_mm} mm`, "frame");
  add(
    "Vakverdeling",
    cfg.sections
      .map((s, i) => `${i + 1}: ${valueLabel(catalog, "opening", s.opening)}${s.hinge ? ` (${valueLabel(catalog, "hinge", s.hinge)})` : ""}`)
      .join(" · "),
    "sash",
  );
  for (const o of evaluation.visibleOptions) {
    if (["material", "opening", "hinge", "diensten"].includes(o.code)) continue;
    const v = cfg.values[o.code];
    if (!v) continue;
    const ref =
      o.code === "glas" ? "glass" : o.code === "zonwering" ? "shutter" : o.code === "ventilatie" ? "vent" : o.code === "dorpel" ? "threshold" : o.code.startsWith("kleur") ? "frame" : o.code === "beslag" ? "sash" : null;
    add(o.name_nl, valueLabel(catalog, o.code, v) + (evaluation.autoIncluded[o.code] ? " (automatisch inbegrepen)" : ""), ref);
  }
  if (cfg.services.length) add("Diensten", cfg.services.map((s) => valueLabel(catalog, "diensten", s)).join(", "));
  add("Aantal", String(cfg.quantity));
  return { sales, manufacturing };
}
