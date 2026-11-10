import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type Row = Record<string, unknown>;
type Listener = (event: "SIGNED_IN" | "SIGNED_OUT" | "USER_UPDATED") => void;

const users = new Map<string, { id: string; email: string; full_name: string; role: AppRole }>();
const sessions = new Map<string, string>();
const listeners = new Set<Listener>();
const tables = new Map<string, Row[]>();

const seed = (table: string, rows: Row[]) => tables.set(table, rows.map((row) => ({ ...row })));
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const roleFromToken = (token: string): AppRole | null => {
  const role = token.split(".")[1];
  return ROLES.includes(role as AppRole) ? role as AppRole : null;
};
const ROLES = ["verkoper", "productbeheerder", "manager", "productie"] as const;

seed("price_books", [{ id: "pb-standard", code: "PB-STD-2026", name: "Standaard 2026", version: 1, factor: 1, valid_from: null, valid_to: null, parent_price_book_id: null, is_default: true, status: "actief", vat_default: 21 }]);
seed("product_families", [
  { id: "family-window", code: "raam", name_nl: "Raam", name_fr: "Fenêtre", name_en: "Window", sort: 1, active: true },
  { id: "family-door", code: "deur", name_nl: "Deur", name_fr: "Porte", name_en: "Door", sort: 2, active: true },
]);
seed("products", [
  { id: "product-window", code: "RAAM-STD", family_code: "raam", name: "Standaard raam", description: "Demo raam", default_config: {}, sort: 1, active: true },
  { id: "product-door", code: "DEUR-STD", family_code: "deur", name: "Standaard deur", description: "Demo deur", default_config: {}, sort: 2, active: true },
]);
seed("systems", [
  { id: "system-pvc", code: "PVC-70", name: "PVC 70", material: "pvc", families: ["raam", "deur"], description: "", production_ready: true, sort: 1, active: true },
  { id: "system-alu", code: "ALU-75", name: "Aluminium 75", material: "alu", families: ["raam", "deur"], description: "", production_ready: true, sort: 2, active: true },
]);
seed("options", [
  { id: "option-glass", code: "glas", name_nl: "Glas", name_fr: "Vitrage", name_en: "Glass", step: "glas", input_type: "single", required: true, families: null, sort: 1, help_text: null, active: true },
  { id: "option-opening", code: "opening", name_nl: "Opening", name_fr: "Ouverture", name_en: "Opening", step: "opening", input_type: "single", required: true, families: null, sort: 2, help_text: null, active: true },
]);
seed("option_values", [
  { id: "glass-double", option_id: "option-glass", code: "dubbel_hr", name_nl: "Dubbel HR", name_fr: "Double HR", name_en: "Double HR", attributes: {}, sort: 1, active: true },
  { id: "opening-fixed", option_id: "option-opening", code: "vast", name_nl: "Vast", name_fr: "Fixe", name_en: "Fixed", attributes: {}, sort: 1, active: true },
  { id: "opening-turn", option_id: "option-opening", code: "draai", name_nl: "Draai", name_fr: "Battant", name_en: "Turn", attributes: {}, sort: 2, active: true },
]);
seed("configuration_rules", []);
seed("discounts", []);
seed("bom_templates", []);
seed("bom_lines", []);
seed("price_book_entries", [
  { id: "price-base", price_book_id: "pb-standard", entry_type: "base", system_code: "PVC-70", amount: 450, unit: "piece", label: "PVC raam" },
  { id: "price-alu", price_book_id: "pb-standard", entry_type: "base", system_code: "ALU-75", amount: 650, unit: "piece", label: "Aluminium raam" },
]);
seed("component_costs", []);
seed("companies", [
  { id: "company-peeters", name: "Familie Peeters (demo)", company_type: "particulier", vat_number: null, email: "peeters@example.com", phone: "+32 470 00 00 01", street: "Kapelstraat 12", postal_code: "2800", city: "Mechelen", price_book_id: null, notes: "Renovatie rijwoning uit 1972.", deleted_at: null },
  { id: "company-vandamme", name: "Bouwbedrijf Van Damme & Zonen (demo)", company_type: "aannemer", vat_number: "BE0000.000.001", email: "info@vandamme.example.com", phone: "+32 56 00 00 02", street: "Industrielaan 4", postal_code: "8500", city: "Kortrijk", price_book_id: null, notes: "Hoofdaannemer nieuwbouwprojecten.", deleted_at: null },
  { id: "company-kempen", name: "Raamcentrum Kempen (demo)", company_type: "dealer", vat_number: "BE0000.000.002", email: "verkoop@kempen.example.com", phone: "+32 14 00 00 03", street: "Markt 7", postal_code: "2440", city: "Geel", price_book_id: "pb-standard", notes: "Dealer met fictief dealerprijsboek.", deleted_at: null },
  { id: "company-lijnlicht", name: "Architectenbureau Lijn & Licht (demo)", company_type: "architect", vat_number: "BE0000.000.003", email: "studio@lijnlicht.example.com", phone: "+32 9 000 00 04", street: "Veldstraat 88", postal_code: "9000", city: "Gent", price_book_id: null, notes: "Voorschrijver; nog geen project.", deleted_at: null },
]);
seed("contacts", [
  { id: "contact-peeters", company_id: "company-peeters", first_name: "An", last_name: "Peeters", email: "an.peeters@example.com", phone: "+32 470 00 00 11", job_title: null, is_primary: true, deleted_at: null },
  { id: "contact-vandamme", company_id: "company-vandamme", first_name: "Pieter", last_name: "Van Damme", email: "pieter@vandamme.example.com", phone: "+32 476 00 00 12", job_title: "Projectleider", is_primary: true, deleted_at: null },
  { id: "contact-claes", company_id: "company-vandamme", first_name: "Sofie", last_name: "Claes", email: "sofie@vandamme.example.com", phone: "+32 476 00 00 13", job_title: "Calculator", is_primary: false, deleted_at: null },
  { id: "contact-kempen", company_id: "company-kempen", first_name: "Wim", last_name: "Janssens", email: "wim@kempen.example.com", phone: "+32 477 00 00 14", job_title: "Zaakvoerder", is_primary: true, deleted_at: null },
  { id: "contact-lijnlicht", company_id: "company-lijnlicht", first_name: "Lotte", last_name: "De Smet", email: "lotte@lijnlicht.example.com", phone: "+32 478 00 00 15", job_title: "Architect", is_primary: true, deleted_at: null },
]);
seed("projects", [
  { id: "project-peeters", project_number: "P-2026-0001", name: "Renovatie woning Peeters", company_id: "company-peeters", contact_id: "contact-peeters", street: "Kapelstraat 12", postal_code: "2800", city: "Mechelen", owner_id: null, status: "offerte", desired_delivery_date: "2027-03-15", vat_rate: 6, notes: "Klant twijfelt tussen PVC en aluminium.", sync_status: null, deleted_at: null, updated_at: "2026-11-08T10:00:00.000Z" },
  { id: "project-vandamme", project_number: "P-2026-0002", name: "Nieuwbouw kantoor Kortrijk", company_id: "company-vandamme", contact_id: "contact-vandamme", street: "Industrielaan 6", postal_code: "8500", city: "Kortrijk", owner_id: null, status: "offerte", desired_delivery_date: "2027-02-01", vat_rate: 21, notes: "Gevelelementen volgens fictief plan.", sync_status: null, deleted_at: null, updated_at: "2026-11-07T14:30:00.000Z" },
  { id: "project-kempen", project_number: "P-2026-0003", name: "Showroom Kempen", company_id: "company-kempen", contact_id: "contact-kempen", street: "Markt 7", postal_code: "2440", city: "Geel", owner_id: null, status: "in_opmaak", desired_delivery_date: "2027-04-30", vat_rate: 21, notes: "Dealerproject met houten etalageraam.", sync_status: null, deleted_at: null, updated_at: "2026-11-06T09:15:00.000Z" },
]);
seed("project_items", [
  { id: "item-peeters-1", project_id: "project-peeters", seq: 1, label: "Raam leefruimte 01", deleted_at: null },
  { id: "item-peeters-2", project_id: "project-peeters", seq: 2, label: "Raam keuken 01", deleted_at: null },
  { id: "item-vandamme-1", project_id: "project-vandamme", seq: 1, label: "Vast raam gevel 01", deleted_at: null },
  { id: "item-kempen-1", project_id: "project-kempen", seq: 1, label: "Houten raam etalage 01", deleted_at: null },
]);
seed("configurations", [
  { id: "config-peeters", project_id: "project-peeters", name: "Basis - PVC 70", description: "Hoofdvoorstel in PVC.", is_primary: true, source_configuration_id: null, deleted_at: null },
  { id: "config-vandamme", project_id: "project-vandamme", name: "Basis - ALU 75", description: "Volgens fictief bestek.", is_primary: true, source_configuration_id: null, deleted_at: null },
]);
seed("configuration_items", [
  { id: "config-item-peeters", configuration_id: "config-peeters", project_item_id: "item-peeters-1", version: 1, data: { product_code: "RAAM-STD", family: "raam", material: "pvc", system: "PVC-70", width_mm: 1800, height_mm: 1300, quantity: 1, sections: [{ opening: "draai", hinge: "links" }], values: { glas: "dubbel_hr", opening: "draai" }, services: ["opmeting", "plaatsing"], remarks: "", production_notes: "" }, manual_overrides: [], status: "gecontroleerd", validation: {}, net_total: 450, price_book_version: 1 },
  { id: "config-item-vandamme", configuration_id: "config-vandamme", project_item_id: "item-vandamme-1", version: 1, data: { product_code: "RAAM-STD", family: "raam", material: "alu", system: "ALU-75", width_mm: 2400, height_mm: 1600, quantity: 1, sections: [{ opening: "vast", hinge: null }], values: { glas: "dubbel_hr", opening: "vast" }, services: ["plaatsing"], remarks: "", production_notes: "" }, manual_overrides: [], status: "gecontroleerd", validation: {}, net_total: 650, price_book_version: 1 },
]);
seed("quotes", [
  { id: "quote-peeters", project_id: "project-peeters", quote_number: "OFF-2026-0001", title: "Renovatie woning Peeters", status: "concept", current_revision_no: 1, updated_at: "2026-11-08T10:00:00.000Z" },
  { id: "quote-vandamme", project_id: "project-vandamme", quote_number: "OFF-2026-0002", title: "Nieuwbouw kantoor Kortrijk", status: "interne_controle", current_revision_no: 1, updated_at: "2026-11-07T14:30:00.000Z" },
]);
seed("quote_revisions", [
  { id: "revision-peeters", quote_id: "quote-peeters", revision_no: 1, status: "concept", total_net: 450, requires_approval: false, created_at: "2026-11-08T10:00:00.000Z", locked: false },
  { id: "revision-vandamme", quote_id: "quote-vandamme", revision_no: 1, status: "interne_controle", total_net: 650, requires_approval: true, created_at: "2026-11-07T14:30:00.000Z", locked: false },
]);
seed("approvals", [{ id: "approval-vandamme", revision_id: "revision-vandamme", status: "in_afwachting", reason: "Managercontrole vereist voor deze fictieve offerte.", created_at: "2026-11-07T14:30:00.000Z" }]);
for (const table of ["profiles", "user_roles", "attachments", "quote_lines", "quote_revision_costs", "documents", "integration_jobs", "sync_events"]) seed(table, []);

function rowsFor(table: string) {
  const rows = tables.get(table);
  if (!rows) {
    tables.set(table, []);
    return tables.get(table)!;
  }

  return rows;
}

function userFromToken(token: string) {
  const role = roleFromToken(token);
  if (!role) return null;
  const userId = `local-${role}`;
  const existing = users.get(userId);
  if (existing) return existing;
  const user = { id: userId, email: `demo-${role}@local.test`, full_name: `${role} (demo)`, role };
  users.set(userId, user);
  if (!rowsFor("profiles").some((row) => row["id"] === userId)) rowsFor("profiles").push({ id: userId, email: user.email, full_name: user.full_name });
  if (!rowsFor("user_roles").some((row) => row["user_id"] === userId)) rowsFor("user_roles").push({ id: id(), user_id: userId, role });
  return user;
}

function withRelations(table: string, row: Row, depth = 0): Row {
  const result = { ...row };
  if (depth > 2) return result;
  if (table === "companies") {
    result["contacts"] = rowsFor("contacts").filter((contact) => contact["company_id"] === row["id"]);
    result["projects"] = rowsFor("projects").filter((project) => project["company_id"] === row["id"]);
  }
  if (table === "projects") {
    result["companies"] = rowsFor("companies").find((company) => company["id"] === row["company_id"]) ?? null;
    result["contacts"] = rowsFor("contacts").find((contact) => contact["id"] === row["contact_id"]) ?? null;
    result["project_items"] = rowsFor("project_items").filter((item) => item["project_id"] === row["id"]);
    result["quotes"] = rowsFor("quotes")
      .filter((quote) => quote["project_id"] === row["id"])
      .map((quote) => withRelations("quotes", quote, depth + 1));
  }
  if (table === "quotes") {
    result["projects"] = rowsFor("projects").map((project) => withRelations("projects", project, depth + 1)).find((project) => project["id"] === row["project_id"]) ?? null;
    result["quote_revisions"] = rowsFor("quote_revisions").filter((revision) => revision["quote_id"] === row["id"]);
  }
  if (table === "quote_revisions") {
    result["quotes"] = rowsFor("quotes").find((quote) => quote["id"] === row["quote_id"]) ?? null;
  }
  if (table === "integration_jobs") {
    result["sync_events"] = rowsFor("sync_events").filter((event) => event["job_id"] === row["id"]);
  }
  return result;
}

class LocalQuery {
  private filters: ((row: Row) => boolean)[] = [];
  private sortBy: { column: string; ascending: boolean } | null = null;
  private take: number | null = null;
  private selectColumns = "*";
  private operation: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: Row | Row[] | null = null;

  constructor(private readonly table: string) {}

  select(columns = "*") { this.selectColumns = columns; return this; }
  eq(column: string, value: unknown) { this.filters.push((row) => row[column] === value); return this; }
  in(column: string, values: unknown[]) { this.filters.push((row) => values.includes(row[column])); return this; }
  is(column: string, value: unknown) { this.filters.push((row) => row[column] === value); return this; }
  order(column: string, options?: { ascending?: boolean }) { this.sortBy = { column, ascending: options?.ascending !== false }; return this; }
  limit(value: number) { this.take = value; return this; }
  range(from: number, to: number) { this.filters.push(() => true); this.take = Math.max(0, to - from + 1); return this; }
  insert(payload: Row | Row[]) { this.operation = "insert"; this.payload = payload; return this; }
  update(payload: Row) { this.operation = "update"; this.payload = payload; return this; }
  delete() { this.operation = "delete"; return this; }
  upsert(payload: Row | Row[]) { this.operation = "upsert"; this.payload = payload; return this; }
  then<TResult1 = { data: Row[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
  async single() { const result = await this.run(); return { data: result.data[0] ?? null, error: result.data[0] ? null : { message: "Not found" } }; }
  async maybeSingle() { const result = await this.run(); return { data: result.data[0] ?? null, error: null }; }

  private async run(): Promise<{ data: Row[]; error: null }> {
    const rows = rowsFor(this.table);
    if (this.operation === "insert") {
      const values = (Array.isArray(this.payload) ? this.payload : [this.payload]).filter((value): value is Row => value !== null);
      const inserted = values.map((value) => ({ id: id(), created_at: now(), updated_at: now(), ...value }));
      rows.push(...inserted);
      return { data: inserted, error: null };
    }
    const matching = rows.filter((row) => this.filters.every((filter) => filter(row)));
    if (this.operation === "update") {
      matching.forEach((row) => Object.assign(row, this.payload, { updated_at: now() }));
    } else if (this.operation === "delete") {
      matching.forEach((row) => rows.splice(rows.indexOf(row), 1));
    } else if (this.operation === "upsert") {
      const values = (Array.isArray(this.payload) ? this.payload : [this.payload]).filter((value): value is Row => value !== null);
      values.forEach((value) => {
        const existing = value["id"] ? rows.find((row) => row["id"] === value["id"]) : undefined;
        if (existing) Object.assign(existing, value, { updated_at: now() });
        else rows.push({ id: id(), created_at: now(), updated_at: now(), ...value });
      });
    }
    let result = this.operation === "select" ? matching : matching;
    if (this.sortBy) result = [...result].sort((a, b) => String(a[this.sortBy!.column] ?? "").localeCompare(String(b[this.sortBy!.column] ?? "")) * (this.sortBy!.ascending ? 1 : -1));
    if (this.take !== null) result = result.slice(0, this.take);
    return {
      data: result.map((row) => {
        const related = withRelations(this.table, row);
        if (this.selectColumns === "*") return related;
        const selected = this.selectColumns.includes("*")
          ? { ...related }
          : Object.fromEntries(
              this.selectColumns
                .split(",")
                .filter((column) => !column.includes("("))
                .map((column) => [column.trim(), related[column.trim()]]),
            );
        for (const relation of ["contacts", "projects", "companies", "project_items", "quotes", "quote_revisions", "sync_events"]) {
          if (this.selectColumns.includes(relation)) selected[relation] = related[relation];
        }
        return selected;
      }),
      error: null,
    };
  }
}

export function createLocalClient() {
  return {
    from: (table: string) => new LocalQuery(table),
    auth: {
      getSession: async () => {
        const token = typeof localStorage === "undefined" ? undefined : localStorage.getItem("local-session");
        const user = token ? userFromToken(token) : null;
        return { data: { session: user ? { access_token: token, refresh_token: token, user } : null } };
      },
      getUser: async () => {
        const token = typeof localStorage === "undefined" ? undefined : localStorage.getItem("local-session");
        return { data: { user: token ? userFromToken(token) : null } };
      },
      setSession: async ({ access_token }: { access_token: string }) => {
        if (!userFromToken(access_token)) return { error: new Error("Ongeldige lokale sessie.") };
        if (typeof localStorage !== "undefined") localStorage.setItem("local-session", access_token);
        listeners.forEach((listener) => listener("SIGNED_IN"));
        return { error: null };
      },
      signOut: async () => {
        if (typeof localStorage !== "undefined") localStorage.removeItem("local-session");
        listeners.forEach((listener) => listener("SIGNED_OUT"));
        return { error: null };
      },
      onAuthStateChange: (listener: Listener) => {
        listeners.add(listener);
        return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
      },
    },
  };
}

export const localClient = createLocalClient();

export function createLocalSession(role: AppRole) {
  const userId = `local-${role}`;
  const email = `demo-${role}@local.test`;
  users.set(userId, { id: userId, email, full_name: `${role} (demo)`, role });
  const profileRows = rowsFor("profiles");
  if (!profileRows.some((row) => row["id"] === userId)) profileRows.push({ id: userId, email, full_name: `${role} (demo)` });
  const roleRows = rowsFor("user_roles");
  if (!roleRows.some((row) => row["user_id"] === userId)) roleRows.push({ id: id(), user_id: userId, role });
  const token = `local.${role}.${crypto.randomUUID()}`;
  sessions.set(token, userId);
  return { access_token: token, refresh_token: token };
}

export function userForToken(token: string) {
  return userFromToken(token);
}
