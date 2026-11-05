import type { Condition, ConditionOp, FactValue, Facts } from "./types";

// Safe, declarative condition evaluator. Never evaluates user-entered code.

export const CONDITION_OPS: { op: ConditionOp; label: string }[] = [
  { op: "eq", label: "is gelijk aan" },
  { op: "neq", label: "is niet gelijk aan" },
  { op: "in", label: "is één van" },
  { op: "nin", label: "is geen van" },
  { op: "gt", label: "groter dan" },
  { op: "gte", label: "groter of gelijk aan" },
  { op: "lt", label: "kleiner dan" },
  { op: "lte", label: "kleiner of gelijk aan" },
  { op: "eq_field", label: "is gelijk aan veld" },
  { op: "neq_field", label: "verschilt van veld" },
];

/** Facts that rules may reference. `option` = value list comes from that option code. */
export const FIELD_DEFS: { key: string; label: string; kind: "enum" | "number" | "list"; option?: string }[] = [
  { key: "family", label: "Productfamilie", kind: "enum" },
  { key: "material", label: "Materiaal", kind: "enum", option: "material" },
  { key: "system", label: "Systeem/profielreeks", kind: "enum" },
  { key: "width_mm", label: "Breedte (mm)", kind: "number" },
  { key: "height_mm", label: "Hoogte (mm)", kind: "number" },
  { key: "area_m2", label: "Oppervlakte (m²)", kind: "number" },
  { key: "perimeter_m", label: "Omtrek (m)", kind: "number" },
  { key: "quantity", label: "Aantal", kind: "number" },
  { key: "section_count", label: "Aantal vakken", kind: "number" },
  { key: "section_open_count", label: "Aantal opengaande vakken", kind: "number" },
  { key: "max_section_width_mm", label: "Breedste vak (mm)", kind: "number" },
  { key: "opening", label: "Openingswijze (een van de vakken)", kind: "list", option: "opening" },
  { key: "hinge", label: "Draairichting (een van de vakken)", kind: "list", option: "hinge" },
  { key: "kleur_binnen", label: "Kleur binnen", kind: "enum", option: "kleur_binnen" },
  { key: "kleur_buiten", label: "Kleur buiten", kind: "enum", option: "kleur_buiten" },
  { key: "glas", label: "Glasopbouw", kind: "enum", option: "glas" },
  { key: "beslag", label: "Beslag", kind: "enum", option: "beslag" },
  { key: "ventilatie", label: "Ventilatie", kind: "enum", option: "ventilatie" },
  { key: "vliegenraam", label: "Vliegenraam", kind: "enum", option: "vliegenraam" },
  { key: "zonwering", label: "Rolluik/screen", kind: "enum", option: "zonwering" },
  { key: "dorpel", label: "Dorpel", kind: "enum", option: "dorpel" },
  { key: "diensten", label: "Diensten", kind: "list", option: "diensten" },
];

export function fieldLabel(key: string | null | undefined): string {
  if (!key) return "Algemeen";
  if (key.startsWith("sections")) return "Vakken";
  return FIELD_DEFS.find((f) => f.key === key)?.label ?? key;
}

function toList(v: Condition["value"]): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (v === null || v === undefined) return [];
  return String(v)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function toNumber(v: FactValue | Condition["value"]): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

export function evalCondition(c: Condition, facts: Facts): boolean {
  const fact = facts[c.field];
  const isList = Array.isArray(fact);
  const factList = isList ? (fact as string[]).map(String) : [];
  switch (c.op) {
    case "eq":
      return isList ? factList.includes(String(c.value)) : fact != null && String(fact) === String(c.value);
    case "neq":
      return isList ? !factList.includes(String(c.value)) : fact == null || String(fact) !== String(c.value);
    case "in": {
      const set = toList(c.value);
      return isList ? factList.some((f) => set.includes(f)) : fact != null && set.includes(String(fact));
    }
    case "nin": {
      const set = toList(c.value);
      return isList ? !factList.some((f) => set.includes(f)) : fact == null || !set.includes(String(fact));
    }
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const a = toNumber(fact);
      const b = toNumber(c.value);
      if (a === null || b === null) return false;
      if (c.op === "gt") return a > b;
      if (c.op === "gte") return a >= b;
      if (c.op === "lt") return a < b;
      return a <= b;
    }
    case "eq_field":
    case "neq_field": {
      const other = facts[String(c.value)];
      if (isList || Array.isArray(other)) return false;
      const same = fact != null && other != null && String(fact) === String(other);
      return c.op === "eq_field" ? same : !same;
    }
    default:
      return false;
  }
}

export function matchesAll(conditions: Condition[] | null | undefined, facts: Facts): boolean {
  return (conditions ?? []).every((c) => evalCondition(c, facts));
}

export function describeCondition(c: Condition): string {
  const op = CONDITION_OPS.find((o) => o.op === c.op)?.label ?? c.op;
  const v = Array.isArray(c.value) ? c.value.join(", ") : String(c.value ?? "");
  const val = c.op === "eq_field" || c.op === "neq_field" ? fieldLabel(v) : v;
  return `${fieldLabel(c.field)} ${op} ${val}`;
}
