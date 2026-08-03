import "server-only";

/**
 * Stable identity for the single-user MVP.
 *
 * All user-scoped server code should call this function instead of embedding a
 * user ID. When authentication is added, replace this implementation with the
 * authenticated session lookup and leave its callers unchanged.
 */
export function getCurrentUserId(): string {
  return "00000000-0000-4000-8000-000000000001";
}
