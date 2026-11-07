import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Briefcase, Wrench, ShieldCheck, Factory } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { demoSignIn } from "@/lib/cpq.functions";
import type { AppRole } from "@/lib/auth";

const ROLES: { role: AppRole; title: string; name: string; text: string; icon: typeof Briefcase }[] = [
  { role: "verkoper", title: "Verkoper", name: "Sanne (demo)", text: "Klanten en projecten, configureren, varianten en offertes.", icon: Briefcase },
  { role: "productbeheerder", title: "Productbeheerder", name: "Jonas (demo)", text: "Catalogus, regels, prijsboeken en BOM-regels beheren.", icon: Wrench },
  { role: "manager", title: "Manager", name: "Els (demo)", text: "Offertes beoordelen, kortingen goedkeuren, marges en auditlog.", icon: ShieldCheck },
  { role: "productie", title: "Productie / lezer", name: "Koen (demo)", text: "Goedgekeurde configuraties, technische fiche en BOM bekijken.", icon: Factory },
];

export function DemoLogin() {
  const signIn = useServerFn(demoSignIn);
  const navigate = useNavigate();
  const [busy, setBusy] = useState<AppRole | null>(null);

  async function go(role: AppRole) {
    setBusy(role);
    try {
      const tokens = await signIn({ data: { role } });
      const { error } = await supabase.auth.setSession(tokens);
      if (error) throw new Error("Sessie kon niet gestart worden.");
      await navigate({ to: "/dashboard" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Aanmelden mislukt.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {ROLES.map(({ role, title, name, text, icon: Icon }) => (
        <button
          key={role}
          type="button"
          onClick={() => go(role)}
          disabled={busy !== null}
          className="group flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-accent disabled:opacity-60"
        >
          <span className="mt-0.5 rounded-md bg-secondary p-2 text-primary">
            {busy === role ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-foreground">{title}</span>
            <span className="block font-mono text-xs text-muted-foreground">{name}</span>
            <span className="mt-1 block text-sm text-muted-foreground">{text}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
