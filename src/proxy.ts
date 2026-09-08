import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { userOwnsWardrobeImage } from "@/lib/wardrobe-items";

export async function proxy(request: NextRequest) {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.E2E_AUTH_BYPASS === "true"
  ) {
    return NextResponse.next();
  }

  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set(
      "callbackUrl",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(signInUrl);
  }

  if (
    request.nextUrl.pathname.startsWith("/uploads/") &&
    !(await userOwnsWardrobeImage(session.user.id, request.nextUrl.pathname))
  ) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/builder/:path*",
    "/saved/:path*",
    "/suggestions/:path*",
    "/uploads/:path*",
    "/api/images/:path*",
    "/api/items/:path*",
    "/api/outfits/:path*",
    "/api/suggestions/:path*",
    "/api/uploads/:path*",
  ],
};
