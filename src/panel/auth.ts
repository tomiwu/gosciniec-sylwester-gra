/**
 * Staff sign-in with Kody (package app auth).
 * The browser only asks "who is signed in". The staff allow-list check here
 * selects the view. The same-origin staff routes (issue #17) enforce it again.
 */
export type KodySession = {
  userId: string;
  username: string;
};

/** One Kody auth source for the panel. Issue #17 adds the real Kody adapter. */
export type StaffAuth = {
  restore(): Promise<KodySession | null>;
  signIn(): Promise<KodySession | null>;
  signOut(): Promise<void>;
};

/** The part of the Web Storage API that the mock uses. */
export type SessionStorageLike = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export const MOCK_SESSION_KEY = "syl-panel-mock-kody-session";

/** True when the Kody username (any case) or the Kody user id is on the list. */
export function isStaff(
  session: KodySession | null,
  allowList: readonly string[],
): boolean {
  if (!session) return false;
  const name = session.username.trim().toLowerCase();
  return allowList.some((entry) => {
    const clean = entry.trim();
    return clean === session.userId || clean.toLowerCase() === name;
  });
}

function toSession(value: unknown): KodySession | null {
  if (typeof value !== "object" || value === null) return null;
  const { userId, username } = value as Record<string, unknown>;
  if (typeof userId !== "string" || typeof username !== "string") return null;
  return { userId, username };
}

function parseSession(raw: string | null): KodySession | null {
  if (raw === null) return null;
  try {
    return toSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Local mock of a Kody session, for tests and local dev. It does not use the network.
 * signIn() always signs in `user`. The allow-list decides if that user is staff.
 */
export function createMockKodyAuth(options: {
  storage: SessionStorageLike;
  user: KodySession;
}): StaffAuth {
  const { storage, user } = options;
  return {
    async restore() {
      return parseSession(storage.getItem(MOCK_SESSION_KEY));
    },
    async signIn() {
      storage.setItem(MOCK_SESSION_KEY, JSON.stringify(user));
      return { ...user };
    },
    async signOut() {
      storage.removeItem(MOCK_SESSION_KEY);
    },
  };
}

/** In-memory storage for tests, and for a browser that blocks Web Storage. */
export function createMemoryStorage(): SessionStorageLike {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
  };
}
