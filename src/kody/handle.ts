import { callStaffRpc, type StaffRpcName } from "./staff-rpc";

export const PACKAGE_LEAF = "gosciniec-sylwester-gra";

export type AppUser = { id: string; username: string };

export type HandleDeps = {
  fetch: typeof fetch;
  allowList: readonly string[];
  resolveUser: (request: Request) => Promise<AppUser | null>;
};

const STAFF_ROUTES: Record<
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

/** Kody fetch handler: staff RPCs stay on the server. Static pages come from /_assets. */
export async function handleRequest(
  request: Request,
  deps: HandleDeps,
): Promise<Response> {
  const path = pathname(request);
  const method = request.method.toUpperCase();

  if (method === "GET" && (path === "" || path === "/")) {
    return assetRedirect(request, "/_assets/index.html");
  }
  if (method === "GET" && (path === "/panel" || path === "/panel/index.html")) {
    return assetRedirect(request, "/_assets/panel/index.html");
  }

  if (path === "/api/staff/me" && method === "GET") {
    const user = await deps.resolveUser(request);
    return json(200, { user });
  }

  const needsStaff = path.startsWith("/api/staff/") && path !== "/api/staff/me";
  if (needsStaff) {
    const user = await deps.resolveUser(request);
    if (!isStaff(user, deps.allowList)) {
      return json(401, { error: "unauthorized" });
    }

    if (path === "/api/staff/codes" && method === "GET") {
      const result = await callStaffRpc(
        "list_codes",
        { p_limit: 200, p_offset: 0 },
        deps,
      );
      return json(result.status, result.body);
    }
    if (path === "/api/staff/stats" && method === "GET") {
      const result = await callStaffRpc("dashboard_stats", {}, deps);
      return json(result.status, result.body);
    }
    if (path === "/api/staff/ranking" && method === "GET") {
      const result = await callStaffRpc("leaderboard", { p_limit: 50 }, deps);
      return json(result.status, result.body);
    }

    const route = STAFF_ROUTES[path];
    if (route && method === "POST") {
      const body = await readJson(request);
      const result = await callStaffRpc(route.rpc, route.args(body), deps);
      return json(result.status, result.body);
    }

    return json(404, { error: "not_found" });
  }

  return json(404, { error: "not_found" });
}
