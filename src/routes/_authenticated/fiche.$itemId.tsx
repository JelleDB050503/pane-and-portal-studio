import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { configItemQuery } from "@/lib/queries";
import { PageHeader, Panel } from "@/components/cpq/page";
import { RouteError } from "@/components/cpq/route-error";

export const Route = createFileRoute("/_authenticated/fiche/$itemId")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(configItemQuery(params.itemId)),
  component: TechnicalSheet,
  errorComponent: RouteError,
});

function TechnicalSheet() {
  const result = useSuspenseQuery(configItemQuery(Route.useParams().itemId)).data;
  if (!result) return <div>Configuratie-item niet gevonden.</div>;
  const { item, projectItem, project } = result;
  const data = item.data as { product_code?: string; family?: string; material?: string; system?: string; width_mm?: number; height_mm?: number; quantity?: number; sections?: unknown[]; values?: Record<string, string>; services?: string[]; production_notes?: string; remarks?: string };
  return (
    <div className="space-y-6">
      <PageHeader title="Technische fiche" subtitle={`${projectItem.label} · ${project.name}`} actions={<Link to="/configurator/$itemId" params={{ itemId: item.id }} className="text-sm text-primary hover:underline">Open configurator</Link>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Product"><dl className="grid grid-cols-2 gap-3 text-sm">{[["Product", data.product_code], ["Familie", data.family], ["Materiaal", data.material], ["Systeem", data.system], ["Afmetingen", `${data.width_mm} × ${data.height_mm} mm`], ["Aantal", data.quantity]].map(([label, value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="font-medium">{value ?? "—"}</dd></div>)}</dl></Panel>
        <Panel title="Keuzes"><dl className="space-y-2 text-sm">{Object.entries(data.values ?? {}).map(([key, value]) => <div key={key} className="flex justify-between gap-4"><dt className="text-muted-foreground">{key}</dt><dd className="font-medium">{value}</dd></div>)}</dl></Panel>
      </div>
      <Panel title="Productie"><p className="text-sm">{data.production_notes || "Geen productienotities."}</p><p className="mt-3 text-sm text-muted-foreground">{data.remarks || "Geen opmerkingen."}</p></Panel>
    </div>
  );
}
