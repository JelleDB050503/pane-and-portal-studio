import type { ProjectData } from "@/lib/queries";
import type { Catalog, ItemComputation, ItemConfig } from "@/lib/cpq/types";
import { formatEur } from "@/lib/cpq/totals";
import { valueLabel } from "@/lib/cpq/rules";
import { Panel } from "../page";

const COMPARE_FIELDS: { code: string; label: string; get: (c: ItemConfig) => string | undefined }[] = [
  { code: "material", label: "Materiaal", get: (c) => c.material },
  { code: "system", label: "Systeem", get: (c) => c.system },
  { code: "kleur_binnen", label: "Kleur binnen", get: (c) => c.values["kleur_binnen"] },
  { code: "kleur_buiten", label: "Kleur buiten", get: (c) => c.values["kleur_buiten"] },
  { code: "glas", label: "Glas", get: (c) => c.values["glas"] },
  { code: "beslag", label: "Beslag", get: (c) => c.values["beslag"] },
  { code: "zonwering", label: "Zonwering", get: (c) => c.values["zonwering"] },
  { code: "ventilatie", label: "Ventilatie", get: (c) => c.values["ventilatie"] },
];

/** Side-by-side comparison of all variants in a project: price per item and option differences. */
export function VariantCompare({ data, catalog, computed }: { data: ProjectData; catalog: Catalog; computed: Map<string, ItemComputation> }) {
  const variants = data.configurations;
  if (variants.length < 2) {
    return (
      <Panel title="Varianten vergelijken">
        <p className="text-sm text-muted-foreground">
          Er is maar één variant. Gebruik “Variant kopiëren” om bijvoorbeeld PVC tegenover aluminium of standaard tegenover premium glas te zetten.
        </p>
      </Panel>
    );
  }
  const base = variants[0]!;
  const cell = (variantId: string, piId: string) => {
    const ci = data.configItems.find((c) => c.configuration_id === variantId && c.project_item_id === piId);
    return ci ? computed.get(ci.id) ?? null : null;
  };
  const totals = variants.map((v) => data.items.reduce((s, pi) => s + (cell(v.id, pi.id)?.price.net_cents ?? 0), 0));

  return (
    <Panel title="Varianten naast elkaar" bodyClassName="p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-3 py-2 font-medium">Positie</th>
              {variants.map((v) => (
                <th key={v.id} className="px-3 py-2 font-medium">
                  {v.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map((pi) => {
              const ref = cell(base.id, pi.id);
              return (
                <tr key={pi.id} className="border-b border-border align-top">
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{pi.label}</div>
                  </td>
                  {variants.map((v, idx) => {
                    const c = cell(v.id, pi.id);
                    if (!c) return <td key={v.id} className="px-3 py-2.5 text-xs text-muted-foreground">—</td>;
                    const diffs =
                      idx === 0 || !ref
                        ? []
                        : COMPARE_FIELDS.filter((f) => f.get(c.evaluation.config) !== f.get(ref.evaluation.config)).map(
                            (f) => `${f.label}: ${valueLabel(catalog, f.code, f.get(c.evaluation.config))}`,
                          );
                    const delta = ref && idx > 0 ? c.price.net_cents - ref.price.net_cents : 0;
                    return (
                      <td key={v.id} className="px-3 py-2.5">
                        <div className="tabular font-medium">{formatEur(c.price.net_cents)}</div>
                        {idx > 0 && delta !== 0 && (
                          <div className={`tabular text-xs ${delta > 0 ? "text-destructive" : "text-success"}`}>
                            {delta > 0 ? "+" : ""}
                            {formatEur(delta)}
                          </div>
                        )}
                        {diffs.length > 0 && (
                          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                            {diffs.map((d) => (
                              <li key={d}>≠ {d}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-muted/40">
              <td className="px-3 py-2 text-xs font-medium text-muted-foreground">Totaal netto (excl. btw)</td>
              {totals.map((t, i) => (
                <td key={i} className="px-3 py-2">
                  <div className="tabular font-semibold">{formatEur(t)}</div>
                  {i > 0 && (
                    <div className={`tabular text-xs ${t - totals[0]! > 0 ? "text-destructive" : "text-success"}`}>
                      {t - totals[0]! > 0 ? "+" : ""}
                      {formatEur(t - totals[0]!)} t.o.v. {base.name}
                    </div>
                  )}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </Panel>
  );
}
