import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
const databaseSsl = process.env.DATABASE_SSL ?? "require";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to apply migrations.");
}

if (!["require", "disable"].includes(databaseSsl)) {
  throw new Error("DATABASE_SSL must be either require or disable.");
}

const client = postgres(databaseUrl, {
  max: 1,
  ssl: databaseSsl === "require" ? "require" : false,
});
const database = drizzle(client);

try {
  await migrate(database, { migrationsFolder: "drizzle" });
  console.log("Database migrations applied successfully.");
} finally {
  await client.end();
}
