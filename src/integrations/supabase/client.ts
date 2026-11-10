import { createLocalClient } from "@/lib/local-db";
import type { Database } from "./types";

export const supabase = createLocalClient() as unknown as {
  from: (table: string) => unknown;
  auth: {
    getSession: () => Promise<unknown>;
    getUser: () => Promise<unknown>;
    setSession: (tokens: { access_token: string; refresh_token: string }) => Promise<unknown>;
    signOut: () => Promise<unknown>;
    onAuthStateChange: (listener: (event: string) => void) => { data: { subscription: { unsubscribe: () => void } } };
  };
} as never as import("@supabase/supabase-js").SupabaseClient<Database>;
