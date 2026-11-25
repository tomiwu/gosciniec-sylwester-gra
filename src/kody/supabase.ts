/**
 * Server-side Supabase RPC calls for staff routes.
 * The service role is a Kody secret placeholder. Kody puts the value in only
 * on an outbound fetch to the approved host. The value is never in this repo.
 */
export const SERVICE_ROLE_SECRET = "{{secret:supabaseServiceRole}}";

export type StaffRpc =
  | "check_code"
  | "redeem_code"
  | "list_codes"
  | "dashboard_stats"
  | "hide_nickname";

const NO_STORE = "no-store";

export function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": NO_STORE,
      ...headers,
    },
  });
}

/** True only for `https://<ref>.supabase.co` with no path, query or credentials. */
export function isApprovedSupabaseUrl(value: string): boolean {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return isSupabaseHost(url) && url.href === `${url.origin}/`;
}

function isSupabaseHost(url: URL): boolean {
  return url.protocol === "https:" && url.hostname.endsWith(".supabase.co");
}

export function rpcUrl(baseUrl: string, rpc: StaffRpc): string {
  return `${new URL(baseUrl).origin}/rest/v1/rpc/${rpc}`;
}

function rpcInit(args: Record<string, unknown>): RequestInit {
  return {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_SECRET,
      Authorization: `Bearer ${SERVICE_ROLE_SECRET}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(args),
  };
}

/** Call one RPC and pass its status and body through. No logs: a log could hold the request headers. */
export async function callStaffRpc(
  fetchFn: typeof fetch,
  baseUrl: string,
  rpc: StaffRpc,
  args: Record<string, unknown>,
): Promise<Response> {
  let upstream: Response;
  try {
    upstream = await fetchFn(rpcUrl(baseUrl, rpc), rpcInit(args));
  } catch {
    return jsonResponse(502, { error: "supabase_unreachable" });
  }
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": NO_STORE,
    },
  });
}
