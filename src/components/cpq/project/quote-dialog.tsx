import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createQuoteRevision } from "@/lib/cpq.functions";
import type { ProjectData } from "@/lib/queries";
import type { Catalog } from "@/lib/cpq/types";
import { checkDiscountPolicy } from "@/lib/cpq/totals";
import type { AppRole } from "@/lib/auth";
import { Field } from "../page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function QuoteDialog({ open, onOpenChange, data, catalog, role, defaultVariant }: { open: boolean; onOpenChange: (o: boolean) => void; data: ProjectData; catalog: Catalog; role: AppRole | null; defaultVariant: string }) {
  const create = useServerFn(createQuoteRevision);
  const navigate = useNavigate();
  const { data: templates = [] } = useQuery({
    queryKey: ["quote-templates"],
    queryFn: async () => (await supabase.from("quote_templates").select("id, name, is_default, validity_days").order("name")).data ?? [],
    enabled: open,
  });
  const [primary, setPrimary] = useState(defaultVariant);
  const [alts, setAlts] = useState<string[]>([]);
  const [discount, setDiscount] = useState("0");
  const [template, setTemplate] = useState<string>("standaard");
  const [busy, setBusy] = useState(false);
  const pct = Math.max(0, Math.min(100, Number(discount.replace(",", ".")) || 0));
  const policy = checkDiscountPolicy(catalog.discounts, role ?? "", pct, null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await create({
        data: {
          projectId: data.project!.id,
          primaryConfigurationId: primary,
          alternativeConfigurationIds: alts.filter((a) => a !== primary),
          discountPercent: pct,
          templateId: template === "standaard" ? null : template,
        },
      });
      toast.success(`Offerte revisie ${res.revisionNo} berekend${res.requiresApproval ? " – managergoedkeuring vereist" : ""}.`);
      onOpenChange(false);
      navigate({ to: "/offertes/$revisionId", params: { revisionId: res.revisionId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Offerte maken mislukt.", { duration: 10000 });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Offerte maken of herberekenen</DialogTitle>
          <DialogDescription>
            De server valideert en prijst alle items opnieuw en bevriest het resultaat in een revisie. Een open concept wordt herberekend; een goedgekeurde of verzonden versie levert een nieuwe revisie op.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Hoofdvariant">
            <Select value={primary} onValueChange={setPrimary}>
              <SelectTrigger aria-label="Hoofdvariant">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {data.configurations.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {data.configurations.length > 1 && (
            <Field label="Alternatieven op de offerte">
              <div className="grid gap-2">
                {data.configurations
                  .filter((c) => c.id !== primary)
                  .map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={alts.includes(c.id)} onCheckedChange={(v) => setAlts((a) => (v ? [...a, c.id] : a.filter((x) => x !== c.id)))} />
                      {c.name}
                    </label>
                  ))}
              </div>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Offertekorting (%)"
              htmlFor="q-disc"
              hint={`Max. ${policy.maxPercent}% voor jouw rol · goedkeuring boven ${policy.approvalAbovePercent}%`}
              error={!policy.allowed ? policy.reasons[0] : undefined}
            >
              <Input id="q-disc" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </Field>
            <Field label="Sjabloon">
              <Select value={template} onValueChange={setTemplate}>
                <SelectTrigger aria-label="Sjabloon">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standaard">Standaardsjabloon</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.validity_days} d geldig)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          {policy.allowed && policy.requiresApproval && (
            <p className="rounded-md border border-warning/50 bg-warning/10 p-2 text-xs text-warning-foreground">{policy.reasons.join(" ")} De offerte gaat na indienen naar de manager.</p>
          )}
          <p className="text-xs text-muted-foreground">De minimummarge wordt op de server gecontroleerd met de kostprijzen; je ziet het resultaat op de offerte.</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuleren
            </Button>
            <Button type="submit" disabled={busy || !policy.allowed}>
              {busy ? "Berekenen…" : "Offerte berekenen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
