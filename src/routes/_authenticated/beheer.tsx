import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { catalogQuery } from "@/lib/queries";
import { PageHeader, Panel } from "@/components/cpq/page";
import { RouteError } from "@/components/cpq/route-error";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/beheer")({
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery(null, true)),
  component: Management,
  errorComponent: RouteError,
});

function Management() {
  const { data } = useSuspenseQuery(catalogQuery(null, true));
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <PageHeader title={t("page.admin.title")} subtitle="Lokale demo-catalogus en prijsboek." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Panel title="Productfamilies"><div className="text-3xl font-semibold">{data.families.length}</div></Panel>
        <Panel title="Producten"><div className="text-3xl font-semibold">{data.products.length}</div></Panel>
        <Panel title="Opties"><div className="text-3xl font-semibold">{data.options.length}</div></Panel>
        <Panel title="Prijsboek"><div className="font-mono text-lg">{data.priceBook?.code ?? "—"}</div></Panel>
      </div>
    </div>
  );
}
