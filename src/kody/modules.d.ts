declare module "kody:runtime" {
  export const packageContext:
    | { hostedUrl?: string; cookiePrefix?: string }
    | undefined;

  export type KodyCredentialClient = {
    fetch: typeof fetch;
  };

  /** Open the package credential declared in package.json kody.credentials. */
  export function credential(
    key: "supabase-service-role",
  ): Promise<KodyCredentialClient>;
}
