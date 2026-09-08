import "server-only";

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";

import { getDatabase } from "@/lib/db";
import * as schema from "@/lib/db/schema";

export const auth = betterAuth({
  database: drizzleAdapter(getDatabase(), {
    provider: "pg",
    schema,
  }),
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  account: {
    identityStrategy: "provider-id",
    modelName: "accounts",
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    modelName: "sessions",
    updateAge: 60 * 60 * 24,
  },
  user: {
    modelName: "users",
  },
  verification: {
    modelName: "verifications",
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    },
  },
});
