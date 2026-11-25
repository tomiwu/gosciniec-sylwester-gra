import { createMockBackend } from "./mock";
import { createSupabaseBackend, createSupabaseStaff } from "./supabase";
import type { ScoreBackend, StaffBackend } from "./types";

/** Public Vite env values. The anon key is a public client key, not a secret. */
export type BackendEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
};

export type SelectedBackend = {
  mode: "mock" | "supabase";
  player: ScoreBackend;
  /** Staff calls use the session token of the staff Auth user. The mock ignores it. */
  staff: (accessToken: string) => StaffBackend;
};

function filled(value: string | undefined): string {
  return (value ?? "").trim();
}

/** Supabase only when the URL and the anon key are both set. Otherwise the local mock. */
export function selectBackend(
  env: BackendEnv,
  fetchFn: typeof fetch,
): SelectedBackend {
  const url = filled(env.VITE_SUPABASE_URL);
  const anonKey = filled(env.VITE_SUPABASE_ANON_KEY);
  if (!url || !anonKey) {
    const mock = createMockBackend();
    return { mode: "mock", player: mock, staff: () => mock };
  }
  const base = { url, anonKey, fetch: fetchFn };
  return {
    mode: "supabase",
    player: createSupabaseBackend(base),
    staff: (accessToken) => createSupabaseStaff({ ...base, accessToken }),
  };
}
