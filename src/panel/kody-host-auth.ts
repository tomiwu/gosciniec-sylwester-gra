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

/** Accepts a few /-/auth/me shapes that Kody may return. */
export function sessionFromMe(value: unknown): KodySession | null {
  const root = asRecord(value);
  if (!root) return null;
  const user = asRecord(root.user) ?? root;
  const userId =
    (typeof user.id === "string" && user.id) ||
    (typeof user.userId === "string" && user.userId) ||
    (typeof root.userId === "string" && root.userId) ||
    "";
  const username =
    (typeof user.username === "string" && user.username) ||
    (typeof user.login === "string" && user.login) ||
    (typeof root.username === "string" && root.username) ||
    "";
  if (!userId || !username) return null;
  return { userId, username };
}

export function createKodyHostAuth(options?: {
  fetch?: typeof fetch;
  assign?: (url: string) => void;
  loginPath?: string;
  logoutPath?: string;
  mePath?: string;
}): StaffAuth {
  const get = options?.fetch ?? fetch;
  const assign =
    options?.assign ??
    ((url: string) => {
      window.location.assign(url);
    });
  const loginPath = options?.loginPath ?? "/-/auth/login?return_to=/panel/";
  const logoutPath = options?.logoutPath ?? "/-/auth/logout?return_to=/panel/";
  const mePath = options?.mePath ?? "/-/auth/me";

  return {
    async restore() {
      try {
        const response = await get(mePath, { credentials: "same-origin" });
        if (!response.ok) return null;
        return sessionFromMe(await response.json());
      } catch {
        return null;
      }
    },
    async signIn() {
      assign(loginPath);
      return null;
    },
    async signOut() {
      assign(logoutPath);
    },
  };
}
