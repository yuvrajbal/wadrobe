import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to apply migrations.");
}

const client = postgres(databaseUrl, { max: 1 });
const database = drizzle(client);

try {
  await migrate(database, { migrationsFolder: "drizzle" });
  console.log("Database migrations applied successfully.");
} finally {
  await client.end();
}
