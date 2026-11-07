import { Link, Outlet, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Users, FolderKanban, Factory, Settings2, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { can, ROLE_LABEL, type Me } from "@/lib/auth";
import { LOCALES, useI18n, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function useMe(): Me {
  return useRouteContext({ from: "/_authenticated" }).me;
}

const NAV: { to: "/dashboard" | "/klanten" | "/projecten" | "/productie" | "/beheer"; key: MessageKey; icon: typeof Users; show?: (m: Me) => boolean }[] = [
  { to: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { to: "/klanten", key: "nav.customers", icon: Users },
  { to: "/projecten", key: "nav.projects", icon: FolderKanban },
  { to: "/productie", key: "nav.production", icon: Factory },
  { to: "/beheer", key: "nav.admin", icon: Settings2, show: (m) => can.admin(m.role) },
];

export function AppShell() {
  const me = useMe();
  const { t, locale, setLocale } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="no-print sticky top-0 flex h-screen w-56 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2 px-4 py-4">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-sidebar-primary font-mono text-xs font-semibold text-sidebar-primary-foreground">CPQ</span>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-sidebar-accent-foreground">JoRPA CPQ</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-sidebar-foreground/70">ramen · deuren · demo</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-2" aria-label="Hoofdnavigatie">
          {NAV.filter((n) => !n.show || n.show(me)).map(({ to, key, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}
            >
              <Icon className="h-4 w-4" />
              {t(key)}
            </Link>
          ))}
        </nav>
        <div className="space-y-3 border-t border-sidebar-border p-3">
          <div className="flex gap-1" role="group" aria-label="Taal">
            {LOCALES.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLocale(l.code)}
                aria-pressed={locale === l.code}
                className={cn(
                  "flex-1 rounded px-2 py-1 font-mono text-xs",
                  locale === l.code ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent",
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
          <div className="text-xs">
            <div className="truncate font-medium text-sidebar-accent-foreground">{me.name}</div>
            <div className="text-sidebar-foreground/75">{me.role ? ROLE_LABEL[me.role] : "Geen rol"}</div>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> {t("nav.signout")}
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="no-print sticky top-0 z-30 border-b border-border bg-demo px-6 py-1.5 text-xs font-medium text-demo-foreground" role="note">
          {t("demo.banner")}
        </div>
        <main className="flex-1 px-6 py-6 lg:px-8">
          {me.role ? (
            <Outlet />
          ) : (
            <div className="rounded-md border border-border bg-card p-6 text-sm">Aan dit account is geen rol toegekend. Meld je af en kies een demorol.</div>
          )}
        </main>
      </div>
    </div>
  );
}
