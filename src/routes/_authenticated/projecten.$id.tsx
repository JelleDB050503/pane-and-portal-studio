import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { FileText, Pencil, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { catalogQuery, projectQuery, profilesQuery, type ProjectData } from "@/lib/queries";
import { computeItem } from "@/lib/cpq/pricing";
import { formatEur } from "@/lib/cpq/totals";
import type { ItemComputation } from "@/lib/cpq/types";
import { can } from "@/lib/auth";
import { PROJECT_STATUS_LABEL, SYNC_LABEL, formatDate, formatDateTime } from "@/lib/labels";
import { PageHeader, Panel, KeyValue, EmptyState, Field } from "@/components/cpq/page";
import { NotFoundBlock, RouteError } from "@/components/cpq/route-error";
import { QuoteStatusBadge, Tone } from "@/components/cpq/badges";
import { useMe } from "@/components/cpq/app-shell";
import { ItemsPanel } from "@/components/cpq/project/items-panel";
import { VariantCompare } from "@/components/cpq/project/variant-compare";
import { QuoteDialog } from "@/components/cpq/project/quote-dialog";
import { Attachments } from "@/components/cpq/project/attachments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/projecten/$id")({
  head: () => ({ meta: [{ title: "Project – JoRPA CPQ demo" }, { name: "description", content: "Projectdetail met posities, varianten, offertes en bijlagen." }] }),
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(projectQuery(params.id));
    await context.queryClient.ensureQueryData(profilesQuery());
    if (data.project) {
      await context.queryClient.ensureQueryData(catalogQuery(data.project.companies?.price_book_id ?? null, can.seeCosts(context.me.role)));
    }
  },
  component: ProjectPage,
  errorComponent: RouteError,
});

function ProjectPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(projectQuery(id));
  if (!data.project) return <NotFoundBlock what="Dit project" />;
  return <ProjectDetail data={data} />;
}

function ProjectDetail({ data }: { data: ProjectData }) {
  const me = useMe();
  const qc = useQueryClient();
  const p = data.project!;
  const { data: catalog } = useSuspenseQuery(catalogQuery(p.companies?.price_book_id ?? null, can.seeCosts(me.role)));
  const { data: profiles } = useSuspenseQuery(profilesQuery());
  const primary = data.configurations.find((c) => c.is_primary) ?? data.configurations[0];
  const [variantId, setVariantId] = useState(primary?.id ?? "");
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const editable = can.sell(me.role);

  const computed = useMemo(() => {
    const m = new Map<string, ItemComputation>();
    for (const ci of data.configItems) m.set(ci.id, computeItem(catalog, ci.data as never));
    return m;
  }, [catalog, data.configItems]);

  const blocking = data.configItems.filter((ci) => ci.configuration_id === variantId && ["error", "not_configured"].includes(computed.get(ci.id)?.evaluation.status ?? ""));

  async function setStatus(status: string) {
    const { error } = await supabase.from("projects").update({ status: status as never }).eq("id", p.id);
    if (error) return void toast.error(`Status wijzigen mislukt: ${error.message}`);
    toast.success("Projectstatus aangepast.");
    qc.invalidateQueries({ queryKey: ["project", p.id] });
    qc.invalidateQueries({ queryKey: ["projects"] });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={
          <span>
            <Link to="/projecten" className="hover:underline">
              Projecten
            </Link>{" "}
            / <span className="font-mono">{p.project_number}</span>
          </span>
        }
        title={p.name}
        subtitle={
          <>
            Klant:{" "}
            {p.companies ? (
              <Link to="/klanten/$id" params={{ id: p.companies.id }} className="text-primary hover:underline">
                {p.companies.name}
              </Link>
            ) : (
              "—"
            )}
          </>
        }
        actions={
          <>
            {editable ? (
              <Select value={p.status} onValueChange={setStatus}>
                <SelectTrigger className="w-40" aria-label="Projectstatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROJECT_STATUS_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Tone tone="muted">{PROJECT_STATUS_LABEL[p.status] ?? p.status}</Tone>
            )}
            {editable && (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" /> Gegevens
              </Button>
            )}
            {editable && (
              <Button onClick={() => setQuoteOpen(true)} disabled={data.items.length === 0}>
                <FileText className="h-4 w-4" /> Offerte maken
              </Button>
            )}
          </>
        }
      />

      {blocking.length > 0 && (
        <div role="status" className="rounded-md border border-warning/50 bg-warning/10 px-4 py-2.5 text-sm">
          {blocking.length} item(s) in deze variant hebben een blokkerende fout of zijn niet geconfigureerd voor productie. Een offerte kan pas gemaakt worden als alles opgelost is.
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          <ItemsPanel data={data} catalog={catalog} variantId={variantId} setVariantId={setVariantId} computed={computed} editable={editable} />
          <VariantCompare data={data} catalog={catalog} computed={computed} />
          <QuotesPanel data={data} />
        </div>
        <div className="space-y-5">
          <Panel title="Projectgegevens">
            <KeyValue
              items={[
                ["Adres", [p.street, [p.postal_code, p.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "—"],
                ["Contact", p.contacts ? `${p.contacts.first_name ?? ""} ${p.contacts.last_name}`.trim() : "—"],
                ["Verantwoordelijke", profiles.find((x) => x.id === p.owner_id)?.full_name ?? "—"],
                ["Gewenste levering", formatDate(p.desired_delivery_date)],
                ["Btw", `${p.vat_rate}%`],
                ["Prijsboek", catalog.priceBook ? `${catalog.priceBook.name} v${catalog.priceBook.version}` : "Niet ingesteld"],
                ["JoRPA-sync", SYNC_LABEL[p.sync_status] ?? p.sync_status],
                ["Laatst gewijzigd", formatDateTime(p.updated_at)],
              ]}
            />
            {p.notes && <p className="mt-3 whitespace-pre-wrap border-t border-border pt-3 text-sm text-muted-foreground">{p.notes}</p>}
          </Panel>
          <Attachments projectId={p.id} attachments={data.attachments} editable={editable} />
          <Panel
            title={
              <span className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-muted-foreground" /> Integratietaken
              </span>
            }
          >
            {data.jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nog niets naar JoRPA gestuurd.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.jobs.map((j) => (
                  <li key={j.id} className="rounded-md border border-border p-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs">{j.action}</span>
                      <Tone tone={j.status === "geslaagd" ? "success" : j.status === "mislukt" ? "danger" : "muted"}>{j.status}</Tone>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(j.created_at)} · {j.attempts} poging(en){j.external_ref ? ` · ref ${j.external_ref}` : ""}
                    </div>
                    {j.error_message && <div className="mt-1 text-xs text-destructive">{j.error_message}</div>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {primary && <QuoteDialog open={quoteOpen} onOpenChange={setQuoteOpen} data={data} catalog={catalog} role={me.role} defaultVariant={variantId || primary.id} />}
      <EditProjectDialog open={editOpen} onOpenChange={setEditOpen} project={p} />
    </div>
  );
}

function QuotesPanel({ data }: { data: ProjectData }) {
  const quotes = data.quotes;
  return (
    <Panel title="Offertes">
      {quotes.length === 0 ? (
        <EmptyState>Nog geen offertes voor dit project. Gebruik “Offerte maken” om de eerste revisie te berekenen.</EmptyState>
      ) : (
        <div className="space-y-3">
          {quotes.map((q) => (
            <div key={q.id} className="rounded-md border border-border">
              <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
                <span className="font-mono text-sm font-medium">{q.quote_number}</span>
                <span className="text-xs text-muted-foreground">{q.title}</span>
              </div>
              <ul className="divide-y divide-border text-sm">
                {[...q.quote_revisions]
                  .sort((a, b) => b.revision_no - a.revision_no)
                  .map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <Link to="/offertes/$revisionId" params={{ revisionId: r.id }} className="font-medium text-primary hover:underline">
                        Revisie {r.revision_no}
                      </Link>
                      <QuoteStatusBadge status={r.status} />
                      <span className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</span>
                      <span className="tabular font-medium">{formatEur(Math.round(Number(r.total_net) * 100))}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function EditProjectDialog({ open, onOpenChange, project }: { open: boolean; onOpenChange: (o: boolean) => void; project: { id: string; name: string; street: string | null; postal_code: string | null; city: string | null; desired_delivery_date: string | null; notes: string | null } }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: project.name, street: project.street ?? "", postal_code: project.postal_code ?? "", city: project.city ?? "", desired_delivery_date: project.desired_delivery_date ?? "", notes: project.notes ?? "" });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return void toast.error("Projectnaam is verplicht.");
    setBusy(true);
    const { error } = await supabase
      .from("projects")
      .update({
        name: form.name.trim().slice(0, 160),
        street: form.street.trim() || null,
        postal_code: form.postal_code.trim() || null,
        city: form.city.trim() || null,
        desired_delivery_date: form.desired_delivery_date || null,
        notes: form.notes.slice(0, 4000) || null,
      })
      .eq("id", project.id);
    setBusy(false);
    if (error) return void toast.error(`Opslaan mislukt: ${error.message}`);
    toast.success("Projectgegevens opgeslagen.");
    qc.invalidateQueries({ queryKey: ["project", project.id] });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Projectgegevens</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <Field label="Projectnaam" htmlFor="pe-name">
            <Input id="pe-name" value={form.name} onChange={set("name")} maxLength={160} />
          </Field>
          <Field label="Straat en nummer" htmlFor="pe-street">
            <Input id="pe-street" value={form.street} onChange={set("street")} maxLength={160} />
          </Field>
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <Field label="Postcode" htmlFor="pe-pc">
              <Input id="pe-pc" value={form.postal_code} onChange={set("postal_code")} maxLength={12} />
            </Field>
            <Field label="Gemeente" htmlFor="pe-city">
              <Input id="pe-city" value={form.city} onChange={set("city")} maxLength={80} />
            </Field>
          </div>
          <Field label="Gewenste leverdatum" htmlFor="pe-date">
            <Input id="pe-date" type="date" value={form.desired_delivery_date} onChange={set("desired_delivery_date")} />
          </Field>
          <Field label="Notities" htmlFor="pe-notes">
            <Textarea id="pe-notes" value={form.notes} onChange={set("notes")} rows={3} maxLength={4000} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuleren
            </Button>
            <Button type="submit" disabled={busy}>
              Opslaan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
