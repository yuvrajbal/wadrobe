import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { getDatabase } from "@/lib/db";
import { users } from "@/lib/db/schema";

const legacyUserId = "00000000-0000-4000-8000-000000000001";

async function findUserId(clerkUserId: string): Promise<string | null> {
  const [user] = await getDatabase()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);

  return user?.id ?? null;
}

/**
 * Maps Clerk's provider-specific identifier to the app's UUID identity.
 *
 * The migration creates one unclaimed legacy user. The first authenticated
 * account claims it, preserving the wardrobe created before authentication.
 * Keep Clerk in restricted/allowlist mode until the owner has signed in once.
 * Every later Clerk account receives an independent UUID.
 */
export async function getOrCreateUserId(clerkUserId: string): Promise<string> {
  const existingUserId = await findUserId(clerkUserId);
  if (existingUserId) return existingUserId;

  const [claimedLegacyUser] = await getDatabase()
    .update(users)
    .set({ clerkUserId })
    .where(and(eq(users.id, legacyUserId), isNull(users.clerkUserId)))
    .returning({ id: users.id });

  if (claimedLegacyUser) return claimedLegacyUser.id;

  const [createdUser] = await getDatabase()
    .insert(users)
    .values({ clerkUserId })
    .onConflictDoNothing({ target: users.clerkUserId })
    .returning({ id: users.id });

  if (createdUser) return createdUser.id;

  // A concurrent request may have inserted this account first.
  const concurrentUserId = await findUserId(clerkUserId);
  if (concurrentUserId) return concurrentUserId;

  throw new Error("The authenticated user could not be initialized.");
}
