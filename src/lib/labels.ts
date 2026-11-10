import type { Database } from "@/integrations/supabase/types";
import type { MessageKey } from "@/lib/i18n";

export type QuoteStatus = Database["public"]["Enums"]["quote_status"];

export const QUOTE_STATUS_KEYS: Record<QuoteStatus, MessageKey> = {
  concept: "status.quote.concept",
  interne_controle: "status.quote.interne_controle",
  goedgekeurd: "status.quote.goedgekeurd",
  verzonden: "status.quote.verzonden",
  aanvaard: "status.quote.aanvaard",
  afgewezen: "status.quote.afgewezen",
  vervallen: "status.quote.vervallen",
};

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  concept: "Concept",
  interne_controle: "Interne controle",
  goedgekeurd: "Goedgekeurd",
  verzonden: "Verzonden",
  aanvaard: "Aanvaard",
  afgewezen: "Afgewezen",
  vervallen: "Vervallen",
};

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  lead: "Lead",
  in_opmaak: "In opmaak",
  offerte: "Offerte",
  gewonnen: "Gewonnen",
  verloren: "Verloren",
  in_productie: "In productie",
};

export const PROJECT_STATUS_KEYS: Record<string, MessageKey> = {
  lead: "status.project.lead",
  in_opmaak: "status.project.in_opmaak",
  offerte: "status.project.offerte",
  gewonnen: "status.project.gewonnen",
  verloren: "status.project.verloren",
  in_productie: "status.project.in_productie",
};

export const COMPANY_TYPE_LABEL: Record<string, string> = {
  particulier: "Particulier",
  aannemer: "Aannemer",
  dealer: "Dealer",
  architect: "Architect",
};

export const COMPANY_TYPE_KEYS: Record<string, MessageKey> = {
  particulier: "company.particulier",
  aannemer: "company.aannemer",
  dealer: "company.dealer",
  architect: "company.architect",
};

export const SYNC_LABEL: Record<string, string> = {
  niet_gesynchroniseerd: "Niet gesynchroniseerd",
};

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("nl-BE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d));
}

export function formatDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("nl-BE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}

/** Euro amount from a numeric column (euros, not cents). */
export function eur(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "—";
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(Number(n));
}
