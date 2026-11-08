import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Layers, Plus, Settings2, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { addProjectItem, bulkApplyChange, createVariant, duplicateProjectItem } from "@/lib/cpq.functions";
import type { ProjectData } from "@/lib/queries";
import type { Catalog, ItemComputation } from "@/lib/cpq/types";
import { describeItem } from "@/lib/cpq/snapshot";
import { formatEur } from "@/lib/cpq/totals";
import { valueLabel } from "@/lib/cpq/rules";
import { ItemStatusBadge } from "../badges";
import { Panel, Field, EmptyState } from "../page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export const BULK_FIELDS: { code: string; label: string }[] = [
  { code: "system", label: "Systeem / materiaal" },
  { code: "kleur_binnen", label: "Kleur binnen" },
  { code: "kleur_buiten", label: "Kleur buiten" },
  { code: "glas", label: "Glasopbouw" },
  { code: "beslag", label: "Beslag" },
  { code: "ventilatie", label: "Ventilatie" },
  { code: "vliegenraam", label: "Vliegenraam" },
  { code: "zonwering", label: "Rolluik / screen" },
];

export function bulkFieldLabel(code: string) {
  return BULK_FIELDS.find((f) => f.code === code)?.label ?? code;
}

interface Props {
  data: ProjectData;
  catalog: Catalog;
  variantId: string;
  setVariantId: (id: string) => void;
  computed: Map<string, ItemComputation>;
  editable: boolean;
}

export function ItemsPanel({ data, catalog, variantId, setVariantId, computed, editable }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const projectId = data.project!.id;
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [variantOpen, setVariantOpen] = useState(false);
  const duplicate = useServerFn(duplicateProjectItem);
  const refresh = () => qc.invalidateQueries({ queryKey: ["project", projectId] });

  const rows = data.items.map((pi) => {
    const ci = data.configItems.find((c) => c.configuration_id === variantId && c.project_item_id === pi.id) ?? null;
    return { pi, ci, comp: ci ? computed.get(ci.id) ?? null : null };
  });
  const selectable = rows.filter((r) => r.ci).map((r) => r.ci!.id);
  const total = rows.reduce((s, r) => s + (r.comp?.price.net_cents ?? 0), 0);
  const allSelected = selectable.length > 0 && selectable.every((id) => selected.includes(id));

  async function doDuplicate(ciId: string) {
    try {
      await duplicate({ data: { configurationItemId: ciId } });
      toast.success("Item gekopieerd (in alle varianten).");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kopiëren mislukt.");
    }
  }

  async function doDelete(piId: string) {
    const { error } = await supabase.from("project_items").update({ deleted_at: new Date().toISOString() }).eq("id", piId);
    if (error) return toast.error(`Verwijderen mislukt: ${error.message}`);
    toast.success("Item verwijderd uit het project.");
    setSelected((s) => s.filter((id) => !data.configItems.some((c) => c.id === id && c.project_item_id === piId)));
    refresh();
  }

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" /> Posities en varianten
        </span>
      }
      actions={
        editable && (
          <>
            <Button size="sm" variant="outline" disabled={selected.length === 0} onClick={() => setBulkOpen(true)}>
              <Wand2 className="h-3.5 w-3.5" /> Groepswijziging{selected.length ? ` (${selected.length})` : ""}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setVariantOpen(true)}>
              <Copy className="h-3.5 w-3.5" /> Variant kopiëren
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Item toevoegen
            </Button>
          </>
        )
      }
      bodyClassName="p-0"
    >
      <div className="flex flex-wrap gap-1 border-b border-border bg-muted/40 px-3 py-2" role="tablist" aria-label="Varianten">
        {data.configurations.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={c.id === variantId}
            onClick={() => {
              setVariantId(c.id);
              setSelected([]);
            }}
            className={`rounded-md px-3 py-1.5 text-sm ${c.id === variantId ? "bg-card font-medium text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground"}`}
          >
            {c.name}
            {c.is_primary && <span className="ml-1.5 font-mono text-[10px] uppercase text-primary">hoofd</span>}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <div className="p-4">
          <EmptyState>Nog geen posities. Voeg een raam of deur toe om te beginnen.</EmptyState>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                {editable && (
                  <th className="w-10 px-3 py-2">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(v) => setSelected(v ? selectable : [])}
                      aria-label="Alles selecteren"
                    />
                  </th>
                )}
                <th className="px-3 py-2 font-medium">Pos.</th>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Aantal</th>
                <th className="px-3 py-2 text-right font-medium">Prijs/st</th>
                <th className="px-3 py-2 text-right font-medium">Netto</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ pi, ci, comp }) => (
                <tr key={pi.id} className="border-b border-border align-top last:border-0 hover:bg-muted/30">
                  {editable && (
                    <td className="px-3 py-3">
                      {ci && (
                        <Checkbox
                          checked={selected.includes(ci.id)}
                          onCheckedChange={(v) => setSelected((s) => (v ? [...s, ci.id] : s.filter((x) => x !== ci.id)))}
                          aria-label={`Selecteer ${pi.label}`}
                        />
                      )}
                    </td>
                  )}
                  <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{String(pi.seq).padStart(2, "0")}</td>
                  <td className="max-w-[460px] px-3 py-3">
                    <div className="font-medium">{pi.label}</div>
                    {comp ? <div className="mt-0.5 text-xs text-muted-foreground">{describeItem(catalog, comp.evaluation)}</div> : <div className="text-xs text-muted-foreground">Niet aanwezig in deze variant.</div>}
                    {ci && ci.manual_overrides.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {ci.manual_overrides.map((f) => (
                          <span key={f} className="rounded-sm border border-info/40 bg-info/10 px-1.5 py-0.5 text-[11px] text-info" title="Handmatige uitzondering: wordt niet stil overschreven door een groepswijziging">
                            uitzondering: {bulkFieldLabel(f)}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">{comp && <ItemStatusBadge status={comp.evaluation.status} />}</td>
                  <td className="tabular px-3 py-3 text-right">{comp?.evaluation.config.quantity ?? "—"}</td>
                  <td className="tabular px-3 py-3 text-right">{comp ? formatEur(comp.price.unit_cents) : "—"}</td>
                  <td className="tabular px-3 py-3 text-right font-medium">{comp ? formatEur(comp.price.net_cents) : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {ci && (
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/configurator/$itemId" params={{ itemId: ci.id }}>
                          <Settings2 className="h-3.5 w-3.5" /> {editable ? "Configureren" : "Bekijken"}
                        </Link>
                      </Button>
                    )}
                    {editable && ci && (
                      <Button size="icon" variant="ghost" onClick={() => doDuplicate(ci.id)} aria-label={`Kopieer ${pi.label}`} title="Kopiëren">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {editable && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" aria-label={`Verwijder ${pi.label}`} title="Verwijderen">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{pi.label} verwijderen?</AlertDialogTitle>
                            <AlertDialogDescription>
                              De positie verdwijnt uit alle varianten van dit project. Reeds uitgebrachte offerterevisies blijven ongewijzigd.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuleren</AlertDialogCancel>
                            <AlertDialogAction onClick={() => doDelete(pi.id)}>Verwijderen</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/40">
                <td colSpan={editable ? 6 : 5} className="px-3 py-2 text-right text-xs text-muted-foreground">
                  Subtotaal variant (excl. offertekorting en btw)
                </td>
                <td className="tabular px-3 py-2 text-right font-semibold">{formatEur(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <BulkDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        catalog={catalog}
        items={data.configItems.filter((c) => selected.includes(c.id))}
        onDone={() => {
          setSelected([]);
          refresh();
        }}
      />
      <AddItemDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        catalog={catalog}
        nextSeq={(data.items.at(-1)?.seq ?? 0) + 1}
        projectId={projectId}
        onCreated={async (res) => {
          await refresh();
          const target = res.configurationItemIds[variantId];
          if (target) navigate({ to: "/configurator/$itemId", params: { itemId: target } });
        }}
      />
      <VariantDialog
        open={variantOpen}
        onOpenChange={setVariantOpen}
        sourceName={data.configurations.find((c) => c.id === variantId)?.name ?? ""}
        sourceId={variantId}
        onCreated={async (id) => {
          await refresh();
          setVariantId(id);
        }}
      />
    </Panel>
  );
}

function BulkDialog({ open, onOpenChange, catalog, items, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; catalog: Catalog; items: ProjectData["configItems"]; onDone: () => void }) {
  const apply = useServerFn(bulkApplyChange);
  const [field, setField] = useState("kleur_buiten");
  const [value, setValue] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [step, setStep] = useState<"choose" | "confirm">("choose");
  const [busy, setBusy] = useState(false);
  const values = useMemo(
    () =>
      field === "system"
        ? catalog.systems.filter((s) => s.active).map((s) => ({ code: s.code, label: `${s.name} (${valueLabel(catalog, "material", s.material)})` }))
        : catalog.values.filter((v) => v.option_code === field && v.active).map((v) => ({ code: v.code, label: v.name_nl })),
    [catalog, field],
  );
  const withException = items.filter((i) => i.manual_overrides.includes(field));
  const willChange = overwrite ? items.length : items.length - withException.length;

  function close(o: boolean) {
    onOpenChange(o);
    if (!o) {
      setStep("choose");
      setOverwrite(false);
    }
  }

  async function run() {
    setBusy(true);
    try {
      const res = await apply({ data: { configurationItemIds: items.map((i) => i.id), field, value, overwriteExceptions: overwrite } });
      toast.success(`${res.changed} item(s) gewijzigd${res.skipped ? `, ${res.skipped} overgeslagen wegens uitzondering` : ""}.`);
      close(false);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Groepswijziging mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Groepswijziging</DialogTitle>
          <DialogDescription>Pas één keuze toe op {items.length} geselecteerde item(s). De server valideert elk item opnieuw.</DialogDescription>
        </DialogHeader>
        {step === "choose" ? (
          <div className="grid gap-3">
            <Field label="Wat wil je wijzigen?">
              <Select
                value={field}
                onValueChange={(v) => {
                  setField(v);
                  setValue("");
                }}
              >
                <SelectTrigger aria-label="Veld">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BULK_FIELDS.map((f) => (
                    <SelectItem key={f.code} value={f.code}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Nieuwe waarde">
              <Select value={value} onValueChange={setValue}>
                <SelectTrigger aria-label="Nieuwe waarde">
                  <SelectValue placeholder="Kies een waarde" />
                </SelectTrigger>
                <SelectContent>
                  {values.map((v) => (
                    <SelectItem key={v.code} value={v.code}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>
                Annuleren
              </Button>
              <Button disabled={!value} onClick={() => setStep("confirm")}>
                Verder
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="grid gap-3 text-sm">
            <div className="rounded-md border border-border bg-muted/50 p-3">
              <p>
                <strong>{willChange}</strong> van {items.length} item(s) krijgen <strong>{bulkFieldLabel(field)}</strong> ={" "}
                <strong>{values.find((v) => v.code === value)?.label}</strong>.
              </p>
              {withException.length > 0 && (
                <p className="mt-2 text-muted-foreground">
                  {withException.length} item(s) hebben een handmatige uitzondering voor dit veld en worden {overwrite ? "toch overschreven" : "overgeslagen"}.
                </p>
              )}
            </div>
            {withException.length > 0 && (
              <label className="flex items-center gap-2">
                <Checkbox checked={overwrite} onCheckedChange={(v) => setOverwrite(Boolean(v))} /> Ook handmatige uitzonderingen overschrijven
              </label>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("choose")}>
                Terug
              </Button>
              <Button onClick={run} disabled={busy || willChange === 0}>
                {willChange} item(s) wijzigen
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddItemDialog({
  open,
  onOpenChange,
  catalog,
  nextSeq,
  projectId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  catalog: Catalog;
  nextSeq: number;
  projectId: string;
  onCreated: (res: { projectItemId: string; configurationItemIds: Record<string, string> }) => Promise<void>;
}) {
  const add = useServerFn(addProjectItem);
  const [product, setProduct] = useState(catalog.products[0]?.code ?? "");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const p = catalog.products.find((x) => x.code === product);
  const suggestion = `${p ? valueLabel(catalog, "family", p.family_code) : "Item"} ${String(nextSeq).padStart(2, "0")}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!p) return;
    setBusy(true);
    try {
      const res = await add({ data: { projectId, label: label.trim() || suggestion, productCode: p.code, family: p.family_code } });
      toast.success("Item toegevoegd aan alle varianten.");
      onOpenChange(false);
      setLabel("");
      await onCreated(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Toevoegen mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Item toevoegen</DialogTitle>
          <DialogDescription>Start vanaf een productsjabloon; je stelt daarna alles in via de configurator.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <Field label="Productsjabloon">
            <Select value={product} onValueChange={setProduct}>
              <SelectTrigger aria-label="Productsjabloon">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {catalog.products
                  .filter((x) => x.active)
                  .map((x) => (
                    <SelectItem key={x.code} value={x.code}>
                      {x.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Label" htmlFor="item-label" hint={`Bijvoorbeeld "Raam leefruimte 01". Leeg = "${suggestion}"`}>
            <Input id="item-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={120} placeholder={suggestion} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuleren
            </Button>
            <Button type="submit" disabled={busy}>
              Toevoegen en configureren
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VariantDialog({ open, onOpenChange, sourceName, sourceId, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; sourceName: string; sourceId: string; onCreated: (id: string) => Promise<void> }) {
  const create = useServerFn(createVariant);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Geef de variant een naam.");
    setBusy(true);
    try {
      const res = await create({ data: { sourceConfigurationId: sourceId, name: name.trim(), description } });
      toast.success("Variant aangemaakt. Het origineel blijft ongewijzigd.");
      onOpenChange(false);
      setName("");
      setDescription("");
      await onCreated(res.configurationId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Variant aanmaken mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Variant kopiëren</DialogTitle>
          <DialogDescription>Alle posities van “{sourceName}” worden gekopieerd naar een aparte variant, bv. premium glas of aluminium.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <Field label="Naam" htmlFor="v-name">
            <Input id="v-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="bv. Alternatief – Premium glas" autoFocus />
          </Field>
          <Field label="Omschrijving" htmlFor="v-desc">
            <Textarea id="v-desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuleren
            </Button>
            <Button type="submit" disabled={busy}>
              Variant aanmaken
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
