import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export interface Me {
  id: string;
  email: string;
  name: string;
  role: AppRole | null;
}

export async function fetchMe(): Promise<Me | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: roles }, { data: profile }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  return {
    id: user.id,
    email: user.email ?? "",
    name: profile?.full_name || user.email || "Gebruiker",
    role: roles?.[0]?.role ?? null,
  };
}

/**
 * UI permission helpers. These only hide controls; the database (RLS) and the
 * server functions enforce the same rules independently.
 */
export const can = {
  sell: (r: AppRole | null) => r === "verkoper" || r === "manager",
  approve: (r: AppRole | null) => r === "manager",
  editCatalog: (r: AppRole | null) => r === "productbeheerder",
  editTemplates: (r: AppRole | null) => r === "productbeheerder" || r === "manager",
  seeCosts: (r: AppRole | null) => r === "productbeheerder" || r === "manager",
  admin: (r: AppRole | null) => r === "productbeheerder" || r === "manager",
};

export const ROLE_LABEL: Record<AppRole, string> = {
  verkoper: "Verkoper",
  productbeheerder: "Productbeheerder / engineer",
  manager: "Manager",
  productie: "Productie / lezer",
};
