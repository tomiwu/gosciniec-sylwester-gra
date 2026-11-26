import type { KodySession, StaffAuth } from "./auth";

/** Package-app hosts that serve Sign in with Kody at /-/auth/*. */
export function isKodyHost(hostname: string): boolean {
  return hostname.endsWith(".kody.run") || hostname.endsWith(".kody.codes");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function stringFromRecord(
  record: Record<string, unknown>,
  keys: readonly string[],
): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "";
}

function firstString(
  records: Array<Record<string, unknown> | null>,
  keys: readonly string[],
): string {
  for (const record of records) {
    if (!record) continue;
    const found = stringFromRecord(record, keys);
    if (found) return found;
  }
  return "";
}

/** Accepts a few /-/auth/me shapes that Kody may return. */
export function sessionFromMe(value: unknown): KodySession | null {
  const root = asRecord(value);
  if (!root) return null;
  const user = asRecord(root.user) ?? root;
  const userId = firstString([user, root], ["id", "userId"]);
  const username = firstString([user, root], ["username", "login"]);
  if (!userId || !username) return null;
  return { userId, username };
}

function defaultAssign(url: string): void {
  window.location.assign(url);
}

type HostAuthOptions = {
  fetch?: typeof fetch;
  assign?: (url: string) => void;
  loginPath?: string;
  logoutPath?: string;
  mePath?: string;
};

const AUTH_DEFAULTS = {
  loginPath: "/-/auth/login?return_to=/panel/",
  logoutPath: "/-/auth/logout?return_to=/panel/",
  mePath: "/-/auth/me",
};

function hostAuthOptions(options: HostAuthOptions = {}): {
  fetch: typeof fetch;
  assign: (url: string) => void;
  loginPath: string;
  logoutPath: string;
  mePath: string;
} {
  return { fetch, assign: defaultAssign, ...AUTH_DEFAULTS, ...options };
}

async function restoreMe(
  get: typeof fetch,
  mePath: string,
): Promise<KodySession | null> {
  try {
    const response = await get(mePath, { credentials: "same-origin" });
    if (!response.ok) return null;
    return sessionFromMe(await response.json());
  } catch {
    return null;
  }
}

export function createKodyHostAuth(options?: HostAuthOptions): StaffAuth {
  const cfg = hostAuthOptions(options);
  return {
    restore: () => restoreMe(cfg.fetch, cfg.mePath),
    async signIn() {
      cfg.assign(cfg.loginPath);
      return null;
    },
    async signOut() {
      cfg.assign(cfg.logoutPath);
    },
  };
}
