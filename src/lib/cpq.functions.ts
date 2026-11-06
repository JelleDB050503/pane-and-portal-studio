import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import { loadCatalog, rulesVersion } from "@/lib/cpq/catalog-loader";
import { generateBom } from "@/lib/cpq/bom";
import { computeItem, fromCents } from "@/lib/cpq/pricing";
import { evaluateConfiguration, normalizeConfig, setFieldValue } from "@/lib/cpq/rules";
import { buildSnapshot, totalsToColumns, type RevisionSnapshot } from "@/lib/cpq/snapshot";
import { checkDiscountPolicy } from "@/lib/cpq/totals";
import type { Catalog, ItemConfig } from "@/lib/cpq/types";
import { getJorpaConnector, type JorpaQuotePayload } from "@/lib/connectors/jorpa";

// All writes to configuration items, quotes, approvals and integration jobs go
// through these server functions: validation + pricing are re-run here, never trusted from the browser.

type Sb = SupabaseClient<Database>;
type AppRole = Database["public"]["Enums"]["app_role"];
const ROLES = ["verkoper", "productbeheerder", "manager", "productie"] as const;
const SALES: AppRole[] = ["verkoper", "manager"];

async function getAdmin(): Promise<Sb> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function currentRole(sb: Sb, userId: string): Promise<AppRole> {
  const { data, error } = await sb.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error("Rol kon niet gecontroleerd worden.");
  const role = data?.[0]?.role;
  if (!role) throw new Error("Aan deze gebruiker is geen rol toegekend.");
  return role;
}

async function requireRoles(sb: Sb, userId: string, allowed: AppRole[]): Promise<AppRole> {
  const role = await currentRole(sb, userId);
  if (!allowed.includes(role)) throw new Error(`Deze actie is niet toegestaan voor de rol ${role}.`);
  return role;
}

async function priceBookForProject(sb: Sb, projectId: string): Promise<string | null> {
  const { data: p } = await sb.from("projects").select("company_id").eq("id", projectId).single();
  if (!p) throw new Error("Project niet gevonden.");
  const { data: c } = await sb.from("companies").select("price_book_id").eq("id", p.company_id).single();
  return c?.price_book_id ?? null;
}

const itemConfigSchema = z.object({
  product_code: z.string().nullable().optional(),
  family: z.string().min(1).max(40),
  material: z.string().max(40),
  system: z.string().max(40),
  width_mm: z.number().int().min(0).max(20000),
  height_mm: z.number().int().min(0).max(20000),
  quantity: z.number().int().min(0).max(999),
  sections: z.array(z.object({ opening: z.string().max(40), hinge: z.string().max(20).nullable().optional() })).min(1).max(4),
  values: z.record(z.string().max(40)),
  services: z.array(z.string().max(40)).max(20),
  remarks: z.string().max(2000),
  production_notes: z.string().max(2000),
});

function validationRecord(catalog: Catalog, data: Partial<ItemConfig>) {
  const comp = computeItem(catalog, data);
  const ev = comp.evaluation;
  return {
    comp,
    columns: {
      data: ev.config as unknown as Json,
      status: ev.status,
      validation: {
        status: ev.status,
        production_ready: ev.productionReady,
        issues: ev.issues,
        not_configured: ev.notConfigured,
        auto_included: ev.autoIncluded,
        rules_version: rulesVersion(catalog),
        price_book_code: catalog.priceBook?.code ?? null,
        checked_at: new Date().toISOString(),
      } as unknown as Json,
      net_total: fromCents(comp.price.net_cents),
      price_book_version: catalog.priceBook?.version ?? null,
    },
  };
}

// ---------------------------------------------------------------- demo login
const DEMO_NAMES: Record<AppRole, string> = {
  verkoper: "Sanne Verkoper (demo)",
  productbeheerder: "Jonas Productbeheer (demo)",
  manager: "Els Manager (demo)",
  productie: "Koen Productie (demo)",
};

/**
 * PROTOTYPE-ONLY one-click login for the four demo roles. Creates the demo account on
 * first use and returns a session. Remove or disable before any non-demo deployment.
 */
export const demoSignIn = createServerFn({ method: "POST" })
  .inputValidator((d: { role: string }) => z.object({ role: z.enum(ROLES) }).parse(d))
  .handler(async ({ data }) => {
    const admin = await getAdmin();
    const email = `demo-${data.role}@jorpa-demo.example.com`;
    const fullName = DEMO_NAMES[data.role];

    const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) {
      console.error("demoSignIn listUsers", listErr.message);
      throw new Error("Demo-login is momenteel niet beschikbaar.");
    }
    let userId = list.users.find((u) => u.email === email)?.id ?? null;
    if (!userId) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password: `${crypto.randomUUID()}${crypto.randomUUID()}`,
        email_confirm: true,
        user_metadata: { full_name: fullName, demo: true },
      });
      if (error || !created.user) {
        console.error("demoSignIn createUser", error?.message);
        throw new Error("Demo-account kon niet aangemaakt worden.");
      }
      userId = created.user.id;
    }
    await admin.from("profiles").upsert({ id: userId, full_name: fullName, email });
    await admin.from("user_roles").upsert({ user_id: userId, role: data.role }, { onConflict: "user_id,role", ignoreDuplicates: true });

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    const tokenHash = link?.properties?.hashed_token;
    if (linkErr || !tokenHash) {
      console.error("demoSignIn generateLink", linkErr?.message);
      throw new Error("Demo-sessie kon niet gestart worden.");
    }
    const url = process.env["SUPABASE_URL"]!;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const pub = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: verified, error: vErr } = await pub.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
    if (vErr || !verified.session) {
      console.error("demoSignIn verifyOtp", vErr?.message);
      throw new Error("Demo-sessie kon niet gestart worden.");
    }
    return { access_token: verified.session.access_token, refresh_token: verified.session.refresh_token };
  });

// ---------------------------------------------------------- configuration items
export const saveConfigurationItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; data: unknown; manualOverrides: string[]; expectedVersion: number }) =>
    z
      .object({ id: z.string().uuid(), data: itemConfigSchema, manualOverrides: z.array(z.string().max(40)).max(40), expectedVersion: z.number().int() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await requireRoles(sb, context.userId, SALES);
    const { data: row, error } = await sb.from("configuration_items").select("id, version, configuration_id").eq("id", data.id).single();
    if (error || !row) throw new Error("Configuratie niet gevonden.");
    if (row.version !== data.expectedVersion) throw new Error("Iemand anders heeft deze configuratie intussen gewijzigd. Herlaad de pagina.");
    const { data: conf } = await sb.from("configurations").select("project_id").eq("id", row.configuration_id).single();
    const catalog = await loadCatalog(sb, { priceBookId: await priceBookForProject(sb, conf!.project_id) });
    const { comp, columns } = validationRecord(catalog, data.data as ItemConfig);
    const admin = await getAdmin();
    const { data: updated, error: upErr } = await admin
      .from("configuration_items")
      .update({ ...columns, manual_overrides: data.manualOverrides, version: row.version + 1, updated_by: context.userId })
      .eq("id", row.id)
      .eq("version", row.version)
      .select("id, version")
      .maybeSingle();
    if (upErr || !updated) throw new Error("Opslaan mislukt: de configuratie werd intussen gewijzigd.");
    return {
      version: updated.version,
      status: comp.evaluation.status,
      issues: comp.evaluation.issues,
      net_cents: comp.price.net_cents,
    };
  });

export const addProjectItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { projectId: string; label: string; productCode: string | null; family: string }) =>
    z.object({ projectId: z.string().uuid(), label: z.string().trim().min(1).max(120), productCode: z.string().max(40).nullable(), family: z.string().max(40) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await requireRoles(sb, context.userId, SALES);
    const { data: items } = await sb.from("project_items").select("seq").eq("project_id", data.projectId).order("seq", { ascending: false }).limit(1);
    const seq = (items?.[0]?.seq ?? 0) + 1;
    const { data: pi, error } = await sb.from("project_items").insert({ project_id: data.projectId, seq, label: data.label }).select("id").single();
    if (error || !pi) throw new Error("Item kon niet aangemaakt worden.");

    const catalog = await loadCatalog(sb, { priceBookId: await priceBookForProject(sb, data.projectId) });
    const product = catalog.products.find((p) => p.code === data.productCode);
    const base = normalizeConfig({ family: data.family, ...(product?.default_config ?? {}), product_code: product?.code ?? null });
    const { data: configs } = await sb.from("configurations").select("id").eq("project_id", data.projectId).is("deleted_at", null);
    const admin = await getAdmin();
    const ids: Record<string, string> = {};
    for (const c of configs ?? []) {
      const { columns } = validationRecord(catalog, base);
      const { data: ci, error: e2 } = await admin
        .from("configuration_items")
        .insert({ configuration_id: c.id, project_item_id: pi.id, ...columns, updated_by: context.userId })
        .select("id")
        .single();
      if (e2 || !ci) throw new Error("Configuratie kon niet aangemaakt worden.");
      ids[c.id] = ci.id;
    }
    return { projectItemId: pi.id, configurationItemIds: ids };
  });

export const duplicateProjectItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { configurationItemId: string }) => z.object({ configurationItemId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await requireRoles(sb, context.userId, SALES);
    const { data: src } = await sb.from("configuration_items").select("id, project_item_id, configuration_id").eq("id", data.configurationItemId).single();
    if (!src) throw new Error("Item niet gevonden.");
    const { data: pi } = await sb.from("project_items").select("project_id, label").eq("id", src.project_item_id).single();
    if (!pi) throw new Error("Item niet gevonden.");
    const { data: last } = await sb.from("project_items").select("seq").eq("project_id", pi.project_id).order("seq", { ascending: false }).limit(1);
    const { data: copy, error } = await sb
      .from("project_items")
      .insert({ project_id: pi.project_id, seq: (last?.[0]?.seq ?? 0) + 1, label: `${pi.label} (kopie)` })
      .select("id")
      .single();
    if (error || !copy) throw new Error("Kopiëren mislukt.");
    const { data: siblings } = await sb.from("configuration_items").select("configuration_id, data, manual_overrides, status, validation, net_total, price_book_version").eq("project_item_id", src.project_item_id);
    const admin = await getAdmin();
    let newId = "";
    for (const s of siblings ?? []) {
      const { data: ci } = await admin
        .from("configuration_items")
        .insert({ ...s, project_item_id: copy.id, updated_by: context.userId })
        .select("id, configuration_id")
        .single();
      if (ci && ci.configuration_id === src.configuration_id) newId = ci.id;
    }
    return { configurationItemId: newId };
  });

const BULK_FIELDS = ["system", "kleur_binnen", "kleur_buiten", "glas", "beslag", "ventilatie", "vliegenraam", "zonwering"] as const;

export const bulkApplyChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { configurationItemIds: string[]; field: string; value: string; overwriteExceptions: boolean }) =>
    z
      .object({
        configurationItemIds: z.array(z.string().uuid()).min(1).max(200),
        field: z.enum(BULK_FIELDS),
        value: z.string().min(1).max(40),
        overwriteExceptions: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await requireRoles(sb, context.userId, SALES);
    const { data: rows } = await sb.from("configuration_items").select("id, version, data, manual_overrides, configuration_id").in("id", data.configurationItemIds);
    if (!rows?.length) throw new Error("Geen items gevonden.");
    const configIds = [...new Set(rows.map((r) => r.configuration_id))];
    const { data: confs } = await sb.from("configurations").select("id, project_id").in("id", configIds);
    const projectIds = [...new Set((confs ?? []).map((c) => c.project_id))];
    if (projectIds.length !== 1) throw new Error("Een groepswijziging moet binnen één project blijven.");
    const catalog = await loadCatalog(sb, { priceBookId: await priceBookForProject(sb, projectIds[0]!) });
    const admin = await getAdmin();
    let changed = 0;
    const skipped: string[] = [];
    for (const r of rows) {
      const overrides = r.manual_overrides ?? [];
      if (overrides.includes(data.field) && !data.overwriteExceptions) {
        skipped.push(r.id);
        continue;
      }
      let cfg = normalizeConfig(r.data as unknown as ItemConfig);
      if (data.field === "system") {
        const sys = catalog.systems.find((s) => s.code === data.value);
        if (!sys) throw new Error("Onbekend systeem.");
        cfg = { ...cfg, system: sys.code, material: sys.material };
      } else cfg = setFieldValue(cfg, data.field, data.value);
      const { columns } = validationRecord(catalog, cfg);
      const { error } = await admin
        .from("configuration_items")
        .update({ ...columns, manual_overrides: overrides.filter((f) => f !== data.field), version: r.version + 1, updated_by: context.userId })
        .eq("id", r.id)
        .eq("version", r.version);
      if (error) throw new Error("Groepswijziging gedeeltelijk mislukt. Herlaad de pagina.");
      changed++;
    }
    return { changed, skipped: skipped.length };
  });

export const createVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sourceConfigurationId: string; name: string; description: string }) =>
    z.object({ sourceConfigurationId: z.string().uuid(), name: z.string().trim().min(1).max(120), description: z.string().max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await requireRoles(sb, context.userId, SALES);
    const { data: src } = await sb.from("configurations").select("id, project_id").eq("id", data.sourceConfigurationId).single();
    if (!src) throw new Error("Variant niet gevonden.");
    const { data: conf, error } = await sb
      .from("configurations")
      .insert({ project_id: src.project_id, name: data.name, description: data.description, is_primary: false, source_configuration_id: src.id })
      .select("id")
      .single();
    if (error || !conf) throw new Error("Variant kon niet aangemaakt worden.");
    const { data: items } = await sb.from("configuration_items").select("project_item_id, data, manual_overrides, status, validation, net_total, price_book_version").eq("configuration_id", src.id);
    if (items?.length) {
      const admin = await getAdmin();
      const { error: e2 } = await admin.from("configuration_items").insert(items.map((i) => ({ ...i, configuration_id: conf.id, updated_by: context.userId })));
      if (e2) throw new Error("Items konden niet gekopieerd worden.");
    }
    return { configurationId: conf.id };
  });

// --------------------------------------------------------------------- quotes
async function loadVariantInputs(sb: Sb, configurationIds: string[]) {
  const { data: confs } = await sb.from("configurations").select("id, name").in("id", configurationIds);
  const { data: items } = await sb.from("configuration_items").select("id, configuration_id, project_item_id, data").in("configuration_id", configurationIds);
  const piIds = [...new Set((items ?? []).map((i) => i.project_item_id))];
  const { data: pis } = piIds.length ? await sb.from("project_items").select("id, seq, label, deleted_at").in("id", piIds) : { data: [] };
  const piMap = new Map((pis ?? []).filter((p) => !p.deleted_at).map((p) => [p.id, p]));
  return configurationIds.map((cid, idx) => ({
    configuration_id: cid,
    name: confs?.find((c) => c.id === cid)?.name ?? "Variant",
    is_alternative: idx > 0,
    items: (items ?? [])
      .filter((i) => i.configuration_id === cid && piMap.has(i.project_item_id))
      .map((i) => ({
        configuration_item_id: i.id,
        project_item_id: i.project_item_id,
        seq: piMap.get(i.project_item_id)!.seq,
        label: piMap.get(i.project_item_id)!.label,
        data: i.data as unknown as ItemConfig,
      })),
  }));
}

export const createQuoteRevision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { projectId: string; primaryConfigurationId: string; alternativeConfigurationIds: string[]; discountPercent: number; templateId: string | null }) =>
    z
      .object({
        projectId: z.string().uuid(),
        primaryConfigurationId: z.string().uuid(),
        alternativeConfigurationIds: z.array(z.string().uuid()).max(5),
        discountPercent: z.number().min(0).max(100),
        templateId: z.string().uuid().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    const role = await requireRoles(sb, context.userId, SALES);
    const admin = await getAdmin();
    const { data: project } = await sb.from("projects").select("*").eq("id", data.projectId).single();
    if (!project) throw new Error("Project niet gevonden.");
    const { data: company } = await sb.from("companies").select("*").eq("id", project.company_id).single();
    const { data: contact } = project.contact_id ? await sb.from("contacts").select("*").eq("id", project.contact_id).single() : { data: null };
    const tplQuery = data.templateId ? sb.from("quote_templates").select("*").eq("id", data.templateId) : sb.from("quote_templates").select("*").eq("is_default", true);
    const { data: tpls } = await tplQuery.limit(1);
    const tpl = tpls?.[0] ?? null;

    const catalog = await loadCatalog(sb, { priceBookId: company?.price_book_id ?? null, includeCosts: true, costClient: admin });
    const configIds = [data.primaryConfigurationId, ...data.alternativeConfigurationIds.filter((id) => id !== data.primaryConfigurationId)];
    const variants = await loadVariantInputs(sb, configIds);
    if (!variants[0]?.items.length) throw new Error("De hoofdvariant bevat geen items.");

    const now = new Date();
    const validUntil = new Date(now.getTime() + (tpl?.validity_days ?? 30) * 86400000).toISOString().slice(0, 10);
    const discount = Math.round(data.discountPercent * 100) / 100;
    const built = buildSnapshot({
      catalog,
      generatedAt: now.toISOString(),
      project: { id: project.id, number: project.project_number, name: project.name, street: project.street, postal_code: project.postal_code, city: project.city },
      customer: {
        name: company?.name ?? "",
        street: company?.street ?? null,
        postal_code: company?.postal_code ?? null,
        city: company?.city ?? null,
        vat_number: company?.vat_number ?? null,
        contact: contact ? `${contact.first_name} ${contact.last_name}` : null,
        email: contact?.email ?? company?.email ?? null,
      },
      template: tpl ? { name: tpl.name, intro: tpl.intro_text, conditions: tpl.conditions_text } : null,
      discountPercent: discount,
      vatRate: Number(project.vat_rate),
      validUntil,
      variants,
    });
    if (built.blocking.length) throw new Error(`Offerte geblokkeerd — los eerst deze fouten op: ${built.blocking.join(" | ")}`);
    const totals = built.primaryTotals!;
    const policy = checkDiscountPolicy(catalog.discounts, role, discount, totals.margin_percent);
    if (!policy.allowed) throw new Error(policy.reasons.join(" "));

    // find or create quote
    const { data: quotes } = await sb.from("quotes").select("*").eq("project_id", project.id).order("created_at", { ascending: false }).limit(1);
    let quote = quotes?.[0] ?? null;
    if (!quote) {
      const { data: q, error } = await admin.from("quotes").insert({ project_id: project.id, title: `Offerte ${project.name}`, created_by: context.userId, updated_by: context.userId }).select("*").single();
      if (error || !q) throw new Error("Offerte kon niet aangemaakt worden.");
      quote = q;
    }
    const { data: revs } = await sb.from("quote_revisions").select("*").eq("quote_id", quote.id).order("revision_no", { ascending: false }).limit(1);
    const latest = revs?.[0] ?? null;

    const columns = {
      status: "concept" as const,
      primary_configuration_id: data.primaryConfigurationId,
      alternative_configuration_ids: configIds.slice(1),
      discount_percent: discount,
      vat_rate: Number(project.vat_rate),
      valid_until: validUntil,
      template_id: tpl?.id ?? null,
      ...totalsToColumns(totals),
      price_book_id: catalog.priceBook?.id ?? null,
      price_book_code: catalog.priceBook?.code ?? null,
      price_book_version: catalog.priceBook?.version ?? null,
      rules_version: built.snapshot.rules_version,
      snapshot: built.snapshot as unknown as Json,
      requires_approval: policy.requiresApproval,
      approval_reasons: policy.reasons,
      production_ready: built.productionReady,
      updated_by: context.userId,
    };

    let revisionId: string;
    let revisionNo: number;
    if (latest && !latest.locked && (latest.status === "concept" || latest.status === "interne_controle")) {
      const { error } = await admin.from("quote_revisions").update(columns).eq("id", latest.id);
      if (error) throw new Error(`Herberekenen mislukt: ${error.message}`);
      await admin
        .from("approvals")
        .update({ status: "afgewezen", comment: "Vervangen door herberekening", decided_at: now.toISOString(), updated_by: context.userId })
        .eq("revision_id", latest.id)
        .eq("status", "in_afwachting");
      revisionId = latest.id;
      revisionNo = latest.revision_no;
    } else {
      revisionNo = (latest?.revision_no ?? 0) + 1;
      const { data: rev, error } = await admin.from("quote_revisions").insert({ ...columns, quote_id: quote.id, revision_no: revisionNo, created_by: context.userId }).select("id").single();
      if (error || !rev) throw new Error(`Revisie kon niet aangemaakt worden: ${error?.message ?? ""}`);
      revisionId = rev.id;
    }

    await admin.from("quote_lines").delete().eq("revision_id", revisionId);
    const lines = built.snapshot.variants.flatMap((v) =>
      v.items.map((it) => ({
        revision_id: revisionId,
        configuration_id: v.configuration_id,
        variant_name: v.name,
        is_alternative: v.is_alternative,
        seq: it.seq,
        label: it.label,
        description: it.description,
        quantity: it.price.quantity,
        unit_price: fromCents(Math.round(it.price.net_cents / Math.max(1, it.price.quantity))),
        line_total: fromCents(it.price.net_cents),
        status: it.status,
      })),
    );
    if (lines.length) await admin.from("quote_lines").insert(lines);
    await admin.from("quote_revision_costs").upsert({
      revision_id: revisionId,
      cost_total: totals.cost_cents === null ? null : fromCents(totals.cost_cents),
      margin_amount: totals.margin_cents === null ? null : fromCents(totals.margin_cents),
      margin_percent: totals.margin_percent,
    });
    await admin.from("quotes").update({ status: "concept", current_revision_no: revisionNo, updated_by: context.userId }).eq("id", quote.id);
    if (project.status === "in_opmaak" || project.status === "lead") await sb.from("projects").update({ status: "offerte" }).eq("id", project.id);

    return { revisionId, quoteId: quote.id, revisionNo, requiresApproval: policy.requiresApproval, reasons: policy.reasons };
  });

type QuoteStatus = Database["public"]["Enums"]["quote_status"];
const TRANSITIONS: Record<string, { from: QuoteStatus[]; roles: AppRole[] }> = {
  submit: { from: ["concept"], roles: SALES },
  approve: { from: ["interne_controle"], roles: ["manager"] },
  reject: { from: ["interne_controle"], roles: ["manager"] },
  send: { from: ["goedgekeurd"], roles: SALES },
  accept: { from: ["verzonden"], roles: SALES },
  decline: { from: ["verzonden"], roles: SALES },
  expire: { from: ["goedgekeurd", "verzonden"], roles: SALES },
};
const LOCKED_STATES: QuoteStatus[] = ["goedgekeurd", "verzonden", "aanvaard", "afgewezen", "vervallen"];

export const transitionQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { revisionId: string; action: string; comment?: string }) =>
    z
      .object({ revisionId: z.string().uuid(), action: z.enum(["submit", "approve", "reject", "send", "accept", "decline", "expire"]), comment: z.string().max(1000).optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    const role = await currentRole(sb, context.userId);
    const rule = TRANSITIONS[data.action];
    if (!rule) throw new Error("Onbekende actie.");
    if (!rule.roles.includes(role)) throw new Error(`De rol ${role} mag deze actie niet uitvoeren.`);
    const { data: rev } = await sb.from("quote_revisions").select("*").eq("id", data.revisionId).single();
    if (!rev) throw new Error("Revisie niet gevonden.");
    if (!rule.from.includes(rev.status)) throw new Error(`Actie niet mogelijk vanuit status "${rev.status}".`);
    const { data: latest } = await sb.from("quote_revisions").select("id").eq("quote_id", rev.quote_id).order("revision_no", { ascending: false }).limit(1);
    if (latest?.[0]?.id !== rev.id) throw new Error("Enkel de laatste revisie kan van status veranderen.");

    const now = new Date().toISOString();
    let to: QuoteStatus;
    switch (data.action) {
      case "submit":
        to = rev.requires_approval ? "interne_controle" : "goedgekeurd";
        break;
      case "approve":
        to = "goedgekeurd";
        break;
      case "reject":
        to = "concept";
        break;
      case "send":
        to = "verzonden";
        break;
      case "accept":
        to = "aanvaard";
        break;
      case "decline":
        to = "afgewezen";
        break;
      default:
        to = "vervallen";
    }
    const admin = await getAdmin();
    const patch: Database["public"]["Tables"]["quote_revisions"]["Update"] = { status: to, updated_by: context.userId, locked: rev.locked || LOCKED_STATES.includes(to) };
    if (data.action === "submit") patch.submitted_at = now;
    if (to === "goedgekeurd") patch.approved_at = now;
    if (to === "verzonden") patch.sent_at = now;
    if (to === "aanvaard" || to === "afgewezen") patch.decided_at = now;
    const { error } = await admin.from("quote_revisions").update(patch).eq("id", rev.id);
    if (error) throw new Error(`Statuswijziging mislukt: ${error.message}`);

    if (data.action === "submit") {
      await admin.from("approvals").insert({
        revision_id: rev.id,
        requested_by: context.userId,
        updated_by: context.userId,
        reason: rev.requires_approval ? rev.approval_reasons.join(" ") : "Binnen kortings- en margegrenzen: automatisch goedgekeurd.",
        status: rev.requires_approval ? "in_afwachting" : "automatisch",
        decided_at: rev.requires_approval ? null : now,
      });
    }
    if (data.action === "approve" || data.action === "reject") {
      await admin
        .from("approvals")
        .update({ status: data.action === "approve" ? "goedgekeurd" : "afgewezen", decided_by: context.userId, decided_at: now, comment: data.comment ?? null, updated_by: context.userId })
        .eq("revision_id", rev.id)
        .eq("status", "in_afwachting");
    }
    await admin.from("quotes").update({ status: to, updated_by: context.userId }).eq("id", rev.quote_id);
    if (to === "aanvaard" || to === "afgewezen") {
      const { data: q } = await sb.from("quotes").select("project_id").eq("id", rev.quote_id).single();
      if (q) await sb.from("projects").update({ status: to === "aanvaard" ? "gewonnen" : "verloren" }).eq("id", q.project_id);
    }
    return { status: to };
  });

// ------------------------------------------------------------ JoRPA (mock only)
export const sendToJorpa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { revisionId: string; simulate: string }) =>
    z.object({ revisionId: z.string().uuid(), simulate: z.enum(["none", "timeout", "server_error"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as Sb;
    await requireRoles(sb, context.userId, SALES);
    const { data: rev } = await sb.from("quote_revisions").select("*").eq("id", data.revisionId).single();
    if (!rev) throw new Error("Revisie niet gevonden.");
    if (!["goedgekeurd", "verzonden", "aanvaard"].includes(rev.status)) throw new Error("Enkel goedgekeurde, verzonden of aanvaarde revisies kunnen doorgestuurd worden.");
    const { data: quote } = await sb.from("quotes").select("*").eq("id", rev.quote_id).single();
    const snap = rev.snapshot as unknown as RevisionSnapshot;
    const primary = snap.variants.find((v) => !v.is_alternative);
    if (!quote || !primary) throw new Error("Offertegegevens onvolledig.");

    const catalog = await loadCatalog(sb, { priceBookId: rev.price_book_id });
    const key = `quote_revision:${rev.id}:push_quote`;
    const payload: JorpaQuotePayload = {
      idempotency_key: key,
      source: "cpq-demo",
      demo: true,
      quote_number: quote.quote_number,
      revision_no: rev.revision_no,
      project_number: snap.project.number,
      customer_ref: null,
      currency: "EUR",
      total_net: Number(rev.total_net),
      vat_rate: Number(rev.vat_rate),
      price_book: snap.price_book ? { code: snap.price_book.code, version: snap.price_book.version } : null,
      rules_version: snap.rules_version,
      items: primary.items.map((it) => {
        const ev = evaluateConfiguration(catalog, it.config);
        const bom = generateBom(catalog, ev);
        return {
          position: it.seq,
          label: it.label,
          family: it.config.family,
          system: it.config.system,
          material: it.config.material,
          width_mm: it.config.width_mm,
          height_mm: it.config.height_mm,
          quantity: it.config.quantity,
          sections: it.config.sections.map((s) => ({ opening: s.opening, hinge: s.hinge ?? null })),
          options: it.config.values,
          services: it.config.services,
          production_notes: it.config.production_notes,
          production_ready: it.production_ready,
          bom: bom.manufacturing.map((n) => ({ assembly: n.code, lines: n.lines.map((l) => ({ component_code: l.component_code, description: l.description, quantity: l.qty_total, unit: l.unit })) })),
        };
      }),
    };

    const admin = await getAdmin();
    const { data: existing } = await admin.from("integration_jobs").select("*").eq("idempotency_key", key).maybeSingle();
    if (existing?.status === "geslaagd") {
      await admin.from("sync_events").insert({ job_id: existing.id, event_type: "duplicaat", message: "Al succesvol verstuurd: geen nieuwe order aangemaakt (idempotent)." });
      return { jobId: existing.id, status: existing.status, duplicate: true };
    }
    const now = new Date().toISOString();
    let jobId: string;
    let attempt: number;
    if (existing) {
      attempt = existing.attempts + 1;
      if (attempt > 5) throw new Error("Maximum aantal pogingen (5) bereikt. Neem contact op met de beheerder.");
      await admin.from("integration_jobs").update({ status: "bezig", attempts: attempt, payload: payload as unknown as Json, last_attempt_at: now, updated_by: context.userId }).eq("id", existing.id);
      jobId = existing.id;
    } else {
      attempt = 1;
      const { data: job, error } = await admin
        .from("integration_jobs")
        .insert({ entity_type: "quote_revision", entity_id: rev.id, action: "push_quote", idempotency_key: key, status: "bezig", attempts: 1, payload: payload as unknown as Json, last_attempt_at: now, created_by: context.userId, updated_by: context.userId })
        .select("id")
        .single();
      if (error || !job) throw new Error("Integratietaak kon niet aangemaakt worden.");
      jobId = job.id;
    }
    await admin.from("sync_events").insert({ job_id: jobId, event_type: "poging", message: `Poging ${attempt} naar ${getJorpaConnector().name} (geen echte externe call).` });

    const connector = getJorpaConnector();
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 10000));
    const result = await Promise.race([connector.pushQuote(payload, { simulate: data.simulate as "none", attempt }), timeout]).catch(
      () => ({ ok: false as const, error_code: "CONNECTOR-TIMEOUT", error_message: "Geen antwoord binnen 10 s.", retryable: true, response: {} }),
    );
    if (result.ok) {
      await admin.from("integration_jobs").update({ status: "geslaagd", response: result.response as Json, external_ref: result.external_ref, error_code: null, error_message: null, updated_by: context.userId }).eq("id", jobId);
      await admin.from("sync_events").insert({ job_id: jobId, event_type: "geslaagd", message: `Mock-antwoord: order ${result.external_ref} aangemaakt.` });
    } else {
      await admin.from("integration_jobs").update({ status: "mislukt", response: result.response as Json, error_code: result.error_code, error_message: result.error_message, updated_by: context.userId }).eq("id", jobId);
      await admin.from("sync_events").insert({ job_id: jobId, event_type: "mislukt", message: `${result.error_code}: ${result.error_message}${result.retryable ? " (opnieuw proberen mogelijk)" : ""}` });
    }
    await sb.from("projects").update({ sync_status: result.ok ? "gesynchroniseerd (mock)" : "synchronisatie mislukt (mock)" }).eq("id", snap.project.id);
    return { jobId, status: result.ok ? "geslaagd" : "mislukt", duplicate: false };
  });
