import { Check, Lock, Sparkles } from "lucide-react";
import type { Catalog, Evaluation } from "@/lib/cpq/types";
import { cn } from "@/lib/utils";

export interface Choice {
  code: string;
  label: string;
  hint?: string | null;
  swatch?: string | null;
}

/** Card-style single/multi choice. Unavailable values stay visible with the reason, never silently hidden. */
export function ChoiceGrid({
  choices,
  selected,
  available,
  reasons,
  onSelect,
  disabled,
  auto,
  name,
  multi,
}: {
  choices: Choice[];
  selected: string | string[] | undefined;
  available: string[] | undefined;
  reasons?: Record<string, string> | undefined;
  onSelect: (code: string) => void;
  disabled?: boolean;
  auto?: Record<string, string>;
  name: string;
  multi?: boolean;
}) {
  const sel = Array.isArray(selected) ? selected : selected ? [selected] : [];
  return (
    <div role={multi ? "group" : "radiogroup"} aria-label={name} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {choices.map((c) => {
        const isSel = sel.includes(c.code);
        const isAvail = !available || available.includes(c.code);
        const reason = !isAvail ? reasons?.[c.code] ?? "Niet beschikbaar in deze combinatie." : null;
        const autoMsg = auto?.[c.code];
        return (
          <button
            key={c.code}
            type="button"
            role={multi ? "checkbox" : "radio"}
            aria-checked={isSel}
            aria-disabled={!isAvail || disabled}
            disabled={disabled || (!isAvail && !isSel)}
            onClick={() => onSelect(c.code)}
            title={reason ?? autoMsg ?? c.hint ?? undefined}
            className={cn(
              "relative flex min-h-[58px] flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left text-sm transition-colors",
              isSel && isAvail && "border-primary bg-primary/5 ring-1 ring-primary",
              isSel && !isAvail && "border-destructive bg-destructive/5 ring-1 ring-destructive",
              !isSel && isAvail && "border-border bg-card hover:border-primary/50",
              !isAvail && !isSel && "cursor-not-allowed border-dashed border-border bg-muted/40 text-muted-foreground",
            )}
          >
            <span className="flex w-full items-center gap-2">
              {c.swatch && <span className="h-4 w-4 shrink-0 rounded-sm border border-border" style={{ background: c.swatch }} aria-hidden />}
              <span className="font-medium leading-tight">{c.label}</span>
              {isSel && <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />}
              {!isAvail && !isSel && <Lock className="ml-auto h-3 w-3 shrink-0" aria-hidden />}
            </span>
            {reason && <span className="text-[11px] leading-snug">{reason}</span>}
            {!reason && autoMsg && (
              <span className="flex items-center gap-1 text-[11px] leading-snug text-info">
                <Sparkles className="h-3 w-3" /> {autoMsg}
              </span>
            )}
            {!reason && !autoMsg && c.hint && <span className="text-[11px] leading-snug text-muted-foreground">{c.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function optionChoices(catalog: Catalog, optionCode: string): Choice[] {
  return catalog.values
    .filter((v) => v.option_code === optionCode && v.active)
    .sort((a, b) => a.sort - b.sort)
    .map((v) => {
      const a = v.attributes ?? {};
      const hint = [a["ug"] != null ? `Ug ${a["ug"]} W/m²K (demo)` : null, typeof a["note"] === "string" ? a["note"] : null].filter(Boolean).join(" · ");
      return { code: v.code, label: v.name_nl, hint: hint || null, swatch: typeof a["hex"] === "string" ? (a["hex"] as string) : null };
    });
}

export function autoFor(ev: Evaluation, field: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, a] of Object.entries(ev.autoIncluded)) {
    if (k === field || k.startsWith(`${field}:`)) out[a.value] = a.message;
  }
  return out;
}
