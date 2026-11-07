import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loadCatalog } from "@/lib/cpq/catalog-loader";

// Browser-side reads. Row-level security in the database decides what each role sees.

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export const catalogQuery = (priceBookId: string | null, includeCosts: boolean) =>
  queryOptions({
    queryKey: ["catalog", priceBookId, includeCosts],
    queryFn: () => loadCatalog(supabase, { priceBookId, includeCosts }),
    staleTime: 60_000,
  });

export const companiesQuery = () =>
  queryOptions({
    queryKey: ["companies"],
    queryFn: async () =>
      check(await supabase.from("companies").select("*, contacts(id, first_name, last_name, is_primary, deleted_at), projects(id, deleted_at)").is("deleted_at", null).order("name")),
  });

export const companyQuery = (id: string) =>
  queryOptions({
    queryKey: ["company", id],
    queryFn: async () => {
      const [company, contacts, projects, books] = await Promise.all([
        supabase.from("companies").select("*").eq("id", id).maybeSingle(),
        supabase.from("contacts").select("*").eq("company_id", id).is("deleted_at", null).order("is_primary", { ascending: false }),
        supabase
          .from("projects")
          .select("id, project_number, name, status, city, desired_delivery_date, updated_at, quotes(id, quote_number, status, current_revision_no, updated_at, quote_revisions(id, revision_no, status, total_net, created_at))")
          .eq("company_id", id)
          .is("deleted_at", null)
          .order("updated_at", { ascending: false }),
        supabase.from("price_books").select("id, code, name"),
      ]);
      return { company: check(company), contacts: check(contacts) ?? [], projects: check(projects) ?? [], priceBooks: check(books) ?? [] };
    },
  });

export const projectsQuery = () =>
  queryOptions({
    queryKey: ["projects"],
    queryFn: async () =>
      check(
        await supabase
          .from("projects")
          .select("*, companies(id, name), contacts(first_name, last_name), project_items(id, deleted_at)")
          .is("deleted_at", null)
          .order("updated_at", { ascending: false }),
      ),
  });

export const profilesQuery = () =>
  queryOptions({
    queryKey: ["profiles"],
    queryFn: async () => check(await supabase.from("profiles").select("id, full_name, email").order("full_name")) ?? [],
    staleTime: 60_000,
  });

export const projectQuery = (id: string) =>
  queryOptions({
    queryKey: ["project", id],
    queryFn: async () => {
      const [project, items, configs, quotes, attachments] = await Promise.all([
        supabase.from("projects").select("*, companies(*), contacts(*)").eq("id", id).maybeSingle(),
        supabase.from("project_items").select("*").eq("project_id", id).is("deleted_at", null).order("seq"),
        supabase.from("configurations").select("*").eq("project_id", id).is("deleted_at", null).order("created_at"),
        supabase.from("quotes").select("*, quote_revisions(*)").eq("project_id", id).order("created_at"),
        supabase.from("attachments").select("*").eq("project_id", id).is("deleted_at", null).order("created_at", { ascending: false }),
      ]);
      const p = check(project);
      const configIds = (check(configs) ?? []).map((c) => c.id);
      const ci = configIds.length
        ? check(await supabase.from("configuration_items").select("*").in("configuration_id", configIds))
        : [];
      const revIds = (check(quotes) ?? []).flatMap((q) => q.quote_revisions.map((r) => r.id));
      const jobs = revIds.length
        ? check(await supabase.from("integration_jobs").select("*").in("entity_id", revIds).order("created_at", { ascending: false }))
        : [];
      return {
        project: p,
        items: check(items) ?? [],
        configurations: check(configs) ?? [],
        configItems: ci ?? [],
        quotes: check(quotes) ?? [],
        attachments: check(attachments) ?? [],
        jobs: jobs ?? [],
      };
    },
  });

export const configItemQuery = (id: string) =>
  queryOptions({
    queryKey: ["config-item", id],
    queryFn: async () => {
      const ci = check(await supabase.from("configuration_items").select("*").eq("id", id).maybeSingle());
      if (!ci) return null;
      const [pi, conf] = await Promise.all([
        supabase.from("project_items").select("*").eq("id", ci.project_item_id).single(),
        supabase.from("configurations").select("*").eq("id", ci.configuration_id).single(),
      ]);
      const configuration = check(conf);
      const project = check(await supabase.from("projects").select("id, name, project_number, companies(id, name, price_book_id)").eq("id", configuration.project_id).single());
      const siblings = check(
        await supabase.from("configuration_items").select("id, project_item_id").eq("configuration_id", ci.configuration_id),
      );
      const piList = check(await supabase.from("project_items").select("id, seq, label").eq("project_id", configuration.project_id).is("deleted_at", null).order("seq"));
      return { item: ci, projectItem: check(pi), configuration, project, siblings: siblings ?? [], projectItems: piList ?? [] };
    },
  });

export const revisionQuery = (id: string) =>
  queryOptions({
    queryKey: ["revision", id],
    queryFn: async () => {
      const rev = check(await supabase.from("quote_revisions").select("*").eq("id", id).maybeSingle());
      if (!rev) return null;
      const [quote, allRevs, approvals, costs, jobs, docs] = await Promise.all([
        supabase.from("quotes").select("*, projects(id, name, project_number, status, sync_status, companies(name))").eq("id", rev.quote_id).single(),
        supabase.from("quote_revisions").select("id, revision_no, status, total_net, created_at, locked").eq("quote_id", rev.quote_id).order("revision_no"),
        supabase.from("approvals").select("*").eq("revision_id", id).order("created_at"),
        supabase.from("quote_revision_costs").select("*").eq("revision_id", id).maybeSingle(),
        supabase.from("integration_jobs").select("*, sync_events(*)").eq("entity_id", id).order("created_at", { ascending: false }),
        supabase.from("documents").select("*").eq("quote_revision_id", id).order("created_at", { ascending: false }),
      ]);
      return {
        revision: rev,
        quote: check(quote),
        revisions: check(allRevs) ?? [],
        approvals: check(approvals) ?? [],
        costs: costs.error ? null : costs.data,
        jobs: check(jobs) ?? [],
        documents: check(docs) ?? [],
      };
    },
  });

export const dashboardQuery = () =>
  queryOptions({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [quotes, projects, approvals] = await Promise.all([
        supabase
          .from("quotes")
          .select("id, quote_number, status, title, current_revision_no, updated_at, projects(id, name, project_number, companies(name)), quote_revisions(id, revision_no, status, total_net, requires_approval, created_at)")
          .order("updated_at", { ascending: false }),
        supabase.from("projects").select("id, project_number, name, status, updated_at, desired_delivery_date, companies(name)").is("deleted_at", null).order("updated_at", { ascending: false }).limit(6),
        supabase.from("approvals").select("id, status, reason, created_at, revision_id").eq("status", "in_afwachting").order("created_at"),
      ]);
      return { quotes: check(quotes) ?? [], projects: check(projects) ?? [], approvals: check(approvals) ?? [] };
    },
  });

export const productionQuery = () =>
  queryOptions({
    queryKey: ["production"],
    queryFn: async () =>
      check(
        await supabase
          .from("quote_revisions")
          .select("id, revision_no, status, production_ready, approved_at, updated_at, quotes(quote_number, projects(id, name, project_number, desired_delivery_date, companies(name)))")
          .in("status", ["goedgekeurd", "verzonden", "aanvaard"])
          .order("updated_at", { ascending: false }),
      ) ?? [],
  });
