declare module "kody:runtime" {
  export const packageContext:
    | { hostedUrl?: string; cookiePrefix?: string }
    | undefined;
}

declare module "kody:@kentcdodds/package-app-kit/auth" {
  export type PackageAppUser = {
    id: string;
    username: string;
  };

  export function createPackageAppAuth(options: {
    packageName: string;
    cookiePrefix?: string;
  }): {
    resolveUser(request: Request): Promise<PackageAppUser | null>;
    loginUrl(options?: { returnTo?: string }): string;
    logoutUrl(options?: { returnTo?: string }): string;
  };
}
