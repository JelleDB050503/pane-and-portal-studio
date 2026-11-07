import { DemoLogin } from "./demo-login";
import { DemoTag } from "./badges";

export function LoginScreen() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-demo px-4 py-2 text-center text-sm font-medium text-demo-foreground">
        Demo – niet gebruiken voor verkoop. Deze omgeving bevat uitsluitend fictieve testgegevens.
      </div>
      <main className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[1.1fr_1fr]">
        <section>
          <div className="mb-4 flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-primary font-mono text-sm font-semibold text-primary-foreground">CPQ</span>
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">JoRPA · ramen &amp; deuren</span>
            <DemoTag />
          </div>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-foreground">
            Configureren, prijzen en offreren
            <br />
            <span className="text-primary">in één project.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground">
            Prototype voor Techwin: meerdere ramen en deuren per project samenstellen, keuzes valideren tegen ingestelde regels,
            varianten vergelijken, een offerte als PDF uitbrengen en de overdracht naar JoRPA simuleren.
          </p>
          <ul className="mt-8 grid gap-3 text-sm text-foreground sm:grid-cols-2">
            {[
              "Stap-voor-stap configurator met live validatie",
              "Transparante, deterministische prijsberekening",
              "Offertevarianten naast elkaar (bv. PVC vs. aluminium)",
              "Bevroren offerterevisies met goedkeuringsflow",
              "Technische fiche, Sales- en Manufacturing BOM",
              "Mock-koppeling naar JoRPA zonder externe calls",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {t}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">Aanmelden met een demorol</h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">
            Eén klik per rol. Elke rol ziet en mag iets anders; dat wordt ook in de database afgedwongen.
          </p>
          <DemoLogin />
          <p className="mt-4 text-xs text-muted-foreground">
            Demo-login is enkel bedoeld voor deze prototypeomgeving en moet uitgeschakeld worden vóór elk niet-demogebruik.
          </p>
        </section>
      </main>
    </div>
  );
}
