import { AlertTriangle, CircleCheck, CircleX, Info, Zap } from "lucide-react";
import type { ItemComputation, PriceCategory } from "@/lib/cpq/types";
import { formatEur } from "@/lib/cpq/totals";
import { STATUS_LABEL } from "@/lib/cpq/rules";
import { cn } from "@/lib/utils";

const CAT_LABEL: Record<PriceCategory, string> = {
  basis: "Basis",
  matrix: "Maat",
  optie: "Opties",
  toeslag: "Toeslagen",
  component: "Componenten",
  dienst: "Diensten",
  arbeid: "Arbeid",
  prijsboek: "Prijsboek",
  korting: "Korting",
};

export function ValidationList({ comp, onJump }: { comp: ItemComputation; onJump?: (field: string | null) => void }) {
  const ev = comp.evaluation;
  const tone = ev.status === "ok" ? "success" : ev.status === "warning" ? "warning" : ev.status === "not_configured" ? "info" : "danger";
  const Icon = ev.status === "ok" ? CircleCheck : ev.status === "error" ? CircleX : ev.status === "warning" ? AlertTriangle : Info;
  return (
    <div className="space-y-2">
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
          tone === "success" && "bg-success/10 text-success",
          tone === "warning" && "bg-warning/15 text-warning-foreground",
          tone === "info" && "bg-info/10 text-info",
          tone === "danger" && "bg-destructive/10 text-destructive",
        )}
      >
        <Icon className="h-4 w-4" /> {STATUS_LABEL[ev.status]}
      </div>
      {(ev.issues.length > 0 || ev.notConfigured.length > 0) && (
        <ul className="space-y-1.5 text-sm">
          {ev.issues.map((i, n) => (
            <li key={n}>
              <button
                type="button"
                onClick={() => onJump?.(i.field)}
                className={cn("flex w-full gap-2 rounded px-1 text-left hover:bg-muted", i.severity === "error" ? "text-destructive" : "text-warning-foreground")}
              >
                {i.severity === "error" ? <CircleX className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                <span>
                  {i.message}
                  {i.rule_code && <span className="ml-1 font-mono text-[10px] text-muted-foreground">[{i.rule_code}]</span>}
                </span>
              </button>
            </li>
          ))}
          {ev.notConfigured.map((m, n) => (
            <li key={`nc${n}`} className="flex gap-2 px-1 text-info">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <strong>Niet geconfigureerd voor productie:</strong> {m}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PriceBreakdown({ comp, showCost }: { comp: ItemComputation; showCost: boolean }) {
  const p = comp.price;
  const groups = new Map<PriceCategory, typeof p.lines>();
  for (const l of p.lines) groups.set(l.category, [...(groups.get(l.category) ?? []), l]);
  const margin = p.cost_cents !== null && p.net_cents > 0 ? Math.round(((p.net_cents - p.cost_cents) / p.net_cents) * 1000) / 10 : null;
  return (
    <div className="space-y-3 text-sm">
      <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary">
              <Zap className="h-3.5 w-3.5" /> Live prijs
            </div>
            <div className="mt-1 text-2xl font-semibold tabular">{formatEur(p.net_cents)}</div>
            <div className="text-xs text-muted-foreground">netto voor {p.quantity} {p.quantity === 1 ? "stuk" : "stuks"} · excl. btw</div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>Per stuk</div>
            <div className="mt-0.5 text-sm font-medium tabular text-foreground">{formatEur(p.unit_cents)}</div>
          </div>
        </div>
        {p.qty_discount_cents > 0 && (
          <div className="mt-3 flex items-center justify-between border-t border-primary/10 pt-2 text-xs text-success">
            <span>Volumekorting {p.qty_discount_percent}%</span>
            <span className="tabular">− {formatEur(p.qty_discount_cents)}</span>
          </div>
        )}
      </div>
      {[...groups.entries()].map(([cat, lines]) => (
        <div key={cat}>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{CAT_LABEL[cat]}</div>
          <ul className="space-y-0.5">
            {lines.map((l) => (
              <li key={l.code} className="flex justify-between gap-3">
                <span className="min-w-0">
                  {l.label}
                  {l.quantity !== 1 && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      {l.quantity} {l.unit} × {formatEur(l.unit_cents)}
                    </span>
                  )}
                </span>
                <span className={cn("tabular shrink-0", l.total_cents < 0 && "text-success")}>{formatEur(l.total_cents)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="space-y-0.5 border-t border-border pt-2">
        <Row label="Prijs per stuk" value={formatEur(p.unit_cents)} />
        <Row label={`× ${p.quantity} stuks`} value={formatEur(p.gross_cents)} />
        {p.qty_discount_cents > 0 && <Row label={`Volumekorting ${p.qty_discount_percent}%`} value={`− ${formatEur(p.qty_discount_cents)}`} tone="success" />}
        <Row label="Netto (excl. btw)" value={formatEur(p.net_cents)} strong />
        {showCost && p.cost_cents !== null && (
          <div className="mt-2 rounded-md border border-dashed border-border bg-muted/40 p-2 text-xs">
            <Row label="Kostprijs (intern)" value={formatEur(p.cost_cents)} />
            <Row label="Marge (intern)" value={margin === null ? "—" : `${formatEur(p.net_cents - p.cost_cents)} · ${margin}%`} />
          </div>
        )}
      </div>
      {p.missing.length > 0 && (
        <ul className="space-y-1 rounded-md bg-warning/10 p-2 text-xs text-warning-foreground">
          {p.missing.map((m) => (
            <li key={m}>Prijs ontbreekt: {m}</li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-muted-foreground">
        Prijsboek {p.price_book_code ?? "—"} v{p.price_book_version ?? "—"} · alle prijzen zijn fictieve demodata.
      </p>
    </div>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "success" }) {
  return (
    <div className={cn("flex justify-between gap-3", strong && "text-base font-semibold", tone === "success" && "text-success")}>
      <span>{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}
