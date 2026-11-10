import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createSqliteClient } from "@/lib/sqlite-db.server";
import type { Json } from "@/integrations/supabase/types";

export const DB_TABLES = ["companies", "contacts", "projects", "project_items", "configurations", "configuration_items", "quotes", "quote_revisions", "quote_lines", "approvals", "attachments", "profiles", "user_roles", "product_families", "products", "systems", "options", "option_values", "configuration_rules", "price_books", "price_book_entries", "discounts", "bom_templates", "bom_lines", "component_costs", "integration_jobs", "sync_events", "quote_revision_costs", "documents", "quote_templates"] as const;
export type DbTable = typeof DB_TABLES[number];
const requestSchema = z.object({
  table: z.enum(DB_TABLES),
  operation: z.enum(["select", "insert", "update", "delete", "upsert"]),
  columns: z.string().optional(),
  filters: z.array(z.object({ column: z.string(), op: z.enum(["eq", "in", "is"]), value: z.unknown() })).default([]),
  order: z.object({ column: z.string(), ascending: z.boolean().optional() }).optional(),
  limit: z.number().int().positive().optional(),
  payload: z.union([z.record(z.string(), z.unknown()), z.array(z.record(z.string(), z.unknown()))]).optional(),
  single: z.boolean().default(false),
});

export const dbRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => requestSchema.parse(data))
  .handler(async ({ data, context }) => {
    const role = context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    const { data: roleRows } = await role;
    const currentRole = String(roleRows[0]?.["role"] ?? "");
    const readOnlyTables = new Set(["profiles", "user_roles", "product_families", "products", "systems", "options", "option_values", "configuration_rules", "price_books", "price_book_entries", "discounts", "bom_templates", "bom_lines", "component_costs"]);
    const catalogWriteTables = new Set(["product_families", "products", "systems", "options", "option_values", "configuration_rules", "price_books", "price_book_entries", "discounts", "bom_templates", "bom_lines", "component_costs"]);
    const salesWriteTables = new Set(["companies", "contacts", "projects", "project_items", "configurations", "configuration_items", "quotes", "quote_revisions", "quote_lines", "approvals", "attachments", "documents"]);
    const isWrite = data.operation !== "select";
    if (isWrite && readOnlyTables.has(data.table)) throw new Error("Deze tabel is alleen-lezen via de generieke database-ingang.");
    if (isWrite && salesWriteTables.has(data.table) && !["verkoper", "manager"].includes(currentRole)) throw new Error(`De rol ${currentRole || "onbekend"} mag commerciële gegevens niet wijzigen.`);
    if (isWrite && catalogWriteTables.has(data.table) && !["productbeheerder", "manager"].includes(currentRole)) throw new Error(`De rol ${currentRole || "onbekend"} mag de catalogus niet wijzigen.`);
    if (isWrite && !readOnlyTables.has(data.table) && !salesWriteTables.has(data.table) && !catalogWriteTables.has(data.table)) throw new Error("Deze tabel is niet toegestaan voor generieke writes.");
    const query = createSqliteClient().from(data.table);
    if (data.columns) query.select(data.columns);
    for (const filter of data.filters) {
      if (filter.op === "eq") query.eq(filter.column, filter.value);
      if (filter.op === "in") query.in(filter.column, filter.value as unknown[]);
      if (filter.op === "is") query.is(filter.column, filter.value);
    }
    if (data.order) query.order(data.order.column, data.order.ascending === undefined ? undefined : { ascending: data.order.ascending });
    if (data.limit !== undefined) query.limit(data.limit);
    if (data.operation === "insert") query.insert(data.payload ?? {});
    if (data.operation === "update") query.update(data.payload as Record<string, unknown>);
    if (data.operation === "delete") query.delete();
    if (data.operation === "upsert") query.upsert(data.payload ?? {});
    const result = await query.run();
    return JSON.parse(JSON.stringify(result)) as { data: Record<string, Json>[]; error: null };
  });
