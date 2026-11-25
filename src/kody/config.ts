/** Kody package-app settings. Secret values never go in this file. */
export const KODY_APP = {
  /** Package leaf name. The full name is `@tomiwu/gosciniec-sylwester-gra`. */
  packageName: "gosciniec-sylwester-gra",
  /** Kody usernames that may open `/panel/` and call `/api/staff/*`. */
  staffAllowList: ["tomiwu"],
  /**
   * Supabase project URL, for example `https://<project-ref>.supabase.co`.
   * Tomasz sends it. While it is empty, staff routes answer 503 and do not call Supabase.
   */
  supabaseUrl: "",
  /** Where the built game lives (`kody.app.assets`, `vite build --base /_assets/`). */
  gamePath: "/_assets/index.html",
  loginPath: "/-/auth/login",
  logoutPath: "/-/auth/logout",
} as const;

/** Limits for staff API input. They match the Supabase RPC checks. */
export const STAFF_API = {
  codeMaxLength: 32,
  noteMaxLength: 200,
  nicknameMaxLength: 16,
  listDefaultLimit: 50,
  listMaxLimit: 200,
} as const;

export function loginUrl(returnTo: string, app = KODY_APP): string {
  return `${app.loginPath}?returnTo=${encodeURIComponent(returnTo)}`;
}

export function logoutUrl(returnTo: string, app = KODY_APP): string {
  return `${app.logoutPath}?returnTo=${encodeURIComponent(returnTo)}`;
}
