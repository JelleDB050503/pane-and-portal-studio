import { cn } from "@/lib/utils";
import type { ItemStatus } from "@/lib/cpq/types";
import { STATUS_LABEL } from "@/lib/cpq/rules";
import { QUOTE_STATUS_LABEL, type QuoteStatus } from "@/lib/labels";

const base = "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium whitespace-nowrap";

const ITEM_TONE: Record<ItemStatus, string> = {
  ok: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning-foreground",
  not_configured: "bg-demo text-demo-foreground",
  error: "bg-destructive/12 text-destructive",
};

export function ItemStatusBadge({ status, className }: { status: ItemStatus | string; className?: string }) {
  const s = (status in ITEM_TONE ? status : "error") as ItemStatus;
  return <span className={cn(base, ITEM_TONE[s], className)}>{STATUS_LABEL[s]}</span>;
}

const QUOTE_TONE: Record<QuoteStatus, string> = {
  concept: "bg-muted text-muted-foreground border border-border",
  interne_controle: "bg-warning/20 text-warning-foreground",
  goedgekeurd: "bg-info/15 text-info",
  verzonden: "bg-primary/12 text-primary",
  aanvaard: "bg-success/15 text-success",
  afgewezen: "bg-destructive/12 text-destructive",
  vervallen: "bg-muted text-muted-foreground line-through",
};

export function QuoteStatusBadge({ status, className }: { status: QuoteStatus; className?: string }) {
  return <span className={cn(base, QUOTE_TONE[status], className)}>{QUOTE_STATUS_LABEL[status]}</span>;
}

export function DemoTag({ className, children = "DEMO" }: { className?: string; children?: React.ReactNode }) {
  return <span className={cn(base, "bg-demo font-mono text-[10px] tracking-wide text-demo-foreground", className)}>{children}</span>;
}

export function Tone({ tone, children, className }: { tone: "muted" | "success" | "warning" | "danger" | "info"; children: React.ReactNode; className?: string }) {
  const map = {
    muted: "bg-muted text-muted-foreground",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    danger: "bg-destructive/12 text-destructive",
    info: "bg-info/15 text-info",
  };
  return <span className={cn(base, map[tone], className)}>{children}</span>;
}
