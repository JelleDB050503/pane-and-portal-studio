import { createFileRoute, Link } from "@tanstack/react-router";
import { RouteError } from "@/components/cpq/route-error";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { dashboardQuery } from "@/lib/queries";
import { PageHeader, Panel, EmptyState } from "@/components/cpq/page";
import { QuoteStatusBadge } from "@/components/cpq/badges";
import { eur, formatDate, formatDateTime, PROJECT_STATUS_LABEL, type QuoteStatus } from "@/lib/labels";
import { useMe } from "@/components/cpq/app-shell";
import { can } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard – JoRPA CPQ demo" }, { name: "description", content: "Openstaande offertes, concepten en goedkeuringen." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery()),
  component: Dashboard,
  errorComponent: RouteError,
});

function Dashboard() {
  const me = useMe();
  const { data } = useSuspenseQuery(dashboardQuery());
  const latest = data.quotes.map((q) => {
    const revs = [...q.quote_revisions].sort((a, b) => b.revision_no - a.revision_no);
    return { ...q, rev: revs[0] ?? null };
  });
  const by = (s: QuoteStatus[]) => latest.filter((q) => q.rev && s.includes(q.rev.status));
  const open = by(["verzonden", "goedgekeurd"]);
  const concepts = by(["concept"]);
  const waiting = by(["interne_controle"]);
  const won = by(["aanvaard"]);
  const decided = by(["aanvaard", "afgewezen"]);
  const openValue = open.reduce((s, q) => s + Number(q.rev?.total_net ?? 0), 0);
  const hitRate = decided.length ? Math.round((won.length / decided.length) * 100) : null;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Overzicht" title={`Goedemorgen, ${me.name.split(" ")[0]}`} subtitle="Stand van offertes en projecten (fictieve gegevens)." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Openstaande offertes" value={String(open.length)} sub={`${eur(openValue)} excl. btw`} />
        <Kpi label="Concepten" value={String(concepts.length)} sub="nog niet ingediend" />
        <Kpi label="Wachtend op goedkeuring" value={String(waiting.length)} sub={can.approve(me.role) ? "jouw beoordeling nodig" : "bij manager"} tone={waiting.length ? "warning" : undefined} />
        <Kpi label="Scoringsgraad" value={hitRate === null ? "—" : `${hitRate}%`} sub={`${won.length} aanvaard van ${decided.length} beslist`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Offertes" bodyClassName="p-0">
          {latest.length === 0 ? (
            <div className="p-4">
              <EmptyState>Nog geen offertes. Open een project en klik op "Offerte maken".</EmptyState>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Offerte</th>
                  <th className="px-4 py-2 font-medium">Project / klant</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Netto</th>
                </tr>
              </thead>
              <tbody>
                {latest.map((q) => (
                  <tr key={q.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-4 py-2.5">
                      {q.rev ? (
                        <Link to="/offertes/$revisionId" params={{ revisionId: q.rev.id }} className="font-mono text-xs font-medium text-primary hover:underline">
                          {q.quote_number} · rev {q.rev.revision_no}
                        </Link>
                      ) : (
                        <span className="font-mono text-xs">{q.quote_number}</span>
                      )}
                      <div className="text-xs text-muted-foreground">{formatDateTime(q.updated_at)}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{q.projects?.name}</div>
                      <div className="text-xs text-muted-foreground">{q.projects?.companies?.name}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      {q.rev && <QuoteStatusBadge status={q.rev.status} />}
                      {q.rev?.requires_approval && q.rev.status === "concept" && <div className="mt-1 text-xs text-warning-foreground">goedkeuring vereist</div>}
                    </td>
                    <td className="tabular px-4 py-2.5 text-right">{eur(q.rev?.total_net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <div className="space-y-6">
          {waiting.length > 0 && (
            <Panel title="Wachtend op goedkeuring">
              <ul className="space-y-3">
                {waiting.map((q) => {
                  const appr = data.approvals.find((a) => a.revision_id === q.rev?.id);
                  return (
                    <li key={q.id} className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{q.projects?.name}</span>
                        <span className="tabular">{eur(q.rev?.total_net)}</span>
                      </div>
                      {appr && <p className="mt-1 text-xs text-muted-foreground">{appr.reason}</p>}
                      <Link to="/offertes/$revisionId" params={{ revisionId: q.rev!.id }} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                        {can.approve(me.role) ? "Beoordelen" : "Bekijken"} <ArrowRight className="h-3 w-3" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
          <Panel
            title="Recent gewijzigde projecten"
            actions={
              <Link to="/projecten" className="text-xs font-medium text-primary hover:underline">
                Alle projecten
              </Link>
            }
            bodyClassName="p-0"
          >
            <ul>
              {data.projects.map((p) => (
                <li key={p.id} className="border-t border-border first:border-t-0">
                  <Link to="/projecten/$id" params={{ id: p.id }} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {p.project_number} · {p.companies?.name}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>{PROJECT_STATUS_LABEL[p.status] ?? p.status}</div>
                      <div>levering {formatDate(p.desired_delivery_date)}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "warning" }) {
  return (
    <div className={`rounded-lg border bg-card p-4 ${tone === "warning" ? "border-warning/60" : "border-border"}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="tabular mt-2 text-3xl font-semibold text-foreground">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
