// Core CPQ domain types. Pure data — no UI, no database client.
// All numbers in this module are DEMO / TEST DATA unless stated otherwise.

export type Severity = "error" | "warning";

export type ConditionOp =
  | "eq"
  | "neq"
  | "in"
  | "nin"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "eq_field"
  | "neq_field";

export interface Condition {
  field: string;
  op: ConditionOp;
  value: string | number | string[] | null;
}

export type FactValue = string | number | string[] | null | undefined;
export type Facts = Record<string, FactValue>;

export interface SectionConfig {
  opening: string;
  hinge?: string | null;
}

/** One configured position (window/door) — stored as JSON on configuration_items.data */
export interface ItemConfig {
  product_code?: string | null;
  family: string;
  material: string;
  system: string;
  width_mm: number;
  height_mm: number;
  quantity: number;
  sections: SectionConfig[];
  /** option code -> value code, for single-choice options stored generically */
  values: Record<string, string>;
  /** selected service codes (option "diensten") */
  services: string[];
  remarks: string;
  production_notes: string;
}

export interface Family {
  id: string;
  code: string;
  name_nl: string;
  name_fr: string | null;
  name_en: string | null;
  sort: number;
  active: boolean;
}

export interface Product {
  id: string;
  code: string;
  family_code: string;
  name: string;
  description: string | null;
  default_config: Partial<ItemConfig>;
  active: boolean;
}

export interface SystemDef {
  id: string;
  code: string;
  name: string;
  material: string;
  families: string[];
  description: string | null;
  production_ready: boolean;
  active: boolean;
  sort: number;
}

export interface OptionDef {
  id: string;
  code: string;
  name_nl: string;
  name_fr: string | null;
  name_en: string | null;
  step: string;
  input_type: "single" | "multi";
  required: boolean;
  families: string[] | null;
  sort: number;
  help_text: string | null;
  active: boolean;
}

export interface OptionValue {
  id: string;
  option_id: string;
  option_code: string;
  code: string;
  name_nl: string;
  name_fr: string | null;
  name_en: string | null;
  attributes: Record<string, unknown>;
  sort: number;
  active: boolean;
}

export type RuleType =
  | "dimension_limit"
  | "restrict_values"
  | "exclude_values"
  | "requires_value"
  | "forbid"
  | "auto_include"
  | "surcharge"
  | "placeholder";

export interface Rule {
  id: string;
  code: string;
  name: string;
  rule_type: RuleType;
  conditions: Condition[];
  params: Record<string, unknown>;
  message: string;
  severity: Severity;
  active: boolean;
  version: number;
}

export interface PriceBook {
  id: string;
  code: string;
  name: string;
  version: number;
  factor: number;
  valid_from: string | null;
  valid_to: string | null;
  parent_price_book_id: string | null;
  vat_default: number;
}

export type PriceEntryType = "base" | "matrix" | "option" | "service" | "labour" | "component";
export type PriceUnit = "piece" | "m2" | "m_width" | "percent" | "per_section" | "unit";

export interface PriceEntry {
  id: string;
  price_book_id: string;
  entry_type: PriceEntryType;
  system_code: string | null;
  option_code: string | null;
  value_code: string | null;
  component_code: string | null;
  width_upto: number | null;
  height_upto: number | null;
  amount: number;
  unit: PriceUnit;
  label: string | null;
}

export interface Discount {
  id: string;
  discount_type: "quantity" | "role_limit" | "margin_threshold";
  role: string | null;
  min_quantity: number | null;
  percent: number | null;
  approval_above_percent: number | null;
  label: string | null;
  active: boolean;
}

export type QtyBasis =
  | "fixed"
  | "per_piece"
  | "perimeter_m"
  | "area_m2"
  | "glass_area_m2"
  | "width_m"
  | "height_m"
  | "per_section"
  | "per_opening_section"
  | "sash_perimeter_m"
  | "mullion_m";

export interface BomTemplate {
  id: string;
  code: string;
  name: string;
  conditions: Condition[];
  geometry_ref: string | null;
  sort: number;
  active: boolean;
}

export interface BomLineDef {
  id: string;
  template_id: string;
  component_code: string;
  description: string;
  qty_basis: QtyBasis;
  qty_factor: number;
  unit: string;
  conditions: Condition[];
  geometry_ref: string | null;
  sort: number;
}

export interface Catalog {
  families: Family[];
  products: Product[];
  systems: SystemDef[];
  options: OptionDef[];
  values: OptionValue[];
  rules: Rule[];
  priceBook: PriceBook | null;
  priceEntries: PriceEntry[];
  discounts: Discount[];
  bomTemplates: BomTemplate[];
  bomLines: BomLineDef[];
  /** component_code -> unit cost. null when the current role may not see cost prices. */
  costs: Record<string, number> | null;
}

export interface Issue {
  field: string | null;
  severity: Severity;
  message: string;
  rule_code: string | null;
}

export type ItemStatus = "ok" | "warning" | "not_configured" | "error";

export interface AutoIncluded {
  value: string;
  message: string;
  rule_code: string;
}

export interface Evaluation {
  config: ItemConfig;
  facts: Facts;
  visibleOptions: OptionDef[];
  available: Record<string, string[]>;
  unavailableReasons: Record<string, Record<string, string>>;
  autoIncluded: Record<string, AutoIncluded>;
  issues: Issue[];
  notConfigured: string[];
  surcharges: Rule[];
  status: ItemStatus;
  productionReady: boolean;
}

export type PriceCategory =
  | "basis"
  | "matrix"
  | "optie"
  | "toeslag"
  | "component"
  | "dienst"
  | "arbeid"
  | "prijsboek"
  | "korting";

export interface PriceLine {
  code: string;
  label: string;
  category: PriceCategory;
  quantity: number;
  unit: string;
  unit_cents: number;
  total_cents: number;
}

export interface ItemPrice {
  /** per-piece lines */
  lines: PriceLine[];
  unit_cents: number;
  quantity: number;
  gross_cents: number;
  qty_discount_percent: number;
  qty_discount_cents: number;
  net_cents: number;
  /** null when costs are not visible to the current role */
  cost_cents: number | null;
  missing: string[];
  price_book_code: string | null;
  price_book_version: number | null;
}

export interface BomNodeLine {
  component_code: string;
  description: string;
  qty_per_piece: number;
  qty_total: number;
  unit: string;
  geometry_ref: string | null;
  unit_cost: number | null;
}

export interface BomNode {
  code: string;
  name: string;
  geometry_ref: string | null;
  lines: BomNodeLine[];
}

export interface SalesBomLine {
  label: string;
  value: string;
  geometry_ref: string | null;
}

export interface Bom {
  sales: SalesBomLine[];
  manufacturing: BomNode[];
}

export interface ItemComputation {
  evaluation: Evaluation;
  bom: Bom;
  price: ItemPrice;
}
