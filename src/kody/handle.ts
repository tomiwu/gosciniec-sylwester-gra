import { callStaffRpc, type StaffRpcName } from "./staff-rpc";
import { verifyPackedLog } from "./verify-round";

export const PACKAGE_LEAF = "gosciniec-sylwester-gra";

export type AppUser = { id: string; username: string };

export type HandleDeps = {
  fetch: typeof fetch;
  allowList: readonly string[];
  resolveUser: (request: Request) => Promise<AppUser | null>;
};

function textField(body: unknown, key: string): string {
  if (!body || typeof body !== "object") return "";
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function optionalText(body: unknown, key: string): string | null {
  const value = textField(body, key);
  return value.length > 0 ? value : null;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function isStaff(
  user: AppUser | null,
  allowList: readonly string[],
): user is AppUser {
  return Boolean(user && allowList.includes(user.username));
}

function pathname(request: Request): string {
  const url = new URL(request.url);
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    return url.pathname.slice(0, -1);
  }
  return url.pathname;
}

function assetRedirect(request: Request, assetPath: string): Response {
  const url = new URL(request.url);
  url.pathname = assetPath;
  url.search = "";
  return Response.redirect(url, 302);
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function isGamePath(path: string): boolean {
  return path === "" || path === "/";
}

function isPanelPath(path: string): boolean {
  return path === "/panel" || path === "/panel/index.html";
}

function staticPage(
  request: Request,
  path: string,
  method: string,
): Response | null {
  if (method !== "GET") return null;
  if (isGamePath(path)) return assetRedirect(request, "/_assets/index.html");
  if (isPanelPath(path))
    return assetRedirect(request, "/_assets/panel/index.html");
  return null;
}

async function postRpc(
  rpc: StaffRpcName,
  args: Record<string, unknown>,
  deps: HandleDeps,
): Promise<Response> {
  const result = await callStaffRpc(rpc, args, deps);
  return json(result.status, result.body);
}

const GET_RPC: Record<
  string,
  { rpc: StaffRpcName; args: Record<string, unknown> }
> = {
  "/api/staff/codes": {
    rpc: "list_codes",
    args: { p_limit: 200, p_offset: 0 },
  },
  "/api/staff/stats": { rpc: "dashboard_stats", args: {} },
  "/api/staff/ranking": { rpc: "leaderboard", args: { p_limit: 50 } },
  "/api/staff/rounds": { rpc: "list_top_rounds", args: { p_limit: 20 } },
};

const POST_RPC: Record<
  string,
  { rpc: StaffRpcName; args: (body: unknown) => Record<string, unknown> }
> = {
  "/api/staff/check": {
    rpc: "check_code",
    args: (body) => ({ p_code: textField(body, "code") }),
  },
  "/api/staff/redeem": {
    rpc: "redeem_code",
    args: (body) => ({
      p_code: textField(body, "code"),
      p_note: optionalText(body, "note"),
    }),
  },
  "/api/staff/hide-nickname": {
    rpc: "hide_nickname",
    args: (body) => ({ p_nickname: textField(body, "nickname") }),
  },
};

function logPayload(body: unknown): { score: number; inputLog: string } | null {
  if (!body || typeof body !== "object") return null;
  const row = body as { input_log?: unknown; score?: unknown };
  return { score: Number(row.score), inputLog: String(row.input_log ?? "") };
}

async function verifyStaffRound(
  request: Request,
  deps: HandleDeps,
): Promise<Response> {
  const id = textField(await readJson(request), "roundId");
  if (!id) return json(400, { error: "round" });
  const found = await callStaffRpc("get_round_log", { p_round_id: id }, deps);
  const log = logPayload(found.body);
  if (!found.ok || !log) return json(found.status, found.body);
  const result = verifyPackedLog(log.score, log.inputLog);
  const saved = await callStaffRpc(
    "confirm_replay",
    { p_round_id: id, p_ok: result.ok, p_flags: result.flags },
    deps,
  );
  return json(saved.status, {
    ok: result.ok,
    flags: result.flags,
    replayedScore: result.replayedScore,
    score: log.score,
  });
}

async function staffRoute(
  request: Request,
  path: string,
  method: string,
  deps: HandleDeps,
): Promise<Response> {
  if (method === "GET") {
    const route = GET_RPC[path];
    return route
      ? postRpc(route.rpc, route.args, deps)
      : json(404, { error: "not_found" });
  }
  if (method === "POST") return staffPost(request, path, deps);
  return json(404, { error: "not_found" });
}

async function staffPost(
  request: Request,
  path: string,
  deps: HandleDeps,
): Promise<Response> {
  if (path === "/api/staff/verify-round") {
    return verifyStaffRound(request, deps);
  }
  const route = POST_RPC[path];
  if (!route) return json(404, { error: "not_found" });
  return postRpc(route.rpc, route.args(await readJson(request)), deps);
}

async function authorizeStaff(
  request: Request,
  path: string,
  method: string,
  deps: HandleDeps,
): Promise<Response> {
  const user = await deps.resolveUser(request);
  if (!isStaff(user, deps.allowList)) {
    return json(401, { error: "unauthorized" });
  }
  return staffRoute(request, path, method, deps);
}

/** Kody fetch handler: staff RPCs stay on the server. Static pages come from /_assets. */
export async function handleRequest(
  request: Request,
  deps: HandleDeps,
): Promise<Response> {
  const path = pathname(request);
  const method = request.method.toUpperCase();
  const page = staticPage(request, path, method);
  if (page) return page;
  if (path === "/api/staff/me" && method === "GET") {
    return json(200, { user: await deps.resolveUser(request) });
  }
  if (!path.startsWith("/api/staff/")) {
    return json(404, { error: "not_found" });
  }
  return authorizeStaff(request, path, method, deps);
}
