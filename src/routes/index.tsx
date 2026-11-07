import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginScreen } from "@/components/cpq/login-screen";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "JoRPA CPQ demo – aanmelden" },
      { name: "description", content: "Prototype CPQ voor ramen en deuren: configureren, prijzen, varianten en offertes met fictieve testgegevens." },
      { property: "og:title", content: "JoRPA CPQ demo – ramen en deuren" },
      { property: "og:description", content: "Prototype CPQ voor ramen en deuren met fictieve testgegevens." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginScreen,
});
