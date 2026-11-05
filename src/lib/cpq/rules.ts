import { matchesAll } from "./conditions";
import type {
  Catalog,
  Evaluation,
  Facts,
  Issue,
  ItemConfig,
  ItemStatus,
  OptionDef,
  Rule,
} from "./types";

/** Option codes that are stored outside `values` in the item config. */
export const SPECIAL_OPTIONS = ["material", "opening", "hinge", "diensten"] as const;

export const MAX_SECTIONS = 4;

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function emptyConfig(family = "raam"): ItemConfig {
  return {
    product_code: null,
    family,
    material: "",
    system: "",
    width_mm: 1000,
    height_mm: 1200,
    quantity: 1,
    sections: [{ opening: "", hinge: null }],
    values: {},
    services: [],
    remarks: "",
    production_notes: "",
  };
}

export function normalizeConfig(raw: Partial<ItemConfig> | null | undefined): ItemConfig {
  const base = emptyConfig(raw?.family || "raam");
  const cfg: ItemConfig = {
    ...base,
    ...(raw ?? {}),
    values: { ...(raw?.values ?? {}) },
    services: [...(raw?.services ?? [])],
    sections: (raw?.sections?.length ? raw.sections : base.sections).map((s) => ({
      opening: s?.opening ?? "",
      hinge: s?.hinge ?? null,
    })),
  };
  cfg.width_mm = Math.round(Number(cfg.width_mm) || 0);
  cfg.height_mm = Math.round(Number(cfg.height_mm) || 0);
  cfg.quantity = Math.round(Number(cfg.quantity) || 0);
  cfg.remarks = cfg.remarks ?? "";
  cfg.production_notes = cfg.production_notes ?? "";
  return cfg;
}

/** Value-attribute lookup: does this opening type need a hinge side? */
export function openingNeedsHinge(catalog: Catalog, opening: string): boolean {
  const v = catalog.values.find((x) => x.option_code === "opening" && x.code === opening);
  return Boolean(v?.attributes?.["needs_hinge"]);
}

export function buildFacts(catalog: Catalog, cfg: ItemConfig): Facts {
  const sections = cfg.sections ?? [];
  const openCount = sections.filter((s) => s.opening && s.opening !== "vast").length;
  const facts: Facts = {
    family: cfg.family,
    material: cfg.material,
    system: cfg.system,
    width_mm: cfg.width_mm,
    height_mm: cfg.height_mm,
    area_m2: round3((cfg.width_mm * cfg.height_mm) / 1_000_000),
    perimeter_m: round3((2 * (cfg.width_mm + cfg.height_mm)) / 1000),
    quantity: cfg.quantity,
    section_count: sections.length,
    section_open_count: openCount,
    max_section_width_mm: sections.length ? Math.round(cfg.width_mm / sections.length) : 0,
    opening: sections.map((s) => s.opening).filter(Boolean),
    hinge: sections
      .filter((s) => s.opening && openingNeedsHinge(catalog, s.opening))
      .map((s) => s.hinge ?? "")
      .filter(Boolean),
    diensten: [...cfg.services],
  };
  for (const [k, v] of Object.entries(cfg.values)) facts[k] = v;
  return facts;
}

export function getFieldValue(cfg: ItemConfig, field: string): string | string[] | undefined {
  if (field === "material") return cfg.material;
  if (field === "system") return cfg.system;
  if (field === "family") return cfg.family;
  if (field === "diensten") return cfg.services;
  if (field === "opening") return cfg.sections.map((s) => s.opening);
  if (field === "hinge") return cfg.sections.map((s) => s.hinge ?? "");
  return cfg.values[field];
}

/** Applies a single field value (used by auto-include and bulk changes). */
export function setFieldValue(cfg: ItemConfig, field: string, value: string): ItemConfig {
  const next: ItemConfig = { ...cfg, values: { ...cfg.values }, services: [...cfg.services], sections: cfg.sections.map((s) => ({ ...s })) };
  if (field === "material") next.material = value;
  else if (field === "system") next.system = value;
  else if (field === "diensten") {
    if (!next.services.includes(value)) next.services.push(value);
  } else if (field === "opening") next.sections = next.sections.map((s) => ({ ...s, opening: value }));
  else if (field === "hinge") next.sections = next.sections.map((s) => ({ ...s, hinge: value }));
  else next.values[field] = value;
  return next;
}

export function visibleOptionsFor(catalog: Catalog, family: string): OptionDef[] {
  return catalog.options
    .filter((o) => o.active && (!o.families || o.families.length === 0 || o.families.includes(family)))
    .sort((a, b) => a.sort - b.sort);
}

function activeRules(catalog: Catalog, type: Rule["rule_type"]): Rule[] {
  return catalog.rules.filter((r) => r.active && r.rule_type === type);
}

const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : v == null ? [] : [String(v)]);

export function evaluateConfiguration(catalog: Catalog, raw: Partial<ItemConfig>): Evaluation {
  let cfg = normalizeConfig(raw);
  const visibleOptions = visibleOptionsFor(catalog, cfg.family);
  const visibleCodes = new Set(visibleOptions.map((o) => o.code));

  // Drop values of options that do not apply to this family.
  for (const code of Object.keys(cfg.values)) if (!visibleCodes.has(code)) delete cfg.values[code];
  if (!visibleCodes.has("diensten")) cfg.services = [];

  // 1. Auto-include (a few passes so chained inclusions settle).
  const autoIncluded: Evaluation["autoIncluded"] = {};
  for (let pass = 0; pass < 3; pass++) {
    const facts = buildFacts(catalog, cfg);
    for (const r of activeRules(catalog, "auto_include")) {
      if (!matchesAll(r.conditions, facts)) continue;
      const field = String(r.params["field"] ?? "");
      const value = String(r.params["value"] ?? "");
      if (!field || !value || (!visibleCodes.has(field) && field !== "system")) continue;
      cfg = setFieldValue(cfg, field, value);
      autoIncluded[field === "diensten" ? `diensten:${value}` : field] = { value, message: r.message, rule_code: r.code };
    }
  }
  const facts = buildFacts(catalog, cfg);

  // 2. Availability per option/value.
  const available: Record<string, string[]> = {};
  const unavailableReasons: Record<string, Record<string, string>> = {};
  for (const o of visibleOptions) {
    available[o.code] = catalog.values
      .filter((v) => v.option_code === o.code && v.active)
      .sort((a, b) => a.sort - b.sort)
      .map((v) => v.code);
  }
  available["system"] = catalog.systems
    .filter((s) => s.active && s.material === cfg.material && s.families.includes(cfg.family))
    .sort((a, b) => a.sort - b.sort)
    .map((s) => s.code);

  const markUnavailable = (field: string, value: string, reason: string) => {
    if (!available[field]) return;
    available[field] = available[field].filter((v) => v !== value);
    unavailableReasons[field] = { ...(unavailableReasons[field] ?? {}), [value]: reason };
  };
  for (const r of activeRules(catalog, "restrict_values")) {
    if (!matchesAll(r.conditions, facts)) continue;
    const field = String(r.params["field"] ?? "");
    const allowed = strList(r.params["values"]);
    for (const v of [...(available[field] ?? [])]) if (!allowed.includes(v)) markUnavailable(field, v, r.message);
  }
  for (const r of activeRules(catalog, "exclude_values")) {
    if (!matchesAll(r.conditions, facts)) continue;
    const field = String(r.params["field"] ?? "");
    for (const v of strList(r.params["values"])) markUnavailable(field, v, r.message);
  }

  // 3. Validation.
  const issues: Issue[] = [];
  const err = (field: string | null, message: string, rule_code: string | null = null) =>
    issues.push({ field, severity: "error", message, rule_code });
  const optName = (code: string) => catalog.options.find((o) => o.code === code)?.name_nl ?? code;
  const reasonFor = (field: string, value: string) =>
    unavailableReasons[field]?.[value] ?? `De keuze "${valueLabel(catalog, field, value)}" is niet beschikbaar in de huidige combinatie.`;

  if (!catalog.families.some((f) => f.code === cfg.family && f.active)) err("family", "Kies een geldige productfamilie.");

  if (!cfg.material) err("material", "Kies een materiaal.");
  else if (available["material"] && !available["material"].includes(cfg.material)) err("material", reasonFor("material", cfg.material));

  if (!cfg.system) err("system", "Kies een systeem/profielreeks.");
  else if (!available["system"].includes(cfg.system))
    err("system", unavailableReasons["system"]?.[cfg.system] ?? "Dit systeem bestaat niet voor de gekozen productfamilie en dit materiaal.");

  if (!Number.isInteger(cfg.width_mm) || cfg.width_mm <= 0) err("width_mm", "Geef een breedte in millimeter op.");
  if (!Number.isInteger(cfg.height_mm) || cfg.height_mm <= 0) err("height_mm", "Geef een hoogte in millimeter op.");
  if (!Number.isInteger(cfg.quantity) || cfg.quantity < 1) err("quantity", "Het aantal moet minstens 1 zijn.");

  if (cfg.sections.length < 1 || cfg.sections.length > MAX_SECTIONS)
    err("sections", `Een element heeft 1 tot ${MAX_SECTIONS} vakken.`);
  cfg.sections.forEach((s, i) => {
    const f = `sections.${i}.opening`;
    if (!s.opening) err(f, `Vak ${i + 1}: kies een openingswijze.`);
    else if (available["opening"] && !available["opening"].includes(s.opening)) err(f, `Vak ${i + 1}: ${reasonFor("opening", s.opening)}`);
    if (s.opening && openingNeedsHinge(catalog, s.opening)) {
      const h = `sections.${i}.hinge`;
      if (!s.hinge) err(h, `Vak ${i + 1}: kies de draairichting.`);
      else if (available["hinge"] && !available["hinge"].includes(s.hinge)) err(h, `Vak ${i + 1}: ${reasonFor("hinge", s.hinge)}`);
    }
  });

  for (const o of visibleOptions) {
    if ((SPECIAL_OPTIONS as readonly string[]).includes(o.code)) continue;
    const v = cfg.values[o.code];
    if (!v) {
      if (o.required) err(o.code, `Verplicht: kies ${o.name_nl.toLowerCase()}.`);
      continue;
    }
    if (!(available[o.code] ?? []).includes(v)) err(o.code, reasonFor(o.code, v));
  }
  for (const s of cfg.services) {
    if (!(available["diensten"] ?? []).includes(s)) err("diensten", reasonFor("diensten", s));
  }

  for (const r of activeRules(catalog, "requires_value")) {
    if (!matchesAll(r.conditions, facts)) continue;
    const field = String(r.params["field"] ?? "");
    const allowed = strList(r.params["values"]);
    const cur = facts[field];
    const ok = Array.isArray(cur) ? cur.some((c) => allowed.includes(c)) : cur != null && allowed.includes(String(cur));
    if (!ok) issues.push({ field, severity: r.severity, message: r.message, rule_code: r.code });
  }
  for (const r of activeRules(catalog, "forbid")) {
    if (!matchesAll(r.conditions, facts)) continue;
    issues.push({ field: (r.params["field"] as string) ?? null, severity: r.severity, message: r.message, rule_code: r.code });
  }

  // Dimension limits. Missing rule = not configured for production.
  const notConfigured: string[] = [];
  const dimRules = activeRules(catalog, "dimension_limit").filter((r) => matchesAll(r.conditions, facts));
  if (cfg.system && dimRules.length === 0) {
    notConfigured.push(`Geen afmetingsregel ingesteld voor ${familyLabel(catalog, cfg.family)} in systeem ${cfg.system}.`);
  }
  for (const r of dimRules) {
    const p = r.params as Record<string, number | undefined>;
    const label = r.message || r.name;
    if (p["min_width"] != null && cfg.width_mm < p["min_width"]) err("width_mm", `Breedte minimaal ${p["min_width"]} mm (${label}).`, r.code);
    if (p["max_width"] != null && cfg.width_mm > p["max_width"]) err("width_mm", `Breedte maximaal ${p["max_width"]} mm (${label}).`, r.code);
    if (p["min_height"] != null && cfg.height_mm < p["min_height"]) err("height_mm", `Hoogte minimaal ${p["min_height"]} mm (${label}).`, r.code);
    if (p["max_height"] != null && cfg.height_mm > p["max_height"]) err("height_mm", `Hoogte maximaal ${p["max_height"]} mm (${label}).`, r.code);
    if (p["max_area_m2"] != null && Number(facts["area_m2"]) > p["max_area_m2"])
      err("width_mm", `Oppervlakte maximaal ${p["max_area_m2"]} m² (${label}).`, r.code);
  }

  const sys = catalog.systems.find((s) => s.code === cfg.system);
  if (sys && !sys.production_ready) notConfigured.push(`Systeem ${sys.name}: profiel- en productiegegevens nog niet aangeleverd.`);
  for (const r of activeRules(catalog, "placeholder")) if (matchesAll(r.conditions, facts)) notConfigured.push(r.message);

  const surcharges = activeRules(catalog, "surcharge").filter((r) => matchesAll(r.conditions, facts));

  return {
    config: cfg,
    facts,
    visibleOptions,
    available,
    unavailableReasons,
    autoIncluded,
    issues,
    notConfigured,
    surcharges,
    status: statusOf(issues, notConfigured),
    productionReady: !issues.some((i) => i.severity === "error") && notConfigured.length === 0,
  };
}

export function statusOf(issues: Issue[], notConfigured: string[]): ItemStatus {
  if (issues.some((i) => i.severity === "error")) return "error";
  if (notConfigured.length) return "not_configured";
  if (issues.length) return "warning";
  return "ok";
}

export function familyLabel(catalog: Catalog, code: string): string {
  return catalog.families.find((f) => f.code === code)?.name_nl ?? code;
}

export function valueLabel(catalog: Catalog, field: string, code: string | null | undefined): string {
  if (!code) return "—";
  if (field === "system") return catalog.systems.find((s) => s.code === code)?.name ?? code;
  if (field === "family") return familyLabel(catalog, code);
  return catalog.values.find((v) => v.option_code === field && v.code === code)?.name_nl ?? code;
}

export function issuesFor(evaluation: Evaluation, fieldPrefix: string): Issue[] {
  return evaluation.issues.filter((i) => i.field === fieldPrefix || (i.field ?? "").startsWith(`${fieldPrefix}.`));
}

export const STATUS_LABEL: Record<ItemStatus, string> = {
  ok: "Geldig",
  warning: "Geldig met waarschuwing",
  not_configured: "Niet geconfigureerd voor productie",
  error: "Ongeldig",
};
