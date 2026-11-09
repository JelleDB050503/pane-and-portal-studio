import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { companiesQuery } from "@/lib/queries";
import { Field } from "./page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const schema = z.object({
  name: z.string().trim().min(3, "Geef een projectnaam op (min. 3 tekens).").max(160),
  company_id: z.string().uuid("Kies een klant."),
  contact_id: z.string().uuid().nullable(),
  street: z.string().trim().max(160),
  postal_code: z.string().trim().max(10),
  city: z.string().trim().max(80),
  desired_delivery_date: z.string().max(10),
  vat_rate: z.enum(["6", "21", "0"]),
  notes: z.string().max(2000),
});

export function NewProjectDialog({ open, onOpenChange, companyId }: { open: boolean; onOpenChange: (o: boolean) => void; companyId?: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: companies = [] } = useQuery({ ...companiesQuery(), enabled: open });
  const [form, setForm] = useState({ name: "", company_id: companyId ?? "", contact_id: null as string | null, street: "", postal_code: "", city: "", desired_delivery_date: "", vat_rate: "21" as "6" | "21" | "0", notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const company = companies.find((c) => c.id === form.company_id);

  useEffect(() => {
    if (companyId) setForm((f) => ({ ...f, company_id: companyId }));
  }, [companyId]);

  function pickCompany(id: string) {
    const c = companies.find((x) => x.id === id);
    const primary = c?.contacts.find((x) => x.is_primary && !x.deleted_at);
    setForm((f) => ({ ...f, company_id: id, contact_id: primary?.id ?? null, street: f.street || c?.street || "", postal_code: f.postal_code || c?.postal_code || "", city: f.city || c?.city || "" }));
  }

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
    const { data: user } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("projects")
      .insert({
        name: v.name,
        company_id: v.company_id,
        contact_id: v.contact_id,
        street: v.street || null,
        postal_code: v.postal_code || null,
        city: v.city || null,
        desired_delivery_date: v.desired_delivery_date || null,
        vat_rate: Number(v.vat_rate),
        notes: v.notes || null,
        owner_id: user.user?.id ?? null,
        created_by: user.user?.id ?? null,
      })
      .select("id")
      .single();
    if (error || !data) {
      setBusy(false);
      return void toast.error(`Project kon niet aangemaakt worden: ${error?.message ?? ""}`);
    }
    const { error: e2 } = await supabase.from("configurations").insert({ project_id: data.id, name: "Basis", description: "Hoofdvoorstel", is_primary: true, created_by: user.user?.id ?? null });
    setBusy(false);
    if (e2) toast.error(`Hoofdvariant kon niet aangemaakt worden: ${e2.message}`);
    toast.success("Project aangemaakt.");
    await qc.invalidateQueries({ queryKey: ["projects"] });
    await qc.invalidateQueries({ queryKey: ["company"] });
    onOpenChange(false);
    navigate({ to: "/projecten/$id", params: { id: data.id } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nieuw project</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <Field label="Projectnaam" htmlFor="p-name" error={errors["name"]}>
            <Input id="p-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="bv. Renovatie woning Janssens" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Klant" error={errors["company_id"]}>
              <Select value={form.company_id} onValueChange={pickCompany}>
                <SelectTrigger aria-label="Klant">
                  <SelectValue placeholder="Kies een klant" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Contactpersoon">
              <Select value={form.contact_id ?? "geen"} onValueChange={(v) => setForm((f) => ({ ...f, contact_id: v === "geen" ? null : v }))}>
                <SelectTrigger aria-label="Contactpersoon">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="geen">Geen</SelectItem>
                  {(company?.contacts ?? [])
                    .filter((c) => !c.deleted_at)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.first_name} {c.last_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Werfadres" htmlFor="p-street">
            <Input id="p-street" value={form.street} onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))} />
          </Field>
          <div className="grid grid-cols-[120px_1fr] gap-3">
            <Field label="Postcode" htmlFor="p-pc">
              <Input id="p-pc" value={form.postal_code} onChange={(e) => setForm((f) => ({ ...f, postal_code: e.target.value }))} />
            </Field>
            <Field label="Gemeente" htmlFor="p-city">
              <Input id="p-city" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Gewenste leverdatum" htmlFor="p-date">
              <Input id="p-date" type="date" value={form.desired_delivery_date} onChange={(e) => setForm((f) => ({ ...f, desired_delivery_date: e.target.value }))} />
            </Field>
            <Field label="Btw-tarief" hint="6 % enkel bij renovatie woning > 10 jaar">
              <Select value={form.vat_rate} onValueChange={(v) => setForm((f) => ({ ...f, vat_rate: v as "6" | "21" | "0" }))}>
                <SelectTrigger aria-label="Btw-tarief">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="21">21 %</SelectItem>
                  <SelectItem value="6">6 %</SelectItem>
                  <SelectItem value="0">0 % (medecontractant)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Notities" htmlFor="p-notes">
            <Textarea id="p-notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuleren
            </Button>
            <Button type="submit" disabled={busy}>
              Project aanmaken
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
