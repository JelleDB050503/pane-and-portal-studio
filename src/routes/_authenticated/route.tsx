import { createFileRoute, redirect } from "@tanstack/react-router";
import { fetchMe } from "@/lib/auth";
import { AppShell } from "@/components/cpq/app-shell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const me = await fetchMe();
    if (!me) throw redirect({ to: "/auth" });
    return { me };
  },
  component: AppShell,
});
