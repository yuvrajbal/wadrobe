import "server-only";

import { headers } from "next/headers";

import { AuthenticationRequiredError } from "@/lib/api-auth";
import { auth } from "@/lib/auth";

export async function getCurrentUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    throw new AuthenticationRequiredError();
  }

  return session.user.id;
}
