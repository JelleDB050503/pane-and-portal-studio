import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createSqliteClient } from "@/lib/sqlite-db.server";
import { userForToken } from "@/lib/local-db";

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const token = getRequest()?.headers.get("authorization")?.replace(/^Bearer\s+/, "");
  const user = token ? userForToken(token) : null;
  if (!user) throw new Error("Unauthorized: lokale sessie ontbreekt.");
  return next({
    context: {
      supabase: createSqliteClient(),
      userId: user.id,
      claims: { sub: user.id },
    },
  });
});
