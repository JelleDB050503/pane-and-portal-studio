import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { companiesQuery } from "@/lib/queries";
import { PageHeader, EmptyState, Field } from "@/components/cpq/page";
import { RouteError } from "@/components/cpq/route-error";
import { useMe } from "@/components/cpq/app-shell";
import { can } from "@/lib/auth";
import { COMPANY_TYPE_LABEL } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/klanten/")({
  head: () => ({ meta: [{ title: "Klanten – JoRPA CPQ demo" }, { name: "description", content: "Klanten zoeken en beheren." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(companiesQuery()),
  component: Customers,
  errorComponent: RouteError,
});

function Customers() {
  const me = useMe();
  const { data } = useSuspenseQuery(companiesQuery());
  const [q, setQ] = useState("");
  const [type, setType] = useState("alle");
  const [open, setOpen] = useState(false);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.filter((c) => {
      if (type !== "alle" && c.company_type !== type) return false;
      if (!needle) return true;
      const contacts = c.contacts.filter((x) => !x.deleted_at).map((x) => `${x.first_name} ${x.last_name}`).join(" ");
      return [c.name, c.city, c.vat_number, c.email, contacts].some((v) => (v ?? "").toLowerCase().includes(needle));
    });
  }, [data, q, type]);

  return (
    <div>
      <PageHeader
        title="Klanten"
        subtitle={`${data.length} klanten · particulieren, aannemers, dealers en architecten`}
        actions={
          can.sell(me.role) && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Nieuwe klant
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek op naam, gemeente, btw-nummer of contactpersoon" className="pl-8" aria-label="Zoeken" />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-48" aria-label="Type klant">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle types</SelectItem>
            {Object.entries(COMPANY_TYPE_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {rows.length === 0 ? (
        <EmptyState>Geen klanten gevonden voor deze zoekopdracht.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Naam</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Contactpersoon</th>
                <th className="px-4 py-2 font-medium">Gemeente</th>
                <th className="px-4 py-2 font-medium">Btw-nummer</th>
                <th className="px-4 py-2 text-right font-medium">Projecten</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const primary = c.contacts.find((x) => x.is_primary && !x.deleted_at) ?? c.contacts.find((x) => !x.deleted_at);
                return (
                  <tr key={c.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-4 py-2.5">
                      <Link to="/klanten/$id" params={{ id: c.id }} className="font-medium text-primary hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">{COMPANY_TYPE_LABEL[c.company_type] ?? c.company_type}</td>
                    <td className="px-4 py-2.5">{primary ? `${primary.first_name} ${primary.last_name}` : "—"}</td>
                    <td className="px-4 py-2.5">{c.city ?? "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{c.vat_number ?? "—"}</td>
                    <td className="tabular px-4 py-2.5 text-right">{c.projects.filter((p) => !p.deleted_at).length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <NewCustomerDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

const schema = z.object({
  name: z.string().trim().min(2, "Geef een naam op (min. 2 tekens).").max(160),
  company_type: z.string(),
  email: z.union([z.literal(""), z.string().trim().email("Ongeldig e-mailadres.").max(255)]),
  phone: z.string().trim().max(40),
  street: z.string().trim().max(160),
  postal_code: z.string().trim().max(10),
  city: z.string().trim().max(80),
  vat_number: z.string().trim().max(30),
});

function NewCustomerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", company_type: "particulier", email: "", phone: "", street: "", postal_code: "", city: "", vat_number: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    const v = parsed.data;
    const { data, error } = await supabase
      .from("companies")
      .insert({ ...v, email: v.email || null, phone: v.phone || null, street: v.street || null, postal_code: v.postal_code || null, city: v.city || null, vat_number: v.vat_number || null })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) return toast.error(`Klant kon niet opgeslagen worden: ${error?.message ?? ""}`);
    toast.success("Klant aangemaakt.");
    await qc.invalidateQueries({ queryKey: ["companies"] });
    onOpenChange(false);
    navigate({ to: "/klanten/$id", params: { id: data.id } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nieuwe klant</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <Field label="Naam" htmlFor="c-name" error={errors["name"]}>
            <Input id="c-name" value={form.name} onChange={set("name")} autoFocus />
          </Field>
          <Field label="Type">
            <Select value={form.company_type} onValueChange={(v) => setForm((f) => ({ ...f, company_type: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(COMPANY_TYPE_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="E-mail" htmlFor="c-mail" error={errors["email"]}>
              <Input id="c-mail" type="email" value={form.email} onChange={set("email")} />
            </Field>
            <Field label="Telefoon" htmlFor="c-tel">
              <Input id="c-tel" value={form.phone} onChange={set("phone")} />
            </Field>
          </div>
          <Field label="Straat en nummer" htmlFor="c-street">
            <Input id="c-street" value={form.street} onChange={set("street")} />
          </Field>
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <Field label="Postcode" htmlFor="c-pc">
              <Input id="c-pc" value={form.postal_code} onChange={set("postal_code")} />
            </Field>
            <Field label="Gemeente" htmlFor="c-city">
              <Input id="c-city" value={form.city} onChange={set("city")} />
            </Field>
          </div>
          <Field label="Btw-nummer" htmlFor="c-vat" hint="Enkel voor bedrijven, bv. BE0123.456.789">
            <Input id="c-vat" value={form.vat_number} onChange={set("vat_number")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuleren
            </Button>
            <Button type="submit" disabled={busy}>
              Klant aanmaken
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
