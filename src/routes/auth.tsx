import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginScreen } from "@/components/cpq/login-screen";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Aanmelden – JoRPA CPQ demo" },
      { name: "description", content: "Meld je aan met een demorol: verkoper, productbeheerder, manager of productie." },
      { property: "og:title", content: "Aanmelden – JoRPA CPQ demo" },
      { property: "og:description", content: "Meld je aan met een demorol in de CPQ-demo voor ramen en deuren." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginScreen,
});
