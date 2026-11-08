import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { projectsQuery, profilesQuery } from "@/lib/queries";
import { PageHeader, EmptyState } from "@/components/cpq/page";
import { RouteError } from "@/components/cpq/route-error";
import { NewProjectDialog } from "@/components/cpq/new-project-dialog";
import { useMe } from "@/components/cpq/app-shell";
import { can } from "@/lib/auth";
import { PROJECT_STATUS_LABEL, formatDate, formatDateTime } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/projecten/")({
  head: () => ({ meta: [{ title: "Projecten – JoRPA CPQ demo" }, { name: "description", content: "Projectlijst met klant, status en leverdatum." }] }),
  loader: async ({ context }) => {
    await Promise.all([context.queryClient.ensureQueryData(projectsQuery()), context.queryClient.ensureQueryData(profilesQuery())]);
  },
  component: Projects,
  errorComponent: RouteError,
});

function Projects() {
  const me = useMe();
  const { data } = useSuspenseQuery(projectsQuery());
  const { data: profiles } = useSuspenseQuery(profilesQuery());
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("alle");
  const [open, setOpen] = useState(false);
  const owner = (id: string | null) => profiles.find((p) => p.id === id)?.full_name ?? "—";

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return data.filter((p) => (status === "alle" || p.status === status) && (!n || [p.name, p.project_number, p.city, p.companies?.name].some((v) => (v ?? "").toLowerCase().includes(n))));
  }, [data, q, status]);

  return (
    <div>
      <PageHeader
        title="Projecten"
        subtitle={`${data.length} projecten`}
        actions={
          can.sell(me.role) && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> Nieuw project
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[260px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek op project, nummer, klant of gemeente" className="pl-8" aria-label="Zoeken" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle statussen</SelectItem>
            {Object.entries(PROJECT_STATUS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {rows.length === 0 ? (
        <EmptyState>Geen projecten gevonden.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Project</th>
                <th className="px-4 py-2 font-medium">Klant</th>
                <th className="px-4 py-2 font-medium">Adres</th>
                <th className="px-4 py-2 font-medium">Verantwoordelijke</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Leverdatum</th>
                <th className="px-4 py-2 text-right font-medium">Posities</th>
                <th className="px-4 py-2 font-medium">Gewijzigd</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-muted/40">
                  <td className="px-4 py-2.5">
                    <Link to="/projecten/$id" params={{ id: p.id }} className="font-medium text-primary hover:underline">
                      {p.name}
                    </Link>
                    <div className="font-mono text-xs text-muted-foreground">{p.project_number}</div>
                  </td>
                  <td className="px-4 py-2.5">{p.companies?.name}</td>
                  <td className="px-4 py-2.5 text-xs">{[p.street, p.city].filter(Boolean).join(", ") || "—"}</td>
                  <td className="px-4 py-2.5 text-xs">{owner(p.owner_id)}</td>
                  <td className="px-4 py-2.5">{PROJECT_STATUS_LABEL[p.status] ?? p.status}</td>
                  <td className="px-4 py-2.5">{formatDate(p.desired_delivery_date)}</td>
                  <td className="tabular px-4 py-2.5 text-right">{p.project_items.filter((i) => !i.deleted_at).length}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDateTime(p.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <NewProjectDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
