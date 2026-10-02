import "server-only";

import { auth } from "@clerk/nextjs/server";

import { getOrCreateUserId } from "@/lib/users";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication is required.");
    this.name = "AuthenticationRequiredError";
  }
}

export async function getCurrentUserId(): Promise<string> {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    throw new AuthenticationRequiredError();
  }

  return getOrCreateUserId(clerkUserId);
}
