import { generateBom } from "./bom";
import { evaluateConfiguration, valueLabel } from "./rules";
import type {
  Bom,
  Catalog,
  Discount,
  Evaluation,
  ItemComputation,
  ItemConfig,
  ItemPrice,
  PriceEntry,
  PriceLine,
  PriceUnit,
} from "./types";

// Deterministic price service. All amounts are handled as integer euro cents.
// Prices come only from (synthetic) price book entries — DEMO, not for sales.

export const toCents = (eur: number | string | null | undefined) => Math.round(Number(eur ?? 0) * 100);
export const fromCents = (c: number) => c / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

function unitQty(unit: PriceUnit, ev: Evaluation): { qty: number; unit: string } {
  const cfg = ev.config;
  switch (unit) {
    case "m2":
      return { qty: round3((cfg.width_mm * cfg.height_mm) / 1_000_000), unit: "m²" };
    case "m_width":
      return { qty: round3(cfg.width_mm / 1000), unit: "m" };
    case "per_section":
      return { qty: cfg.sections.length, unit: "vak" };
    default:
      return { qty: 1, unit: "st" };
  }
}

function line(code: string, label: string, category: PriceLine["category"], qty: number, unit: string, unitCents: number): PriceLine {
  return { code, label, category, quantity: qty, unit, unit_cents: unitCents, total_cents: Math.round(qty * unitCents) };
}

/** Picks the smallest matrix cell that fits width × height. */
export function findMatrixEntry(entries: PriceEntry[], system: string, width: number, height: number): PriceEntry | null {
  const candidates = entries
    .filter((e) => e.entry_type === "matrix" && e.system_code === system && (e.width_upto ?? 0) >= width && (e.height_upto ?? 0) >= height)
    .sort((a, b) => (a.width_upto ?? 0) - (b.width_upto ?? 0) || (a.height_upto ?? 0) - (b.height_upto ?? 0));
  return candidates[0] ?? null;
}

export function quantityDiscountPercent(discounts: Discount[], quantity: number): number {
  return discounts
    .filter((d) => d.active && d.discount_type === "quantity" && (d.min_quantity ?? Infinity) <= quantity)
    .reduce((max, d) => Math.max(max, Number(d.percent ?? 0)), 0);
}

export function priceItem(catalog: Catalog, ev: Evaluation, bom: Bom): ItemPrice {
  const cfg = ev.config;
  const entries = catalog.priceEntries;
  const lines: PriceLine[] = [];
  const missing: string[] = [];
  const pb = catalog.priceBook;

  if (!pb) missing.push("Geen geldig prijsboek gevonden.");

  // Base price per system
  const base = entries.find((e) => e.entry_type === "base" && e.system_code === cfg.system);
  if (base) lines.push(line(`BASE:${cfg.system}`, base.label ?? `Basisprijs ${valueLabel(catalog, "system", cfg.system)}`, "basis", 1, "st", toCents(base.amount)));
  else if (cfg.system) missing.push(`Geen basisprijs voor systeem ${cfg.system}.`);

  // Width × height matrix
  if (cfg.system && cfg.width_mm > 0 && cfg.height_mm > 0) {
    const m = findMatrixEntry(entries, cfg.system, cfg.width_mm, cfg.height_mm);
    if (m) lines.push(line(`MATRIX:${cfg.system}:${m.width_upto}x${m.height_upto}`, `Maatprijs tot ${m.width_upto} × ${m.height_upto} mm`, "matrix", 1, "st", toCents(m.amount)));
    else missing.push(`Geen matrixprijs voor ${cfg.width_mm} × ${cfg.height_mm} mm in systeem ${cfg.system}.`);
  }
  const productCents = lines.reduce((s, l) => s + l.total_cents, 0);

  // Option / attribute prices
  const optionPrice = (optionCode: string, valueCode: string, count?: number) => {
    if (count === 0) return;
    const e = entries.find((x) => x.entry_type === "option" && x.option_code === optionCode && x.value_code === valueCode && (!x.system_code || x.system_code === cfg.system));
    if (!e || Number(e.amount) === 0) return;
    const label = `${catalog.options.find((o) => o.code === optionCode)?.name_nl ?? optionCode}: ${valueLabel(catalog, optionCode, valueCode)}`;
    if (e.unit === "percent") {
      lines.push(line(`OPT:${optionCode}:${valueCode}`, `${label} (${e.amount}%)`, "optie", 1, "st", Math.round((productCents * Number(e.amount)) / 100)));
    } else if (e.unit === "per_section") {
      lines.push(line(`OPT:${optionCode}:${valueCode}`, label, "optie", count ?? cfg.sections.length, "vak", toCents(e.amount)));
    } else {
      const u = unitQty(e.unit, ev);
      lines.push(line(`OPT:${optionCode}:${valueCode}`, label, "optie", round3(u.qty * (count ?? 1)), u.unit, toCents(e.amount)));
    }
  };
  const openingCounts = new Map<string, number>();
  for (const s of cfg.sections) if (s.opening) openingCounts.set(s.opening, (openingCounts.get(s.opening) ?? 0) + 1);
  for (const [opening, count] of openingCounts) optionPrice("opening", opening, count);
  for (const [code, value] of Object.entries(cfg.values)) if (value) optionPrice(code, value, code === "beslag" ? cfg.sections.filter((s) => s.opening && s.opening !== "vast").length : undefined);

  // Components priced through the BOM
  for (const node of bom.manufacturing) {
    for (const l of node.lines) {
      const e = entries.find((x) => x.entry_type === "component" && x.component_code === l.component_code);
      if (e) lines.push(line(`COMP:${l.component_code}`, e.label ?? l.description, "component", l.qty_per_piece, l.unit, toCents(e.amount)));
    }
  }

  // Conditional surcharges (rules)
  const subtotalBeforeSurcharge = lines.reduce((s, l) => s + l.total_cents, 0);
  for (const r of ev.surcharges) {
    const unit = String(r.params["unit"] ?? "piece") as PriceUnit;
    const amount = Number(r.params["amount"] ?? 0);
    const label = String(r.params["label"] ?? r.name);
    if (!amount) continue;
    if (unit === "percent") lines.push(line(`RULE:${r.code}`, `${label} (${amount}%)`, "toeslag", 1, "st", Math.round((subtotalBeforeSurcharge * amount) / 100)));
    else {
      const u = unitQty(unit, ev);
      lines.push(line(`RULE:${r.code}`, label, "toeslag", u.qty, u.unit, toCents(amount)));
    }
  }

  // Labour
  for (const e of entries.filter((x) => x.entry_type === "labour" && (!x.system_code || x.system_code === cfg.system))) {
    const u = unitQty(e.unit, ev);
    lines.push(line(`LAB:${e.value_code ?? e.id}`, e.label ?? "Arbeid", "arbeid", u.qty, u.unit, toCents(e.amount)));
  }

  // Services
  for (const s of cfg.services) {
    const e = entries.find((x) => x.entry_type === "service" && x.value_code === s);
    if (!e) {
      missing.push(`Geen prijs voor dienst ${valueLabel(catalog, "diensten", s)}.`);
      continue;
    }
    const u = unitQty(e.unit, ev);
    lines.push(line(`SRV:${s}`, e.label ?? valueLabel(catalog, "diensten", s), "dienst", u.qty, u.unit, toCents(e.amount)));
  }

  // Customer/dealer price book factor
  let unitCents = lines.reduce((s, l) => s + l.total_cents, 0);
  if (pb && Number(pb.factor) !== 1) {
    const adj = Math.round(unitCents * (Number(pb.factor) - 1));
    lines.push(line(`PB:${pb.code}`, `Prijsboek ${pb.name} (factor ${Number(pb.factor).toFixed(2)})`, "prijsboek", 1, "st", adj));
    unitCents += adj;
  }

  const quantity = Math.max(0, cfg.quantity);
  const gross = unitCents * quantity;
  const qtyPct = quantityDiscountPercent(catalog.discounts, quantity);
  const qtyDisc = Math.round((gross * qtyPct) / 100);

  // Cost price (only when costs are visible for this role)
  let cost: number | null = null;
  if (catalog.costs) {
    let c = 0;
    for (const node of bom.manufacturing) for (const l of node.lines) c += Math.round((catalog.costs[l.component_code] ?? 0) * 100 * l.qty_per_piece);
    for (const l of lines) {
      if (l.category === "dienst" || l.category === "arbeid") {
        const key = l.category === "dienst" ? `DIENST:${l.code.slice(4)}` : `ARBEID:${l.code.slice(4)}`;
        c += Math.round((catalog.costs[key] ?? 0) * 100 * l.quantity);
      }
    }
    cost = c * quantity;
  }

  return {
    lines,
    unit_cents: unitCents,
    quantity,
    gross_cents: gross,
    qty_discount_percent: qtyPct,
    qty_discount_cents: qtyDisc,
    net_cents: gross - qtyDisc,
    cost_cents: cost,
    missing,
    price_book_code: pb?.code ?? null,
    price_book_version: pb?.version ?? null,
  };
}

/** Full deterministic computation for one item: rules → BOM → price. */
export function computeItem(catalog: Catalog, config: Partial<ItemConfig>): ItemComputation {
  const evaluation = evaluateConfiguration(catalog, config);
  const bom = generateBom(catalog, evaluation);
  const price = priceItem(catalog, evaluation, bom);
  if (price.missing.length) {
    for (const m of price.missing) evaluation.issues.push({ field: null, severity: "error", message: m, rule_code: "PRICE" });
    evaluation.status = "error";
    evaluation.productionReady = false;
  }
  return { evaluation, bom, price };
}
