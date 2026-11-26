import { createPackageAppAuth } from "kody:@kentcdodds/package-app-kit/auth";
import { packageContext } from "kody:runtime";
import { handleRequest, PACKAGE_LEAF, type AppUser } from "./handle";

const authOptions: { packageName: string; cookiePrefix?: string } = {
  packageName: PACKAGE_LEAF,
};
if (packageContext?.cookiePrefix) {
  authOptions.cookiePrefix = packageContext.cookiePrefix;
}
const auth = createPackageAppAuth(authOptions);

async function resolveUser(request: Request): Promise<AppUser | null> {
  const user = await auth.resolveUser(request);
  if (!user) return null;
  return { id: user.id, username: user.username };
}

/** Kody package-app entry. Do not put the service role in the client bundle. */
export default {
  async fetch(request: Request): Promise<Response> {
    return handleRequest(request, {
      fetch,
      allowList: ["tomiwu"],
      resolveUser,
    });
  },
};
