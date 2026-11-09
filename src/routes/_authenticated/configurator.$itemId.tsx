import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useBlocker, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, FileCog, Minus, Plus, RotateCcw, Save, X } from "lucide-react";
import { toast } from "sonner";
import { catalogQuery, configItemQuery, type ConfigItemData } from "@/lib/queries";
import { saveConfigurationItem } from "@/lib/cpq.functions";
import { computeItem } from "@/lib/cpq/pricing";
import { MAX_SECTIONS, issuesFor, normalizeConfig, openingNeedsHinge, setFieldValue, valueLabel } from "@/lib/cpq/rules";
import { formatEur } from "@/lib/cpq/totals";
import type { Catalog, ItemConfig } from "@/lib/cpq/types";
import type { PartKind } from "@/lib/cpq/geometry";
import { can } from "@/lib/auth";
import { useMe } from "@/components/cpq/app-shell";
import { NotFoundBlock, RouteError } from "@/components/cpq/route-error";
import { Panel } from "@/components/cpq/page";
import { ItemStatusBadge, DemoTag } from "@/components/cpq/badges";
import { WindowDrawing, PART_LABEL } from "@/components/cpq/window-drawing";
import { ChoiceGrid, autoFor, optionChoices } from "@/components/cpq/configurator/option-picker";
import { PriceBreakdown, ValidationList } from "@/components/cpq/configurator/summary";
import { BULK_FIELDS, bulkFieldLabel } from "@/components/cpq/project/items-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/configurator/$itemId")({
  head: () => ({ meta: [{ title: "Configurator – JoRPA CPQ demo" }, { name: "description", content: "Stap-voor-stap configuratie van een raam of deur met live validatie, tekening en prijs." }] }),
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(configItemQuery(params.itemId));
    if (data) {
      const company = data.project.companies as { price_book_id: string | null } | null;
      await context.queryClient.ensureQueryData(catalogQuery(company?.price_book_id ?? null, can.seeCosts(context.me.role)));
    }
  },
  component: ConfiguratorPage,
  errorComponent: RouteError,
});

const STEPS = [
  { code: "product", label: "Product" },
  { code: "materiaal", label: "Materiaal & systeem" },
  { code: "afmetingen", label: "Afmetingen" },
  { code: "opening", label: "Vakken & opening" },
  { code: "afwerking", label: "Kleur" },
  { code: "glas", label: "Glas" },
  { code: "accessoires", label: "Accessoires" },
  { code: "diensten", label: "Diensten" },
  { code: "opmerkingen", label: "Opmerkingen" },
] as const;
type StepCode = (typeof STEPS)[number]["code"];

const STEP_HIGHLIGHT: Partial<Record<StepCode, PartKind>> = { afmetingen: "frame", opening: "sash", glas: "glass", afwerking: "frame" };
const BULK_CODES = new Set(BULK_FIELDS.map((f) => f.code));

function stepOfField(catalog: Catalog, field: string | null): StepCode | null {
  if (!field) return null;
  if (field === "family") return "product";
  if (field === "material" || field === "system") return "materiaal";
  if (["width_mm", "height_mm", "quantity"].includes(field)) return "afmetingen";
  if (field.startsWith("sections")) return "opening";
  const o = catalog.options.find((x) => x.code === field);
  return (o?.step as StepCode | undefined) ?? null;
}

function ConfiguratorPage() {
  const { itemId } = Route.useParams();
  const { data } = useSuspenseQuery(configItemQuery(itemId));
  if (!data) return <NotFoundBlock what="Deze configuratie" />;
  return <Configurator key={itemId} data={data} />;
}

function Configurator({ data }: { data: ConfigItemData }) {
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const save = useServerFn(saveConfigurationItem);
  const company = data.project.companies as { id: string; name: string; price_book_id: string | null } | null;
  const { data: catalog } = useSuspenseQuery(catalogQuery(company?.price_book_id ?? null, can.seeCosts(me.role)));
  const editable = can.sell(me.role);

  const [cfg, setCfg] = useState<ItemConfig>(() => normalizeConfig(data.item.data as Partial<ItemConfig>));
  const [overrides, setOverrides] = useState<string[]>(data.item.manual_overrides);
  const [version, setVersion] = useState(data.item.version);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<StepCode>("product");
  const [hover, setHover] = useState<PartKind | null>(null);

  const comp = useMemo(() => computeItem(catalog, cfg), [catalog, cfg]);
  const ev = comp.evaluation;
  const eff = ev.config;

  useBlocker({
    shouldBlockFn: () => (dirty ? !window.confirm("Er zijn niet-opgeslagen wijzigingen. Toch verlaten?") : false),
  });
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  function update(next: ItemConfig, field?: string) {
    setCfg(next);
    setDirty(true);
    if (field && BULK_CODES.has(field) && !overrides.includes(field)) setOverrides((o) => [...o, field]);
  }
  const setField = (field: string, value: string) => {
    let next = setFieldValue(cfg, field, value);
    if (field === "material") {
      const sys = catalog.systems.filter((s) => s.active && s.material === value && s.families.includes(cfg.family)).sort((a, b) => a.sort - b.sort);
      if (!sys.some((s) => s.code === next.system)) next = { ...next, system: sys[0]?.code ?? "" };
    }
    update(next, field === "material" ? "system" : field);
  };
  const toggleService = (code: string) =>
    update({ ...cfg, services: cfg.services.includes(code) ? cfg.services.filter((s) => s !== code) : [...cfg.services, code] });

  async function onSave() {
    setSaving(true);
    try {
      const res = await save({ data: { id: data.item.id, data: normalizeConfig(cfg), manualOverrides: overrides, expectedVersion: version } });
      setVersion(res.version);
      setDirty(false);
      toast.success(`Opgeslagen en op de server gevalideerd: ${res.status === "ok" ? "geldig" : res.status === "warning" ? "geldig met waarschuwing" : res.status === "error" ? "nog fouten" : "niet geconfigureerd voor productie"}.`);
      qc.invalidateQueries({ queryKey: ["project", data.configuration.project_id] });
      qc.invalidateQueries({ queryKey: ["config-item", data.item.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Opslaan mislukt.");
    } finally {
      setSaving(false);
    }
  }

  // Sibling navigation within the same variant, in position order
  const order = data.projectItems
    .map((pi) => ({ pi, ci: data.siblings.find((s) => s.project_item_id === pi.id) }))
    .filter((x): x is { pi: (typeof data.projectItems)[number]; ci: { id: string; project_item_id: string } } => Boolean(x.ci));
  const idx = order.findIndex((x) => x.ci.id === data.item.id);
  const prev = idx > 0 ? order[idx - 1] : null;
  const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;

  const stepErrors = (s: StepCode) => ev.issues.filter((i) => stepOfField(catalog, i.field) === s && i.severity === "error").length;
  const visible = new Set(ev.visibleOptions.map((o) => o.code));
  const optionsInStep = (s: string) => ev.visibleOptions.filter((o) => o.step === s && !["material", "opening", "hinge", "diensten"].includes(o.code));
  const hi = hover ?? STEP_HIGHLIGHT[step] ?? null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">
            <Link to="/projecten/$id" params={{ id: data.configuration.project_id }} className="hover:underline">
              {data.project.project_number} · {data.project.name}
            </Link>{" "}
            / {data.configuration.name}
          </div>
          <h1 className="mt-0.5 flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            <span className="font-mono text-base text-muted-foreground">{String(data.projectItem.seq).padStart(2, "0")}</span>
            {data.projectItem.label}
            <ItemStatusBadge status={ev.status} />
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" disabled={!prev} onClick={() => prev && navigate({ to: "/configurator/$itemId", params: { itemId: prev.ci.id } })}>
            <ChevronLeft className="h-4 w-4" /> Vorige
          </Button>
          <span className="text-xs text-muted-foreground">
            {idx + 1} / {order.length}
          </span>
          <Button variant="ghost" size="sm" disabled={!next} onClick={() => next && navigate({ to: "/configurator/$itemId", params: { itemId: next.ci.id } })}>
            Volgende <ChevronRight className="h-4 w-4" />
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/fiche/$itemId" params={{ itemId: data.item.id }}>
              <FileCog className="h-4 w-4" /> Technische fiche
            </Link>
          </Button>
          {editable && (
            <Button onClick={onSave} disabled={saving || !dirty}>
              <Save className="h-4 w-4" /> {saving ? "Opslaan…" : dirty ? "Opslaan" : "Opgeslagen"}
            </Button>
          )}
        </div>
      </div>
      {!editable && <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">Alleen-lezen: jouw rol kan configuraties bekijken maar niet wijzigen.</p>}

      <div className="grid gap-4 lg:grid-cols-[190px_minmax(0,1fr)] xl:grid-cols-[190px_minmax(0,1fr)_380px]">
        {/* Steps */}
        <nav aria-label="Stappen" className="lg:sticky lg:top-4 lg:self-start">
          <ol className="flex gap-1 overflow-x-auto lg:flex-col">
            {STEPS.filter((s) => s.code !== "accessoires" || optionsInStep("accessoires").length > 0).map((s, i) => {
              const errs = stepErrors(s.code);
              return (
                <li key={s.code}>
                  <button
                    type="button"
                    onClick={() => setStep(s.code)}
                    aria-current={step === s.code ? "step" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-2 text-left text-sm",
                      step === s.code ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[11px]", step === s.code ? "bg-primary-foreground/20" : "bg-muted")}>{i + 1}</span>
                    {s.label}
                    {errs > 0 && <span className="ml-auto rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">{errs}</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Step content */}
        <div className="min-w-0 space-y-4">
          <Panel title={STEPS.find((s) => s.code === step)?.label}>
            <fieldset disabled={!editable} className="space-y-5">
              {step === "product" && (
                <>
                  <Section label="Productfamilie">
                    <ChoiceGrid
                      name="Productfamilie"
                      choices={catalog.families.filter((f) => f.active).map((f) => ({ code: f.code, label: f.name_nl }))}
                      selected={cfg.family}
                      available={undefined}
                      onSelect={(code) => update({ ...cfg, family: code })}
                      disabled={!editable}
                    />
                  </Section>
                  <Section label="Start vanaf een productsjabloon" hint="Overschrijft maat, systeem en opties met de standaardwaarden van het sjabloon.">
                    <ChoiceGrid
                      name="Productsjabloon"
                      choices={catalog.products.filter((p) => p.active && p.family_code === cfg.family).map((p) => ({ code: p.code, label: p.name, hint: p.description }))}
                      selected={cfg.product_code ?? undefined}
                      available={undefined}
                      onSelect={(code) => {
                        const p = catalog.products.find((x) => x.code === code);
                        if (p) update(normalizeConfig({ ...cfg, ...p.default_config, product_code: p.code, remarks: cfg.remarks, production_notes: cfg.production_notes, quantity: cfg.quantity }));
                      }}
                      disabled={!editable}
                    />
                  </Section>
                </>
              )}
              {step === "materiaal" && (
                <>
                  <Section label="Materiaal" issues={issuesFor(ev, "material")}>
                    <ChoiceGrid name="Materiaal" choices={optionChoices(catalog, "material")} selected={cfg.material} available={ev.available["material"]} reasons={ev.unavailableReasons["material"]} onSelect={(c) => setField("material", c)} disabled={!editable} />
                  </Section>
                  <Section label="Systeem / profielreeks" issues={issuesFor(ev, "system")}>
                    <ChoiceGrid
                      name="Systeem"
                      choices={catalog.systems
                        .filter((s) => s.active && s.families.includes(cfg.family))
                        .sort((a, b) => a.sort - b.sort)
                        .map((s) => ({ code: s.code, label: s.name, hint: `${valueLabel(catalog, "material", s.material)}${s.production_ready ? "" : " · niet geconfigureerd voor productie"}${s.description ? ` · ${s.description}` : ""}` }))}
                      selected={cfg.system}
                      available={ev.available["system"]}
                      reasons={{ ...Object.fromEntries(catalog.systems.filter((s) => s.material !== cfg.material).map((s) => [s.code, `Hoort bij ${valueLabel(catalog, "material", s.material)}, niet bij het gekozen materiaal.`])), ...ev.unavailableReasons["system"] }}
                      onSelect={(c) => setField("system", c)}
                      disabled={!editable}
                    />
                  </Section>
                </>
              )}
              {step === "afmetingen" && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <NumberField label="Breedte (mm)" id="w" value={cfg.width_mm} onChange={(v) => update({ ...cfg, width_mm: v })} issues={issuesFor(ev, "width_mm")} step={10} />
                  <NumberField label="Hoogte (mm)" id="h" value={cfg.height_mm} onChange={(v) => update({ ...cfg, height_mm: v })} issues={issuesFor(ev, "height_mm")} step={10} />
                  <NumberField label="Aantal" id="q" value={cfg.quantity} onChange={(v) => update({ ...cfg, quantity: v })} issues={issuesFor(ev, "quantity")} step={1} />
                  <p className="text-xs text-muted-foreground sm:col-span-3">
                    Buitenmaat kader. Oppervlakte {String(ev.facts["area_m2"])} m² · omtrek {String(ev.facts["perimeter_m"])} m. Afmetingsgrenzen komen uit de regeltabel (demowaarden).
                  </p>
                </div>
              )}
              {step === "opening" && (
                <>
                  <div className="flex items-center gap-3">
                    <Label>Aantal vakken</Label>
                    <Button type="button" size="icon" variant="outline" aria-label="Vak verwijderen" disabled={cfg.sections.length <= 1} onClick={() => update({ ...cfg, sections: cfg.sections.slice(0, -1) })}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="tabular w-6 text-center font-semibold">{cfg.sections.length}</span>
                    <Button type="button" size="icon" variant="outline" aria-label="Vak toevoegen" disabled={cfg.sections.length >= MAX_SECTIONS} onClick={() => update({ ...cfg, sections: [...cfg.sections, { opening: "vast", hinge: null }] })}>
                      <Plus className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground">± {Math.round(cfg.width_mm / cfg.sections.length)} mm per vak</span>
                  </div>
                  {issuesFor(ev, "sections").filter((i) => i.field === "sections").map((i) => <IssueLine key={i.message} message={i.message} />)}
                  {cfg.sections.map((s, i) => (
                    <div key={i} className="rounded-md border border-border p-3">
                      <div className="mb-2 text-sm font-semibold">Vak {i + 1} <span className="font-normal text-muted-foreground">(gezien van binnen, van links naar rechts)</span></div>
                      <ChoiceGrid
                        name={`Openingswijze vak ${i + 1}`}
                        choices={optionChoices(catalog, "opening")}
                        selected={s.opening}
                        available={ev.available["opening"]}
                        reasons={ev.unavailableReasons["opening"]}
                        onSelect={(c) => update({ ...cfg, sections: cfg.sections.map((x, j) => (j === i ? { opening: c, hinge: openingNeedsHinge(catalog, c) ? x.hinge ?? "links" : null } : x)) })}
                        disabled={!editable}
                      />
                      {issuesFor(ev, `sections.${i}.opening`).map((x) => <IssueLine key={x.message} message={x.message} />)}
                      {s.opening && openingNeedsHinge(catalog, s.opening) && (
                        <div className="mt-3">
                          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Draairichting (scharnierzijde)</div>
                          <ChoiceGrid
                            name={`Draairichting vak ${i + 1}`}
                            choices={optionChoices(catalog, "hinge")}
                            selected={s.hinge ?? undefined}
                            available={ev.available["hinge"]}
                            reasons={ev.unavailableReasons["hinge"]}
                            onSelect={(c) => update({ ...cfg, sections: cfg.sections.map((x, j) => (j === i ? { ...x, hinge: c } : x)) })}
                            disabled={!editable}
                          />
                          {issuesFor(ev, `sections.${i}.hinge`).map((x) => <IssueLine key={x.message} message={x.message} />)}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
              {(step === "afwerking" || step === "glas" || step === "accessoires") &&
                optionsInStep(step).map((o) => (
                  <Section key={o.code} label={o.name_nl} hint={o.help_text} issues={issuesFor(ev, o.code)} override={overrides.includes(o.code) ? () => setOverrides((x) => x.filter((f) => f !== o.code)) : undefined}>
                    <ChoiceGrid
                      name={o.name_nl}
                      choices={optionChoices(catalog, o.code)}
                      selected={eff.values[o.code]}
                      available={ev.available[o.code]}
                      reasons={ev.unavailableReasons[o.code]}
                      auto={autoFor(ev, o.code)}
                      onSelect={(c) => setField(o.code, c)}
                      disabled={!editable}
                    />
                  </Section>
                ))}
              {step === "diensten" && visible.has("diensten") && (
                <Section label="Diensten" hint="Meerdere keuzes mogelijk. Prijs per dienst uit het prijsboek." issues={issuesFor(ev, "diensten")}>
                  <ChoiceGrid multi name="Diensten" choices={optionChoices(catalog, "diensten")} selected={eff.services} available={ev.available["diensten"]} reasons={ev.unavailableReasons["diensten"]} auto={autoFor(ev, "diensten")} onSelect={toggleService} disabled={!editable} />
                </Section>
              )}
              {step === "opmerkingen" && (
                <div className="grid gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="rem">Opmerking voor de klant (komt op de offerte)</Label>
                    <Textarea id="rem" rows={3} maxLength={2000} value={cfg.remarks} onChange={(e) => update({ ...cfg, remarks: e.target.value })} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="prod">Interne productienotitie (niet zichtbaar voor de klant)</Label>
                    <Textarea id="prod" rows={3} maxLength={2000} value={cfg.production_notes} onChange={(e) => update({ ...cfg, production_notes: e.target.value })} />
                  </div>
                </div>
              )}
            </fieldset>
            <div className="mt-5 flex justify-between border-t border-border pt-3">
              <Button variant="ghost" size="sm" disabled={step === STEPS[0].code} onClick={() => setStep(STEPS[Math.max(0, STEPS.findIndex((s) => s.code === step) - 1)]!.code)}>
                <ChevronLeft className="h-4 w-4" /> Vorige stap
              </Button>
              <Button variant="ghost" size="sm" disabled={step === "opmerkingen"} onClick={() => setStep(STEPS[Math.min(STEPS.length - 1, STEPS.findIndex((s) => s.code === step) + 1)]!.code)}>
                Volgende stap <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </Panel>
          {overrides.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              Handmatige uitzonderingen (groepswijzigingen slaan deze velden over):
              {overrides.map((f) => (
                <span key={f} className="inline-flex items-center gap-1 rounded-sm border border-info/40 bg-info/10 px-1.5 py-0.5 text-info">
                  {bulkFieldLabel(f)}
                  {editable && (
                    <button
                      type="button"
                      aria-label={`Uitzondering ${bulkFieldLabel(f)} opheffen`}
                      onClick={() => {
                        setOverrides((x) => x.filter((y) => y !== f));
                        setDirty(true);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Live summary */}
        <aside className="space-y-4 lg:col-span-2 xl:col-span-1 xl:sticky xl:top-4 xl:self-start">
          <Panel
            title={
              <span className="flex items-center gap-2">
                Tekening <DemoTag>Demo-geometrie</DemoTag>
              </span>
            }
          >
            <div className="aspect-square w-full rounded-md bg-muted/30">
              <WindowDrawing config={eff} highlight={hi} onHover={setHover} />
            </div>
            <p className="mt-1 text-center text-xs text-muted-foreground">{hi ? `Gemarkeerd: ${PART_LABEL[hi]}` : "Beweeg over de tekening om onderdelen te zien"} · zicht van binnen</p>
          </Panel>
          <Panel title="Validatie">
            <ValidationList comp={comp} onJump={(f) => setStep(stepOfField(catalog, f) ?? step)} />
            {dirty && (
              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <RotateCcw className="h-3 w-3" /> Live controle in de browser. Bij opslaan valideert de server opnieuw.
              </p>
            )}
          </Panel>
          <Panel title={<span className="flex w-full items-center justify-between">Prijs <span className="tabular text-base">{formatEur(comp.price.net_cents)}</span></span>}>
            <PriceBreakdown comp={comp} showCost={can.seeCosts(me.role)} />
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function Section({ label, hint, issues, children, override }: { label: string; hint?: string | null | undefined; issues?: { message: string; severity: string }[]; children: React.ReactNode; override?: (() => void) | undefined }) {
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-semibold">{label}</h3>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        {override && (
          <span className="ml-auto rounded-sm border border-info/40 bg-info/10 px-1.5 py-0.5 text-[11px] text-info">handmatige uitzondering</span>
        )}
      </div>
      {children}
      {issues?.map((i) => <IssueLine key={i.message} message={i.message} warning={i.severity === "warning"} />)}
    </section>
  );
}

function IssueLine({ message, warning }: { message: string; warning?: boolean }) {
  return <p className={cn("mt-1.5 text-sm", warning ? "text-warning-foreground" : "text-destructive")}>{message}</p>;
}

function NumberField({ label, id, value, onChange, issues, step }: { label: string; id: string; value: number; onChange: (v: number) => void; issues: { message: string; severity: string }[]; step: number }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const hasErr = issues.some((i) => i.severity === "error");
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="numeric"
        type="number"
        step={step}
        min={0}
        value={text}
        aria-invalid={hasErr}
        className={cn("tabular", hasErr && "border-destructive")}
        onChange={(e) => {
          setText(e.target.value);
          const n = Math.round(Number(e.target.value));
          if (Number.isFinite(n)) onChange(n);
        }}
      />
      {issues.map((i) => <IssueLine key={i.message} message={i.message} warning={i.severity === "warning"} />)}
    </div>
  );
}
