import { KODY_APP, STAFF_API, loginUrl } from "./config";
import { forbiddenPage, panelPage } from "./panel-page";
import {
  callStaffRpc,
  isApprovedSupabaseUrl,
  jsonResponse,
  type StaffRpc,
} from "./supabase";

/** The part of the Kody session user that the handler reads. */
export type KodyUser = { id: string; username: string };

export type HandlerDeps = {
  resolveUser(request: Request): Promise<KodyUser | null>;
  fetch: typeof fetch;
  allowList?: readonly string[];
  supabaseUrl?: string;
};

type Args = Record<string, unknown>;

type StaffRoute = {
  method: "GET" | "POST";
  rpc: StaffRpc;
  /** Build the RPC args. Return null for bad input. */
  args(body: unknown, query: URLSearchParams): Args | null;
};

const PANEL_PATH = "/panel/";
const STAFF_PREFIX = "/api/staff/";

function field(body: unknown, key: string): unknown {
  return typeof body === "object" && body !== null
    ? (body as Record<string, unknown>)[key]
    : undefined;
}

/** A trimmed, non-empty string up to max characters, or null. */
function requiredText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 && text.length <= max ? text : null;
}

/** undefined -> null (no note). Bad type or too long -> undefined (reject). */
function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null) return null;
  return requiredText(value, max) ?? undefined;
}

function intParam(
  query: URLSearchParams,
  key: string,
  fallback: number,
): number {
  const n = Number.parseInt(query.get(key) ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function codeArgs(body: unknown): Args | null {
  const code = requiredText(field(body, "code"), STAFF_API.codeMaxLength);
  return code === null ? null : { p_code: code };
}

function redeemArgs(body: unknown): Args | null {
  const base = codeArgs(body);
  const note = optionalText(field(body, "note"), STAFF_API.noteMaxLength);
  return base === null || note === undefined ? null : { ...base, p_note: note };
}

function listArgs(_body: unknown, query: URLSearchParams): Args {
  const limit = intParam(query, "limit", STAFF_API.listDefaultLimit);
  const offset = intParam(query, "offset", 0);
  return {
    p_limit: clamp(limit, 1, STAFF_API.listMaxLimit),
    p_offset: Math.max(0, offset),
  };
}

function nicknameArgs(body: unknown): Args | null {
  const nickname = requiredText(
    field(body, "nickname"),
    STAFF_API.nicknameMaxLength,
  );
  return nickname === null ? null : { p_nickname: nickname };
}

const STAFF_ROUTES: ReadonlyMap<string, StaffRoute> = new Map([
  ["check", { method: "POST", rpc: "check_code", args: codeArgs }],
  ["redeem", { method: "POST", rpc: "redeem_code", args: redeemArgs }],
  ["codes", { method: "GET", rpc: "list_codes", args: listArgs }],
  ["stats", { method: "GET", rpc: "dashboard_stats", args: () => ({}) }],
  [
    "hide-nickname",
    { method: "POST", rpc: "hide_nickname", args: nicknameArgs },
  ],
]);

function isStaff(user: KodyUser, allowList: readonly string[]): boolean {
  const name = user.username.toLowerCase();
  return allowList.some((allowed) => allowed.toLowerCase() === name);
}

function redirect(request: Request, path: string): Response {
  return Response.redirect(new URL(path, request.url).toString(), 302);
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  return origin === null || origin === new URL(request.url).origin;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    return undefined;
  }
}

/** A response that stops the request before Supabase, or null to go on. */
function preflight(
  request: Request,
  route: StaffRoute,
  supabaseUrl: string,
): Response | null {
  if (request.method !== route.method) {
    return jsonResponse(
      405,
      { error: "method_not_allowed" },
      { Allow: route.method },
    );
  }
  if (!isSameOrigin(request)) return jsonResponse(403, { error: "bad_origin" });
  if (!isApprovedSupabaseUrl(supabaseUrl)) {
    return jsonResponse(503, { error: "supabase_not_configured" });
  }
  return null;
}

/** Check the route, method, origin, config and input. Only then call Supabase. */
async function runStaffRoute(
  request: Request,
  route: StaffRoute,
  supabaseUrl: string,
  fetchFn: typeof fetch,
): Promise<Response> {
  const stop = preflight(request, route, supabaseUrl);
  if (stop !== null) return stop;
  const body = route.method === "POST" ? await readJson(request) : undefined;
  const args = route.args(body, new URL(request.url).searchParams);
  if (args === null) return jsonResponse(400, { error: "invalid_input" });
  return callStaffRpc(fetchFn, supabaseUrl, route.rpc, args);
}

export function createHandler(deps: HandlerDeps) {
  const allowList = deps.allowList ?? KODY_APP.staffAllowList;
  const supabaseUrl = deps.supabaseUrl ?? KODY_APP.supabaseUrl;

  async function panel(request: Request): Promise<Response> {
    if (request.method !== "GET") {
      return new Response(null, { status: 405, headers: { Allow: "GET" } });
    }
    const user = await deps.resolveUser(request);
    if (user === null) return redirect(request, loginUrl(PANEL_PATH));
    return isStaff(user, allowList)
      ? panelPage(user.username)
      : forbiddenPage(user.username);
  }

  async function staffApi(request: Request, name: string): Promise<Response> {
    const user = await deps.resolveUser(request);
    if (user === null) {
      return jsonResponse(401, {
        error: "unauthenticated",
        loginUrl: loginUrl(PANEL_PATH),
      });
    }
    if (!isStaff(user, allowList)) {
      return jsonResponse(403, { error: "forbidden" });
    }
    const route = STAFF_ROUTES.get(name);
    if (route === undefined) return jsonResponse(404, { error: "not_found" });
    return runStaffRoute(request, route, supabaseUrl, deps.fetch);
  }

  /** Kody package-app fetch handler. The game is public; `/panel/` and `/api/staff/*` need a staff session. */
  async function handle(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === "/" || path === "/index.html") {
      return redirect(request, KODY_APP.gamePath);
    }
    if (path === "/panel" || path === PANEL_PATH) return panel(request);
    if (path.startsWith(STAFF_PREFIX)) {
      return staffApi(request, path.slice(STAFF_PREFIX.length));
    }
    return new Response("Not found", { status: 404 });
  }

  return { fetch: handle };
}
