import "server-only";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication required.");
    this.name = "AuthenticationRequiredError";
  }
}

export function authenticationErrorResponse(error: unknown): Response | null {
  if (!(error instanceof AuthenticationRequiredError)) return null;

  return Response.json({ error: error.message }, { status: 401 });
}
