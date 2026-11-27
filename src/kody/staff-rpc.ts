/** Server-side staff RPCs. The credential client injects the secret at the host. */

export const SUPABASE_URL = "https://csyrndeuldzbbkizmcav.supabase.co";
export const STAFF_HOST = "csyrndeuldzbbkizmcav.supabase.co";

export type StaffRpcName =
  | "check_code"
  | "redeem_code"
  | "list_codes"
  | "dashboard_stats"
  | "hide_nickname"
  | "leaderboard"
  | "list_top_rounds"
  | "get_round_log"
  | "confirm_replay";

export type StaffRpcResult = {
  ok: boolean;
  status: number;
  body: unknown;
};

export function staffRpcHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-kody-secret-resolution": "headers-only",
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
    supabaseUrl?: string;
  },
): Promise<StaffRpcResult> {
  const response = await options.fetch(staffRpcUrl(rpc, options.supabaseUrl), {
    method: "POST",
    headers: staffRpcHeaders(),
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
