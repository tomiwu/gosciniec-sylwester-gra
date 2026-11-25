/** Types for the Kody runtime module that the package-app entry imports. */
declare module "kody:@kentcdodds/package-app-kit/auth" {
  export type PackageAppUser = { id: string; username: string };

  export function createPackageAppAuth(options: { packageName: string }): {
    resolveUser(request: Request): Promise<PackageAppUser | null>;
  };
}
