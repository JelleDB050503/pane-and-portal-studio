import { rulesVersion } from "./catalog-loader";
import { computeItem, fromCents } from "./pricing";
import { valueLabel } from "./rules";
import { variantTotals, type VariantTotals } from "./totals";
import type { AutoIncluded, Catalog, Evaluation, Issue, ItemConfig, ItemPrice, ItemStatus } from "./types";

// Immutable snapshot stored on every quote revision. Contains NO cost prices or margins
// (those live in quote_revision_costs, readable by manager/productbeheerder only).

export interface SnapshotItem {
  configuration_item_id: string;
  project_item_id: string;
  seq: number;
  label: string;
  description: string;
  config: ItemConfig;
  status: ItemStatus;
  production_ready: boolean;
  issues: Issue[];
  not_configured: string[];
  auto_included: Record<string, AutoIncluded>;
  price: Omit<ItemPrice, "cost_cents">;
}

export interface SnapshotVariant {
  configuration_id: string;
  name: string;
  is_alternative: boolean;
  items: SnapshotItem[];
  totals: Omit<VariantTotals, "cost_cents" | "margin_cents" | "margin_percent">;
}

export interface RevisionSnapshot {
  schema: 1;
  demo: true;
  generated_at: string;
  price_book: { id: string; code: string; name: string; version: number; factor: number } | null;
  rules_version: number;
  project: { id: string; number: string; name: string; street: string | null; postal_code: string | null; city: string | null };
  customer: { name: string; street: string | null; postal_code: string | null; city: string | null; vat_number: string | null; contact: string | null; email: string | null };
  template: { name: string; intro: string; conditions: string } | null;
  discount_percent: number;
  vat_rate: number;
  valid_until: string;
  variants: SnapshotVariant[];
}

export interface SnapshotInputItem {
  configuration_item_id: string;
  project_item_id: string;
  seq: number;
  label: string;
  data: Partial<ItemConfig>;
}

export interface SnapshotInput {
  catalog: Catalog;
  generatedAt: string;
  project: RevisionSnapshot["project"];
  customer: RevisionSnapshot["customer"];
  template: RevisionSnapshot["template"];
  discountPercent: number;
  vatRate: number;
  validUntil: string;
  variants: { configuration_id: string; name: string; is_alternative: boolean; items: SnapshotInputItem[] }[];
}

/** Customer-friendly description — no internal codes. */
export function describeItem(catalog: Catalog, ev: Evaluation): string {
  const c = ev.config;
  const product = catalog.products.find((p) => p.code === c.product_code)?.name ?? valueLabel(catalog, "family", c.family);
  const parts = [
    product,
    valueLabel(catalog, "material", c.material),
    `${c.width_mm} × ${c.height_mm} mm`,
    c.sections.map((s) => valueLabel(catalog, "opening", s.opening) + (s.hinge ? ` ${valueLabel(catalog, "hinge", s.hinge).toLowerCase()}` : "")).join(" + "),
    `kleur binnen ${valueLabel(catalog, "kleur_binnen", c.values["kleur_binnen"])}, buiten ${valueLabel(catalog, "kleur_buiten", c.values["kleur_buiten"])}`,
    valueLabel(catalog, "glas", c.values["glas"]),
  ];
  const extras = ["beslag", "ventilatie", "vliegenraam", "zonwering", "dorpel"]
    .filter((k) => c.values[k] && c.values[k] !== "geen" && c.values[k] !== "standaard")
    .map((k) => valueLabel(catalog, k, c.values[k]));
  if (extras.length) parts.push(extras.join(", "));
  if (c.services.length) parts.push(`diensten: ${c.services.map((s) => valueLabel(catalog, "diensten", s).toLowerCase()).join(", ")}`);
  return parts.filter(Boolean).join(" · ");
}

export function buildSnapshot(input: SnapshotInput) {
  const { catalog } = input;
  let costTotal: number | null = 0;
  let primaryTotals: VariantTotals | null = null;
  const blocking: string[] = [];
  let productionReady = true;

  const variants: SnapshotVariant[] = input.variants.map((v) => {
    const items: SnapshotItem[] = [];
    const prices: ItemPrice[] = [];
    for (const it of [...v.items].sort((a, b) => a.seq - b.seq)) {
      const comp = computeItem(catalog, it.data);
      const ev = comp.evaluation;
      if (ev.status === "error") blocking.push(`${v.name} – ${it.label}: ${ev.issues.filter((i) => i.severity === "error").map((i) => i.message).join(" ")}`);
      if (!v.is_alternative && !ev.productionReady) productionReady = false;
      prices.push(comp.price);
      const { cost_cents: _omit, ...publicPrice } = comp.price;
      items.push({
        configuration_item_id: it.configuration_item_id,
        project_item_id: it.project_item_id,
        seq: it.seq,
        label: it.label,
        description: describeItem(catalog, ev),
        config: ev.config,
        status: ev.status,
        production_ready: ev.productionReady,
        issues: ev.issues,
        not_configured: ev.notConfigured,
        auto_included: ev.autoIncluded,
        price: publicPrice,
      });
    }
    const totals = variantTotals(prices, input.discountPercent, input.vatRate);
    if (!v.is_alternative) {
      primaryTotals = totals;
      costTotal = totals.cost_cents;
    }
    const { cost_cents: _c, margin_cents: _m, margin_percent: _p, ...publicTotals } = totals;
    return { configuration_id: v.configuration_id, name: v.name, is_alternative: v.is_alternative, items, totals: publicTotals };
  });

  const pb = catalog.priceBook;
  const snapshot: RevisionSnapshot = {
    schema: 1,
    demo: true,
    generated_at: input.generatedAt,
    price_book: pb ? { id: pb.id, code: pb.code, name: pb.name, version: pb.version, factor: pb.factor } : null,
    rules_version: rulesVersion(catalog),
    project: input.project,
    customer: input.customer,
    template: input.template,
    discount_percent: input.discountPercent,
    vat_rate: input.vatRate,
    valid_until: input.validUntil,
    variants,
  };
  return { snapshot, primaryTotals: primaryTotals as VariantTotals | null, costTotalCents: costTotal as number | null, blocking, productionReady };
}

export function totalsToColumns(t: { subtotal_cents: number; discount_cents: number; net_cents: number; vat_cents: number; gross_cents: number }) {
  return {
    subtotal_net: fromCents(t.subtotal_cents),
    discount_amount: fromCents(t.discount_cents),
    total_net: fromCents(t.net_cents),
    vat_amount: fromCents(t.vat_cents),
    total_gross: fromCents(t.gross_cents),
  };
}
