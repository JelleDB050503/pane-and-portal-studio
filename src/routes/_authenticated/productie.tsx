import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { productionItemsQuery } from "@/lib/queries";
import { PageHeader, Panel, EmptyState } from "@/components/cpq/page";
import { RouteError } from "@/components/cpq/route-error";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/productie")({
  loader: ({ context }) => context.queryClient.ensureQueryData(productionItemsQuery()),
  component: Production,
  errorComponent: RouteError,
});

function Production() {
  const { data } = useSuspenseQuery(productionItemsQuery());
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <PageHeader title={t("page.production.title")} subtitle="Goedgekeurde configuraties en technische informatie." />
      <Panel title="Configuratie-items">
        {data.length === 0 ? <EmptyState>Er zijn nog geen configuratie-items.</EmptyState> : (
          <div className="divide-y divide-border">
            {data.map((item) => {
              const config = (item.data ?? {}) as { product_code?: string; system?: string; width_mm?: number; height_mm?: number; family?: string };
              return (
                <Link key={item.id} to="/fiche/$itemId" params={{ itemId: item.id }} className="flex items-center justify-between gap-4 py-3 hover:text-primary">
                  <div><div className="font-medium">{config.product_code ?? "Configuratie"}</div><div className="text-xs text-muted-foreground">{config.family ?? "—"} · {config.system ?? "—"}</div></div>
                  <div className="text-right text-sm">{config.width_mm ?? 0} × {config.height_mm ?? 0} mm<div className="text-xs text-muted-foreground">{item.status ?? "concept"}</div></div>
                </Link>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
