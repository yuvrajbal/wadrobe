import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/lib/db/schema";
import { getDatabaseSsl, getDatabaseUrl } from "@/lib/env";

type Database = ReturnType<typeof drizzle<typeof schema>>;

let client: ReturnType<typeof postgres> | undefined;
let database: Database | undefined;

export function getDatabase(): Database {
  if (!database) {
    client = postgres(getDatabaseUrl(), { max: 10, ssl: getDatabaseSsl() });
    database = drizzle(client, { schema });
  }

  return database;
}
