/** Server-side staff RPCs. The service-role value is a Kody secret placeholder. */

export const SUPABASE_URL = "https://csyrndeuldzbbkizmcav.supabase.co";
export const SERVICE_ROLE_PLACEHOLDER = "{{secret:supabaseServiceRole}}";
export const STAFF_HOST = "csyrndeuldzbbkizmcav.supabase.co";

export type StaffRpcName =
  | "check_code"
  | "redeem_code"
  | "list_codes"
  | "dashboard_stats"
  | "hide_nickname"
  | "leaderboard";

export type StaffRpcResult = {
  ok: boolean;
  status: number;
  body: unknown;
};

export function staffRpcHeaders(secret: string): HeadersInit {
  return {
    apikey: secret,
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
  };
}

export function staffRpcUrl(
  rpc: StaffRpcName,
  supabaseUrl = SUPABASE_URL,
): string {
  return `${supabaseUrl}/rest/v1/rpc/${rpc}`;
}

export async function callStaffRpc(
  rpc: StaffRpcName,
  args: Record<string, unknown>,
  options: {
    fetch: typeof fetch;
    secret?: string;
    supabaseUrl?: string;
  },
): Promise<StaffRpcResult> {
  const secret = options.secret ?? SERVICE_ROLE_PLACEHOLDER;
  const response = await options.fetch(staffRpcUrl(rpc, options.supabaseUrl), {
    method: "POST",
    headers: staffRpcHeaders(secret),
    body: JSON.stringify(args),
  });
  const text = await response.text();
  let body: unknown = text;
  if (text.length > 0) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { error: text };
    }
  } else {
    body = null;
  }
  return { ok: response.ok, status: response.status, body };
}
