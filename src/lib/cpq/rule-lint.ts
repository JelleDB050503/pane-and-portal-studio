import type { Catalog, Rule } from "./types";

export interface LintWarning {
  severity: "warning" | "info";
  rule_code: string | null;
  message: string;
}

const RULE_FIELDS_WITH_VALUES = ["restrict_values", "exclude_values", "requires_value"];

function condKey(r: Rule) {
  return JSON.stringify(
    [...(r.conditions ?? [])]
      .map((c) => ({ ...c, value: Array.isArray(c.value) ? [...c.value].sort() : c.value }))
      .sort((a, b) => (a.field + a.op).localeCompare(b.field + b.op)),
  );
}

/** Static checks on the rule set: overlap, incomplete definitions, unknown references. */
export function lintRules(catalog: Catalog): LintWarning[] {
  const out: LintWarning[] = [];
  const rules = catalog.rules.filter((r) => r.active);
  const valueCodes = (field: string): string[] =>
    field === "system" ? catalog.systems.map((s) => s.code) : field === "family" ? catalog.families.map((f) => f.code) : catalog.values.filter((v) => v.option_code === field).map((v) => v.code);

  // Overlapping rules: same type, same field, same conditions
  const seen = new Map<string, Rule>();
  for (const r of rules) {
    const key = `${r.rule_type}|${String(r.params["field"] ?? "")}|${condKey(r)}`;
    const prev = seen.get(key);
    if (prev) out.push({ severity: "warning", rule_code: r.code, message: `Overlapt met regel ${prev.code}: zelfde type, veld en voorwaarden.` });
    else seen.set(key, r);
  }

  for (const r of rules) {
    const field = String(r.params["field"] ?? "");
    if (RULE_FIELDS_WITH_VALUES.includes(r.rule_type)) {
      if (!field) out.push({ severity: "warning", rule_code: r.code, message: "Geen veld ingesteld." });
      const vals = Array.isArray(r.params["values"]) ? (r.params["values"] as string[]) : [];
      if (!vals.length) out.push({ severity: "warning", rule_code: r.code, message: "Geen waarden ingesteld." });
      const known = valueCodes(field);
      for (const v of vals) if (field && known.length && !known.includes(v)) out.push({ severity: "warning", rule_code: r.code, message: `Onbekende waarde "${v}" voor veld ${field}.` });
    }
    if (["restrict_values", "exclude_values", "forbid"].includes(r.rule_type) && (r.conditions ?? []).length === 0)
      out.push({ severity: "info", rule_code: r.code, message: "Regel zonder voorwaarden: geldt voor elke configuratie." });
    if (r.rule_type === "dimension_limit") {
      const p = r.params as Record<string, number | undefined>;
      if (p["min_width"] != null && p["max_width"] != null && p["min_width"] > p["max_width"]) out.push({ severity: "warning", rule_code: r.code, message: "Minimumbreedte is groter dan maximumbreedte." });
      if (p["min_height"] != null && p["max_height"] != null && p["min_height"] > p["max_height"]) out.push({ severity: "warning", rule_code: r.code, message: "Minimumhoogte is groter dan maximumhoogte." });
      if (["min_width", "max_width", "min_height", "max_height"].every((k) => p[k] == null)) out.push({ severity: "warning", rule_code: r.code, message: "Afmetingsregel zonder grenzen." });
    }
    if (r.rule_type === "surcharge" && !Number(r.params["amount"])) out.push({ severity: "warning", rule_code: r.code, message: "Toeslag zonder bedrag." });
    if (r.rule_type === "auto_include" && (!field || !r.params["value"])) out.push({ severity: "warning", rule_code: r.code, message: "Automatische opname zonder veld of waarde." });
    for (const c of r.conditions ?? []) {
      if (["eq", "neq", "in", "nin"].includes(c.op)) {
        const known = valueCodes(c.field);
        const vals = Array.isArray(c.value) ? c.value : String(c.value ?? "").split(",").map((s) => s.trim());
        for (const v of vals) if (known.length && v && !known.includes(v)) out.push({ severity: "warning", rule_code: r.code, message: `Voorwaarde verwijst naar onbekende waarde "${v}" (${c.field}).` });
      }
    }
  }

  // Incomplete coverage: active system/family combinations without dimension rule or price
  for (const s of catalog.systems.filter((x) => x.active)) {
    for (const fam of s.families) {
      const covered = rules.some(
        (r) =>
          r.rule_type === "dimension_limit" &&
          (r.conditions ?? []).some((c) => c.field === "system" && (c.op === "eq" ? c.value === s.code : c.op === "in" && (Array.isArray(c.value) ? c.value : String(c.value).split(",")).map((v) => String(v).trim()).includes(s.code))) &&
          (r.conditions ?? []).every((c) => c.field !== "family" || (c.op === "eq" ? c.value === fam : c.op === "in" ? (Array.isArray(c.value) ? c.value : String(c.value).split(",")).map((v) => String(v).trim()).includes(fam) : true)),
      );
      if (!covered) out.push({ severity: "warning", rule_code: null, message: `Geen afmetingsregel voor ${s.code} als ${fam}: wordt getoond als "Niet geconfigureerd voor productie".` });
    }
    if (!catalog.priceEntries.some((e) => e.entry_type === "base" && e.system_code === s.code)) out.push({ severity: "warning", rule_code: null, message: `Geen basisprijs voor systeem ${s.code} in het actieve prijsboek.` });
    if (!catalog.priceEntries.some((e) => e.entry_type === "matrix" && e.system_code === s.code)) out.push({ severity: "warning", rule_code: null, message: `Geen maatprijsmatrix voor systeem ${s.code}.` });
  }
  return out;
}
