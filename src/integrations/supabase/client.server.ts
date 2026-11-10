import { createSqliteClient } from "@/lib/sqlite-db.server";

export const supabaseAdmin = createSqliteClient() as never;
