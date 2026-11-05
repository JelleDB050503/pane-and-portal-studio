// JoRPA connector boundary.
//
// The app only talks to the `JorpaConnector` interface. Today the only
// implementation is `MockJorpaConnector`, which performs NO network calls.
// A future secure implementation (JoRPA WCF/WebAPI behind an internal gateway)
// must implement the same interface server-side; see README "Integratiecontracten".

export interface JorpaBomLine {
  component_code: string;
  description: string;
  quantity: number;
  unit: string;
}

export interface JorpaItemPayload {
  position: number;
  label: string;
  family: string;
  system: string;
  material: string;
  width_mm: number;
  height_mm: number;
  quantity: number;
  sections: { opening: string; hinge: string | null }[];
  options: Record<string, string>;
  services: string[];
  production_notes: string;
  production_ready: boolean;
  bom: { assembly: string; lines: JorpaBomLine[] }[];
}

/** Contract draft for "gevalideerde offerte/order terugsturen". */
export interface JorpaQuotePayload {
  idempotency_key: string;
  source: "cpq-demo";
  demo: true;
  quote_number: string;
  revision_no: number;
  project_number: string;
  customer_ref: string | null;
  currency: "EUR";
  total_net: number;
  vat_rate: number;
  price_book: { code: string; version: number } | null;
  rules_version: number;
  items: JorpaItemPayload[];
}

export type SimulateMode = "none" | "timeout" | "server_error";

export type ConnectorResult =
  | { ok: true; external_ref: string; response: Record<string, unknown> }
  | { ok: false; error_code: string; error_message: string; retryable: boolean; response: Record<string, unknown> };

export interface JorpaConnector {
  readonly name: string;
  readonly isMock: boolean;
  pushQuote(payload: JorpaQuotePayload, opts?: { simulate?: SimulateMode; attempt?: number }): Promise<ConnectorResult>;
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

export class MockJorpaConnector implements JorpaConnector {
  readonly name = "jorpa-mock";
  readonly isMock = true;

  async pushQuote(payload: JorpaQuotePayload, opts: { simulate?: SimulateMode; attempt?: number } = {}): Promise<ConnectorResult> {
    const notReady = payload.items.filter((i) => !i.production_ready);
    if (notReady.length) {
      return {
        ok: false,
        error_code: "JRP-MOCK-422",
        error_message: `Mock-validatie: ${notReady.map((i) => i.label).join(", ")} ${notReady.length === 1 ? "is" : "zijn"} niet geconfigureerd voor productie.`,
        retryable: false,
        response: { status: 422, mock: true, rejected_positions: notReady.map((i) => i.position) },
      };
    }
    if (opts.simulate === "timeout") {
      return { ok: false, error_code: "JRP-MOCK-TIMEOUT", error_message: "Gesimuleerde time-out na 30 s (mock). Opnieuw proberen is veilig dankzij de idempotency-sleutel.", retryable: true, response: { status: 504, mock: true } };
    }
    if (opts.simulate === "server_error") {
      return { ok: false, error_code: "JRP-MOCK-500", error_message: "Gesimuleerde serverfout in JoRPA (mock).", retryable: true, response: { status: 500, mock: true } };
    }
    const ref = `JRP-DEMO-${hash(payload.idempotency_key)}`;
    return {
      ok: true,
      external_ref: ref,
      response: { status: 201, mock: true, order_ref: ref, accepted_positions: payload.items.length, message: "Mock: order aangemaakt (geen echte JoRPA-call)." },
    };
  }
}

export function getJorpaConnector(): JorpaConnector {
  // Later: return a real connector when an internal, authenticated endpoint is configured server-side.
  return new MockJorpaConnector();
}
