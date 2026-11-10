import { createLocalClient } from "@/lib/local-db";
import { dbRequest, type DbTable } from "@/lib/db.functions";
import type { Database } from "./types";

type Filter = { column: string; op: "eq" | "in" | "is"; value: unknown };

class RemoteQuery {
  private readonly filters: Filter[] = [];
  private orderValue: { column: string; ascending?: boolean } | undefined;
  private limitValue: number | undefined;
  private columns = "*";
  private operation: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: Record<string, unknown> | Record<string, unknown>[] | undefined;

  constructor(private readonly table: string) {}
  select(columns = "*") { this.columns = columns; return this; }
  eq(column: string, value: unknown) { this.filters.push({ column, op: "eq", value }); return this; }
  in(column: string, value: unknown[]) { this.filters.push({ column, op: "in", value }); return this; }
  is(column: string, value: unknown) { this.filters.push({ column, op: "is", value }); return this; }
  order(column: string, options?: { ascending?: boolean }) { this.orderValue = { column, ...options }; return this; }
  limit(value: number) { this.limitValue = value; return this; }
  range(_from: number, to: number) { this.limitValue = to + 1; return this; }
  insert(payload: Record<string, unknown> | Record<string, unknown>[]) { this.operation = "insert"; this.payload = payload; return this; }
  update(payload: Record<string, unknown>) { this.operation = "update"; this.payload = payload; return this; }
  delete() { this.operation = "delete"; return this; }
  upsert(payload: Record<string, unknown> | Record<string, unknown>[]) { this.operation = "upsert"; this.payload = payload; return this; }
  then<T = { data: Record<string, unknown>[]; error: null }>(resolve: (value: { data: Record<string, unknown>[]; error: null }) => T | PromiseLike<T>) {
    return this.run().then(resolve);
  }
  async single() { return this.request(true) as Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>; }
  async maybeSingle() { return this.request(true) as Promise<{ data: Record<string, unknown> | null; error: null }>; }
  private async run() { return this.request(false) as Promise<{ data: Record<string, unknown>[]; error: null }>; }
  private async request(single: boolean) {
    const result = await dbRequest({ data: { table: this.table as DbTable, operation: this.operation, columns: this.columns, filters: this.filters, order: this.orderValue, limit: this.limitValue, payload: this.payload, single } });
    if (single) return { data: result.data[0] ?? null, error: result.error };
    return result;
  }
}

const localAuth = createLocalClient().auth;
export const supabase = {
  from: (table: string) => new RemoteQuery(table),
  auth: localAuth,
} as never as import("@supabase/supabase-js").SupabaseClient<Database>;
