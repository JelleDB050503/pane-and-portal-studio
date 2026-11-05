import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type {
  BomLineDef,
  BomTemplate,
  Catalog,
  Condition,
  Discount,
  Family,
  OptionDef,
  OptionValue,
  PriceBook,
  PriceEntry,
  Product,
  Rule,
  SystemDef,
} from "./types";

type Client = SupabaseClient<Database>;

function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Catalogus laden mislukt (${what}): ${res.error.message}`);
  return (res.data ?? []) as T;
}

export interface LoadCatalogOptions {
  priceBookId?: string | null;
  /** ISO date used for price-book validity, defaults to today */
  date?: string;
  /** Load cost prices (RLS returns nothing for roles without access). */
  includeCosts?: boolean;
  /** Use another client for costs (server: service role after role check). */
  costClient?: Client;
}

export function isPriceBookValid(pb: { valid_from: string | null; valid_to: string | null; status?: string }, date: string): boolean {
  if (pb.status && pb.status !== "actief") return false;
  if (pb.valid_from && date < pb.valid_from) return false;
  if (pb.valid_to && date > pb.valid_to) return false;
  return true;
}

/** Loads the full (demo) catalog through the given client. Works in browser and server. */
export async function loadCatalog(client: Client, opts: LoadCatalogOptions = {}): Promise<Catalog> {
  const date = opts.date ?? new Date().toISOString().slice(0, 10);
  const [fam, prod, sys, opt, val, rules, books, disc, tpl, lines] = await Promise.all([
    client.from("product_families").select("*").order("sort"),
    client.from("products").select("*").order("sort"),
    client.from("systems").select("*").order("sort"),
    client.from("options").select("*").order("sort"),
    client.from("option_values").select("*").order("sort"),
    client.from("configuration_rules").select("*").is("deleted_at", null).order("code"),
    client.from("price_books").select("*"),
    client.from("discounts").select("*"),
    client.from("bom_templates").select("*").order("sort"),
    client.from("bom_lines").select("*").order("sort"),
  ]);

  const options = must(opt, "opties") as unknown as OptionDef[];
  const optionCode = new Map(options.map((o) => [o.id, o.code]));
  const values: OptionValue[] = (must(val, "optiewaarden") as unknown as Omit<OptionValue, "option_code">[]).map((v) => ({
    ...v,
    option_code: optionCode.get(v.option_id) ?? "",
    attributes: (v.attributes ?? {}) as Record<string, unknown>,
  }));

  const allBooks = must(books, "prijsboeken") as unknown as (PriceBook & { is_default: boolean; status: string })[];
  let book = opts.priceBookId ? allBooks.find((b) => b.id === opts.priceBookId) : undefined;
  if (!book || !isPriceBookValid(book, date)) book = allBooks.find((b) => b.is_default && isPriceBookValid(b, date));
  const bookIds = book ? [book.id, ...(book.parent_price_book_id ? [book.parent_price_book_id] : [])] : [];

  let priceEntries: PriceEntry[] = [];
  if (bookIds.length) {
    const res = await client.from("price_book_entries").select("*").in("price_book_id", bookIds).range(0, 4999);
    const rows = must(res, "prijzen") as unknown as PriceEntry[];
    // own entries first so they take precedence over inherited ones
    priceEntries = [...rows.filter((r) => r.price_book_id === book!.id), ...rows.filter((r) => r.price_book_id !== book!.id)].map((r) => ({
      ...r,
      amount: Number(r.amount),
    }));
  }

  let costs: Record<string, number> | null = null;
  if (opts.includeCosts) {
    const res = await (opts.costClient ?? client).from("component_costs").select("component_code, unit_cost");
    const rows = (res.data ?? []) as { component_code: string; unit_cost: number }[];
    if (!res.error && rows.length) costs = Object.fromEntries(rows.map((r) => [r.component_code, Number(r.unit_cost)]));
  }

  return {
    families: must(fam, "families") as unknown as Family[],
    products: must(prod, "producten") as unknown as Product[],
    systems: must(sys, "systemen") as unknown as SystemDef[],
    options,
    values,
    rules: (must(rules, "regels") as unknown as Rule[]).map((r) => ({ ...r, conditions: (r.conditions ?? []) as Condition[] })),
    priceBook: book
      ? {
          id: book.id,
          code: book.code,
          name: book.name,
          version: book.version,
          factor: Number(book.factor),
          valid_from: book.valid_from,
          valid_to: book.valid_to,
          parent_price_book_id: book.parent_price_book_id,
          vat_default: Number(book.vat_default),
        }
      : null,
    priceEntries,
    discounts: (must(disc, "kortingen") as unknown as Discount[]).map((d) => ({
      ...d,
      percent: d.percent === null ? null : Number(d.percent),
      approval_above_percent: d.approval_above_percent === null ? null : Number(d.approval_above_percent),
    })),
    bomTemplates: must(tpl, "BOM-sjablonen") as unknown as BomTemplate[],
    bomLines: (must(lines, "BOM-regels") as unknown as BomLineDef[]).map((l) => ({ ...l, qty_factor: Number(l.qty_factor) })),
    costs,
  };
}

/** Highest rule version in the active set — recorded with every calculation. */
export function rulesVersion(catalog: Catalog): number {
  return catalog.rules.reduce((s, r) => s + (r.active ? r.version : 0), 0);
}
