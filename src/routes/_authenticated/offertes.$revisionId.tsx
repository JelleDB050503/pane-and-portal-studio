import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Download, Send, CheckCircle2, XCircle } from "lucide-react";
import { revisionQuery } from "@/lib/queries";
import { PageHeader, Panel } from "@/components/cpq/page";
import { QuoteStatusBadge } from "@/components/cpq/badges";
import { eur, formatDate, QUOTE_STATUS_KEYS } from "@/lib/labels";
import { RouteError } from "@/components/cpq/route-error";
import { sendToJorpa, transitionQuote } from "@/lib/cpq.functions";
import { createOrderFromRevision } from "@/lib/platform.functions";
import { useMe } from "@/components/cpq/app-shell";
import { can } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/offertes/$revisionId")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(revisionQuery(params.revisionId)),
  component: QuoteRevision,
  errorComponent: RouteError,
});

function QuoteRevision() {
  const data = useSuspenseQuery(revisionQuery(Route.useParams().revisionId)).data;
  const me = useMe();
  const { t } = useI18n();
  const qc = useQueryClient();
  const transition = useServerFn(transitionQuote);
  const send = useServerFn(sendToJorpa);
  const createOrder = useServerFn(createOrderFromRevision);
  const [busy, setBusy] = useState(false);
  if (!data) return <div>Offerte niet gevonden.</div>;
  const revisionData = data;
  const status = revisionData.revision.status;
  async function change(action: "submit" | "approve" | "reject" | "send" | "accept") {
    setBusy(true);
    try {
      await transition({ data: { revisionId: revisionData.revision.id, action } });
      toast.success(`${t("page.quotes.title")} ${t(QUOTE_STATUS_KEYS[revisionData.revision.status])}.`);
      await qc.invalidateQueries({ queryKey: ["revision", revisionData.revision.id] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Offertestatus kon niet worden aangepast.");
    } finally {
      setBusy(false);
    }
  }
  async function downloadPdf() {
    try {
      const { doc, autoTable } = await import("@/lib/pdf/common").then(async (common) => ({ ...(await common.newDoc()), common }));
      doc.setFontSize(18);
      doc.text(`Offerte ${revisionData.quote.quote_number}`, 14, 20);
      doc.setFontSize(10);
      doc.text(`${revisionData.quote.projects?.name ?? "Project"} · revisie ${revisionData.revision.revision_no}`, 14, 28);
      autoTable(doc, {
        startY: 38,
        head: [["Omschrijving", "Aantal", "Totaal"]],
        body: (revisionData.revision.snapshot as { variants?: { items?: { label?: string; price?: { quantity?: number; net_cents?: number } }[] }[] }).variants?.flatMap((variant) =>
          (variant.items ?? []).map((item) => [item.label ?? "Item", String(item.price?.quantity ?? 1), eur(item.price?.net_cents ?? 0)]),
        ) ?? [],
      });
      doc.save(`offerte-${revisionData.quote.quote_number}-rev-${revisionData.revision.revision_no}.pdf`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF kon niet worden gemaakt.");
    }
  }
  async function sendToProduction() {
    setBusy(true);
    try {
      const result = await send({ data: { revisionId: revisionData.revision.id, simulate: "none" } });
      toast.success(`Productie-export ${result.status === "geslaagd" ? "geslaagd" : "verwerkt"}.`);
      await qc.invalidateQueries({ queryKey: ["revision", revisionData.revision.id] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Productie-export mislukt.");
    } finally {
      setBusy(false);
    }
  }
  async function convertToOrder() {
    try {
      const order = await createOrder({ data: { revisionId: revisionData.revision.id } });
      toast.success(`Order ${order.order_number} aangemaakt.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Order aanmaken mislukt.");
    }
  }
  return (
    <div className="space-y-6">
      <PageHeader title={`Offerte ${revisionData.quote.quote_number}`} subtitle={`${revisionData.quote.projects?.name ?? "Project"} · revisie ${revisionData.revision.revision_no}`} actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadPdf}><Download className="h-4 w-4" /> PDF</Button>
          {status === "concept" && can.sell(me.role) && <Button disabled={busy} onClick={() => change("submit")}><Send className="h-4 w-4" /> Indienen</Button>}
          {status === "interne_controle" && can.approve(me.role) && <Button disabled={busy} onClick={() => change("approve")}><CheckCircle2 className="h-4 w-4" /> Goedkeuren</Button>}
          {status === "interne_controle" && can.approve(me.role) && <Button variant="outline" disabled={busy} onClick={() => change("reject")}><XCircle className="h-4 w-4" /> Afwijzen</Button>}
          {status === "goedgekeurd" && can.sell(me.role) && <Button disabled={busy} onClick={() => change("send")}><Send className="h-4 w-4" /> Verzenden</Button>}
          {status === "verzonden" && can.sell(me.role) && <Button disabled={busy} onClick={() => change("accept")}><CheckCircle2 className="h-4 w-4" /> Aanvaard</Button>}
          {status === "aanvaard" && can.approve(me.role) && <Button disabled={busy} onClick={sendToProduction}><Send className="h-4 w-4" /> Naar productie</Button>}
          {status === "aanvaard" && can.sell(me.role) && <Button variant="outline" disabled={busy} onClick={convertToOrder}>Order aanmaken</Button>}
          <Link to="/projecten/$id" params={{ id: revisionData.quote.project_id }} className="self-center text-sm text-primary hover:underline">Terug naar project</Link>
        </div>
      } />
      <div className="grid gap-4 sm:grid-cols-3"><Panel title="Status"><QuoteStatusBadge status={revisionData.revision.status} /></Panel><Panel title="Netto"><div className="text-2xl font-semibold">{eur(revisionData.revision.total_net)}</div></Panel><Panel title="Aangemaakt"><div className="text-sm">{formatDate(revisionData.revision.created_at)}</div></Panel></div>
      <Panel title="Revisies"><div className="divide-y divide-border">{revisionData.revisions.map((revision) => <div key={revision.id} className="flex justify-between py-3 text-sm"><span>Revisie {revision.revision_no}</span><span>{eur(revision.total_net)}</span></div>)}</div></Panel>
    </div>
  );
}
