import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SignInCard } from "@/app/sign-in/sign-in-card";
import { auth } from "@/lib/auth";

function safeCallbackUrl(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate?.startsWith("/") && !candidate.startsWith("//")
    ? candidate
    : "/";
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const callbackUrl = safeCallbackUrl((await searchParams).callbackUrl);
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) redirect(callbackUrl);

  return <SignInCard callbackUrl={callbackUrl} />;
}
