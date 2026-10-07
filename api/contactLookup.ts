import { normalizePhone } from "./auth";

/** Never interpret display names, fragments, or SQL wildcards as identities. */
export function contactLookup(
  query: string,
  countryCode?: string
): { phone: string } | { username: string } | null {
  const q = query.trim();
  if (/^@?[a-z][a-z0-9_]{2,31}$/i.test(q))
    return { username: q.replace(/^@/, "").toLowerCase() };
  if (!q.startsWith("+") && !countryCode) return null;
  try {
    return { phone: normalizePhone(countryCode || "", q) };
  } catch {
    return null;
  }
}
