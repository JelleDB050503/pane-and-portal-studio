import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createImmutableDocument, createOrder, platformRows, transitionOrder } from "@/lib/sqlite-db.server";

const organizationId = "org-internal";

type OllamaResponse = {
  message?: {
    content?: string;
  };
};

async function askOllama(question: string, context: Record<string, unknown>) {
  const baseUrl = (process.env["OLLAMA_BASE_URL"] ?? "http://127.0.0.1:11434").replace(/\/+$/, "");
  const model = process.env["OLLAMA_MODEL"] ?? "qwen3.5:9b";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        think: false,
        messages: [
          {
            role: "system",
            content:
              "Je bent een CPQ verkoopassistent voor ramen en deuren. Geef alleen advies en stel nooit voor dat je een configuratie of prijs definitief hebt opgeslagen. De server-side technische regels en prijsengine zijn altijd de bron van waarheid. Antwoord in het Nederlands, kort en concreet.",
          },
          {
            role: "user",
            content: `Vraag: ${question}\nContext: ${JSON.stringify(context)}`,
          },
        ],
        options: { temperature: 0.2, num_predict: 192 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama antwoordde met HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as OllamaResponse;
    const suggestion = payload.message?.content?.trim();
    if (!suggestion) throw new Error("Ollama gaf een leeg antwoord.");
    return { provider: "ollama", model, suggestion };
  } finally {
    clearTimeout(timeout);
  }
}

export const createOrderFromRevision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ revisionId: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const revision = await context.supabase.from("quote_revisions").select("*").eq("id", data.revisionId).maybeSingle();
    if (!revision.data) throw new Error("Offerte-revisie niet gevonden.");
    if (!["aanvaard", "goedgekeurd"].includes(String(revision.data["status"]))) throw new Error("Alleen goedgekeurde of aanvaarde offertes kunnen een order worden.");
    const existing = platformRows("orders", organizationId).find((row) => row["quote_revision_id"] === data.revisionId);
    if (existing) return { id: String(existing["id"]), order_number: String(existing["order_number"]), status: String(existing["status"]) };
    return createOrder({ organizationId, quoteRevisionId: data.revisionId, snapshot: (revision.data["snapshot"] ?? {}) as Record<string, unknown>, createdBy: context.userId });
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ orderId: z.string().min(1), status: z.enum(["concept", "bevestigd", "in_productie", "gereed", "geleverd", "geannuleerd"]), comment: z.string().max(500).optional() }).parse(data))
  .handler(async ({ data, context }) => transitionOrder(data.orderId, data.status, context.userId, data.comment));

export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => platformRows("orders", organizationId).map((row) => ({ ...row, snapshot_json: undefined })));

export const createImmutableDocumentRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ sourceType: z.enum(["quote_revision", "order", "configuration"]), sourceId: z.string().min(1), documentType: z.enum(["quote", "technical_sheet", "bom", "order_confirmation"]), version: z.number().int().positive(), content: z.record(z.string(), z.unknown()) }).parse(data))
  .handler(async ({ data, context }) => createImmutableDocument({ organizationId, sourceType: data.sourceType, sourceId: data.sourceId, documentType: data.documentType, version: data.version, content: data.content, createdBy: context.userId }));

export const guidedSelling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ widthMm: z.number().int().positive(), heightMm: z.number().int().positive(), family: z.enum(["raam", "deur"]), material: z.enum(["pvc", "alu"]).optional(), budget: z.number().nonnegative().optional(), insulation: z.enum(["basic", "high"]).optional() }).parse(data))
  .handler(async ({ data }) => {
    const recommendations = [
      { family: data.family, system: data.material === "alu" ? "ALU-75" : "PVC-70", reason: data.insulation === "high" ? "Geschikt als hoogwaardige isolatiekeuze." : "Passende standaardkeuze voor de opgegeven maten.", score: data.material ? 1 : 0.8 },
      ...(data.family === "raam" ? [{ family: "raam", system: data.material === "alu" ? "PVC-70" : "ALU-75", reason: "Alternatief profiel voor vergelijking.", score: 0.65 }] : []),
    ];
    return { recommendations, constraints: { widthMm: data.widthMm, heightMm: data.heightMm, budget: data.budget ?? null }, source: "rules-engine" };
  });

export const localAiSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => z.object({ question: z.string().trim().min(3).max(1000), context: z.record(z.string(), z.unknown()).default({}) }).parse(data))
  .handler(async ({ data, context }) => {
    try {
      const response = await askOllama(data.question, data.context);
      return { status: "suggestion" as const, ...response, proposedFields: {}, safe: true, question: data.question, userId: context.userId };
    } catch (error) {
      const reason = error instanceof Error && error.name === "AbortError" ? "te lang bezig (meer dan 120 seconden)" : "niet bereikbaar";
      return {
        status: "suggestion" as const,
        provider: "ollama-unavailable",
        model: process.env["OLLAMA_MODEL"] ?? "qwen3.5:9b",
        suggestion: `De lokale Ollama-agent is momenteel ${reason}. Start Ollama en controleer OLLAMA_BASE_URL en OLLAMA_MODEL.`,
        proposedFields: {},
        safe: true,
        question: data.question,
        userId: context.userId,
      };
    }
  });
