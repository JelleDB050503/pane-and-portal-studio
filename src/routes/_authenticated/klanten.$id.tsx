import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { companyQuery } from "@/lib/queries";
import { PageHeader, Panel, Field, EmptyState } from "@/components/cpq/page";
import { RouteError, NotFoundBlock } from "@/components/cpq/route-error";
import { QuoteStatusBadge } from "@/components/cpq/badges";
import { NewProjectDialog } from "@/components/cpq/new-project-dialog";
import { useMe } from "@/components/cpq/app-shell";
import { can } from "@/lib/auth";
import { COMPANY_TYPE_LABEL, PROJECT_STATUS_LABEL, eur, formatDate } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/klanten/$id")({
  head: () => ({ meta: [{ title: "Klant – JoRPA CPQ demo" }, { name: "description", content: "Bedrijfs- en contactgegevens, projecten en offertehistoriek." }] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(companyQuery(params.id)),
  component: CustomerDetail,
  errorComponent: RouteError,
  notFoundComponent: () => <NotFoundBlock what="Deze klant" />,
});

function CustomerDetail() {
  const { id } = Route.useParams();
  const me = useMe();
  const editable = can.sell(me.role);
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(companyQuery(id));
  const [newProject, setNewProject] = useState(false);
  if (!data.company) return <NotFoundBlock what="Deze klant" />;
  const c = data.company;
  const refresh = () => qc.invalidateQueries({ queryKey: ["company", id] });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={<Link to="/klanten" className="hover:underline">Klanten</Link>}
        title={c.name}
        subtitle={`${COMPANY_TYPE_LABEL[c.company_type] ?? c.company_type} · ${[c.street, `${c.postal_code ?? ""} ${c.city ?? ""}`.trim()].filter(Boolean).join(", ")}`}
        actions={
          editable && (
            <Button onClick={() => setNewProject(true)}>
              <Plus className="h-4 w-4" /> Nieuw project
            </Button>
          )
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <div className="space-y-6">
          <CompanyForm company={c} priceBooks={data.priceBooks} editable={editable} onSaved={refresh} />
          <Contacts companyId={c.id} contacts={data.contacts} editable={editable} onChanged={refresh} />
        </div>
        <Panel title="Projecten en offertehistoriek" bodyClassName="p-0">
          {data.projects.length === 0 ? (
            <div className="p-4">
              <EmptyState>Nog geen projecten voor deze klant.</EmptyState>
            </div>
          ) : (
            <ul>
              {data.projects.map((p) => (
                <li key={p.id} className="border-t border-border px-4 py-3 first:border-t-0">
                  <div className="flex items-center justify-between gap-2">
                    <Link to="/projecten/$id" params={{ id: p.id }} className="font-medium text-primary hover:underline">
                      {p.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">{PROJECT_STATUS_LABEL[p.status] ?? p.status}</span>
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {p.project_number} · levering {formatDate(p.desired_delivery_date)}
                  </div>
                  {p.quotes.flatMap((q) =>
                    [...q.quote_revisions]
                      .sort((a, b) => b.revision_no - a.revision_no)
                      .map((r) => (
                        <Link key={r.id} to="/offertes/$revisionId" params={{ revisionId: r.id }} className="mt-2 flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-1.5 text-xs hover:bg-muted">
                          <span className="font-mono">
                            {q.quote_number} · rev {r.revision_no} · {formatDate(r.created_at)}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="tabular">{eur(r.total_net)}</span>
                            <QuoteStatusBadge status={r.status} />
                          </span>
                        </Link>
                      )),
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <NewProjectDialog open={newProject} onOpenChange={setNewProject} companyId={c.id} />
    </div>
  );
}

const companySchema = z.object({
  name: z.string().trim().min(2, "Min. 2 tekens.").max(160),
  email: z.union([z.literal(""), z.string().trim().email("Ongeldig e-mailadres.")]),
  phone: z.string().trim().max(40),
  street: z.string().trim().max(160),
  postal_code: z.string().trim().max(10),
  city: z.string().trim().max(80),
  vat_number: z.string().trim().max(30),
  notes: z.string().max(2000),
});

type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];

function CompanyForm({ company, priceBooks, editable, onSaved }: { company: CompanyRow; priceBooks: { id: string; code: string; name: string }[]; editable: boolean; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: company.name,
    email: company.email ?? "",
    phone: company.phone ?? "",
    street: company.street ?? "",
    postal_code: company.postal_code ?? "",
    city: company.city ?? "",
    vat_number: company.vat_number ?? "",
    notes: company.notes ?? "",
  });
  const [priceBook, setPriceBook] = useState(company.price_book_id ?? "standaard");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = companySchema.safeParse(form);
    if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    setErrors({});
    setBusy(true);
    const v = parsed.data;
    const { error } = await supabase
      .from("companies")
      .update({ ...v, email: v.email || null, phone: v.phone || null, street: v.street || null, postal_code: v.postal_code || null, city: v.city || null, vat_number: v.vat_number || null, notes: v.notes || null, price_book_id: priceBook === "standaard" ? null : priceBook })
      .eq("id", company.id);
    setBusy(false);
    if (error) return toast.error(`Opslaan mislukt: ${error.message}`);
    toast.success("Klantgegevens opgeslagen.");
    onSaved();
  }

  return (
    <Panel title="Bedrijfsgegevens">
      <form onSubmit={save} className="grid gap-3">
        <fieldset disabled={!editable} className="grid gap-3">
          <Field label="Naam" htmlFor="cf-name" error={errors["name"]}>
            <Input id="cf-name" value={form.name} onChange={set("name")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="E-mail" htmlFor="cf-mail" error={errors["email"]}>
              <Input id="cf-mail" value={form.email} onChange={set("email")} />
            </Field>
            <Field label="Telefoon" htmlFor="cf-tel">
              <Input id="cf-tel" value={form.phone} onChange={set("phone")} />
            </Field>
          </div>
          <Field label="Straat en nummer" htmlFor="cf-street">
            <Input id="cf-street" value={form.street} onChange={set("street")} />
          </Field>
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <Field label="Postcode" htmlFor="cf-pc">
              <Input id="cf-pc" value={form.postal_code} onChange={set("postal_code")} />
            </Field>
            <Field label="Gemeente" htmlFor="cf-city">
              <Input id="cf-city" value={form.city} onChange={set("city")} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Btw-nummer" htmlFor="cf-vat">
              <Input id="cf-vat" value={form.vat_number} onChange={set("vat_number")} />
            </Field>
            <Field label="Prijsboek" hint="Klant-/dealerprijsboek met geldigheidsperiode">
              <Select value={priceBook} onValueChange={setPriceBook} disabled={!editable}>
                <SelectTrigger aria-label="Prijsboek">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standaard">Standaard (automatisch)</SelectItem>
                  {priceBooks.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Notities" htmlFor="cf-notes">
            <Textarea id="cf-notes" value={form.notes} onChange={set("notes")} rows={2} />
          </Field>
        </fieldset>
        {editable && (
          <div>
            <Button type="submit" disabled={busy}>
              Opslaan
            </Button>
          </div>
        )}
      </form>
    </Panel>
  );
}

const contactSchema = z.object({
  first_name: z.string().trim().min(1, "Verplicht.").max(80),
  last_name: z.string().trim().min(1, "Verplicht.").max(80),
  email: z.union([z.literal(""), z.string().trim().email("Ongeldig e-mailadres.")]),
  phone: z.string().trim().max(40),
  job_title: z.string().trim().max(80),
});

function Contacts({ companyId, contacts, editable, onChanged }: { companyId: string; contacts: { id: string; first_name: string; last_name: string; email: string | null; phone: string | null; job_title: string | null; is_primary: boolean }[]; editable: boolean; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", job_title: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const parsed = contactSchema.safeParse(form);
    if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    setErrors({});
    const v = parsed.data;
    const { error } = await supabase.from("contacts").insert({ company_id: companyId, first_name: v.first_name, last_name: v.last_name, email: v.email || null, phone: v.phone || null, job_title: v.job_title || null, is_primary: contacts.length === 0 });
    if (error) return toast.error(`Contact kon niet toegevoegd worden: ${error.message}`);
    toast.success("Contactpersoon toegevoegd.");
    setForm({ first_name: "", last_name: "", email: "", phone: "", job_title: "" });
    setAdding(false);
    onChanged();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("contacts").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(`Verwijderen mislukt: ${error.message}`);
    toast.success("Contactpersoon verwijderd.");
    onChanged();
  }

  return (
    <Panel
      title="Contactpersonen"
      actions={
        editable &&
        !adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" /> Toevoegen
          </Button>
        )
      }
    >
      {contacts.length === 0 && !adding && <EmptyState>Nog geen contactpersonen.</EmptyState>}
      <ul className="divide-y divide-border">
        {contacts.map((c) => (
          <li key={c.id} className="flex items-start justify-between gap-2 py-2 text-sm">
            <div>
              <div className="font-medium">
                {c.first_name} {c.last_name} {c.is_primary && <span className="ml-1 text-xs text-muted-foreground">(hoofdcontact)</span>}
              </div>
              <div className="text-xs text-muted-foreground">{[c.job_title, c.email, c.phone].filter(Boolean).join(" · ")}</div>
            </div>
            {editable && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" aria-label={`Verwijder ${c.first_name} ${c.last_name}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Contactpersoon verwijderen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {c.first_name} {c.last_name} wordt uit de lijst gehaald. Bestaande projecten blijven ongewijzigd.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove(c.id)}>Verwijderen</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </li>
        ))}
      </ul>
      {adding && (
        <form onSubmit={add} className="mt-3 grid gap-3 rounded-md border border-border bg-muted/40 p-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Voornaam" htmlFor="ct-fn" error={errors["first_name"]}>
              <Input id="ct-fn" value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
            </Field>
            <Field label="Familienaam" htmlFor="ct-ln" error={errors["last_name"]}>
              <Input id="ct-ln" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="E-mail" htmlFor="ct-mail" error={errors["email"]}>
              <Input id="ct-mail" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </Field>
            <Field label="Telefoon" htmlFor="ct-tel">
              <Input id="ct-tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </Field>
            <Field label="Functie" htmlFor="ct-job">
              <Input id="ct-job" value={form.job_title} onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))} />
            </Field>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Toevoegen
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setAdding(false)}>
              Annuleren
            </Button>
          </div>
        </form>
      )}
    </Panel>
  );
}
