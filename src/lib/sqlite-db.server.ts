import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { getSeedTables } from "@/lib/local-db";

type Row = Record<string, unknown>;
type Filter = { column: string; op: "eq" | "in" | "is"; value: unknown };

const databasePath = resolve(process.cwd(), "data", "demo.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });
const db = new Database(databasePath);
db.pragma("journal_mode = WAL");
db.exec(readFileSync(resolve(process.cwd(), "db", "schema.sql"), "utf8"));

const selectRows = db.prepare("SELECT id, data_json FROM records WHERE table_name = ?");
const insertRow = db.prepare("INSERT OR REPLACE INTO records (table_name, id, data_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)");
const deleteRow = db.prepare("DELETE FROM records WHERE table_name = ? AND id = ?");

function now() {
  return new Date().toISOString();
}

function seedDatabase() {
  const count = db.prepare("SELECT COUNT(*) AS count FROM records").get() as { count: number };
  if (count.count > 0) return;
  const insert = db.transaction(() => {
    for (const [table, rows] of Object.entries(getSeedTables())) {
      for (const row of rows) {
        const timestamp = String(row["updated_at"] ?? row["created_at"] ?? now());
        insertRow.run(table, String(row["id"]), JSON.stringify(row), timestamp, timestamp);
      }
    }
  });
  insert();
}

seedDatabase();

function ensureDemoAccounts() {
  const roles = ["verkoper", "productbeheerder", "manager", "productie"] as const;
  for (const role of roles) {
    const userId = `local-${role}`;
    const timestamp = now();
    const profile = { id: userId, email: `demo-${role}@local.test`, full_name: `${role} (demo)` };
    const userRole = { id: `role-${role}`, user_id: userId, role };
    insertRow.run("profiles", userId, JSON.stringify(profile), timestamp, timestamp);
    insertRow.run("user_roles", userRole.id, JSON.stringify(userRole), timestamp, timestamp);
  }
}

ensureDemoAccounts();

function ensureDemoReferenceData() {
  const templates = allRows("quote_templates");
  if (templates.length === 0) {
    const timestamp = now();
    insertRow.run(
      "quote_templates",
      "template-standard",
      JSON.stringify({
        id: "template-standard",
        code: "STD",
        name: "Standaardsjabloon",
        intro_text: "Bedankt voor uw aanvraag.",
        conditions_text: "Deze offerte is 30 dagen geldig.",
        validity_days: 30,
        is_default: true,
      }),
      timestamp,
      timestamp,
    );
  }
}

ensureDemoReferenceData();

function ensureDemoOrganizations() {
  const timestamp = now();
  db.prepare("INSERT OR IGNORE INTO organizations (id, name, kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run("org-internal", "Demo Schrijnwerk NV", "internal", timestamp, timestamp);
  for (const role of ["verkoper", "productbeheerder", "manager", "productie"]) {
    db.prepare("INSERT OR IGNORE INTO organization_memberships (id, organization_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)").run(`membership-${role}`, "org-internal", `local-${role}`, role, timestamp);
  }
}

ensureDemoOrganizations();

function allRows(table: string): Row[] {
  return (selectRows.all(table) as { id: string; data_json: string }[]).map((row) => JSON.parse(row.data_json) as Row);
}

function relations(table: string, row: Row): Row {
  const result = { ...row };
  if (table === "companies") {
    result["contacts"] = allRows("contacts").filter((contact) => contact["company_id"] === row["id"]);
    result["projects"] = allRows("projects").filter((project) => project["company_id"] === row["id"]);
  }
  if (table === "projects") {
    result["companies"] = allRows("companies").find((company) => company["id"] === row["company_id"]) ?? null;
    result["contacts"] = allRows("contacts").find((contact) => contact["id"] === row["contact_id"]) ?? null;
    result["project_items"] = allRows("project_items").filter((item) => item["project_id"] === row["id"]);
    result["quotes"] = allRows("quotes").filter((quote) => quote["project_id"] === row["id"]).map((quote) => relations("quotes", quote));
  }
  if (table === "quotes") {
    result["projects"] = allRows("projects").find((project) => project["id"] === row["project_id"]) ?? null;
    result["quote_revisions"] = allRows("quote_revisions").filter((revision) => revision["quote_id"] === row["id"]);
  }
  if (table === "integration_jobs") {
    result["sync_events"] = allRows("sync_events").filter((event) => event["job_id"] === row["id"]);
  }
  return result;
}

function matches(row: Row, filters: Filter[]) {
  return filters.every((filter) => {
    const value = row[filter.column];
    if (filter.op === "eq") return value === filter.value;
    if (filter.op === "in") return Array.isArray(filter.value) && filter.value.includes(value);
    if (filter.value === null) return value === null || value === undefined;
    return value === filter.value;
  });
}

export class SqliteQuery {
  private readonly filters: Filter[] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private limitValue: number | null = null;
  private columns = "*";
  private operation: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: Row | Row[] | null = null;

  constructor(private readonly table: string) {}
  select(columns = "*") { this.columns = columns; return this; }
  eq(column: string, value: unknown) { this.filters.push({ column, op: "eq", value }); return this; }
  in(column: string, value: unknown[]) { this.filters.push({ column, op: "in", value }); return this; }
  is(column: string, value: unknown) { this.filters.push({ column, op: "is", value }); return this; }
  order(column: string, options?: { ascending?: boolean }) { this.orderBy = { column, ascending: options?.ascending !== false }; return this; }
  limit(value: number) { this.limitValue = value; return this; }
  range(from: number, to: number) { this.limitValue = to - from + 1; return this; }
  insert(payload: Row | Row[]) { this.operation = "insert"; this.payload = payload; return this; }
  update(payload: Row) { this.operation = "update"; this.payload = payload; return this; }
  delete() { this.operation = "delete"; return this; }
  upsert(payload: Row | Row[]) { this.operation = "upsert"; this.payload = payload; return this; }
  then<T = { data: Row[]; error: null }>(resolve: (value: { data: Row[]; error: null }) => T | PromiseLike<T>) { return this.run().then(resolve); }
  async single() { const result = await this.run(); return { data: result.data[0] ?? null, error: result.data[0] ? null : { message: "Not found" } }; }
  async maybeSingle() { const result = await this.run(); return { data: result.data[0] ?? null, error: null }; }

  async run() {
    if (this.operation === "insert" || this.operation === "upsert") {
      const values = (Array.isArray(this.payload) ? this.payload : [this.payload]).filter((value): value is Row => value !== null);
      const inserted: Row[] = [];
      const transaction = db.transaction(() => {
        for (const value of values) {
          const existing = this.operation === "upsert" && value["id"]
            ? allRows(this.table).find((candidate) => candidate["id"] === value["id"])
            : undefined;
          const row: Row = existing
            ? { ...existing, ...value, updated_at: now() }
            : { id: crypto.randomUUID(), created_at: now(), updated_at: now(), ...value };
          insertRow.run(this.table, String(row["id"]), JSON.stringify(row), String(row["created_at"]), String(row["updated_at"]));
          inserted.push(row);
        }
      });
      transaction();
      return { data: inserted.map((row) => relations(this.table, row)), error: null };
    }
    let rows = allRows(this.table).filter((row) => matches(row, this.filters));
    if (this.operation === "update" || this.operation === "delete") {
      const transaction = db.transaction(() => {
        for (const row of rows) {
          if (this.operation === "delete") deleteRow.run(this.table, String(row["id"]));
          else {
            const updated: Row = { ...row, ...(this.payload ?? {}), updated_at: now() };
            insertRow.run(this.table, String(updated["id"]), JSON.stringify(updated), String(updated["created_at"] ?? now()), String(updated["updated_at"]));
          }
        }
      });
      transaction();
    }
    if (this.orderBy) rows = [...rows].sort((a, b) => String(a[this.orderBy!.column] ?? "").localeCompare(String(b[this.orderBy!.column] ?? "")) * (this.orderBy!.ascending ? 1 : -1));
    if (this.limitValue !== null) rows = rows.slice(0, this.limitValue);
    return { data: rows.map((row) => relations(this.table, row)), error: null };
  }
}

export function createSqliteClient() {
  return { from: (table: string) => new SqliteQuery(table) };
}

export function resetSqliteDatabase() {
  db.exec("DELETE FROM records");
  seedDatabase();
}

export type OrderStatus = "concept" | "bevestigd" | "in_productie" | "gereed" | "geleverd" | "geannuleerd";

export function createImmutableDocument(input: { organizationId: string; sourceType: string; sourceId: string; documentType: string; version: number; content: Row; createdBy: string }) {
  const contentJson = JSON.stringify(input.content);
  const hash = createHash("sha256").update(contentJson).digest("hex");
  const id = crypto.randomUUID();
  const timestamp = now();
  db.prepare("INSERT INTO immutable_documents (id, organization_id, source_type, source_id, document_type, version, content_json, content_hash, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(id, input.organizationId, input.sourceType, input.sourceId, input.documentType, input.version, contentJson, hash, input.createdBy, timestamp);
  return { id, hash, version: input.version, created_at: timestamp };
}

export function createOrder(input: { organizationId: string; quoteRevisionId: string; snapshot: Row; createdBy: string }) {
  const id = crypto.randomUUID();
  const timestamp = now();
  const orderNumber = `ORD-${new Date().getFullYear()}-${String(db.prepare("SELECT COUNT(*) AS count FROM orders").get() as { count: number }["count"] + 1).padStart(4, "0")}`;
  const snapshot = JSON.stringify(input.snapshot);
  const insert = db.prepare("INSERT INTO orders (id, organization_id, quote_revision_id, order_number, status, snapshot_json, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 'concept', ?, ?, ?, ?)");
  const event = db.prepare("INSERT INTO order_events (id, order_id, from_status, to_status, user_id, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
  const transaction = db.transaction(() => {
    insert.run(id, input.organizationId, input.quoteRevisionId, orderNumber, snapshot, input.createdBy, timestamp, timestamp);
    event.run(crypto.randomUUID(), id, null, "concept", input.createdBy, "Order aangemaakt vanuit immutable offerte-revisie.", timestamp);
  });
  transaction();
  return { id, order_number: orderNumber, status: "concept" as OrderStatus, created_at: timestamp };
}

export function transitionOrder(id: string, status: OrderStatus, userId: string, comment?: string) {
  const order = db.prepare("SELECT status FROM orders WHERE id = ?").get(id) as { status: OrderStatus } | undefined;
  if (!order) throw new Error("Order niet gevonden.");
  if (order.status === "geannuleerd" || order.status === "geleverd") throw new Error("Deze order kan niet meer gewijzigd worden.");
  const timestamp = now();
  const transaction = db.transaction(() => {
    db.prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?").run(status, timestamp, id);
    db.prepare("INSERT INTO order_events (id, order_id, from_status, to_status, user_id, comment, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(crypto.randomUUID(), id, order.status, status, userId, comment ?? null, timestamp);
  });
  transaction();
  return { id, status };
}

export function platformRows(table: "organizations" | "orders" | "immutable_documents" | "guided_sessions" | "ai_requests", organizationId?: string) {
  const queries = {
    organizations: "SELECT * FROM organizations ORDER BY name",
    orders: "SELECT * FROM orders WHERE organization_id = ? ORDER BY created_at DESC",
    immutable_documents: "SELECT id, organization_id, source_type, source_id, document_type, version, content_hash, created_by, created_at FROM immutable_documents WHERE organization_id = ? ORDER BY created_at DESC",
    guided_sessions: "SELECT * FROM guided_sessions WHERE organization_id = ? ORDER BY created_at DESC",
    ai_requests: "SELECT id, organization_id, user_id, provider, response_json, status, created_at FROM ai_requests WHERE organization_id = ? ORDER BY created_at DESC",
  };
  return (organizationId && table !== "organizations" ? db.prepare(queries[table]).all(organizationId) : db.prepare(queries[table]).all()) as Row[];
}

type ApiBody = {
  table: string;
  operation: "select" | "insert" | "update" | "delete" | "upsert";
  columns?: string;
  filters?: Filter[];
  order?: { column: string; ascending?: boolean };
  limit?: number;
  payload?: Row | Row[];
  single?: boolean;
};

const allowedTables = new Set(["companies", "contacts", "projects", "project_items", "configurations", "configuration_items", "quotes", "quote_revisions", "quote_lines", "approvals", "attachments", "profiles", "user_roles", "product_families", "products", "systems", "options", "option_values", "configuration_rules", "price_books", "price_book_entries", "discounts", "bom_templates", "bom_lines", "component_costs", "integration_jobs", "sync_events", "quote_revision_costs", "documents"]);

export async function handleSqliteApiRequest(request: Request) {
  const body = await request.json() as ApiBody;
  if (!allowedTables.has(body.table)) return Response.json({ error: { message: "Ongeldige tabel." } }, { status: 400 });
  const query = createSqliteClient().from(body.table);
  if (body.columns) query.select(body.columns);
  for (const filter of body.filters ?? []) {
    if (filter.op === "eq") query.eq(filter.column, filter.value);
    if (filter.op === "in") query.in(filter.column, filter.value as unknown[]);
    if (filter.op === "is") query.is(filter.column, filter.value);
  }
  if (body.order) query.order(body.order.column, body.order);
  if (body.limit !== undefined) query.limit(body.limit);
  if (body.operation === "insert") query.insert(body.payload ?? {});
  if (body.operation === "update") query.update(body.payload as Row);
  if (body.operation === "delete") query.delete();
  if (body.operation === "upsert") query.upsert(body.payload ?? {});
  return Response.json(body.single ? await query.single() : await query.run());
}
