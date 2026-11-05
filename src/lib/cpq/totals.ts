import type { Discount, ItemPrice } from "./types";

export interface VariantTotals {
  subtotal_cents: number;
  discount_percent: number;
  discount_cents: number;
  net_cents: number;
  vat_rate: number;
  vat_cents: number;
  gross_cents: number;
  cost_cents: number | null;
  margin_cents: number | null;
  margin_percent: number | null;
}

export function variantTotals(prices: ItemPrice[], discountPercent: number, vatRate: number): VariantTotals {
  const subtotal = prices.reduce((s, p) => s + p.net_cents, 0);
  const discount = Math.round((subtotal * discountPercent) / 100);
  const net = subtotal - discount;
  const vat = Math.round((net * vatRate) / 100);
  const costKnown = prices.length > 0 && prices.every((p) => p.cost_cents !== null);
  const cost = costKnown ? prices.reduce((s, p) => s + (p.cost_cents ?? 0), 0) : null;
  const margin = cost === null ? null : net - cost;
  return {
    subtotal_cents: subtotal,
    discount_percent: discountPercent,
    discount_cents: discount,
    net_cents: net,
    vat_rate: vatRate,
    vat_cents: vat,
    gross_cents: net + vat,
    cost_cents: cost,
    margin_cents: margin,
    margin_percent: margin === null || net === 0 ? null : Math.round((margin / net) * 1000) / 10,
  };
}

export interface ApprovalCheck {
  allowed: boolean;
  requiresApproval: boolean;
  maxPercent: number;
  approvalAbovePercent: number;
  reasons: string[];
}

/**
 * Discount policy per role. A role without a configured limit may not give discount.
 * Margin below the configured threshold always needs manager approval.
 */
export function checkDiscountPolicy(
  discounts: Discount[],
  role: string,
  discountPercent: number,
  marginPercent: number | null,
): ApprovalCheck {
  const limit = discounts.find((d) => d.active && d.discount_type === "role_limit" && d.role === role);
  const maxPercent = Number(limit?.percent ?? 0);
  const approvalAbove = Number(limit?.approval_above_percent ?? maxPercent);
  const reasons: string[] = [];
  const allowed = discountPercent <= maxPercent;
  if (!allowed) reasons.push(`Korting ${discountPercent}% overschrijdt het maximum van ${maxPercent}% voor deze rol.`);
  let requiresApproval = discountPercent > approvalAbove;
  if (requiresApproval) reasons.push(`Korting ${discountPercent}% ligt boven de goedkeuringsdrempel van ${approvalAbove}%.`);
  const marginRule = discounts.find((d) => d.active && d.discount_type === "margin_threshold");
  if (marginRule && marginPercent !== null && marginPercent < Number(marginRule.percent ?? 0)) {
    requiresApproval = true;
    reasons.push(`Marge ${marginPercent}% ligt onder de minimummarge van ${marginRule.percent}%.`);
  }
  return { allowed, requiresApproval, maxPercent, approvalAbovePercent: approvalAbove, reasons };
}

export function formatEur(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(cents / 100);
}
