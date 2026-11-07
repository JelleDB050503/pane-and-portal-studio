import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
      <p className="font-medium text-destructive">Gegevens konden niet geladen worden.</p>
      <p className="mt-1 text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
      <Button
        size="sm"
        variant="outline"
        className="mt-3"
        onClick={() => {
          router.invalidate();
          reset();
        }}
      >
        Opnieuw proberen
      </Button>
    </div>
  );
}

export function NotFoundBlock({ what = "Dit item" }: { what?: string }) {
  return <div className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">{what} werd niet gevonden of je hebt er geen toegang toe.</div>;
}
