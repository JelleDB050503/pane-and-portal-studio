import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PageHeader } from "@/components/cpq/page";
import { guidedSelling, localAiSuggestion } from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/guided-selling")({ component: GuidedSellingPage });

function GuidedSellingPage() {
  const recommend = useServerFn(guidedSelling);
  const askAi = useServerFn(localAiSuggestion);
  const [widthMm, setWidthMm] = useState(1200);
  const [heightMm, setHeightMm] = useState(1400);
  const [family, setFamily] = useState<"raam" | "deur">("raam");
  const [material, setMaterial] = useState<"pvc" | "alu">("pvc");
  const [result, setResult] = useState<Awaited<ReturnType<typeof recommend>> | null>(null);
  const [ai, setAi] = useState<Awaited<ReturnType<typeof askAi>> | null>(null);
  const [question, setQuestion] = useState("Welke configuratie past bij deze klantbehoefte?");

  return (
    <div className="space-y-6">
      <PageHeader title="Guided selling" subtitle="Beantwoord enkele vragen en ontvang veilige, regelgebaseerde productvoorstellen." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Klantbehoefte">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm">Breedte (mm)<Input type="number" value={widthMm} onChange={(event) => setWidthMm(Number(event.target.value))} /></label>
            <label className="space-y-1 text-sm">Hoogte (mm)<Input type="number" value={heightMm} onChange={(event) => setHeightMm(Number(event.target.value))} /></label>
            <label className="space-y-1 text-sm">Product<select className="h-10 w-full rounded-md border bg-background px-3" value={family} onChange={(event) => setFamily(event.target.value as "raam" | "deur")}><option value="raam">Raam</option><option value="deur">Deur</option></select></label>
            <label className="space-y-1 text-sm">Materiaal<select className="h-10 w-full rounded-md border bg-background px-3" value={material} onChange={(event) => setMaterial(event.target.value as "pvc" | "alu")}><option value="pvc">PVC</option><option value="alu">Aluminium</option></select></label>
          </div>
          <Button className="mt-5" onClick={async () => setResult(await recommend({ data: { widthMm, heightMm, family, material, insulation: "high" } }))}>Toon aanbevelingen</Button>
        </Panel>
        <Panel title="Resultaat">
          {result ? <div className="space-y-3">{result.recommendations.map((item) => <div key={`${item.family}-${item.system}`} className="rounded-md border p-3"><div className="font-medium">{item.system}</div><div className="text-sm text-muted-foreground">{item.reason}</div></div>)}</div> : <p className="text-sm text-muted-foreground">Nog geen aanbevelingen.</p>}
        </Panel>
      </div>
      <Panel title="Lokale AI-assistent">
        <p className="mb-3 text-sm text-muted-foreground">De assistent geeft alleen een voorstel. De CPQ-regels en server-side prijsberekening blijven de bron van waarheid.</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Stel een vraag over deze configuratie..." aria-label="Vraag aan de AI-assistent" />
          <Button variant="outline" disabled={question.trim().length < 3} onClick={async () => setAi(await askAi({ data: { question, context: { widthMm, heightMm, family, material } } }))}>Vraag lokale assistent</Button>
        </div>
        {ai && <div className="mt-4 rounded-md border bg-muted/30 p-3 text-sm">{ai.suggestion}</div>}
      </Panel>
    </div>
  );
}
